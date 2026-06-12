import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import { getReceivedOffers } from '../../../service/buy/buyCommodityService';

const ROLE_THEMES = {
  FPO: { primary: COLORS.fpoPrimary, secondary: COLORS.fpoSecondary, light: COLORS.fpoLight, text: COLORS.fpoText },
  Trader: { primary: COLORS.traderPrimary, secondary: COLORS.traderSecondary, light: COLORS.traderLight, text: COLORS.traderText },
  Miller: { primary: COLORS.millerPrimary, secondary: COLORS.millerSecondary, light: COLORS.millerLight, text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

export default function CommodityDetailsOwnerScreen({ route, navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  const insets = useSafeAreaInsets();

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

  const [loadingOffers, setLoadingOffers] = useState(true);
  const [offersCount, setOffersCount] = useState(0);

  useEffect(() => {
    const fetchReceivedOffersCount = async () => {
      try {
        setLoadingOffers(true);
        const res = await getReceivedOffers(item.id);
        const list = res?.data?.offers || res?.offers || [];
        setOffersCount(list.length);
      } catch (err) {
        console.warn('Failed to fetch received offers from API, using default/mock', err);
        // Fallback count for visual prototype simulation if API is not fully up
        setOffersCount(3);
      } finally {
        setLoadingOffers(false);
      }
    };
    if (item.id) {
      fetchReceivedOffersCount();
    }
  }, [item.id]);

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title="My Listing Details"
        subtitle={`${item.commodityName} (${item.type})`}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

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
          
          {item.grade && (
            <View style={styles.gradeTag}>
              <Text style={styles.gradeTagText}>Grade {item.grade}</Text>
            </View>
          )}
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
              <Text style={styles.statValue}>{item.moisture || '—'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>End Date</Text>
              <Text style={styles.statValue}>{item.listingEndDate || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Quality Specifications */}
        {item.qualityParameters && item.qualityParameters.length > 0 && (
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
        )}

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

        {/* Bottom Spacing */}
        <View style={{ height: h(90) + insets.bottom }} />
      </ScrollView>

      {/* Floating Action Sticky Footer */}
      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + h(14) }]}>
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('ReceivedOffers', { item })}
          activeOpacity={0.8}
        >
          <Icon name="handshake" size={20} color={COLORS.white} />
          <Text style={styles.primaryActionText}>
            {loadingOffers ? 'Loading Offers...' : `View Received Offers (${offersCount})`}
          </Text>
          {loadingOffers && <ActivityIndicator size="small" color={COLORS.white} style={{ marginLeft: w(6) }} />}
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
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
});
