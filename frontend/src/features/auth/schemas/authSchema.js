/**
 * Client-Side Validation Rules and Helpers for Authentication
 * Mirrors Phase 7 backend AuthValidator rules.
 */

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (pwd) => (pwd || '').length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', test: (pwd) => /[A-Z]/.test(pwd || '') },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', test: (pwd) => /[a-z]/.test(pwd || '') },
  { id: 'number', label: 'One number (0-9)', test: (pwd) => /[0-9]/.test(pwd || '') },
  { id: 'symbol', label: 'One special symbol (!@#$%^&*)', test: (pwd) => /[^A-Za-z0-9]/.test(pwd || '') },
];

export function validatePassword(password) {
  const failedRules = PASSWORD_RULES.filter((rule) => !rule.test(password));
  return {
    isValid: failedRules.length === 0,
    failedRules,
    strengthScore: PASSWORD_RULES.length - failedRules.length, // 0 to 5
  };
}

export function sanitizeNameInput(value) {
  return String(value ?? '').replace(/\p{Nd}+/gu, '');
}

export function validateName(name, label = 'Name', { required = true, maxLength = 100 } = {}) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return required ? `${label} is required.` : null;
  }
  if (trimmed.length > maxLength) {
    return `${label} cannot exceed ${maxLength} characters.`;
  }
  if (/\p{Nd}/u.test(trimmed)) {
    return `${label} cannot contain numbers.`;
  }
  return null;
}

export function sanitizePhoneInput(value) {
  const cleaned = String(value ?? '').replace(/[^0-9+\s\-()]/g, '');
  const trimmedStart = cleaned.trimStart();
  const hasLeadingPlus = trimmedStart.startsWith('+');
  const withoutPlus = (hasLeadingPlus ? trimmedStart : cleaned).replace(/\+/g, '');
  return hasLeadingPlus ? `+${withoutPlus}` : withoutPlus;
}

export function validateEmail(email) {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return 'Email address is required.';
  }
  if (trimmed.length > 255) {
    return 'Email address cannot exceed 255 characters.';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function validatePhone(phone, { required = true, label = 'Phone number' } = {}) {
  const trimmed = (phone || '').trim();
  if (!trimmed) {
    return required ? `${label} is required.` : null;
  }
  const phoneRegex = /^[0-9+\s\-()]{7,30}$/;
  const digitCount = trimmed.replace(/\D/g, '').length;
  if (!phoneRegex.test(trimmed) || digitCount < 7 || digitCount > 15) {
    return 'Please enter a valid phone number (e.g. +63 917 123 4567).';
  }
  return null;
}

export function validateDateOfBirth(dob) {
  const trimmed = (dob || '').trim();
  if (!trimmed) {
    return 'Date of birth is required.';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return 'Please enter a valid date in YYYY-MM-DD format.';
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dateObj = new Date(year, month - 1, day);
  if (
    isNaN(dateObj.getTime()) ||
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return 'Please enter a valid date in YYYY-MM-DD format.';
  }
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (dateObj > todayLocal) {
    return 'Date of birth cannot be in the future.';
  }
  const age = todayLocal.getFullYear() - year;
  if (age > 125) {
    return 'Please enter a realistic date of birth.';
  }
  return null;
}
