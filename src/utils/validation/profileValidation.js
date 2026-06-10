// ─── Helpers ────────────────────────────────────────────────────────────────

/** Coerce any input to a trimmed string; returns '' for null/undefined. */
const str = v => (v == null ? '' : String(v).trim());

/**
 * Strip characters that could be used for XSS / HTML injection.
 * Removes <, >, ", ', `, and & so they never reach the DB or template layer.
 */
const containsInjection = v => /[<>"'`&]/.test(v);

/**
 * Unicode-aware "letters + common name punctuation" check.
 * Accepts:
 *   • Latin base + accented (a–z, à–ÿ, etc.)
 *   • Devanagari (Hindi / Rajasthani names)
 *   • Arabic, Cyrillic, CJK blocks
 *   • Internal hyphens and apostrophes (O'Brien, Jean-Luc)
 *   • Single spaces between words
 * Rejects digits, symbols, and injection characters.
 */
const UNICODE_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;

/** RFC-5321 / RFC-5322 inspired email – stricter than a simple regex. */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/** E.164-style phone: optional leading +, 7–15 digits (spaces/dashes allowed). */
const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

/** Allowed gender values – use a Set for O(1) lookup. */
const VALID_GENDERS = new Set(['Male', 'Female', 'Other', 'Prefer not to say']);

// ─── Field Validators ────────────────────────────────────────────────────────
// Each validator returns a string (error message) or null (valid).

const VALIDATORS = {
  firstName: v => {
    const s = str(v);
    if (!s) return 'First name is required';
    if (containsInjection(s)) return 'First name contains invalid characters';
    if (s.length < 2) return 'Minimum 2 characters required';
    if (s.length > 50) return 'Maximum 50 characters allowed';
    if (!UNICODE_NAME_RE.test(s))
      return 'Only letters, hyphens, and apostrophes allowed';
    return null;
  },

  lastName: v => {
    const s = str(v);
    if (!s) return 'Last name is required';
    if (containsInjection(s)) return 'Last name contains invalid characters';
    if (s.length < 2) return 'Minimum 2 characters required';
    if (s.length > 50) return 'Maximum 50 characters allowed';
    if (!UNICODE_NAME_RE.test(s))
      return 'Only letters, hyphens, and apostrophes allowed';
    return null;
  },

  shopName: v => {
    const s = str(v);
    if (!s) return null; // optional
    if (containsInjection(s)) return 'Shop name contains invalid characters';
    if (s.length < 2) return 'Minimum 2 characters required';
    if (s.length > 100) return 'Maximum 100 characters allowed';
    return null;
  },

  emailId: v => {
    const s = str(v);
    if (!s) return null; // optional
    if (s.length > 254) return 'Email address is too long'; // RFC 5321 max
    if (containsInjection(s)) return 'Email contains invalid characters';
    if (!EMAIL_RE.test(s)) return 'Enter a valid email address';
    return null;
  },

  phoneNumber: v => {
    const s = str(v);
    if (!s) return null; // optional
    if (containsInjection(s)) return 'Phone number contains invalid characters';
    // Strip formatting before length check
    const digits = s.replace(/\D/g, '');
    if (digits.length < 7) return 'Phone number is too short';
    if (digits.length > 15) return 'Phone number is too long';
    if (!PHONE_RE.test(s)) return 'Enter a valid phone number';
    return null;
  },

  gender: v => {
    // null / undefined → user hasn't selected → optional
    if (v == null || str(v) === '') return null;
    const normalized = String(v).charAt(0).toUpperCase() + String(v).slice(1).toLowerCase();
    if (!VALID_GENDERS.has(normalized)) return 'Select a valid gender option';
    return null;
  },

  dateOfBirth: v => {
    if (v == null || str(v) === '') return null; // optional
    const date = new Date(v);
    if (isNaN(date.getTime())) return 'Enter a valid date of birth';
    const now = new Date();
    const age = (now - date) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 0) return 'Date of birth cannot be in the future';
    if (age < 5) return 'Age must be at least 5 years';
    if (age > 130) return 'Enter a realistic date of birth';
    return null;
  },

  village: v => {
    const s = str(v);
    if (!s) return null;
    if (containsInjection(s)) return 'Village name contains invalid characters';
    if (s.length > 100) return 'Maximum 100 characters allowed';
    return null;
  },

  district: v => {
    const s = str(v);
    if (!s) return null;
    if (containsInjection(s))
      return 'District name contains invalid characters';
    if (s.length > 100) return 'Maximum 100 characters allowed';
    return null;
  },

  state: v => {
    const s = str(v);
    if (!s) return null;
    if (containsInjection(s)) return 'State name contains invalid characters';
    if (s.length > 100) return 'Maximum 100 characters allowed';
    return null;
  },

  pinCode: v => {
    const s = str(v);
    if (!s) return null; // optional
    if (!/^\d{6}$/.test(s)) return 'Enter a valid 6-digit PIN code';
    if (s === '000000') return 'Enter a valid PIN code';
    return null;
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate every field in `form`.
 *
 * @param   {Record<string, unknown>} form
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export const validateProfileForm = form => {
  if (!form || typeof form !== 'object') {
    throw new TypeError('validateProfileForm expects a plain object');
  }

  const errors = {};

  for (const field of Object.keys(VALIDATORS)) {
    const error = VALIDATORS[field](form[field]);
    if (error) errors[field] = error;
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

/**
 * Validate a single field (for real-time / on-change feedback).
 *
 * @param   {string}  field - Key matching one of the VALIDATORS
 * @param   {unknown} value
 * @returns {string | null} Error message or null
 */
export const validateProfileField = (field, value) => {
  if (typeof field !== 'string' || !field) return null;
  return VALIDATORS[field]?.(value) ?? null;
};

/**
 * Returns true when the form has no validation errors.
 * Convenience wrapper for disabling a submit button.
 *
 * @param   {Record<string, unknown>} form
 * @returns {boolean}
 */
export const isProfileFormValid = form => validateProfileForm(form).isValid;
