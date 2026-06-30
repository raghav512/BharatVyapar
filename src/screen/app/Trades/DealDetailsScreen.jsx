import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { selectUser, selectSelectedRole } from '../../../store/authSelectors';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, f } from '../../../utils/responsive';
import { showAlert } from '../../../components/CustomAlertBox';
import { getDealDetails, updateEscrowStatus } from '../../../service/buy/buyCommodityService';
import { useTranslation } from '../../../hook/useTranslation';
import DynamicDocumentUploader from '../../../components/DynamicDocumentUploader';
import DebitNoteBottomSheet from '../../../components/DebitNoteBottomSheet';
import { dealService } from '../../../service/trade/deal.service';

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
  const { t } = useTranslation();
  // PERFORMANCE FIX: Two granular selectors — DealDetailsScreen only re-renders
  // when user or selectedRole change, not on profileLoading or other auth fields.
  const user      = useSelector(selectUser);
  const stateRole = useSelector(selectSelectedRole);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;

  const dealId = route?.params?.dealId || route?.params?.deal?.id || route?.params?.deal?._id;
  const routeDeal = route?.params?.deal || null;

  const [deal, setDeal] = useState(routeDeal);
  const [loading, setLoading] = useState(!routeDeal);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [updatingEscrow, setUpdatingEscrow] = useState(false);
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);

  // Fix 2: guard against setState calls after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const loadDeal = useCallback(async (isRefresh = false) => {
    if (!dealId && !routeDeal) {
      if (isMountedRef.current) setApiError(t('No deal ID provided.'));
      if (isMountedRef.current) setLoading(false);
      return;
    }
    if (!dealId) { if (isMountedRef.current) setLoading(false); return; }
    try {
      if (isMountedRef.current) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setApiError(null);
      }
      const res = await getDealDetails(dealId);
      if (!isMountedRef.current) return;
      const dealData = res?.data?.deal || res?.deal || res?.data || res;
      setDeal(dealData);
    } catch (err) {
      console.error('[DealDetails] loadDeal error:', err);
      if (isMountedRef.current) setApiError(err?.message || t('Failed to load deal details.'));
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [dealId, routeDeal, t]);

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
    : !!(deal && userId &&
        String(deal.buyerId  || deal.buyer_id  || deal.buyer?.id  || deal.buyer?._id)  === String(userId));
  const isSeller = routeRole
    ? routeRole === 'seller'
    : !!(deal && userId &&
        String(deal.sellerId || deal.seller_id || deal.seller?.id || deal.seller?._id) === String(userId));

  // ─── Stable callbacks to prevent inline function churn ──────────────────────
  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    loadDeal(true);
  }, [loadDeal]);

  const handleRetry = useCallback(() => {
    loadDeal();
  }, [loadDeal]);

  // Escrow action handler
  const handleEscrowUpdate = useCallback((newStatus, confirmTitle, confirmMsg) => {
    const activeDealId = deal?.id || deal?._id || dealId;
    if (!activeDealId) return;

    showAlert({
      type: 'confirm',
      title: confirmTitle,
      message: confirmMsg,
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Confirm'),
          onPress: async () => {
            try {
              setUpdatingEscrow(true);
              await updateEscrowStatus(activeDealId, newStatus);
              showAlert({
                type: 'success',
                title: t('Updated!'),
                message: t('Deal stage updated to "{status}".').replace('{status}', t(newStatus.replace('_', ' '))),
              });
              loadDeal(true);
            } catch (err) {
              console.error('[DealDetails] updateEscrowStatus error:', err);
              showAlert({
                type: 'error',
                title: t('Update Failed'),
                message: err?.message || t('Could not update escrow status. Please try again.'),
              });
            } finally {
              setUpdatingEscrow(false);
            }
          },
        },
      ],
    });
  }, [deal, dealId, loadDeal, t]);

  const handleDispute = useCallback(() => {
    const activeDealId = deal?.id || deal?._id || dealId;
    if (!activeDealId) return;

    setShowDebitNoteModal(true);
  }, [deal, dealId]);

  const handleSubmitDebitNote = useCallback(async (payload) => {
    const activeDealId = deal?.id || deal?._id || dealId;
    if (!activeDealId) return;
    try {
      setUpdatingEscrow(true);
      await dealService.submitDebitNote(activeDealId, payload);
      showAlert({
        type: 'info',
        title: t('Dispute Raised'),
        message: t('Debit note submitted. Our support team will contact you within 24 hours.'),
      });
      loadDeal(true);
    } catch (err) {
      showAlert({
        type: 'error',
        title: t('Failed'),
        message: err?.message || t('Could not raise dispute. Please try again.'),
      });
    } finally {
      setUpdatingEscrow(false);
    }
  }, [deal, dealId, loadDeal, t]);

  const handleOpenContract = useCallback(() => {
    showAlert({
      type: 'info',
      title: t('Contract'),
      message: t('Opening digitally signed tripartite contract agreement.')
    });
  }, [t]);

  const handleOpenInvoice = useCallback(() => {
    showAlert({
      type: 'info',
      title: t('Commercial Invoice'),
      message: t('Opening seller commercial invoice.')
    });
  }, [t]);

  const handleOpenLorryReceipt = useCallback(() => {
    showAlert({
      type: 'info',
      title: t('Lorry Receipt'),
      message: t('Opening transport lorry receipt.')
    });
  }, [t]);

  const handleFundEscrow = useCallback(() => {
    const totalValue = (deal?.finalPrice || deal?.price || 0) * (deal?.finalQuantity || deal?.quantity || 0);
    handleEscrowUpdate(
      'funded',
      t('Confirm Escrow Payment'),
      t('Transfer ₹{amount} to secure escrow account to initiate deal?').replace('{amount}', Number(totalValue).toLocaleString('en-IN'))
    );
  }, [deal, handleEscrowUpdate, t]);

  const handleMarkDispatched = useCallback(async () => {
    const activeDealId = deal?.id || deal?._id || dealId;
    try {
      setUpdatingEscrow(true);
      // Wait for all 3 docs to be confirmed uploaded
      await dealService.confirmDispatch(activeDealId);
      // Fallback for UI if escrow status hasn't updated immediately
      await updateEscrowStatus(activeDealId, 'dispatched'); 
      loadDeal(true);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingEscrow(false);
    }
  }, [deal, dealId, loadDeal]);

  const handleConfirmDelivery = useCallback(() => {
    handleEscrowUpdate(
      'delivered',
      t('Confirm Delivery'),
      t('Confirm that you have received the goods in good condition? This will trigger quality verification and escrow release.')
    );
  }, [handleEscrowUpdate, t]);

  // ─── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title={t("Escrow Deal")}
          subtitle={dealId || '—'}
          showBackButton={true}
          onBackPress={handleBackPress}
        />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t("Loading deal details...")}</Text>
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
          title={t("Escrow Deal")}
          showBackButton={true}
          onBackPress={handleBackPress}
        />
        <View style={styles.centeredContainer}>
          <Icon name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>{t("Could Not Load Deal")}</Text>
          <Text style={styles.errorDesc}>{t(apiError)}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={handleRetry}>
            <Text style={styles.retryBtnText}>{t("Retry")}</Text>
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
  // We use existing escrowStatus mapped slightly differently for the new flows
  const showFundEscrow   = isBuyer  && escrowStatus === 'pending_payment';
  const showDispatchPO   = isBuyer  && escrowStatus === 'funded'; // PO Upload replaces just "waiting"
  const showReadyToDispatch = isSeller && escrowStatus === 'funded';
  const showDispatchDocs = isSeller && escrowStatus === 'dispatched_pending'; // Custom status for the 3 doc upload
  const showConfirmDelivery = isBuyer && escrowStatus === 'dispatched';
  const showAnyAction    = showFundEscrow || showDispatchPO || showReadyToDispatch || showDispatchDocs || showConfirmDelivery;
  const showRaiseDispute = (escrowStatus === 'delivered' || escrowStatus === 'dispatched');

  const finalPrice    = deal?.finalPrice    || deal?.price    || 0;
  const finalQty      = deal?.finalQuantity || deal?.quantity || 0;
  const totalValue    = deal?.totalValue    || (finalPrice * finalQty);
  // Backend sends commodityName (not name) on the commodity object
  const commodityName = deal?.commodity?.commodityName || deal?.commodity?.name ||
                        route?.params?.item?.commodityName || route?.params?.item?.name || '—';
  const tradeType     = deal?.tradeType || 'FOR';

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title={t("Escrow Deal")}
        subtitle={deal?.id || dealId || '—'}
        showBackButton={true}
        onBackPress={handleBackPress}
      />

      {/* Error banner */}
      {apiError && deal && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={15} color={COLORS.white} />
          <Text style={styles.errorBannerText}>{t(apiError)}</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryBadge}>
            <Text style={styles.retryBadgeText}>{t("Retry")}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Cancelled Banner */}
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Icon name="close-circle" size={22} color={COLORS.error} />
            <View style={styles.flex1}>
              <Text style={styles.cancelledTitle}>{t('Deal Cancelled')}</Text>
              {deal?.cancelReason && (
                <Text style={styles.cancelledDesc}>{t(deal.cancelReason)}</Text>
              )}
            </View>
          </View>
        )}

        {/* Deal Summary Card */}
        <View style={styles.dealCard}>
          <View style={styles.cardHeader}>
            <View style={styles.flex1}>
              <Text style={styles.commodityTitle}>{t(commodityName)}</Text>
              <Text style={styles.dealMeta}>{t('Deal Date: {date}').replace('{date}', formatDate(deal?.createdAt) || '—')}</Text>
            </View>
            <View style={[styles.badge, styles.badgeRow, { backgroundColor: theme.primary + '15' }]}>
              <Icon name="lock" size={12} color={theme.primary} />
              <Text style={[styles.badgeText, { color: theme.primary }]}>{t('Escrow')}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('Buyer')}</Text>
            <Text style={styles.value}>{deal?.buyer?.name || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('Seller')}</Text>
            <Text style={styles.value}>{deal?.seller?.name || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('Quantity')}</Text>
            <Text style={styles.value}>{finalQty} {deal?.unit || ''}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('Final Price')}</Text>
            <Text style={styles.value}>₹{finalPrice.toLocaleString('en-IN')}/{deal?.priceUnit || 'Qt'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('Total Value')}</Text>
            <Text style={[styles.value, styles.boldValue, { color: theme.primary }]}>
              ₹{Number(totalValue).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('Delivery Basis')}</Text>
            <Text style={styles.value}>{tradeType === 'FOR' ? t('FOR (Freight to Destination)') : t('Ex-Warehouse')}</Text>
          </View>
        </View>

        {/* Escrow Stepper */}
        <View style={styles.stepperContainer}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>{t('Escrow & Logistics Progress')}</Text>

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
                    <View style={[styles.stepLine, isCompleted ? styles.stepLineCompleted : styles.stepLinePending]} />
                  )}
                </View>
                <View style={[styles.stepContent, isActive && styles.activeStepContent]}>
                  <Text style={[
                    styles.stepTitle,
                    isActive     && styles.activeStepTitle,
                    isActive     && { color: theme.primary },
                    isCompleted  && styles.completedStepTitle,
                    isFuture     && styles.futureStepTitle,
                  ]}>
                    {t(stage.title)}
                  </Text>
                  <Text style={styles.stepDesc}>{t(stage.desc)}</Text>
                  {ts ? (
                    <Text style={styles.stepTimestamp}>✓ {formatDate(ts)}</Text>
                  ) : (
                    isActive && <Text style={styles.stepPending}>{t('Pending action...')}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Deal Documents */}
        <View style={styles.docsCard}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>{t('Deal Documents')}</Text>

          <TouchableOpacity
            style={styles.docItem}
            onPress={handleOpenContract}
          >
            <View style={styles.docInfo}>
              <Icon name="file-sign" size={22} color="#007799" />
              <View>
                <Text style={styles.docTitle}>{t('Tripartite Contract Agreement.pdf')}</Text>
                <Text style={styles.docMeta}>{t('Signed by Buyer, Seller & Escrow Agent')}</Text>
              </View>
            </View>
            <Icon name="download" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          {(escrowStatus === 'dispatched' || escrowStatus === 'delivered' || escrowStatus === 'released') && (
            <TouchableOpacity
              style={styles.docItem}
              onPress={handleOpenInvoice}
            >
              <View style={styles.docInfo}>
                <Icon name="file-percent" size={22} color="#D69E2E" />
                <View>
                  <Text style={styles.docTitle}>{t('Commercial Invoice.pdf')}</Text>
                  <Text style={styles.docMeta}>{t('Tax invoice submitted by Seller')}</Text>
                </View>
              </View>
              <Icon name="download" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}

          {(escrowStatus === 'dispatched' || escrowStatus === 'delivered' || escrowStatus === 'released') && (
            <TouchableOpacity
              style={styles.docItem}
              onPress={handleOpenLorryReceipt}
            >
              <View style={styles.docInfo}>
                <Icon name="file-cabinet" size={22} color="#805AD5" />
                <View>
                  <Text style={styles.docTitle}>{t('Lorry Receipt.pdf')}</Text>
                  <Text style={styles.docMeta}>{t('Bill of lading uploaded by Seller')}</Text>
                </View>
              </View>
              <Icon name="download" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Role-Based Escrow Action */}
        {!isCancelled && !isReleased && (
          <View style={styles.actionCard}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>{t('Action Required')}</Text>

            {showFundEscrow && (
              <View style={styles.actionBlock}>
                <View style={styles.actionDesc}>
                  <Icon name="cash-multiple" size={22} color="#3182CE" />
                  <View style={styles.flex1}>
                    <Text style={styles.actionTitle}>{t('Proceed to Payment (PO Upload)')}</Text>
                    <Text style={styles.actionSubtitle}>
                      {t('Transfer ₹{amount} and upload Purchase Order (PO) to secure this deal.').replace('{amount}', Number(totalValue).toLocaleString('en-IN'))}
                    </Text>
                  </View>
                </View>
                <DynamicDocumentUploader 
                  docs={['PURCHASE_ORDER']} 
                  onUpload={async (type, file) => {
                    await dealService.uploadDealDocument(deal?.id || deal?._id, type, file);
                  }}
                  onAllUploaded={() => {
                    // Once PO is uploaded, fund escrow
                    handleFundEscrow();
                  }}
                />
              </View>
            )}

            {showReadyToDispatch && (
              <View style={styles.actionBlock}>
                <View style={styles.actionDesc}>
                  <Icon name="truck-delivery" size={22} color="#DD6B20" />
                  <View style={styles.flex1}>
                    <Text style={styles.actionTitle}>{t('Ready to Dispatch?')}</Text>
                    <Text style={styles.actionSubtitle}>
                      {t('Buyer has uploaded PO. Click below to begin uploading dispatch documents (E-Invoice, Kata Parchi, E-Way Bill).')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.dispatchBtn]}
                  disabled={updatingEscrow}
                  onPress={() => handleEscrowUpdate('dispatched_pending', 'Ready to Dispatch', 'Begin dispatch document upload?')}
                >
                  {updatingEscrow ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Icon name="truck-fast" size={18} color={COLORS.white} />
                      <Text style={styles.actionBtnText}>{t('Ready to Dispatch')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {showDispatchDocs && (
              <View style={styles.actionBlock}>
                <View style={styles.actionDesc}>
                  <Icon name="file-document-multiple-outline" size={22} color="#DD6B20" />
                  <View style={styles.flex1}>
                    <Text style={styles.actionTitle}>{t('Upload Dispatch Documents')}</Text>
                    <Text style={styles.actionSubtitle}>
                      {t('Please upload the following 3 documents. The Confirm button will enable once all are uploaded.')}
                    </Text>
                  </View>
                </View>
                
                <DynamicDocumentUploader 
                  docs={['E-Invoice', 'Kata Parchi', 'E-Way Bill']} 
                  onUpload={async (type, file) => {
                    await dealService.uploadDealDocument(deal?.id || deal?._id, type, file);
                  }}
                  onAllUploaded={(done) => {
                    if (done) handleMarkDispatched();
                  }}
                />
              </View>
            )}

            {showConfirmDelivery && (
              <View style={styles.actionBlock}>
                <View style={styles.actionDesc}>
                  <Icon name="package-check" size={22} color="#38A169" />
                  <View style={styles.flex1}>
                    <Text style={styles.actionTitle}>{t('Confirm Delivery')}</Text>
                    <Text style={styles.actionSubtitle}>
                      {t('Goods have arrived? Confirm receipt to trigger quality inspection and fund release.')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deliveryBtn]}
                  disabled={updatingEscrow}
                  onPress={handleConfirmDelivery}
                >
                  {updatingEscrow ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Icon name="check-circle" size={18} color={COLORS.white} />
                      <Text style={styles.actionBtnText}>{t('Confirm Delivery')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {!showAnyAction && !isCancelled && !isReleased && (
              <View style={styles.waitingBlock}>
                <Icon name="timer-sand" size={22} color={COLORS.textMuted} />
                <Text style={styles.waitingText}>
                  {escrowStatus === 'funded'    ? t('Waiting for Seller to dispatch goods...')
                   : escrowStatus === 'dispatched' ? t('Waiting for Buyer to confirm delivery...')
                   : escrowStatus === 'delivered'  ? t('Quality verification in progress. Funds releasing soon...')
                   : t('Processing...')}
                </Text>
              </View>
            )}

            {/* Raise Dispute / Cancel Link */}
            {showRaiseDispute && (
              <TouchableOpacity style={styles.disputeLink} onPress={handleDispute} disabled={updatingEscrow}>
                <Icon name="alert-octagon-outline" size={16} color={COLORS.error} />
                <Text style={styles.disputeLinkText}>{t('Report Quality Issue / Raise Debit Note')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Released — Success state */}
        {isReleased && (
          <View style={styles.completedCard}>
            <Icon name="check-decagram" size={36} color={COLORS.success} />
            <Text style={styles.completedTitle}>{t('Deal Successfully Completed!')}</Text>
            <Text style={styles.completedDesc}>
              {t('Escrow payment of ₹{amount} released to seller.').replace('{amount}', Number(totalValue).toLocaleString('en-IN'))}
              {'\n'}{t('Contract closed on {date}.').replace('{date}', formatDate(deal?.releasedAt) || '—')}
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <DebitNoteBottomSheet 
        visible={showDebitNoteModal}
        onClose={() => setShowDebitNoteModal(false)}
        onSubmit={handleSubmitDebitNote}
        deal={deal}
      />
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
  // Interned helpers — prevent new JSObject allocation every render
  flex1: {
    flex: 1,
  },
  bottomSpacer: {
    height: h(40),
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
  },
  boldValue: {
    fontWeight: '800',
  },
  stepLineCompleted: {
    backgroundColor: COLORS.success,
  },
  stepLinePending: {
    backgroundColor: '#E9ECEF',
  },
  activeStepTitle: {
    fontWeight: '800',
  },
  completedStepTitle: {
    color: COLORS.success,
  },
  futureStepTitle: {
    color: COLORS.textMuted,
  },
  fundBtn: {
    backgroundColor: '#3182CE',
  },
  dispatchBtn: {
    backgroundColor: '#DD6B20',
  },
  deliveryBtn: {
    backgroundColor: '#38A169',
  },
});
