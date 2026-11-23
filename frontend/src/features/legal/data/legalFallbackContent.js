/**
 * Offline / Fallback Legal Document Content (v1.0 DRAFT — NOT APPROVED FOR PRODUCTION)
 *
 * Mirrors the initial seeded records in database/migrations/033_create_legal_documents_and_acceptances.sql.
 * Live published document versions, effective dates, and content are loaded from /api/v1/legal/*.
 * Unapproved organizational and legal details remain clearly marked for clinic and privacy/legal review.
 */

export const FALLBACK_TERMS_OF_SERVICE = {
  document_type: 'TERMS_OF_SERVICE',
  version: '1.0',
  title: 'Terms of Service',
  status: 'PUBLISHED',
  is_approved: false,
  requires_reacceptance: false,
  effective_date: '2026-11-23',
  published_at: '2026-11-23 00:00:00',
  updated_at: '2026-11-23 00:00:00',
  change_summary: 'Initial v1.0 draft Terms of Service (pending clinic and legal approval before production publication).',
  content: {
    draft_notice:
      'DRAFT — NOT APPROVED FOR PRODUCTION. This document reflects verified ToothCare Hub software functionality and must be reviewed and approved by clinic management and legal counsel before public production deployment.',
    introduction:
      'These Terms of Service govern your access to and use of ToothCare Hub, a web-based dental appointment and clinic management platform operated by [PENDING CLINIC CONFIRMATION: Legal Clinic Name].',
    sections: [
      {
        id: 'introduction',
        heading: '1. Introduction',
        paragraphs: [
          'ToothCare Hub provides online dental service discovery, dentist schedule viewing, patient account registration, appointment request submission, appointment status tracking, and authorized clinical record access.',
          'Unconfirmed clinic-specific policies (including clinic operating rules, cancellation notice periods, and payment terms) are explicitly marked for clinic confirmation and do not constitute finalized commercial terms until approved.',
        ],
      },
      {
        id: 'acceptance-of-terms',
        heading: '2. Acceptance of Terms',
        paragraphs: [
          'By selecting the required agreement checkbox during patient account registration or when prompted for a material policy update, you agree to these Terms of Service and separately acknowledge that you have read our Privacy Policy.',
          'Viewing this page alone does not record acceptance. Your acceptance version and server-generated timestamp are recorded when you actively submit the registration or policy re-acceptance form.',
        ],
      },
      {
        id: 'purpose-and-scope',
        heading: '3. Purpose and Scope of ToothCare Hub',
        paragraphs: [
          'ToothCare Hub supports online patient registration, browsing available dental services and clinic dentists, requesting appointments based on available schedules, receiving appointment notifications, and viewing authorized patient records.',
          'ToothCare Hub does not provide emergency medical triage or automated medical diagnoses. For urgent dental emergencies, contact the clinic directly or seek immediate in-person care.',
        ],
      },
      {
        id: 'eligibility-and-registration',
        heading: '4. User Eligibility and Account Registration',
        paragraphs: [
          'To book appointments through the patient portal, you must register a patient account with accurate personal and contact information and verify your email address using the verification link sent to your registered email.',
          '[PENDING CLINIC CONFIRMATION: Minimum age requirement and parent/guardian registration rules for minor patients.]',
        ],
      },
      {
        id: 'account-responsibilities',
        heading: '5. User Account Responsibilities',
        paragraphs: [
          'You are responsible for maintaining the confidentiality of your password, providing accurate contact details, and keeping your profile and optional emergency contact or medical alert information up to date.',
          'You must not share your account credentials or impersonate another patient, dentist, or clinic staff member.',
        ],
      },
      {
        id: 'appointment-booking',
        heading: '6. Appointment Booking and Management',
        paragraphs: [
          'Through the patient portal, you may select a dental service, choose an available dentist, and submit an appointment request for an open schedule slot.',
          'Displayed service durations and estimated service fees are informational snapshots recorded when an appointment is requested. [PENDING CLINIC CONFIRMATION: Clinic fee, billing, and in-clinic payment policies.]',
        ],
      },
      {
        id: 'confirmation-and-cancellation',
        heading: '7. Appointment Confirmation and Cancellation',
        paragraphs: [
          'Submitted appointment requests begin in a PENDING state until reviewed and confirmed or rejected by authorized clinic reception or administrative staff based on clinic operations and schedule availability.',
          'You may request cancellation or rescheduling through the patient portal subject to clinic scheduling rules configured by the clinic. [PENDING CLINIC CONFIRMATION: Approved cancellation notice window, no-show rules, and rescheduling limits.]',
        ],
      },
      {
        id: 'acceptable-use',
        heading: '8. User Responsibilities and Acceptable Use',
        paragraphs: [
          'You agree not to attempt unauthorized access to other users’ accounts or clinical records, interfere with rate limits or security controls, submit false or automated bulk booking requests, or misuse platform APIs.',
        ],
      },
      {
        id: 'account-security',
        heading: '9. Account Security',
        paragraphs: [
          'ToothCare Hub uses password hashing, HttpOnly session cookies, CSRF protection on state-changing requests, email verification tokens, and role-based access controls to protect accounts.',
          'Notify the clinic immediately if you suspect unauthorized access to your account or email address.',
        ],
      },
      {
        id: 'availability-and-limitations',
        heading: '10. System Availability and Limitations',
        paragraphs: [
          'While the clinic strives to keep ToothCare Hub operational, temporary interruptions may occur during maintenance, updates, or network outages. Appointment scheduling remains available through direct clinic contact when online access is unavailable.',
        ],
      },
      {
        id: 'suspension-or-termination',
        heading: '11. Account Suspension or Termination',
        paragraphs: [
          'Authorized clinic administrators may deactivate an account if necessary to protect patient data, address security concerns, or resolve verified misuse. [PENDING CLINIC CONFIRMATION: Account suspension notice and appeal procedures.]',
        ],
      },
      {
        id: 'changes-to-terms',
        heading: '12. Changes to the Terms of Service',
        paragraphs: [
          'When the clinic updates these Terms of Service, a new version identifier and effective date are published without altering historical versions.',
          'If a material update requires renewed agreement under clinic policy, authenticated users will be presented with the updated version and asked to actively confirm acceptance.',
        ],
      },
      {
        id: 'contact-information',
        heading: '13. Contact Information',
        paragraphs: [
          'For questions regarding these Terms of Service or clinic appointment policies, contact [PENDING CLINIC CONFIRMATION: Official Clinic Name, Physical Address, Official Email, and Telephone Number].',
        ],
      },
      {
        id: 'effective-date-and-version',
        heading: '14. Effective Date and Document Version',
        paragraphs: [
          'Document Version: 1.0 | Effective Date: 2026-11-23 | Status: DRAFT — NOT APPROVED FOR PRODUCTION.',
        ],
      },
    ],
  },
};

export const FALLBACK_PRIVACY_POLICY = {
  document_type: 'PRIVACY_POLICY',
  version: '1.0',
  title: 'Privacy Policy',
  status: 'PUBLISHED',
  is_approved: false,
  requires_reacceptance: false,
  effective_date: '2026-11-23',
  published_at: '2026-11-23 00:00:00',
  updated_at: '2026-11-23 00:00:00',
  change_summary: 'Initial v1.0 draft Privacy Policy aligned with verified ToothCare Hub data flows (pending clinic and Philippine Data Privacy Act legal review).',
  content: {
    draft_notice:
      'DRAFT — NOT APPROVED FOR PRODUCTION. This Privacy Policy draft reflects the verified data flows of ToothCare Hub and must be reviewed by the clinic’s Data Protection Officer (DPO) and qualified Philippine privacy counsel against the Data Privacy Act of 2012 (Republic Act No. 10173) and National Privacy Commission (NPC) issuances before production use.',
    introduction:
      'This Privacy Policy explains how ToothCare Hub collects, uses, stores, protects, and manages personal information and sensitive personal information (including health-related information) when you use the platform. Personal Information Controller: [PENDING CLINIC CONFIRMATION: Registered Clinic Entity Name and Address].',
    sections: [
      {
        id: 'introduction',
        heading: '1. Introduction',
        paragraphs: [
          'ToothCare Hub is a dental appointment and clinic management platform. This document describes what information the application actually collects and stores in its database, why that information is processed, and how authorized personnel access it.',
        ],
      },
      {
        id: 'scope',
        heading: '2. Scope of the Privacy Policy',
        paragraphs: [
          'This policy applies to patients, dentists, receptionists, and clinic administrators who access public pages, register an account, book or manage dental appointments, or interact with notifications and clinical records through ToothCare Hub.',
        ],
      },
      {
        id: 'personal-information-collected',
        heading: '3. Personal Information Collected',
        paragraphs: [
          'Based on the verified ToothCare Hub database schema, the application collects and stores: (a) Account and identification details: first name, last name, email address, securely hashed password, account role, email verification status, and optional profile photo; (b) Contact and demographic details: phone number, date of birth, gender selection, optional complete address, and optional emergency contact name and phone number; (c) Appointment records: selected dental service, assigned dentist, scheduled date/time, duration and fee snapshot, appointment status history, attendance status, and cancellation reason where applicable; (d) Health-related information: optional medical history/allergies disclosure (medical alerts), optional chief complaint submitted when booking, and dentist-authored treatment records (teeth treated, diagnosis, procedure notes, prescription notes, and home care advice); (e) Security, audit, and legal acceptance records: authentication session cookie state, SHA-256 hashed verification/reset tokens, rate-limit counters, audit log entries, and legal document acceptance/acknowledgment records including document version, server timestamp, IP address, and browser user-agent string.',
        ],
      },
      {
        id: 'purposes-of-collection',
        heading: '4. Purposes of Data Collection',
        paragraphs: [
          'Information is collected strictly to: create and verify patient accounts, schedule and manage dental appointments, enable assigned dentists and authorized clinic staff to coordinate dental care, deliver transactional account and appointment notifications (in-app and email), maintain forensic security and audit logs, and record auditable evidence of Terms of Service acceptance and Privacy Policy acknowledgment.',
          'Marketing or promotional communications are NOT bundled into patient registration or required legal acceptance.',
        ],
      },
      {
        id: 'how-information-is-used',
        heading: '5. How Information Is Used',
        paragraphs: [
          'Personal information is processed for account authentication, appointment lifecycle workflows (PENDING, CONFIRMED, REJECTED, CANCELLED, COMPLETED), clinical documentation by assigned dentists, and system security monitoring.',
          'The specific legal basis for each processing activity under the Philippine Data Privacy Act of 2012 (RA 10173) — including lawful criteria for personal information (Section 12) and sensitive personal information such as health data (Section 13) — must be confirmed and inserted by the clinic’s DPO and legal counsel prior to production release. [PENDING LEGAL/PRIVACY REVIEW].',
        ],
      },
      {
        id: 'patient-and-appointment-info',
        heading: '6. Patient and Appointment Information',
        paragraphs: [
          'Patient profiles and appointment histories are scoped to the authenticated patient owner and authorized clinic staff (receptionists, assigned dentists, and administrators) according to server-enforced Dynamic Role-Based Access Control (DRBAC) and resource ownership checks.',
        ],
      },
      {
        id: 'health-related-information',
        heading: '7. Health-Related Personal Information',
        paragraphs: [
          'Medical alerts, chief complaints, and treatment records constitute sensitive personal information under Philippine privacy law. Access to clinical treatment records is restricted on the server to authorized clinical/administrative roles and the respective patient owner where permitted by clinic workflow.',
          'Providing optional medical alerts during registration is voluntary, though sharing relevant allergies or medical conditions helps the dental team plan safe care.',
        ],
      },
      {
        id: 'data-sharing-and-recipients',
        heading: '8. Data Sharing and Authorized Recipients',
        paragraphs: [
          'ToothCare Hub does not sell patient data. Within the clinic, data is accessible only to authorized personnel based on assigned DRBAC permissions (Administrators, Receptionists, and Dentists).',
          'External sharing occurs only when required by law, authorized by the patient, or necessary for configured clinic infrastructure (such as the clinic’s configured SMTP email provider for transactional verification, password reset, and appointment emails). [PENDING CLINIC CONFIRMATION: List of approved third-party recipients or processors.]',
        ],
      },
      {
        id: 'data-storage-and-security',
        heading: '9. Data Storage and Security',
        paragraphs: [
          'ToothCare Hub implements the following verified technical safeguards: password hashing via PHP password_hash(), SHA-256 hashing of single-use verification, reset, and WebSocket tickets, encryption of verification/reset tokens inside the transactional email outbox payload at rest prior to delivery and scrubbing after send, HttpOnly SameSite session cookies, synchronizer CSRF protection on state-changing requests, parameterized SQL queries via PDO, server-side DRBAC and ownership checks, rate limiting, and append-only audit logging with credential redaction.',
          'The platform does not claim full-database column encryption for general demographic or clinical text fields unless separately configured at the hosting/infrastructure level. [PENDING CLINIC CONFIRMATION: Hosting infrastructure and backup security controls.]',
        ],
      },
      {
        id: 'data-retention-and-disposal',
        heading: '10. Data Retention and Disposal',
        paragraphs: [
          'Account profiles, appointment histories, clinical treatment records, audit logs, and legal acceptance records are retained in the clinic database to support ongoing patient care, legal auditability, and statutory recordkeeping.',
          'ToothCare Hub does not automatically purge patient, clinical, audit, or legal acceptance records. [PENDING CLINIC CONFIRMATION: Clinic retention schedule and secure disposal procedure aligned with Philippine healthcare and NPC requirements.]',
        ],
      },
      {
        id: 'data-subject-rights',
        heading: '11. Data Subject Rights',
        paragraphs: [
          'Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), data subjects have rights that include the right to be informed, right to object, right to access, right to rectification, right to erasure or blocking (subject to applicable legal and clinical recordkeeping obligations), right to damages, right to data portability, and right to file a complaint with the National Privacy Commission (NPC).',
        ],
      },
      {
        id: 'privacy-requests-and-contact',
        heading: '12. Privacy Requests and Contact Procedures',
        paragraphs: [
          'Patients may update basic profile details directly through their authenticated Patient Profile page. For formal data access, correction, erasure, or privacy inquiries, submit a request to the clinic’s Data Protection Officer using the verified contact details below. [PENDING CLINIC CONFIRMATION: Verification workflow and response timeline for data subject requests.]',
        ],
      },
      {
        id: 'cookies-and-similar-technologies',
        heading: '13. Cookies and Similar Technologies',
        paragraphs: [
          'ToothCare Hub uses strictly necessary browser storage and cookies: (a) an HttpOnly session cookie (toothcare_session) to maintain authenticated login sessions; (b) browser localStorage/sessionStorage for Light/Dark theme preference, sidebar state, remembered login email (only if selected), and non-sensitive registration form draft recovery while reviewing legal documents.',
          'ToothCare Hub does not deploy third-party advertising trackers or behavioral analytics cookies.',
        ],
      },
      {
        id: 'third-party-services',
        heading: '14. Third-Party Services and Data Processors',
        paragraphs: [
          'When configured by the clinic, transactional emails (account verification, password recovery, and appointment updates) are delivered via the clinic’s configured SMTP mail server. [PENDING CLINIC CONFIRMATION: Named hosting provider, SMTP provider, and data processing agreements.]',
        ],
      },
      {
        id: 'policy-updates',
        heading: '15. Policy Updates',
        paragraphs: [
          'Material updates to this Privacy Policy are published as new numbered versions with an effective date while preserving prior versions for historical reference. When an update requires renewed acknowledgment under clinic policy, signed-in users are prompted to review and acknowledge the updated policy.',
        ],
      },
      {
        id: 'privacy-contact-information',
        heading: '16. Privacy Contact Information',
        paragraphs: [
          'Data Protection Officer (DPO): [PENDING CLINIC CONFIRMATION: Designated DPO Name, Official DPO Email, Clinic Telephone, and Clinic Physical Address].',
        ],
      },
      {
        id: 'effective-date-and-version',
        heading: '17. Effective Date and Document Version',
        paragraphs: [
          'Document Version: 1.0 | Effective Date: 2026-11-23 | Status: DRAFT — NOT APPROVED FOR PRODUCTION.',
        ],
      },
    ],
  },
};
