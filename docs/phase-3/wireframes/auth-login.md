# ToothCare Hub Wireframe: User Login & Authentication

**Document ID:** `TCH-P3-WFR-001`  
**Screen ID:** `SCR-AUTH-001`  
**Route:** `/login`  
**Authorized Roles:** Public / Unauthenticated (`ANONYMOUS`)  

---

## 1. Screen Specification

### 1.1 Purpose
Provides a secure, accessible, single sign-on entry point for all system actors (Patient, Dentist, and Administrator). Validates user credentials, sets an HttpOnly JWT authentication cookie, establishes a real-time WebSocket connection, and routes the user to their designated role dashboard.

### 1.2 Layout & Hierarchy
- **Desktop:** Centered card container (max-width `440px`) situated against a neutral canvas (`#F5F8FA`) with branded clinic header and subtle elevation shadow.
- **Mobile:** Full-bleed card container filling 100% viewport width with 16px lateral padding and sticky header.

---

## 2. Desktop Wireframe

```
+-----------------------------------------------------------------------+
|  ToothCare Hub - Dental Care & Clinic Operations Management           |
+-----------------------------------------------------------------------+
|                                                                       |
|                     +-------------------------------+                 |
|                     |       [ToothCare Hub Logo]    |                 |
|                     |        TOOTHCARE HUB          |                 |
|                     |     Welcome back to clinic    |                 |
|                     +-------------------------------+                 |
|                     |                               |                 |
|                     |  Email Address *              |                 |
|                     |  [ patient@example.com      ] |                 |
|                     |                               |                 |
|                     |  Password *                   |                 |
|                     |  [ ••••••••••••••••       👁 ] |                 |
|                     |                               |                 |
|                     |  [ ] Remember my email        |                 |
|                     |      [Forgot password?]       |                 |
|                     |                               |                 |
|                     |  +-------------------------+  |                 |
|                     |  |      [ Log In ]         |  |                 |
|                     |  +-------------------------+  |                 |
|                     |                               |                 |
|                     |  ---------------------------  |                 |
|                     |  Don't have an account yet?   |                 |
|                     |  [ Register as a Patient ]    |                 |
|                     |                               |                 |
|                     |  Need help? Contact reception |                 |
|                     |  (02) 8123-4567 • Manila, PH  |                 |
|                     +-------------------------------+                 |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [Logo] ToothCare Hub       Help ? |
+-----------------------------------+
|                                   |
| Welcome Back                      |
| Sign in to manage appointments    |
|                                   |
| Email Address *                   |
| [ patient@example.com           ] |
|                                   |
| Password *                        |
| [ ••••••••••••••••           👁 ] |
|                                   |
| [ ] Remember me                   |
| [Forgot password?]                |
|                                   |
| +-------------------------------+ |
| |        [ Log In ]             | | (Min 48px touch height)
| +-------------------------------+ |
|                                   |
| --------------------------------- |
| New patient?                      |
| +-------------------------------+ |
| | [ Create Patient Account ]    | | (Secondary Teal button)
| +-------------------------------+ |
|                                   |
| Clinic Reception: (02) 8123-4567  |
+-----------------------------------+
```

---

## 4. UI Elements & Form Requirements

| Field / Element | Type | Validation Rules | Error Message Display |
| :--- | :--- | :--- | :--- |
| **Email Address** | Text / Email (`type="email"`) | Required; Valid email regex; lowercase normalized | *"Please enter a valid email address."* |
| **Password** | Text / Password (`type="password"`) | Required; Min 8 chars | *"Password must be at least 8 characters."* |
| **Password Toggle** | Button (`aria-label="Toggle password visibility"`) | Toggles `type="text"` and `type="password"` | N/A |
| **Remember Me** | Checkbox (`type="checkbox"`) | Optional (stores email in localStorage; never tokens) | N/A |
| **Submit Button** | Button (`type="submit"`) | Disabled while submitting; displays spinner | N/A |

---

## 5. Screen States

### 5.1 Default State
Clean inputs with visible labels and subtle gray borders (`#CBD5E1`). Focus triggers 2px Teal ring (`#0D9488`).

### 5.2 Loading State
- Input fields set to `disabled`.
- Submit button shows animated spinner with text: *"Signing in..."*.
- Screen remains responsive to prevent double clicks.

### 5.3 Validation Error State
- Red border on offending field (`#EF4444`).
- Error container below field with icon `[!]` and message in red (`#B91C1C`).
- Field has `aria-invalid="true"` and `aria-describedby="email-error"`.

### 5.4 Backend Authentication Error
- Top banner alert with red background and border:
  `[!] Invalid email or password. Please verify your credentials or contact clinic reception.`
- Role: `role="alert"`.

### 5.5 Post-Login Routing Logic
- If role == `ADMIN` $\rightarrow$ Redirect to `/admin/dashboard`
- If role == `DENTIST` $\rightarrow$ Redirect to `/dentist/dashboard`
- If role == `PATIENT` $\rightarrow$ Redirect to `/patient/dashboard` (or `redirect_url` param if deep linked)

---

## 6. Accessibility (WCAG 2.2 AA)
- Form inputs have explicit `<label for="...">` associations.
- Password reveal toggle has explicit accessible name: `"Show password"` / `"Hide password"`.
- Tab order flows logically: Email $\rightarrow$ Password $\rightarrow$ Show Toggle $\rightarrow$ Remember Me $\rightarrow$ Forgot Password $\rightarrow$ Submit $\rightarrow$ Register Link.
- Contrast ratio between `#12304A` text and `#FFFFFF` background is 13.8:1 (exceeds 4.5:1 requirement).
