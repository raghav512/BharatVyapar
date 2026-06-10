import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import {
  saveAuthSession,
  getStoredAuthSession,
  removeAuthSession,
} from '../service/auth/authStorage';
import authApi from '../service/auth/authApi';
import userApi from '../service/user/userApi';
import COLORS from '../constant/colors';

// THUNK: App start pe disk check
export const checkStoredToken = createAsyncThunk(
  'auth/checkStoredToken',
  async (_, { rejectWithValue }) => {
    try {
      return await getStoredAuthSession();
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

        const normalizedSession = {
          token: response.token,
          user: response.user || response.data || null,
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
  async (_, { rejectWithValue }) => {
    try {
      console.log('📥 [GET USER] Fetching user details...');
      const response = await userApi.getUserDetails();
      const user = response?.data?.user || response?.data || null;
      console.log('✅ [GET USER] Success:', {
        name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'N/A',
        phone: user?.phone || 'N/A',
        role: user?.role || 'N/A',
      });
      return user;
    } catch (err) {
      console.error('❌ [GET USER] Failed:', err?.message);
      return rejectWithValue(err?.message || 'Failed to fetch user details');
    }
  },
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async ({ formData, clientUpdatedUser }, { rejectWithValue, getState, signal }) => {
    try {
      const currentUser = getState().auth.user || {};
      console.log('📤 [UPDATE PROFILE] Updating profile...');
      console.log('📝 [UPDATE PROFILE] Current data:', {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        gender: currentUser.gender,
        emailId: currentUser.emailId,
      });

      const response = await userApi.updateProfile(formData, signal);
      console.log('🔍 [UPDATE PROFILE] Backend response:', response);
      console.log('🔍 [UPDATE PROFILE] Backend response.data:', response?.data);

      const backendUser = response?.data || null;
      const mergedUser = { ...currentUser, ...backendUser, ...clientUpdatedUser };

      console.log('✅ [UPDATE PROFILE] Updated successfully');
      console.log('📝 [UPDATE PROFILE] New data:', {
        firstName: mergedUser.firstName,
        lastName: mergedUser.lastName,
        gender: mergedUser.gender,
        emailId: mergedUser.emailId,
        village: mergedUser.village,
        district: mergedUser.district,
        state: mergedUser.state,
      });

      return mergedUser;
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED' || axios.isCancel(err)) {
        console.log('🚫 [UPDATE PROFILE] Cancelled by user');
        return rejectWithValue({ cancelled: true });
      }
      console.error('❌ [UPDATE PROFILE] Failed:', err?.message);
      console.error('❌ [UPDATE PROFILE] Full backend error:', JSON.stringify(err?.backendError ?? err, null, 2));
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
        // Merge with existing user to preserve fields backend doesn't return (e.g. emailId)
        state.user = { ...(state.user || {}), ...action.payload };
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
        state.user = action.payload;
        // Capture from Immer draft synchronously before async call
        const token       = state.token;
        const selectedRole = state.selectedRole;
        const roleColor   = state.roleColor;
        const updatedUser = action.payload;
        getStoredAuthSession().then(session => {
          console.log('💾 [PERSIST USER] Saving session to storage...');
          return saveAuthSession({
            token,
            user: updatedUser,
            refreshToken: session?.refreshToken ?? null,
            selectedRole,
            roleColor,
          });
        }).catch(err => console.error('❌ [PERSIST USER] Failed:', err));
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
