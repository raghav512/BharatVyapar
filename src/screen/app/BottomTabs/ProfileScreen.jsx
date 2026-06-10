import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, mw, f } from '../../../utils/responsive';
import { logoutUser, getUserDetails, updateProfile } from '../../../store/authSlice';
import { showAlert } from '../../../components/CustomAlertBox';
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

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { user, selectedRole: stateRole, profileLoading } = useSelector(s => s.auth);

  const [displayData, setDisplayData]   = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalForm, setModalForm]       = useState({});
  const [fieldErrors, setFieldErrors]   = useState({});
  const [viewingDoc, setViewingDoc]     = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [documentPreviews, setDocumentPreviews] = useState({});
  const [uploadedDocuments, setUploadedDocuments] = useState({});
  const uploadAbortRef                  = useRef(null);

  useEffect(() => { dispatch(getUserDetails()); }, [dispatch]);

  const isMounted = useRef(true);
  useEffect(() => () => {
    isMounted.current = false;
    const uploadTask = uploadAbortRef.current;
    uploadTask?.promise?.abort();
  }, []);

  useEffect(() => {
    if (user) setDisplayData(syncUserToDisplayData(user));
  }, [user]);

  // ── handlers ──────────────────────────────────────────────
  const openEditModal = () => {
    setModalForm({ ...displayData });
    setFieldErrors({});
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const setField = (key, val) => {
    setModalForm(prev => ({ ...prev, [key]: val }));
    setFieldErrors(prev => ({ ...prev, [key]: validateProfileField(key, val) }));
  };

  const handleSave = async () => {
    if (profileLoading) return;

    const { isValid, errors } = validateAndExtractErrors(modalForm);
    if (!isValid) { setFieldErrors(errors); return; }

    const formData          = buildProfileFormData(modalForm);
    const clientUpdatedUser = buildClientUpdatedUser(modalForm);
    const result            = await dispatch(updateProfile({ formData, clientUpdatedUser }));

    if (!isMounted.current) return;

    if (updateProfile.fulfilled.match(result)) {
      closeModal();
      showAlert({ type: 'info', title: 'Profile Saved', message: 'Your profile has been updated successfully.', buttons: [{ text: 'Done' }] });
    } else {
      showAlert({ type: 'error', title: 'Update Failed', message: result.payload || 'Failed to update profile.', buttons: [{ text: 'OK' }] });
    }
  };

  const handleLogout = () => {
    showAlert({
      type: 'confirm', title: 'Logout', message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => dispatch(logoutUser()) },
      ],
    });
  };

  const handleViewDoc = async type => {
    setViewingDoc(type);
    await viewDocumentByType(type, documentPreviews[type]?.uri);
    setViewingDoc(null);
  };

  const handleCancelUpload = () => {
    const uploadTask = uploadAbortRef.current;
    if (uploadTask) {
      console.log('🚫 [UPLOAD DOC] Cancel requested by user');
      uploadTask.cancelled = true;
      uploadTask.promise?.abort();
      uploadAbortRef.current = null;
    }
    setDocumentPreviews(prev => {
      const next = { ...prev };
      delete next[uploadingDoc];
      return next;
    });
    setUploadingDoc(null);
  };

  const handleUploadDoc = async type => {
    const uploadTask = { type, cancelled: false, promise: null };
    uploadAbortRef.current = uploadTask;
    setUploadingDoc(type);
    try {
      const file = await pickFileForUpload();
      if (!file || uploadTask.cancelled) {
        console.log('⚠️ [UPLOAD DOC] No file selected or cancelled, aborting.');
        return;
      }

      setDocumentPreviews(prev => ({ ...prev, [type]: file }));
      console.log('🚀 [UPLOAD DOC] Dispatching updateProfile for type:', type);
      const formData = buildDocumentFormData(type, file);
      const uploadPromise = dispatch(updateProfile({ formData, clientUpdatedUser: {} }));
      uploadTask.promise = uploadPromise;
      const result = await uploadPromise;
      console.log('🔍 [UPLOAD DOC] Dispatch result:', JSON.stringify(result?.payload ?? result?.error));

      if (!isMounted.current || uploadTask.cancelled || result.meta?.aborted) return;

      if (updateProfile.fulfilled.match(result)) {
        console.log('🔄 [UPLOAD DOC] Refreshing user after upload...');
        await dispatch(getUserDetails());
        if (!isMounted.current || uploadTask.cancelled || result.meta?.aborted) return;
        setUploadedDocuments(prev => ({ ...prev, [type]: true }));
        setDocumentPreviews(prev => {
          const next = { ...prev };
          delete next[type];
          return next;
        });
        showAlert({ type: 'info', title: 'Uploaded', message: `${type} uploaded successfully.`, buttons: [{ text: 'OK' }] });
      } else if (!result.meta?.aborted && !result.payload?.cancelled) {
        showAlert({ type: 'error', title: 'Upload Failed', message: result.payload || 'Upload failed.', buttons: [{ text: 'OK' }] });
      }
    } finally {
      if (uploadAbortRef.current === uploadTask) {
        uploadAbortRef.current = null;
      }
      if (isMounted.current) {
        setUploadingDoc(current => current === type ? null : current);
      }
    }
  };

  // ── derived display variables ──────────────────────────────
  const selectedRole   = stateRole || user?.role || 'FPO';
  const theme          = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  const fullName       = `${displayData.firstName || ''} ${displayData.lastName || ''}`.trim() || '—';
  const avatarInitial  = displayData.firstName ? displayData.firstName[0].toUpperCase() : '?';
  const hasAvatar      = !!displayData.profileImage;
  const roleBadgeBg    = { backgroundColor: theme.primary + '15' };
  const editBtnBg      = { backgroundColor: theme.primary + '12' };
  const saveBtnLabel   = profileLoading ? 'Saving...' : 'Save Changes';
  const documents      = DOCUMENTS_CONFIG.map(d => ({ ...d, value: displayData[d.dataKey] }));

  // ── render ─────────────────────────────────────────────────
  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader backgroundColor={theme.primary} title="My Profile" subtitle="Manage your account & preferences" showBackButton={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Avatar Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            {hasAvatar
              ? <Image source={{ uri: displayData.profileImage }} style={styles.avatarImage} />
              : <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarText}>{avatarInitial}</Text>
                </View>
            }
          </View>
          <Text style={styles.profileName}>{fullName}</Text>
          <Text style={styles.profilePhone}>📞 +91 {displayData.phone}</Text>
          <View style={[styles.roleBadge, roleBadgeBg]}>
            <Text style={[styles.roleBadgeText, { color: theme.primary }]}>Role: {selectedRole}</Text>
          </View>
        </View>

        {/* Profile Details Card */}
        <View style={styles.fieldsCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>Profile Details</Text>
            <TouchableOpacity onPress={openEditModal} style={[styles.editBtn, editBtnBg]}>
              <Icon name="pencil" size={16} color={theme.primary} />
              <Text style={[styles.editBtnText, { color: theme.primary }]}>Edit</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.primary, marginBottom: h(12) }]}>Documents & KYC</Text>
          {documents.map(doc => {
            const isViewing   = viewingDoc === doc.type;
            const isUploading = uploadingDoc === doc.type;
            const canViewDocument = !!doc.value || !!uploadedDocuments[doc.type] || !!documentPreviews[doc.type];
            const uploadIcon  = canViewDocument ? 'swap-horizontal' : 'upload';
            const uploadLabel = isUploading ? '...' : canViewDocument ? 'Replace' : 'Upload';
            const uploadBg    = { borderColor: theme.primary, backgroundColor: theme.primary + '12' };

            return (
              <View style={styles.docRow} key={doc.type}>
                <View style={styles.flex1}>
                  <Text style={styles.docLabel}>{doc.label}</Text>
                  <Text style={styles.docStatus}>{documentPreviews[doc.type] ? isUploading ? 'Selected, uploading...' : 'Selected (not uploaded)' : doc.value ? '✅ Uploaded' : '❌ Not Uploaded'}</Text>
                </View>
                <View style={styles.docActions}>
                  {canViewDocument && (
                    <TouchableOpacity onPress={() => handleViewDoc(doc.type)} disabled={isViewing} style={[styles.docBtn, { borderColor: theme.primary }]}>
                      <Icon name="eye" size={13} color={theme.primary} />
                      <Text style={[styles.docBtnText, { color: theme.primary }]}>{isViewing ? '...' : 'View'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleUploadDoc(doc.type)} disabled={!!uploadingDoc} style={[styles.docBtn, uploadBg]}>
                    <Icon name={uploadIcon} size={13} color={theme.primary} />
                    <Text style={[styles.docBtnText, { color: theme.primary }]}>{uploadLabel}</Text>
                  </TouchableOpacity>
                  {isUploading && (
                    <TouchableOpacity onPress={handleCancelUpload} style={[styles.docBtn, styles.cancelBtn]}>
                      <Icon name="close" size={13} color="#E53E3E" />
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: theme.primary }]} onPress={handleLogout} activeOpacity={0.8}>
          <Icon name="logout" size={20} color={theme.primary} />
          <Text style={[styles.logoutText, { color: theme.primary }]}>Logout Session</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContainer}>

            <View style={[styles.modalHeader, { backgroundColor: theme.primary }]}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={closeModal}>
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
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.genderPicker}>
                  {GENDER_OPTIONS.map(g => {
                    const isSelected  = modalForm.gender?.toLowerCase() === g.toLowerCase();
                    const chipStyle   = isSelected ? { backgroundColor: theme.primary, borderColor: theme.primary } : null;
                    const chipTxtStyle = isSelected ? { color: COLORS.white } : null;
                    return (
                      <TouchableOpacity key={g} onPress={() => setField('gender', g)} style={[styles.genderChip, chipStyle]}>
                        <Text style={[styles.genderChipText, chipTxtStyle]}>{g}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {fieldErrors.gender && <Text style={styles.errorText}>{fieldErrors.gender}</Text>}
              </View>

              {/* Phone & Email row */}
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput style={[styles.fieldInput, styles.disabledInput]} value={modalForm.phone} editable={false} placeholderTextColor={COLORS.textMuted} />
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

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleSave} disabled={profileLoading} activeOpacity={0.85}>
                <Text style={styles.saveBtnText}>{saveBtnLabel}</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeScreen>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────

function FieldRow({ label, value, last }) {
  return (
    <View style={[styles.fieldRow, !last && styles.fieldRowBorder]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldVal}>{value || '—'}</Text>
    </View>
  );
}

function FormField({ label, fieldKey, form, errors, onChangeText, placeholder, keyboardType, autoCapitalize }) {
  const hasError    = !!errors[fieldKey];
  const inputStyle  = [styles.fieldInput, hasError && styles.inputError];
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={inputStyle}
        value={form[fieldKey]}
        onChangeText={v => onChangeText(fieldKey, v)}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
      {hasError && <Text style={styles.errorText}>{errors[fieldKey]}</Text>}
    </>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { padding: w(16), paddingBottom: h(30) },
  profileCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: w(20),
    alignItems: 'center', marginBottom: h(16), elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
  },
  avatarWrapper:  { position: 'relative', marginBottom: h(12) },
  avatarCircle:   { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarImage:    { width: 72, height: 72, borderRadius: 36 },
  avatarText:     { fontSize: f(26), color: COLORS.white, fontWeight: '800' },
  profileName:    { fontSize: f(16), fontWeight: '700', color: COLORS.text },
  profilePhone:   { fontSize: f(12), color: COLORS.textMuted, marginTop: h(2) },
  roleBadge:      { marginTop: h(10), paddingHorizontal: w(12), paddingVertical: h(4), borderRadius: 12 },
  roleBadgeText:  { fontWeight: '700', fontSize: f(12) },
  fieldsCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: w(16),
    marginBottom: h(16), elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
  },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: h(14) },
  sectionTitle:    { fontSize: f(15), fontWeight: '800' },
  editBtn:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: w(12), paddingVertical: h(6), borderRadius: mw(12), gap: w(4) },
  editBtnText:     { fontSize: f(11), fontWeight: '700' },
  fieldRow:        { paddingVertical: h(10) },
  fieldRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  fieldLabel:      { fontSize: f(10), fontWeight: '700', color: COLORS.textLight, marginBottom: h(2) },
  fieldVal:        { fontSize: f(13), color: COLORS.text, fontWeight: '600' },
  docRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: h(10), borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  docLabel:        { fontSize: f(12), fontWeight: '700', color: COLORS.text },
  docStatus:       { fontSize: f(11), color: COLORS.textMuted, marginTop: h(2) },
  docActions:      { flexDirection: 'row', gap: w(6) },
  docBtn:          { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: mw(8), paddingHorizontal: w(8), paddingVertical: h(5), gap: w(3) },
  docBtnText:      { fontSize: f(10), fontWeight: '700' },
  cancelBtn:       { borderColor: '#E53E3E', backgroundColor: '#FFF5F5' },
  cancelBtnText:   { fontSize: f(10), fontWeight: '700', color: '#E53E3E' },
  logoutBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: h(14), backgroundColor: COLORS.white, gap: w(8), marginTop: h(10) },
  logoutText:      { fontSize: f(14), fontWeight: '700' },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContainer:  { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', maxHeight: '90%' },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: w(16), paddingVertical: h(14) },
  modalTitle:      { fontSize: f(16), fontWeight: '800', color: COLORS.white },
  modalBody:       { padding: w(16), paddingBottom: h(30) },
  row:             { flexDirection: 'row', justifyContent: 'space-between', marginBottom: h(14), gap: w(10) },
  flex1:           { flex: 1 },
  halfCol:         { flex: 1 },
  thirdCol:        { flex: 1 },
  fullCol:         { marginBottom: h(14) },
  fieldInput:      { borderWidth: 1.5, borderColor: '#E9ECEF', borderRadius: mw(8), paddingHorizontal: w(10), height: h(40), fontSize: f(13), color: COLORS.text, backgroundColor: '#F8F9FA' },
  disabledInput:   { backgroundColor: '#E9ECEF', color: COLORS.textMuted },
  genderPicker:    { flexDirection: 'row', gap: w(8), marginTop: h(2) },
  genderChip:      { borderWidth: 1.5, borderColor: '#E9ECEF', borderRadius: mw(8), paddingHorizontal: w(12), paddingVertical: h(6) },
  genderChipText:  { fontSize: f(12), color: COLORS.textLight, fontWeight: '600' },
  saveBtn:         { borderRadius: 12, paddingVertical: h(14), alignItems: 'center', marginTop: h(8) },
  saveBtnText:     { fontSize: f(14), fontWeight: '800', color: COLORS.white },
  inputError:      { borderColor: '#E53E3E', backgroundColor: '#FFF5F5' },
  errorText:       { fontSize: f(9), color: '#E53E3E', fontWeight: '600', marginTop: h(3) },
});
