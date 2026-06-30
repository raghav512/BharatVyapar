import React, { useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { selectUser, selectSelectedRole } from '../../../store/authSelectors';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import ReceivedOffersModal from './Marketplace/components/ReceivedOffersModal';
import { w, h, f } from '../../../utils/responsive';
import { getOffers, getReceivedOffers } from '../../../service/buy/buyCommodityService';
import { getSellCommodities } from '../../../service/sell/sellCommodity';
import { getMySubmittedQuotes, getReceivedQuotesOnRequirements } from '../../../service/trade/deal.service';
import { showAlert } from '../../../components/CustomAlertBox';
import { getFriendlyErrorMessage } from '../../../utils/errorUtils';
import { useTranslation } from '../../../hook/useTranslation';

const ROLE_THEMES = {
  FPO:       { primary: COLORS.fpoPrimary,       secondary: COLORS.fpoSecondary,       light: COLORS.fpoLight,       text: COLORS.fpoText },
  Trader:    { primary: COLORS.traderPrimary,    secondary: COLORS.traderSecondary,    light: COLORS.traderLight,    text: COLORS.traderText },
  Miller:    { primary: COLORS.millerPrimary,    secondary: COLORS.millerSecondary,    light: COLORS.millerLight,    text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

const OFFER_STATUS_CONFIG = {
  pending:        { label: 'Awaiting Response',  color: '#718096', bg: '#EDF2F7',  icon: 'clock-outline' },
  in_negotiation: { label: 'In Negotiation',     color: '#6B46C1', bg: '#FAF5FF',  icon: 'swap-horizontal' },
  negotiating:    { label: 'In Negotiation',     color: '#6B46C1', bg: '#FAF5FF',  icon: 'swap-horizontal' },
  countered:      { label: 'Counter Received',   color: '#3182CE', bg: '#EBF8FF',  icon: 'swap-horizontal' },
  accepted:       { label: 'Deal Closed',        color: '#38A169', bg: '#F0FFF4',  icon: 'check-decagram' },
  rejected:       { label: 'Rejected',           color: '#E53E3E', bg: '#FFF5F5',  icon: 'close-circle' },
  expired:        { label: 'Expired',            color: '#718096', bg: '#EDF2F7',  icon: 'timer-off' },
  cancelled:      { label: 'Cancelled',          color: '#718096', bg: '#EDF2F7',  icon: 'close-circle' },
};

const ESCROW_STATUS_CONFIG = {
  pending_payment: { label: 'Payment Pending', color: '#3182CE', bg: '#EBF8FF',  icon: 'cash-clock',     progress: 0.1 },
  funded:          { label: 'Funded',          color: '#DD6B20', bg: '#FFFAF0',  icon: 'bank-check',     progress: 0.4 },
  dispatched:      { label: 'In Transit',      color: '#D69E2E', bg: '#FFFFF0',  icon: 'truck-delivery', progress: 0.6 },
  delivered:       { label: 'Delivered',       color: '#38A169', bg: '#F0FFF4',  icon: 'package-check',  progress: 0.8 },
  released:        { label: 'Completed ✓',     color: '#38A169', bg: '#F0FFF4',  icon: 'check-decagram', progress: 1.0 },
  cancelled:       { label: 'Cancelled',       color: '#E53E3E', bg: '#FFF5F5',  icon: 'close-circle',   progress: 0.0 },
};

const LISTING_STATUS_CONFIG = {
  active:    { label: 'ACTIVE',    color: '#38A169', bg: '#F0FFF4', icon: 'store' },
  sold:      { label: 'SOLD',      color: '#6B46C1', bg: '#FAF5FF', icon: 'check-decagram' },
  expired:   { label: 'EXPIRED',   color: '#718096', bg: '#EDF2F7', icon: 'timer-off' },
  cancelled: { label: 'CANCELLED', color: '#E53E3E', bg: '#FFF5F5', icon: 'close-circle' },
};

function formatRelative(dateStr, t) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h_ = Math.floor(diff / 3600000);
  if (h_ < 1) return t ? t('Just now') : 'Just now';
  if (h_ < 24) return t ? t('{hours}h ago').replace('{hours}', String(h_)) : `${h_}h ago`;
  const d = Math.floor(h_ / 24);
  return t ? t('{days}d ago').replace('{days}', String(d)) : `${d}d ago`;
}

function normalizeStatus(st) {
  if (!st || typeof st !== 'string') return 'pending';
  return st.toLowerCase().replace(/\s+/g, '_');
}

function formatExpiry(expiresAt, t) {
  if (!expiresAt) return null;
  const diff = Math.max(0, new Date(expiresAt) - Date.now());
  if (diff === 0) return t ? t('Expired') : 'Expired';
  const h_ = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h_ > 0) return t ? t('Expires in {hours}h {mins}m').replace('{hours}', String(h_)).replace('{mins}', String(m)) : `Expires in ${h_}h ${m}m`;
  return t ? t('Expires in {mins}m').replace('{mins}', String(m)) : `Expires in ${m}m`;
}

const TAB_FILTERS = ['All', 'Active', 'In Negotiation', 'Accepted', 'Closed'];

const INITIAL_STATE = {
  tradeMode:             'buy',
  activeTab:             'Active',
  selectedCrop:          'All',
  offers:                [],
  sellListings:          [],
  loading:               true,
  refreshing:            false,
  apiError:              null,
  backendCrash:          false,
  selectedOfferForModal: null,
};

function tradesReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, tradeMode: action.mode, selectedCrop: 'All' };
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };
    case 'SET_CROP':
      return { ...state, selectedCrop: action.crop };
    case 'FETCH_START':
      return { ...state, loading: true, apiError: null, backendCrash: false };
    case 'REFRESH_START':
      return { ...state, refreshing: true, apiError: null, backendCrash: false };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        offers:       action.offers,
        sellListings: action.sellListings,
        loading:      false,
        refreshing:   false,
        apiError:     null,
        backendCrash: false,
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        loading:      false,
        refreshing:   false,
        apiError:     action.error,
        backendCrash: false,
      };
    case 'BACKEND_CRASH':
      return {
        ...state,
        loading:      false,
        refreshing:   false,
        apiError:     null,
        backendCrash: true,
        offers:       [],
        sellListings: [],
      };
    case 'SET_MODAL_OFFER':
      return { ...state, selectedOfferForModal: action.offer };
    default:
      return state;
  }
}

export default function TradesScreen({ navigation }) {
  const { t } = useTranslation();
  // PERFORMANCE FIX: Two granular selectors — TradesScreen only re-renders
  // when user or selectedRole change (not profileLoading, sendOtpError, etc.).
  const user      = useSelector(selectUser);
  const stateRole = useSelector(selectSelectedRole);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;

  const [state, dispatch] = useReducer(tradesReducer, INITIAL_STATE);
  const {
    tradeMode, activeTab, selectedCrop, offers, sellListings,
    loading, refreshing, apiError, backendCrash, selectedOfferForModal,
  } = state;

  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);
  const fetchGenerationRef = useRef(0);
  const lastFetchTimeRef = useRef(0);
  const loadingRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const loadData = useCallback(async (isRefresh = false, isBackground = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const thisGeneration = ++fetchGenerationRef.current;

    try {
      if (!isBackground) {
        if (!isMountedRef.current) return;
        if (isRefresh) dispatch({ type: 'REFRESH_START' });
        else           dispatch({ type: 'FETCH_START' });
      }

      // Services now return normalized arrays directly — no more response guessing
      const [offersListRaw, sellList, myQuotes, receivedQuotes] = await Promise.all([
        getOffers({ page: 1, limit: 50 }, { signal: controller.signal }),
        getSellCommodities({ sellerId: user?.id || user?._id }, { signal: controller.signal }),
        getMySubmittedQuotes(user?.id || user?._id),
        getReceivedQuotesOnRequirements(user?.id || user?._id),
      ]);
      
      const offersList = [...(offersListRaw || []), ...(myQuotes || []), ...(receivedQuotes || [])];

      if (thisGeneration !== fetchGenerationRef.current) return;
      if (!isMountedRef.current) return;

      // Enrich sold listings with their accepted deal ID
      const soldListings = sellList.filter(l => l.status === 'sold');
      let enrichedSellListings = sellList;

      if (soldListings.length > 0) {
        enrichedSellListings = await Promise.all(
          sellList.map(async (listing) => {
            if (listing.status !== 'sold') return listing;
            try {
              // getReceivedOffers returns normalized offer[] — use offer.id, offer.dealId directly
              const offers = await getReceivedOffers(listing.id, { signal: controller.signal });
              if (thisGeneration !== fetchGenerationRef.current) return listing;
              const acceptedOffer = offers.find(o => o.status === 'accepted');
              return {
                ...listing,
                _dealId: acceptedOffer?.dealId || null,
                _acceptedOffer: acceptedOffer || null,
              };
            } catch {
              return listing;
            }
          })
        );
      }

      if (thisGeneration !== fetchGenerationRef.current) return;
      if (!isMountedRef.current) return;

      dispatch({
        type: 'FETCH_SUCCESS',
        offers: offersList,
        sellListings: enrichedSellListings,
      });
      lastFetchTimeRef.current = Date.now();

    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;

      if (__DEV__) {
        console.error('[TradesScreen] loadData error:', err);
      } else {
        console.error('[Production TradesScreen] loadData error:', {
          message: err?.message || String(err),
          status: err?.response?.status,
          code: err?.code,
          url: err?.config?.url,
        });
      }

      if (!isMountedRef.current) return;

      const rawMsg = err?.response?.data?.message || err?.message || String(err);
      const errMsg = getFriendlyErrorMessage(rawMsg);

      if (rawMsg.includes("reading '_id'") || rawMsg.includes('null')) {
        dispatch({ type: 'BACKEND_CRASH' });
      } else {
        dispatch({ type: 'FETCH_ERROR', error: errMsg });
        if (isRefresh) {
          showAlert({ type: 'error', title: 'Refresh Failed', message: errMsg });
        }
      }
    } finally {
      if (thisGeneration === fetchGenerationRef.current) {
        isFetchingRef.current = false;
      }
    }
  }, [user?._id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      const cacheExpiry = 30_000;
      const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;

      if (loadingRef.current || timeSinceLastFetch > cacheExpiry) {
        loadData();
      } else {
        loadData(false, true);
      }

      const intervalId = setInterval(() => {
        loadData(false, true);
      }, 300000);

      return () => {
        clearInterval(intervalId);
        abortControllerRef.current?.abort();
      };
    }, [loadData])
  );

  const uniqueOffers = useMemo(() => {
    return Array.from(new Map(
      offers.filter(Boolean).map(o => [o.id || o._id, o])
    ).values());
  }, [offers]);

  const cropChips = useMemo(() => {
    return ['All', ...Array.from(new Set(uniqueOffers.map(o => {
      const commodity = o.commodity || (typeof o.commodityId === 'object' ? o.commodityId : null) || {};
      return commodity.commodityName || commodity.name;
    }).filter(Boolean)))];
  }, [uniqueOffers]);

  const filteredOffers = useMemo(() => {
    return uniqueOffers.filter(offer => {
      const st = normalizeStatus(offer.displayStatus || offer.status);
      
      let tabMatch = true;
      if (activeTab === 'Active') tabMatch = ['pending', 'in_negotiation', 'negotiating', 'countered'].includes(st);
      else if (activeTab === 'In Negotiation') tabMatch = ['in_negotiation', 'negotiating', 'countered'].includes(st);
      else if (activeTab === 'Accepted') tabMatch = (st === 'accepted');
      else if (activeTab === 'Closed') tabMatch = ['rejected', 'expired', 'cancelled'].includes(st);
      
      const commodity = offer.commodity || (typeof offer.commodityId === 'object' ? offer.commodityId : null) || {};
      const cropName = commodity.commodityName || commodity.name || '';
      const cropMatch = selectedCrop === 'All' || cropName === selectedCrop;

      return tabMatch && cropMatch;
    });
  }, [uniqueOffers, activeTab, selectedCrop]);

  const handleOfferPress = useCallback((offer) => {
    const resolvedDealId = offer.dealId || offer.deal?.id || offer.deal?._id;
    const resolvedCommodity = offer.commodity || (typeof offer.commodityId === 'object' ? offer.commodityId : null) || {};
    if (offer.status === 'accepted' && resolvedDealId) {
      navigation.navigate('DealDetails', {
        dealId: resolvedDealId,
        item: resolvedCommodity,
        role: 'buyer',
      });
    } else {
      navigation.navigate('NegotiationDetails', {
        offer: { id: offer.id || offer._id, ...offer },
        item: resolvedCommodity,
        role: 'buyer'
      });
    }
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => {
    if (tradeMode === 'buy') {
      const offer = item;
      const displaySt    = normalizeStatus(offer.displayStatus || offer.status);
      const statusCfg = OFFER_STATUS_CONFIG[displaySt] || OFFER_STATUS_CONFIG.pending;
      const isMyTurn  = offer.currentTurn === 'buyer';
      const isTerminal = ['accepted', 'rejected', 'expired', 'cancelled'].includes(displaySt);
      const history   = offer.negotiationHistory || offer.rounds || [];
      const lastRound = history[history.length - 1];
      const lastPrice = lastRound?.price || offer.price || 0;
      const qty       = offer.quantity || 0;
      const commodity = offer.commodity ||
                        (typeof offer.commodityId === 'object' ? offer.commodityId : null) || {};
      const expiry    = formatExpiry(offer.expiresAt, t);
      const escrowCfg = offer.deal ? (ESCROW_STATUS_CONFIG[offer.deal.escrowStatus] || ESCROW_STATUS_CONFIG.pending_payment) : null;
      const maxRounds = offer.maxNegotiationRounds || commodity?.maxNegotiationRounds || 5;
      const isNegotiable = offer.isNegotiable !== false &&
                           commodity?.isNegotiable !== false;

      const isDeletedListing = !commodity.commodityName && !commodity.name;
      
      const accessibilityLabel = t('Buy offer for {commodity}{variety}. Status: {status}. Your offer price: ₹{price} per {priceUnit}. Quantity: {qty} {unit}.')
        .replace('{commodity}', commodity.commodityName || t('commodity'))
        .replace('{variety}', commodity.type ? t(' variety {type}').replace('{type}', commodity.type) : '')
        .replace('{status}', t(statusCfg.label))
        .replace('{price}', String(offer.price))
        .replace('{priceUnit}', offer.priceUnit || 'Qt')
        .replace('{qty}', String(qty))
        .replace('{unit}', offer.unit || 'Ton');

      const ctaBgColor = isDeletedListing ? '#FFF5F5' : isMyTurn && !isTerminal ? theme.primary + '10' : '#F8F9FA';

      return (
        <TouchableOpacity
          key={offer.id || offer._id || index}
          style={[
            styles.offerCard,
            isMyTurn && !isTerminal && styles.myTurnCard,
            ['in_negotiation', 'negotiating'].includes(displaySt) && !isTerminal && styles.activeNegotiationCard,
            isDeletedListing && styles.deletedListingCard,
          ]}
          onPress={() => {
            if (isDeletedListing) {
              showAlert({ type: 'error', title: t('Listing Removed'), message: t('The seller has deleted this commodity listing. This negotiation is no longer active.') });
              return;
            }
            handleOfferPress(offer);
          }}
          activeOpacity={0.85}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={isMyTurn ? t('Your turn to respond. Double tap to reply to counter offer.') : t('Double tap to view negotiation thread details.')}
        >
          {isMyTurn && !isTerminal && (
            <View style={[styles.yourTurnBanner, { backgroundColor: theme.primary }]}>
              <Icon name="flash" size={13} color={COLORS.white} />
              <Text style={styles.yourTurnText}>{t('Your Turn — Respond Now')}</Text>
            </View>
          )}

          <View style={styles.cardHeader}>
            <View style={styles.cardFlex}>
              {isDeletedListing ? (
                <View style={styles.deletedListingHeader}>
                  <Icon name="cancel" size={14} color={COLORS.error} />
                  <Text style={[styles.cropTitle, { color: COLORS.error }]}>
                    {t('Listing Removed by Seller')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.cropTitle}>
                  {commodity.commodityName || commodity.name || t('Commodity')}
                  {commodity.type ? ` (${commodity.type})` : ''}
                </Text>
              )}
              {(commodity.state || commodity.commodityLocation) && (
                <View style={styles.locationRow}>
                  <Icon name="map-marker-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.locationText}>{commodity.state || commodity.commodityLocation}</Text>
                </View>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Icon name={statusCfg.icon} size={12} color={statusCfg.color} />
              <Text style={[styles.statusText, { color: statusCfg.color }]}>{t(statusCfg.label)}</Text>
            </View>
          </View>

          <View style={styles.priceStrip}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>{t('Your Offer')}</Text>
              <Text style={[styles.priceVal, { color: theme.primary }]}>₹{offer.price}/{offer.priceUnit || 'Qt'}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>{t('Latest Price')}</Text>
              <Text style={[styles.priceVal, { color: lastPrice !== offer.price ? '#DD6B20' : COLORS.text }]}>
                ₹{lastPrice}/{offer.priceUnit || 'Qt'}
              </Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>{t('Quantity')}</Text>
              <Text style={styles.priceVal}>{qty} {offer.unit || 'Ton'}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            {isNegotiable && offer.roundCount != null && (
              <View style={styles.metaChip}>
                <Icon name="refresh-circle" size={12} color={COLORS.textMuted} />
                <Text style={styles.metaChipText}>{t('Round {current}/{max}').replace('{current}', String(offer.roundCount)).replace('{max}', String(maxRounds))}</Text>
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
              <Text style={styles.metaChipText}>{formatRelative(offer.createdAt, t)}</Text>
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
                <Text style={[styles.metaChipText, { color: '#38A169' }]}>{t('Escrow Secured')}</Text>
              </View>
            )}
          </View>

          {offer.status === 'accepted' && escrowCfg && (
            <View style={styles.dealBlock}>
              <View style={styles.dealHeader}>
                <Icon name={escrowCfg.icon} size={14} color={escrowCfg.color} />
                <Text style={[styles.dealStatus, { color: escrowCfg.color }]}>{t(escrowCfg.label)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${escrowCfg.progress * 100}%`, backgroundColor: escrowCfg.color }]} />
              </View>
            </View>
          )}

          <View style={[styles.ctaRow, { backgroundColor: ctaBgColor }]}>
            <Icon
              name={
                isDeletedListing
                  ? 'alert-circle-outline'
                  : offer.status === 'accepted'
                  ? 'link-variant'
                  : isMyTurn
                  ? 'reply'
                  : 'forum-outline'
              }
              size={14}
              color={isDeletedListing ? COLORS.error : isMyTurn && !isTerminal ? theme.primary : COLORS.textMuted}
              style={styles.ctaIconMargin}
            />
            <Text style={[styles.ctaText, { color: isDeletedListing ? COLORS.error : isMyTurn && !isTerminal ? theme.primary : COLORS.textMuted }]}>
              {isDeletedListing
                ? t('Item no longer available')
                : offer.status === 'accepted'
                ? t('View Escrow Deal')
                : isMyTurn
                ? t('Respond to Counter')
                : t('View Negotiation Thread')}
            </Text>
            {!isDeletedListing && (
              <Icon name="chevron-right" size={16} color={isMyTurn && !isTerminal ? theme.primary : COLORS.textMuted} />
            )}
          </View>
        </TouchableOpacity>
      );
    } else {
      const listing = item;
      const id = listing._id || listing.id;
      if (!id) return null;

      const rawStatus = (listing.status || 'active').toLowerCase();
      const statusCfg = LISTING_STATUS_CONFIG[rawStatus] || LISTING_STATUS_CONFIG.active;
      const isSold    = rawStatus === 'sold';
      const isActive  = rawStatus === 'active';

      const crop     = listing.commodityName || '—';
      const variety  = listing.type || null;
      const quantity = `${listing.quantity ?? '?'} ${listing.unit || ''}`.trim();
      const price    = listing.sellingPrice != null ? String(listing.sellingPrice) : 'N/A';
      const priceUnit = listing.sellingPriceUnit || 'Qt';
      const location = listing.commodityLocation || '—';
      const isNegotiableListing = listing.isNegotiable !== false;
      const tradeType = listing.tradeType || listing.deliveryType || 'FOR';
      const normalizedTradeType = tradeType === 'EX_WAREHOUSE' ? 'EX-Warehouse' : tradeType;

      const dealId   = listing._dealId || null;
      const dealObj  = listing._deal   || null;
      const escrowSt = dealObj?.escrowStatus || null;
      const escrowCfg = escrowSt ? (ESCROW_STATUS_CONFIG[escrowSt] || ESCROW_STATUS_CONFIG.pending_payment) : null;

      const acceptedOffer = listing._acceptedOffer || null;
      const buyerObj  = acceptedOffer?.buyerId || acceptedOffer?.buyer || {};
      const buyerName = buyerObj.firstName
        ? `${buyerObj.firstName} ${buyerObj.lastName || ''}`.trim()
        : buyerObj.name || t('Buyer');

      const handlePress = () => {
        if (isSold) {
          navigation.navigate('DealDetails', {
            dealId: dealId || listing.dealId || listing.deal?._id || listing.deal?.id,
            deal: dealObj,
            item: { id, commodityName: crop, type: variety, ...listing },
            role: 'seller',
          });
        } else {
          dispatch({ type: 'SET_MODAL_OFFER', offer: { id, commodityName: crop, type: variety, ...listing } });
        }
      };

      const accessibilityLabel = t('Sell listing for {crop}{variety}. Status: {status}. Price: ₹{price} per {priceUnit}. Quantity: {quantity}. Trade basis: {tradeType}.')
        .replace('{crop}', crop)
        .replace('{variety}', variety ? t(' variety {type}').replace('{type}', variety) : '')
        .replace('{status}', t(statusCfg.label))
        .replace('{price}', price)
        .replace('{priceUnit}', priceUnit)
        .replace('{quantity}', quantity)
        .replace('{tradeType}', normalizedTradeType);

      return (
        <TouchableOpacity
          key={id}
          style={[
            styles.offerCard,
            isSold && styles.soldListingCard,
          ]}
          onPress={handlePress}
          activeOpacity={0.85}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={isSold ? t('Deal closed. Double tap to view escrow deal details.') : t('Listing active. Double tap to view received buyer offers.')}
        >
          {isSold && (
            <View style={[styles.yourTurnBanner, { backgroundColor: '#6B46C1' }]}>
              <Icon name="check-decagram" size={13} color={COLORS.white} />
              <Text style={styles.yourTurnText}>{t('Deal Closed — View Escrow Progress')}</Text>
            </View>
          )}

          <View style={styles.cardHeader}>
            <View style={styles.cardFlex}>
              <Text style={styles.cropTitle}>
                {crop}{variety ? ` (${variety})` : ''}
              </Text>
              <View style={styles.locationRow}>
                <Icon name="map-marker-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.locationText}>{location}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Icon name={statusCfg.icon} size={12} color={statusCfg.color} />
              <Text style={[styles.statusText, { color: statusCfg.color }]}>{t(statusCfg.label)}</Text>
            </View>
          </View>

          <View style={styles.priceStrip}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>{t('Price / {unit}').replace('{unit}', priceUnit)}</Text>
              <Text style={[styles.priceVal, { color: theme.primary }]}>₹{price}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>{t('Quantity')}</Text>
              <Text style={styles.priceVal}>{quantity}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>{t('Trade Basis')}</Text>
              <Text style={styles.priceVal}>{normalizedTradeType}</Text>
            </View>
          </View>

          {isSold && buyerObj.firstName && (
            <View style={styles.buyerMetaRowSold}>
              <View style={[styles.metaChip, { borderColor: '#C3DAFE', backgroundColor: '#EBF4FF' }]}>
                <Icon name="account-check" size={12} color="#3182CE" />
                <Text style={[styles.metaChipText, { color: '#3182CE' }]}>{t('Buyer: {name}').replace('{name}', buyerName)}</Text>
              </View>
            </View>
          )}

          {(isActive || listing.escrowEnabled) && (
            <View style={styles.metaRow}>
              {isActive && (isNegotiableListing ? (
                <View style={[styles.metaChip, { borderColor: theme.primary + '30', backgroundColor: theme.primary + '08' }]}>
                  <Icon name="handshake-outline" size={12} color={theme.primary} />
                  <Text style={[styles.metaChipText, { color: theme.primary }]}>{t('Negotiation ON')}</Text>
                </View>
              ) : (
                <View style={[styles.metaChip, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}>
                  <Icon name="lock-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.metaChipText}>{t('Fixed Price')}</Text>
                </View>
              ))}
              {listing.escrowEnabled && (
                <View style={[styles.metaChip, { borderColor: '#9AE6B4', backgroundColor: '#F0FFF4' }]}>
                  <Icon name="shield-check" size={12} color="#38A169" />
                  <Text style={[styles.metaChipText, { color: '#38A169' }]}>{t('Escrow Secured')}</Text>
                </View>
              )}
            </View>
          )}

          {isSold && escrowCfg && (
            <View style={styles.dealBlock}>
              <View style={styles.dealHeader}>
                <Icon name={escrowCfg.icon} size={14} color={escrowCfg.color} />
                <Text style={[styles.dealStatus, { color: escrowCfg.color }]}>{t(escrowCfg.label)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${escrowCfg.progress * 100}%`, backgroundColor: escrowCfg.color }]} />
              </View>
            </View>
          )}

          <View style={[styles.ctaRow, { backgroundColor: isSold ? '#FAF5FF' : '#F8F9FA' }]}>
            <Icon
              name={
                isSold
                  ? 'link-variant'
                  : isActive
                  ? 'download-outline'
                  : 'clipboard-text-outline'
              }
              size={14}
              color={isSold ? '#6B46C1' : theme.primary}
              style={styles.ctaIconMargin}
            />
            <Text style={[styles.ctaText, { color: isSold ? '#6B46C1' : theme.primary }]}>
              {isSold
                ? t('View Escrow Deal Details')
                : isActive
                ? t('View Received Buyer Offers')
                : t('View Offer History')}
            </Text>
            <Icon name="chevron-right" size={16} color={isSold ? '#6B46C1' : theme.primary} />
          </View>
        </TouchableOpacity>
      );
    }
  }, [tradeMode, theme, handleOfferPress, navigation, t]);

  const handleRefresh = useCallback(() => loadData(true), [loadData]);

  const flatListStyle = useMemo(() => ({
    backgroundColor: theme.light,
  }), [theme.light]);

  const flatListContentStyle = useMemo(() => [
    styles.listContent,
  ], []);

  const listHeader = useMemo(() => {
    return (
      <View>
        {apiError && (
          <View style={styles.errorBanner} accessible={true} accessibilityLabel={t('Error: {msg}').replace('{msg}', t(apiError))}>
            <Icon name="alert-circle-outline" size={15} color={COLORS.white} />
            <Text style={styles.errorBannerText}>{t(apiError)}</Text>
            <TouchableOpacity
              onPress={() => loadData(true)}
              style={styles.retryBadge}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('Retry loading data')}
            >
              <Text style={styles.retryBadgeText}>{t('Retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.switcherContainer}>
          <TouchableOpacity
            style={[styles.switcherBtn, tradeMode === 'buy' && { backgroundColor: theme.primary }]}
            onPress={() => dispatch({ type: 'SET_MODE', mode: 'buy' })}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('My Offers (Buying)')}
            accessibilityState={{ selected: tradeMode === 'buy' }}
          >
            <Text style={[styles.switcherText, tradeMode === 'buy' && styles.switcherTextActive]}>
              {t('My Offers (Buying)')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switcherBtn, tradeMode === 'sell' && { backgroundColor: theme.primary }]}
            onPress={() => dispatch({ type: 'SET_MODE', mode: 'sell' })}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('My Listings (Selling)')}
            accessibilityState={{ selected: tradeMode === 'sell' }}
          >
            <Text style={[styles.switcherText, tradeMode === 'sell' && styles.switcherTextActive]}>
              {t('My Listings (Selling)')}
            </Text>
          </TouchableOpacity>
        </View>

        {tradeMode === 'buy' && (
          <>
            <View style={styles.tabBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent} keyboardShouldPersistTaps="handled">
                {TAB_FILTERS.map(tab => {
                  const isActive = tab === activeTab;
                  const inNegBadge = tab === 'In Negotiation' &&
                    uniqueOffers.some(o => ['in_negotiation', 'negotiating', 'countered'].includes(normalizeStatus(o.displayStatus || o.status)) && o.currentTurn === 'buyer');
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[
                        styles.tabChip,
                        isActive && { backgroundColor: theme.primary },
                        inNegBadge && { flexDirection: 'row', alignItems: 'center', gap: w(4) }
                      ]}
                      onPress={() => dispatch({ type: 'SET_TAB', tab })}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={t('{tab} filter').replace('{tab}', t(tab))}
                      accessibilityState={{ selected: isActive }}
                      accessibilityHint={inNegBadge ? t('Counter offer received from seller. Tapping filters list to items awaiting your response.') : t('Filters offers to show {tab}').replace('{tab}', t(tab))}
                    >
                      <Text style={[styles.tabChipText, isActive && { color: COLORS.white }]}>
                        {t(tab)}
                      </Text>
                      {inNegBadge && (
                        <Icon name="circle" size={8} color={COLORS.error} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {cropChips.length > 2 && (
              <View style={styles.cropChipsBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropChipsContent} keyboardShouldPersistTaps="handled">
                  {cropChips.map(crop => (
                    <TouchableOpacity
                      key={crop}
                      style={[styles.cropChip, selectedCrop === crop && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]}
                      onPress={() => dispatch({ type: 'SET_CROP', crop })}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={crop === 'All' ? t('All crop filter') : t('{crop} crop filter').replace('{crop}', crop)}
                      accessibilityState={{ selected: selectedCrop === crop }}
                    >
                      <Text style={[styles.cropChipText, selectedCrop === crop && { color: theme.primary, fontWeight: '700' }]}>
                        {crop === 'All' ? t('All') : crop}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}

        <Text style={[styles.countLabel, { color: theme.primary, marginHorizontal: w(16), marginTop: h(12) }]} accessibilityLiveRegion="polite">
          {tradeMode === 'buy'
            ? (filteredOffers.length === 1
                ? t('1 offer')
                : t('{count} offers').replace('{count}', String(filteredOffers.length)))
            : (sellListings.length === 1
                ? t('1 active listing for sale')
                : t('{count} active listings for sale').replace('{count}', String(sellListings.length)))
          }
        </Text>
      </View>
    );
  }, [apiError, tradeMode, activeTab, selectedCrop, cropChips, filteredOffers.length, sellListings.length, uniqueOffers, theme, loadData, t]);

  const listEmpty = useMemo(() => {
    if (apiError) return null;
    if (tradeMode === 'buy') {
      if (filteredOffers.length > 0) return null;
      return (
        <View style={styles.emptyState} accessible={true}>
          {backendCrash ? (
            <>
              <Icon name="package-variant-closed-remove" size={80} color="#E53E3E" style={{ opacity: 0.8 }} />
              <Text style={styles.emptyTitle}>{t('Listings Removed')}</Text>
              <Text style={styles.emptyText}>
                {t('The seller has permanently removed this commodity from the marketplace.')}
              </Text>
            </>
          ) : (
            <>
              <Icon name="handshake-outline" size={56} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>{t('No Offers Found')}</Text>
              <Text style={styles.emptyText}>
                {activeTab === 'All'
                  ? t("You haven't submitted any offers yet.\nBrowse the marketplace to find commodities.")
                  : t('No offers with "{status}" status.').replace('{status}', t(activeTab))}
              </Text>
            </>
          )}
          {activeTab === 'All' && !backendCrash && (
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('Market')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('Browse Marketplace')}
              accessibilityHint={t('Navigate to browse commodities marketplace screen')}
            >
              <Icon name="store-outline" size={16} color={COLORS.white} />
              <Text style={styles.browseBtnText}>{t('Browse Marketplace')}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    } else {
      if (sellListings.length > 0) return null;
      return (
        <View style={styles.emptyState} accessible={true}>
          <Icon name="store-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>{t('No Active Listings')}</Text>
          <Text style={styles.emptyText}>
            {t("You haven't listed any crops for sale in the marketplace yet.")}
          </Text>
          <TouchableOpacity
            style={[styles.browseBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('Sell')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('Create Sell Offer')}
            accessibilityHint={t('Navigate to list a new crop for sale')}
          >
            <Icon name="plus-circle-outline" size={16} color={COLORS.white} />
            <Text style={styles.browseBtnText}>{t('Create Sell Offer')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }, [apiError, tradeMode, filteredOffers.length, sellListings.length, backendCrash, activeTab, theme.primary, navigation, t]);

  const keyExtractor = useCallback((item, index) => {
    return item?.id || item?._id || String(index);
  }, []);

  if (loading) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title={t('My Trades')}
          subtitle={t('Your offers, negotiations & deals')}
          showBackButton={false}
        />
        <View style={styles.centeredContainer} accessible={true}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('Loading your trades...')}</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={flatListStyle} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title={t('My Trades')}
        subtitle={t('Your offers, negotiations & deals')}
        showBackButton={false}
      />

      <FlatList
        data={tradeMode === 'buy' ? filteredOffers : sellListings}
        keyExtractor={keyExtractor}
        contentContainerStyle={flatListContentStyle}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        renderItem={renderItem}
      />

      <ReceivedOffersModal
        visible={!!selectedOfferForModal}
        onClose={() => dispatch({ type: 'SET_MODAL_OFFER', offer: null })}
        item={selectedOfferForModal}
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
    paddingHorizontal: w(16),
    paddingVertical: h(8),
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
    paddingHorizontal: w(22),
    paddingVertical: h(12),
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
  // Replaces old lockedCard — in_negotiation means YOUR own negotiation is active (not a lock)
  activeNegotiationCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#6B46C1',
    borderColor: '#E9D8FD',
  },
  yourTurnBanner: {
    paddingHorizontal: w(16),
    paddingVertical: h(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(6),
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
  // Buy/Sell switcher styles
  switcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#EDF2F7',
    borderRadius: 10,
    marginHorizontal: w(16),
    marginTop: h(12),
    padding: w(3),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switcherBtn: {
    flex: 1,
    paddingVertical: h(10),
    paddingHorizontal: w(12),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherText: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.textLight,
  },
  switcherTextActive: {
    color: COLORS.white,
  },
  // Crop Chips filter styles
  cropChipsBar: {
    backgroundColor: COLORS.white,
    paddingVertical: h(6),
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  cropChipsContent: {
    paddingHorizontal: w(16),
    gap: w(6),
  },
  cropChip: {
    paddingHorizontal: w(10),
    paddingVertical: h(4),
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: COLORS.white,
  },
  cropChipText: {
    fontSize: f(11),
    color: COLORS.textMuted,
  },
  // Interned helpers — prevent new JSObject allocation every renderItem call
  cardFlex: {
    flex: 1,
  },
  deletedListingCard: {
    opacity: 0.6,
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  deletedListingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
  },
  soldListingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#6B46C1',
    borderColor: '#E9D8FD',
  },
  buyerMetaRowSold: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: w(6),
    paddingHorizontal: w(14),
    marginBottom: h(10),
  },
});
