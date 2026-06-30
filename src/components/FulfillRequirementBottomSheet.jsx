import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

export default function FulfillRequirementBottomSheet({ visible, requirement, onClose, onSubmit }) {
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (requirement) {
      setQuantity(String(requirement.quantity || ''));
      setPrice(String(requirement.targetPrice || ''));
    }
  }, [requirement]);

  const handleSubmit = async () => {
    if (!quantity || !price) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({ 
        requirementId: requirement?.id || requirement?._id,
        offeredQuantity: Number(quantity), 
        offeredPrice: Number(price), 
        notes 
      });
      setQuantity('');
      setPrice('');
      setNotes('');
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
            <Text style={styles.title}>Submit Quote / Bid</Text>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          {requirement && (
            <View style={styles.reqSummary}>
              <Text style={styles.reqCommodity}>{requirement.commodity}</Text>
              <Text style={styles.reqDetail}>Target: ₹{requirement.targetPrice} | Qty: {requirement.quantity} Qt</Text>
            </View>
          )}

          <Text style={styles.label}>Quantity you can supply (Qt)</Text>
          <TextInput
            style={styles.input}
            placeholder="Quantity (in Quintals)"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Your Quoted Price (₹ per Qt)</Text>
          <TextInput
            style={styles.input}
            placeholder="Price"
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Logistics / Delivery Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g., Available next week, can arrange transport"
            value={notes}
            onChangeText={setNotes}
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity 
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit Quote</Text>
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
    marginBottom: 15,
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
  reqSummary: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  reqCommodity: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  reqDetail: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
