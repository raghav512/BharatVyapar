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
// showAlert available if needed for future actions
import { getReceivedOffers } from '../../../service/buy/buyCommodityService';

const ROLE_THEMES = {
  FPO:       { primary: COLORS.fpoPrimary,       secondary: COLORS.fpoSecondary,       light: COLORS.fpoLight,       text: COLORS.fpoText },
  Trader:    { primary: COLORS.traderPrimary,    secondary: COLORS.traderSecondary,    light: COLORS.traderLight,    text: COLORS.traderText },
  Miller:    { primary: COLORS.millerPrimary,    secondary: COLORS.millerSecondary,    light: COLORS.millerLight,    text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

// Status badge config for each offer status
const STATUS_CONFIG = {
  pending:   { label: 'Awaiting Your Response', color: '#3182CE', bg: '#EBF8FF' },
  countered: { label: 'In Negotiation',         color: '#DD6B20', bg: '#FFFAF0' },
  accepted:  { label: 'Deal Closed',            color: '#38A169', bg: '#F0FFF4' },
  rejected:  { label: 'Rejected',               color: '#E53E3E', bg: '#FFF5F5' },
  expired:   { label: 'Expired',                color: '#718096', bg: '#EDF2F7' },
};

// Format relative time
function formatRelativeTime(dateStr) {
  if (!dateStr) return '--';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ReceivedOffersScreen({ route, navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;

  const item = route?.params?.item || {
    id: null,
    commodityName: 'Commodity',
    type: '',
    quantity: '—',
    unit: '',
    sellingPrice: null,
    sellingPriceUnit: 'Qt',
  };

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);

  const loadOffers = useCallback(async (isRefresh = false) => {
    if (!item.id) {
      setApiError('No commodity ID provided.');
      setLoading(false);
      return;
    }
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setApiError(null);

      const res = await getReceivedOffers(item.id);
      const list = res?.data?.offers || res?.offers || [];
      setOffers(list);
    } catch (err) {
      console.error('[ReceivedOffers] loadOffers error:', err);
      setApiError(err?.message || 'Failed to load received offers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [item.id]);

  // Reload every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadOffers();
    }, [loadOffers])
  );

  const handleOfferPress = (offer) => {
    navigation.navigate('NegotiationDetails', { offer, item, role: 'seller' });
  };

  // ─── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title="Received Offers"
          subtitle={`${item.commodityName}${item.type ? ` (${item.type})` : ''}`}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading received offers...</Text>
        </View>
      </SafeScreen>
    );
  }

  // ─── Error (no data) ────────────────────────────────────────────────
  if (apiError && offers.length === 0) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title="Received Offers"
          subtitle={`${item.commodityName}${item.type ? ` (${item.type})` : ''}`}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centeredContainer}>
          <Icon name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Could Not Load Offers</Text>
          <Text style={styles.errorDesc}>{apiError}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            onPress={() => loadOffers()}
          >
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.retryBtn, { backgroundColor: '#38A169', marginTop: h(12) }]} 
            onPress={() => {
              setApiError(null);
              setOffers([
                {
                  id: 'mock-123',
                  buyer: { name: 'Mock Buyer Ramesh', state: 'Haryana', rating: 4.8 },
                  price: 2200,
                  quantity: 50,
                  status: 'pending',
                  isActiveNegotiation: true,
                  canCounter: true,
                  roundCount: 1,
                  currentTurn: 'seller',
                  createdAt: new Date().toISOString()
                },
                {
                  id: 'mock-456',
                  buyer: { name: 'Suresh Patel', state: 'Punjab' },
                  price: 2100,
                  quantity: 40,
                  status: 'pending',
                  isActiveNegotiation: false,
                  canCounter: false,
                  note: 'Another buyer is in active negotiation',
                  roundCount: 0,
                  currentTurn: 'seller',
                  createdAt: new Date(Date.now() - 3600000).toISOString()
                }
              ]);
            }}
          >
            <Text style={styles.retryBtnText}>Generate Mock Offers</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  // Group: active negotiation first, then pending, then others
  const activeOffers  = offers.filter(o => o.isActiveNegotiation);
  const pendingOffers = offers.filter(o => !o.isActiveNegotiation && ['pending', 'countered'].includes(o.status));
  const otherOffers   = offers.filter(o => !o.isActiveNegotiation && !['pending', 'countered'].includes(o.status));
  const sortedOffers  = [...activeOffers, ...pendingOffers, ...otherOffers];

  const activeCount = activeOffers.length + pendingOffers.length;

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title="Received Offers"
        subtitle={`${item.commodityName}${item.type ? ` (${item.type})` : ''}`}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      {/* Listing Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>My Asking Price</Text>
          <Text style={styles.summaryValue}>
            {item.sellingPrice ? `₹${item.sellingPrice}/${item.sellingPriceUnit || 'Qt'}` : '—'}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Listed Quantity</Text>
          <Text style={styles.summaryValue}>{item.quantity} {item.unit}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Active Offers</Text>
          <Text style={[styles.summaryValue, { color: theme.primary }]}>{activeCount}</Text>
        </View>
      </View>

      {/* Error banner if data is stale */}
      {apiError && offers.length > 0 && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={15} color={COLORS.white} />
          <Text style={styles.errorBannerText}>{apiError}</Text>
          <TouchableOpacity onPress={() => loadOffers(true)} style={styles.retryBadge}>
            <Text style={styles.retryBadgeText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        {/* Section heading */}
        <Text style={[styles.sectionHeading, { color: theme.primary }]}>
          All Buyer Offers ({offers.length})
        </Text>

        {/* Empty state */}
        {sortedOffers.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="inbox-outline" size={56} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No Offers Yet</Text>
            <Text style={styles.emptyText}>
              Buyers haven't submitted offers on this listing yet.
              Share your listing link to attract more buyers.
            </Text>
          </View>
        )}

        {sortedOffers.map((offer) => {
          const isActive     = offer.isActiveNegotiation === true;
          const isMyTurn     = offer.currentTurn === 'seller';
          // canCounter used to control lock note display
          const hasLockNote  = !isActive && offer.canCounter === false && offer.note;
          const statusCfg    = STATUS_CONFIG[offer.status] || STATUS_CONFIG.pending;
          const isTerminal   = ['accepted', 'rejected', 'expired'].includes(offer.status);

          const buyerName    = offer.buyer?.name || 'Buyer';
          const buyerState   = offer.buyer?.state || '';
          const roundCount   = offer.roundCount ?? 0;
          const price        = offer.price ?? 0;
          const qty          = offer.quantity ?? 0;

          return (
            <TouchableOpacity
              key={offer.id || offer._id}
              style={[
                styles.offerCard,
                isActive  && styles.activeNegotiationCard,
                isMyTurn  && !isTerminal && styles.myTurnCard,
                isTerminal && styles.terminalCard,
              ]}
              onPress={() => handleOfferPress(offer)}
              activeOpacity={0.85}
            >
              {/* Active Negotiation Badge */}
              {isActive && (
                <View style={styles.activeNegotiationBanner}>
                  <Icon name="star-circle" size={14} color={COLORS.white} />
                  <Text style={styles.activeNegotiationText}>🔥 Active Negotiation</Text>
                </View>
              )}

              {/* Your Turn Pulse Badge */}
              {isMyTurn && !isTerminal && !isActive && (
                <View style={[styles.yourTurnBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.yourTurnText}>⚡ Your Turn</Text>
                </View>
              )}
              {isMyTurn && isActive && (
                <View style={[styles.yourTurnBadge, { backgroundColor: '#38A169' }]}>
                  <Text style={styles.yourTurnText}>⚡ Your Turn — Respond Now</Text>
                </View>
              )}

              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.buyerName}>{buyerName}</Text>
                  <View style={styles.buyerMeta}>
                    {offer.buyer?.rating && (
                      <>
                        <Icon name="star" size={12} color="#D69E2E" />
                        <Text style={styles.buyerMetaText}>{offer.buyer.rating}</Text>
                        {buyerState ? <Text style={styles.buyerMetaText}>• {buyerState}</Text> : null}
                      </>
                    )}
                    {!offer.buyer?.rating && buyerState && (
                      <Text style={styles.buyerMetaText}>{buyerState}</Text>
                    )}
                    <Text style={styles.buyerMetaText}>• Round {roundCount}/5</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Offer Metrics */}
              <View style={styles.offerMetrics}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Price Proposed</Text>
                  <Text style={[styles.metricValue, { color: isActive ? '#38A169' : theme.primary }]}>
                    ₹{price}/{item.sellingPriceUnit || 'Qt'}
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Quantity</Text>
                  <Text style={styles.metricValue}>{qty} {item.unit || 'Ton'}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Total Value</Text>
                  <Text style={styles.metricValue}>
                    ₹{(price * qty).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              {/* Delivery & Date Row */}
              <View style={styles.cardFooter}>
                <View style={styles.footerInfo}>
                  <Icon name="truck-delivery" size={14} color={COLORS.textLight} />
                  <Text style={styles.footerInfoText}>
                    {offer.tradeType === 'FOR' || offer.tradeType === 'for' ? 'FOR Delivery' : 'Ex-Warehouse'}
                  </Text>
                </View>
                <View style={styles.footerInfo}>
                  <Icon name="clock-outline" size={14} color={COLORS.textLight} />
                  <Text style={styles.footerInfoText}>{formatRelativeTime(offer.createdAt)}</Text>
                </View>
              </View>

              {/* Locked Commodity Note */}
              {hasLockNote && (
                <View style={styles.lockNoteBanner}>
                  <Icon name="lock-outline" size={14} color="#744210" />
                  <Text style={styles.lockNoteText}>{offer.note}</Text>
                </View>
              )}

              {/* Remarks */}
              {offer.remarks && !hasLockNote && (
                <View style={styles.remarksBlock}>
                  <Text style={styles.remarksLabel}>Note:</Text>
                  <Text style={styles.remarksText} numberOfLines={1}>"{offer.remarks}"</Text>
                </View>
              )}

              {/* CTA */}
              {!isTerminal && (
                <View style={[
                  styles.ctaRow,
                  {
                    backgroundColor: isActive
                      ? '#F0FFF4'
                      : isMyTurn
                      ? theme.primary + '0F'
                      : theme.primary + '08',
                  },
                ]}>
                  <Text style={[styles.ctaText, { color: isActive ? '#22543D' : theme.primary }]}>
                    {isMyTurn ? '👉 Tap to Respond' : 'View Negotiation Thread'}
                  </Text>
                  <Icon name="chevron-right" size={18} color={isActive ? '#22543D' : theme.primary} />
                </View>
              )}

              {isTerminal && (
                <View style={[styles.ctaRow, { backgroundColor: '#F8F9FA' }]}>
                  <Text style={[styles.ctaText, { color: COLORS.textMuted }]}>View Thread History</Text>
                  <Icon name="chevron-right" size={18} color={COLORS.textMuted} />
                </View>
              )}
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
  errorTitle: {
    fontSize: f(16),
    fontWeight: '800',
    color: COLORS.text,
    marginTop: h(8),
  },
  errorDesc: {
    fontSize: f(12),
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: h(18),
  },
  retryBtn: {
    paddingHorizontal: w(24),
    paddingVertical: h(10),
    borderRadius: 10,
    marginTop: h(8),
  },
  retryBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(13),
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
  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: h(12),
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: h(4),
  },
  summaryLabel: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginBottom: h(2),
  },
  summaryValue: {
    fontSize: f(13),
    fontWeight: '800',
    color: COLORS.text,
  },
  // Scroll
  scrollContent: {
    padding: w(16),
    paddingBottom: h(30),
  },
  sectionHeading: {
    fontSize: f(14),
    fontWeight: '800',
    marginBottom: h(12),
    marginTop: h(4),
  },
  // Empty state
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
  // Offer Card
  offerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: w(16),
    marginBottom: h(14),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    overflow: 'hidden',
  },
  activeNegotiationCard: {
    borderColor: '#38A169',
    borderWidth: 2,
  },
  myTurnCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3182CE',
  },
  terminalCard: {
    opacity: 0.75,
  },
  activeNegotiationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(6),
    backgroundColor: '#38A169',
    marginHorizontal: -w(16),
    marginTop: -h(16),
    paddingHorizontal: w(16),
    paddingVertical: h(6),
    marginBottom: h(12),
  },
  activeNegotiationText: {
    color: COLORS.white,
    fontSize: f(11),
    fontWeight: '800',
  },
  yourTurnBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: w(10),
    paddingVertical: h(4),
    borderRadius: 6,
    marginBottom: h(10),
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
    marginBottom: h(4),
  },
  buyerName: {
    fontSize: f(15),
    fontWeight: '800',
    color: COLORS.text,
  },
  buyerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    marginTop: h(2),
    flexWrap: 'wrap',
  },
  buyerMetaText: {
    fontSize: f(11),
    color: COLORS.textMuted,
  },
  statusBadge: {
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: 8,
    marginLeft: w(8),
  },
  statusText: {
    fontSize: f(10),
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F3F5',
    marginVertical: h(12),
  },
  offerMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: w(10),
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: h(12),
  },
  metricBox: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginBottom: h(2),
    textAlign: 'center',
  },
  metricValue: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: h(10),
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
  },
  footerInfoText: {
    fontSize: f(11),
    color: COLORS.textLight,
  },
  lockNoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(6),
    backgroundColor: '#FEFCBF',
    borderRadius: 8,
    padding: w(10),
    borderWidth: 1,
    borderColor: '#F6E05E',
    marginBottom: h(10),
  },
  lockNoteText: {
    fontSize: f(11),
    color: '#744210',
    fontWeight: '600',
    flex: 1,
  },
  remarksBlock: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: w(8),
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: h(10),
    flexDirection: 'row',
    gap: w(4),
  },
  remarksLabel: {
    fontSize: f(11),
    fontWeight: '700',
    color: '#D97706',
  },
  remarksText: {
    fontSize: f(11),
    color: '#78350F',
    flex: 1,
  },
  ctaRow: {
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: h(8),
    gap: w(4),
  },
  ctaText: {
    fontSize: f(12),
    fontWeight: '800',
  },
});
