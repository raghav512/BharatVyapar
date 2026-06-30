import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

export default function RequirementBottomSheet({ visible, onClose, onSubmit }) {
  const [commodity, setCommodity] = useState('');
  const [quantity, setQuantity] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!commodity || !quantity || !targetPrice || !location) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({ commodity, quantity: Number(quantity), targetPrice: Number(targetPrice), location });
      setCommodity('');
      setQuantity('');
      setTargetPrice('');
      setLocation('');
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Post New Requirement</Text>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Commodity (e.g. Wheat, Rice)"
            value={commodity}
            onChangeText={setCommodity}
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.input}
            placeholder="Quantity (in Quintals)"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.input}
            placeholder="Target Price (per Quintal)"
            keyboardType="numeric"
            value={targetPrice}
            onChangeText={setTargetPrice}
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.input}
            placeholder="Delivery Location"
            value={location}
            onChangeText={setLocation}
            placeholderTextColor="#999"
          />

          <TouchableOpacity 
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit Requirement</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeText: {
    color: '#007bff',
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#999',
  },
  submitText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
