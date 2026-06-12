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
import { showAlert } from '../../../components/CustomAlertBox';
import { getDealDetails, updateEscrowStatus } from '../../../service/buy/buyCommodityService';

const ROLE_THEMES = {
  FPO:       { primary: COLORS.fpoPrimary,       secondary: COLORS.fpoSecondary,       light: COLORS.fpoLight,       text: COLORS.fpoText },
  Trader:    { primary: COLORS.traderPrimary,    secondary: COLORS.traderSecondary,    light: COLORS.traderLight,    text: COLORS.traderText },
  Miller:    { primary: COLORS.millerPrimary,    secondary: COLORS.millerSecondary,    light: COLORS.millerLight,    text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

// Escrow stages for stepper
const STAGES = [
  { key: 'pending_payment', title: 'Pending Payment', icon: 'cash-clock',     desc: 'Waiting for buyer to fund escrow account.' },
  { key: 'funded',          title: 'Funded',           icon: 'bank-check',     desc: 'Escrow secured. Seller to prepare dispatch.' },
  { key: 'dispatched',      title: 'Dispatched',       icon: 'truck-delivery', desc: 'Goods in transit. Lorry receipt uploaded.' },
  { key: 'delivered',       title: 'Delivered',        icon: 'package-check',  desc: 'Goods received at buyer site. Verifying quality.' },
  { key: 'released',        title: 'Released ✓',       icon: 'check-decagram', desc: 'Funds released to seller. Deal complete!' },
];

// Format date display
function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DealDetailsScreen({ route, navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;

  const dealId = route?.params?.dealId || route?.params?.deal?.id || route?.params?.deal?._id;
  const routeDeal = route?.params?.deal || null;

  const [deal, setDeal] = useState(routeDeal);
  const [loading, setLoading] = useState(!routeDeal);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [updatingEscrow, setUpdatingEscrow] = useState(false);

  const loadDeal = useCallback(async (isRefresh = false) => {
    if (!dealId && !routeDeal) {
      setApiError('No deal ID provided.');
      setLoading(false);
      return;
    }
    if (!dealId) { setLoading(false); return; }
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setApiError(null);
      const res = await getDealDetails(dealId);
      const dealData = res?.data?.deal || res?.deal || res?.data || res;
      setDeal(dealData);
    } catch (err) {
      console.error('[DealDetails] loadDeal error:', err);
      setApiError(err?.message || 'Failed to load deal details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dealId, routeDeal]);

  useFocusEffect(
    useCallback(() => {
      loadDeal();
    }, [loadDeal])
  );

  // Determine current user's role in this deal
  const userId = user?._id || user?.id;
  const routeRole = route?.params?.role;
  const isBuyer  = routeRole
    ? routeRole === 'buyer'
    : !!(deal && userId && String(deal.buyerId  || deal.buyer?.id  || deal.buyer?._id)  === String(userId));
  const isSeller = routeRole
    ? routeRole === 'seller'
    : !!(deal && userId && String(deal.sellerId || deal.seller?.id || deal.seller?._id) === String(userId));

  // Escrow action handler
  const handleEscrowUpdate = (newStatus, confirmTitle, confirmMsg) => {
    showAlert({
      type: 'confirm',
      title: confirmTitle,
      message: confirmMsg,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setUpdatingEscrow(true);
              await updateEscrowStatus(deal?.id || deal?._id || dealId, newStatus);
              showAlert({
                type: 'success',
                title: 'Updated!',
                message: `Deal stage updated to "${newStatus.replace('_', ' ')}".`,
              });
              loadDeal(true);
            } catch (err) {
              console.error('[DealDetails] updateEscrowStatus error:', err);
              showAlert({
                type: 'error',
                title: 'Update Failed',
                message: err?.message || 'Could not update escrow status. Please try again.',
              });
            } finally {
              setUpdatingEscrow(false);
            }
          },
        },
      ],
    });
  };

  const handleDispute = () => {
    showAlert({
      type: 'confirm',
      title: 'Raise Dispute / Cancel Deal',
      message: 'Are you sure you want to raise a dispute or cancel this deal? Our team will review and assist you.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Raise Dispute',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingEscrow(true);
              await updateEscrowStatus(deal?.id || deal?._id || dealId, 'cancelled');
              showAlert({
                type: 'info',
                title: 'Dispute Raised',
                message: 'Our support team has been notified. They will contact you within 24 hours.',
              });
              loadDeal(true);
            } catch (err) {
              showAlert({
                type: 'error',
                title: 'Failed',
                message: err?.message || 'Could not raise dispute. Please try again.',
              });
            } finally {
              setUpdatingEscrow(false);
            }
          },
        },
      ],
    });
  };

  // ─── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title="Escrow Deal"
          subtitle={dealId || '—'}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading deal details...</Text>
        </View>
      </SafeScreen>
    );
  }

  // ─── Error (no data) ────────────────────────────────────────────────
  if (apiError && !deal) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title="Escrow Deal"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centeredContainer}>
          <Icon name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Could Not Load Deal</Text>
          <Text style={styles.errorDesc}>{apiError}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => loadDeal()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  const escrowStatus   = deal?.escrowStatus || 'pending_payment';
  const isCancelled    = escrowStatus === 'cancelled';
  const isReleased     = escrowStatus === 'released';
  const currentStageIdx = STAGES.findIndex(s => s.key === escrowStatus);

  // Timestamps per stage
  const stageTimestamps = {
    pending_payment: deal?.createdAt,
    funded:          deal?.fundedAt,
    dispatched:      deal?.dispatchedAt,
    delivered:       deal?.deliveredAt,
    released:        deal?.releasedAt,
  };

  // Determine which CTA to show
  const showFundEscrow   = isBuyer  && escrowStatus === 'pending_payment';
  const showDispatch     = isSeller && escrowStatus === 'funded';
  const showConfirmDelivery = isBuyer && escrowStatus === 'dispatched';
  const showAnyAction    = showFundEscrow || showDispatch || showConfirmDelivery;
  const showRaiseDispute = !isReleased && !isCancelled;

  const finalPrice    = deal?.finalPrice    || deal?.price    || 0;
  const finalQty      = deal?.finalQuantity || deal?.quantity || 0;
  const totalValue    = deal?.totalValue    || (finalPrice * finalQty);
  const commodityName = deal?.commodity?.name || route?.params?.item?.commodityName || '—';
  const tradeType     = deal?.tradeType || 'FOR';

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title="Escrow Deal"
        subtitle={deal?.id || dealId || '—'}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      {/* Error banner */}
      {apiError && deal && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={15} color={COLORS.white} />
          <Text style={styles.errorBannerText}>{apiError}</Text>
          <TouchableOpacity onPress={() => loadDeal(true)} style={styles.retryBadge}>
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
            onRefresh={() => loadDeal(true)}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Cancelled Banner */}
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Icon name="close-circle" size={22} color={COLORS.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cancelledTitle}>Deal Cancelled</Text>
              {deal?.cancelReason && (
                <Text style={styles.cancelledDesc}>{deal.cancelReason}</Text>
              )}
            </View>
          </View>
        )}

        {/* Deal Summary Card */}
        <View style={styles.dealCard}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.commodityTitle}>{commodityName}</Text>
              <Text style={styles.dealMeta}>Deal Date: {formatDate(deal?.createdAt) || '—'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.primary + '15' }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>🔐 Escrow</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.label}>Buyer</Text>
            <Text style={styles.value}>{deal?.buyer?.name || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Seller</Text>
            <Text style={styles.value}>{deal?.seller?.name || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Quantity</Text>
            <Text style={styles.value}>{finalQty} {deal?.unit || ''}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Final Price</Text>
            <Text style={styles.value}>₹{finalPrice.toLocaleString('en-IN')}/{deal?.priceUnit || 'Qt'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Total Value</Text>
            <Text style={[styles.value, { fontWeight: '800', color: theme.primary }]}>
              ₹{Number(totalValue).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Delivery Basis</Text>
            <Text style={styles.value}>{tradeType === 'FOR' ? 'FOR (Freight to Destination)' : 'Ex-Warehouse'}</Text>
          </View>
        </View>

        {/* Escrow Stepper */}
        <View style={styles.stepperContainer}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Escrow & Logistics Progress</Text>

          {STAGES.map((stage, idx) => {
            const isCompleted = !isCancelled && idx < currentStageIdx;
            const isActive    = !isCancelled && idx === currentStageIdx;
            const isFuture    = idx > currentStageIdx;
            const ts          = stageTimestamps[stage.key];

            let iconName  = 'checkbox-blank-circle-outline';
            let iconColor = COLORS.textMuted;
            if (isCancelled && idx === currentStageIdx) {
              iconName  = 'close-circle';
              iconColor = COLORS.error;
            } else if (isCompleted) {
              iconName  = 'check-circle';
              iconColor = COLORS.success;
            } else if (isActive) {
              iconName  = 'circle-slice-8';
              iconColor = theme.primary;
            }

            return (
              <View key={stage.key} style={styles.stepRow}>
                <View style={styles.stepIndicator}>
                  <Icon name={iconName} size={22} color={iconColor} />
                  {idx < STAGES.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: isCompleted ? COLORS.success : '#E9ECEF' }]} />
                  )}
                </View>
                <View style={[styles.stepContent, isActive && styles.activeStepContent]}>
                  <Text style={[
                    styles.stepTitle,
                    isActive     && { color: theme.primary, fontWeight: '800' },
                    isCompleted  && { color: COLORS.success },
                    isFuture     && { color: COLORS.textMuted },
                  ]}>
                    {stage.title}
                  </Text>
                  <Text style={styles.stepDesc}>{stage.desc}</Text>
                  {ts ? (
                    <Text style={styles.stepTimestamp}>✓ {formatDate(ts)}</Text>
                  ) : (
                    isActive && <Text style={styles.stepPending}>Pending action...</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Deal Documents */}
        <View style={styles.docsCard}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Deal Documents</Text>

          <TouchableOpacity
            style={styles.docItem}
            onPress={() => showAlert({ type: 'info', title: 'Contract', message: 'Opening digitally signed tripartite contract agreement.' })}
          >
            <View style={styles.docInfo}>
              <Icon name="file-sign" size={22} color="#007799" />
              <View>
                <Text style={styles.docTitle}>Tripartite Contract Agreement.pdf</Text>
                <Text style={styles.docMeta}>Signed by Buyer, Seller & Escrow Agent</Text>
              </View>
            </View>
            <Icon name="download" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          {(escrowStatus === 'dispatched' || escrowStatus === 'delivered' || escrowStatus === 'released') && (
            <TouchableOpacity
              style={styles.docItem}
              onPress={() => showAlert({ type: 'info', title: 'Commercial Invoice', message: 'Opening seller commercial invoice.' })}
            >
              <View style={styles.docInfo}>
                <Icon name="file-percent" size={22} color="#D69E2E" />
                <View>
                  <Text style={styles.docTitle}>Commercial Invoice.pdf</Text>
                  <Text style={styles.docMeta}>Tax invoice submitted by Seller</Text>
                </View>
              </View>
              <Icon name="download" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}

          {(escrowStatus === 'dispatched' || escrowStatus === 'delivered' || escrowStatus === 'released') && (
            <TouchableOpacity
              style={styles.docItem}
              onPress={() => showAlert({ type: 'info', title: 'Lorry Receipt', message: 'Opening transport lorry receipt.' })}
            >
              <View style={styles.docInfo}>
                <Icon name="file-cabinet" size={22} color="#805AD5" />
                <View>
                  <Text style={styles.docTitle}>Lorry Receipt.pdf</Text>
                  <Text style={styles.docMeta}>Bill of lading uploaded by Seller</Text>
                </View>
              </View>
              <Icon name="download" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Role-Based Escrow Action */}
        {!isCancelled && !isReleased && (
          <View style={styles.actionCard}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>Action Required</Text>

            {showFundEscrow && (
              <View style={styles.actionBlock}>
                <View style={styles.actionDesc}>
                  <Icon name="cash-multiple" size={22} color="#3182CE" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Proceed to Payment</Text>
                    <Text style={styles.actionSubtitle}>
                      Transfer ₹{Number(totalValue).toLocaleString('en-IN')} to BharatVyapar secure escrow to activate this deal.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#3182CE' }]}
                  disabled={updatingEscrow}
                  onPress={() => handleEscrowUpdate(
                    'funded',
                    'Confirm Escrow Payment',
                    `Transfer ₹${Number(totalValue).toLocaleString('en-IN')} to secure escrow account to initiate deal?`
                  )}
                >
                  {updatingEscrow ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Icon name="bank-transfer" size={18} color={COLORS.white} />
                      <Text style={styles.actionBtnText}>Proceed to Payment</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {showDispatch && (
              <View style={styles.actionBlock}>
                <View style={styles.actionDesc}>
                  <Icon name="truck-delivery" size={22} color="#DD6B20" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Mark as Dispatched</Text>
                    <Text style={styles.actionSubtitle}>
                      Payment is secured in escrow. Upload lorry receipt and mark goods as shipped.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#DD6B20' }]}
                  disabled={updatingEscrow}
                  onPress={() => handleEscrowUpdate(
                    'dispatched',
                    'Confirm Dispatch',
                    'Confirm that goods have been dispatched and lorry receipt has been uploaded?'
                  )}
                >
                  {updatingEscrow ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Icon name="truck-fast" size={18} color={COLORS.white} />
                      <Text style={styles.actionBtnText}>Mark as Dispatched</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {showConfirmDelivery && (
              <View style={styles.actionBlock}>
                <View style={styles.actionDesc}>
                  <Icon name="package-check" size={22} color="#38A169" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Confirm Delivery</Text>
                    <Text style={styles.actionSubtitle}>
                      Goods have arrived? Confirm receipt to trigger quality inspection and fund release.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#38A169' }]}
                  disabled={updatingEscrow}
                  onPress={() => handleEscrowUpdate(
                    'delivered',
                    'Confirm Delivery',
                    'Confirm that you have received the goods in good condition? This will trigger quality verification and escrow release.'
                  )}
                >
                  {updatingEscrow ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Icon name="check-circle" size={18} color={COLORS.white} />
                      <Text style={styles.actionBtnText}>Confirm Delivery</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {!showAnyAction && !isCancelled && !isReleased && (
              <View style={styles.waitingBlock}>
                <Icon name="timer-sand" size={22} color={COLORS.textMuted} />
                <Text style={styles.waitingText}>
                  {escrowStatus === 'funded'    ? 'Waiting for Seller to dispatch goods...'
                   : escrowStatus === 'dispatched' ? 'Waiting for Buyer to confirm delivery...'
                   : escrowStatus === 'delivered'  ? 'Quality verification in progress. Funds releasing soon...'
                   : 'Processing...'}
                </Text>
              </View>
            )}

            {/* Raise Dispute / Cancel Link */}
            {showRaiseDispute && (
              <TouchableOpacity style={styles.disputeLink} onPress={handleDispute} disabled={updatingEscrow}>
                <Icon name="alert-octagon-outline" size={16} color={COLORS.error} />
                <Text style={styles.disputeLinkText}>Raise Dispute / Cancel Deal</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Released — Success state */}
        {isReleased && (
          <View style={styles.completedCard}>
            <Icon name="check-decagram" size={36} color={COLORS.success} />
            <Text style={styles.completedTitle}>Deal Successfully Completed! 🎉</Text>
            <Text style={styles.completedDesc}>
              Escrow payment of ₹{Number(totalValue).toLocaleString('en-IN')} released to seller.
              Contract closed on {formatDate(deal?.releasedAt) || '—'}.
            </Text>
          </View>
        )}

        <View style={{ height: h(40) }} />
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
  scrollContent: {
    padding: w(16),
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: w(10),
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: w(14),
    borderWidth: 1.5,
    borderColor: '#FEB2B2',
    marginBottom: h(14),
  },
  cancelledTitle: {
    fontSize: f(14),
    fontWeight: '800',
    color: '#742A2A',
    marginBottom: h(2),
  },
  cancelledDesc: {
    fontSize: f(12),
    color: '#C53030',
    lineHeight: h(16),
  },
  dealCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: h(4),
  },
  commodityTitle: {
    fontSize: f(16),
    fontWeight: '800',
    color: COLORS.text,
  },
  dealMeta: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginTop: h(2),
  },
  badge: {
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: 6,
  },
  badgeText: {
    fontSize: f(10),
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F3F5',
    marginVertical: h(12),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: h(8),
  },
  label: {
    fontSize: f(12),
    color: COLORS.textLight,
  },
  value: {
    fontSize: f(12),
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: w(12),
  },
  // Stepper
  stepperContainer: {
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
  sectionTitle: {
    fontSize: f(14),
    fontWeight: '800',
    marginBottom: h(16),
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: h(4),
  },
  stepIndicator: {
    alignItems: 'center',
    width: w(30),
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: h(4),
    minHeight: h(24),
  },
  stepContent: {
    flex: 1,
    paddingBottom: h(16),
    paddingHorizontal: w(10),
    borderRadius: 8,
    marginBottom: h(2),
  },
  activeStepContent: {
    backgroundColor: '#F8F9FA',
  },
  stepTitle: {
    fontSize: f(13),
    fontWeight: '700',
    color: COLORS.text,
  },
  stepDesc: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginTop: h(2),
    lineHeight: h(14),
  },
  stepTimestamp: {
    fontSize: f(10),
    color: COLORS.success,
    marginTop: h(3),
    fontWeight: '600',
  },
  stepPending: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginTop: h(3),
    fontStyle: 'italic',
  },
  // Documents
  docsCard: {
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
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: h(10),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(10),
    flex: 1,
  },
  docTitle: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.text,
  },
  docMeta: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginTop: h(1),
  },
  // Action Card
  actionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: w(16),
    marginBottom: h(16),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderTopWidth: 3,
    borderTopColor: '#3182CE',
  },
  actionBlock: {
    marginBottom: h(12),
  },
  actionDesc: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: w(10),
    marginBottom: h(12),
  },
  actionTitle: {
    fontSize: f(14),
    fontWeight: '800',
    color: COLORS.text,
  },
  actionSubtitle: {
    fontSize: f(11),
    color: COLORS.textLight,
    lineHeight: h(16),
    marginTop: h(2),
  },
  actionBtn: {
    height: h(46),
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(8),
  },
  actionBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: f(14),
  },
  waitingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(10),
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: w(14),
    marginBottom: h(12),
  },
  waitingText: {
    fontSize: f(12),
    color: COLORS.textLight,
    flex: 1,
    lineHeight: h(17),
  },
  disputeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(6),
    paddingVertical: h(10),
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
    marginTop: h(4),
  },
  disputeLinkText: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.error,
  },
  // Completed
  completedCard: {
    backgroundColor: '#F0FFF4',
    borderRadius: 16,
    padding: w(24),
    marginBottom: h(16),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#9AE6B4',
    gap: h(10),
  },
  completedTitle: {
    fontSize: f(16),
    fontWeight: '800',
    color: '#22543D',
    textAlign: 'center',
  },
  completedDesc: {
    fontSize: f(12),
    color: '#276749',
    textAlign: 'center',
    lineHeight: h(18),
  },
});
