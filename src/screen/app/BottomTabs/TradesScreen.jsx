import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, f } from '../../../utils/responsive';
import { getOffers } from '../../../service/buy/buyCommodityService';

const ROLE_THEMES = {
  FPO:       { primary: COLORS.fpoPrimary,       secondary: COLORS.fpoSecondary,       light: COLORS.fpoLight,       text: COLORS.fpoText },
  Trader:    { primary: COLORS.traderPrimary,    secondary: COLORS.traderSecondary,    light: COLORS.traderLight,    text: COLORS.traderText },
  Miller:    { primary: COLORS.millerPrimary,    secondary: COLORS.millerSecondary,    light: COLORS.millerLight,    text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

// Status config for offers (Screen 4 from guide)
const OFFER_STATUS_CONFIG = {
  pending:        { label: 'Awaiting Response',  color: '#718096', bg: '#EDF2F7',  icon: 'clock-outline' },
  countered:      { label: 'Counter Received',   color: '#3182CE', bg: '#EBF8FF',  icon: 'swap-horizontal' },
  in_negotiation: { label: 'In Negotiation',     color: '#DD6B20', bg: '#FFFAF0',  icon: 'lock' },
  accepted:       { label: 'Deal Closed',        color: '#38A169', bg: '#F0FFF4',  icon: 'check-decagram' },
  rejected:       { label: 'Rejected',           color: '#E53E3E', bg: '#FFF5F5',  icon: 'close-circle' },
  expired:        { label: 'Expired',            color: '#718096', bg: '#EDF2F7',  icon: 'timer-off' },
};

// Escrow status config for deals (Screen 8/9)
const ESCROW_STATUS_CONFIG = {
  pending_payment: { label: 'Payment Pending', color: '#3182CE', bg: '#EBF8FF',  icon: 'cash-clock',     progress: 0.1 },
  funded:          { label: 'Funded',          color: '#DD6B20', bg: '#FFFAF0',  icon: 'bank-check',     progress: 0.4 },
  dispatched:      { label: 'In Transit',      color: '#D69E2E', bg: '#FFFFF0',  icon: 'truck-delivery', progress: 0.6 },
  delivered:       { label: 'Delivered',       color: '#38A169', bg: '#F0FFF4',  icon: 'package-check',  progress: 0.8 },
  released:        { label: 'Completed ✓',     color: '#38A169', bg: '#F0FFF4',  icon: 'check-decagram', progress: 1.0 },
  cancelled:       { label: 'Cancelled',       color: '#E53E3E', bg: '#FFF5F5',  icon: 'close-circle',   progress: 0.0 },
};

// Format relative time
function formatRelative(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h_ = Math.floor(diff / 3600000);
  if (h_ < 1) return 'Just now';
  if (h_ < 24) return `${h_}h ago`;
  const d = Math.floor(h_ / 24);
  return `${d}d ago`;
}

// Format countdown to expiry
function formatExpiry(expiresAt) {
  if (!expiresAt) return null;
  const diff = Math.max(0, new Date(expiresAt) - Date.now());
  if (diff === 0) return 'Expired';
  const h_ = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h_ > 0) return `Expires in ${h_}h ${m}m`;
  return `Expires in ${m}m`;
}

// Mock fallback removed as per request to show real API data

const TAB_FILTERS = ['All', 'Active', 'Countered', 'Accepted', 'Closed'];

export default function TradesScreen({ navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;

  const [activeTab, setActiveTab] = useState('Active');
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);

  const loadOffers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setApiError(null);

      const res = await getOffers({ page: 1, limit: 50 });
      const list = res?.data?.offers || res?.offers || [];
      setOffers(list);
    } catch (err) {
      console.warn('[TradesScreen] loadOffers error:', err);
      setApiError(err?.response?.data?.message || err?.message || 'Failed to load your offers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOffers();
    }, [loadOffers])
  );

  // Filter offers by tab
  const filteredOffers = offers.filter(offer => {
    const st = offer.displayStatus || offer.status;
    if (activeTab === 'All') return true;
    if (activeTab === 'Active') return ['pending', 'in_negotiation'].includes(st);
    if (activeTab === 'Countered') return st === 'countered';
    if (activeTab === 'Accepted') return st === 'accepted';
    if (activeTab === 'Closed') return ['rejected', 'expired', 'cancelled'].includes(st);
    return true;
  });

  const handleOfferPress = (offer) => {
    // If accepted → go to deal; else go to negotiation thread
    if (offer.status === 'accepted' && offer.dealId) {
      navigation.navigate('DealDetails', {
        dealId: offer.dealId,
        item: offer.commodity,
        role: 'buyer',
      });
    } else {
      navigation.navigate('NegotiationDetails', {
        offer: { id: offer.id || offer._id, ...offer },
        item: offer.commodity,
        role: 'buyer'
      });
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title="My Trades"
          subtitle="Your offers, negotiations & deals"
          showBackButton={false}
        />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading your trades...</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title="My Trades"
        subtitle="Your offers, negotiations & deals"
        showBackButton={false}
      />

      {/* Error Banner */}
      {apiError && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={15} color={COLORS.white} />
          <Text style={styles.errorBannerText}>{apiError}</Text>
          <TouchableOpacity onPress={() => loadOffers(true)} style={styles.retryBadge}>
            <Text style={styles.retryBadgeText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tab Filter Bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TAB_FILTERS.map(tab => {
            const isActive = tab === activeTab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabChip, isActive && { backgroundColor: theme.primary }]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabChipText, isActive && { color: COLORS.white }]}>
                  {tab}
                  {tab === 'Countered' && offers.filter(o => o.status === 'countered' && o.currentTurn === 'buyer').length > 0
                    ? ` 🔴` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadOffers(true)}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        <Text style={[styles.countLabel, { color: theme.primary }]}>
          {filteredOffers.length} offer{filteredOffers.length !== 1 ? 's' : ''}
        </Text>

        {/* Empty State */}
        {filteredOffers.length === 0 && !apiError && (
          <View style={styles.emptyState}>
            <Icon name="handshake-outline" size={56} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No Offers Found</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'All'
                ? "You haven't submitted any offers yet.\nBrowse the marketplace to find commodities."
                : `No offers with "${activeTab}" status.`}
            </Text>
            {activeTab === 'All' && (
              <TouchableOpacity
                style={[styles.browseBtn, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate('Market')}
              >
                <Icon name="store-outline" size={16} color={COLORS.white} />
                <Text style={styles.browseBtnText}>Browse Marketplace</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {filteredOffers.map((offer) => {
          const displaySt = offer.displayStatus || offer.status;
          const statusCfg = OFFER_STATUS_CONFIG[displaySt] || OFFER_STATUS_CONFIG.pending;
          const isMyTurn  = offer.currentTurn === 'buyer';
          const isTerminal = ['accepted', 'rejected', 'expired'].includes(offer.status);
          const lastRound = offer.rounds?.[offer.rounds.length - 1];
          const lastPrice = lastRound?.price || offer.price || 0;
          const qty       = offer.quantity || 0;
          const commodity = offer.commodity || offer.commodityId || {};
          const expiry    = formatExpiry(offer.expiresAt);
          const escrowCfg = offer.deal ? (ESCROW_STATUS_CONFIG[offer.deal.escrowStatus] || ESCROW_STATUS_CONFIG.pending_payment) : null;

          return (
            <TouchableOpacity
              key={offer.id || offer._id}
              style={[
                styles.offerCard,
                isMyTurn && !isTerminal && styles.myTurnCard,
                displaySt === 'in_negotiation' && styles.lockedCard,
              ]}
              onPress={() => handleOfferPress(offer)}
              activeOpacity={0.85}
            >
              {/* Your Turn Banner */}
              {isMyTurn && !isTerminal && (
                <View style={[styles.yourTurnBanner, { backgroundColor: theme.primary }]}>
                  <Text style={styles.yourTurnText}>⚡ Your Turn — Respond Now</Text>
                </View>
              )}

              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cropTitle}>
                    {commodity.name || commodity.commodityName || 'Commodity'}
                    {commodity.type ? ` (${commodity.type})` : ''}
                  </Text>
                  {(commodity.state || commodity.commodityLocation) && (
                    <View style={styles.locationRow}>
                      <Icon name="map-marker-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.locationText}>{commodity.state || commodity.commodityLocation}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Icon name={statusCfg.icon} size={12} color={statusCfg.color} />
                  <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                </View>
              </View>

              {/* Price & Qty Strip */}
              <View style={styles.priceStrip}>
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Your Offer</Text>
                  <Text style={[styles.priceVal, { color: theme.primary }]}>₹{offer.price}/{offer.priceUnit || 'Qt'}</Text>
                </View>
                <View style={styles.priceDivider} />
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Latest Price</Text>
                  <Text style={[styles.priceVal, { color: lastPrice !== offer.price ? '#DD6B20' : COLORS.text }]}>
                    ₹{lastPrice}/{offer.priceUnit || 'Qt'}
                  </Text>
                </View>
                <View style={styles.priceDivider} />
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Quantity</Text>
                  <Text style={styles.priceVal}>{qty} {offer.unit || 'Ton'}</Text>
                </View>
              </View>

              {/* Round & Expiry row */}
              <View style={styles.metaRow}>
                {offer.roundCount != null && (
                  <View style={styles.metaChip}>
                    <Icon name="refresh-circle" size={12} color={COLORS.textMuted} />
                    <Text style={styles.metaChipText}>Round {offer.roundCount}/5</Text>
                  </View>
                )}
                {expiry && !isTerminal && (
                  <View style={[styles.metaChip, { borderColor: '#FBD38D' }]}>
                    <Icon name="timer-outline" size={12} color="#D69E2E" />
                    <Text style={[styles.metaChipText, { color: '#D69E2E' }]}>{expiry}</Text>
                  </View>
                )}
                <View style={styles.metaChip}>
                  <Icon name="clock-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.metaChipText}>{formatRelative(offer.createdAt)}</Text>
                </View>
                {commodity.paymentTimeline && (
                  <View style={styles.metaChip}>
                    <Icon name="cash-fast" size={12} color={COLORS.textMuted} />
                    <Text style={styles.metaChipText}>{commodity.paymentTimeline}</Text>
                  </View>
                )}
                {commodity.escrowEnabled && (
                  <View style={[styles.metaChip, { borderColor: '#9AE6B4', backgroundColor: '#F0FFF4' }]}>
                    <Icon name="shield-check" size={12} color="#38A169" />
                    <Text style={[styles.metaChipText, { color: '#38A169' }]}>Escrow Secured</Text>
                  </View>
                )}
              </View>

              {/* Deal (Escrow) progress if accepted */}
              {offer.status === 'accepted' && escrowCfg && (
                <View style={styles.dealBlock}>
                  <View style={styles.dealHeader}>
                    <Icon name={escrowCfg.icon} size={14} color={escrowCfg.color} />
                    <Text style={[styles.dealStatus, { color: escrowCfg.color }]}>{escrowCfg.label}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${escrowCfg.progress * 100}%`, backgroundColor: escrowCfg.color }]} />
                  </View>
                </View>
              )}

              {/* CTA Row */}
              <View style={[
                styles.ctaRow,
                { backgroundColor: isMyTurn && !isTerminal ? theme.primary + '10' : '#F8F9FA' },
              ]}>
                <Text style={[styles.ctaText, { color: isMyTurn && !isTerminal ? theme.primary : COLORS.textMuted }]}>
                  {offer.status === 'accepted'
                    ? '🔗 View Escrow Deal'
                    : isMyTurn
                    ? '👉 Respond to Counter'
                    : 'View Negotiation Thread'}
                </Text>
                <Icon name="chevron-right" size={16} color={isMyTurn && !isTerminal ? theme.primary : COLORS.textMuted} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: h(12),
    padding: w(20),
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
  // Tab Bar
  tabBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: h(10),
  },
  tabBarContent: {
    paddingHorizontal: w(16),
    gap: w(8),
  },
  tabChip: {
    paddingHorizontal: w(14),
    paddingVertical: h(6),
    borderRadius: 20,
    backgroundColor: '#F1F3F5',
  },
  tabChipText: {
    fontSize: f(12),
    fontWeight: '600',
    color: COLORS.textLight,
  },
  listContent: {
    padding: w(16),
    paddingBottom: h(30),
  },
  countLabel: {
    fontSize: f(12),
    fontWeight: '700',
    marginBottom: h(12),
    marginTop: h(4),
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: h(60),
    gap: h(8),
  },
  emptyTitle: {
    fontSize: f(16),
    fontWeight: '800',
    color: COLORS.text,
  },
  emptyText: {
    fontSize: f(12),
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: h(18),
    paddingHorizontal: w(20),
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(6),
    paddingHorizontal: w(20),
    paddingVertical: h(10),
    borderRadius: 10,
    marginTop: h(8),
  },
  browseBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(13),
  },
  // Offer Card
  offerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: h(12),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    overflow: 'hidden',
  },
  myTurnCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3182CE',
    borderColor: '#BEE3F8',
  },
  lockedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#DD6B20',
    opacity: 0.8,
  },
  yourTurnBanner: {
    paddingHorizontal: w(16),
    paddingVertical: h(6),
  },
  yourTurnText: {
    color: COLORS.white,
    fontSize: f(11),
    fontWeight: '800',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: w(14),
    paddingBottom: h(4),
  },
  cropTitle: {
    fontSize: f(15),
    fontWeight: '800',
    color: COLORS.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(3),
    marginTop: h(2),
  },
  locationText: {
    fontSize: f(11),
    color: COLORS.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: 8,
    marginLeft: w(8),
  },
  statusText: {
    fontSize: f(10),
    fontWeight: '700',
  },
  // Price Strip
  priceStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    marginHorizontal: w(14),
    marginBottom: h(10),
    borderRadius: 10,
    padding: w(10),
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  priceItem: {
    flex: 1,
    alignItems: 'center',
  },
  priceDivider: {
    width: 1,
    backgroundColor: '#E9ECEF',
  },
  priceLabel: {
    fontSize: f(9),
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  priceVal: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.text,
    marginTop: h(1),
    textAlign: 'center',
  },
  // Meta Row
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: w(6),
    paddingHorizontal: w(14),
    marginBottom: h(10),
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    backgroundColor: '#F8F9FA',
    paddingHorizontal: w(7),
    paddingVertical: h(3),
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  metaChipText: {
    fontSize: f(10),
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  // Deal block for accepted offers
  dealBlock: {
    marginHorizontal: w(14),
    marginBottom: h(10),
    backgroundColor: '#F0FFF4',
    borderRadius: 8,
    padding: w(10),
    borderWidth: 1,
    borderColor: '#9AE6B4',
  },
  dealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(6),
    marginBottom: h(6),
  },
  dealStatus: {
    fontSize: f(12),
    fontWeight: '700',
  },
  progressTrack: {
    height: h(6),
    backgroundColor: '#E9ECEF',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  // CTA Row
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: h(10),
    gap: w(4),
    paddingHorizontal: w(14),
  },
  ctaText: {
    fontSize: f(12),
    fontWeight: '700',
  },
});
