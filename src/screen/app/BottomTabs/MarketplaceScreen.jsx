import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, f, mw } from '../../../utils/responsive';
import { showAlert } from '../../../components/CustomAlertBox';
import { getSellCommodities, deleteSellCommodity } from '../../../service/sell/sellCommodity';

const ROLE_THEMES = {
  FPO:       { primary: COLORS.fpoPrimary,       secondary: COLORS.fpoSecondary,       light: COLORS.fpoLight,       text: COLORS.fpoText },
  Trader:    { primary: COLORS.traderPrimary,    secondary: COLORS.traderSecondary,    light: COLORS.traderLight,    text: COLORS.traderText },
  Miller:    { primary: COLORS.millerPrimary,    secondary: COLORS.millerSecondary,    light: COLORS.millerLight,    text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

const PAGE_SIZE = 10;

// ─── Safe: extract moisture from qualityParameters array ─────────────────────
function getMoistureFromParams(params) {
  if (!Array.isArray(params) || params.length === 0) return null;
  const found = params.find(p =>
    typeof p?.parameterName === 'string' &&
    p.parameterName.toLowerCase().includes('moisture'),
  );
  return found?.parameterValue ?? null;
}

// ─── Safe status label ────────────────────────────────────────────
function safeStatusLabel(status) {
  if (status === 'sold') return 'SOLD';
  return String(status || 'CLOSED').toUpperCase();
}

// ─── Safe price display ──────────────────────────────────────────
function safePriceDisplay(price) {
  const n = Number(price);
  if (!price || isNaN(n)) return null;
  return n.toLocaleString('en-IN');
}

// ─── Safe ISO date split ─────────────────────────────────────────
function safeDateDisplay(date) {
  if (!date) return null;
  return String(date).split('T')[0];
}

// ─── Map raw API commodity → UI card + CommodityDetailsScreen item shape ──────
function mapApiItem(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const seller = (raw.seller && typeof raw.seller === 'object')
    ? raw.seller
    : (raw.sellerId && typeof raw.sellerId === 'object')
      ? raw.sellerId
      : {};

  const sellerName =
    (seller.firstName && seller.lastName)
      ? `${seller.firstName} ${seller.lastName}`.trim()
      : seller.firstName?.trim() || seller.name?.trim() || 'Unknown Seller';

  const sellerRole = seller.role && ROLE_THEMES[seller.role] ? seller.role : 'Trader';

  const moisture = getMoistureFromParams(raw.qualityParameters);

  const qualityParams = Array.isArray(raw.qualityParameters)
    ? raw.qualityParameters
        .filter(p => p?.parameterName || p?.name)
        .map(p => ({
          name: String(p?.parameterName || p?.name || '').trim(),
          val:  String(p?.parameterValue || p?.val || '').trim(),
        }))
    : [];

  const id = raw._id || raw.id;
  if (!id) return null;

  let sellerIdRaw = seller._id || seller.id;
  if (!sellerIdRaw && typeof raw.sellerId === 'string') sellerIdRaw = raw.sellerId;
  if (!sellerIdRaw && typeof raw.seller === 'string') sellerIdRaw = raw.seller;
  const sellerId = sellerIdRaw ? String(sellerIdRaw) : null;

  return {
    id:             String(id),
    sellerId:       sellerId ? String(sellerId) : null,
    crop:           String(raw.commodityName || '').trim() || '—',
    variety:        String(raw.type          || '').trim() || null,
    quantity:       `${raw.quantity ?? '?'} ${raw.unit || ''}`.trim(),
    price:          raw.sellingPrice != null ? String(raw.sellingPrice) : null,
    priceUnit:      String(raw.sellingPriceUnit || 'Qt'),
    location:       String(raw.commodityLocation || '').trim() || '—',
    moisture:       moisture ? String(moisture) : '—',
    deliveryType:   ['FOR', 'EX_WAREHOUSE'].includes(raw.deliveryType) ? raw.deliveryType : 'FOR',
    isNegotiable:   raw.isNegotiable !== false,
    status:         String(raw.status || 'active'),
    publisherName:  sellerName,
    publisherRole:  sellerRole,
    listingEndDate: raw.listingEndDate || null,

    _fullItem: {
      id:                    String(id),
      commodityName:         String(raw.commodityName  || '—'),
      type:                  String(raw.type           || '—'),
      quantity:              String(raw.quantity       ?? ''),
      unit:                  String(raw.unit           || ''),
      sellingPrice:          raw.sellingPrice          ?? 0,
      sellingPriceUnit:      String(raw.sellingPriceUnit || 'Qt'),
      weightType:            String(raw.weightType     || 'Net Weight'),
      listingEndDate:        safeDateDisplay(raw.listingEndDate) || '—',
      weightTolerance:       String(raw.weightTolerance || '—'),
      billingAddress:        String(raw.billingAddress  || '—'),
      exWarehouseAddress:    raw.exWarehouseAddress || null,
      paymentTimeline:       String(raw.paymentTimeline || '—'),
      remarks:               String(raw.remarks         || ''),
      deliveryType:          ['FOR', 'EX_WAREHOUSE'].includes(raw.deliveryType) ? raw.deliveryType : 'FOR',
      isNegotiable:          raw.isNegotiable !== false,
      minimumAcceptablePrice: raw.minimumAcceptablePrice ?? null,
      maxNegotiationRounds:  raw.maxNegotiationRounds  ?? 5,
      offerExpiryHours:      raw.offerExpiryHours      ?? 24,
      commodityLocation:     String(raw.commodityLocation || '—'),
      escrowEnabled:         raw.escrowEnabled         ?? false,
      buyerTransportAllowed: raw.buyerTransportAllowed ?? false,
      grade:                 raw.grade                 || null,
      moisture:              moisture ? String(moisture) : '—',
      qualityParameters:     qualityParams,
      sellerName,
      sellerRating:          typeof seller.rating           === 'number' ? seller.rating           : null,
      sellerCompletedTrades: typeof seller.completedTrades  === 'number' ? seller.completedTrades  : null,
      isSellerVerified:      seller.isVerified              ?? false,
    },
  };
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
function OfferCard({ offer, theme, onPress, onEditPress, onDeletePress, currentUserId }) {
  const roleTheme = ROLE_THEMES[offer.publisherRole] || theme;
  const isExpired =
    offer.status === 'expired' ||
    offer.status === 'sold'    ||
    offer.status === 'cancelled';

  const priceDisplay = safePriceDisplay(offer.price);
  const dateDisplay  = safeDateDisplay(offer.listingEndDate);

  return (
    <View style={[styles.offerCard, isExpired && styles.offerCardDimmed]}>
      {/* Publisher Row */}
      <View style={styles.publisherRow}>
        <View style={styles.publisherInfo}>
          <Icon name="account-circle-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.publisherName} numberOfLines={1}>
            {offer.publisherName}
          </Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: roleTheme.primary + '18' }]}>
          <Text style={[styles.roleBadgeText, { color: roleTheme.primary }]}>
            {offer.publisherRole}
          </Text>
        </View>
      </View>

      {/* Crop + Location */}
      <View style={styles.offerHeader}>
        <View style={styles.cropInfoWrapper}>
          <Text style={styles.offerCrop} numberOfLines={1}>
            {offer.crop}
            {offer.variety ? ` (${offer.variety})` : ''}
          </Text>
          <View style={styles.locationRow}>
            <Icon name="map-marker-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.offerLocation}>{offer.location}</Text>
          </View>
        </View>

        {isExpired && (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredBadgeText}>
              {safeStatusLabel(offer.status)}
            </Text>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.detailsRow}>
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>Quantity</Text>
          <Text style={styles.detailVal}>{offer.quantity}</Text>
        </View>

        <View style={[styles.detailCol, styles.detailColCenter]}>
          <Text style={styles.detailLabel}>Price / {offer.priceUnit}</Text>
          <Text style={[styles.detailVal, { color: theme.primary }]}>
            {priceDisplay ? `₹${priceDisplay}` : 'N/A'}
          </Text>
        </View>

        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>Moisture</Text>
          <Text style={styles.detailVal}>{offer.moisture}</Text>
        </View>
      </View>

      {/* Flags */}
      <View style={styles.flagsRow}>
        {offer.isNegotiable && (
          <View style={[styles.flag, { backgroundColor: theme.primary + '12' }]}>
            <Icon name="handshake-outline" size={11} color={theme.primary} />
            <Text style={[styles.flagText, { color: theme.primary }]}>Negotiable</Text>
          </View>
        )}

        {offer.deliveryType === 'FOR' ? (
          <View style={styles.flagFOR}>
            <Icon name="truck-delivery-outline" size={11} color="#388E3C" />
            <Text style={styles.flagTextFOR}>FOR</Text>
          </View>
        ) : (
          <View style={styles.flagWarehouse}>
            <Icon name="warehouse" size={11} color="#F57C00" />
            <Text style={styles.flagTextWarehouse}>Ex-Warehouse</Text>
          </View>
        )}

        {dateDisplay && (
          <View style={styles.flagDate}>
            <Icon name="calendar-clock" size={11} color={COLORS.textMuted} />
            <Text style={styles.flagTextDate}>{dateDisplay}</Text>
          </View>
        )}
      </View>

      {/* Action Buttons Row */}
      {!isExpired && (
        <View style={styles.actionButtonsRow}>
          {(() => {
            const safeUserId = currentUserId ? String(currentUserId).trim() : '';
            const safeSellerId = offer.sellerId ? String(offer.sellerId).trim() : '';
            const isOwner = Boolean(safeUserId && safeSellerId && safeUserId === safeSellerId);
            return isOwner;
          })() && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => onDeletePress && onDeletePress(offer)}
                activeOpacity={0.7}
              >
                <Icon name="trash-can-outline" size={16} color={COLORS.error} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.editBtn, { borderColor: theme.primary }]}
                onPress={() => onEditPress && onEditPress(offer)}
                activeOpacity={0.7}
              >
                <Icon name="pencil-outline" size={16} color={theme.primary} />
                <Text style={[styles.editBtnText, { color: theme.primary }]}>Edit</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, styles.viewBtn, { backgroundColor: theme.primary }]}
            onPress={() => onPress(offer)}
            activeOpacity={0.8}
          >
            <Icon name="eye-outline" size={16} color={COLORS.white} />
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MarketplaceScreen({ route, navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  
  const bottomTabBarHeight = useBottomTabBarHeight();

  const [listings,      setListings]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [error,         setError]         = useState(null);
  const [hasMore,       setHasMore]       = useState(true);
  const [searchText,    setSearchText]    = useState('');
  const [selectedCrop,  setSelectedCrop]  = useState('All');
  const [dynamicCrops,  setDynamicCrops]  = useState(['All']);

  const isMountedRef    = useRef(true);
  const isFetchingRef   = useRef(false);
  const isInitialMount  = useRef(true);
  const pageRef         = useRef(1);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchListings = useCallback(async ({ pageNum = 1, isRefresh = false, search = searchText, crop = selectedCrop } = {}) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (isRefresh) {
        if (isMountedRef.current) { setRefreshing(true); setError(null); }
      } else if (pageNum === 1) {
        if (isMountedRef.current) { setLoading(true); setError(null); }
      } else {
        if (isMountedRef.current) setLoadingMore(true);
      }

      const params = { status: 'active', page: pageNum, limit: PAGE_SIZE };
      if (search.trim()) {
        params.commodityName = search.trim();
      } else if (crop !== 'All') {
        params.commodityName = crop;
      }

      const response = await getSellCommodities(params);

      const rawItems =
        response?.data?.commodities ||
        (Array.isArray(response?.data) ? response?.data : null) ||
        response?.commodities ||
        response?.listings  ||
        response?.docs      ||
        response?.results   ||
        (Array.isArray(response) ? response : []);

      const mapped = Array.isArray(rawItems) ? rawItems.map(mapApiItem) : [];
      if (__DEV__) {
        const nullCount = mapped.filter(i => !i).length;
        if (nullCount > 0) {
          console.warn(`[Marketplace] ⚠️ ${nullCount} item(s) skipped — malformed/missing _id from API`);
        }
      }
      const items = mapped.filter(Boolean);

      const totalDocs  = response?.data?.total || response?.total || response?.totalDocs || response?.count || items.length;
      const totalPages = response?.data?.totalPages || response?.totalPages || Math.ceil(totalDocs / PAGE_SIZE) || 1;

      if (!isMountedRef.current) return;

      if (pageNum === 1 || isRefresh) {
        setListings(items);
        const cropSet = new Set(items.map(i => i.crop).filter(c => c && c !== '—'));
        setDynamicCrops(['All', ...Array.from(cropSet)]);
      } else {
        setListings(prev => [...prev, ...items]);
      }

      setHasMore(pageNum < totalPages && items.length === PAGE_SIZE);
      pageRef.current = pageNum;

    } catch (err) {
      if (__DEV__) console.error('[Marketplace] fetch error:', err);

      if (!isMountedRef.current) return;

      const errMsg =
        err?.type === 'NETWORK_ERROR' || err?.message === 'No internet connection'
          ? 'No internet connection. Please check your network and try again.'
          : err?.message || 'Failed to load marketplace. Please try again.';

      setError(errMsg);

      if (pageNum > 1) {
        showAlert({ type: 'error', title: 'Load More Failed', message: errMsg });
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchTextRef = useRef(searchText);
  const selectedCropRef = useRef(selectedCrop);

  useEffect(() => {
    searchTextRef.current = searchText;
  }, [searchText]);

  useEffect(() => {
    selectedCropRef.current = selectedCrop;
  }, [selectedCrop]);

  const rawUpdatedItem = route?.params?.rawUpdatedItem;

  // Optimistically update list instantly when returned from update screen
  useEffect(() => {
    if (rawUpdatedItem) {
      const mapped = mapApiItem(rawUpdatedItem);
      if (mapped) {
        setListings(prev => prev.map(item => item.id === mapped.id ? mapped : item));
      }
      navigation.setParams({ rawUpdatedItem: null });
    }
  }, [rawUpdatedItem, navigation]);

  // Refresh listings with latest data on tab focus with a visual skeleton delay only if empty
  useFocusEffect(
    useCallback(() => {
      const isListEmpty = listings.length === 0;
      if (isListEmpty) {
        setLoading(true);
      }
      const timer = setTimeout(() => {
        fetchListings({
          pageNum: 1,
          isRefresh: false,
          search: searchTextRef.current,
          crop: selectedCropRef.current,
        });
      }, isListEmpty ? 800 : 0);

      return () => clearTimeout(timer);
    }, [fetchListings, listings.length])
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchListings({ pageNum: 1, search: searchText, crop: selectedCrop });
      return;
    }
    const timer = setTimeout(() => {
      fetchListings({ pageNum: 1, search: searchText, crop: selectedCrop });
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, selectedCrop]);

  const handleRefresh = useCallback(() => {
    setHasMore(true);
    fetchListings({ pageNum: 1, isRefresh: true, search: searchText, crop: selectedCrop });
  }, [fetchListings, searchText, selectedCrop]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading && !refreshing) {
      fetchListings({ pageNum: pageRef.current + 1, search: searchText, crop: selectedCrop });
    }
  }, [loadingMore, hasMore, loading, refreshing, fetchListings, searchText, selectedCrop]);

  const handleCardPress = useCallback((offer) => {
    if (!offer?._fullItem) {
      showAlert({ type: 'error', title: 'Error', message: 'Could not load listing details. Please try again.' });
      return;
    }
    const fullItem = {
      ...offer._fullItem,
      sellerId: offer.sellerId,
    };
    const currentUserId = user?._id || user?.id;
    const safeUserId = currentUserId ? String(currentUserId).trim() : '';
    const safeSellerId = offer.sellerId ? String(offer.sellerId).trim() : '';
    const isOwner = Boolean(safeUserId && safeSellerId && safeUserId === safeSellerId);
    
    if (isOwner) {
      navigation.navigate('CommodityDetailsOwner', { item: fullItem });
    } else {
      navigation.navigate('CommodityDetails', { item: fullItem });
    }
  }, [navigation, user]);

  const handleEditPress = useCallback((offer) => {
    if (!offer?._fullItem) return;
    navigation.navigate('Sell', { editItem: offer._fullItem });
  }, [navigation]);

  const handleDeletePress = useCallback((offer) => {
    showAlert({
      type: 'confirm',
      title: 'Delete Listing',
      message: `Are you sure you want to permanently delete "${offer.crop}" listing? This action cannot be undone.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSellCommodity(offer.id);
              setListings(prev => prev.filter(item => item.id !== offer.id));
              showAlert({
                type: 'success',
                title: 'Deleted Successfully',
                message: 'Listing has been removed successfully.',
              });
            } catch (err) {
              showAlert({
                type: 'error',
                title: 'Delete Failed',
                message: err.message || 'Failed to delete commodity listing.',
              });
            }
          },
        },
      ],
    });
  }, []);

  const handleSearchChange = useCallback((text) => {
    setSearchText(text);
    if (text.trim() && selectedCrop !== 'All') {
      setSelectedCrop('All');
    }
  }, [selectedCrop]);

  const handleChipPress = useCallback((crop) => {
    setSelectedCrop(crop);
    if (searchText.trim()) setSearchText('');
  }, [searchText]);

  const displayedListings = listings;

  const renderListHeader = useCallback(() => (
    <View>
      <View style={styles.searchBarContainer}>
        <Icon name="magnify" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search commodity (Wheat, Soybean…)"
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.searchClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!loading && !error && (
        <Text style={styles.resultsCount}>
          {displayedListings.length} active listing{displayedListings.length !== 1 ? 's' : ''} found
          {selectedCrop !== 'All' ? ` for ${selectedCrop}` : ''}
          {searchText.trim() ? ` matching "${searchText.trim()}"` : ''}
        </Text>
      )}
    </View>
  ), [searchText, loading, error, displayedListings.length, selectedCrop, handleSearchChange]);

  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={styles.loadMoreContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.loadMoreText}>Loading more listings…</Text>
        </View>
      );
    }
    if (!hasMore && listings.length > 0) {
      return (
        <View style={styles.endOfListContainer}>
          <Text style={styles.endOfListText}>— You've seen all active listings —</Text>
        </View>
      );
    }
    return <View style={styles.listBottomPadding} />;
  }, [loadingMore, hasMore, listings.length, theme.primary]);

  if (error && listings.length === 0) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader backgroundColor={theme.primary} title="Agri Marketplace" subtitle="Trade crops at best market prices" showBackButton={false} />
        <View style={styles.errorContainer}>
          <Icon
            name={error.includes('internet') ? 'wifi-off' : 'store-alert-outline'}
            size={56}
            color={COLORS.textMuted}
          />
          <Text style={styles.errorTitle}>Could Not Load Marketplace</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            onPress={() => fetchListings({ pageNum: 1, search: searchText, crop: selectedCrop })}
          >
            <Icon name="refresh" size={18} color={COLORS.white} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title="Agri Marketplace"
        subtitle="Browse live sell listings from FPOs & Traders"
        showBackButton={false}
      />

      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          keyboardShouldPersistTaps="handled"
        >
          {dynamicCrops.map(crop => (
            <TouchableOpacity
              key={crop}
              style={[styles.chip, selectedCrop === crop && { backgroundColor: theme.primary }]}
              onPress={() => handleChipPress(crop)}
            >
              <Text style={[styles.chipText, selectedCrop === crop && { color: COLORS.white }]}>
                {crop}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && listings.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.skeletonContainer}
          scrollEnabled={false}
        >
          {[1, 2, 3].map(k => <SkeletonCard key={k} />)}
        </ScrollView>
      ) : (
        <FlatList
          data={displayedListings}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomTabBarHeight + h(20) }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item }) => (
            <OfferCard 
              offer={item} 
              theme={theme} 
              onPress={handleCardPress}
              onEditPress={handleEditPress}
              onDeletePress={handleDeletePress}
              currentUserId={user?._id || user?.id}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Icon name="store-alert-outline" size={56} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>No Listings Found</Text>
                <Text style={styles.emptyText}>
                  {searchText.trim()
                    ? `No active sell offers found for "${searchText.trim()}".`
                    : selectedCrop !== 'All'
                    ? `No active ${selectedCrop} listings right now.`
                    : 'No active sell listings at the moment.\nCheck back soon!'}
                </Text>
                <TouchableOpacity
                  onPress={handleRefresh}
                  style={[styles.retryBtn, { backgroundColor: theme.primary, marginTop: h(16) }]}
                >
                  <Icon name="refresh" size={16} color={COLORS.white} />
                  <Text style={styles.retryText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </SafeScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
});
