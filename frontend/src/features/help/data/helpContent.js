/**
 * Single source of truth for ToothCare Hub Public Help Center content.
 *
 * Every workflow, status name, and policy statement in this file is grounded
 * in the implemented ToothCare Hub codebase. Policies that are configurable
 * by clinic administration (such as cancellation cutoff hours, advance booking
 * windows, and official contact details) explicitly note clinic confirmation.
 */

export const HELP_CATEGORIES = [
  {
    id: 'account',
    title: 'Account & Login',
    shortLabel: 'Account & Login',
    description:
      'Create a patient account, verify your email address, sign in securely, and recover access if you forget your password.',
    icon: 'UserCheck',
    highlights: [
      'Patient registration & email verification',
      'Secure session sign-in',
      'Forgot password & reset links',
    ],
  },
  {
    id: 'appointments',
    title: 'Appointments',
    shortLabel: 'Appointments',
    description:
      'Book consultations step by step, understand Pending and Confirmed statuses, and cancel or reschedule eligible visits.',
    icon: 'CalendarCheck',
    highlights: [
      '4-step online booking wizard',
      'Status lifecycle & review tracking',
      'Cancellation & rescheduling rules',
    ],
  },
  {
    id: 'services',
    title: 'Dental Services',
    shortLabel: 'Dental Services',
    description:
      'Explore available clinical procedures, standard durations, fee snapshots, and attending dentist schedules before booking.',
    icon: 'Stethoscope',
    highlights: [
      'Active service catalog & categories',
      'Duration & standardized fee snapshots',
      'Certified dentist profiles & shifts',
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    shortLabel: 'Notifications',
    description:
      'Learn when ToothCare Hub sends email and in-app updates for bookings, approvals, rejections, cancellations, and reminders.',
    icon: 'BellRing',
    highlights: [
      'Booking & status-change emails',
      'Live in-app portal notifications',
      'Troubleshooting missing emails',
    ],
  },
];

export const FAQ_FILTER_TABS = [
  { id: 'all', label: 'All Topics' },
  { id: 'account', label: 'Account & Login' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'services', label: 'Dental Services' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'general', label: 'General' },
];

export const HELP_FAQS = [
  // Account & Login
  {
    id: 'faq-create-account',
    category: 'account',
    question: 'How do I create a ToothCare Hub account?',
    answer:
      'Select Sign In from the navigation bar and choose Create Account (or open /register). Enter your first name, last name, email address, phone number, date of birth, and a strong password, then review and accept the Terms of Service and Privacy Policy. You may also add optional details such as your address, emergency contact, or medical alerts. After registering, check your email inbox for a verification link to activate your account.',
    keywords: ['register', 'signup', 'sign up', 'new patient', 'verification', 'profile'],
    relatedGuideIds: ['guide-create-account'],
  },
  {
    id: 'faq-login',
    category: 'account',
    question: 'How do I log in?',
    answer:
      'Select Sign In in the top navigation bar (or visit /login) and enter your registered email address and password. Once authenticated, ToothCare Hub automatically directs you to your Patient Portal dashboard where you can book appointments, review upcoming visits, and manage your profile.',
    keywords: ['sign in', 'login', 'portal', 'access', 'session'],
    relatedGuideIds: ['guide-login'],
  },
  {
    id: 'faq-forgot-password',
    category: 'account',
    question: 'What should I do if I forget my password?',
    answer:
      'On the Sign In page, select "Forgot password?" (or visit /forgot-password) and enter the email address associated with your account. For privacy and security, ToothCare Hub displays a neutral confirmation message and dispatches password reset instructions if an account matches that email.',
    keywords: ['forgot', 'password', 'reset', 'locked out', 'recover'],
    relatedGuideIds: ['guide-reset-password'],
  },
  {
    id: 'faq-recover-access',
    category: 'account',
    question: 'How can I recover access to my account?',
    answer:
      'First try resetting your password via the Forgot Password page using your registered email address. If you registered recently and have not yet verified your email, open the verification link in your inbox or request a fresh link on the Email Verification page (/verify-email). If you no longer have access to your registered email address, contact clinic reception directly for identity verification assistance—never share your password with anyone.',
    keywords: ['recover', 'verify email', 'resend verification', 'cannot sign in', 'account access'],
    relatedGuideIds: ['guide-reset-password', 'guide-create-account'],
  },

  // Appointments
  {
    id: 'faq-book-appointment',
    category: 'appointments',
    question: 'How do I book a dental appointment?',
    answer:
      'Sign in to your Patient Portal and open Book Appointment. The guided booking wizard walks you through four steps: (1) choose an active dental service, (2) select your attending dentist, (3) pick an available date and live time slot, and (4) review your details, add optional chief complaint or symptom notes, confirm the booking policy, and submit your request.',
    keywords: ['book', 'schedule', 'wizard', 'consultation', 'slot'],
    relatedGuideIds: ['guide-book-appointment'],
  },
  {
    id: 'faq-select-service',
    category: 'appointments',
    question: 'How do I select a dental service?',
    answer:
      'You can browse active dental services on the public landing page, filter by category, and click "Book Service" to pre-select that procedure—or choose any active service directly in Step 1 of the Patient Portal booking wizard. Each service lists its category, expected duration in minutes, and standardized clinic fee snapshot.',
    keywords: ['service', 'procedure', 'cleaning', 'fee', 'price', 'duration'],
    relatedGuideIds: ['guide-book-appointment'],
  },
  {
    id: 'faq-choose-dentist',
    category: 'appointments',
    question: 'Can I choose a dentist?',
    answer:
      'Yes. You can browse certified attending dentist profiles—including their specialization, assigned operatory chair, and active clinic shift days—on the landing page or inside the Patient Portal. In Step 2 of the booking wizard, you choose the dentist you would like to consult, and Step 3 displays only their real-time open slots.',
    keywords: ['dentist', 'doctor', 'practitioner', 'specialist', 'provider', 'shifts'],
    relatedGuideIds: ['guide-book-appointment'],
  },
  {
    id: 'faq-check-status',
    category: 'appointments',
    question: 'How do I check my appointment status?',
    answer:
      'Sign in to your Patient Portal and navigate to My Appointments. Each appointment card displays its current status badge (Pending, Confirmed, Rejected, Cancelled, or Completed). Select any appointment to view its full details and chronological status history timeline.',
    keywords: ['status', 'track', 'history', 'my appointments', 'timeline'],
    relatedGuideIds: ['guide-check-status'],
  },
  {
    id: 'faq-status-pending',
    category: 'appointments',
    question: 'What does Pending mean?',
    answer:
      'Pending means your appointment request has been recorded and reserved in the booking queue, and is awaiting review by clinic reception. Reception verifies dentist availability and operatory chair allocation before approving or declining the request.',
    keywords: ['pending', 'waiting', 'review', 'triage', 'approval'],
    relatedGuideIds: ['guide-check-status'],
  },
  {
    id: 'faq-status-confirmed',
    category: 'appointments',
    question: 'What does Confirmed mean?',
    answer:
      'Confirmed means clinic reception has reviewed and approved your appointment request for the scheduled date, time slot, dentist, and operatory chair. You will receive an email and in-app notification once your status advances to Confirmed.',
    keywords: ['confirmed', 'approved', 'scheduled', 'visit'],
    relatedGuideIds: ['guide-check-status'],
  },
  {
    id: 'faq-cancel-appointment',
    category: 'appointments',
    question: 'Can I cancel my appointment?',
    answer:
      'Yes. From My Appointments in your Patient Portal, you can cancel appointments that are currently Pending or Confirmed and provide an optional reason. For Confirmed appointments, the system enforces the clinic cancellation cutoff window configured by clinic administration (default 24 hours prior to the scheduled start time; please confirm any clinic-specific late-cancellation exceptions directly with reception).',
    keywords: ['cancel', 'cancellation', 'cutoff', '24 hours', 'policy'],
    relatedGuideIds: ['guide-cancel-reschedule'],
    requiresClinicConfirmation: true,
  },
  {
    id: 'faq-reschedule-appointment',
    category: 'appointments',
    question: 'Can I reschedule my appointment?',
    answer:
      'Yes. Eligible Pending and Confirmed appointments include a Reschedule option inside My Appointments. When you pick a new open date and time slot, ToothCare Hub cancels your original slot and creates a new linked Pending request for reception review. Please confirm any clinic-specific notice rules or rescheduling limits with reception if your visit is approaching soon.',
    keywords: ['reschedule', 'change time', 'move appointment', 'new slot'],
    relatedGuideIds: ['guide-cancel-reschedule'],
    requiresClinicConfirmation: true,
  },

  // Dental Services
  {
    id: 'faq-service-info-and-availability',
    category: 'services',
    question: 'How are dental service durations, fees, and dentist availability determined?',
    answer:
      'Active dental services display their expected procedural duration and standardized fee snapshot at the time of booking. Available appointment slots are calculated in real time using clinic operating hours (Asia/Manila timezone), each dentist’s active working shifts, approved time-off blocks, existing bookings, and mandatory 10-minute operatory turnaround sanitization buffers. Final clinical recommendations and any additional treatment costs are confirmed by your attending dentist during consultation.',
    keywords: ['availability', 'slots', 'sanitization buffer', 'fees', 'pricing', 'operating hours'],
    relatedGuideIds: ['guide-book-appointment'],
    requiresClinicConfirmation: true,
  },

  // Notifications
  {
    id: 'faq-email-after-booking',
    category: 'notifications',
    question: 'Will I receive an email after booking?',
    answer:
      'Yes. When you submit a booking request, ToothCare Hub queues an email notification through its transactional email outbox confirming that your Pending request was received. You also receive emails for appointment confirmations, rejections, cancellations, and scheduled appointment reminders.',
    keywords: ['email', 'confirmation email', 'outbox', 'receipt', 'reminder'],
    relatedGuideIds: ['guide-book-appointment', 'guide-check-status'],
  },
  {
    id: 'faq-know-confirmed',
    category: 'notifications',
    question: 'How will I know if my appointment is confirmed?',
    answer:
      'As soon as clinic reception approves your request, ToothCare Hub updates your appointment badge to Confirmed in My Appointments, dispatches a confirmation email to your registered address, and delivers a real-time notification inside your Patient Portal Notification Center.',
    keywords: ['confirmed', 'alert', 'notification center', 'real-time', 'live update'],
    relatedGuideIds: ['guide-check-status'],
  },
  {
    id: 'faq-missing-email',
    category: 'notifications',
    question: 'What should I do if I do not receive an email?',
    answer:
      'Wait a few minutes for asynchronous email delivery, then check your Spam, Junk, or Promotions folders and confirm the email address registered on your profile. For email verification messages, you can request a new link from the Email Verification page (/verify-email). Even if an email is delayed, your live appointment status is always available in My Appointments inside the Patient Portal. If you still need help, contact clinic reception.',
    keywords: ['did not receive', 'spam', 'junk', 'missing email', 'not arriving', 'resend'],
    relatedGuideIds: ['guide-check-status', 'guide-reset-password'],
  },

  // General
  {
    id: 'faq-need-account',
    category: 'general',
    question: 'Do I need an account to book an appointment?',
    answer:
      'You can browse dental services, review dentist profiles, view clinic hours, and read this Help Center without signing in. To submit, track, cancel, or reschedule an appointment, you must register and sign in to a patient account so your personal details, chief complaints, and visit history stay protected.',
    keywords: ['guest', 'account required', 'public', 'privacy', 'browse'],
    relatedGuideIds: ['guide-create-account', 'guide-book-appointment'],
  },
  {
    id: 'faq-mobile-access',
    category: 'general',
    question: 'Can I access ToothCare Hub using my phone?',
    answer:
      'Yes. ToothCare Hub is built with a mobile-first responsive layout that adapts across smartphones, tablets, laptops, and desktop monitors, supporting both Light Mode and Dark Mode.',
    keywords: ['mobile', 'phone', 'tablet', 'responsive', 'dark mode'],
    relatedGuideIds: [],
  },
  {
    id: 'faq-contact-clinic',
    category: 'general',
    question: 'How can I contact the clinic?',
    answer:
      'Scroll down to the "Still need assistance?" section on this page (or visit the Contact section on the home page) to view clinic reception contact details and operating hours. If you are experiencing a severe dental emergency outside operating hours, please proceed immediately to your nearest emergency medical facility.',
    keywords: ['contact', 'phone', 'email', 'reception', 'hours', 'emergency'],
    relatedGuideIds: [],
    requiresClinicConfirmation: true,
  },
];

export const HELP_GUIDES = [
  {
    id: 'guide-create-account',
    category: 'account',
    title: 'How to Create a Patient Account',
    summary: 'Register your ToothCare Hub patient profile and verify your email address in minutes.',
    estimatedTime: '2 min read',
    steps: [
      'Select Sign In from the top navigation bar, then click Create Account to open the registration page (/register).',
      'Fill in your required details: First Name, Last Name, Email Address, Phone Number, and Date of Birth.',
      'Optionally expand Additional Details to add your address, emergency contact, or medical alerts for your dentist.',
      'Create a strong password that meets all displayed security criteria, confirm it, and accept the Terms of Service and Privacy Policy.',
      'Submit the form, then open the verification email sent to your inbox to activate your account before signing in.',
    ],
    relatedFaqIds: ['faq-create-account', 'faq-recover-access', 'faq-need-account'],
    nextAction: { label: 'Go to Registration', actionKey: 'register' },
  },
  {
    id: 'guide-login',
    category: 'account',
    title: 'How to Log In to Your Portal',
    summary: 'Access your patient dashboard securely from any phone, tablet, or computer.',
    estimatedTime: '1 min read',
    steps: [
      'Click Sign In in the top header or footer to open the login page (/login).',
      'Enter the email address and password associated with your verified ToothCare Hub account.',
      'Select Sign In to establish a secure session. You will be taken directly to your Patient Portal dashboard.',
      'When finished on a shared device, open the account menu in the portal header and select Sign Out.',
    ],
    relatedFaqIds: ['faq-login', 'faq-forgot-password'],
    nextAction: { label: 'Open Sign In Page', actionKey: 'login' },
  },
  {
    id: 'guide-book-appointment',
    category: 'appointments',
    title: 'How to Book a Dental Appointment',
    summary: 'Use the guided booking wizard to choose your procedure, dentist, and real-time open slot.',
    estimatedTime: '3 min read',
    steps: [
      'Sign in to your Patient Portal and choose Book Appointment (or click Book Service / Consult with Doctor from the home page).',
      'Step 1 — Select Service: Choose an active dental procedure and review its expected duration and standardized fee snapshot.',
      'Step 2 — Select Dentist: Pick an attending dentist based on specialization, operatory chair, and working shifts.',
      'Step 3 — Pick Date & Time Slot: Select a date and choose an available live slot calculated against clinic hours, doctor shifts, and sanitization buffers.',
      'Step 4 — Review & Submit: Add any optional chief complaint or symptom notes, confirm the booking policy checkbox, and submit your request. Your appointment starts in Pending status for reception review.',
    ],
    relatedFaqIds: ['faq-book-appointment', 'faq-select-service', 'faq-choose-dentist', 'faq-email-after-booking'],
    nextAction: { label: 'Book an Appointment', actionKey: 'book' },
  },
  {
    id: 'guide-check-status',
    category: 'appointments',
    title: 'How to Check Your Appointment Status',
    summary: 'Track your booking from Pending review through Confirmation and completion.',
    estimatedTime: '1 min read',
    steps: [
      'Sign in to your Patient Portal and open My Appointments from the sidebar or dashboard.',
      'Filter by All, Upcoming, Pending, Completed, or Cancelled—or search by service or dentist name.',
      'Check the status badge on each appointment card (Pending, Confirmed, Rejected, Cancelled, or Completed).',
      'Click View Details on any appointment card to inspect the chronological status history timeline and visit notes.',
    ],
    relatedFaqIds: ['faq-check-status', 'faq-status-pending', 'faq-status-confirmed', 'faq-know-confirmed'],
    nextAction: { label: 'View My Appointments', actionKey: 'appointments' },
  },
  {
    id: 'guide-cancel-reschedule',
    category: 'appointments',
    title: 'How to Cancel or Reschedule',
    summary: 'Adjust an upcoming Pending or Confirmed consultation directly from My Appointments.',
    estimatedTime: '2 min read',
    steps: [
      'Sign in to your Patient Portal and navigate to My Appointments.',
      'Locate the Pending or Confirmed appointment you need to update.',
      'To cancel: select Cancel, enter an optional cancellation reason, and confirm. Note that Confirmed visits are subject to the clinic’s cancellation cutoff window (default 24 hours prior to start time).',
      'To reschedule: select Reschedule, pick a new available date and time slot, and confirm. ToothCare Hub cancels the previous slot and submits a new linked Pending request for reception approval.',
    ],
    relatedFaqIds: ['faq-cancel-appointment', 'faq-reschedule-appointment'],
    nextAction: { label: 'Manage My Appointments', actionKey: 'appointments' },
  },
  {
    id: 'guide-reset-password',
    category: 'account',
    title: 'How to Reset a Forgotten Password',
    summary: 'Regain secure access to your account using the self-service password reset flow.',
    estimatedTime: '2 min read',
    steps: [
      'Open the Sign In page (/login) and click "Forgot password?" (or navigate directly to /forgot-password).',
      'Enter the email address registered to your ToothCare Hub account and submit the form.',
      'Check your inbox (and Spam/Junk folders) for the password reset email and open the secure reset link.',
      'Enter and confirm a new strong password on the Reset Password page (/reset-password), then return to Sign In.',
    ],
    relatedFaqIds: ['faq-forgot-password', 'faq-recover-access', 'faq-missing-email'],
    nextAction: { label: 'Reset Forgotten Password', actionKey: 'forgot-password' },
  },
];
