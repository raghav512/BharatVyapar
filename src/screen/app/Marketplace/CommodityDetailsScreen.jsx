import React, { useState, useEffect, useCallback } from 'react';
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
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, f } from '../../../utils/responsive';
import { showAlert } from '../../../components/CustomAlertBox';
import { getOffers, submitOffer } from '../../../service/buy/buyCommodityService';

const ROLE_THEMES = {
  FPO: { primary: COLORS.fpoPrimary, secondary: COLORS.fpoSecondary, light: COLORS.fpoLight, text: COLORS.fpoText },
  Trader: { primary: COLORS.traderPrimary, secondary: COLORS.traderSecondary, light: COLORS.traderLight, text: COLORS.traderText },
  Miller: { primary: COLORS.millerPrimary, secondary: COLORS.millerSecondary, light: COLORS.millerLight, text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

export default function CommodityDetailsScreen({ route, navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  const insets = useSafeAreaInsets();

  // Listing details (passed via route)
  const item = route?.params?.item || {
    id: 'COM-9872',
    commodityName: 'Wheat',
    type: 'Lokwan Premium',
    quantity: '50',
    unit: 'Ton',
    sellingPrice: 2450,
    sellingPriceUnit: 'Qt',
    weightType: 'Net Weight',
    listingEndDate: '2026-07-15',
    weightTolerance: '+/- 1%',
    billingAddress: 'Indore Mandi Complex, Warehouse 4A, MP',
    exWarehouseAddress: 'Indore Mandi Complex, MP',
    paymentTimeline: 'Within 3 days of delivery confirmation',
    remarks: 'Bags packing of 50kg. High gluten content, clean grains.',
    deliveryType: 'FOR',
    isNegotiable: true,
    minimumAcceptablePrice: 2350,
    maxNegotiationRounds: 5,
    offerExpiryHours: 24,
    commodityLocation: 'Indore, MP',
    escrowEnabled: true,
    buyerTransportAllowed: true,
    grade: 'A+',
    moisture: '10.5%',
    qualityParameters: [
      { name: 'Moisture', val: '10.5%' },
      { name: 'Foreign Matter', val: '0.8%' },
      { name: 'Gluten Content', val: '11.5%' },
      { name: 'Weevilled Grains', val: '0.2%' },
    ],
    sellerName: 'Malwa Farmer Producer Org (FPO)',
    sellerRating: 4.8,
    sellerCompletedTrades: 124,
    isSellerVerified: true,
  };

  // Active negotiation check state
  const [checkingOffer, setCheckingOffer] = useState(true);
  const [activeOffer, setActiveOffer] = useState(null);
  const [apiError, setApiError] = useState(null);

  // Offer Placement Form Modal
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerPrice, setOfferPrice] = useState(String(item.sellingPrice));
  const [offerQty, setOfferQty] = useState(String(item.quantity));
  const [deliveryType, setDeliveryType] = useState(item.deliveryType);
  const [paymentTimeline, setPaymentTimeline] = useState(item.paymentTimeline);
  const [remarks, setRemarks] = useState('');

  const checkActiveOffer = useCallback(async () => {
    try {
      setCheckingOffer(true);
      setApiError(null);
      const res = await getOffers({ commodityId: item.id });
      const offersList = res?.data?.offers || res?.offers || [];
      
      // Look for any offer on this commodity that has status pending or countered
      const found = offersList.find(o => 
        String(o.commodityId || o.commodity?.id) === String(item.id) && 
        ['pending', 'countered'].includes(o.status)
      );
      
      setActiveOffer(found || null);
    } catch (err) {
      console.warn('[CommodityDetails] Error checking active offer:', err);
      // Suppress network errors for offline testing/prototype, but set error if no cache exists
      setApiError(err.message || 'Failed to sync with server.');
    } finally {
      setCheckingOffer(false);
    }
  }, [item.id]);

  useEffect(() => {
    if (item.id) {
      checkActiveOffer();
      setOfferPrice(String(item.sellingPrice || ''));
      setOfferQty(String(item.quantity || ''));
    }
  }, [item.id, checkActiveOffer, item.sellingPrice, item.quantity]);

  const handlePlaceOffer = async () => {
    const finalPrice = item.isNegotiable === false ? item.sellingPrice : Number(offerPrice);
    if (!finalPrice || !offerQty) {
      showAlert({
        type: 'error',
        title: 'Missing Details',
        message: 'Please fill in the offer price and quantity.',
      });
      return;
    }

    try {
      setSubmittingOffer(true);
      const requestData = {
        commodityId: item.id,
        price: Number(finalPrice),
        priceUnit: item.sellingPriceUnit || 'Qt',
        quantity: Number(offerQty),
        unit: item.unit || 'Ton',
        tradeType: deliveryType,
        paymentTimeline: paymentTimeline,
        remarks: remarks
      };

      const res = await submitOffer(requestData);
      const createdOffer = res?.data || res;
      setOfferModalVisible(false);
      
      showAlert({
        type: 'success',
        title: 'Offer Submitted',
        message: `Your buy offer of ₹${offerPrice}/Qtl for ${offerQty} Ton has been submitted successfully to the seller.`,
        buttons: [
          {
            text: 'View Negotiation',
            onPress: () => {
              // Navigate to the negotiation thread
              navigation.navigate('NegotiationDetails', { offer: createdOffer, item, role: 'buyer' });
            },
          },
          { text: 'Keep Browsing' },
        ],
      });
      
      // Refresh the screen status
      checkActiveOffer();
    } catch (error) {
      console.error('[CommodityDetails] submitOffer error:', error);
      
      const isDuplicate = error.statusCode === 409 || error.backendError?.error?.code === 'DUPLICATE_OFFER';
      
      showAlert({
        type: 'error',
        title: isDuplicate ? 'Active Offer Exists' : 'Submission Failed',
        message: error.message || 'Failed to submit buy offer. Please try again.',
      });
    } finally {
      setSubmittingOffer(false);
    }
  };

  if (checkingOffer) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title="Commodity Listing"
          subtitle={`${item.commodityName} (${item.type})`}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Checking listing status...</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title="Commodity Listing"
        subtitle={`${item.commodityName} (${item.type})`}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      {apiError && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={16} color={COLORS.white} />
          <Text style={styles.errorBannerText}>{apiError}</Text>
          <TouchableOpacity onPress={checkActiveOffer} style={styles.retryBadge}>
            <Text style={styles.retryBadgeText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Gallery Section */}
        <View style={styles.galleryContainer}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            <View style={styles.gallerySlide}>
              <View style={[styles.mockImagePlaceholder, { backgroundColor: theme.primary + '1A' }]}>
                <Icon name="wheat" size={80} color={theme.primary} />
                <Text style={[styles.galleryTag, { backgroundColor: theme.primary }]}>Image 1 of 3</Text>
              </View>
            </View>
            <View style={styles.gallerySlide}>
              <View style={[styles.mockImagePlaceholder, { backgroundColor: theme.primary + '12' }]}>
                <Icon name="silo" size={80} color={theme.primary} />
                <Text style={[styles.galleryTag, { backgroundColor: theme.primary }]}>Image 2 of 3</Text>
              </View>
            </View>
            <View style={styles.gallerySlide}>
              <View style={[styles.mockImagePlaceholder, { backgroundColor: theme.primary + '08' }]}>
                <Icon name="truck-delivery" size={80} color={theme.primary} />
                <Text style={[styles.galleryTag, { backgroundColor: theme.primary }]}>Image 3 of 3</Text>
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.gradeTag}>
            <Text style={styles.gradeTagText}>Grade {item.grade}</Text>
          </View>
        </View>

        {/* Core Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.itemName}>{item.commodityName}</Text>
              <Text style={styles.itemVariety}>Variety: {item.type}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={[styles.itemPrice, { color: theme.primary }]}>₹{item.sellingPrice}</Text>
              <Text style={styles.itemPriceUnit}>per {item.sellingPriceUnit}</Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <Icon name="map-marker" size={16} color={COLORS.textLight} />
            <Text style={styles.locationText}>Location: {item.commodityLocation}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Available Qty</Text>
              <Text style={styles.statValue}>{item.quantity} {item.unit}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Moisture</Text>
              <Text style={styles.statValue}>{item.moisture}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>End Date</Text>
              <Text style={styles.statValue}>{item.listingEndDate}</Text>
            </View>
          </View>
        </View>

        {/* Quality Specifications */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Quality Parameters</Text>
          <View style={styles.paramsGrid}>
            {item.qualityParameters.map((param, index) => (
              <View key={index} style={styles.paramItem}>
                <Text style={styles.paramName}>{param.name}</Text>
                <Text style={styles.paramVal}>{param.val}</Text>
              </View>
            ))}
          </View>
          
          <TouchableOpacity 
            style={[styles.downloadReportBtn, { borderColor: theme.primary }]}
            onPress={() => showAlert({ type: 'success', title: 'Quality Report', message: 'Lab report PDF downloaded successfully!' })}
          >
            <Icon name="file-pdf-box" size={20} color={theme.primary} />
            <Text style={[styles.downloadReportText, { color: theme.primary }]}>Download Government Lab Report</Text>
          </TouchableOpacity>
        </View>

        {/* Logistics & Delivery Terms */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Trade & Logistics Terms</Text>
          
          <View style={styles.termRow}>
            <Icon name="truck-cargo-container" size={20} color={theme.primary} />
            <View style={styles.termContent}>
              <Text style={styles.termTitle}>Delivery Type</Text>
              <Text style={styles.termDesc}>
                {item.deliveryType === 'FOR' ? 'FOR (Freight Free / Delivered to your location)' : 'EX-WAREHOUSE (Ex works, buyer picks up)'}
              </Text>
            </View>
          </View>

          <View style={styles.termRow}>
            <Icon name="scale-balance" size={20} color={theme.primary} />
            <View style={styles.termContent}>
              <Text style={styles.termTitle}>Weight Basis & Tolerance</Text>
              <Text style={styles.termDesc}>{item.weightType} with tolerance {item.weightTolerance}</Text>
            </View>
          </View>

          <View style={styles.termRow}>
            <Icon name="cash-fast" size={20} color={theme.primary} />
            <View style={styles.termContent}>
              <Text style={styles.termTitle}>Payment Timeline</Text>
              <Text style={styles.termDesc}>{item.paymentTimeline}</Text>
            </View>
          </View>

          <View style={styles.termRow}>
            <Icon name="shield-check" size={20} color={theme.primary} />
            <View style={styles.termContent}>
              <Text style={styles.termTitle}>Payment Security</Text>
              <Text style={styles.termDesc}>
                {item.escrowEnabled ? '🔐 Secured via BharatVyapar partner Escrow. Payment released only post delivery verification.' : 'Direct payment between parties'}
              </Text>
            </View>
          </View>

          <View style={styles.termRow}>
            <Icon name="map-legend" size={20} color={theme.primary} />
            <View style={styles.termContent}>
              <Text style={styles.termTitle}>Billing Address</Text>
              <Text style={styles.termDesc}>{item.billingAddress}</Text>
            </View>
          </View>

          {item.remarks && (
            <View style={styles.remarksBox}>
              <Text style={styles.remarksTitle}>Remarks / Notes:</Text>
              <Text style={styles.remarksText}>{item.remarks}</Text>
            </View>
          )}
        </View>

        {/* Seller Info Card */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Seller Profile</Text>
          <View style={styles.sellerHeader}>
            <View style={[styles.sellerAvatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.sellerAvatarText}>F</Text>
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{item.sellerName}</Text>
                {item.isSellerVerified && (
                  <Icon name="decagram" size={16} color={COLORS.info} style={{ marginLeft: w(4) }} />
                )}
              </View>
              <Text style={styles.sellerSubtext}>Verified Farmer Producer Organization</Text>
              <View style={styles.sellerRatingRow}>
                <Icon name="star" size={14} color="#D69E2E" />
                <Text style={styles.sellerRatingText}>{item.sellerRating} • {item.sellerCompletedTrades} completed trades</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: h(90) + insets.bottom }} />
      </ScrollView>

      {/* Floating Action Sticky Footer */}
      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + h(14) }]}>
        {activeOffer ? (
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: COLORS.success }]}
            onPress={() => navigation.navigate('NegotiationDetails', { offer: activeOffer, item, role: 'buyer' })}
            activeOpacity={0.8}
          >
            <Icon name="handshake" size={20} color={COLORS.white} />
            <Text style={styles.primaryActionText}>🤝 View Your Offer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
            onPress={() => setOfferModalVisible(true)}
            activeOpacity={0.8}
          >
            <Icon name="cart-arrow-right" size={20} color={COLORS.white} />
            <Text style={styles.primaryActionText}>🤝 Submit Buy Offer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Place Offer Modal */}
      <Modal visible={offerModalVisible} transparent animationType="slide" onRequestClose={() => setOfferModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Place Buy Offer</Text>
              <TouchableOpacity onPress={() => setOfferModalVisible(false)}>
                <Icon name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalSubtitle}>
                Offer terms for {item.commodityName} - Grade {item.grade} ({item.sellerName})
              </Text>

              {/* Price & Quantity input */}
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.inputLabel}>Offer Price (₹/{item.sellingPriceUnit})</Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      item.isNegotiable === false && { backgroundColor: '#E2E8F0', color: COLORS.textMuted }
                    ]}
                    keyboardType="numeric"
                    value={item.isNegotiable === false ? String(item.sellingPrice) : offerPrice}
                    onChangeText={setOfferPrice}
                    placeholder="e.g. 2400"
                    editable={item.isNegotiable !== false}
                  />
                  <Text style={styles.hintText}>
                    {item.isNegotiable === false ? 'Price is fixed by seller' : `Seller asks ₹${item.sellingPrice}`}
                  </Text>
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.inputLabel}>Quantity ({item.unit})</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={offerQty}
                    onChangeText={setOfferQty}
                    placeholder="e.g. 50"
                  />
                  <Text style={styles.hintText}>Available: {item.quantity} {item.unit}</Text>
                </View>
              </View>

              {/* Delivery Type preference */}
              <Text style={styles.inputLabel}>Preferred Delivery Type</Text>
              <View style={styles.pickerRow}>
                {['FOR', 'EX_WAREHOUSE'].map((dt) => (
                  <TouchableOpacity
                    key={dt}
                    onPress={() => setDeliveryType(dt)}
                    style={[styles.pickerChip, deliveryType === dt && { backgroundColor: theme.primary }]}
                  >
                    <Text style={[styles.pickerChipText, deliveryType === dt && { color: COLORS.white }]}>
                      {dt === 'FOR' ? 'FOR (Freight Free)' : 'Ex-Warehouse'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Proposed Payment timeline Preference */}
              <Text style={styles.inputLabel}>Proposed Payment Timeline</Text>
              <TextInput
                style={styles.modalInput}
                value={paymentTimeline}
                onChangeText={setPaymentTimeline}
                placeholder="e.g. On delivery confirmation"
              />

              {/* Remarks */}
              <Text style={styles.inputLabel}>Remarks / Custom Clauses</Text>
              <TextInput
                style={[styles.modalInput, styles.remarksInput]}
                multiline
                value={remarks}
                onChangeText={setRemarks}
                placeholder="e.g. Request immediate loading, jute bags packing..."
              />

              <View style={[styles.escrowNotice, { backgroundColor: theme.primary + '0A' }]}>
                <Icon name="shield-check-outline" size={20} color={theme.primary} />
                <Text style={[styles.escrowNoticeText, { color: theme.text }]}>
                  This offer will initiate a secure negotiation. On acceptance, funds will be deposited in a secure partner escrow account.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setOfferModalVisible(false)}
                  disabled={submittingOffer}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                  onPress={handlePlaceOffer}
                  disabled={submittingOffer}
                >
                  {submittingOffer ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Offer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: h(12),
  },
  loadingText: {
    fontSize: f(13),
    color: COLORS.textMuted,
  },
  errorBanner: {
    backgroundColor: COLORS.error,
    paddingVertical: h(8),
    paddingHorizontal: w(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
  },
  errorBannerText: {
    color: COLORS.white,
    fontSize: f(12),
    flex: 1,
  },
  retryBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: 4,
  },
  retryBadgeText: {
    color: COLORS.white,
    fontSize: f(11),
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: h(20),
  },
  galleryContainer: {
    height: h(200),
    position: 'relative',
    backgroundColor: COLORS.white,
  },
  gallerySlide: {
    width: w(360),
    height: '100%',
  },
  mockImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryTag: {
    position: 'absolute',
    bottom: h(10),
    right: w(16),
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: 6,
    color: COLORS.white,
    fontSize: f(10),
    fontWeight: '700',
  },
  gradeTag: {
    position: 'absolute',
    top: h(10),
    left: w(16),
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: w(10),
    paddingVertical: h(4),
    borderRadius: 8,
  },
  gradeTagText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(11),
  },
  infoCard: {
    backgroundColor: COLORS.white,
    padding: w(16),
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginBottom: h(12),
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: h(8),
  },
  itemName: {
    fontSize: f(20),
    fontWeight: '800',
    color: COLORS.text,
  },
  itemVariety: {
    fontSize: f(12),
    color: COLORS.textLight,
    marginTop: h(2),
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: f(22),
    fontWeight: '800',
  },
  itemPriceUnit: {
    fontSize: f(11),
    color: COLORS.textMuted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    marginTop: h(4),
  },
  locationText: {
    fontSize: f(12),
    color: COLORS.textLight,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F3F5',
    marginVertical: h(12),
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginBottom: h(2),
  },
  statValue: {
    fontSize: f(14),
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: w(16),
    marginBottom: h(12),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  sectionTitle: {
    fontSize: f(14),
    fontWeight: '800',
    marginBottom: h(12),
  },
  paramsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: w(8),
    marginBottom: h(12),
  },
  paramItem: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: w(10),
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  paramName: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginBottom: h(2),
  },
  paramVal: {
    fontSize: f(13),
    fontWeight: '700',
    color: COLORS.text,
  },
  downloadReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: h(10),
    gap: w(6),
    backgroundColor: '#F8F9FA',
  },
  downloadReportText: {
    fontSize: f(12),
    fontWeight: '700',
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: w(12),
    marginBottom: h(12),
  },
  termContent: {
    flex: 1,
  },
  termTitle: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.text,
  },
  termDesc: {
    fontSize: f(11),
    color: COLORS.textLight,
    marginTop: h(2),
  },
  remarksBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: w(12),
    marginTop: h(6),
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  remarksTitle: {
    fontSize: f(11),
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: h(2),
  },
  remarksText: {
    fontSize: f(11),
    color: COLORS.text,
    fontStyle: 'italic',
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(12),
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: f(18),
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerName: {
    fontSize: f(13),
    fontWeight: '700',
    color: COLORS.text,
  },
  sellerSubtext: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginTop: h(1),
  },
  sellerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    marginTop: h(4),
  },
  sellerRatingText: {
    fontSize: f(11),
    color: COLORS.textLight,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: w(14),
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  primaryActionBtn: {
    height: h(46),
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(8),
  },
  primaryActionText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: f(14),
  },
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
    paddingVertical: h(8),
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
