import React, { useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { selectResolvedRole, selectUser } from '../../../../store/authSelectors';
import { useTranslation } from '../../../../hook/useTranslation';
import { SafeScreen } from '../../../../components/SafeScreen';
import AppHeader from '../../../../components/AppHeader';
import COLORS from '../../../../constant/colors';
import { w, h, f, mw } from '../../../../utils/responsive';
import { showAlert } from '../../../../components/CustomAlertBox';
import { getSellCommodities, deleteSellCommodity } from '../../../../service/sell/sellCommodity';
import { getReceivedOffers } from '../../../../service/buy/buyCommodityService';
import { getFriendlyErrorMessage } from '../../../../utils/errorUtils';
import { normalizeCommodity } from '../../../../service/normalizers/commodity.normalizer';
import { requirementService } from '../../../../service/trade/requirement.service';
import { submitQuoteAgainstRequirement } from '../../../../service/trade/deal.service';
import FulfillRequirementBottomSheet from '../../../../components/FulfillRequirementBottomSheet';
const ROLE_THEMES = {
  FPO:       { primary: COLORS.fpoPrimary,       secondary: COLORS.fpoSecondary,       light: COLORS.fpoLight,       text: COLORS.fpoText },
  Trader:    { primary: COLORS.traderPrimary,    secondary: COLORS.traderSecondary,    light: COLORS.traderLight,    text: COLORS.traderText },
  Miller:    { primary: COLORS.millerPrimary,    secondary: COLORS.millerSecondary,    light: COLORS.millerLight,    text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

const PAGE_SIZE = 10;

// ─── Error classifier ─────────────────────────────────────────────────────────
// Centralizes all error-to-message logic using generic utility formatting
function classifyError(err) {
  if (!err) return 'Something went wrong. Please try again.';
  
  if (err?.response?.status === 401) return 'Session expired. Please log in again.';
  if (err?.response?.status === 403) return 'You do not have permission to view listings.';
  
  return getFriendlyErrorMessage(err);
}

// ─── Safe: extract moisture from qualityParameters array ─────────────────
function getMoistureFromParams(params) {
  if (!Array.isArray(params) || params.length === 0) return null;
  try {
    const found = params.find(p =>
      typeof p?.parameterName === 'string' &&
      p.parameterName.toLowerCase().includes('moisture'),
    );
    return found?.parameterValue ?? null;
  } catch {
    return null;
  }
}

// ─── Safe status label ────────────────────────────────────
// ─── Safe status label ────────────────────────────────────
function safeStatusLabel(status) {
  if (!status) return 'CLOSED';
  if (status === 'sold') return 'SOLD';
  return String(status).toUpperCase();
}

// ─── Safe price display ──────────────────────────────────
function safePriceDisplay(price) {
  if (price == null) return null;
  const n = Number(price);
  if (isNaN(n) || n <= 0) return null;
  try {
    return n.toLocaleString('en-IN');
  } catch {
    return String(n);
  }
}

// ─── Safe ISO date split ─────────────────────────────────
function safeDateDisplay(date) {
  if (!date) return null;
  try {
    return String(date).split('T')[0] || null;
  } catch {
    return null;
  }
}

// ─── Error Boundary Fallback UI Component ──────────────────────────────────────────
function BoundaryFallback({ errorMessage, onReset }) {
  const { t } = useTranslation();
  return (
    <View style={boundaryStyles.container}>
      <Icon name="alert-circle-outline" size={56} color={COLORS.textMuted} />
      <Text style={boundaryStyles.title}>{t('Something Went Wrong')}</Text>
      <Text style={boundaryStyles.msg}>{t(errorMessage)}</Text>
      <TouchableOpacity style={boundaryStyles.btn} onPress={onReset}>
        <Icon name="refresh" size={16} color={COLORS.white} />
        <Text style={boundaryStyles.btnText}>{t('Try Again')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────────
class MarketplaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown render error' };
  }

  componentDidCatch(error, info) {
    if (__DEV__) {
      console.error('[Marketplace ErrorBoundary]', error, info?.componentStack);
    } else {
      console.error('[Production Marketplace ErrorBoundary]', error, info);
    }
  }

  handleReset() {
    this.setState({ hasError: false, errorMessage: '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <BoundaryFallback
          errorMessage={this.state.errorMessage}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

const boundaryStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: w(24), backgroundColor: COLORS.white },
  title:     { fontSize: f(16), fontWeight: '800', color: COLORS.text, marginTop: h(12) },
  msg:       { fontSize: f(12), color: COLORS.textMuted, marginTop: h(6), textAlign: 'center', lineHeight: h(19) },
  btn:       { flexDirection: 'row', alignItems: 'center', gap: w(6), paddingHorizontal: w(22), paddingVertical: h(10), borderRadius: mw(10), marginTop: h(20), backgroundColor: COLORS.fpoPrimary },
  btnText:   { color: COLORS.white, fontWeight: '700', fontSize: f(13) },
});

// ─── Reducer ───────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  listings:      [],
  loading:       true,
  refreshing:    false,
  loadingMore:   false,
  searching:     false,   // true only during a search/filter re-fetch (not initial load)
  error:         null,
  hasMore:       true,
  isInitialLoad: true,    // true until the very first successful fetch completes
  searchText:    '',
  selectedCrop:  'All',
  dynamicCrops:  ['All'],
  activeTab:     'OFFERS', // 'OFFERS' or 'DEMANDS'
};

function marketplaceReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START_FRESH':
      // Only used for the very first load — shows full skeleton
      return { ...state, loading: true, searching: false, error: null };
    case 'FETCH_START_SEARCH':
      // Used for search/filter re-fetches — keeps existing listings visible, shows subtle spinner
      return { ...state, searching: true, refreshing: false, error: null };
    case 'FETCH_START_REFRESH':
      return { ...state, refreshing: true, searching: false, error: null };
    case 'FETCH_START_MORE':
      return { ...state, loadingMore: true };

    case 'FETCH_SUCCESS_REPLACE':
      return {
        ...state,
        listings:      action.items,
        dynamicCrops:  action.crops,
        hasMore:       action.hasMore,
        loading:       false,
        refreshing:    false,
        searching:     false,
        isInitialLoad: false,   // after first successful fetch, never show full skeleton again
        error:         null,
      };
    case 'FETCH_SUCCESS_APPEND':
      return {
        ...state,
        listings:    [...state.listings, ...action.items],
        hasMore:     action.hasMore,
        loadingMore: false,
      };

    case 'FETCH_ERROR':
      return { ...state, loading: false, refreshing: false, searching: false, loadingMore: false, error: action.error };

    case 'SET_SEARCH':
      return {
        ...state,
        searchText:   action.text,
        selectedCrop: action.resetCrop ? 'All' : state.selectedCrop,
      };
    case 'SET_CROP':
      return {
        ...state,
        selectedCrop: action.crop,
        searchText:   action.clearSearch ? '' : state.searchText,
      };
    case 'SET_TAB':
      return {
        ...state,
        activeTab: action.tab,
        listings: [],
        error: null,
        loading: true
      };

    case 'RESET_HAS_MORE':
      return { ...state, hasMore: true };

    case 'UPDATE_ITEM': {
      const updated = state.listings.map(item =>
        item.id === action.item.id ? action.item : item,
      );
      return { ...state, listings: updated };
    }
    case 'REMOVE_ITEM':
      return { ...state, listings: state.listings.filter(item => item.id !== action.id) };

    default:
      return state;
  }
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonBoxLabel} />
        <View style={styles.skeletonBoxBadge} />
      </View>
      <View style={styles.skeletonBoxTitle} />
      <View style={styles.skeletonBoxSubtitle} />
      <View style={styles.skeletonBoxCTA} />
    </View>
  );
}

// ─── Offer Card ───────────────────────────────────────────────────────────────
function offerCardPropsAreEqual(prev, next) {
  if (prev.isOwner !== next.isOwner) return false;
  if (prev.theme?.primary !== next.theme?.primary) return false;
  const po = prev.offer;
  const no = next.offer;
  if (!po || !no) return po === no;
  return (
    po.id            === no.id            &&
    po.name          === no.name          &&
    po.variety       === no.variety       &&
    po.quantityLabel === no.quantityLabel &&
    po.price         === no.price         &&
    po.priceUnit     === no.priceUnit     &&
    po.location      === no.location      &&
    po.moisture      === no.moisture      &&
    po.isNegotiable  === no.isNegotiable  &&
    po.deliveryType  === no.deliveryType  &&
    po.status        === no.status        &&
    po.sellerName    === no.sellerName    &&
    po.sellerRole    === no.sellerRole    &&
    po.shopName      === no.shopName
  );
}

const OfferCard = React.memo(function OfferCard({ offer, theme, onPress, onEditPress, onDeletePress, isOwner }) {
  const { t } = useTranslation();
  if (!offer || !theme) return null;

  const roleTheme = ROLE_THEMES[offer.sellerRole] || theme;
  const isExpired =
    offer.status === 'expired' ||
    offer.status === 'sold'    ||
    offer.status === 'cancelled';

  const priceDisplay = safePriceDisplay(offer.price);
  
  const accessibilityLabel = `Listing for ${offer.name}${offer.variety ? ` variety ${offer.variety}` : ''}, quantity ${offer.quantityLabel}, price ${priceDisplay ? `₹${priceDisplay} per ${offer.priceUnit}` : 'Negotiable'}, located in ${offer.location}. Published by ${offer.sellerName}${offer.shopName ? ` of ${offer.shopName}` : ''}. Status: ${offer.status}.`;

  return (
    <View
      style={[styles.offerCard, isExpired && styles.offerCardDimmed]}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
    >
      {/* Publisher Row */}
      <View style={styles.publisherRow}>
        <View style={styles.publisherInfo}>
          <Icon name="account-circle-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.publisherName} numberOfLines={1}>
            {offer.sellerName || t('Unknown Seller')}{offer.shopName ? ` (${offer.shopName})` : ''}
          </Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: roleTheme.primary + '18' }]}>
          <Text style={[styles.roleBadgeText, { color: roleTheme.primary }]}>
            {t(offer.sellerRole) || t('Seller')}
          </Text>
        </View>
      </View>

      {/* Crop + Location */}
      <View style={styles.offerHeader}>
        <View style={styles.cropInfoWrapper}>
          <Text style={styles.offerCrop} numberOfLines={1}>
            {t(offer.name) || '—'}
            {offer.variety ? ` (${t(offer.variety)})` : ''}
          </Text>
          <View style={styles.locationRow}>
            <Icon name="map-marker-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.offerLocation}>{t(offer.location) || '—'}</Text>
          </View>
        </View>

        {isExpired && (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredBadgeText}>
              {t(safeStatusLabel(offer.status))}
            </Text>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.detailsRow}>
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>{t('Quantity')}</Text>
          <Text style={styles.detailVal}>
            {offer.quantityLabel ? offer.quantityLabel.split(' ').map(word => t(word)).join(' ') : '—'}
          </Text>
        </View>

        <View style={[styles.detailCol, styles.detailColCenter]}>
          <Text style={styles.detailLabel}>{t('Price')} / {t(offer.priceUnit || 'Qt')}</Text>
          <Text style={[styles.detailVal, { color: theme.primary }]}>
            {priceDisplay ? `₹${priceDisplay}` : t('N/A')}
          </Text>
        </View>

        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>{t('Moisture')}</Text>
          <Text style={styles.detailVal}>{offer.moisture || '—'}</Text>
        </View>
      </View>

      {/* Flags */}
      <View style={styles.flagsRow}>
        {offer.isNegotiable && (
          <View style={[styles.flag, { backgroundColor: theme.primary + '12' }]}>
            <Icon name="handshake-outline" size={11} color={theme.primary} />
            <Text style={[styles.flagText, { color: theme.primary }]}>{t('Negotiable')}</Text>
          </View>
        )}

        {offer.deliveryType === 'FOR' && (
          <View style={styles.flagFOR}>
            <Icon name="truck-delivery-outline" size={11} color="#388E3C" />
            <Text style={styles.flagTextFOR}>{t('FOR')}</Text>
          </View>
        )}

        {offer.deliveryType === 'EX-Warehouse' && (
          <View style={styles.flagWarehouse}>
            <Icon name="warehouse" size={11} color="#F57C00" />
            <Text style={styles.flagTextWarehouse}>{t('Ex-Warehouse')}</Text>
          </View>
        )}
      </View>

      {/* Action Buttons Row */}
      {!isExpired && (
        <View style={styles.actionButtonsRow}>
          {isOwner && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => onDeletePress && offer.id && onDeletePress(offer)}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Delete Listing"
                accessibilityHint={`Permanently deletes the listing for ${offer.name}`}
              >
                <Icon name="trash-can-outline" size={16} color={COLORS.error} />
                <Text style={styles.deleteBtnText}>{t('Delete')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.editBtn, { borderColor: theme.primary }]}
                onPress={() => onEditPress && onEditPress(offer)}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Edit Listing"
                accessibilityHint={`Edits details of the listing for ${offer.name}`}
              >
                <Icon name="pencil-outline" size={16} color={theme.primary} />
                <Text style={[styles.editBtnText, { color: theme.primary }]}>{t('Edit')}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, styles.viewBtn, { backgroundColor: theme.primary }]}
            onPress={() => onPress && onPress(offer)}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="View Listing Details"
            accessibilityHint={`View detailed specifications and images of the listing for ${offer.name}`}
          >
            <Icon name="eye-outline" size={16} color={COLORS.white} />
            <Text style={styles.viewBtnText}>{t('View')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}, offerCardPropsAreEqual);

// ─── Demand Card ───────────────────────────────────────────────────────────────
const demandCardPropsAreEqual = (prev, next) => {
  const pd = prev.demand;
  const nd = next.demand;
  if (!pd || !nd) return pd === nd;
  return (
    pd.id === nd.id &&
    pd.commodity === nd.commodity &&
    pd.location === nd.location &&
    pd.quantity === nd.quantity &&
    pd.unit === nd.unit &&
    pd.targetPrice === nd.targetPrice &&
    pd.status === nd.status &&
    prev.theme?.primary === next.theme?.primary
  );
};

const DemandCard = React.memo(({ demand, theme, t, onFulfillPress }) => {
  if (!demand) return null;
  
  const buyerObj = demand.buyerId;
  const shopName = typeof buyerObj === 'object' && buyerObj?.shopName ? buyerObj.shopName : '';
  const contactPerson = typeof buyerObj === 'object'
    ? [buyerObj.firstName, buyerObj.lastName].filter(Boolean).join(' ')
    : (typeof buyerObj === 'string' && buyerObj ? buyerObj : '');
  
  const displayName = shopName || contactPerson || t('Buyer');
  const subName = shopName && contactPerson ? contactPerson : '';
  const avatarChar = displayName.substring(0, 1).toUpperCase();
  const postedTime = formatDemandPostedTime(demand.createdAt, t);

  return (
    <View style={[styles.offerCard, { borderLeftColor: theme.primary, borderLeftWidth: 4 }]}>
      {/* Header with Avatar and Status Badge */}
      <View style={styles.cardHeader}>
        <View style={styles.userRow}>
          <View style={[styles.avatarBox, { backgroundColor: theme.primary + '15', borderWidth: 1, borderColor: theme.primary + '30' }]}>
            <Text style={[styles.avatarInitial, { color: theme.primary, fontWeight: '800' }]}>
              {avatarChar}
            </Text>
          </View>
          <View>
            <Text style={[styles.userName, { fontSize: f(13), fontWeight: '700' }]} numberOfLines={1}>
              {displayName}{subName ? ` (${subName})` : ''}
            </Text>
            <Text style={{ fontSize: f(10), color: COLORS.textMuted }}>{postedTime}</Text>
          </View>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: theme.primary + '10', borderWidth: 1, borderColor: theme.primary + '20' }]}>
          <Text style={[styles.roleBadgeText, { color: theme.primary, fontSize: f(9), fontWeight: '800' }]}>{t('Demand')}</Text>
        </View>
      </View>

      {/* Commodity Info */}
      <View style={[styles.offerHeader, { marginTop: h(4) }]}>
        <View style={styles.cropInfoWrapper}>
          <Text style={[styles.offerCrop, { fontSize: f(16), fontWeight: '800', color: COLORS.text }]}>
            {t(demand.commodity) || '—'}
          </Text>
          <View style={styles.locationRow}>
            <Icon name="map-marker" size={14} color={theme.primary} />
            <Text style={[styles.offerLocation, { color: COLORS.text, fontWeight: '500' }]}>{t(demand.location) || '—'}</Text>
          </View>
        </View>
        {demand.grade ? (
          <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: w(8), paddingVertical: h(4), borderRadius: 6, borderWidth: 1, borderColor: '#E5E7EB' }}>
            <Text style={{ fontSize: f(10), fontWeight: '700', color: '#4B5563' }}>{t('Grade')}: {t(demand.grade)}</Text>
          </View>
        ) : null}
      </View>

      {/* Grid details (Quantity and Target Price) */}
      <View style={[styles.detailsRow, { backgroundColor: '#F8FAFC', borderRadius: mw(12), padding: w(12), borderColor: '#F1F5F9' }]}>
        <View style={styles.detailCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: w(4), marginBottom: h(2) }}>
            <Icon name="scale-balance" size={13} color={COLORS.textMuted} />
            <Text style={styles.detailLabel}>{t('Req Qty')}</Text>
          </View>
          <Text style={[styles.detailVal, { fontSize: f(14) }]}>{demand.quantity || '—'} {t(demand.unit || 'Qt')}</Text>
        </View>

        <View style={[styles.detailCol, styles.detailColCenter]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: w(4), marginBottom: h(2) }}>
            <Icon name="tag-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.detailLabel}>{t('Target Price')}</Text>
          </View>
          <Text style={[styles.detailVal, { color: theme.primary, fontSize: f(14), fontWeight: '800' }]}>
            ₹{demand.targetPrice || 'N/A'}
          </Text>
        </View>
      </View>

      {/* CTA Button */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.viewBtn, { backgroundColor: theme.primary, flex: 1, height: h(40), borderRadius: mw(10), marginTop: h(4) }]}
          onPress={() => onFulfillPress && onFulfillPress(demand)}
          activeOpacity={0.8}
        >
          <Icon name="handshake-outline" size={18} color={COLORS.white} />
          <Text style={[styles.viewBtnText, { fontSize: f(12), fontWeight: '700' }]}>{t('Quote / Fulfill')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}, demandCardPropsAreEqual);

function formatDemandPostedTime(dateStr, t) {
  if (!dateStr) return t('Just now');
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return t('Just now');
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return t('Just now');
  if (hours < 24) return t('{hours}h ago').replace('{hours}', String(hours));
  return t('{days}d ago').replace('{days}', String(Math.floor(hours / 24)));
}

// Fallback helpers for requestIdleCallback / cancelIdleCallback
const requestIdle = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (cb) => setTimeout(cb, 50);
const cancelIdle = typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback : clearTimeout;

// ─── Main Screen ──────────────────────────────────────────────────────────────
function MarketplaceScreenInner({ route, navigation }) {
  // PERFORMANCE FIX: Select resolvedRole and currentUserId granularly.
  // This prevents MarketplaceScreenInner from re-rendering on unrelated user object changes.
  const selectedRole = useSelector(selectResolvedRole);
  const user = useSelector(selectUser);
  const userRef = useRef(user);
  userRef.current = user;

  const currentUserId = useSelector(state => {
    const raw = state.auth.user?._id || state.auth.user?.id;
    return raw ? String(raw).trim() : 'buyer_001';
  });
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  const { t } = useTranslation();

  const bottomTabBarHeight = useBottomTabBarHeight();

  const [state, dispatch] = useReducer(marketplaceReducer, INITIAL_STATE);
  const {
    listings, loading, refreshing, loadingMore, searching,
    error, hasMore, searchText, selectedCrop, dynamicCrops, isInitialLoad, activeTab
  } = state;

  // Refs: isMounted guard, fetch lock, double-tap guard, page tracker, filter mirrors
  const isMountedRef      = useRef(true);
  const isFetchingRef     = useRef(false);
  const isDeletingRef     = useRef(false);
  const pageRef           = useRef(1);
  const searchTextRef     = useRef('');
  const selectedCropRef   = useRef('All');
  const activeTabRef      = useRef('OFFERS');
  const hasListingsRef    = useRef(false);
  const isInitialLoadRef  = useRef(true);   // mirrors isInitialLoad state for use inside fetchListings closure
  const abortControllerRef = useRef(null);
  const fetchGenerationRef = useRef(0);
  const lastFetchTimeRef  = useRef(0);
  const searchTimeoutRef  = useRef(null);
  const [selectedDemandForQuote, setSelectedDemandForQuote] = React.useState(null);

  // Single mount/unmount effect — initialize and cleanup isMountedRef + abort any in-flight request
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const fetchListings = useCallback(async ({
    pageNum = 1,
    isRefresh = false,
    isBackground = false,
    search = searchTextRef.current,
    crop = selectedCropRef.current,
    tab = activeTabRef.current,
  } = {}) => {
    // If loading a new page and already fetching, block it (no parallel page loads)
    if (pageNum > 1 && isFetchingRef.current) return;

    // For page 1 loads (new search, new crop, manual refresh), abort any active fetch
    if (pageNum === 1 && isFetchingRef.current) {
      abortControllerRef.current?.abort();
      isFetchingRef.current = false;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const thisGeneration = ++fetchGenerationRef.current;

    try {
      if (!isBackground) {
        if (!isMountedRef.current) return;
        if (isRefresh) {
          dispatch({ type: 'FETCH_START_REFRESH' });
        } else if (pageNum > 1) {
          dispatch({ type: 'FETCH_START_MORE' });
        } else if (isInitialLoadRef.current) {
          // Very first load ever → show full skeleton
          dispatch({ type: 'FETCH_START_FRESH' });
        } else {
          // Search / filter / crop change → stale-while-revalidate: keep current list, show subtle spinner
          dispatch({ type: 'FETCH_START_SEARCH' });
        }
      }

      const params = { status: 'active', page: pageNum, limit: PAGE_SIZE };
      const trimmedSearch = (typeof search === 'string' ? search : '').trim();
      const safeCrop = typeof crop === 'string' ? crop : 'All';
      if (trimmedSearch) {
        params.commodityName = trimmedSearch;
      } else if (safeCrop !== 'All') {
        params.commodityName = safeCrop;
      }

      let response;
      if (tab === 'DEMANDS') {
        response = await requirementService.getMarketplaceRequirements({ excludeBuyerId: currentUserId }); // Fetch from requirement service
      } else {
        response = await getSellCommodities(params, { signal: controller.signal });
      }

      if (thisGeneration !== fetchGenerationRef.current) return;
      if (!isMountedRef.current) return;

      // Extract items: support arrays directly, or nested objects like response.data.requirements / response.data.commodities
      let items = [];
      if (Array.isArray(response)) {
        items = response;
      } else if (response) {
        if (tab === 'DEMANDS') {
          items = response.data?.requirements || response.requirements || (Array.isArray(response.data) ? response.data : []);
        } else {
          items = response.data?.commodities || response.commodities || response.data?.docs || response.docs || (Array.isArray(response.data) ? response.data : []);
        }
      }
      if (!Array.isArray(items)) {
        items = [];
      }

      // Local filtering for demands (since mock API doesn't support query filters)
      if (tab === 'DEMANDS') {
        const trimmedSearch = (typeof search === 'string' ? search : '').trim().toLowerCase();
        const safeCrop = typeof crop === 'string' ? crop : 'All';
        
        items = items.filter(item => {
          const matchCrop = safeCrop === 'All' || (item.commodity && item.commodity.toLowerCase() === safeCrop.toLowerCase());
          const matchSearch = !trimmedSearch || (item.commodity && item.commodity.toLowerCase().includes(trimmedSearch)) || (item.location && item.location.toLowerCase().includes(trimmedSearch));
          return matchCrop && matchSearch;
        });
      }

      const totalDocs  = response?.total || response?.totalDocs || items.length;
      const totalPages = response?.totalPages || Math.ceil(totalDocs / PAGE_SIZE) || 1;
      const nextHasMore = pageNum < totalPages && items.length === PAGE_SIZE;

      if (pageNum === 1 || isRefresh) {
        const cropSet = new Set();
        for (const item of items) {
          const cropName = tab === 'DEMANDS' 
            ? (item.commodity || item.commodityName || item.name) 
            : (item.name || item.commodityName || item.commodity);
          if (cropName && cropName !== '-') cropSet.add(cropName);
        }
        dispatch({
          type: 'FETCH_SUCCESS_REPLACE',
          items,
          crops:   ['All', ...cropSet],
          hasMore: nextHasMore,
        });
      } else {
        dispatch({ type: 'FETCH_SUCCESS_APPEND', items, hasMore: nextHasMore });
      }

      pageRef.current = pageNum;
      lastFetchTimeRef.current = Date.now();
      if (pageNum === 1 || isRefresh) isInitialLoadRef.current = false;

    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;

      if (__DEV__) {
        console.error('[Marketplace] fetch error:', err);
      } else {
        console.error('[Production Marketplace] fetch error:', {
          message: err?.message || String(err),
          status: err?.response?.status,
          code: err?.code,
          url: err?.config?.url,
        });
      }
      if (!isMountedRef.current) return;

      const errMsg = classifyError(err);
      dispatch({ type: 'FETCH_ERROR', error: errMsg });

      if (pageNum > 1) {
        showAlert({ type: 'error', title: 'Load More Failed', message: errMsg });
      } else if (isRefresh) {
        showAlert({ type: 'error', title: 'Refresh Failed', message: errMsg });
      }
    } finally {
      if (thisGeneration === fetchGenerationRef.current) {
        isFetchingRef.current = false;
      }
    }
  }, []);

  useEffect(() => { searchTextRef.current = searchText; }, [searchText]);
  useEffect(() => { selectedCropRef.current = selectedCrop; }, [selectedCrop]);

  const rawUpdatedItem = route?.params?.rawUpdatedItem;

  useEffect(() => {
    if (rawUpdatedItem) {
      // rawUpdatedItem is a raw backend object from SellCommodities screen
      // normalize it so UPDATE_ITEM gets same shape as items in state
      const mapped = normalizeCommodity(rawUpdatedItem);
      if (mapped) dispatch({ type: 'UPDATE_ITEM', item: mapped });
      navigation.setParams({ rawUpdatedItem: null });
    }
  }, [rawUpdatedItem, navigation]);

  useFocusEffect(
    useCallback(() => {
      let idleHandle;
      const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;

      if (!hasListingsRef.current) {
        dispatch({ type: 'FETCH_START_FRESH' });
        idleHandle = requestIdle(() => {
          fetchListings({ pageNum: 1, isRefresh: false });
        });
      } else {
        // Force a background fetch on every screen focus to ensure we catch updates from other screens (like HomeScreen submit)
        idleHandle = requestIdle(() => {
          fetchListings({ pageNum: 1, isBackground: true });
        });
      }

      const intervalTimer = setInterval(() => {
        fetchListings({ pageNum: 1, isBackground: true });
      }, 300_000);

      return () => {
        if (idleHandle) {
          cancelIdle(idleHandle);
        }
        clearInterval(intervalTimer);
        abortControllerRef.current?.abort();
      };
    }, [fetchListings])
  );

  const handleRefresh = useCallback(() => {
    dispatch({ type: 'RESET_HAS_MORE' });
    fetchListings({ pageNum: 1, isRefresh: true });
  }, [fetchListings]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading && !refreshing) {
      fetchListings({ pageNum: pageRef.current + 1 });
    }
  }, [loadingMore, hasMore, loading, refreshing, fetchListings]);

  const handleCardPress = useCallback((offer) => {
    if (!offer) return;
    if (!offer.detail) {
      showAlert({ type: 'error', title: t('Error'), message: t('Could not load listing details. Please try again.') });
      return;
    }
    if (!navigation) return;
    
    const safeSellerId = offer.sellerId ? String(offer.sellerId) : '';
    const isOwner = Boolean(currentUserId && safeSellerId && currentUserId === safeSellerId);
    
    const fullItem = { ...offer.detail, sellerId: offer.sellerId ?? null };
    if (!isOwner) {
      delete fullItem.minimumAcceptablePrice;
    }
    
    navigation.navigate('CommodityDetails', { item: fullItem });
  }, [navigation, currentUserId, t]);

  const handleEditPress = useCallback((offer) => {
    if (!offer?.detail || !navigation) return;
    navigation.navigate('Sell', { editItem: offer.detail });
  }, [navigation]);

  const handleDeletePress = useCallback(async (offer) => {
    if (!offer?.id) {
      showAlert({ type: 'error', title: t('Error'), message: t('Cannot delete: listing ID is missing.') });
      return;
    }

    const cropLabel = offer.name && offer.name !== '\u2014' ? `"${offer.name}"` : 'this';

    try {
      const res = await getReceivedOffers(offer.id);
      const allOffers = Array.isArray(res) ? res : res?.data?.offers || res?.offers || [];
      const TERMINAL = ['accepted', 'rejected', 'expired', 'sold', 'cancelled'];
      const activeNegotiations = allOffers.filter(o => {
        const st = (o.status || '').toLowerCase().replace(/\s+/g, '_');
        return !TERMINAL.includes(st);
      });

      if (activeNegotiations.length > 0) {
        showAlert({
          type: 'warning',
          title: t('⚠️ Cannot Delete Listing'),
          message:
            `${t('This listing cannot be deleted because it is currently involved in')} ${activeNegotiations.length} ${t('active negotiation deals')}.\n\n${t('Reason: Active buyer negotiations are in progress for this product. Deleting it would disrupt ongoing deals.')}\n\n${t('Please wait for all negotiations to conclude — either accepted, rejected, or expired — before removing this listing.')}`,
          buttons: [
            { text: t('Got It'), style: 'cancel' },
          ],
        });
        return;
      }
    } catch (checkErr) {
      if (__DEV__) console.warn('[handleDeletePress] pre-check failed:', checkErr);
    }

    showAlert({
      type: 'confirm',
      title: t('Delete Listing'),
      message: `${t('Are you sure you want to permanently delete')} ${cropLabel} ${t('listing? This action cannot be undone.')}`,
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            if (isDeletingRef.current) return;
            isDeletingRef.current = true;
            try {
              await deleteSellCommodity(offer.id);
              if (isMountedRef.current) {
                dispatch({ type: 'REMOVE_ITEM', id: offer.id });
              }
              showAlert({
                type: 'success',
                title: t('Deleted Successfully'),
                message: t('The listing has been removed from the marketplace.'),
              });
            } catch (err) {
              const friendlyMsg = getFriendlyErrorMessage(err);
              showAlert({
                type: 'error',
                title: (err?.response?.status === 400 || err?.statusCode === 400) ? t('Cannot Delete') : t('Delete Failed'),
                message: t(friendlyMsg),
              });
            } finally {
              isDeletingRef.current = false;
            }
          },
        },
      ],
    });
  }, [t]);

  const handleSearchChange = useCallback((text) => {
    const safeText = typeof text === 'string' ? text : '';
    const shouldResetCrop = safeText.trim().length > 0 && selectedCropRef.current !== 'All';
    
    dispatch({
      type: 'SET_SEARCH',
      text: safeText,
      resetCrop: shouldResetCrop,
    });

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      const currentCrop = shouldResetCrop ? 'All' : selectedCropRef.current;
      pageRef.current = 1;
      dispatch({ type: 'RESET_HAS_MORE' });
      fetchListings({
        pageNum: 1,
        search: safeText,
        crop: currentCrop,
      });
    }, 500);
  }, [fetchListings]);

  const handleClearSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    dispatch({ type: 'SET_SEARCH', text: '', resetCrop: false });
    pageRef.current = 1;
    dispatch({ type: 'RESET_HAS_MORE' });
    fetchListings({
      pageNum: 1,
      search: '',
      crop: selectedCropRef.current,
    });
  }, [fetchListings]);

  const handleChipPress = useCallback((crop) => {
    if (!crop || typeof crop !== 'string') return;
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const clearSearch = searchTextRef.current.trim().length > 0;
    
    dispatch({
      type: 'SET_CROP',
      crop,
      clearSearch,
    });

    const currentSearch = clearSearch ? '' : searchTextRef.current;
    pageRef.current = 1;
    dispatch({ type: 'RESET_HAS_MORE' });
    fetchListings({
      pageNum: 1,
      search: currentSearch,
      crop,
    });
  }, [fetchListings]);

  const keyExtractor = useCallback((item) => item?.id ?? item?._id ?? '', []);

  const renderItem = useCallback(({ item }) => {
    if (!item?.id && !item?._id) return null;
    
    if (activeTab === 'DEMANDS') {
      return (
        <DemandCard
          demand={item}
          theme={theme}
          t={t}
          onFulfillPress={(demand) => {
            if (userRef.current?.kycStatus !== 'VERIFIED') {
              showAlert({
                type: 'error',
                title: t('KYC Required'),
                message: t('You must complete your PAN verification before quoting or fulfilling requirements.'),
              });
              return;
            }
            setSelectedDemandForQuote(demand);
          }}
        />
      );
    }

    const safeSellerId = item.sellerId ? String(item.sellerId) : '';
    const isOwner = Boolean(currentUserId && safeSellerId && currentUserId === safeSellerId);
    return (
      <OfferCard
        offer={item}
        theme={theme}
        onPress={handleCardPress}
        onEditPress={handleEditPress}
        onDeletePress={handleDeletePress}
        isOwner={isOwner}
      />
    );
  }, [theme, currentUserId, handleCardPress, handleEditPress, handleDeletePress, activeTab, t]);

  // Dynamic layout calculations & styles memoized before return to avoid inline recreations
  const flatListContentStyle = useMemo(() => [
    styles.listContent,
    { paddingBottom: bottomTabBarHeight + h(20) }
  ], [bottomTabBarHeight]);

  const safeScreenStyle = useMemo(() => ({
    backgroundColor: theme.light
  }), [theme.light]);

  const activeChipStyle = useMemo(() => ({
    backgroundColor: theme.primary
  }), [theme.primary]);

  const activeChipTextStyle = useMemo(() => ({
    color: COLORS.white
  }), []);

  const listHeader = useMemo(() => (
    <View style={{ height: h(8) }} />
  ), []);

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.loadMoreContainer} accessible={true} accessibilityLabel={t("Loading more listings")}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.loadMoreText}>{t('Loading more listings…')}</Text>
        </View>
      );
    }
    if (!hasMore && listings.length > 0) {
      return (
        <View style={styles.endOfListContainer} accessible={true} accessibilityLabel={t("You have seen all active listings")}>
          <Text style={styles.endOfListText}>{t('— You\'ve seen all active listings —')}</Text>
        </View>
      );
    }
    return <View style={styles.listBottomPadding} />;
  }, [loadingMore, hasMore, listings.length, theme.primary, t]);

  const listEmpty = useMemo(() => {
    if (loading) return null;
    const emptyText = searchText.trim()
      ? `${t('No active sell offers found for')} "${searchText.trim()}".`
      : selectedCrop !== 'All'
      ? `${t('No active')} ${t(selectedCrop)} ${t('listings right now.')}`
      : t('No active sell listings at the moment.\nCheck back soon!');

    return (
      <View style={styles.emptyState} accessible={true}>
        <Icon name="store-alert-outline" size={56} color={COLORS.textMuted} />
        <Text style={styles.emptyTitle}>{t('No Listings Found')}</Text>
        <Text style={styles.emptyText}>{emptyText}</Text>
        <TouchableOpacity
          onPress={handleRefresh}
          style={[styles.retryBtn, { backgroundColor: theme.primary, marginTop: h(16) }]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t("Refresh list")}
          accessibilityHint={t("Refreshes the marketplace listings")}
        >
          <Icon name="refresh" size={16} color={COLORS.white} />
          <Text style={styles.retryText}>{t('Refresh')}</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loading, searchText, selectedCrop, handleRefresh, theme.primary, t]);

  useEffect(() => {
    if (listings.length > 0) hasListingsRef.current = true;
  }, [listings.length]);

  const handleRetry = useCallback(() => {
    fetchListings({ pageNum: 1 });
  }, [fetchListings]);

  if (error && listings.length === 0) {
    return (
      <SafeScreen style={safeScreenStyle} top={false} bottom={false}>
        <AppHeader backgroundColor={theme.primary} title={t("Agri Marketplace")} subtitle={t("Trade crops at best market prices")} showBackButton={false} />
        <View style={styles.errorContainer} accessible={true}>
          <Icon
            name={typeof error === 'string' && error.includes('connection') ? 'wifi-off' : 'store-alert-outline'}
            size={56}
            color={COLORS.textMuted}
          />
          <Text style={styles.errorTitle}>{t('Could Not Load Marketplace')}</Text>
          <Text style={styles.errorMsg}>{t(error)}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            onPress={handleRetry}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t("Try loading again")}
            accessibilityHint={t("Retries loading marketplace listings")}
          >
            <Icon name="refresh" size={18} color={COLORS.white} />
            <Text style={styles.retryText}>{t('Try Again')}</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={safeScreenStyle} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title={t("Agri Marketplace")}
        subtitle={activeTab === 'OFFERS' ? t("Browse live sell listings from FPOs & Traders") : t("Browse live requirements from Buyers")}
        showBackButton={false}
      />

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'OFFERS' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]} 
          onPress={() => { activeTabRef.current = 'OFFERS'; dispatch({type: 'SET_TAB', tab: 'OFFERS'}); fetchListings({tab: 'OFFERS', pageNum: 1}); }}
        >
          <Text style={[styles.tabText, activeTab === 'OFFERS' && {color: theme.primary, fontWeight: 'bold'}]}>{t('Market Offers')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'DEMANDS' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]} 
          onPress={() => { activeTabRef.current = 'DEMANDS'; dispatch({type: 'SET_TAB', tab: 'DEMANDS'}); fetchListings({tab: 'DEMANDS', pageNum: 1}); }}
        >
          <Text style={[styles.tabText, activeTab === 'DEMANDS' && {color: theme.primary, fontWeight: 'bold'}]}>{t('Buyer Demands')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          keyboardShouldPersistTaps="handled"
        >
          {dynamicCrops.map(crop => {
            const isSelected = selectedCrop === crop;
            return (
              <TouchableOpacity
                key={crop}
                style={[styles.chip, isSelected && activeChipStyle]}
                onPress={() => handleChipPress(crop)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${t(crop)} ${t('filter')}`}
                accessibilityState={{ selected: isSelected }}
                accessibilityHint={`${t('Filter marketplace listings by')} ${t(crop)}`}
              >
                <Text style={[styles.chipText, isSelected && activeChipTextStyle]}>
                  {t(crop)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Sticky Search Bar (Sibling of FlatList) */}
      <View style={styles.searchBarContainer}>
        <Icon name="magnify" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("Search commodity (Wheat, Soybean…)")}
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessible={true}
          accessibilityLabel={t("Search commodity")}
          accessibilityHint={t("Enter a crop name to search active marketplace listings")}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={handleClearSearch}
            style={styles.searchClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t("Clear search text")}
            accessibilityHint={t("Clears the search input and displays all items for the selected crop")}
          >
            <Icon name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!loading && !error && listings.length > 0 && (
        <Text style={styles.resultsCount} accessibilityLiveRegion="polite">
          {listings.length} {listings.length !== 1 ? t('active listings found') : t('active listing found')}
          {selectedCrop !== 'All' ? ` ${t('for')} ${t(selectedCrop)}` : ''}
          {searchText.trim() ? ` ${t('matching')} "${searchText.trim()}"` : ''}
        </Text>
      )}

      {/* Subtle searching spinner — shown during search/filter re-fetch, never wipes the list */}
      {searching && (
        <View style={styles.searchingIndicator} accessible={true} accessibilityLabel={t("Searching listings")}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.searchingText, { color: theme.primary }]}>{t('Searching…')}</Text>
        </View>
      )}

      {/* Full skeleton only on very first load (isInitialLoad=true), never on search/filter */}
      {isInitialLoad && loading && listings.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.skeletonContainer}
          scrollEnabled={false}
        >
          {[1, 2, 3].map(k => <SkeletonCard key={k} />)}
        </ScrollView>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={keyExtractor}
          contentContainerStyle={flatListContentStyle}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          renderItem={renderItem}
          ListEmptyComponent={listEmpty}
        />
      )}

      <FulfillRequirementBottomSheet
        visible={!!selectedDemandForQuote}
        requirement={selectedDemandForQuote}
        onClose={() => setSelectedDemandForQuote(null)}
        onSubmit={async (payload) => {
          try {
            await submitQuoteAgainstRequirement(payload.requirementId, payload);
            showAlert({
              type: 'success',
              title: t('Quote Submitted'),
              message: t('Your quote has been sent to the buyer. You can track it in your Trades screen.'),
            });
            setSelectedDemandForQuote(null);
          } catch (e) {
            showAlert({
              type: 'error',
              title: t('Failed'),
              message: t('Could not submit quote. Please try again.'),
            });
          }
        }}
      />
    </SafeScreen>
  );
}

// ─── Public export wrapped in Error Boundary ────────────────────────────────────────────
// Wrapping here means any render-time JS exception in the screen tree
// shows a friendly recovery UI instead of crashing the whole app.
export default function MarketplaceScreen(props) {
  return (
    <MarketplaceErrorBoundary>
      <MarketplaceScreenInner {...props} />
    </MarketplaceErrorBoundary>
  );
}

const styles = StyleSheet.create({
  chipsWrapper: {
    backgroundColor: COLORS.white,
    paddingVertical: h(8),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  chipsContainer: {
    paddingHorizontal: w(16),
    gap: w(8),
  },
  chip: {
    paddingHorizontal: w(14),
    paddingVertical: h(6),
    borderRadius: 20,
    backgroundColor: '#F1F3F5',
  },
  chipText: {
    fontSize: f(12),
    fontWeight: '600',
    color: COLORS.textLight,
  },

  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: mw(12),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginHorizontal: w(16),
    marginTop: h(12),
    marginBottom: h(4),
    paddingHorizontal: w(10),
    height: h(44),
  },
  searchIcon: {
    marginRight: w(6),
  },
  searchInput: {
    flex: 1,
    fontSize: f(13),
    color: COLORS.text,
    height: '100%',
  },
  searchClear: {
    padding: w(4),
  },
  resultsCount: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginHorizontal: w(16),
    marginBottom: h(6),
    marginTop: h(4),
  },

  listContent: {
    paddingHorizontal: w(16),
    paddingBottom: h(80),
  },
  listBottomPadding: {
    height: h(20),
  },

  offerCard: {
    backgroundColor: COLORS.white,
    borderRadius: mw(16),
    padding: w(14),
    marginBottom: h(12),
    marginTop: h(4),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  offerCardDimmed: {
    opacity: 0.55,
  },
  publisherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(8),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
    paddingBottom: h(6),
  },
  publisherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    flex: 1,
  },
  publisherName: {
    fontSize: f(11),
    fontWeight: '700',
    color: COLORS.textMuted,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: w(7),
    paddingVertical: h(2),
    borderRadius: 6,
    marginLeft: w(6),
  },
  roleBadgeText: {
    fontSize: f(9),
    fontWeight: '800',
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: h(10),
  },
  cropInfoWrapper: {
    flex: 1,
    marginTop: h(2),
  },
  offerCrop: {
    fontSize: f(15),
    fontWeight: '800',
    color: COLORS.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(3),
    marginTop: h(3),
  },
  offerLocation: {
    fontSize: f(11),
    color: COLORS.textMuted,
  },
  expiredBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: w(8),
    paddingVertical: h(3),
    borderRadius: 6,
    marginLeft: w(8),
  },
  expiredBadgeText: {
    color: '#DC2626',
    fontSize: f(9),
    fontWeight: '800',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: mw(10),
    padding: w(12),
    marginBottom: h(10),
  },
  detailCol: {
    alignItems: 'flex-start',
    flex: 1,
  },
  detailColCenter: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginBottom: h(2),
  },
  detailVal: {
    fontSize: f(13),
    fontWeight: '700',
    color: COLORS.text,
  },
  flagsRow: {
    flexDirection: 'row',
    gap: w(6),
    flexWrap: 'wrap',
    marginBottom: h(10),
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(3),
    paddingHorizontal: w(7),
    paddingVertical: h(3),
    borderRadius: 6,
  },
  flagFOR: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(3),
    paddingHorizontal: w(7),
    paddingVertical: h(3),
    borderRadius: 6,
    backgroundColor: '#E8F5E9',
  },
  flagWarehouse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(3),
    paddingHorizontal: w(7),
    paddingVertical: h(3),
    borderRadius: 6,
    backgroundColor: '#FFF3E0',
  },
  flagDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(3),
    paddingHorizontal: w(7),
    paddingVertical: h(3),
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  flagText: {
    fontSize: f(10),
    fontWeight: '700',
  },
  flagTextFOR: {
    fontSize: f(10),
    fontWeight: '700',
    color: '#388E3C',
  },
  flagTextWarehouse: {
    fontSize: f(10),
    fontWeight: '700',
    color: '#F57C00',
  },
  flagTextDate: {
    fontSize: f(10),
    fontWeight: '700',
    color: COLORS.textMuted,
  },

  actionButtonsRow: {
    flexDirection: 'row',
    gap: w(8),
    alignItems: 'center',
    marginTop: h(10),
  },
  actionBtn: {
    height: h(38),
    borderRadius: mw(8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(4),
  },
  deleteBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    backgroundColor: COLORS.white,
  },
  deleteBtnText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: f(11),
  },
  editBtn: {
    flex: 1,
    borderWidth: 1.5,
    backgroundColor: COLORS.white,
  },
  editBtnText: {
    fontWeight: '700',
    fontSize: f(11),
  },
  viewBtn: {
    flex: 1.4,
  },
  viewBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(11),
  },

  // ── Skeleton ───────────────────────────────────────────────────────────────
  skeletonContainer: {
    paddingHorizontal: w(16),
    paddingTop: h(12),
  },
  skeletonCard: {
    backgroundColor: COLORS.white,
    borderRadius: mw(16),
    padding: w(16),
    marginBottom: h(12),
    elevation: 1,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: h(8),
  },
  skeletonBoxLabel: {
    backgroundColor: '#EAECEF',
    borderRadius: mw(4),
    width: '30%',
    height: h(10),
  },
  skeletonBoxBadge: {
    backgroundColor: '#EAECEF',
    borderRadius: mw(4),
    width: '20%',
    height: h(10),
  },
  skeletonBoxTitle: {
    backgroundColor: '#EAECEF',
    borderRadius: mw(4),
    width: '65%',
    height: h(14),
    marginTop: h(10),
  },
  skeletonBoxSubtitle: {
    backgroundColor: '#EAECEF',
    borderRadius: mw(4),
    width: '40%',
    height: h(10),
    marginTop: h(6),
  },
  skeletonBoxCTA: {
    backgroundColor: '#EAECEF',
    borderRadius: mw(8),
    width: '100%',
    height: h(38),
    marginTop: h(14),
  },

  // ── Empty / Error ──────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(60),
    paddingHorizontal: w(24),
  },
  emptyTitle: {
    fontSize: f(15),
    fontWeight: '800',
    color: COLORS.text,
    marginTop: h(12),
  },
  emptyText: {
    fontSize: f(12),
    color: COLORS.textMuted,
    marginTop: h(6),
    textAlign: 'center',
    lineHeight: h(19),
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: w(28),
  },
  errorTitle: {
    fontSize: f(15),
    fontWeight: '800',
    color: COLORS.text,
    marginTop: h(12),
  },
  errorMsg: {
    fontSize: f(12),
    color: COLORS.textMuted,
    marginTop: h(6),
    textAlign: 'center',
    lineHeight: h(19),
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(6),
    paddingHorizontal: w(22),
    paddingVertical: h(10),
    borderRadius: mw(10),
    marginTop: h(20),
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(13),
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(8),
    paddingVertical: h(16),
  },
  loadMoreText: {
    fontSize: f(12),
    color: COLORS.textMuted,
  },
  endOfListContainer: {
    alignItems: 'center',
    paddingVertical: h(20),
  },
  endOfListText: {
    fontSize: f(11),
    color: COLORS.textMuted,
  },

  // ── Search in-progress indicator (subtle, non-intrusive) ───────────────────
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(6),
    paddingVertical: h(6),
    marginHorizontal: w(16),
    marginBottom: h(4),
  },
  searchingText: {
    fontSize: f(11),
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: h(12),
  },
  tabText: {
    fontSize: f(13),
    color: '#6B7280',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: h(10),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
    paddingBottom: h(8),
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
    flex: 1,
    paddingRight: w(8),
  },
  avatarBox: {
    width: w(32),
    height: w(32),
    borderRadius: w(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: f(14),
  },
  userName: {
    color: COLORS.text,
  },
});
