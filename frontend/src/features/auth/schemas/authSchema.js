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

export function validateEmail(email) {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return 'Email address is required.';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function validatePhone(phone) {
  const trimmed = (phone || '').trim();
  if (!trimmed) {
    return 'Phone number is required.';
  }
  const phoneRegex = /^[0-9+\s\-()]{7,30}$/;
  if (!phoneRegex.test(trimmed)) {
    return 'Please enter a valid phone number (e.g. +63 917 123 4567).';
  }
  return null;
}

export function validateDateOfBirth(dob) {
  const trimmed = (dob || '').trim();
  if (!trimmed) {
    return 'Date of birth is required.';
  }
  const dateObj = new Date(trimmed);
  if (isNaN(dateObj.getTime())) {
    return 'Please enter a valid date in YYYY-MM-DD format.';
  }
  const today = new Date();
  if (dateObj > today) {
    return 'Date of birth cannot be in the future.';
  }
  const age = today.getFullYear() - dateObj.getFullYear();
  if (age > 125) {
    return 'Please enter a realistic date of birth.';
  }
  return null;
}
