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
  Image,
  Dimensions,
  Alert,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectUser, selectSelectedRole } from '../../../../store/authSelectors';
import { SafeScreen } from '../../../../components/SafeScreen';
import AppHeader from '../../../../components/AppHeader';
import COLORS from '../../../../constant/colors';
import { w, h, f,mw } from '../../../../utils/responsive';
import { showAlert } from '../../../../components/CustomAlertBox';
import { getOffers, submitOffer, getReceivedOffers } from '../../../../service/buy/buyCommodityService';
import KycBanner from '../../../../components/KycBanner';
import PlaceBuyOfferModal from './components/PlaceBuyOfferModal';
import ReceivedOffersModal from './components/ReceivedOffersModal';
import { viewDocument, downloadFile } from '../../../../utils/documentUtils'; // Force Metro reload after build completion
import { useTranslation } from '../../../../hook/useTranslation';

const ROLE_THEMES = {
  FPO: { primary: COLORS.fpoPrimary, secondary: COLORS.fpoSecondary, light: COLORS.fpoLight, text: COLORS.fpoText },
  Trader: { primary: COLORS.traderPrimary, secondary: COLORS.traderSecondary, light: COLORS.traderLight, text: COLORS.traderText },
  Miller: { primary: COLORS.millerPrimary, secondary: COLORS.millerSecondary, light: COLORS.millerLight, text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

const { width: screenWidth } = Dimensions.get('window');

export default function CommodityDetailsScreen({ route, navigation }) {
  const { t } = useTranslation();
  // PERFORMANCE FIX: Two granular selectors — CommodityDetailsScreen only
  // re-renders when user or selectedRole change, not on unrelated auth fields.
  const user      = useSelector(selectUser);
  const stateRole = useSelector(selectSelectedRole);
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
    listingEndDate: null,
    weightTolerance: null,
    billingAddress: null,
    exWarehouseAddress: null,
    paymentTimeline: null,
    remarks: 'Bags packing of 50kg. High gluten content, clean grains.',
    deliveryType: null,
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
    shopName: 'FPO Shop',
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
  const [deliveryType, setDeliveryType] = useState(item.deliveryType || 'FOR');
  const [paymentTimeline, setPaymentTimeline] = useState(item.paymentTimeline);
  const [remarks, setRemarks] = useState('');

  // Seller specific state
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [offersCount, setOffersCount] = useState(0);
  const [receivedOffersModalVisible, setReceivedOffersModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const checkActiveOffer = useCallback(async () => {
    try {
      setCheckingOffer(true);
      setApiError(null);
      // Use _id first (MongoDB style), fallback to id
      const commodityId = item._id || item.id;
      const res = await getOffers({ commodityId });
      const offersList = Array.isArray(res) ? res : res?.data?.offers || res?.offers || [];
      
      // Find any active offer on this commodity — pending or in_negotiation (displayStatus)
      // Backend does not use 'countered' status; pending + In Negotiation displayStatus covers all active states
      const found = offersList.find(o => {
        const matchesCommodity =
          String(o.commodityId?._id || o.commodityId || o.commodity?._id || o.commodity?.id) === String(commodityId);
        const st = (o.displayStatus || o.status || '').toLowerCase().replace(/\s+/g, '_');
        const isActive = !['accepted', 'rejected', 'expired', 'cancelled', 'sold'].includes(st);
        return matchesCommodity && isActive;
      });
      
      setActiveOffer(found || null);
    } catch (err) {
      console.warn('[CommodityDetails] Error checking active offer:', err);
      // Suppress network errors for offline testing/prototype, but set error if no cache exists
      setApiError(err.message || t('Failed to sync with server.'));
    } finally {
      setCheckingOffer(false);
    }
  }, [item.id, item._id, t]);

  const handleCloseOfferModal   = useCallback(() => setOfferModalVisible(false), []);
  const handleCloseReportModal  = useCallback(() => setReportModalVisible(false), []);
  const handleCloseReceivedModal = useCallback(() => setReceivedOffersModalVisible(false), []);
  const handleGoBack            = useCallback(() => navigation.goBack(), [navigation]);

  const loggedInUserId = user?._id || user?.id;
  const sellerIdToCheck = item?.sellerId || item?.seller?._id || item?.seller?.id || (typeof item?.seller === 'string' ? item?.seller : null);
  const isOwner = Boolean(loggedInUserId && sellerIdToCheck && String(loggedInUserId) === String(sellerIdToCheck));

  useEffect(() => {
    const fetchReceivedOffersCount = async () => {
      if (!isOwner) return;
      try {
        setLoadingOffers(true);
        const res = await getReceivedOffers(item._id || item.id);
        const list = Array.isArray(res) ? res : (res?.data?.offers || res?.offers || []);
        setOffersCount(list.length);
      } catch (err) {
        console.warn('[CommodityDetails] Failed to fetch received offers count:', err);
        setOffersCount(0);
      } finally {
        setLoadingOffers(false);
      }
    };

    const itemId = item._id || item.id;
    if (itemId) {
      checkActiveOffer();
      setOfferPrice(String(item.sellingPrice || ''));
      setOfferQty(String(item.quantity || ''));
      fetchReceivedOffersCount();
    }
  }, [item.id, item._id, checkActiveOffer, item.sellingPrice, item.quantity, isOwner]);

  const handlePlaceOffer = async () => {
    const finalPrice = item.isNegotiable === false ? item.sellingPrice : Number(offerPrice);
    if (!finalPrice || !offerQty) {
      showAlert({
        type: 'error',
        title: t('Missing Details'),
        message: t('Please fill in the offer price and quantity.'),
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
        title: t('Offer Submitted'),
        message: t('Your buy offer of ₹{price}/Qtl for {qty} Ton has been submitted successfully to the seller.')
          .replace('{price}', offerPrice)
          .replace('{qty}', offerQty),
        buttons: [
          {
            text: t('View Negotiation'),
            onPress: () => {
              // Navigate to the negotiation thread
              navigation.navigate('NegotiationDetails', { offer: createdOffer, item, role: 'buyer' });
            },
          },
          { text: t('Keep Browsing') },
        ],
      });
      
      // Refresh the screen status
      checkActiveOffer();
    } catch (error) {
      console.error('[CommodityDetails] submitOffer error:', error);
      
      const isDuplicate = error.statusCode === 409 || error.backendError?.error?.code === 'DUPLICATE_OFFER';
      
      showAlert({
        type: 'error',
        title: isDuplicate ? t('Active Offer Exists') : t('Submission Failed'),
        message: error.message || t('Failed to submit buy offer. Please try again.'),
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
          title={t('Commodity Listing')}
          subtitle={`${item.commodityName} (${item.type})`}
          showBackButton={true}
          onBackPress={handleGoBack}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('Checking listing status...')}</Text>
        </View>
      </SafeScreen>
    );
  }

  const fallbackUrl = 'https://placehold.net/default.png';

  let images = Array.isArray(item?.images || item?.commodityImages)
    ? (item.images || item.commodityImages)
        .map(img => {
          if (!img) return fallbackUrl;
          if (typeof img === 'string') return img.trim() === '' ? fallbackUrl : img;
          return img.url || img.uri || fallbackUrl;
        })
        .filter(Boolean)
    : [];

  if (images.length === 0) {
    images = [fallbackUrl];
  }

  const filteredParams = Array.isArray(item?.qualityParameters)
    ? item.qualityParameters.filter(param => {
        if (!param) return false;
        const value = param.val !== undefined ? param.val : param.parameterValue;
        return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '—';
      })
    : [];

  if (__DEV__) {
    console.log('🔍 COMMODITY DETAILS ITEM:', JSON.stringify(item, null, 2));
    console.log('🖼️ EXTRACTED IMAGES:', images);
  }

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title={t('Commodity Listing')}
        subtitle={`${item.commodityName} (${item.type})`}
        showBackButton={true}
        onBackPress={handleGoBack}
      />

      {apiError && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={16} color={COLORS.white} />
          <Text style={styles.errorBannerText}>{t(apiError)}</Text>
          <TouchableOpacity onPress={checkActiveOffer} style={styles.retryBadge}>
            <Text style={styles.retryBadgeText}>{t('Retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <KycBanner actionType="buy" />

        {/* Gallery Section */}
        <View style={styles.galleryContainer}>
          {images.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {images.map((imgUrl, index) => (
                <View key={index} style={styles.gallerySlide}>
                  <View style={styles.imageWrapper}>
                    <Image source={{ uri: imgUrl }} style={styles.galleryImage} />
                    <Text style={[styles.galleryTag, { backgroundColor: theme.primary }]}>
                      {t('Image {current} of {total}').replace('{current}', String(index + 1)).replace('{total}', String(images.length))}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              <View style={styles.gallerySlide}>
                <View style={styles.imageWrapper}>
                  <View style={[styles.mockImagePlaceholder, { backgroundColor: theme.primary + '1A' }]}>
                    <Icon name="wheat" size={80} color={theme.primary} />
                    <Text style={[styles.galleryTag, { backgroundColor: theme.primary }]}>{t('No Image Available')}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>

        {/* Core Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.itemName}>{item.commodityName}</Text>
              <Text style={styles.itemVariety}>{t('Variety: {type}').replace('{type}', item.type)}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={[styles.itemPrice, { color: theme.primary }]}>₹{item.sellingPrice}</Text>
              <Text style={styles.itemPriceUnit}>{t('per {unit}').replace('{unit}', item.sellingPriceUnit)}</Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <Icon name="map-marker" size={16} color={COLORS.textLight} />
            <Text style={styles.locationText}>{t('Location: {location}').replace('{location}', item.commodityLocation)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('Available Qty')}</Text>
              <Text style={styles.statValue}>{item.quantity} {item.unit}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('Moisture')}</Text>
              <Text style={styles.statValue}>{item.moisture}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('End Date')}</Text>
              <Text style={styles.statValue}>{item.listingEndDate}</Text>
            </View>
          </View>
        </View>

        {/* Quality Specifications */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>{t('Quality Parameters')}</Text>
          
          {filteredParams.length === 0 ? (
            <Text style={{ fontSize: f(12), color: COLORS.textMuted, marginBottom: h(12), fontStyle: 'italic' }}>
              {t('No quality specifications listed.')}
            </Text>
          ) : (
            <View style={styles.paramsGrid}>
              {filteredParams.map((param, index) => (
                <View key={index} style={styles.paramItem}>
                  <Text style={styles.paramName}>{param.name || param.parameterName || ''}</Text>
                  <Text style={styles.paramVal}>{param.val || param.parameterValue || ''}</Text>
                </View>
              ))}
            </View>
          )}
          
          {item.qualityReport && item.qualityReport.length > 0 ? (
            <TouchableOpacity 
              style={[styles.downloadReportBtn, { borderColor: theme.primary }]}
              onPress={() => {
                const report = item.qualityReport[0];
                const reportUrl = report?.url || report?.uri;
                if (reportUrl) {
                  setReportModalVisible(true);
                } else {
                  showAlert({ type: 'error', title: t('Error'), message: t('Lab report URL not found.') });
                }
              }}
            >
              <Icon name="file-pdf-box" size={20} color={theme.primary} />
              <Text style={[styles.downloadReportText, { color: theme.primary }]}>{t('View / Save Lab Report')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.downloadReportBtn, { borderColor: COLORS.textMuted + '40', borderStyle: 'solid', backgroundColor: '#F8F9FA' }]}>
              <Icon name="file-pdf-box" size={20} color={COLORS.textMuted} />
              <Text style={[styles.downloadReportText, { color: COLORS.textMuted }]}>{t('Lab Report Not Uploaded')}</Text>
            </View>
          )}
        </View>

        {/* Logistics & Delivery Terms */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>{t('Trade & Logistics Terms')}</Text>
          
          {item.deliveryType ? (
            <View style={styles.termRow}>
              <Icon name="truck-cargo-container" size={20} color={theme.primary} />
              <View style={styles.termContent}>
                <Text style={styles.termTitle}>{t('Delivery Type')}</Text>
                <Text style={styles.termDesc}>
                  {item.deliveryType === 'FOR' ? t('FOR (Freight Free / Delivered to your location)') : t('EX-WAREHOUSE (Ex works, buyer picks up)')}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.termRow}>
            <Icon name="scale-balance" size={20} color={theme.primary} />
            <View style={styles.termContent}>
              <Text style={styles.termTitle}>{t('Weight Basis & Tolerance')}</Text>
              <Text style={styles.termDesc}>
                {t(item.weightType || 'Net Weight')}
                {item.weightTolerance && item.weightTolerance !== '—' ? t(' with tolerance {tolerance}').replace('{tolerance}', item.weightTolerance) : ''}
              </Text>
            </View>
          </View>

          {item.paymentTimeline && item.paymentTimeline !== '—' ? (
            <View style={styles.termRow}>
              <Icon name="cash-fast" size={20} color={theme.primary} />
              <View style={styles.termContent}>
                <Text style={styles.termTitle}>{t('Payment Timeline')}</Text>
                <Text style={styles.termDesc}>{item.paymentTimeline}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.termRow}>
            <Icon name="shield-check" size={20} color={theme.primary} />
            <View style={styles.termContent}>
              <Text style={styles.termTitle}>{t('Payment Security')}</Text>
              <Text style={styles.termDesc}>
                {item.escrowEnabled ? t('🔐 Secured via BharatVyapar partner Escrow. Payment released only post delivery verification.') : t('Direct payment between parties')}
              </Text>
            </View>
          </View>

          {item.billingAddress && item.billingAddress !== '—' ? (
            <View style={styles.termRow}>
              <Icon name="map-legend" size={20} color={theme.primary} />
              <View style={styles.termContent}>
                <Text style={styles.termTitle}>{t('Billing Address')}</Text>
                <Text style={styles.termDesc}>{item.billingAddress}</Text>
              </View>
            </View>
          ) : null}

          {item.remarks && (
            <View style={styles.remarksBox}>
              <Text style={styles.remarksTitle}>{t('Remarks / Notes:')}</Text>
              <Text style={styles.remarksText}>{item.remarks}</Text>
            </View>
          )}
        </View>

        {/* Seller Info Card */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>{t('Seller Profile')}</Text>
          <View style={styles.sellerHeader}>
            <View style={[styles.sellerAvatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.sellerAvatarText}>
                {item.shopName ? item.shopName.charAt(0).toUpperCase() : (item.sellerName ? item.sellerName.charAt(0).toUpperCase() : 'F')}
              </Text>
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{item.shopName || item.sellerName}</Text>
                {item.isSellerVerified && (
                  <Icon name="decagram" size={16} color={COLORS.info} style={{ marginLeft: w(4) }} />
                )}
              </View>
              {item.shopName && item.sellerName ? (
                <Text style={styles.sellerSubtext}>{t('Contact: {name}').replace('{name}', item.sellerName)}</Text>
              ) : (
                <Text style={styles.sellerSubtext}>{t('Verified Farmer Producer Organization')}</Text>
              )}
              {item.sellerRating != null ? (
                <View style={styles.sellerRatingRow}>
                  <Icon name="star" size={14} color="#D69E2E" />
                  <Text style={styles.sellerRatingText}>
                    {t('{rating} • {count} completed trades')
                      .replace('{rating}', String(item.sellerRating))
                      .replace('{count}', String(item.sellerCompletedTrades ?? '0'))}
                  </Text>
                </View>
              ) : (
                <View style={styles.sellerRatingRow}>
                  <Icon name="star-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.sellerRatingText}>
                    {t('New Seller • 0 completed trades')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: h(90) + insets.bottom }} />
      </ScrollView>

      {/* Floating Action Sticky Footer */}
      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + h(14) }]}>
        {isOwner ? (
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
            onPress={() => setReceivedOffersModalVisible(true)}
            activeOpacity={0.8}
          >
            <Icon name="handshake" size={20} color={COLORS.white} />
            <Text style={styles.primaryActionText}>
              {loadingOffers ? t('Loading Offers...') : t('View Received Offers ({count})').replace('{count}', String(offersCount))}
            </Text>
            {loadingOffers && <ActivityIndicator size="small" color={COLORS.white} style={{ marginLeft: w(6) }} />}
          </TouchableOpacity>
        ) : activeOffer ? (
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: COLORS.success }]}
            onPress={() => navigation.navigate('NegotiationDetails', { offer: activeOffer, item, role: 'buyer' })}
            activeOpacity={0.8}
          >
            <Icon name="handshake" size={20} color={COLORS.white} />
            <Text style={styles.primaryActionText}>{t('View Your Offer')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              if (user?.kycStatus !== 'VERIFIED') {
                showAlert({
                  type: 'error',
                  title: 'KYC Required',
                  message: 'You must complete your PAN verification before placing buy offers.',
                });
                return;
              }
              setOfferModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Icon name="cart-arrow-right" size={20} color={COLORS.white} />
            <Text style={styles.primaryActionText}>{t('Submit Buy Offer')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <PlaceBuyOfferModal
        visible={offerModalVisible}
        onClose={handleCloseOfferModal}
        theme={theme}
        item={item}
        offerPrice={offerPrice}
        setOfferPrice={setOfferPrice}
        offerQty={offerQty}
        setOfferQty={setOfferQty}
        deliveryType={deliveryType}
        setDeliveryType={setDeliveryType}
        paymentTimeline={paymentTimeline}
        setPaymentTimeline={setPaymentTimeline}
        remarks={remarks}
        setRemarks={setRemarks}
        submittingOffer={submittingOffer}
        handlePlaceOffer={handlePlaceOffer}
      />

      {isOwner && (
        <ReceivedOffersModal
          visible={receivedOffersModalVisible}
          onClose={handleCloseReceivedModal}
          item={item}
        />
      )}

      {reportModalVisible && (
        <Modal
          visible={reportModalVisible}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={handleCloseReportModal}
        >
          <View style={styles.reportModalOverlay}>
            <View style={styles.optionsCard}>
              <View style={styles.optionsHeader}>
                <View style={[styles.pdfIconContainer, { backgroundColor: theme.light }]}>
                  <Icon name="file-pdf-box" size={32} color={theme.primary} />
                </View>
                <Text style={styles.optionsTitle}>{t('Government Lab Report')}</Text>
                <Text style={styles.optionsSubtitle}>{t('Choose an action for the PDF report')}</Text>
              </View>

              <View style={styles.optionsList}>
                <TouchableOpacity
                  style={styles.optionRowBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    setReportModalVisible(false);
                    const report = item.qualityReport[0];
                    const reportUrl = report?.url || report?.uri;
                    viewDocument(reportUrl);
                  }}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Icon name="eye-outline" size={20} color="#3B82F6" />
                  </View>
                  <Text style={styles.optionRowText}>{t('Open / View PDF')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionRowBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    setReportModalVisible(false);
                    const report = item.qualityReport[0];
                    const reportUrl = report?.url || report?.uri;
                    const name = report?.name || report?.key?.split('/').pop() || 'lab_report.pdf';
                    downloadFile(reportUrl, name);
                  }}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#F0FDF4' }]}>
                    <Icon name="file-download-outline" size={20} color="#22C55E" />
                  </View>
                  <Text style={styles.optionRowText}>{t('Save / Download PDF')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionRowBtn}
                  activeOpacity={0.7}
                  onPress={async () => {
                    setReportModalVisible(false);
                    const report = item.qualityReport[0];
                    const reportUrl = report?.url || report?.uri;
                    try {
                      await Share.share({
                        message: `Government Lab Report PDF: ${reportUrl}`,
                        url: reportUrl,
                      });
                    } catch (err) {
                      showAlert({ type: 'error', title: t('Error'), message: t('Failed to share.') });
                    }
                  }}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#F5F3FF' }]}>
                    <Icon name="share-variant-outline" size={20} color="#8B5CF6" />
                  </View>
                  <Text style={styles.optionRowText}>{t('Share PDF Link')}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.optionsCancelBtn}
                activeOpacity={0.8}
                onPress={handleCloseReportModal}
              >
                <Text style={styles.optionsCancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
    height: h(220),
    position: 'relative',
    backgroundColor: COLORS.white,
    marginVertical: h(8),
  },
  gallerySlide: {
    width: screenWidth,
    height: h(220),
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: screenWidth - w(32),
    height: h(200),
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8F9FA',
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
    right: w(12),
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
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: w(24),
  },
  optionsCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingTop: h(24),
    paddingBottom: h(16),
    paddingHorizontal: w(20),
    alignItems: 'center',
    elevation: 8,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  optionsHeader: {
    alignItems: 'center',
    marginBottom: h(20),
  },
  pdfIconContainer: {
    width: w(56),
    height: h(56),
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: h(12),
  },
  optionsTitle: {
    fontSize: f(16),
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: h(4),
  },
  optionsSubtitle: {
    fontSize: f(12),
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  optionsList: {
    width: '100%',
    gap: h(10),
    marginBottom: h(16),
  },
  optionRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: h(10),
    paddingHorizontal: w(12),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F3F5',
    backgroundColor: '#F8F9FA',
  },
  optionIconBox: {
    width: w(36),
    height: h(36),
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: w(12),
  },
  optionRowText: {
    fontSize: f(13),
    fontWeight: '600',
    color: COLORS.text,
  },
  optionsCancelBtn: {
    width: '100%',
    paddingVertical: h(12),
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F1F3F5',
    marginTop: h(4),
  },
  optionsCancelText: {
    fontSize: f(13),
    fontWeight: '700',
    color: COLORS.textLight,
  },
});
