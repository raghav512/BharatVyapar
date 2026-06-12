import userApi from './userApi';
import { showAlert } from '../../components/CustomAlertBox';
import {
  normalizeFileUri,
  pickDocumentOrImage,
  viewDocument,
} from '../../utils/documentUtils';
import { validateProfileForm, validateProfileField } from '../../utils/validation/profileValidation';
import COLORS from '../../constant/colors';

export const ROLE_THEMES = {
  FPO:       { primary: COLORS.fpoPrimary,       secondary: COLORS.fpoSecondary,       light: COLORS.fpoLight,       text: COLORS.fpoText },
  Trader:    { primary: COLORS.traderPrimary,    secondary: COLORS.traderSecondary,    light: COLORS.traderLight,    text: COLORS.traderText },
  Miller:    { primary: COLORS.millerPrimary,    secondary: COLORS.millerSecondary,    light: COLORS.millerLight,    text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

export const DOCUMENTS_CONFIG = [
  { label: 'Shop License',    type: 'shopLicense',    dataKey: 'shopLicense' },
  { label: 'GST Certificate', type: 'GSTCertificate', dataKey: 'gstCertificate' },
  { label: 'PAN Card',        type: 'PANCard',        dataKey: 'panCard' },
];

const normalizeGender = raw =>
  raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';

export const syncUserToDisplayData = user => ({
  firstName:      user?.firstName    || '',
  lastName:       user?.lastName     || '',
  shopName:       user?.shopName     || user?.shopname || '',
  gender:         normalizeGender(user?.gender),
  emailId:        user?.emailId      || user?.email || '',
  phone:          user?.phone        || '',
  village:        user?.village      || '',
  district:       user?.district     || '',
  state:          user?.state        || '',
  profileImage:   user?.profileImage || null,
  shopLicense:    user?.shopLicense  || null,
  gstCertificate: user?.GSTCertificate || user?.gstCertificate || null,
  panCard:        user?.PANCard      || user?.panCard          || null,
});

export const buildProfileFormData = modalForm => {
  const formData = new FormData();
  if (modalForm.firstName) formData.append('firstName', modalForm.firstName);
  if (modalForm.lastName)  formData.append('lastName',  modalForm.lastName);
  const trimmedShopName = (modalForm.shopName || '').trim();
  if (trimmedShopName) {
    formData.append('shopName',  trimmedShopName);
    formData.append('shopname',  trimmedShopName);
  }
  if (modalForm.gender)    formData.append('gender',    normalizeGender(modalForm.gender));
  if (modalForm.emailId) {
    formData.append('emailId',   modalForm.emailId);
    formData.append('email',     modalForm.emailId);
  }
  if (modalForm.village)   formData.append('village',   modalForm.village);
  if (modalForm.district)  formData.append('district',  modalForm.district);
  if (modalForm.state)     formData.append('state',     modalForm.state);
  return formData;
};

export const buildClientUpdatedUser = modalForm => ({
  firstName: modalForm.firstName,
  lastName:  modalForm.lastName,
  shopName:  modalForm.shopName?.trim(),
  shopname:  modalForm.shopName?.trim(),
  gender:    normalizeGender(modalForm.gender),
  emailId:   modalForm.emailId,
  email:     modalForm.emailId,
  village:   modalForm.village,
  district:  modalForm.district,
  state:     modalForm.state,
});

export const validateAndExtractErrors = modalForm => {
  const { isValid, errors } = validateProfileForm(modalForm);
  return { isValid, errors };
};

const findDocumentUrl = value => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findDocumentUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof value !== 'object') return null;

  for (const key of ['url', 'signedUrl', 'fileUrl', 'downloadUrl', 'location']) {
    if (typeof value[key] === 'string' && value[key]) return value[key];
  }

  for (const key of ['data', 'file', 'document', 'result']) {
    const url = findDocumentUrl(value[key]);
    if (url) return url;
  }
  return null;
};

export const viewDocumentByType = async (type, localUrl) => {
  try {
    if (localUrl) {
      await viewDocument(localUrl);
      return { success: true };
    }

    const res = await userApi.getPrivateFile({ type });
    const url = findDocumentUrl(res);
    if (url) {
      await viewDocument(url);
      return { success: true };
    }
    showAlert({ type: 'error', title: 'Not Available', message: 'Document not uploaded yet.', buttons: [{ text: 'OK' }] });
    return { success: false };
  } catch (err) {
    console.error('[viewDocumentByType]', err);
    showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch document.', buttons: [{ text: 'OK' }] });
    return { success: false, error: err };
  }
};

export const pickFileForUpload = async () => {
  console.log('📂 [PICK FILE] Opening picker...');
  const file = await pickDocumentOrImage();
  console.log('📂 [PICK FILE] Result:', file ? { uri: file.uri, name: file.name, type: file.type, size: file.size } : null);
  if (!file?.uri) return null;
  return file;
};

export const buildDocumentFormData = (type, file) => {
  console.log('📋 [BUILD DOC FORM] type:', type, '| file:', { uri: file.uri, name: file.name, type: file.type });
  const formData = new FormData();
  formData.append(type, {
    uri: normalizeFileUri(file.uri),
    name: file.name || `${type}_${Date.now()}`,
    type: file.type || 'application/octet-stream',
  });
  console.log('📋 [BUILD DOC FORM] FormData created for field:', type);
  return formData;
};

export { validateProfileField };
