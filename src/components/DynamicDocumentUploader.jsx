import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import DocumentPicker from '@react-native-documents/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Dynamic Document Uploader
 * Renders an upload card for each document type passed in the `docs` array.
 * @param {Array<string>} docs - e.g. ['PURCHASE_ORDER'] or ['E-Invoice', 'Kata Parchi', 'E-Way Bill']
 * @param {Function} onUpload - (docType, file) => Promise<void>
 * @param {Function} onAllUploaded - (allUploaded: boolean) => void
 */
export default function DynamicDocumentUploader({ docs = [], onUpload, onAllUploaded }) {
  const [uploadState, setUploadState] = useState(
    docs.reduce((acc, doc) => ({ ...acc, [doc]: { file: null, uploading: false, uploaded: false } }), {})
  );

  const handlePickDocument = async (docType) => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
      });
      
      setUploadState(prev => ({
        ...prev,
        [docType]: { ...prev[docType], uploading: true }
      }));

      // Call the service to upload the doc
      if (onUpload) {
        await onUpload(docType, res);
      }

      setUploadState(prev => {
        const newState = {
          ...prev,
          [docType]: { file: res, uploading: false, uploaded: true }
        };
        // Check if all are uploaded
        const allDone = Object.values(newState).every(v => v.uploaded);
        if (onAllUploaded) onAllUploaded(allDone);
        return newState;
      });

    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // user cancelled
      } else {
        console.error(err);
        setUploadState(prev => ({
          ...prev,
          [docType]: { ...prev[docType], uploading: false }
        }));
      }
    }
  };

  return (
    <View style={styles.container}>
      {docs.map((docType) => {
        const state = uploadState[docType];
        return (
          <View key={docType} style={styles.card}>
            <View style={styles.infoContainer}>
              <Text style={styles.docTitle}>{docType}</Text>
              {state.uploaded && <Text style={styles.successText}>Uploaded: {state.file?.name}</Text>}
            </View>
            
            <TouchableOpacity 
              style={[styles.uploadButton, state.uploaded && styles.uploadedButton]} 
              onPress={() => handlePickDocument(docType)}
              disabled={state.uploading || state.uploaded}
            >
              {state.uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : state.uploaded ? (
                <Icon name="check-circle" size={20} color="#fff" />
              ) : (
                <>
                  <Icon name="cloud-upload" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Upload</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoContainer: {
    flex: 1,
    marginRight: 10,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  successText: {
    fontSize: 12,
    color: 'green',
    marginTop: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  uploadedButton: {
    backgroundColor: 'green',
  },
  buttonText: {
    color: '#fff',
    marginLeft: 5,
    fontWeight: '500',
  }
});
