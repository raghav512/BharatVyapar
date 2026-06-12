// Storage layer: AsyncStorage based auth session persistence helpers.
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_SESSION_KEY = '@bharatFpoVyapar/auth_session';
const LOCAL_PROFILES_KEY = '@bharatFpoVyapar/local_profiles';

export const saveLocalProfile = async (phone, profileData) => {
  if (!phone) return;
  try {
    const raw = await AsyncStorage.getItem(LOCAL_PROFILES_KEY);
    const profiles = raw ? JSON.parse(raw) : {};
    profiles[phone] = { ...(profiles[phone] || {}), ...profileData };
    await AsyncStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.warn('Failed to save local profile', err);
  }
};

export const getLocalProfile = async (phone) => {
  if (!phone) return {};
  try {
    const raw = await AsyncStorage.getItem(LOCAL_PROFILES_KEY);
    const profiles = raw ? JSON.parse(raw) : {};
    return profiles[phone] || {};
  } catch (err) {
    console.warn('Failed to get local profile', err);
    return {};
  }
};

const parseSession = rawSession => {
  if (!rawSession) {
    return { token: null, user: null, refreshToken: null, selectedRole: null, roleColor: null };
  }

  try {
    const parsed = JSON.parse(rawSession);
    return {
      token: parsed?.token ?? null,
      user: parsed?.user ?? null,
      refreshToken: parsed?.refreshToken ?? null,
      selectedRole: parsed?.selectedRole ?? null,
      roleColor: parsed?.roleColor ?? null,
    };
  } catch (err) {
    return { token: null, user: null, refreshToken: null, selectedRole: null, roleColor: null };
  }
};

export const saveAuthSession = async session => {
  const normalizedSession = {
    token: session?.token ?? null,
    user: session?.user ?? null,
    refreshToken: session?.refreshToken ?? null,
    selectedRole: session?.selectedRole ?? null,
    roleColor: session?.roleColor ?? null,
  };

  await AsyncStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify(normalizedSession),
  );

  return normalizedSession;
};

export const getStoredAuthSession = async () => {
  const rawSession = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  return parseSession(rawSession);
};

export const getStoredToken = async () => {
  const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  return parseSession(raw).token;
};

export const getStoredRefreshToken = async () => {
  const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  return parseSession(raw).refreshToken;
};

export const removeAuthSession = async () => {
  await AsyncStorage.removeItem(AUTH_SESSION_KEY);
};
