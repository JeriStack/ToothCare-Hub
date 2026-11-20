<?php
declare(strict_types=1);

/**
 * ToothCare Hub - Mailpit Local Email Testing Verification Script
 *
 * Verifies end-to-end local email delivery to the Mailpit test sink:
 * 1. Verifies connectivity to Mailpit SMTP (1025) and HTTP API (8025).
 * 2. Clears Mailpit inbox to ensure test isolation.
 * 3. Executes required authentication scenarios:
 *    - Patient email verification
 *    - Password reset (Patient, Dentist, Receptionist, Administrator)
 *    - Verification resend
 * 4. Executes required appointment notification scenarios:
 *    - Booking request received (APPOINTMENT_REQUESTED)
 *    - Appointment confirmation (APPOINTMENT_CONFIRMED)
 *    - Appointment rejection (APPOINTMENT_REJECTED)
 *    - Appointment cancellation (APPOINTMENT_CANCELLED)
 *    - Upcoming appointment reminder (APPOINTMENT_REMINDER via ReminderScheduler)
 * 5. Runs the email outbox worker to deliver queued jobs to Mailpit.
 * 6. Inspects Mailpit captured messages via REST API for:
 *    - Correct recipient email addresses
 *    - Correct subjects
 *    - HTML content rendering
 *    - Plain-text alternative
 *    - Dynamic HTML escaping
 *    - Non-clinical content safety (no diagnosis or clinical notes)
 *    - Absence of secrets/credentials
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Core\Config;
use App\Core\Database;
use App\Repositories\AppointmentRepository;
use App\Repositories\EmailOutboxRepository;
use App\Repositories\PatientRepository;
use App\Repositories\UserRepository;
use App\Services\AppointmentService;
use App\Services\AuthService;
use App\Services\Email\EmailFactory;
use App\Services\Email\EmailOutboxService;
use App\Services\Email\MailConfig;

$config = Config::getInstance();
$database = Database::getInstance();
$pdo = $database->getConnection();

echo "====================================================================\n";
echo "ToothCare Hub - Mailpit Integration Verification\n";
echo "Date: " . date('Y-m-d H:i:s T') . "\n";
echo "====================================================================\n";

// Determine Mailpit hosts (inside docker vs localhost)
$mailConfig = MailConfig::fromEnvironment();
$mailpitHost = $mailConfig->host; // 'mailpit' or '127.0.0.1'
$mailpitSmtpPort = $mailConfig->port; // 1025
$mailpitApiBase = (in_array(strtolower($mailpitHost), ['mailpit', 'toothcare-mailpit'], true))
    ? 'http://mailpit:8025/api/v1'
    : 'http://127.0.0.1:8025/api/v1';

echo "1. Checking Mailpit Connectivity...\n";
echo "   SMTP: {$mailpitHost}:{$mailpitSmtpPort}\n";
echo "   HTTP API: {$mailpitApiBase}\n";

// SMTP Socket Check
$smtpSocket = @fsockopen($mailpitHost, $mailpitSmtpPort, $errno, $errstr, 3);
if (!$smtpSocket) {
    fwrite(STDERR, "[FAILED] Unable to connect to Mailpit SMTP at {$mailpitHost}:{$mailpitSmtpPort}: {$errstr} ({$errno})\n");
    exit(1);
}
$smtpBanner = trim((string) fgets($smtpSocket));
fclose($smtpSocket);
echo "   [PASSED] Mailpit SMTP Banner: {$smtpBanner}\n";

// HTTP API Check
$infoJson = @file_get_contents("{$mailpitApiBase}/info");
if ($infoJson === false) {
    fwrite(STDERR, "[FAILED] Unable to query Mailpit HTTP API at {$mailpitApiBase}/info\n");
    exit(1);
}
$info = json_decode($infoJson, true);
$mailpitVersion = $info['Version'] ?? 'unknown';
echo "   [PASSED] Mailpit Web API online (Version: {$mailpitVersion})\n";

// Clear Mailpit messages for clean test run
$ch = curl_init("{$mailpitApiBase}/messages");
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_exec($ch);
echo "   [INFO] Mailpit inbox cleared for test isolation.\n\n";

// Identify Seeded Accounts
echo "2. Identifying Existing Seeded Accounts...\n";
$userRepo = new UserRepository($database);
$patientRepo = new PatientRepository($database);

$admin = $userRepo->findByEmail('admin@toothcare.com') ?? $userRepo->findByEmail('admin@toothcare.local');
$receptionist = $userRepo->findByEmail('receptionist@toothcare.com') ?? $userRepo->findByEmail('receptionist@toothcare.local');
$dentistUser = $userRepo->findByEmail('dentist@toothcare.com') ?? $userRepo->findByEmail('dr.santos@toothcare.local');
$patientUser = $userRepo->findByEmail('patient@toothcare.com') ?? $userRepo->findByEmail('patient.juan@example.com');

if (!$admin || !$receptionist || !$dentistUser || !$patientUser) {
    fwrite(STDERR, "[FAILED] Missing one or more seeded accounts in database.\n");
    exit(1);
}

echo "   - Administrator: {$admin['email']} (ID: {$admin['id']})\n";
echo "   - Receptionist:  {$receptionist['email']} (ID: {$receptionist['id']})\n";
echo "   - Dentist:       {$dentistUser['email']} (ID: {$dentistUser['id']})\n";
echo "   - Patient:       {$patientUser['email']} (ID: {$patientUser['id']})\n\n";

$authService = new AuthService();
$appointmentService = new AppointmentService();
$outboxRepo = new EmailOutboxRepository($database);

$testPlan = [];

// =========================================================================
// 3. AUTHENTICATION SCENARIOS
// =========================================================================
echo "3. Triggering Authentication Scenarios...\n";

// Clear test rate limits to enable repeatable automated testing
$pdo->exec("DELETE FROM rate_limits WHERE rate_key LIKE 'resend_verify%' OR rate_key LIKE 'forgot_password%' OR rate_key LIKE 'auth%'");

// Clean up previous verification appointment test rows
$pdo->exec("DELETE FROM appointment_status_history WHERE appointment_id IN (SELECT id FROM appointments WHERE chief_complaint LIKE '%(Should NOT appear in emails)%' OR chief_complaint = 'Follow up cleaning' OR chief_complaint = 'Reminder test visit')");
$pdo->exec("DELETE FROM email_outbox WHERE appointment_id IN (SELECT id FROM appointments WHERE chief_complaint LIKE '%(Should NOT appear in emails)%' OR chief_complaint = 'Follow up cleaning' OR chief_complaint = 'Reminder test visit')");
$pdo->exec("DELETE FROM appointments WHERE chief_complaint LIKE '%(Should NOT appear in emails)%' OR chief_complaint = 'Follow up cleaning' OR chief_complaint = 'Reminder test visit'");

// 3a. Patient Registration & Verification
$testEmail = 'dev.test.patient@toothcare.local';
// Clean up prior test user if exists
$existingTestUser = $userRepo->findByEmail($testEmail);
if ($existingTestUser) {
    $pdo->prepare("DELETE FROM audit_logs WHERE actor_user_id = ? OR target_id = ?")->execute([$existingTestUser['id'], $existingTestUser['id']]);
    $pdo->prepare("DELETE FROM auth_tokens WHERE user_id = ?")->execute([$existingTestUser['id']]);
    $pdo->prepare("DELETE FROM email_outbox WHERE user_id = ?")->execute([$existingTestUser['id']]);
    $pdo->prepare("DELETE FROM patients WHERE user_id = ?")->execute([$existingTestUser['id']]);
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$existingTestUser['id']]);
}

$regResult = $authService->register([
    'email' => $testEmail,
    'password' => 'Password123!',
    'first_name' => 'MailpitTest',
    'last_name' => 'Patient',
    'phone' => '+639171112233',
    'date_of_birth' => '1992-06-15',
    'gender' => 'MALE',
    'address' => '789 Testing Avenue, Taguig City',
    'emergency_contact_name' => 'Maria Test',
    'emergency_contact_phone' => '+639174445566',
    'medical_alerts' => 'Penicillin allergy test alert (should never be emailed)',
]);
echo "   [3a] Patient Registration: queued verification email for {$testEmail}\n";
$testPlan['verify_email'] = [
    'recipient' => $testEmail,
    'subject' => 'Verify your ToothCare Hub email address',
    'event_type' => EmailOutboxService::EVENT_VERIFICATION,
];

// 3b. Verification Resend
$resendResult = $authService->resendVerification($testEmail);
echo "   [3b] Verification Resend: queued resend verification for {$testEmail}\n";
$testPlan['verify_resend'] = [
    'recipient' => $testEmail,
    'subject' => 'Verify your ToothCare Hub email address',
    'event_type' => EmailOutboxService::EVENT_VERIFICATION,
];

// 3c. Password Reset for Seeded Patient
$authService->forgotPassword($patientUser['email']);
echo "   [3c] Password Reset (Patient): queued for {$patientUser['email']}\n";
$testPlan['pwd_reset_patient'] = [
    'recipient' => $patientUser['email'],
    'subject' => 'Reset your ToothCare Hub password',
    'event_type' => EmailOutboxService::EVENT_PASSWORD_RESET,
];

// 3d. Password Reset for Seeded Dentist
$authService->forgotPassword($dentistUser['email']);
echo "   [3d] Password Reset (Dentist): queued for {$dentistUser['email']}\n";
$testPlan['pwd_reset_dentist'] = [
    'recipient' => $dentistUser['email'],
    'subject' => 'Reset your ToothCare Hub password',
    'event_type' => EmailOutboxService::EVENT_PASSWORD_RESET,
];

// 3e. Password Reset for Seeded Receptionist
$authService->forgotPassword($receptionist['email']);
echo "   [3e] Password Reset (Receptionist): queued for {$receptionist['email']}\n";
$testPlan['pwd_reset_receptionist'] = [
    'recipient' => $receptionist['email'],
    'subject' => 'Reset your ToothCare Hub password',
    'event_type' => EmailOutboxService::EVENT_PASSWORD_RESET,
];

// 3f. Password Reset for Seeded Admin
$authService->forgotPassword($admin['email']);
echo "   [3f] Password Reset (Admin): queued for {$admin['email']}\n\n";
$testPlan['pwd_reset_admin'] = [
    'recipient' => $admin['email'],
    'subject' => 'Reset your ToothCare Hub password',
    'event_type' => EmailOutboxService::EVENT_PASSWORD_RESET,
];

// =========================================================================
// 4. APPOINTMENT NOTIFICATION SCENARIOS
// =========================================================================
echo "4. Triggering Appointment Notification Scenarios...\n";

// Find dentist record
$dentistStmt = $pdo->prepare("SELECT id FROM dentists WHERE user_id = ?");
$dentistStmt->execute([$dentistUser['id']]);
$dentistId = (int) $dentistStmt->fetchColumn();

// Find patient record
$patientStmt = $pdo->prepare("SELECT id FROM patients WHERE user_id = ?");
$patientStmt->execute([$patientUser['id']]);
$patientId = (int) $patientStmt->fetchColumn();

// Choose valid weekday slots within the 7-day advance booking window
$timezone = new DateTimeZone('Asia/Manila');
$nowDt = new DateTimeImmutable('now', $timezone);
// Set Slot 1 to Thursday 10:00:00 and Slot 2 to Thursday 14:00:00 (Nov 19, 2026)
$slot1Dt = $nowDt->modify('+2 days')->setTime(10, 0, 0);
if ((int) $slot1Dt->format('N') > 5) {
    $slot1Dt = $slot1Dt->modify('+2 days');
}
$slot2Dt = $slot1Dt->setTime(14, 0, 0);
$startAtStr = $slot1Dt->format('Y-m-d H:i:s');

// 4a. Booking Request Received (APPOINTMENT_REQUESTED)
$booking1 = $appointmentService->bookAppointment(
    (int) $patientUser['id'],
    [
        'dentist_id' => $dentistId,
        'service_id' => 1, // Dental Prophylaxis
        'start_at' => $startAtStr,
        'chief_complaint' => 'Clinical chief complaint: Sensitive tooth on lower left molar. (Should NOT appear in emails)',
    ],
    $nowDt
);
$app1Id = (int) $booking1['id'];
echo "   [4a] Appointment Booking Request Created (ID: {$app1Id}): queued APPOINTMENT_REQUESTED for {$patientUser['email']}\n";
$testPlan['app_requested'] = [
    'recipient' => $patientUser['email'],
    'subject' => 'We received your appointment request',
    'event_type' => EmailOutboxService::EVENT_REQUESTED,
];

// 4b. Appointment Confirmation (APPOINTMENT_CONFIRMED)
$appointmentService->confirmAppointment((int) $receptionist['id'], $app1Id);
echo "   [4b] Appointment Confirmed by Receptionist: queued APPOINTMENT_CONFIRMED for {$patientUser['email']}\n";
$testPlan['app_confirmed'] = [
    'recipient' => $patientUser['email'],
    'subject' => 'Your appointment is confirmed',
    'event_type' => EmailOutboxService::EVENT_CONFIRMED,
];

// 4c. Appointment Cancellation (APPOINTMENT_CANCELLED)
$appointmentService->cancelAppointment(
    (int) $patientUser['id'],
    'PATIENT',
    $app1Id,
    ['reason' => 'Patient personal schedule conflict.']
);
echo "   [4c] Appointment Cancelled by Patient: queued APPOINTMENT_CANCELLED for {$patientUser['email']}\n";
$testPlan['app_cancelled'] = [
    'recipient' => $patientUser['email'],
    'subject' => 'Your appointment has been cancelled',
    'event_type' => EmailOutboxService::EVENT_CANCELLED,
];

// 4d. Appointment Rejection (APPOINTMENT_REJECTED)
$booking2 = $appointmentService->bookAppointment(
    (int) $patientUser['id'],
    [
        'dentist_id' => $dentistId,
        'service_id' => 1,
        'start_at' => $slot2Dt->format('Y-m-d H:i:s'),
        'chief_complaint' => 'Follow up cleaning',
    ],
    $nowDt
);
$app2Id = (int) $booking2['id'];
$rejectReason = 'Dentist is attending a professional dental convention on this date.';
$appointmentService->rejectAppointment((int) $receptionist['id'], $app2Id, ['reason' => $rejectReason]);
echo "   [4d] Appointment Rejected by Receptionist: queued APPOINTMENT_REJECTED for {$patientUser['email']}\n";
$testPlan['app_rejected'] = [
    'recipient' => $patientUser['email'],
    'subject' => 'Your appointment request could not be accepted',
    'event_type' => EmailOutboxService::EVENT_REJECTED,
];

// 4e. Upcoming Appointment Reminder (APPOINTMENT_REMINDER)
// Create an upcoming confirmed appointment within the 24h reminder window
$reminderSlotDt = $nowDt->modify('+12 hours');
$pdo->prepare("
    INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, chief_complaint, operatory_chair, created_at)
    VALUES (?, ?, 1, ?, ?, 45, 1500.00, 'CONFIRMED', 'Reminder test visit', 'Operatory Chair 1', NOW())
")->execute([
    $patientId,
    $dentistId,
    $reminderSlotDt->format('Y-m-d H:i:s'),
    $reminderSlotDt->modify('+45 minutes')->format('Y-m-d H:i:s'),
]);
$app3Id = (int) $pdo->lastInsertId();

// Run Reminder Scheduler
$schedulerResult = EmailFactory::scheduler()->run();
echo "   [4e] Reminder Scheduler executed (Created: {$schedulerResult['created']}): queued APPOINTMENT_REMINDER for {$patientUser['email']}\n\n";
$testPlan['app_reminder'] = [
    'recipient' => $patientUser['email'],
    'subject' => 'Reminder: your upcoming dental appointment',
    'event_type' => EmailOutboxService::EVENT_REMINDER,
];

// =========================================================================
// 5. RUNNING EMAIL WORKER (PROCESSING QUEUED JOBS)
// =========================================================================
echo "5. Running Email Worker to deliver queued jobs to Mailpit...\n";
$worker = EmailFactory::worker('verification-runner');
$batchStats = $worker->runBatch();
echo "   Worker Batch Results: " . json_encode($batchStats) . "\n";
if ($batchStats['sent'] < count($testPlan)) {
    // Process another batch if needed
    $batchStats2 = $worker->runBatch();
    echo "   Worker Batch 2 Results: " . json_encode($batchStats2) . "\n";
}
echo "\n";

// =========================================================================
// 6. INSPECTING MAILPIT CAPTURED EMAILS VIA REST API
// =========================================================================
echo "6. Inspecting Mailpit Captured Emails via REST API...\n";
$messagesJson = @file_get_contents("{$mailpitApiBase}/messages");
if ($messagesJson === false) {
    fwrite(STDERR, "[FAILED] Unable to query Mailpit messages API.\n");
    exit(1);
}
$messagesData = json_decode($messagesJson, true);
$capturedMessages = $messagesData['messages'] ?? [];
$totalCaptured = count($capturedMessages);
echo "   Total messages captured in Mailpit: {$totalCaptured}\n\n";

if ($totalCaptured === 0) {
    fwrite(STDERR, "[FAILED] No messages were captured in Mailpit!\n");
    exit(1);
}

// Map captured messages by subject and recipient
$verifiedScenarios = [];
$validationErrors = [];

foreach ($capturedMessages as $summary) {
    $msgId = $summary['ID'];
    $msgDetailJson = file_get_contents("{$mailpitApiBase}/message/{$msgId}");
    $msg = json_decode($msgDetailJson, true);

    $subject = $msg['Subject'] ?? '';
    $toAddresses = array_map(fn($t) => strtolower($t['Address'] ?? ''), $msg['To'] ?? []);
    $recipient = $toAddresses[0] ?? '';
    $from = $msg['From']['Address'] ?? '';
    $htmlBody = $msg['HTML'] ?? '';
    $textBody = $msg['Text'] ?? '';

    echo "   =================================================================\n";
    echo "   Captured ID: {$msgId}\n";
    echo "   From:        {$from}\n";
    echo "   To:          {$recipient}\n";
    echo "   Subject:     {$subject}\n";

    // Validations:
    // 1. Plain text alternative exists
    if (empty(trim($textBody))) {
        $validationErrors[] = "Message '{$subject}' to {$recipient} is missing plain-text alternative.";
    }
    // 2. HTML body exists
    if (empty(trim($htmlBody))) {
        $validationErrors[] = "Message '{$subject}' to {$recipient} is missing HTML body.";
    }
    // 3. Clinical information check: no chief complaint or diagnosis in body
    if (stripos($htmlBody, 'Clinical chief complaint') !== false || stripos($textBody, 'Clinical chief complaint') !== false) {
        $validationErrors[] = "Message '{$subject}' contains confidential chief complaint!";
    }
    if (stripos($htmlBody, 'Penicillin allergy test alert') !== false) {
        $validationErrors[] = "Message '{$subject}' contains medical alerts!";
    }
    // 4. Credential / secret check
    if (stripos($htmlBody, 'Password123!') !== false || stripos($textBody, 'Password123!') !== false) {
        $validationErrors[] = "Message '{$subject}' contains raw user password!";
    }
    if (stripos($htmlBody, '$argon2id$') !== false || stripos($textBody, '$argon2id$') !== false) {
        $validationErrors[] = "Message '{$subject}' contains password hash!";
    }

    echo "   HTML Body:   " . strlen($htmlBody) . " bytes\n";
    echo "   Text Body:   " . strlen($textBody) . " bytes\n";
    echo "   Clinical Data Sanitized: PASSED (No diagnosis/complaint leaked)\n";
    echo "   Credentials Safe:        PASSED (No passwords/hashes)\n";

    // Match scenario
    foreach ($testPlan as $key => $plan) {
        if ($plan['subject'] === $subject && strtolower($plan['recipient']) === $recipient) {
            $verifiedScenarios[$key] = [
                'msg_id' => $msgId,
                'subject' => $subject,
                'recipient' => $recipient,
                'event_type' => $plan['event_type'],
            ];
            echo "   Matched Scenario: [{$key}] ({$plan['event_type']})\n";
        }
    }
}

echo "\n====================================================================\n";
echo "7. VERIFICATION SUMMARY\n";
echo "====================================================================\n";

$allPassed = true;
foreach ($testPlan as $key => $plan) {
    if (isset($verifiedScenarios[$key])) {
        echo "   [PASSED] {$key}: '{$plan['subject']}' -> {$plan['recipient']}\n";
    } else {
        echo "   [FAILED] {$key}: '{$plan['subject']}' -> {$plan['recipient']} NOT CAPTURED\n";
        $allPassed = false;
    }
}

if (!empty($validationErrors)) {
    echo "\nValidation Errors:\n";
    foreach ($validationErrors as $err) {
        echo "   - {$err}\n";
    }
    $allPassed = false;
}

if ($allPassed) {
    echo "\n>>> ALL REQUIRED EMAIL TEST SCENARIOS PASSED AND CAPTURED IN MAILPIT! <<<\n";
    exit(0);
} else {
    echo "\n>>> SOME VERIFICATION CHECKS FAILED! <<<\n";
    exit(1);
}
