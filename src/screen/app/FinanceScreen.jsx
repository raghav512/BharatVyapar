import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import COLORS from '../../constant/colors';
import { w, h, mw, f } from '../../utils/responsive';
import { showAlert } from '../../components/CustomAlertBox';
import { SafeScreen } from '../../components/SafeScreen';
import { selectUser } from '../../store/authSelectors';
import { useTranslation } from '../../hook/useTranslation';

const LENDING_PARTNERS = [
  { name: 'State Bank of India', rate: '8.40% p.a.', processing: '0.5%' },
  { name: 'HDFC Bank', rate: '8.75% p.a.', processing: '0.4%' },
  { name: 'ICICI Bank', rate: '8.90% p.a.', processing: '0.25%' },
  { name: 'Bank of Baroda', rate: '8.50% p.a.', processing: '0.5%' },
];

const ACTIVE_LOANS = [
  {
    id: 'LN-98243',
    commodity: 'Soybean',
    quantity: '60 MT',
    warehouse: 'Indore Agri Hub',
    loanAmount: '₹14,50,000',
    interestRate: '8.5%',
    dueDate: '15 Nov 2026',
    status: 'Active',
  },
  {
    id: 'LN-95041',
    commodity: 'Wheat',
    quantity: '100 MT',
    warehouse: 'Jaipur Complex',
    loanAmount: '₹17,00,000',
    interestRate: '8.4%',
    dueDate: '20 Dec 2026',
    status: 'In Verification',
  },
];

export default function FinanceScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // PERFORMANCE FIX: Single granular selector — FinanceScreen only needs user.role
  // for theming. Subscribing to the entire auth slice caused re-renders from
  // unrelated auth actions (profileLoading, sendOtpError, etc.).
  const user = useSelector(selectUser);
  const selectedRole = user?.role || 'FPO';
  const roleColor = {
    FPO: COLORS.fpoPrimary,
    Trader: COLORS.traderPrimary,
    Miller: COLORS.millerPrimary,
    Corporate: COLORS.corporatePrimary,
  }[selectedRole] || COLORS.fpoPrimary;

  const [loanModalVisible, setLoanModalVisible] = useState(false);
  const [calcCommodity, setCalcCommodity] = useState('Wheat');
  const [calcQuantity, setCalcQuantity] = useState('');
  const [calcPrice, setCalcPrice] = useState('');
  
  // Apply loan form
  const [applyWhReceipt, setApplyWhReceipt] = useState('');
  const [applyQty, setApplyQty] = useState('');
  const [applyPartner, setApplyPartner] = useState(LENDING_PARTNERS[0].name);

  // Simple LTV calculator
  const quantityNum = parseFloat(calcQuantity) || 0;
  const priceNum = parseFloat(calcPrice) || 0;
  // LTV is 70%
  const estimatedMarketValue = quantityNum * 10 * priceNum; // assuming MT to Quintal multiplication (1 MT = 10 Quintal)
  const maxLoanAmount = estimatedMarketValue * 0.7;

  const submitLoanApplication = () => {
    if (!applyWhReceipt || !applyQty) {
      Alert.alert(t('Error'), t('Please fill all required details'));
      return;
    }
    setLoanModalVisible(false);

    showAlert({
      type: 'info',
      title: t('Application Received!'),
      message: t("Your Warehouse Receipt Loan application of {quantity} MT at {warehouse} has been submitted to {partner}. Status will update within 24 hours.")
        .replace('{quantity}', applyQty)
        .replace('{warehouse}', applyWhReceipt)
        .replace('{partner}', applyPartner),
      buttons: [{ text: t('Great'), style: 'default' }],
    });

    setApplyWhReceipt('');
    setApplyQty('');
  };

  return (
    <SafeScreen style={styles.container} top={false} bottom={true}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: roleColor, paddingTop: insets.top + h(10) }]}>
        <Text style={styles.headerTitle}>{t('Finance & Loans')}</Text>
        <Text style={styles.headerSubtitle}>{t('Instant warehouse receipt financing at lowest rates')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Loan Calculator */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="calculator-variant" size={22} color={roleColor} />
            <Text style={styles.sectionTitle}>{t('Loan Eligibility Calculator')}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>{t('Check instant LTV based eligibility (Up to 70%)')}</Text>

          <Text style={styles.inputLabel}>{t('Commodity *')}</Text>
          <TextInput
            style={styles.calcInput}
            placeholder={t('e.g. Wheat')}
            placeholderTextColor={COLORS.textMuted}
            value={calcCommodity}
            onChangeText={setCalcCommodity}
          />

          <View style={styles.rowInputs}>
            <View style={{ flex: 1, marginRight: w(8) }}>
              <Text style={styles.inputLabel}>{t('Quantity (MT) *')}</Text>
              <TextInput
                style={styles.calcInput}
                keyboardType="numeric"
                placeholder={t('e.g. 50')}
                placeholderTextColor={COLORS.textMuted}
                value={calcQuantity}
                onChangeText={setCalcQuantity}
              />
            </View>
            <View style={{ flex: 1, marginLeft: w(8) }}>
              <Text style={styles.inputLabel}>{t('Market Price (₹/Qtl) *')}</Text>
              <TextInput
                style={styles.calcInput}
                keyboardType="numeric"
                placeholder={t('e.g. 2400')}
                placeholderTextColor={COLORS.textMuted}
                value={calcPrice}
                onChangeText={setCalcPrice}
              />
            </View>
          </View>

          {quantityNum > 0 && priceNum > 0 && (
            <View style={[styles.calcResultsBox, { borderLeftColor: roleColor }]}>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>{t('Est. Market Value')}</Text>
                <Text style={styles.resultValue}>₹{estimatedMarketValue.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>{t('Max Eligible Loan (70% LTV)')}</Text>
                <Text style={[styles.resultValue, { color: COLORS.success, fontSize: f(18) }]}>
                  ₹{maxLoanAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setLoanModalVisible(true)}
            style={[styles.applyButton, { backgroundColor: roleColor }]}
          >
            <Text style={styles.applyButtonText}>{t('Apply for Loan Now')}</Text>
          </TouchableOpacity>
        </View>

        {/* Active Loans */}
        <Text style={styles.listHeading}>{t('Active Finance Ledger')}</Text>
        {ACTIVE_LOANS.map(loan => {
          const isActive = loan.status === 'Active';
          return (
            <View key={loan.id} style={styles.loanCard}>
              <View style={styles.loanHeader}>
                <View>
                  <Text style={styles.loanId}>{loan.id}</Text>
                  <Text style={styles.loanDesc}>
                    {t(loan.commodity)} ({t(loan.quantity)}) at {t(loan.warehouse)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isActive ? '#E6F4EA' : '#FEF3C7' }]}>
                  <Text style={[styles.statusText, { color: isActive ? '#137333' : '#D97706' }]}>
                    {t(loan.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.loanDetailsGrid}>
                <View style={styles.loanDetailItem}>
                  <Text style={styles.loanDetailLabel}>{t('Amount')}</Text>
                  <Text style={[styles.loanDetailVal, { color: roleColor }]}>{loan.loanAmount}</Text>
                </View>
                <View style={styles.loanDetailItem}>
                  <Text style={styles.loanDetailLabel}>{t('Interest Rate')}</Text>
                  <Text style={styles.loanDetailVal}>{loan.interestRate} {t('p.a.')}</Text>
                </View>
                <View style={styles.loanDetailItem}>
                  <Text style={styles.loanDetailLabel}>{t('Due Date')}</Text>
                  <Text style={styles.loanDetailVal}>{loan.dueDate}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Lending Partners */}
        <Text style={styles.listHeading}>{t('Lending Banking Partners')}</Text>
        <View style={styles.partnerList}>
          {LENDING_PARTNERS.map((partner, index) => (
            <View key={index} style={styles.partnerCard}>
              <View style={styles.partnerLogoPlaceholder}>
                <Icon name="bank" size={24} color={roleColor} />
              </View>
              <View style={{ flex: 1, marginLeft: w(12) }}>
                <Text style={styles.partnerName}>{t(partner.name)}</Text>
                <Text style={styles.partnerDetails}>
                  {t("Rate: {rate} | Processing Fee: {processing}")
                    .replace('{rate}', partner.rate)
                    .replace('{processing}', partner.processing)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Apply Loan Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={loanModalVisible}
        onRequestClose={() => setLoanModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Apply for Commodity Loan')}</Text>
              <TouchableOpacity onPress={() => setLoanModalVisible(false)}>
                <Icon name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>{t('Warehouse Receipt ID / Lot Number *')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('e.g. WHR-849302')}
              placeholderTextColor={COLORS.textMuted}
              value={applyWhReceipt}
              onChangeText={setApplyWhReceipt}
            />

            <Text style={styles.inputLabel}>{t('Lot Quantity (MT) *')}</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder={t('e.g. 60')}
              placeholderTextColor={COLORS.textMuted}
              value={applyQty}
              onChangeText={setApplyQty}
            />

            <Text style={styles.inputLabel}>{t('Preferred Banking Partner *')}</Text>
            <View style={styles.partnerPicker}>
              {LENDING_PARTNERS.map(p => {
                const isSelected = applyPartner === p.name;
                return (
                  <TouchableOpacity
                    key={p.name}
                    onPress={() => setApplyPartner(p.name)}
                    style={[
                      styles.pickerOption,
                      isSelected && { borderColor: roleColor, backgroundColor: roleColor + '08' },
                    ]}
                  >
                    <Text style={[styles.pickerText, isSelected && { color: roleColor, fontWeight: '700' }]}>
                      {t(p.name)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={submitLoanApplication}
              style={[styles.submitButton, { backgroundColor: roleColor }]}
            >
              <Text style={styles.submitButtonText}>{t('Submit Loan Application')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingVertical: h(20),
    paddingHorizontal: w(20),
    borderBottomLeftRadius: mw(24),
    borderBottomRightRadius: mw(24),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerTitle: {
    fontSize: f(22),
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: f(12),
    color: COLORS.white + 'CC',
    marginTop: h(4),
  },
  scrollContent: {
    paddingHorizontal: w(20),
    paddingBottom: h(40),
    paddingTop: h(16),
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: mw(16),
    padding: mw(16),
    marginBottom: h(20),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(6),
  },
  sectionTitle: {
    fontSize: f(16),
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginTop: h(2),
    marginBottom: h(10),
  },
  inputLabel: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: h(6),
    marginTop: h(12),
  },
  calcInput: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: mw(10),
    paddingHorizontal: w(12),
    height: h(44),
    fontSize: f(14),
    color: COLORS.text,
    backgroundColor: '#F8F9FA',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calcResultsBox: {
    backgroundColor: '#F8F9FA',
    borderLeftWidth: 4,
    borderRadius: mw(8),
    padding: mw(12),
    marginTop: h(16),
    gap: h(8),
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: f(12),
    color: COLORS.textLight,
  },
  resultValue: {
    fontSize: f(15),
    fontWeight: '800',
    color: COLORS.text,
  },
  applyButton: {
    paddingVertical: h(12),
    borderRadius: mw(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(16),
  },
  applyButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(14),
  },
  listHeading: {
    fontSize: f(16),
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: h(12),
    marginTop: h(8),
  },
  loanCard: {
    backgroundColor: COLORS.white,
    borderRadius: mw(14),
    padding: mw(14),
    marginBottom: h(12),
    borderWidth: 1,
    borderColor: '#E9ECEF',
    elevation: 1,
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
    paddingBottom: h(8),
  },
  loanId: {
    fontSize: f(14),
    fontWeight: '800',
    color: COLORS.text,
  },
  loanDesc: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginTop: h(2),
  },
  statusBadge: {
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: mw(6),
  },
  statusText: {
    fontSize: f(10),
    fontWeight: '700',
  },
  loanDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: h(10),
  },
  loanDetailItem: {
    flex: 1,
  },
  loanDetailLabel: {
    fontSize: f(10),
    color: COLORS.textMuted,
  },
  loanDetailVal: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.text,
    marginTop: h(2),
  },
  partnerList: {
    gap: h(10),
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: mw(12),
    borderRadius: mw(12),
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  partnerLogoPlaceholder: {
    width: mw(40),
    height: mw(40),
    borderRadius: mw(8),
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerName: {
    fontSize: f(13),
    fontWeight: '700',
    color: COLORS.text,
  },
  partnerDetails: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginTop: h(2),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: mw(24),
    borderTopRightRadius: mw(24),
    paddingHorizontal: w(20),
    paddingTop: h(20),
    paddingBottom: h(30),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(16),
  },
  modalTitle: {
    fontSize: f(18),
    fontWeight: '800',
    color: COLORS.text,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: mw(10),
    paddingHorizontal: w(12),
    height: h(44),
    fontSize: f(14),
    color: COLORS.text,
  },
  partnerPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: w(8),
    marginVertical: h(10),
  },
  pickerOption: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: mw(8),
    paddingHorizontal: w(12),
    paddingVertical: h(8),
  },
  pickerText: {
    fontSize: f(12),
    color: COLORS.textLight,
  },
  submitButton: {
    paddingVertical: h(14),
    borderRadius: mw(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(20),
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: f(15),
    fontWeight: '700',
  },
});
