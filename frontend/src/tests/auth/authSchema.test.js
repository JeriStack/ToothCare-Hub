import { describe, it, expect } from 'vitest';
import {
  sanitizeNameInput,
  validateName,
  validateEmail,
  validatePassword,
  validatePhone,
  validateDateOfBirth,
  PASSWORD_RULES,
} from '../../features/auth/schemas/authSchema';

describe('authSchema Validation Rules', () => {
  describe('sanitizeNameInput & validateName', () => {
    it('strips ASCII and Unicode digits from name input while preserving valid characters', () => {
      expect(sanitizeNameInput('Maria123')).toBe('Maria');
      expect(sanitizeNameInput('456Santos789')).toBe('Santos');
      expect(sanitizeNameInput("De la Cruz-O'Brien Jr.")).toBe("De la Cruz-O'Brien Jr.");
      expect(sanitizeNameInput('José Niño 2026')).toBe('José Niño ');
      expect(sanitizeNameInput('Maria٣٤')).toBe('Maria');
    });

    it('returns error when name is empty or whitespace', () => {
      expect(validateName('', 'First name')).toBe('First name is required.');
      expect(validateName('   ', 'Last name')).toBe('Last name is required.');
      expect(validateName(null, 'First name')).toBe('First name is required.');
    });

    it('rejects names containing numbers', () => {
      expect(validateName('Maria1', 'First name')).toBe('First name cannot contain numbers.');
      expect(validateName('S4ntos', 'Last name')).toBe('Last name cannot contain numbers.');
      expect(validateName('12345', 'First name')).toBe('First name cannot contain numbers.');
    });

    it('rejects names exceeding 100 characters', () => {
      expect(validateName('A'.repeat(101), 'First name')).toBe('First name cannot exceed 100 characters.');
    });

    it('accepts valid international and punctuated names', () => {
      expect(validateName('Maria Clara', 'First name')).toBeNull();
      expect(validateName('De la Cruz', 'Last name')).toBeNull();
      expect(validateName("O'Brien-Santos", 'Last name')).toBeNull();
      expect(validateName('José Niño', 'First name')).toBeNull();
      expect(validateName('Santos Jr.', 'Last name')).toBeNull();
    });
  });

  describe('validateEmail', () => {
    it('returns error when email is empty or whitespace', () => {
      expect(validateEmail('')).toBe('Email address is required.');
      expect(validateEmail('   ')).toBe('Email address is required.');
      expect(validateEmail(null)).toBe('Email address is required.');
      expect(validateEmail(undefined)).toBe('Email address is required.');
    });

    it('returns error when email format is invalid', () => {
      expect(validateEmail('plainaddress')).toBe('Please enter a valid email address.');
      expect(validateEmail('missingatsign.com')).toBe('Please enter a valid email address.');
      expect(validateEmail('missing@domain')).toBe('Please enter a valid email address.');
      expect(validateEmail('@missingusername.com')).toBe('Please enter a valid email address.');
      expect(validateEmail('user@domain with space.com')).toBe('Please enter a valid email address.');
    });

    it('returns null for valid email addresses and trims whitespace', () => {
      expect(validateEmail('patient.juan@example.com')).toBeNull();
      expect(validateEmail('  dr.santos@toothcare.local  ')).toBeNull();
      expect(validateEmail('user+tag@domain.co.uk')).toBeNull();
      expect(validateEmail('admin_123@sub.clinic.org')).toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('identifies password meeting all 5 security rules', () => {
      const result = validatePassword('Password123!');
      expect(result.isValid).toBe(true);
      expect(result.failedRules).toHaveLength(0);
      expect(result.strengthScore).toBe(5);
    });

    it('flags failed rule when length is less than 8 characters', () => {
      const result = validatePassword('Pass1!');
      expect(result.isValid).toBe(false);
      expect(result.failedRules.some((r) => r.id === 'length')).toBe(true);
      expect(result.strengthScore).toBe(4);
    });

    it('flags failed rule when uppercase letter is missing', () => {
      const result = validatePassword('password123!');
      expect(result.isValid).toBe(false);
      expect(result.failedRules.some((r) => r.id === 'uppercase')).toBe(true);
    });

    it('flags failed rule when lowercase letter is missing', () => {
      const result = validatePassword('PASSWORD123!');
      expect(result.isValid).toBe(false);
      expect(result.failedRules.some((r) => r.id === 'lowercase')).toBe(true);
    });

    it('flags failed rule when digit is missing', () => {
      const result = validatePassword('Password!@#');
      expect(result.isValid).toBe(false);
      expect(result.failedRules.some((r) => r.id === 'number')).toBe(true);
    });

    it('flags failed rule when special character is missing', () => {
      const result = validatePassword('Password123');
      expect(result.isValid).toBe(false);
      expect(result.failedRules.some((r) => r.id === 'symbol')).toBe(true);
    });

    it('handles null, undefined, or empty password safely', () => {
      const emptyResult = validatePassword('');
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.strengthScore).toBe(0);

      const nullResult = validatePassword(null);
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.strengthScore).toBe(0);
    });

    it('exposes exactly 5 defined password criteria', () => {
      expect(PASSWORD_RULES).toHaveLength(5);
      const ruleIds = PASSWORD_RULES.map((r) => r.id);
      expect(ruleIds).toEqual(['length', 'uppercase', 'lowercase', 'number', 'symbol']);
    });
  });

  describe('validatePhone', () => {
    it('returns error when phone number is empty', () => {
      expect(validatePhone('')).toBe('Phone number is required.');
      expect(validatePhone('   ')).toBe('Phone number is required.');
      expect(validatePhone(null)).toBe('Phone number is required.');
    });

    it('returns error for invalid characters or insufficient length', () => {
      expect(validatePhone('123')).toBe('Please enter a valid phone number (e.g. +63 917 123 4567).');
      expect(validatePhone('phone-number-here')).toBe('Please enter a valid phone number (e.g. +63 917 123 4567).');
    });

    it('accepts standard Philippine and international phone formats', () => {
      expect(validatePhone('+63 917 123 4567')).toBeNull();
      expect(validatePhone('0918-555-4321')).toBeNull();
      expect(validatePhone('+639205559876')).toBeNull();
      expect(validatePhone('(02) 8123-4567')).toBeNull();
    });
  });

  describe('validateDateOfBirth', () => {
    it('returns error when date of birth is empty', () => {
      expect(validateDateOfBirth('')).toBe('Date of birth is required.');
      expect(validateDateOfBirth(null)).toBe('Date of birth is required.');
    });

    it('returns error for invalid date strings', () => {
      expect(validateDateOfBirth('not-a-date')).toBe('Please enter a valid date in YYYY-MM-DD format.');
      expect(validateDateOfBirth('2025-13-45')).toBe('Please enter a valid date in YYYY-MM-DD format.');
    });

    it('rejects future dates of birth', () => {
      const futureDate = '2099-01-01';
      expect(validateDateOfBirth(futureDate)).toBe('Date of birth cannot be in the future.');
    });

    it('rejects dates older than 125 years', () => {
      expect(validateDateOfBirth('1850-01-01')).toBe('Please enter a realistic date of birth.');
    });

    it('accepts valid birth dates', () => {
      expect(validateDateOfBirth('1994-05-18')).toBeNull();
      expect(validateDateOfBirth('2000-12-31')).toBeNull();
      expect(validateDateOfBirth('1985-06-15')).toBeNull();
    });
  });
});
