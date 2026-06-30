import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import COLORS from '../../../../../constant/colors';
import { w, h, f } from '../../../../../utils/responsive';
import { useTranslation } from '../../../../../hook/useTranslation';

export default function PlaceBuyOfferModal({
  visible,
  onClose,
  theme,
  item,
  offerPrice,
  setOfferPrice,
  offerQty,
  setOfferQty,
  deliveryType,
  setDeliveryType,
  paymentTimeline,
  setPaymentTimeline,
  remarks,
  setRemarks,
  submittingOffer,
  handlePlaceOffer,
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('Place Buy Offer')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
            <Text style={styles.modalSubtitle}>
              {t('Offer terms for {commodity} - Grade {grade} ({seller})')
                .replace('{commodity}', item.commodityName)
                .replace('{grade}', item.grade)
                .replace('{seller}', item.sellerName)}
            </Text>

            {/* Price & Quantity input */}
            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Text style={styles.inputLabel}>{t('Offer Price (₹/{unit})').replace('{unit}', item.sellingPriceUnit)}</Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    item.isNegotiable === false && { backgroundColor: '#E2E8F0', color: COLORS.textMuted }
                  ]}
                  keyboardType="numeric"
                  value={item.isNegotiable === false ? String(item.sellingPrice) : offerPrice}
                  onChangeText={setOfferPrice}
                  placeholder={t('e.g. 2400')}
                  editable={item.isNegotiable !== false}
                />
                <Text style={styles.hintText}>
                  {item.isNegotiable === false 
                    ? t('Price is fixed by seller') 
                    : t('Seller asks ₹{price}').replace('{price}', String(item.sellingPrice))}
                </Text>
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.inputLabel}>{t('Quantity ({unit})').replace('{unit}', item.unit)}</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={offerQty}
                  onChangeText={setOfferQty}
                  placeholder={t('e.g. 50')}
                />
                <Text style={styles.hintText}>
                  {t('Available: {qty} {unit}')
                    .replace('{qty}', String(item.quantity))
                    .replace('{unit}', item.unit)}
                </Text>
              </View>
            </View>

            {/* Delivery Type preference */}
            <Text style={styles.inputLabel}>{t('Preferred Delivery Type')}</Text>
            <View style={styles.pickerRow}>
              {['FOR', 'EX-Warehouse'].map((dt) => (
                <TouchableOpacity
                  key={dt}
                  onPress={() => setDeliveryType(dt)}
                  style={[styles.pickerChip, deliveryType === dt && { backgroundColor: theme.primary }]}
                >
                  <Text style={[styles.pickerChipText, deliveryType === dt && { color: COLORS.white }]}>
                    {dt === 'FOR' ? t('FOR (Freight Free)') : t('Ex-Warehouse')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Proposed Payment timeline Preference */}
            <Text style={styles.inputLabel}>{t('Proposed Payment Timeline')}</Text>
            <TextInput
              style={styles.modalInput}
              value={paymentTimeline}
              onChangeText={setPaymentTimeline}
              placeholder={t('e.g. On delivery confirmation')}
            />

            {/* Remarks */}
            <Text style={styles.inputLabel}>{t('Remarks / Custom Clauses')}</Text>
            <TextInput
              style={[styles.modalInput, styles.remarksInput]}
              multiline
              value={remarks}
              onChangeText={setRemarks}
              placeholder={t('e.g. Request immediate loading, jute bags packing...')}
            />

            <View style={[styles.escrowNotice, { backgroundColor: theme.primary + '0A' }]}>
              <Icon name="shield-check-outline" size={20} color={theme.primary} />
              <Text style={[styles.escrowNoticeText, { color: theme.text }]}>
                {t('This offer will initiate a secure negotiation. On acceptance, funds will be deposited in a secure partner escrow account.')}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={onClose}
                disabled={submittingOffer}
              >
                <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handlePlaceOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.submitBtnText}>{t('Submit Offer')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: w(20),
    paddingTop: h(16),
    paddingBottom: h(20),
    maxHeight: h(540),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
    paddingBottom: h(12),
    marginBottom: h(10),
  },
  modalTitle: {
    fontSize: f(16),
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: f(12),
    color: COLORS.textMuted,
    marginBottom: h(12),
  },
  modalScroll: {
    paddingBottom: h(10),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: w(10),
    marginBottom: h(12),
  },
  halfCol: {
    flex: 1,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    paddingHorizontal: w(10),
    height: h(38),
    fontSize: f(13),
    color: COLORS.text,
    backgroundColor: '#F8F9FA',
    marginTop: h(4),
  },
  hintText: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginTop: h(2),
  },
  pickerRow: {
    flexDirection: 'row',
    gap: w(6),
    marginTop: h(4),
    marginBottom: h(12),
  },
  pickerChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    paddingVertical: h(10),
    paddingHorizontal: w(12),
    backgroundColor: '#F8F9FA',
  },
  pickerChipText: {
    fontSize: f(11),
    fontWeight: '600',
    color: COLORS.textLight,
  },
  escrowNotice: {
    flexDirection: 'row',
    padding: w(10),
    borderRadius: 8,
    alignItems: 'center',
    gap: w(8),
    marginBottom: h(16),
  },
  escrowNoticeText: {
    fontSize: f(11),
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: w(10),
  },
  modalBtn: {
    flex: 1,
    paddingVertical: h(14),
    paddingHorizontal: w(16),
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    backgroundColor: COLORS.white,
  },
  cancelBtnText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: f(13),
  },
  submitBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(13),
  },
  inputLabel: {
    fontSize: f(11),
    fontWeight: '700',
    color: COLORS.textLight,
    marginTop: h(6),
  },
  remarksInput: {
    height: h(60),
    textAlignVertical: 'top',
  },
});
