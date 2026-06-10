import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, mw, f } from '../../../utils/responsive';
import { showAlert } from '../../../components/CustomAlertBox';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROLE_THEMES = {
  FPO: { primary: COLORS.fpoPrimary, secondary: COLORS.fpoSecondary, light: COLORS.fpoLight, text: COLORS.fpoText },
  Trader: { primary: COLORS.traderPrimary, secondary: COLORS.traderSecondary, light: COLORS.traderLight, text: COLORS.traderText },
  Miller: { primary: COLORS.millerPrimary, secondary: COLORS.millerSecondary, light: COLORS.millerLight, text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

const INITIAL_ROUNDS = [
  {
    round: 1,
    sender: 'buyer',
    senderName: 'Vikas Trading Corp (Buyer)',
    price: 2400,
    qty: 50,
    deliveryType: 'FOR',
    remarks: 'Initial offer. Looking for high quality bags packaging.',
    date: '09 Jun, 10:15 AM',
    isFinal: false,
  },
  {
    round: 2,
    sender: 'seller',
    senderName: 'Malwa FPO (You / Seller)',
    price: 2450,
    qty: 50,
    deliveryType: 'FOR',
    remarks: 'Minimum asking is 2450 due to high grain quality and freight costs.',
    date: '09 Jun, 10:45 AM',
    isFinal: false,
  },
  {
    round: 3,
    sender: 'buyer',
    senderName: 'Vikas Trading Corp (Buyer)',
    price: 2420,
    qty: 50,
    deliveryType: 'FOR',
    remarks: 'Can increase to 2420. This is a reasonable mid-point. Please confirm.',
    date: '09 Jun, 11:15 AM',
    isFinal: false,
  },
];

export default function NegotiationDetailsScreen({ route, navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  const insets = useSafeAreaInsets();

  const offer = route?.params?.offer || {
    id: 'OFF-7721',
    buyerName: 'Vikas Trading Corp',
    price: 2420,
    quantity: 50,
    unit: 'Ton',
    value: '₹12,10,000',
    deliveryType: 'FOR',
  };

  const item = route?.params?.item || {
    commodityName: 'Wheat',
    type: 'Lokwan Premium',
    grade: 'A+',
    sellingPrice: 2450,
    sellingPriceUnit: 'Qt',
  };

  // State
  const [rounds, setRounds] = useState(INITIAL_ROUNDS);
  const [isMyTurn, setIsMyTurn] = useState(true); // Toggle to simulate buyer's vs seller's turn
  const [counterModalVisible, setCounterModalVisible] = useState(false);
  const [counterPrice, setCounterPrice] = useState(String(offer.price));
  const [counterQty, setCounterQty] = useState(String(offer.quantity));
  const [counterRemarks, setCounterRemarks] = useState('');
  const [isFinalOffer, setIsFinalOffer] = useState(false);

  // Actions
  const handleAccept = () => {
    showAlert({
      type: 'confirm',
      title: 'Accept Offer',
      message: `Are you sure you want to accept the offer of ₹${offer.price}/Qtl for ${offer.quantity} Ton? This will close negotiation and generate an Escrow Deal.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept & Close Deal',
          onPress: () => {
            showAlert({
              type: 'success',
              title: 'Deal Confirmed!',
              message: 'Agreement signed. Escrow deal generated. Redirecting to Deal Details...',
              buttons: [
                {
                  text: 'View Deal',
                  onPress: () => {
                    navigation.navigate('DealDetails', {
                      dealId: 'DL-5092',
                      offer,
                      item,
                    });
                  },
                },
              ],
            });
          },
        },
      ],
    });
  };

  const handleReject = () => {
    showAlert({
      type: 'confirm',
      title: 'Reject Offer',
      message: 'Are you sure you want to reject this offer? This will terminate negotiation.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Offer',
          style: 'destructive',
          onPress: () => {
            showAlert({
              type: 'info',
              title: 'Offer Rejected',
              message: 'The offer has been declined and negotiation ended.',
              buttons: [{ text: 'Back to Offers', onPress: () => navigation.goBack() }],
            });
          },
        },
      ],
    });
  };

  const handleCounterSubmit = () => {
    if (!counterPrice || !counterQty) {
      showAlert({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fill in counter price and quantity.',
      });
      return;
    }

    const newRoundNum = rounds.length + 1;
    const newRound = {
      round: newRoundNum,
      sender: 'seller',
      senderName: 'Malwa FPO (You / Seller)',
      price: Number(counterPrice),
      qty: Number(counterQty),
      deliveryType: offer.deliveryType,
      remarks: counterRemarks || 'Counter proposed.',
      date: 'Just Now',
      isFinal: isFinalOffer,
    };

    setRounds([...rounds, newRound]);
    setIsMyTurn(false);
    setCounterModalVisible(false);

    showAlert({
      type: 'success',
      title: 'Counter Offer Sent',
      message: `Proposed counter of ₹${counterPrice}/Qtl. Waiting for buyer's response.`,
    });
  };

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title="Negotiation Thread"
        subtitle={offer.buyerName}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      {/* Demo Switch Turn */}
      <View style={styles.demoToggleCard}>
        <Text style={styles.demoToggleText}>⚡ Demo Simulation:</Text>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, !isMyTurn && { color: theme.primary, fontWeight: '700' }]}>Buyer Turn</Text>
          <Switch
            value={isMyTurn}
            onValueChange={setIsMyTurn}
            trackColor={{ false: '#767577', true: theme.primary + '80' }}
            thumbColor={isMyTurn ? theme.primary : '#f4f3f4'}
          />
          <Text style={[styles.toggleLabel, isMyTurn && { color: theme.primary, fontWeight: '700' }]}>My Turn (Seller)</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Deal Header Overview */}
        <View style={styles.dealHeaderOverview}>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.overviewCrop}>{item.commodityName} (Grade {item.grade})</Text>
              <Text style={styles.overviewVariety}>{item.type}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.primary + '15' }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>ID: {offer.id}</Text>
            </View>
          </View>
          <View style={styles.overviewPricing}>
            <View>
              <Text style={styles.pricingLabel}>Original Ask</Text>
              <Text style={styles.pricingVal}>₹{item.sellingPrice}/Qt</Text>
            </View>
            <View style={styles.pricingDivider} />
            <View>
              <Text style={styles.pricingLabel}>Current Bid</Text>
              <Text style={[styles.pricingVal, { color: theme.primary }]}>₹{rounds[rounds.length - 1].price}/Qt</Text>
            </View>
            <View style={styles.pricingDivider} />
            <View>
              <Text style={styles.pricingLabel}>Quantity</Text>
              <Text style={styles.pricingVal}>{rounds[rounds.length - 1].qty} Ton</Text>
            </View>
          </View>
        </View>

        {/* Timeline Rounds */}
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>Negotiation History</Text>
        <View style={styles.timeline}>
          {rounds.map((rd, index) => {
            const isMe = rd.sender === 'seller';
            return (
              <View key={index} style={styles.timelineRow}>
                {/* Visual Line and Dot */}
                <View style={styles.timelineIndicators}>
                  <View style={[styles.dot, { backgroundColor: isMe ? theme.primary : '#3182CE' }]} />
                  {index < rounds.length - 1 && <View style={styles.line} />}
                </View>

                {/* Round Details Card */}
                <View style={[styles.roundCard, isMe ? styles.myRoundCard : styles.theirRoundCard]}>
                  <View style={styles.roundHeader}>
                    <Text style={styles.roundSender}>{rd.senderName}</Text>
                    <Text style={styles.roundDate}>{rd.date}</Text>
                  </View>
                  <Text style={styles.roundTitle}>Round {rd.round} {rd.isFinal && '⚠️ (FINAL OFFER)'}</Text>
                  <View style={styles.roundSpecs}>
                    <View>
                      <Text style={styles.specLabel}>Price Offered</Text>
                      <Text style={[styles.specVal, { color: isMe ? theme.primary : '#3182CE' }]}>₹{rd.price}/Qt</Text>
                    </View>
                    <View>
                      <Text style={styles.specLabel}>Quantity</Text>
                      <Text style={styles.specVal}>{rd.qty} Ton</Text>
                    </View>
                    <View>
                      <Text style={styles.specLabel}>Delivery</Text>
                      <Text style={styles.specVal}>{rd.deliveryType}</Text>
                    </View>
                  </View>
                  {rd.remarks && (
                    <Text style={styles.roundRemarks}>💬 "{rd.remarks}"</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        <View style={{ height: h(100) + insets.bottom }} />
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={[styles.actionFooter, { paddingBottom: insets.bottom + h(14) }]}>
        {isMyTurn ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={handleReject}>
              <Icon name="close-circle-outline" size={18} color={COLORS.error} />
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, styles.counterBtn]} onPress={() => setCounterModalVisible(true)}>
              <Icon name="swap-horizontal" size={18} color={theme.primary} />
              <Text style={[styles.counterBtnText, { color: theme.primary }]}>Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={handleAccept}>
              <Icon name="check-decagram" size={18} color={COLORS.white} />
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pendingContainer}>
            <Icon name="timer-sand" size={22} color={COLORS.textMuted} style={styles.spinIcon} />
            <Text style={styles.pendingText}>
              Pending Response from Buyer ({offer.buyerName}). 24h expiration timer active.
            </Text>
          </View>
        )}
      </View>

      {/* Counter Modal */}
      <Modal visible={counterModalVisible} transparent animationType="slide" onRequestClose={() => setCounterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Counter Offer</Text>
              <TouchableOpacity onPress={() => setCounterModalVisible(false)}>
                <Icon name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Propose different pricing/quantity terms. Enforces rules: Price counter must be within 5% of previous round.
            </Text>

            <Text style={styles.inputLabel}>Counter Price (₹/Qt)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={counterPrice}
              onChangeText={setCounterPrice}
              placeholder="e.g. 2430"
            />
            <Text style={styles.hint}>Buyer bid ₹{offer.price}. Your ask was ₹{item.sellingPrice}.</Text>

            <Text style={styles.inputLabel}>Quantity (Ton)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={counterQty}
              onChangeText={setCounterQty}
              placeholder="e.g. 50"
            />

            <Text style={styles.inputLabel}>Remarks / Conditions</Text>
            <TextInput
              style={[styles.modalInput, { height: h(60), textAlignVertical: 'top' }]}
              multiline
              value={counterRemarks}
              onChangeText={setCounterRemarks}
              placeholder="Explain why this price is justified..."
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Mark as Final Offer</Text>
                <Text style={styles.switchDesc}>Disallow further counters. Next round must accept or reject.</Text>
              </View>
              <Switch
                value={isFinalOffer}
                onValueChange={setIsFinalOffer}
                trackColor={{ false: '#767577', true: theme.primary + '80' }}
                thumbColor={isFinalOffer ? theme.primary : '#f4f3f4'}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setCounterModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handleCounterSubmit}
              >
                <Text style={styles.submitBtnText}>Submit Counter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  demoToggleCard: {
    backgroundColor: COLORS.white,
    paddingVertical: h(10),
    paddingHorizontal: w(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  demoToggleText: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.textLight,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
  },
  toggleLabel: {
    fontSize: f(11),
    color: COLORS.textMuted,
  },
  scrollContent: {
    padding: w(16),
  },
  dealHeaderOverview: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: w(16),
    marginBottom: h(16),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewCrop: {
    fontSize: f(15),
    fontWeight: '800',
    color: COLORS.text,
  },
  overviewVariety: {
    fontSize: f(12),
    color: COLORS.textLight,
  },
  badge: {
    paddingHorizontal: w(8),
    paddingVertical: h(3),
    borderRadius: 6,
  },
  badgeText: {
    fontSize: f(11),
    fontWeight: '700',
  },
  overviewPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: w(12),
    marginTop: h(14),
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  pricingLabel: {
    fontSize: f(10),
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  pricingVal: {
    fontSize: f(13),
    fontWeight: '700',
    color: COLORS.text,
    marginTop: h(2),
    textAlign: 'center',
  },
  pricingDivider: {
    width: 1,
    backgroundColor: '#E9ECEF',
  },
  sectionTitle: {
    fontSize: f(14),
    fontWeight: '800',
    marginBottom: h(14),
  },
  timeline: {
    paddingLeft: w(8),
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineIndicators: {
    alignItems: 'center',
    marginRight: w(12),
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: h(16),
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#DEE2E6',
    marginVertical: h(4),
  },
  roundCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: w(14),
    marginBottom: h(16),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  myRoundCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.border,
  },
  theirRoundCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3182CE',
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(6),
  },
  roundSender: {
    fontSize: f(11),
    fontWeight: '700',
    color: COLORS.textLight,
  },
  roundDate: {
    fontSize: f(10),
    color: COLORS.textMuted,
  },
  roundTitle: {
    fontSize: f(12),
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: h(10),
  },
  roundSpecs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: w(8),
    marginBottom: h(10),
  },
  specLabel: {
    fontSize: f(9),
    color: COLORS.textMuted,
  },
  specVal: {
    fontSize: f(11),
    fontWeight: '700',
    marginTop: h(1),
  },
  roundRemarks: {
    fontSize: f(11),
    fontStyle: 'italic',
    color: COLORS.textLight,
    lineHeight: h(15),
  },
  actionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingVertical: h(14),
    paddingHorizontal: w(16),
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: w(10),
  },
  actionBtn: {
    flex: 1,
    height: h(44),
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(4),
  },
  rejectBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  rejectBtnText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: f(13),
  },
  counterBtn: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
  },
  counterBtnText: {
    fontWeight: '700',
    fontSize: f(13),
  },
  acceptBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: f(13),
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(8),
    paddingVertical: h(6),
  },
  pendingText: {
    fontSize: f(11),
    color: COLORS.textLight,
    flex: 1,
    lineHeight: h(16),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: w(20),
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: w(20),
    elevation: 10,
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
  modalDesc: {
    fontSize: f(11),
    color: COLORS.textMuted,
    lineHeight: h(15),
    marginBottom: h(12),
  },
  inputLabel: {
    fontSize: f(11),
    fontWeight: '700',
    color: COLORS.textLight,
    marginTop: h(10),
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
  hint: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginTop: h(2),
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: w(10),
    marginVertical: h(14),
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  switchLabel: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.text,
  },
  switchDesc: {
    fontSize: f(9),
    color: COLORS.textMuted,
    marginTop: h(2),
  },
  modalActions: {
    flexDirection: 'row',
    gap: w(10),
    marginTop: h(6),
  },
  modalBtn: {
    flex: 1,
    paddingVertical: h(12),
    borderRadius: 10,
    alignItems: 'center',
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
});
