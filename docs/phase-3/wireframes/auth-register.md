# ToothCare Hub Wireframe: Patient Registration

**Document ID:** `TCH-P3-WFR-002`  
**Screen ID:** `SCR-AUTH-002`  
**Route:** `/register`  
**Authorized Roles:** Public / Unauthenticated (`ANONYMOUS`)  

---

## 1. Screen Specification

### 1.1 Purpose
Allows prospective dental patients to register for a ToothCare Hub account. Collects verified identity, contact information, date of birth, and password. Establishes the `users` and `patients` database records and prepares the user for immediate appointment booking.

### 1.2 Layout & Hierarchy
- **Desktop:** Two-column card container (max-width `780px`) with clinic value proposition on the left (or top header) and clean multi-field form on the right.
- **Mobile:** Single-column stacked form with grouped fieldsets (Personal Details, Account Security, Agreements).

---

## 2. Desktop Wireframe

```
+-------------------------------------------------------------------------------+
|  ToothCare Hub - Dental Care & Clinic Operations Management                   |
+-------------------------------------------------------------------------------+
|                                                                               |
|            +----------------------------------------------------+             |
|            |  Create Your ToothCare Hub Patient Account         |             |
|            |  Already registered? [Log in to your account]      |             |
|            +----------------------------------------------------+             |
|            |                                                    |             |
|            |  Personal Information                              |             |
|            |  First Name *                Last Name *           |             |
|            |  [ Juan                    ] [ Dela Cruz         ] |             |
|            |                                                    |             |
|            |  Email Address *             Mobile Phone *        |             |
|            |  [ juan.delacruz@email.ph  ] [ +63 917 123 4567  ] |             |
|            |                                                    |             |
|            |  Date of Birth *             Gender (Optional)     |             |
|            |  [ 1994-05-18            📅] [ Male              v ] |             |
|            |                                                    |             |
|            |  ------------------------------------------------  |             |
|            |  Account Security                                  |             |
|            |  Password *                  Confirm Password *    |             |
|            |  [ ••••••••••••••••      👁 ] [ •••••••••••••••• 👁 ] |             |
|            |                                                    |             |
|            |  Password Strength: [====    ] Medium              |             |
|            |  • At least 8 characters                           |             |
|            |  • 1 uppercase, 1 number, 1 special character      |             |
|            |                                                    |             |
|            |  ------------------------------------------------  |             |
|            |  [x] I agree to the [Terms of Service] and         |             |
|            |      [Clinic Privacy Policy / Data Privacy Act].   |             |
|            |                                                    |             |
|            |  +----------------------------------------------+  |             |
|            |  |      [ Create Patient Account ]              |  |             |
|            |  +----------------------------------------------+  |             |
|            +----------------------------------------------------+             |
|                                                                               |
+-------------------------------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [Back] ToothCare Hub       Log In |
+-----------------------------------+
|                                   |
| Create Account                    |
| Step into seamless dental care    |
|                                   |
| First Name *                      |
| [ Juan                          ] |
|                                   |
| Last Name *                       |
| [ Dela Cruz                     ] |
|                                   |
| Email Address *                   |
| [ juan.delacruz@email.ph        ] |
|                                   |
| Mobile Number * (PH format)       |
| [ +63 917 123 4567              ] |
|                                   |
| Date of Birth *                   |
| [ 1994-05-18                   📅]|
|                                   |
| Password *                        |
| [ ••••••••••••••••••          👁 ]|
| Strength: [===  ] Fair            |
|                                   |
| Confirm Password *                |
| [ ••••••••••••••••••          👁 ]|
|                                   |
| [x] I agree to [Terms & Privacy]  |
|                                   |
| +-------------------------------+ |
| |   [ Create Account ]          | | (Min 48px touch target)
| +-------------------------------+ |
|                                   |
| Already a patient? [Log in here]  |
+-----------------------------------+
```

---

## 4. UI Elements & Form Requirements

| Field / Element | Type | Validation Rules | Error Message Display |
| :--- | :--- | :--- | :--- |
| **First Name** | Text (`type="text"`) | Required; 2-50 chars; alpha + spaces/hyphens | *"First name is required (min 2 letters)."* |
| **Last Name** | Text (`type="text"`) | Required; 2-50 chars; alpha + spaces/hyphens | *"Last name is required (min 2 letters)."* |
| **Email Address** | Text / Email (`type="email"`) | Required; Valid RFC 5322 format | *"Please enter a valid email address."* |
| **Mobile Number** | Text / Tel (`type="tel"`) | Required; PH format: `^(09|\+639)\d{9}$` | *"Enter a valid 11-digit mobile number."* |
| **Date of Birth** | Date (`type="date"`) | Required; Must be past date; Age $\ge 18$ for self-booking | *"Valid birthdate required (must be 18+)."* |
| **Password** | Text / Password (`type="password"`) | Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special | *"Password must satisfy all security rules."* |
| **Confirm Password** | Text / Password (`type="password"`) | Required; Must match password exactly | *"Passwords do not match."* |
| **Terms Checkbox** | Checkbox (`type="checkbox"`) | Required (`true`) | *"You must accept the terms to register."* |

---

## 5. Screen States

### 5.1 Default State
All inputs empty, terms unchecked, submit button disabled until mandatory fields pass basic schema validation.

### 5.2 Loading State
- Submit button shows spinner with label: *"Registering patient account..."*.
- Inputs locked (`disabled="true"`).

### 5.3 Duplicate Account Error
- HTTP `409 Conflict` received from backend.
- Prominent banner above form:  
  `[!] An account with email juan.delacruz@email.ph already exists. [Log in instead]`

### 5.4 Success State
- Transitions smoothly to confirmation view or navigates to `/login?registered=true`.
- Displays top green banner: *"Account successfully registered! Please log in with your credentials to book your first visit."*

---

## 6. Accessibility (WCAG 2.2 AA)
- Grouped fieldsets with `<fieldset>` and `<legend>` for Personal Information and Account Credentials.
- Dynamic password meter announces level via `aria-live="polite"` (`"Password strength: medium"`).
- Date picker supports full keyboard entry (`YYYY-MM-DD`) and native mobile picker controls.
