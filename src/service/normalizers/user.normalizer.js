/**
 * User Normalizer
 *
 * WHY THIS EXISTS:
 *   authSlice had `shopname → shopName` and `email → emailId` fixes repeated
 *   4 separate times (checkStoredToken, verifyOtp, getUserDetails, updateProfile).
 *   This normalizer consolidates all user field mapping into one place.
 *   authSlice thunks now call normalizeUser() once and store clean data.
 *
 * USED BY:
 *   - authSlice (all thunks that set state.user)
 *   - Redux state.auth.user is always a normalized user after this
 *
 * BACKEND CONTRACT (as of June 2025):
 *   id       → _id
 *   email    → emailId (backend inconsistently sends both)
 *   shopName → shopname (backend lowercase, UI expects camelCase)
 *   role     → role ('FPO' | 'Trader' | 'Miller' | 'Corporate')
 *
 * REDUX BENEFIT:
 *   Backend user object has 30+ keys. Redux stores only the 14 we actually
 *   use in the UI. Memory stays lean, re-renders stay predictable.
 */

const VALID_ROLES = ['FPO', 'Trader', 'Miller', 'Corporate'];

// ─── Mock Tests ───────────────────────────────────────────────────────────────

/**
 * Verify normalizer handles all known backend user shapes.
 * Call normalizeUser.runTests() in Metro console during development.
 */
function runTests() {
  const testCases = [
    {
      label: 'Standard user object',
      input: {
        _id: 'user1',
        firstName: 'Ramesh',
        lastName: 'Patel',
        phone: '9876543210',
        role: 'FPO',
        shopName: 'Patel Agro',
        emailId: 'ramesh@example.com',
        state: 'Gujarat',
        isVerified: true,
        kycStatus: 'verified',
      },
      expect: {
        id: 'user1',
        firstName: 'Ramesh',
        lastName: 'Patel',
        phone: '9876543210',
        role: 'FPO',
        shopName: 'Patel Agro',
        emailId: 'ramesh@example.com',
        isVerified: true,
      },
    },
    {
      label: 'shopname (lowercase) remapped to shopName',
      input: {
        _id: 'user2',
        firstName: 'Suresh',
        phone: '9000000001',
        role: 'Trader',
        shopname: 'Suresh Traders', // backend sends lowercase
      },
      expect: {
        id: 'user2',
        shopName: 'Suresh Traders',
      },
    },
    {
      label: 'email remapped to emailId',
      input: {
        _id: 'user3',
        firstName: 'Mohan',
        phone: '9000000002',
        role: 'Miller',
        email: 'mohan@example.com', // backend sends 'email'
      },
      expect: {
        id: 'user3',
        emailId: 'mohan@example.com',
      },
    },
    {
      label: 'Both email and emailId present — emailId wins',
      input: {
        _id: 'user4',
        phone: '9000000003',
        email: 'old@example.com',
        emailId: 'new@example.com',
      },
      expect: {
        id: 'user4',
        emailId: 'new@example.com', // emailId takes priority
      },
    },
    {
      label: 'Invalid role defaults to FPO',
      input: {
        _id: 'user5',
        phone: '9000000004',
        role: 'SuperAdmin', // not a valid app role
      },
      expect: { id: 'user5', role: 'FPO' },
    },
    {
      label: 'id field instead of _id',
      input: {
        id: 'user6',
        phone: '9000000005',
        role: 'Corporate',
      },
      expect: { id: 'user6', role: 'Corporate' },
    },
    {
      label: 'Null input → returns null',
      input: null,
      expect: null,
    },
    {
      label: '30 extra backend keys stripped from Redux state',
      input: {
        _id: 'strip3',
        phone: '9000000006',
        role: 'FPO',
        // Extra keys UI never uses:
        __v: 0, fcmToken: 'abc', deviceId: 'dev1', loginHistory: [],
        internalScore: 99, adminFlag: false, bulkActionLog: [],
        passwordHash: 'HASH', saltRounds: 10, refreshTokens: [],
      },
      expect: { id: 'strip3', role: 'FPO' },
      assertNoKeys: ['__v', 'fcmToken', 'deviceId', 'loginHistory', 'passwordHash', 'saltRounds'],
    },
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const tc of testCases) {
    const result = normalizeUser(tc.input);
    let ok = true;
    const errors = [];

    if (tc.expect === null) {
      ok = result === null;
      if (!ok) errors.push(`Expected null but got: ${JSON.stringify(result)}`);
    } else {
      for (const [key, expectedVal] of Object.entries(tc.expect)) {
        if (result?.[key] !== expectedVal) {
          ok = false;
          errors.push(`${key}: expected "${expectedVal}" got "${result?.[key]}"`);
        }
      }
    }

    if (tc.assertNoKeys && result) {
      for (const key of tc.assertNoKeys) {
        if (key in result) {
          ok = false;
          errors.push(`Key "${key}" should be stripped but was present`);
        }
      }
    }

    if (ok) passed++;
    else failed++;
    results.push({ label: tc.label, ok, errors });
  }

  if (__DEV__) {
    console.log(`\n🧪 [user.normalizer] Tests: ${passed} passed, ${failed} failed`);
    results.forEach(r => {
      if (r.ok) console.log(`  ✅ ${r.label}`);
      else {
        console.log(`  ❌ ${r.label}`);
        r.errors.forEach(e => console.log(`     → ${e}`));
      }
    });
  }

  return { passed, failed, results };
}

// ─── Core Normalizer ──────────────────────────────────────────────────────────

/**
 * Normalize a raw backend user object into a clean, trimmed UI-ready shape.
 * This is what gets stored in Redux state.auth.user — only the 14 fields
 * the app actually uses.
 *
 * @param {Object|null} raw - Raw backend user object
 * @returns {Object|null} Clean user object, or null if invalid
 */
export function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw._id || raw.id;
  // phone is minimum required to identify + re-login user
  if (!id && !raw.phone) return null;

  // Email — backend sends both 'email' and 'emailId'; prefer emailId
  const emailId = raw.emailId || raw.email || '';

  // Shop name — backend sends 'shopname' (lowercase) and 'shopName' (camelCase)
  const shopName = raw.shopName || raw.shopname || '';

  // Role — validate against known app roles
  const role = VALID_ROLES.includes(raw.role) ? raw.role : 'FPO';

  // Return ONLY the 14 fields the UI uses.
  // Everything else (fcmToken, loginHistory, passwordHash, etc.) is dropped.
  return {
    id:          id ? String(id) : null,
    firstName:   raw.firstName   || '',
    lastName:    raw.lastName    || '',
    phone:       raw.phone       || raw.mobile || raw.phoneNumber || '',
    role,
    shopName,
    emailId,
    gender:      raw.gender      || '',
    village:     raw.village     || '',
    district:    raw.district    || '',
    state:       raw.state       || '',
    isVerified:  raw.isVerified  ?? false,
    kycStatus:   raw.kycStatus   || 'pending',
    rating:      typeof raw.rating === 'number' ? raw.rating : null,
  };
}

/**
 * Merge a normalized user with local profile data (from AsyncStorage).
 * Used in authSlice when backend doesn't return all fields (e.g. first login).
 *
 * @param {Object|null} backendUser - Already normalized user from backend
 * @param {Object|null} localProfile - Locally stored profile (may have richer data)
 * @returns {Object|null} Merged normalized user
 */
export function mergeWithLocalProfile(backendUser, localProfile) {
  if (!backendUser && !localProfile) return null;
  if (!backendUser) return normalizeUser(localProfile);
  if (!localProfile) return backendUser;

  // Prefer backend values; use local profile to fill in missing fields
  const merged = { ...localProfile, ...backendUser };
  // Re-normalize to ensure clean shape (drops any local extra keys too)
  return normalizeUser(merged);
}

// Attach test runner for dev-time validation
normalizeUser.runTests = runTests;
