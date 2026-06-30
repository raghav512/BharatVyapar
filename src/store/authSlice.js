import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import {
  saveAuthSession,
  getStoredAuthSession,
  removeAuthSession,
  saveLocalProfile,
  getLocalProfile,
} from '../service/auth/authStorage';
import authApi from '../service/auth/authApi';
import userApi from '../service/user/userApi';
import COLORS from '../constant/colors';
import { normalizeUser, mergeWithLocalProfile } from '../service/normalizers/user.normalizer';

// THUNK: App start pe disk check
export const checkStoredToken = createAsyncThunk(
  'auth/checkStoredToken',
  async (_, { rejectWithValue }) => {
    try {
      const session = await getStoredAuthSession();
      if (session?.user) {
        // normalizeUser trims to 14 clean fields + fixes shopname/email inconsistencies
        session.user = normalizeUser(session.user);
      }
      return session;
    } catch (err) {
      return rejectWithValue('Session restore failed. Please login again.');
    }
  },
);

export const sendOtp = createAsyncThunk(
  'auth/sendOtp',
  async ({ mobile, role }, { rejectWithValue }) => {
    try {
      const response = await authApi.sendOtp({ mobile, role });

      if (response?.success) {
        return response;
      }

      return rejectWithValue(response?.message || 'Failed to send OTP');
    } catch (err) {
      return rejectWithValue(err?.message || 'Send OTP failed');
    }
  },
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async ({ mobile, otp, role, roleColor }, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyOtp({ mobile, otp, role });

      if (response?.token) {
        const fallbackColor = {
          FPO: COLORS.fpoPrimary,
          Trader: COLORS.traderPrimary,
          Miller: COLORS.millerPrimary,
          Corporate: COLORS.corporatePrimary,
        }[role] || COLORS.fpoSecondary;

        const rawUser = response.user || response.data || null;
        // mergeWithLocalProfile: fills missing fields from local cache, then normalizes
        // Result: clean 14-field object, shopname/email fixed, 30+ extra keys stripped
        const localProfile = rawUser?.phone ? await getLocalProfile(rawUser.phone || mobile) : null;
        const user = mergeWithLocalProfile(rawUser, localProfile);

        const normalizedSession = {
          token: response.token,
          user,
          refreshToken: response.refreshToken || null,
          selectedRole: role,
          roleColor: roleColor || fallbackColor,
        };

        await saveAuthSession(normalizedSession);
        return normalizedSession;
      }

      return rejectWithValue(response?.message || 'OTP verification failed');
    } catch (err) {
      return rejectWithValue(err?.message || 'Verify OTP failed');
    }
  },
);

export const getUserDetails = createAsyncThunk(
  'auth/getUserDetails',
  async (_, { rejectWithValue, getState }) => {
    try {
      const response = await userApi.getUserDetails();
      const rawUser = response?.data?.user || response?.data || null;

      const stateUser = getState().auth.user;
      const phone = rawUser?.phone || stateUser?.phone;
      const localProfile = phone ? await getLocalProfile(phone) : null;

      // mergeWithLocalProfile fills missing fields, normalizeUser trims to 14 fields
      const user = mergeWithLocalProfile(rawUser, localProfile);

      if (__DEV__) {
        console.log('✅ [GET USER]', {
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'N/A',
          phone: user?.phone || 'N/A',
          role: user?.role || 'N/A',
        });
      }

      return user;
    } catch (err) {
      if (__DEV__) console.error('❌ [GET USER] Failed:', err?.message);
      return rejectWithValue(err?.message || 'Failed to fetch user details');
    }
  },
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async ({ formData, clientUpdatedUser, type }, { rejectWithValue, getState, signal }) => {
    try {
      const currentUser = getState().auth.user || {};

      const response = await userApi.updateProfile(formData, type, signal);
      const backendUser = response?.data || null;

      // Merge order: currentUser (base) → backendUser (server truth) → clientUpdatedUser (optimistic)
      // normalizeUser trims to 14 fields + fixes shopname/email — no manual patching needed
      const rawMerged = { ...currentUser, ...backendUser, ...clientUpdatedUser };
      const mergedUser = normalizeUser(rawMerged);

      if (mergedUser?.phone) {
        await saveLocalProfile(mergedUser.phone, mergedUser);
      }

      // Persist the updated session to AsyncStorage here in the thunk — BEFORE
      // returning to the reducer — so we can safely await it. Doing async work
      // inside an Immer reducer (fulfilled handler) is unsafe because Immer
      // finalises the draft synchronously; any async .then() continuation runs
      // after the draft is already revoked, leading to stale-capture bugs.
      try {
        const session = await getStoredAuthSession();
        const authState = getState().auth;
        await saveAuthSession({
          token: authState.token,
          user: mergedUser,
          refreshToken: session?.refreshToken ?? null,
          selectedRole: authState.selectedRole,
          roleColor: authState.roleColor,
        });
      } catch (persistErr) {
        if (__DEV__) console.error('❌ [PERSIST USER] Failed:', persistErr);
      }

      if (__DEV__) {
        console.log('✅ [UPDATE PROFILE]', {
          firstName: mergedUser?.firstName,
          lastName: mergedUser?.lastName,
          shopName: mergedUser?.shopName,
          emailId: mergedUser?.emailId,
        });
      }

      return mergedUser;
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED' || axios.isCancel(err)) {
        if (__DEV__) console.log('🚫 [UPDATE PROFILE] Cancelled by user');
        return rejectWithValue({ cancelled: true });
      }
      if (__DEV__) console.error('❌ [UPDATE PROFILE] Failed:', err?.message);
      return rejectWithValue(err?.message || 'Failed to update profile');
    }
  },
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      console.log('🔄 [LOGOUT] Logging out...');
      await userApi.logout();
      await removeAuthSession();
      console.log('✅ [LOGOUT] Logout successful');
      return true;
    } catch (err) {
      console.warn('⚠️ [LOGOUT] API failed, clearing session anyway');
      await removeAuthSession();
      return true;
    }
  },
);

const initialState = {
  token: null,
  user: null,
  selectedRole: null,
  roleColor: null,

  sendOtpLoading: false,
  verifyOtpLoading: false,
  profileLoading: false,

  sendOtpError: null,
  verifyOtpError: null,
  profileError: null,

  isAuthChecked: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSelectedRole: (state, action) => {
      state.selectedRole = action.payload.role || action.payload;
      state.roleColor = action.payload.color || null;
    },
    clearAuth: state => {
      state.token = null;
      state.user = null;
      state.selectedRole = null;
      state.roleColor = null;
      state.sendOtpLoading = false;
      state.verifyOtpLoading = false;
      state.sendOtpError = null;
      state.verifyOtpError = null;
      state.profileError = null;
      state.profileLoading = false;
      state.isAuthChecked = true;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(checkStoredToken.pending, state => {
        state.isAuthChecked = false;
      })
      .addCase(checkStoredToken.fulfilled, (state, action) => {
        state.token = action.payload?.token || null;
        state.user = action.payload?.user || null;
        state.selectedRole = action.payload?.selectedRole || null;
        state.roleColor = action.payload?.roleColor || null;
        state.isAuthChecked = true; // Splash hatne ka signal
      })
      .addCase(checkStoredToken.rejected, state => {
        state.token = null;
        state.user = null;
        state.selectedRole = null;
        state.roleColor = null;
        state.isAuthChecked = true;
      })
      .addCase(sendOtp.pending, state => {
        state.sendOtpLoading = true;
        state.sendOtpError = null;
      })
      .addCase(sendOtp.fulfilled, state => {
        state.sendOtpLoading = false;
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.sendOtpLoading = false;
        state.sendOtpError = action.payload || 'Send OTP failed';
      })
      .addCase(verifyOtp.pending, state => {
        state.verifyOtpLoading = true;
        state.verifyOtpError = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.verifyOtpLoading = false;
        state.token = action.payload?.token || null;
        state.user = action.payload?.user || null;
        state.selectedRole = action.payload?.selectedRole || null;
        state.roleColor = action.payload?.roleColor || null;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.verifyOtpLoading = false;
        state.verifyOtpError = action.payload || 'Verify OTP failed';
      })
      .addCase(getUserDetails.pending, state => {
        state.profileLoading = true;
        state.profileError = null;
      })
      .addCase(getUserDetails.fulfilled, (state, action) => {
        state.profileLoading = false;
        // Merge incoming payload with existing user to preserve fields the backend
        // doesn't return (e.g. emailId cached locally).
        //
        // PERFORMANCE FIX — shallow equality guard:
        //   Without this guard, every getUserDetails call produces a NEW user
        //   object reference (via spread), even when the data hasn't changed.
        //   That new reference causes ALL components subscribed via useSelector
        //   to re-render simultaneously (the ~1.29s "Render" burst in profiler).
        //   Solution: only assign state.user when the merged result is actually
        //   different from the current user (JSON.stringify fast-path).
        const merged = { ...(state.user || {}), ...action.payload };
        if (JSON.stringify(merged) !== JSON.stringify(state.user)) {
          state.user = merged;
        }
      })
      .addCase(getUserDetails.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileError = action.payload;
      })
      .addCase(updateProfile.pending, state => {
        state.profileLoading = true;
        state.profileError = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profileLoading = false;
        // Session persistence is now handled in the thunk (before returning),
        // keeping this reducer purely synchronous as Immer requires.
        state.user = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileError = action.payload;
      })
      .addCase(logoutUser.fulfilled, state => {
        state.token = null;
        state.user = null;
        state.selectedRole = null;
        state.roleColor = null;
        state.sendOtpLoading = false;
        state.verifyOtpLoading = false;
        state.profileLoading = false;
        state.sendOtpError = null;
        state.verifyOtpError = null;
        state.profileError = null;
        state.isAuthChecked = true;
      })
      .addCase(logoutUser.rejected, state => {
        state.token = null;
        state.user = null;
        state.selectedRole = null;
        state.roleColor = null;
        state.sendOtpLoading = false;
        state.verifyOtpLoading = false;
        state.profileLoading = false;
        state.sendOtpError = null;
        state.verifyOtpError = null;
        state.profileError = null;
        state.isAuthChecked = true;
      });
  },
});

export const { setSelectedRole, clearAuth } = authSlice.actions;
export default authSlice.reducer;
