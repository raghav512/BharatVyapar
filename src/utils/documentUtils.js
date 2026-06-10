// Utility: document/image pick, permission and view helpers — production level
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { pick, types, isCancel } from '@react-native-documents/picker';
import {
  Alert,
  Linking,
  Platform,
  PermissionsAndroid,
} from 'react-native';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const IMAGE_OPTIONS = {
  mediaType: 'photo',
  quality: 0.8,
  includeBase64: false,
  presentationStyle: 'pageSheet',
};

// ─── Permission Helpers ───────────────────────────────────────────────────────

const requestCameraPermission = async () => {
  if (Platform.OS !== 'android') return true;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'App needs access to your camera to capture documents.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Deny',
        buttonPositive: 'Allow',
      },
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;

    if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      Alert.alert(
        'Camera Permission Denied',
        'Please enable camera permission from app settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
    return false;
  } catch {
    return false;
  }
};

const requestStoragePermission = async () => {
  if (Platform.OS !== 'android') return true;

  try {
    // Android 13+ uses granular media permissions
    if (Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        {
          title: 'Storage Permission',
          message: 'App needs access to your gallery to upload documents.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs access to your storage to upload documents.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;
    }

    Alert.alert(
      'Storage Permission Denied',
      'Please enable storage permission from app settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  } catch {
    return false;
  }
};

// ─── File Validation ──────────────────────────────────────────────────────────

const validateFile = file => {
  if (!file) return null;
  if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
    Alert.alert(
      'File Too Large',
      `Max allowed size is ${MAX_FILE_SIZE_MB}MB. Please choose a smaller file.`,
      [{ text: 'OK' }],
    );
    return null;
  }
  return file;
};

// ─── Pickers ─────────────────────────────────────────────────────────────────

const pickFromGallery = async () => {
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) return null;

  return new Promise(resolve => {
    launchImageLibrary(IMAGE_OPTIONS, response => {
      if (response.didCancel) { resolve(null); return; }

      if (response.errorCode) {
        Alert.alert('Gallery Error', response.errorMessage || 'Failed to open gallery.');
        resolve(null);
        return;
      }

      const asset = response.assets?.[0];
      if (!asset?.uri) { resolve(null); return; }

      resolve(validateFile({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        size: asset.fileSize,
      }));
    });
  });
};

const pickFromCamera = async () => {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  return new Promise(resolve => {
    launchCamera(IMAGE_OPTIONS, response => {
      if (response.didCancel) { resolve(null); return; }

      if (response.errorCode) {
        if (response.errorCode === 'camera_unavailable') {
          Alert.alert('Camera Unavailable', 'No camera found on this device.');
        } else {
          Alert.alert('Camera Error', response.errorMessage || 'Failed to open camera.');
        }
        resolve(null);
        return;
      }

      const asset = response.assets?.[0];
      if (!asset?.uri) { resolve(null); return; }

      resolve(validateFile({
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        size: asset.fileSize,
      }));
    });
  });
};

const pickDocument = async () => {
  try {
    const result = await pick({
      type: [types.pdf, types.images],
      copyTo: 'cachesDirectory',
    });

    if (!result || result.length === 0) return null;
    const doc = result[0];

    return validateFile({
      uri: doc.fileCopyUri || doc.uri,
      name: doc.name || `doc_${Date.now()}`,
      type: doc.type || 'application/pdf',
      size: doc.size,
    });
  } catch (err) {
    if (isCancel(err)) return null;
    Alert.alert('Document Error', 'Failed to pick document. Try again.');
    return null;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

// Shows action sheet and returns picked file { uri, name, type, size } or null
export const pickDocumentOrImage = () =>
  new Promise(resolve => {
    Alert.alert(
      'Upload Document',
      'Choose source',
      [
        { text: '📷 Camera', onPress: () => pickFromCamera().then(resolve) },
        { text: '🖼️ Gallery', onPress: () => pickFromGallery().then(resolve) },
        { text: '📄 Document (PDF)', onPress: () => pickDocument().then(resolve) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });

// Normalize URI for FormData (Android content:// URIs need no change, iOS file:// fine as-is)
export const normalizeFileUri = uri => {
  if (!uri) return uri;
  if (Platform.OS === 'ios') return uri.replace('file://', '');
  return uri;
};

// Open a URL for viewing — handles http, https, file URIs
export const viewDocument = async url => {
  if (!url) {
    Alert.alert('Not Available', 'Document URL is not available.');
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        'Cannot Open',
        'No app found to open this document. Please install a PDF viewer.',
        [{ text: 'OK' }],
      );
    }
  } catch {
    Alert.alert('Error', 'Failed to open document.');
  }
};
