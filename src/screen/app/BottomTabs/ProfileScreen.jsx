import React, { useEffect, useRef, useMemo, useCallback, useReducer } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Modal, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, mw, f } from '../../../utils/responsive';
import { logoutUser, getUserDetails, updateProfile } from '../../../store/authSlice';
import { selectUser, selectSelectedRole, selectProfileLoading } from '../../../store/authSelectors';
import { showAlert } from '../../../components/CustomAlertBox';
import userApi from '../../../service/user/userApi';
import { useTranslation } from '../../../hook/useTranslation';
import {
  ROLE_THEMES,
  GENDER_OPTIONS,
  DOCUMENTS_CONFIG,
  syncUserToDisplayData,
  buildProfileFormData,
  buildClientUpdatedUser,
  validateAndExtractErrors,
  viewDocumentByType,
  pickFileForUpload,
  buildDocumentFormData,
  validateProfileField,
} from '../../../service/user/userService';

/* ─── State Reducer ───────────────────────────────────────── */

const initialState = {
  modalVisible: false,
  modalForm: {},
  fieldErrors: {},
  kycModalVisible: false,
  kycForm: { pan: '', name: '' },
  kycErrors: {},
  kycLoading: false,
  focusedField: null,
  viewingDoc: null,
  uploadingDoc: null,
  documentPreviews: {},
  uploadedDocuments: {},
};

function profileReducer(state, action) {
  switch (action.type) {
    case 'OPEN_EDIT_MODAL':
      return {
        ...state,
        modalForm: action.payload,
        fieldErrors: {},
        modalVisible: true,
      };
    case 'CLOSE_EDIT_MODAL':
      return {
        ...state,
        modalVisible: false,
      };
    case 'SET_FIELD':
      return {
        ...state,
        modalForm: {
          ...state.modalForm,
          [action.payload.key]: action.payload.value,
        },
        fieldErrors: {
          ...state.fieldErrors,
          [action.payload.key]: action.payload.error,
        },
      };
    case 'SET_FIELD_ERRORS':
      return {
        ...state,
        fieldErrors: action.payload,
      };
    case 'OPEN_KYC_MODAL':
      return {
        ...state,
        kycForm: { pan: '', name: '' },
        kycErrors: {},
        kycModalVisible: true,
      };
    case 'CLOSE_KYC_MODAL':
      return {
        ...state,
        kycModalVisible: false,
      };
    case 'SET_KYC_FIELD':
      return {
        ...state,
        kycForm: {
          ...state.kycForm,
          [action.payload.key]: action.payload.value,
        },
        kycErrors: {
          ...state.kycErrors,
          [action.payload.key]: action.payload.error,
        },
      };
    case 'SET_KYC_ERRORS':
      return {
        ...state,
        kycErrors: action.payload,
      };
    case 'SET_KYC_LOADING':
      return {
        ...state,
        kycLoading: action.payload,
      };
    case 'SET_FOCUSED_FIELD':
      return {
        ...state,
        focusedField: action.payload,
      };
    case 'SET_VIEWING_DOC':
      return {
        ...state,
        viewingDoc: action.payload,
      };
    case 'SET_UPLOADING_DOC':
      return {
        ...state,
        uploadingDoc: action.payload,
      };
    case 'SET_DOC_PREVIEW':
      return {
        ...state,
        documentPreviews: {
          ...state.documentPreviews,
          [action.payload.type]: action.payload.file,
        },
      };
    case 'REMOVE_DOC_PREVIEW': {
      const nextPreviews = { ...state.documentPreviews };
      delete nextPreviews[action.payload];
      return {
        ...state,
        documentPreviews: nextPreviews,
      };
    }
    case 'SET_UPLOADED_DOC':
      return {
        ...state,
        uploadedDocuments: {
          ...state.uploadedDocuments,
          [action.payload]: true,
        },
      };
    case 'CANCEL_UPLOAD': {
      const nextPreviews = { ...state.documentPreviews };
      delete nextPreviews[state.uploadingDoc];
      return {
        ...state,
        documentPreviews: nextPreviews,
        uploadingDoc: null,
      };
    }
    default:
      return state;
  }
}

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  // PERFORMANCE FIX: Three separate granular selectors instead of whole-slice.
  // ProfileScreen only re-renders when user, selectedRole, or profileLoading
  // change — not on sendOtpLoading, verifyOtpError, or any other auth field.
  const user           = useSelector(selectUser);
  const stateRole      = useSelector(selectSelectedRole);
  const profileLoading = useSelector(selectProfileLoading);

  // Consolidated useReducer state
  const [state, dispatchAction] = useReducer(profileReducer, initialState);

  const {
    modalVisible,
    modalForm,
    fieldErrors,
    kycModalVisible,
    kycForm,
    kycErrors,
    kycLoading,
    focusedField,
    viewingDoc,
    uploadingDoc,
    documentPreviews,
    uploadedDocuments
  } = state;

  const uploadAbortRef = useRef(null);
  const isMounted = useRef(true);
  // PERFORMANCE FIX — fetch-once guard:
  //   Without this, fetchUserDetails() runs on every render cycle because
  //   useEffect depends on fetchUserDetails (a useCallback). When the parent
  //   re-renders (e.g. due to another auth action), React re-evaluates this
  //   component, which can recreate fetchUserDetails and re-fire the effect.
  //   This ref ensures getUserDetails is dispatched exactly ONCE per mount,
  //   eliminating the cascade of periodic 1.5–2.5s profiler bursts.
  const hasFetchedRef = useRef(false);

  // Mount/Unmount hooks
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      const uploadTask = uploadAbortRef.current;
      uploadTask?.promise?.abort();
    };
  }, []);

  // Sync user details function with fail check and retry
  const fetchUserDetails = useCallback(async () => {
    console.log('[ProfileScreen] fetchUserDetails: Syncing user profile details...');
    const result = await dispatch(getUserDetails());
    if (getUserDetails.rejected.match(result)) {
      console.error('[ProfileScreen] getUserDetails failed:', result.payload);
      showAlert({
        type: 'error',
        title: t('Sync Failed'),
        message: t(result.payload || 'Failed to sync profile details from server. Please check your internet connection.'),
        buttons: [
          { text: t('Retry'), onPress: fetchUserDetails },
          { text: t('OK') }
        ]
      });
    }
  }, [dispatch, t]);

  useEffect(() => {
    // Dispatch getUserDetails only once per mount. Using a ref guard prevents
    // re-dispatching if the parent re-renders (which would invalidate
    // fetchUserDetails' useCallback and re-fire this effect).
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchUserDetails();
    }
  }, [fetchUserDetails]);

  // Derived state (memoized only for data sync conversion)
  const displayData = useMemo(() => syncUserToDisplayData(user), [user]);

  // Derived lightweight assignments (without useMemo overhead)
  const selectedRole   = stateRole || user?.role || 'FPO';
  const theme          = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  const fullName       = `${displayData.firstName || ''} ${displayData.lastName || ''}`.trim() || '—';
  const avatarInitial  = displayData.firstName ? displayData.firstName[0].toUpperCase() : '?';
  const hasAvatar      = !!displayData.profileImage;
  const hasName        = !!(displayData.firstName?.trim() || displayData.lastName?.trim());
  const saveBtnLabel   = profileLoading ? t('Saving...') : t('Save Changes');

  // Dynamic Styles (without useMemo overhead)
  const roleBadgeBg = { backgroundColor: theme.primary + '1A' };
  const editBtnBg = { backgroundColor: theme.primary + '15' };
  const profileCoverBg = { backgroundColor: theme.primary + '25' };
  const avatarWrapperBorder = { borderColor: theme.primary + '40' };
  const avatarCircleBg = { backgroundColor: theme.primary };
  const avatarEditIconBg = { backgroundColor: theme.primary };
  const roleBadgeTextCol = { color: theme.primary };
  const kycBtnBg = { backgroundColor: theme.primary };
  const editBtnTextCol = { color: theme.primary };
  const saveBtnBg = { backgroundColor: theme.primary };

  // Memoized mapping of documents config
  const documents = useMemo(() => {
    return DOCUMENTS_CONFIG.map(d => {
      const val = displayData[d.dataKey];
      const isViewing = viewingDoc === d.type;
      const isUploading = uploadingDoc === d.type;
      const canViewDoc = !!val || !!uploadedDocuments[d.type] || !!documentPreviews[d.type];
      const uploadIcon = canViewDoc ? 'swap-horizontal' : 'cloud-upload';
      const uploadLabel = isUploading ? t('Uploading...') : canViewDoc ? t('Replace') : t('Upload');
      const uploadBg = { backgroundColor: theme.primary + '15' };
      const docPreview = documentPreviews[d.type];
      const statusText = docPreview
        ? (isUploading ? t('Selected, uploading...') : t('Selected (not uploaded)'))
        : val ? t('✓ Uploaded') : t('✗ Not Uploaded');

      return {
        ...d,
        value: val,
        isViewing,
        isUploading,
        canViewDoc,
        uploadIcon,
        uploadLabel,
        uploadBg,
        statusText,
      };
    });
  }, [displayData, viewingDoc, uploadingDoc, uploadedDocuments, documentPreviews, theme.primary, t]);

  // Callbacks
  const openEditModal = useCallback(() => {
    dispatchAction({ type: 'OPEN_EDIT_MODAL', payload: { ...displayData } });
  }, [displayData]);

  const closeModal = useCallback(() => {
    dispatchAction({ type: 'CLOSE_EDIT_MODAL' });
  }, []);

  const setField = useCallback((key, val) => {
    const error = validateProfileField(key, val);
    dispatchAction({ type: 'SET_FIELD', payload: { key, value: val, error } });
  }, []);

  const handleSave = useCallback(async () => {
    if (profileLoading) return;

    const { isValid, errors } = validateAndExtractErrors(modalForm);
    if (!isValid) {
      dispatchAction({ type: 'SET_FIELD_ERRORS', payload: errors });
      return;
    }

    const formData          = buildProfileFormData(modalForm);
    const clientUpdatedUser = buildClientUpdatedUser(modalForm);
    console.log('[ProfileScreen] handleSave: profile payload built. Dispatching update...');
    const result            = await dispatch(updateProfile({ formData, clientUpdatedUser }));

    if (!isMounted.current) return;

    if (updateProfile.fulfilled.match(result)) {
      closeModal();
      showAlert({ type: 'info', title: t('Profile Saved'), message: t('Your profile has been updated successfully.'), buttons: [{ text: t('Done') }] });
    } else {
      showAlert({ type: 'error', title: t('Update Failed'), message: t(result.payload || 'Failed to update profile.'), buttons: [{ text: t('OK') }] });
    }
  }, [dispatch, modalForm, profileLoading, closeModal, t]);

  const handleKycSubmit = useCallback(async () => {
    const panErr = validatePan(kycForm.pan);
    const nameErr = validateKycName(kycForm.name);

    if (panErr || nameErr) {
      dispatchAction({ type: 'SET_KYC_ERRORS', payload: { pan: panErr, name: nameErr } });
      return;
    }

    try {
      dispatchAction({ type: 'SET_KYC_LOADING', payload: true });
      console.log('[ProfileScreen] handleKycSubmit: submitting PAN for verification...');
      await userApi.verifyPan({ pan: kycForm.pan, name: kycForm.name });

      showAlert({
        type: 'info',
        title: t('KYC Verified'),
        message: t('Your PAN details have been successfully verified.'),
        buttons: [{ text: t('OK') }]
      });

      await dispatch(getUserDetails());
      dispatchAction({ type: 'CLOSE_KYC_MODAL' });
    } catch (error) {
      console.error('[ProfileScreen] handleKycSubmit verification failure:', error);
      showAlert({
        type: 'error',
        title: t('KYC Verification Failed'),
        message: t(error?.message || 'Failed to verify PAN. Please ensure details are correct.'),
        buttons: [{ text: t('OK') }]
      });
    } finally {
      dispatchAction({ type: 'SET_KYC_LOADING', payload: false });
    }
  }, [dispatch, kycForm, t]);

  const handleLogout = useCallback(() => {
    showAlert({
      type: 'confirm', 
      title: t('Logout'), 
      message: t('Are you sure you want to logout?'),
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Logout'), style: 'destructive', onPress: () => {
          console.log('[ProfileScreen] handleLogout: user triggered logout session termination.');
          dispatch(logoutUser());
        }},
      ],
    });
  }, [dispatch, t]);

  const handleViewDoc = useCallback(async (type) => {
    const previewUri = documentPreviews[type]?.uri;
    dispatchAction({ type: 'SET_VIEWING_DOC', payload: type });
    console.log(`[ProfileScreen] handleViewDoc: opening file preview for type=${type}`);
    await viewDocumentByType(type, previewUri);
    dispatchAction({ type: 'SET_VIEWING_DOC', payload: null });
  }, [documentPreviews]);

  const handleCancelUpload = useCallback(() => {
    const uploadTask = uploadAbortRef.current;
    if (uploadTask) {
      console.log('🚫 [UPLOAD DOC] Cancel requested by user');
      uploadTask.cancelled = true;
      uploadTask.promise?.abort();
      uploadAbortRef.current = null;
    }
    dispatchAction({ type: 'CANCEL_UPLOAD' });
  }, []);

  const openImagePicker = useCallback(async (pickerType) => {
    try {
      const options = { mediaType: 'photo', quality: 0.8, selectionLimit: 1 };
      const result = pickerType === 'camera' 
        ? await launchCamera(options) 
        : await launchImageLibrary(options);

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const file = { uri: asset.uri, name: asset.fileName || `profile_image_${Date.now()}.jpg`, type: asset.type || 'image/jpeg' };

      dispatchAction({ type: 'SET_UPLOADING_DOC', payload: 'profileImage' });
      const formData = buildDocumentFormData('profileImage', file);
      console.log('[ProfileScreen] openImagePicker: uploading image profile data...');
      const updateResult = await dispatch(updateProfile({ formData, clientUpdatedUser: {}, type: 'profileImage' }));

      if (!isMounted.current) return;

      if (updateProfile.fulfilled.match(updateResult)) {
        await dispatch(getUserDetails());
        if (isMounted.current) {
          showAlert({ type: 'info', title: t('Success'), message: t('Profile picture updated successfully.'), buttons: [{ text: t('OK') }] });
        }
      } else {
        showAlert({ type: 'error', title: t('Upload Failed'), message: t(updateResult.payload || 'Failed to update profile picture.'), buttons: [{ text: t('OK') }] });
      }
    } catch (error) {
      console.error('[ProfileScreen] openImagePicker error:', error);
      showAlert({ type: 'error', title: t('Error'), message: t('Something went wrong while selecting the image.'), buttons: [{ text: t('OK') }] });
    } finally {
      if (isMounted.current) {
        dispatchAction({ type: 'SET_UPLOADING_DOC', payload: null });
      }
    }
  }, [dispatch, t]);

  const handleProfileImagePick = useCallback(() => {
    showAlert({
      type: 'confirm',
      title: t('Update Profile Picture'),
      message: t('Choose an option to upload your profile image'),
      buttons: [
        { text: t('Take Photo'), style: 'default', onPress: () => openImagePicker('camera') },
        { text: t('Choose Gallery'), style: 'default', onPress: () => openImagePicker('gallery') },
        { text: t('Cancel'), style: 'cancel' }
      ]
    });
  }, [openImagePicker, t]);

  const handleUploadDoc = useCallback(async (type) => {
    const uploadTask = { type, cancelled: false, promise: null };
    uploadAbortRef.current = uploadTask;
    dispatchAction({ type: 'SET_UPLOADING_DOC', payload: type });
    try {
      const file = await pickFileForUpload();
      if (!file || uploadTask.cancelled) {
        console.log('⚠️ [UPLOAD DOC] No file selected or cancelled, aborting.');
        return;
      }

      dispatchAction({ type: 'SET_DOC_PREVIEW', payload: { type, file } });
      console.log('🚀 [UPLOAD DOC] Dispatching updateProfile for type:', type);
      const formData = buildDocumentFormData(type, file);
      const uploadPromise = dispatch(updateProfile({ formData, clientUpdatedUser: {}, type }));
      uploadTask.promise = uploadPromise;
      const result = await uploadPromise;
      console.log('🔍 [UPLOAD DOC] Dispatch result status:', result?.meta?.requestStatus);

      if (!isMounted.current || uploadTask.cancelled || result.meta?.aborted) return;

      if (updateProfile.fulfilled.match(result)) {
        console.log('🔄 [UPLOAD DOC] Refreshing user after upload...');
        await dispatch(getUserDetails());
        if (!isMounted.current || uploadTask.cancelled || result.meta?.aborted) return;
        dispatchAction({ type: 'SET_UPLOADED_DOC', payload: type });
        dispatchAction({ type: 'REMOVE_DOC_PREVIEW', payload: type });
        const docLabel = DOCUMENTS_CONFIG.find(d => d.type === type)?.label || type;
        showAlert({ type: 'info', title: t('Uploaded'), message: t('{document} uploaded successfully.').replace('{document}', t(docLabel)), buttons: [{ text: t('OK') }] });
      } else if (!result.meta?.aborted && !result.payload?.cancelled) {
        showAlert({ type: 'error', title: t('Upload Failed'), message: t(result.payload || 'Upload failed.'), buttons: [{ text: t('OK') }] });
      }
    } finally {
      if (uploadAbortRef.current === uploadTask) {
        uploadAbortRef.current = null;
      }
      if (isMounted.current) {
        dispatchAction({ type: 'SET_UPLOADING_DOC', payload: null });
      }
    }
  }, [dispatch, t]);

  return (
    <SafeScreen style={styles.safeContainer} top={false} bottom={false}>
      <AppHeader backgroundColor={theme.primary} title={t("My Profile")} subtitle={t("Manage your account & preferences")} showBackButton={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Avatar Card */}
        <View style={styles.profileCard}>
          <View style={[styles.profileCover, profileCoverBg]} />
          <TouchableOpacity 
            activeOpacity={0.85} 
            onPress={handleProfileImagePick} 
            disabled={uploadingDoc === 'profileImage'}
            style={[styles.avatarWrapper, avatarWrapperBorder]}
            accessible={true}
            accessibilityRole="imagebutton"
            accessibilityLabel={t("Update Profile Picture")}
            accessibilityHint={t("Choose to take a photo or select from gallery")}
          >
            {hasAvatar ? (
              <Image source={{ uri: displayData.profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarCircle, avatarCircleBg]}>
                {hasName ? (
                  <Text style={styles.avatarText}>{avatarInitial}</Text>
                ) : (
                  <MaterialIcons name="person" size={f(48)} color={COLORS.white} />
                )}
              </View>
            )}
            {uploadingDoc === 'profileImage' ? (
              <View style={[styles.avatarEditIcon, { backgroundColor: COLORS.white }]}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : (
              <View style={[styles.avatarEditIcon, avatarEditIconBg]}>
                <Icon name="camera-plus" size={15} color={COLORS.white} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.profileName} accessible={true} accessibilityLabel={`${t('Name')}: ${fullName}`}>{fullName}</Text>
          <View style={styles.profilePhoneWrapper} accessible={true} accessibilityLabel={`${t('Phone')}: +91 ${displayData.phone}`}>
            <Icon name="phone" size={14} color="#718096" />
            <Text style={styles.profilePhoneNoMargin}>+91 {displayData.phone}</Text>
          </View>
          <View style={[styles.roleBadge, roleBadgeBg]} accessible={true} accessibilityLabel={`${t('Role')}: ${t(selectedRole)}`}>
            <Text style={[styles.roleBadgeText, roleBadgeTextCol]}>
              {t('Role: {role}').replace('{role}', t(selectedRole))}
            </Text>
          </View>
        </View>

        {/* KYC Card */}
        <View style={[styles.fieldsCard, styles.kycCard]}>
          <View style={styles.kycHeaderRow}>
            <View style={styles.kycTitleCol}>
              <Text style={styles.sectionTitleDark}>{t("KYC Verification")}</Text>
              <Text style={styles.kycSubtitle}>{t("Verify details to authorize buys & sells")}</Text>
            </View>
            <View style={[
              styles.kycBadge,
              user?.kycStatus === 'VERIFIED' 
                ? styles.kycBadgeVerified
                : styles.kycBadgeUnverified
            ]} accessible={true} accessibilityLabel={`${t('KYC Status')}: ${user?.kycStatus === 'VERIFIED' ? t('Verified') : t('Not Verified')}`}>
              <Icon 
                name={user?.kycStatus === 'VERIFIED' ? 'check-decagram' : 'alert-decagram'} 
                size={16} 
                color={user?.kycStatus === 'VERIFIED' ? '#319795' : '#E53E3E'} 
              />
              <Text style={[
                styles.kycBadgeText, 
                user?.kycStatus === 'VERIFIED' ? styles.kycBadgeTextVerified : styles.kycBadgeTextUnverified
              ]}>
                {user?.kycStatus === 'VERIFIED' ? t('VERIFIED') : t('NOT VERIFIED')}
              </Text>
            </View>
          </View>

          {user?.kycStatus === 'VERIFIED' ? (
            <View style={styles.kycVerifiedContainer}>
              <View style={styles.kycInfoRow}>
                <View style={styles.kycDetailCol} accessible={true} accessibilityLabel={`${t('PAN number')}: ${user?.panDetails?.pan || '—'}`}>
                  <Text style={styles.kycDetailLabel}>{t('PAN NUMBER')}</Text>
                  <Text style={styles.kycDetailVal}>{user?.panDetails?.pan || '—'}</Text>
                </View>
                <View style={styles.kycDetailCol} accessible={true} accessibilityLabel={`${t('Cardholder name')}: ${user?.panDetails?.name_provided || user?.panDetails?.registered_name || '—'}`}>
                  <Text style={styles.kycDetailLabel}>{t('CARDHOLDER NAME')}</Text>
                  <Text style={styles.kycDetailVal}>{user?.panDetails?.name_provided || user?.panDetails?.registered_name || '—'}</Text>
                </View>
              </View>
              {user?.panDetails?.registered_name && user?.panDetails?.registered_name !== user?.panDetails?.name_provided && (
                <View style={styles.kycMatchRow} accessible={true} accessibilityLabel={`${t('Registered name matches')}: ${user?.panDetails?.registered_name}`}>
                  <Icon name="shield-check-outline" size={12} color="#319795" />
                  <Text style={styles.kycMatchTextNoMargin}>
                    {t('Registered as: {name}').replace('{name}', user?.panDetails?.registered_name)}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.kycPendingContainer}>
              <View style={styles.kycWarningRow}>
                <Icon name="alert-circle-outline" size={18} color="#E53E3E" style={{ marginTop: h(1) }} />
                <Text style={styles.kycWarningTextLeft}>
                  {t('Your account is not authorized for trading. Complete your PAN-based KYC immediately to enable Sell & Buy features.')}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.kycBtn, kycBtnBg]} 
                activeOpacity={0.85} 
                onPress={() => {
                  dispatchAction({ type: 'OPEN_KYC_MODAL' });
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t("Do your KYC")}
                accessibilityHint={t("Opens PAN card verification modal")}
              >
                <Icon name="shield-check" size={18} color={COLORS.white} />
                <Text style={styles.kycBtnText}>{t('Do Your KYC')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Profile Details Card */}
        <View style={styles.fieldsCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitleDark}>{t('Profile Details')}</Text>
            <TouchableOpacity 
              onPress={openEditModal} 
              style={[styles.editBtn, editBtnBg]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('Edit Profile')}
              accessibilityHint={t("Opens edit details modal form")}
            >
              <Icon name="pencil" size={15} color={theme.primary} />
              <Text style={[styles.editBtnText, editBtnTextCol]}>{t('Edit Profile')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <View style={styles.halfCol}><FieldRow label="First Name" value={displayData.firstName} /></View>
            <View style={styles.halfCol}><FieldRow label="Last Name"  value={displayData.lastName} /></View>
          </View>
          <FieldRow label="Shop Name" value={displayData.shopName} />
          <FieldRow label="Gender"   value={displayData.gender} />
          <FieldRow label="Phone"    value={displayData.phone} />
          <FieldRow label="Email ID" value={displayData.emailId} />
          <View style={styles.row}>
            <View style={styles.thirdCol}><FieldRow label="Village"  value={displayData.village} /></View>
            <View style={styles.thirdCol}><FieldRow label="District" value={displayData.district} /></View>
            <View style={styles.thirdCol}><FieldRow label="State"    value={displayData.state} last /></View>
          </View>
        </View>

        {/* Documents Card */}
        <View style={styles.fieldsCard}>
          <Text style={styles.sectionTitleDarkMargin}>{t('Documents & KYC')}</Text>
          {documents.map(doc => (
            <View style={styles.docRow} key={doc.type}>
              <View style={styles.flex1} accessible={true} accessibilityLabel={`${t(doc.label)}: ${t(doc.statusText)}`}>
                <Text style={styles.docLabel}>{t(doc.label)}</Text>
                <Text style={styles.docStatus}>{t(doc.statusText)}</Text>
              </View>
              <View style={styles.docActions}>
                {doc.canViewDoc && (
                  <TouchableOpacity 
                    onPress={() => handleViewDoc(doc.type)} 
                    disabled={doc.isViewing} 
                    style={styles.docBtnGray}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('View {document}').replace('{document}', t(doc.label))}
                    accessibilityHint={t('Displays document for {document}').replace('{document}', t(doc.label))}
                  >
                    <Icon name="eye" size={15} color="#4A5568" />
                    <Text style={styles.docBtnTextGray}>{doc.isViewing ? '...' : t('View')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={() => handleUploadDoc(doc.type)} 
                  disabled={!!uploadingDoc} 
                  style={[styles.docBtn, doc.uploadBg]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('{action} {document}').replace('{action}', doc.uploadLabel).replace('{document}', t(doc.label))}
                  accessibilityHint={t('Upload or replace file for {document}').replace('{document}', t(doc.label))}
                >
                  <Icon name={doc.uploadIcon} size={15} color={theme.primary} />
                  <Text style={[styles.docBtnText, { color: theme.primary }]}>{doc.uploadLabel}</Text>
                </TouchableOpacity>
                {doc.isUploading && (
                  <TouchableOpacity 
                    onPress={handleCancelUpload} 
                    style={[styles.docBtn, styles.cancelBtn]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('Cancel uploading {document}').replace('{document}', t(doc.label))}
                  >
                    <Icon name="close" size={15} color="#E53E3E" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity 
          style={styles.logoutBtn} 
          onPress={handleLogout} 
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('Logout')}
          accessibilityHint={t('Terminates session and returns to login screen')}
        >
          <Icon name="power" size={22} color={COLORS.error} />
          <Text style={styles.logoutText}>{t('Logout')}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContainer}>

            <View style={[styles.modalHeader, { backgroundColor: theme.primary }]}>
              <Text style={styles.modalTitle}>{t('Edit Profile')}</Text>
              <TouchableOpacity 
                onPress={closeModal} 
                style={styles.closeBtn}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('Close Modal')}
              >
                <Icon name="close" size={22} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>

              {/* Name row */}
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <FormField label="First Name" fieldKey="firstName" form={modalForm} errors={fieldErrors} onChangeText={setField} placeholder="First Name" />
                </View>
                <View style={styles.halfCol}>
                  <FormField label="Last Name" fieldKey="lastName" form={modalForm} errors={fieldErrors} onChangeText={setField} placeholder="Last Name" />
                </View>
              </View>

              {/* Shop Name */}
              <View style={styles.fullCol}>
                <FormField label="Shop Name" fieldKey="shopName" form={modalForm} errors={fieldErrors} onChangeText={setField} placeholder="Shop Name" />
              </View>

              {/* Gender picker */}
              <View style={styles.fullCol}>
                <Text style={styles.fieldLabel}>{t('Gender')}</Text>
                <View style={styles.genderPicker}>
                  {GENDER_OPTIONS.map(g => {
                    const isSelected  = modalForm.gender?.toLowerCase() === g.toLowerCase();
                    const chipStyle   = isSelected ? { backgroundColor: theme.primary, borderColor: theme.primary } : null;
                    const chipTxtStyle = isSelected ? { color: COLORS.white } : null;
                    return (
                      <TouchableOpacity 
                        key={g} 
                        onPress={() => setField('gender', g)} 
                        style={[styles.genderChip, chipStyle]}
                        accessible={true}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={t('Gender option {gender}').replace('{gender}', t(g))}
                      >
                        <Text style={[styles.genderChipText, chipTxtStyle]}>{t(g)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {fieldErrors.gender && <Text style={styles.errorText}>{t(fieldErrors.gender)}</Text>}
              </View>

              {/* Phone & Email row */}
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>{t('Phone')}</Text>
                  <TextInput 
                    style={[styles.fieldInput, styles.disabledInput]} 
                    value={modalForm.phone} 
                    editable={false} 
                    placeholderTextColor="#A0AEC0"
                    accessible={true}
                    accessibilityLabel={t('Phone Number (Non-editable)')}
                  />
                </View>
                <View style={styles.halfCol}>
                  <FormField label="Email ID" fieldKey="emailId" form={modalForm} errors={fieldErrors} onChangeText={setField} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
                </View>
              </View>

              {/* Location row */}
              <View style={styles.row}>
                <View style={styles.thirdCol}>
                  <FormField label="Village"  fieldKey="village"  form={modalForm} errors={fieldErrors} onChangeText={setField} placeholder="Village" />
                </View>
                <View style={styles.thirdCol}>
                  <FormField label="District" fieldKey="district" form={modalForm} errors={fieldErrors} onChangeText={setField} placeholder="District" />
                </View>
                <View style={styles.thirdCol}>
                  <FormField label="State"    fieldKey="state"    form={modalForm} errors={fieldErrors} onChangeText={setField} placeholder="State" />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.saveBtn, saveBtnBg]} 
                onPress={handleSave} 
                disabled={profileLoading} 
                activeOpacity={0.85}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={saveBtnLabel}
              >
                <Text style={styles.saveBtnText}>{saveBtnLabel}</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* KYC Verification Bottom Sheet Modal */}
      <Modal 
        visible={kycModalVisible} 
        animationType="slide" 
        transparent 
        onRequestClose={() => {
          if (!kycLoading) dispatchAction({ type: 'CLOSE_KYC_MODAL' });
        }}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContainer, styles.kycModalContainer]}>
            {/* Native Drag Handle */}
            <View style={styles.modalHandle} />

            <View style={styles.kycModalHeader}>
              <View>
                <Text style={styles.kycModalTitle}>{t('Verify PAN Card')}</Text>
                <Text style={styles.modalSubTitleText}>{t('Instantly verify identity using NSDL registry')}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => dispatchAction({ type: 'CLOSE_KYC_MODAL' })} 
                disabled={kycLoading}
                style={styles.closeBtn}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('Close verification window')}
              >
                <Icon name="close" size={18} color="#718096" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              contentContainerStyle={styles.modalBody} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Trust Badge */}
              <View style={styles.trustBadge}>
                <Icon name="shield-check" size={16} color="#319795" />
                <Text style={styles.trustBadgeText}>{t('Income Tax Department Database Integration')}</Text>
              </View>

              <View style={styles.fullCol}>
                <Text style={styles.fieldLabel}>{t('PAN Cardholder Name')}</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'name' && { borderColor: theme.primary, backgroundColor: COLORS.white },
                  kycErrors.name && styles.inputErrorContainer
                ]}>
                  <Icon 
                    name="account-box-outline" 
                    size={20} 
                    color={focusedField === 'name' ? theme.primary : '#A0AEC0'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.textInputStyle}
                    value={kycForm.name}
                    onChangeText={v => {
                      const error = validateKycName(v);
                      dispatchAction({ type: 'SET_KYC_FIELD', payload: { key: 'name', value: v, error } });
                    }}
                    placeholder={t('Enter full name as on PAN card')}
                    placeholderTextColor="#A0AEC0"
                    autoCapitalize="words"
                    editable={!kycLoading}
                    onFocus={() => dispatchAction({ type: 'SET_FOCUSED_FIELD', payload: 'name' })}
                    onBlur={() => dispatchAction({ type: 'SET_FOCUSED_FIELD', payload: null })}
                    accessible={true}
                    accessibilityLabel={t('PAN Cardholder Name')}
                    accessibilityHint={t('Enter cardholder name exactly as printed on the PAN card')}
                    accessibilityInvalid={!!kycErrors.name}
                  />
                </View>
                {kycErrors.name && <Text style={styles.errorText}>{t(kycErrors.name)}</Text>}
              </View>

              <View style={styles.fullCol}>
                <Text style={styles.fieldLabel}>{t('PAN Number')}</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'pan' && { borderColor: theme.primary, backgroundColor: COLORS.white },
                  kycErrors.pan && styles.inputErrorContainer
                ]}>
                  <Icon 
                    name="card-account-details-outline" 
                    size={20} 
                    color={focusedField === 'pan' ? theme.primary : '#A0AEC0'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.textInputStyle}
                    value={kycForm.pan}
                    onChangeText={v => {
                      const uppercaseVal = v.toUpperCase();
                      const error = validatePan(uppercaseVal);
                      dispatchAction({ type: 'SET_KYC_FIELD', payload: { key: 'pan', value: uppercaseVal, error } });
                    }}
                    placeholder={t('e.g. ABCDE1234F')}
                    placeholderTextColor="#A0AEC0"
                    autoCapitalize="characters"
                    maxLength={10}
                    editable={!kycLoading}
                    onFocus={() => dispatchAction({ type: 'SET_FOCUSED_FIELD', payload: 'pan' })}
                    onBlur={() => dispatchAction({ type: 'SET_FOCUSED_FIELD', payload: null })}
                    accessible={true}
                    accessibilityLabel={t('PAN Number')}
                    accessibilityHint={t('Enter your 10 digit Permanent Account Number')}
                    accessibilityInvalid={!!kycErrors.pan}
                  />
                </View>
                {kycErrors.pan && <Text style={styles.errorText}>{t(kycErrors.pan)}</Text>}
              </View>

              <TouchableOpacity 
                style={[styles.saveBtn, styles.kycSubmitBtn, saveBtnBg]} 
                onPress={handleKycSubmit} 
                disabled={kycLoading} 
                activeOpacity={0.85}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={kycLoading ? t('Verifying PAN') : t('Verify & Submit')}
              >
                {kycLoading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Icon name="shield-check" size={20} color={COLORS.white} />
                )}
                <Text style={styles.saveBtnText}>
                  {kycLoading ? t('Verifying PAN...') : t('Verify & Submit')}
                </Text>
              </TouchableOpacity>

              <Text style={styles.termsNote}>
                🔒 {t('Your security is our priority. PAN details are transmitted securely using high-grade encryption and are not stored permanently.')}
              </Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeScreen>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────

function FieldRow({ label, value, last }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.fieldRow, !last && styles.fieldRowBorder]} accessible={true} accessibilityLabel={`${t(label)}: ${value || t('Not provided')}`}>
      <Text style={styles.fieldLabel}>{t(label)}</Text>
      <Text style={styles.fieldVal}>{value || '—'}</Text>
    </View>
  );
}

function FormField({ label, fieldKey, form, errors, onChangeText, placeholder, keyboardType, autoCapitalize }) {
  const { t } = useTranslation();
  const hasError    = !!errors[fieldKey];
  const inputStyle  = [styles.fieldInput, hasError && styles.inputError];
  return (
    <>
      <Text style={styles.fieldLabel}>{t(label)}</Text>
      <TextInput
        style={inputStyle}
        value={form[fieldKey]}
        onChangeText={v => onChangeText(fieldKey, v)}
        placeholder={placeholder ? t(placeholder) : placeholder}
        placeholderTextColor="#A0AEC0"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        accessible={true}
        accessibilityLabel={t(label)}
        accessibilityHint={t('Edit your {field}').replace('{field}', t(label))}
        accessibilityInvalid={hasError}
      />
      {hasError && <Text style={styles.errorText}>{t(errors[fieldKey])}</Text>}
    </>
  );
}

const validatePan = (pan) => {
  if (!pan) return 'PAN number is required';
  const cleanPan = pan.trim().toUpperCase();
  if (cleanPan.length !== 10) return 'PAN must be exactly 10 characters';
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(cleanPan)) return 'Invalid PAN format (e.g. ABCDE1234F)';
  return null;
};

const validateKycName = (name) => {
  if (!name) return 'Name as per PAN card is required';
  const cleanName = name.trim();
  if (cleanName.length < 3) return 'Name must be at least 3 characters';
  if (/[<>"'`&]/.test(cleanName)) return 'Name contains invalid characters';
  return null;
};

// ── styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { padding: w(16), paddingBottom: h(40) },
  
  profileCard: {
    backgroundColor: COLORS.white, 
    borderRadius: mw(24), 
    alignItems: 'center', 
    marginBottom: h(20), 
    elevation: 8,
    shadowColor: '#1A202C', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.06, 
    shadowRadius: 16,
    overflow: 'hidden',
    paddingBottom: h(24)
  },
  profileCover: {
    width: '100%',
    height: h(85),
    position: 'absolute',
    top: 0,
    borderTopLeftRadius: mw(24),
    borderTopRightRadius: mw(24),
  },
  avatarWrapper:  { 
    position: 'relative', 
    marginTop: h(45),
    marginBottom: h(14),
    padding: w(5),
    backgroundColor: COLORS.white,
    borderRadius: mw(50),
    borderWidth: 2,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  avatarCircle:   { width: w(86), height: w(86), borderRadius: mw(43), alignItems: 'center', justifyContent: 'center' },
  avatarImage:    { width: w(86), height: w(86), borderRadius: mw(43) },
  avatarText:     { fontSize: f(32), color: COLORS.white, fontWeight: '800' },
  avatarEditIcon: {
    position: 'absolute',
    bottom: h(-2),
    right: w(-2),
    width: w(32),
    height: w(32),
    borderRadius: mw(16),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.white,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  profileName:    { fontSize: f(22), fontWeight: '800', color: '#1A202C', letterSpacing: 0.2 },
  profilePhone:   { fontSize: f(14), color: '#718096', marginTop: h(4), fontWeight: '600' },
  roleBadge:      { marginTop: h(12), paddingHorizontal: w(16), paddingVertical: h(6), borderRadius: mw(20) },
  roleBadgeText:  { fontWeight: '800', fontSize: f(12), textTransform: 'uppercase', letterSpacing: 0.5 },
  
  fieldsCard: {
    backgroundColor: COLORS.white, 
    borderRadius: mw(24), 
    padding: w(20),
    marginBottom: h(20), 
    elevation: 6,
    shadowColor: '#1A202C', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 12,
  },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: h(16) },
  sectionTitle:    { fontSize: f(17), fontWeight: '800', letterSpacing: 0.2 },
  editBtn:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: w(14), paddingVertical: h(8), borderRadius: mw(14), gap: w(6) },
  editBtnText:     { fontSize: f(12), fontWeight: '800' },
  
  fieldRow:        { paddingVertical: h(12) },
  fieldRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#EDF2F7' },
  fieldLabel:      { fontSize: f(11), fontWeight: '800', color: '#A0AEC0', marginBottom: h(6), textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldVal:        { fontSize: f(15), color: '#2D3748', fontWeight: '700' },
  
  docRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: w(14), backgroundColor: '#F7FAFC', borderRadius: mw(16), marginBottom: h(12), borderWidth: 1, borderColor: '#EDF2F7' },
  docLabel:        { fontSize: f(14), fontWeight: '800', color: '#2D3748' },
  docStatus:       { fontSize: f(11), color: '#718096', marginTop: h(4), fontWeight: '600' },
  docActions:      { flexDirection: 'row', gap: w(8) },
  docBtn:          { flexDirection: 'row', alignItems: 'center', borderRadius: mw(10), paddingHorizontal: w(12), paddingVertical: h(8), gap: w(4) },
  docBtnText:      { fontSize: f(12), fontWeight: '800' },
  cancelBtn:       { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FC8181', paddingHorizontal: w(10) },
  logoutBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: mw(16), paddingVertical: h(16), backgroundColor: '#FFF5F5', gap: w(8), marginTop: h(8), borderWidth: 1, borderColor: '#FEB2B2', elevation: 4, shadowColor: '#E53E3E', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8 },
  logoutText:      { fontSize: f(17), fontWeight: '800', color: '#E53E3E', letterSpacing: 0.3 },
  
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'flex-end' },
  modalContainer:  { backgroundColor: COLORS.white, borderTopLeftRadius: mw(32), borderTopRightRadius: mw(32), overflow: 'hidden', maxHeight: '92%', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 20 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: w(24), paddingVertical: h(20), borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalTitle:      { fontSize: f(18), fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  closeBtn:        { padding: w(4), backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: mw(14) },
  modalBody:       { padding: w(24), paddingBottom: h(40) },
  row:             { flexDirection: 'row', justifyContent: 'space-between', marginBottom: h(18), gap: w(14) },
  flex1:           { flex: 1 },
  halfCol:         { flex: 1 },
  thirdCol:        { flex: 1 },
  fullCol:         { marginBottom: h(18) },
  fieldInput:      { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: mw(14), paddingHorizontal: w(16), height: h(48), fontSize: f(14), color: '#2D3748', backgroundColor: '#F7FAFC', fontWeight: '600' },
  disabledInput:   { backgroundColor: '#EDF2F7', color: '#A0AEC0', borderColor: '#E2E8F0' },
  genderPicker:    { flexDirection: 'row', flexWrap: 'wrap', gap: w(10), marginTop: h(8) },
  genderChip:      { borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F7FAFC', borderRadius: mw(14), paddingHorizontal: w(18), paddingVertical: h(10) },
  genderChipText:  { fontSize: f(13), color: '#4A5568', fontWeight: '700' },
  saveBtn:         { borderRadius: mw(16), paddingVertical: h(16), alignItems: 'center', marginTop: h(20), elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12,textAlign:"center" },
  saveBtnText:     { fontSize: f(16), fontWeight: '800', color: COLORS.white, letterSpacing: 0.5,textAlign:"center" },
  inputError:      { borderColor: '#FC8181', backgroundColor: '#FFF5F5' },
  errorText:       { fontSize: f(11), color: '#E53E3E', fontWeight: '700', marginTop: h(4), marginLeft: w(4) },

  // KYC Styles
  kycCard: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  kycHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(16),
  },
  kycTitleCol: {
    flex: 1,
    textAlign:"center",
  },
  kycSubtitle: {
    fontSize: f(11),
    color: '#718096',
    marginTop: h(2),
    fontWeight: '600',
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: w(10),
    paddingVertical: h(4),
    borderRadius: mw(12),
    gap: w(4),
  },
  kycBadgeText: {
    fontSize: f(11),
    fontWeight: '800',
  },
  kycVerifiedContainer: {
    backgroundColor: '#F7FAFC',
    borderRadius: mw(16),
    padding: w(14),
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  kycInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: w(12),
  },
  kycDetailCol: {
    minWidth: '45%',
  },
  kycDetailLabel: {
    fontSize: f(10),
    fontWeight: '800',
    color: '#A0AEC0',
    marginBottom: h(4),
  },
  kycDetailVal: {
    fontSize: f(14),
    fontWeight: '700',
    color: '#2D3748',
  },
  kycMatchText: {
    fontSize: f(11),
    color: '#4A5568',
    fontWeight: '600',
    marginTop: h(10),
    fontStyle: 'italic',
  },
  kycPendingContainer: {
    alignItems: 'center',
  },
  kycWarningText: {
    fontSize: f(13),
    color: '#718096',
    lineHeight: h(18),
    textAlign: 'center',
    marginBottom: h(16),
    fontWeight: '600',
  },
  kycBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mw(14),
    paddingVertical: h(12),
    paddingHorizontal: w(24),
    gap: w(8),
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  kycBtnText: {
    fontSize: f(15),
    fontWeight: '800',
    color: COLORS.white,
  },
  kycModalContainer: {
    borderTopLeftRadius: mw(32),
    borderTopRightRadius: mw(32),
    overflow: 'hidden',
    maxHeight: '92%',
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  modalSubTitleText: {
    fontSize: f(12),
    color: '#718096',
    marginTop: h(2),
    fontWeight: '600',
  },
  kycBadgeVerified: {
    backgroundColor: '#E6FFFA',
  },
  kycBadgeUnverified: {
    backgroundColor: '#FFF5F5',
  },
  kycBadgeTextVerified: {
    color: '#319795',
  },
  kycBadgeTextUnverified: {
    color: '#E53E3E',
  },
  kycSubmitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: w(8),
  },
  modalHandle: {
    width: w(44),
    height: h(5),
    backgroundColor: '#E2E8F0',
    borderRadius: mw(3),
    alignSelf: 'center',
    marginTop: h(10),
  },
  kycModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: w(24),
    paddingTop: h(16),
    paddingBottom: h(12),
    borderBottomWidth: 1,
    borderColor: '#EDF2F7',
  },
  kycModalTitle: {
    fontSize: f(20),
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: 0.2,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(49, 151, 149, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(49, 151, 149, 0.2)',
    borderRadius: mw(10),
    paddingVertical: h(8),
    paddingHorizontal: w(12),
    marginBottom: h(20),
    gap: w(6),
  },
  trustBadgeText: {
    fontSize: f(11),
    fontWeight: '800',
    color: '#234E52',
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: mw(14),
    paddingHorizontal: w(14),
    height: h(48),
    backgroundColor: '#F7FAFC',
  },
  inputIcon: {
    marginRight: w(10),
  },
  textInputStyle: {
    flex: 1,
    height: '100%',
    fontSize: f(14),
    color: '#2D3748',
    fontWeight: '600',
  },
  inputErrorContainer: {
    borderColor: '#FC8181',
    backgroundColor: '#FFF5F5',
  },
  termsNote: {
    fontSize: f(10),
    color: '#A0AEC0',
    textAlign: 'center',
    marginTop: h(20),
    lineHeight: h(14),
    fontWeight: '500',
  },
  safeContainer: {
    backgroundColor: '#F4F7FB',
    flex: 1,
  },
  profilePhoneWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    marginTop: h(4),
  },
  profilePhoneNoMargin: {
    fontSize: f(14),
    color: '#718096',
    fontWeight: '600',
    marginTop: 0,
  },
  sectionTitleDark: {
    fontSize: f(17),
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#1A202C',
  },
  sectionTitleDarkMargin: {
    fontSize: f(17),
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#1A202C',
    marginBottom: h(16),
  },
  kycMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    marginTop: h(10),
  },
  kycMatchTextNoMargin: {
    fontSize: f(11),
    color: '#4A5568',
    fontWeight: '600',
    marginTop: 0,
    fontStyle: 'italic',
  },
  kycWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: w(8),
    marginBottom: h(16),
  },
  kycWarningTextLeft: {
    fontSize: f(13),
    color: '#718096',
    lineHeight: h(18),
    textAlign: 'left',
    marginBottom: 0,
    fontWeight: '600',
    flex: 1,
  },
  docBtnGray: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: mw(10),
    paddingHorizontal: w(12),
    paddingVertical: h(8),
    gap: w(4),
    backgroundColor: '#EDF2F7',
  },
  docBtnTextGray: {
    fontSize: f(12),
    fontWeight: '800',
    color: '#4A5568',
  },
});
