import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../hook/useTranslation';
import {
  getOfferDetails,
  submitCounterOffer,
  acceptOffer,
  rejectOffer,
} from '../../../service/buy/buyCommodityService';
import { getSellCommodityById } from '../../../service/sell/sellCommodity';

const ROLE_THEMES = {
  FPO: { primary: COLORS.fpoPrimary, secondary: COLORS.fpoSecondary, light: COLORS.fpoLight, text: COLORS.fpoText },
  Trader: { primary: COLORS.traderPrimary, secondary: COLORS.traderSecondary, light: COLORS.traderLight, text: COLORS.traderText },
  Miller: { primary: COLORS.millerPrimary, secondary: COLORS.millerSecondary, light: COLORS.millerLight, text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

// Format seconds into mm:ss
function formatCountdown(seconds) {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Format expiry into Xh Ym
function formatExpiry(expiresAt) {
  if (!expiresAt) return '--';
  const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
  if (diff === 0) return 'Expired';
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Status badge config — reflects real backend statuses
// in_negotiation / countered: active multi-buyer negotiation (each buyer negotiates independently)
const STATUS_CONFIG = {
  pending:        { label: 'Awaiting Response', color: '#718096', bg: '#EDF2F7' },
  countered:      { label: 'Counter Received',  color: '#3182CE', bg: '#EBF8FF' },
  accepted:       { label: 'Deal Closed',       color: '#38A169', bg: '#F0FFF4' },
  rejected:       { label: 'Rejected',          color: '#E53E3E', bg: '#FFF5F5' },
  expired:        { label: 'Expired',           color: '#718096', bg: '#EDF2F7' },
  in_negotiation: { label: 'In Negotiation',   color: '#6B46C1', bg: '#FAF5FF' },
};


export default function NegotiationDetailsScreen({ route, navigation }) {
  const { t } = useTranslation();
  // PERFORMANCE FIX: Two granular selectors — only re-renders when user or
  // selectedRole change, not on profileLoading or other unrelated auth fields.
  const user      = useSelector(selectUser);
  const stateRole = useSelector(selectSelectedRole);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  const insets = useSafeAreaInsets();

  // Route params — offerId or offer object, and item
  const routeOffer = route?.params?.offer;
  const offerId = routeOffer?.id || routeOffer?._id || routeOffer?.offer?.id || routeOffer?.offer?._id || route?.params?.offerId;
  const routeItem = route?.params?.item;

  // ─── State ────────────────────────────────────────────────────────────
  const [offer, setOffer] = useState(null);
  const [item, setItem] = useState(routeItem || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Action state
  const [counterModalVisible, setCounterModalVisible] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterQty, setCounterQty] = useState('');
  const [counterRemarks, setCounterRemarks] = useState('');
  const [isFinalOfferToggle, setIsFinalOfferToggle] = useState(false);
  const [counterPriceError, setCounterPriceError] = useState('');

  // Mock Flow Simulator State
  const [isMockMode, setIsMockMode] = useState(false);
  const [mockRoleToggle, setMockRoleToggle] = useState(route?.params?.role || 'buyer');

  // Cooldown countdown (seconds remaining)
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const cooldownTimer = useRef(null);

  // ─── Derived from API ────────────────────────────────────────────────
  const userId = user?._id || user?.id;
  const buyerIdObj = offer?.buyerId || offer?.buyer_id || offer?.buyer;
  const buyerId = typeof buyerIdObj === 'object' ? (buyerIdObj?._id || buyerIdObj?.id) : buyerIdObj;
  
  const sellerIdObj = offer?.sellerId || offer?.seller_id || offer?.seller || offer?.commodityId?.sellerId || offer?.commodityId?.seller_id || offer?.commodity?.sellerId || offer?.commodity?.seller_id || item?.sellerId;
  const sellerId = typeof sellerIdObj === 'object' ? (sellerIdObj?._id || sellerIdObj?.id) : sellerIdObj;
  
  const rounds = offer?.negotiationHistory || offer?.rounds || [];
  
  const getComputedTurn = () => {
    if (offer?.currentTurn) return offer.currentTurn;
    if (offer?.current_turn) return offer.current_turn;
    
    if (rounds.length === 0) {
      return 'seller';
    }
    
    const lastRound = rounds[rounds.length - 1];
    const lastSenderRole = lastRound?.role || lastRound?.proposedBy || lastRound?.proposed_by;
    if (lastSenderRole === 'buyer') {
      return 'seller';
    }
    if (lastSenderRole === 'seller') {
      return 'buyer';
    }
    
    const lastSenderId = lastRound?.offeredBy || lastRound?.proposerId || lastRound?.proposer_id;
    if (lastSenderId && buyerId && String(lastSenderId) === String(buyerId)) {
      return 'seller';
    }
    if (lastSenderId && sellerId && String(lastSenderId) === String(sellerId)) {
      return 'buyer';
    }
    
    return 'seller';
  };

  const currentTurn = getComputedTurn();

  const routeRole = route?.params?.role;
  const myRole = isMockMode ? mockRoleToggle : (
    (userId && sellerId && String(userId) === String(sellerId)) ? 'seller' :
    (userId && buyerId && String(userId) === String(buyerId)) ? 'buyer' :
    (routeRole || 'buyer')
  );

  // Construct timeline rounds ensuring the initial offer round is present
  const displayRounds = React.useMemo(() => {
    const roundsList = [];
    if (!offer) return roundsList;

    const offerRounds = offer.negotiationHistory || offer.rounds || [];
    const firstRound = offerRounds[0];
    const isFirstRoundBuyer = firstRound && (
      firstRound.role === 'buyer' ||
      firstRound.proposedBy === 'buyer' ||
      firstRound.proposed_by === 'buyer' ||
      (firstRound.offeredBy && buyerId && String(firstRound.offeredBy) === String(buyerId))
    );
    const hasInitialRound = Boolean(isFirstRoundBuyer);
    if (!hasInitialRound) {
      roundsList.push({
        roundNumber: 1,
        proposedBy: 'buyer',
        price: offer.price,
        quantity: offer.quantity,
        remarks: offer.remarks || 'Initial offer submitted',
        tradeType: offer.tradeType,
        createdAt: offer.createdAt,
      });
    }
    
    offerRounds.forEach((rd, index) => {
      const proposedBy = rd.proposedBy || rd.proposed_by || rd.role || (rd.offeredBy && buyerId && String(rd.offeredBy) === String(buyerId) ? 'buyer' : 'seller');
      const roundNumber = rd.roundNumber ?? rd.round_number ?? (index + 1);
      const isFinal = rd.isFinal ?? rd.is_final ?? rd.isFinalOffer;
      const createdAt = rd.createdAt ?? rd.created_at;
      
      if (roundNumber === 0 || (roundNumber === 1 && proposedBy === 'buyer')) {
        roundsList.push({
          ...rd,
          roundNumber: 1,
          proposedBy,
          isFinal,
          createdAt,
        });
      } else {
        const firstRoundNum = offerRounds[0]?.roundNumber ?? offerRounds[0]?.round_number;
        const displayNum = typeof roundNumber === 'number'
          ? (roundNumber === 0 ? 1 : (firstRoundNum === 0 ? roundNumber + 1 : roundNumber))
          : roundsList.length + 1;
        roundsList.push({
          ...rd,
          roundNumber: displayNum,
          proposedBy,
          isFinal,
          createdAt,
        });
      }
    });
    return roundsList;
  }, [offer, buyerId]);

  const isMyTurn = offer ? currentTurn === myRole : false;
  const lastRound = displayRounds[displayRounds.length - 1];
  const isLastRoundFinal = lastRound?.isFinal === true;
  const isFinalOfferFromServer = offer?.isFinalOffer === true || offer?.is_final_offer === true || isLastRoundFinal;
  const displayRoundCount = Math.max(1, (offer?.roundCount ?? offer?.round_count ?? displayRounds.length));
  // maxNegotiationRounds: use listing value if available; backend enforces default of 5
  const maxRounds = offer?.maxNegotiationRounds || offer?.commodityId?.maxNegotiationRounds || offer?.commodity?.maxNegotiationRounds || item?.maxNegotiationRounds || 5;
  const roundsMaxed = displayRoundCount >= maxRounds;
  const isTerminal = ['accepted', 'rejected', 'expired', 'cancelled', 'closed'].includes(offer?.status);
  
  // Check if negotiation rounds are allowed
  const resolvedCommodity = offer?.commodity || (typeof offer?.commodityId === 'object' ? offer?.commodityId : null) || item;
  const isNegotiable = offer?.isNegotiable !== false &&
                       item?.isNegotiable !== false &&
                       resolvedCommodity?.isNegotiable !== false;

  const isLockedByOtherNegotiation = false; // Multi-buyer flow: no locking — each buyer negotiates independently
  const canShowCounter = isMyTurn && !isTerminal && !isFinalOfferFromServer && !roundsMaxed && offer?.canCounter !== false && isNegotiable;
  const cooldownActive = cooldownSecs > 0;

  const expiresAt = offer?.expiresAt || offer?.expires_at || (offer?.createdAt ? new Date(new Date(offer.createdAt).getTime() + 24 * 3600 * 1000).toISOString() : null);

  // ─── Load Offer Detail ────────────────────────────────────────────────
  const loadOfferDetails = useCallback(async (isRefresh = false, isBackground = false) => {
    if (!offerId) {
      setApiError(t('No offer ID provided.'));
      if (!isBackground) setLoading(false);
      return;
    }

    // Auto-start mock flow if navigating from mock cards
    if (String(offerId).startsWith('mock-')) {
      if (!isBackground) setLoading(false);
      setIsMockMode(true);
      setApiError(null);
      setOffer({
        id: offerId,
        buyerId: user?._id || 'b1',
        sellerId: 's1',
        status: 'countered',
        currentTurn: 'seller',
        roundCount: 1,
        isFinalOffer: false,
        price: 2200,
        quantity: 50,
        tradeType: 'FOR',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        canCounter: true,
        cooldownEndsAt: new Date(Date.now() - 1000).toISOString(),
        rounds: [
          {
            roundNumber: 1,
            proposedBy: 'buyer',
            price: 2200,
            quantity: 50,
            remarks: 'Initial offer, need it delivered to Haryana',
            isFinal: false,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          }
        ],
        buyer: { name: 'Mock Buyer Ramesh' },
        seller: { name: 'Mock FPO Seller' }
      });
      setItem(routeItem || { commodityName: 'Mock Wheat Grade A', unit: 'Ton' });
      return;
    }

    try {
      if (!isBackground) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
      }
      setApiError(null);

      const res = await getOfferDetails(offerId);
      const offerData = res?.data?.offer || res?.offer || res?.data || res;
      setOffer(offerData);

      // Set item from embedded commodity and fetch full populated listing details (including sellerName, shopName and sellingPrice)
      let resolvedCommodity = offerData?.commodity || (typeof offerData?.commodityId === 'object' ? offerData.commodityId : null);
      const commId = resolvedCommodity?.id || resolvedCommodity?._id || offerData?.commodityId;
      if (commId && typeof commId === 'string') {
        try {
          const fullCommodity = await getSellCommodityById(commId);
          if (fullCommodity) {
            resolvedCommodity = { ...resolvedCommodity, ...fullCommodity };
          }
        } catch (commErr) {
          console.warn('[NegotiationDetailsScreen] Failed to fetch full commodity details:', commErr);
        }
      }

      if (resolvedCommodity) {
        setItem(resolvedCommodity);
      }

      // Pre-fill counter form with last round's price or root price
      // Backend sends negotiationHistory (not rounds) — support both for safety
      const history = offerData?.negotiationHistory || offerData?.rounds || [];
      if (history.length > 0) {
        const lastRound = history[history.length - 1];
        setCounterPrice(String(lastRound.price || ''));
        setCounterQty(String(lastRound.quantity || ''));
      } else {
        setCounterPrice(String(offerData?.price || ''));
        setCounterQty(String(offerData?.quantity || ''));
      }

      // Setup cooldown timer
      if (offerData?.cooldownEndsAt) {
        const remaining = Math.max(0, Math.floor((new Date(offerData.cooldownEndsAt) - Date.now()) / 1000));
        setCooldownSecs(remaining);
      } else {
        setCooldownSecs(0);
      }
    } catch (err) {
      console.warn('[NegotiationDetails] loadOfferDetails error:', err);
      if (!isBackground) {
        setApiError(err?.message || t('Failed to load negotiation details.'));
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [offerId, routeItem, user?._id]);

  const handleRefresh = useCallback(() => loadOfferDetails(true), [loadOfferDetails]);

  useFocusEffect(
    useCallback(() => {
      loadOfferDetails();
      
      const intervalId = setInterval(() => {
        loadOfferDetails(false, true);
      }, 300000); // 5 minutes background refresh

      return () => clearInterval(intervalId);
    }, [loadOfferDetails])
  );

  // Cooldown timer tick
  useEffect(() => {
    if (cooldownSecs > 0) {
      cooldownTimer.current = setInterval(() => {
        setCooldownSecs(prev => {
          if (prev <= 1) {
            clearInterval(cooldownTimer.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(cooldownTimer.current);
  }, [cooldownSecs]);

  // ─── Accept ──────────────────────────────────────────────────────────
  const handleAccept = () => {
    if (submittingAction) return;

    const lastRound = displayRounds[displayRounds.length - 1];
    const price = lastRound?.price || offer?.price;
    const qty = lastRound?.quantity || offer?.quantity;

    showAlert({
      type: 'confirm',
      title: t('Accept Offer'),
      message: t('Accept offer at ₹{price}/Qtl for {qty} Ton? This will create an Escrow Deal and close negotiation.')
        .replace('{price}', price)
        .replace('{qty}', qty),
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Accept & Close Deal'),
          onPress: async () => {
            if (isMockMode) {
              setOffer(prev => ({ ...prev, status: 'accepted', dealId: 'mock-deal-123' }));
              showAlert({
                type: 'success', title: t('Deal Confirmed!'), message: t('Mock Escrow deal generated.'),
                buttons: [{ text: t('View Deal'), onPress: () => navigation.navigate('DealDetails', { dealId: 'mock-deal-123', item, role: myRole }) }]
              });
              return;
            }
            try {
              setSubmittingAction(true);
              const res = await acceptOffer(offerId);
              const resolvedDealId = res?.dealId || res?.data?.deal?._id || res?.deal?._id || res?.data?.deal?.id || res?.deal?.id || res?.data?.dealId;
              showAlert({
                type: 'success',
                title: t('Deal Confirmed!'),
                message: t('Agreement signed. Escrow deal generated successfully. Other pending offers on this listing will be automatically expired by the system.'),
                buttons: [
                  {
                    text: t('View Deal'),
                    onPress: () => {
                      navigation.navigate('DealDetails', {
                        dealId: resolvedDealId,
                        item,
                        role: myRole,
                      });
                    },
                  },
                ],
              });
            } catch (err) {
              console.warn('[NegotiationDetails] acceptOffer error:', err);
              showAlert({
                type: 'error',
                title: t('Accept Failed'),
                message: err?.message || t('Could not accept offer. Please try again.'),
              });
            } finally {
              setSubmittingAction(false);
              loadOfferDetails(true);
            }
          },
        },
      ],
    });
  };

  // ─── Reject ──────────────────────────────────────────────────────────
  const handleReject = () => {
    if (submittingAction) return;
    showAlert({
      type: 'confirm',
      title: t('Reject Offer'),
      message: t('Are you sure you want to reject this offer? This will end the negotiation.'),
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Reject Offer'),
          style: 'destructive',
          onPress: async () => {
            if (isMockMode) {
              setOffer(prev => ({ ...prev, status: 'rejected' }));
              showAlert({ type: 'info', title: t('Offer Rejected'), message: t('Mock Negotiation ended.'), buttons: [{ text: t('Back'), onPress: () => navigation.goBack() }] });
              return;
            }
            try {
              setSubmittingAction(true);
              await rejectOffer(offerId, { reason: 'Rejected by user' });
              showAlert({
                type: 'info',
                title: t('Offer Rejected'),
                message: t('The offer has been declined. Negotiation ended.'),
                buttons: [{ text: t('Back'), onPress: () => navigation.goBack() }],
              });
            } catch (err) {
              console.warn('[NegotiationDetails] rejectOffer error:', err);
              showAlert({
                type: 'error',
                title: t('Reject Failed'),
                message: err?.message || t('Could not decline offer. Please try again.'),
              });
            } finally {
              setSubmittingAction(false);
              loadOfferDetails(true);
            }
          },
        },
      ],
    });
  };

  // ─── Counter Submit ────────────────────────────────────────────────
  const handleCounterSubmit = async () => {
    setCounterPriceError('');
    if (!counterPrice || !counterQty) {
      showAlert({
        type: 'error',
        title: t('Validation Error'),
        message: t('Please fill in counter price and quantity.'),
      });
      return;
    }

    const newPrice = Number(counterPrice);
    const lastRound = displayRounds[displayRounds.length - 1];
    if (lastRound) {
      const delta = Math.abs(newPrice - lastRound.price) / lastRound.price;
      if (delta >= 0.05) {
        const minAllowed = +(lastRound.price * 0.951).toFixed(0);
        const maxAllowed = +(lastRound.price * 1.049).toFixed(0);
        setCounterPriceError(t('Price must be within 5%. Allowed: ₹{min} – ₹{max}').replace('{min}', minAllowed).replace('{max}', maxAllowed));
        return;
      }
    }

    if (isMockMode) {
      setOffer(prev => ({
        ...prev,
        currentTurn: myRole === 'buyer' ? 'seller' : 'buyer',
        roundCount: (prev.roundCount || 0) + 1,
        isFinalOffer: isFinalOfferToggle,
        cooldownEndsAt: new Date(Date.now() + 1800000).toISOString(),
        price: Number(counterPrice),
        quantity: Number(counterQty),
        rounds: [
          ...(prev.rounds || []),
          {
            roundNumber: (prev.roundCount || 0) + 1,
            proposedBy: myRole,
            price: Number(counterPrice),
            quantity: Number(counterQty),
            remarks: counterRemarks,
            isFinal: isFinalOfferToggle,
            createdAt: new Date().toISOString()
          }
        ]
      }));
      setCounterModalVisible(false);
      showAlert({ type: 'success', title: t('Counter Submitted'), message: t('Mock: Wait for other party response.') });
      return;
    }

    try {
      setSubmittingAction(true);
      const counterData = {
        price: newPrice,
        quantity: Number(counterQty),
        remarks: counterRemarks || '',
        isFinalOffer: isFinalOfferToggle,
      };

      await submitCounterOffer(offerId, counterData);
      setCounterModalVisible(false);
      setCounterRemarks('');
      setIsFinalOfferToggle(false);
      setCounterPriceError('');

      showAlert({
        type: 'success',
        title: t('Counter Offer Sent'),
        message: t('Counter of ₹{price}/Qtl sent. Waiting for response.').replace('{price}', counterPrice),
      });

      // Reload to get updated state
      loadOfferDetails();
    } catch (err) {
      console.warn('[NegotiationDetails] submitCounterOffer error:', err);

      // Handle specific API errors
      const code = err?.backendError?.error?.code || err?.code;
      if (code === 'PRICE_JUMP_TOO_HIGH') {
        const meta = err?.backendError?.error;
        setCounterPriceError(meta?.message ? t(meta.message) : t('Price change cannot exceed 5% per round.'));
      } else if (code === 'COOLDOWN_ACTIVE') {
        const retryAfter = err?.backendError?.error?.retryAfter;
        const retryMsg = retryAfter ? t(' Try again after {time}.').replace('{time}', new Date(retryAfter).toLocaleTimeString()) : '';
        showAlert({ type: 'error', title: t('Cooldown Active'), message: t('Please wait 30 minutes before countering again.{retry}').replace('{retry}', retryMsg) });
      } else if (code === 'ROUND_LIMIT_REACHED') {
        showAlert({ type: 'error', title: t('Round Limit'), message: t('Maximum {rounds} negotiation rounds reached. You can only Accept or Reject.').replace('{rounds}', maxRounds) });
      } else {
        showAlert({ type: 'error', title: t('Counter Failed'), message: err?.message || t('Could not submit counter offer. Try again.') });
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  const buyerObj = offer?.buyerId || offer?.buyer || routeOffer?.buyerId || routeOffer?.buyer || {};
  const buyerFirstName = buyerObj.firstName || '';
  const buyerLastName  = buyerObj.lastName || '';
  const buyerFullName  = (buyerFirstName || buyerLastName)
    ? `${buyerFirstName} ${buyerLastName}`.trim()
    : buyerObj.name || routeOffer?.buyerName || 'Buyer';
  const buyerShopName  = buyerObj.shopName || buyerObj.shopname || '';
  const rawBuyerName   = buyerShopName ? `${buyerFullName} (${buyerShopName})` : buyerFullName;
  const buyerName      = (rawBuyerName && rawBuyerName !== '—' && rawBuyerName !== 'Buyer') ? rawBuyerName : t('Buyer');

  const sellerObj = offer?.sellerId || offer?.seller || offer?.commodityId?.sellerId || offer?.commodity?.sellerId || routeOffer?.sellerId || routeOffer?.seller || {};
  const sellerFirstName = typeof sellerObj === 'object' ? (sellerObj.firstName || '') : '';
  const sellerLastName  = typeof sellerObj === 'object' ? (sellerObj.lastName || '') : '';
  const sellerFullName  = (sellerFirstName || sellerLastName)
    ? `${sellerFirstName} ${sellerLastName}`.trim()
    : (typeof sellerObj === 'object' ? sellerObj.name : '') || item?.sellerName || '—';
  const sellerShopName  = typeof sellerObj === 'object' ? (sellerObj.shopName || sellerObj.shopname || '') : '';
  const rawSellerName   = sellerShopName ? `${sellerFullName} (${sellerShopName})` : sellerFullName;
  const sellerName      = (rawSellerName && rawSellerName !== '—' && rawSellerName !== 'Unknown Seller') ? rawSellerName : t('Seller');
  const renderedTimeline = React.useMemo(() => {
    if (displayRounds.length === 0) {
      return (
        <View style={styles.emptyRoundsContainer}>
          <Icon name="chat-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyRoundsText}>{t('Offer submitted. Waiting for first response.')}</Text>
        </View>
      );
    }
    return displayRounds.map((rd, index) => {
      const isMe = String(rd.proposedBy) === myRole;
      return (
        <View key={index} style={styles.timelineRow}>
          <View style={styles.timelineIndicators}>
            <View style={[styles.dot, { backgroundColor: isMe ? theme.primary : '#3182CE' }]} />
            {index < displayRounds.length - 1 && <View style={styles.line} />}
          </View>

          <View style={[
            styles.roundCard,
            isMe
              ? [styles.myRoundCard, { borderLeftColor: theme.primary }]
              : styles.theirRoundCard,
            rd.isFinal && styles.finalRoundCard,
          ]}>
            <View style={styles.roundHeader}>
              <Text style={[styles.roundSender, { color: isMe ? theme.primary : '#3182CE' }]}>
                {isMe ? t('You') : (myRole === 'buyer' ? sellerName : buyerName)}
              </Text>
              <Text style={styles.roundDate}>
                {rd.createdAt ? new Date(rd.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
              </Text>
            </View>
            {isNegotiable && (
              <Text style={styles.roundTitle}>
                {t('Round')} {rd.roundNumber ?? index + 1}
                {rd.isFinal ? t(' (FINAL OFFER)') : ''}
              </Text>
            )}
            <View style={styles.roundSpecs}>
              <View>
                <Text style={styles.specLabel}>{t('Price')}</Text>
                <Text style={[styles.specVal, { color: isMe ? theme.primary : '#3182CE' }]}>
                  ₹{rd.price}/Qt
                </Text>
              </View>
              <View>
                <Text style={styles.specLabel}>{t('Quantity')}</Text>
                <Text style={styles.specVal}>{rd.quantity} {item?.unit || 'Ton'}</Text>
              </View>
              <View>
                <Text style={styles.specLabel}>{t('Trade')}</Text>
                <Text style={styles.specVal}>{rd.tradeType || offer?.tradeType || 'FOR'}</Text>
              </View>
            </View>
            {rd.remarks ? (
              <View style={styles.remarksRow}>
                <Icon name="message-text-outline" size={13} color={COLORS.textLight} />
                <Text style={styles.roundRemarks}>"{rd.remarks}"</Text>
              </View>
            ) : null}
          </View>
        </View>
      );
    });
  }, [displayRounds, myRole, theme, sellerName, buyerName, isNegotiable, item?.unit, offer?.tradeType, t]);

  // ─── Loading & Error screens ─────────────────────────────────────────
  if (loading) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title={t("Negotiation Thread")}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t("Loading negotiation details...")}</Text>
        </View>
      </SafeScreen>
    );
  }

  if (apiError && !offer) {
    return (
      <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
        <AppHeader
          backgroundColor={theme.primary}
          title={t("Negotiation Thread")}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centeredContainer}>
          <Icon name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>{t("Failed to Load")}</Text>
          <Text style={styles.errorDesc}>{t(apiError)}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => loadOfferDetails()}>
            <Text style={styles.retryBtnText}>{t("Retry API")}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.retryBtn, { backgroundColor: '#3182CE', marginTop: h(12) }]} 
            onPress={() => {
              setIsMockMode(true);
              setApiError(null);
              setOffer({
                id: 'mock-123',
                buyerId: user?._id || 'b1',
                sellerId: 's1',
                status: 'countered',
                currentTurn: 'buyer',
                roundCount: 2,
                isFinalOffer: false,
                price: 2350,
                quantity: 50,
                tradeType: 'FOR',
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
                canCounter: true,
                cooldownEndsAt: new Date(Date.now() - 1000).toISOString(),
                rounds: [
                  {
                    roundNumber: 1,
                    proposedBy: 'buyer',
                    price: 2200,
                    quantity: 50,
                    remarks: 'Initial offer, need it delivered to Haryana',
                    isFinal: false,
                    createdAt: new Date(Date.now() - 3600000).toISOString(),
                  },
                  {
                    roundNumber: 2,
                    proposedBy: 'seller',
                    price: 2350,
                    quantity: 50,
                    remarks: 'Best price for this grade',
                    isFinal: false,
                    createdAt: new Date(Date.now() - 1800000).toISOString(),
                  }
                ],
                buyer: { name: 'Mock Buyer Ramesh' },
                seller: { name: 'Mock FPO Seller' }
              });
              setItem(routeItem || { commodityName: 'Mock Wheat Grade A', unit: 'Ton' });
            }}
          >
            <Text style={styles.retryBtnText}>{t("Start Test Mock Flow")}</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  const statusCfg = offer?.status === 'accepted'
    ? { label: 'Deal Closed', color: '#16a34a', bg: '#f0fdf4' }
    : offer?.status === 'rejected'
    ? { label: 'Rejected', color: '#dc2626', bg: '#fef2f2' }
    : offer?.status === 'expired'
    ? { label: 'Expired', color: '#6b7280', bg: '#f9fafb' }
    : offer?.status === 'cancelled'
    ? { label: 'Cancelled', color: '#6b7280', bg: '#f9fafb' }
    : offer?.status === 'closed'
    ? { label: 'Closed', color: '#6b7280', bg: '#f9fafb' }
    // Backend sends 'In Negotiation' (capital, spaced) — normalise both casings
    : (offer?.displayStatus === 'In Negotiation' || offer?.displayStatus === 'in_negotiation')
    ? { label: 'In Negotiation', color: '#6B46C1', bg: '#FAF5FF' }
    : isMyTurn
    ? { label: 'Action Required', color: '#2563eb', bg: '#eff6ff' }
    : { label: 'Awaiting Response', color: '#9ca3af', bg: '#f9fafb' };
  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title={t("Negotiation")}
        subtitle={item?.commodityName ? t(item.commodityName) : t('Thread')}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      {isMockMode && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>🧪 {t('TEST MOCK FLOW ACTIVE')}</Text>
          <TouchableOpacity
            onPress={() => {
              setMockRoleToggle(prev => prev === 'buyer' ? 'seller' : 'buyer');
              setCooldownSecs(0);
            }}
            style={styles.swapRoleBtn}
          >
            <Text style={styles.swapRoleBtnText}>{t('Swap Role (Now: {role})').replace('{role}', t(mockRoleToggle))}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* API Error Banner */}
      {apiError && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={15} color={COLORS.white} />
          <Text style={styles.errorBannerText}>{t(apiError)}</Text>
          <TouchableOpacity onPress={() => loadOfferDetails(true)} style={styles.retryBadge}>
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

        {/* Deal Summary Header */}
        <View style={styles.dealHeaderCard}>
          <View style={styles.dealHeaderTop}>
            <View style={styles.flex1}>
              <Text style={styles.commodityTitle}>
                {t(item?.name || item?.commodityName || 'Commodity')} {item?.grade ? `(${t('Grade')} ${item.grade})` : ''}
              </Text>
              <Text style={styles.commodityVariety}>{item?.type ? t(item.type) : (item?.description ? t(item.description) : '')}</Text>
              <View style={[styles.partyRow, { alignItems: 'flex-start' }]}>
                <Icon name="account-multiple-outline" size={14} color={COLORS.textMuted} style={{ marginTop: 2 }} />
                <View style={styles.partiesColumn}>
                  {myRole !== 'buyer' && (
                    <Text style={styles.partyText} numberOfLines={1}>
                      <Text style={{ fontWeight: '700' }}>{t('Buyer:')}</Text> {buyerName}
                    </Text>
                  )}
                  {myRole !== 'seller' && (
                    <Text style={styles.partyText} numberOfLines={1}>
                      <Text style={{ fontWeight: '700' }}>{t('Seller:')}</Text> {sellerName}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{t(statusCfg.label)}</Text>
            </View>
          </View>

          {/* Price Strip */}
          <View style={styles.pricingStrip}>
            <View style={styles.pricingItem}>
              <Text style={styles.pricingLabel}>
                {myRole === 'seller' ? t("Buyer's Offer") : t("Original Ask")}
              </Text>
              <Text style={[styles.pricingVal, myRole === 'seller' && { color: theme.primary }]}>
                ₹{myRole === 'seller' 
                  ? (lastRound?.price || offer?.price || '--') 
                  : (item?.basePrice || item?.sellingPrice || '--')}/Qt
              </Text>
            </View>
            <View style={styles.pricingDivider} />
            <View style={styles.pricingItem}>
              <Text style={styles.pricingLabel}>
                {myRole === 'seller' ? t("Your Listed Price") : t("Current Bid")}
              </Text>
              <Text style={[styles.pricingVal, myRole !== 'seller' && { color: theme.primary }]}>
                ₹{myRole === 'seller'
                  ? (item?.basePrice || item?.sellingPrice || '--')
                  : (lastRound?.price || offer?.price || '--')}/Qt
              </Text>
            </View>
            <View style={styles.pricingDivider} />
            <View style={styles.pricingItem}>
              <Text style={styles.pricingLabel}>{t('Quantity')}</Text>
              <Text style={styles.pricingVal}>{lastRound?.quantity || offer?.quantity || '--'} {item?.unit || 'Ton'}</Text>
            </View>
          </View>

          {/* Round & Expiry info */}
          <View style={styles.metaRow}>
            {isNegotiable ? (
              <View style={styles.metaChip}>
                <Icon name="refresh-circle" size={14} color={theme.primary} />
                <Text style={[styles.metaChipText, { color: theme.primary }]}>
                  {t('Round {current} of {total}').replace('{current}', displayRoundCount).replace('{total}', maxRounds)}
                </Text>
              </View>
            ) : (
              <View style={[styles.metaChip, { backgroundColor: '#F0FFF4', borderColor: '#C6F6D5' }]}>
                <Icon name="handshake" size={14} color="#38A169" />
                <Text style={[styles.metaChipText, { color: '#2F855A' }]}>
                  {t('Direct Deal (No Negotiation)')}
                </Text>
              </View>
            )}
            <View style={styles.metaChip}>
              <Icon name="timer-outline" size={14} color={displayRoundCount >= 4 ? COLORS.error : COLORS.textMuted} />
              <Text style={[styles.metaChipText, { color: displayRoundCount >= 4 ? COLORS.error : COLORS.textMuted }]}>
                {t('Expires: {time}').replace('{time}', t(formatExpiry(expiresAt)))}
              </Text>
            </View>
            {isFinalOfferFromServer && (
              <View style={[styles.metaChip, { backgroundColor: '#FFF5F5' }]}>
                <Icon name="flag-checkered" size={14} color={COLORS.error} />
                <Text style={[styles.metaChipText, { color: COLORS.error }]}>{t('Final Offer')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Terminal Status Banner */}
        {isTerminal && (
          <View style={[styles.terminalBanner, {
            backgroundColor: offer?.status === 'accepted' ? '#F0FFF4' : offer?.status === 'rejected' ? '#FFF5F5' : '#EDF2F7',
            borderColor: offer?.status === 'accepted' ? '#9AE6B4' : offer?.status === 'rejected' ? '#FEB2B2' : '#CBD5E0',
          }]}>
            <Icon
              name={offer?.status === 'accepted' ? 'check-decagram' : offer?.status === 'rejected' ? 'close-circle' : 'clock-alert'}
              size={22}
              color={offer?.status === 'accepted' ? COLORS.success : offer?.status === 'rejected' ? COLORS.error : COLORS.textMuted}
            />
            <View style={styles.flex1}>
              <Text style={[styles.terminalBannerTitle, {
                color: offer?.status === 'accepted' ? '#22543D' : offer?.status === 'rejected' ? '#742A2A' : '#4A5568',
              }]}>
                {offer?.status === 'accepted' ? t('Deal Accepted — Escrow Created') : offer?.status === 'rejected' ? t('Offer Rejected') : t('Offer Expired')}
              </Text>
              <Text style={styles.terminalBannerDesc}>
                {offer?.status === 'accepted'
                  ? t('Both parties agreed. Check Deal Details for escrow progress.')
                  : offer?.status === 'rejected'
                  ? t('This negotiation has ended. You may submit a new offer.')
                  : t('This offer expired after 24 hours with no agreement reached.')}
              </Text>
            </View>
          </View>
        )}

        {/* Round Limit Banner */}
        {isNegotiable && roundsMaxed && !isTerminal && (
          <View style={styles.roundLimitBanner}>
            <Icon name="alert" size={18} color="#D69E2E" />
            <Text style={styles.roundLimitText}>{t('Maximum {rounds} rounds reached — Accept or Reject only').replace('{rounds}', maxRounds)}</Text>
          </View>
        )}

        {/* Not My Turn Banner */}
        {!isMyTurn && !isTerminal && (
          <View style={styles.waitingBanner}>
            <Icon name="timer-sand" size={18} color={COLORS.textMuted} />
            <Text style={styles.waitingText}>
              {t('Waiting for {party} to respond...').replace('{party}', currentTurn === 'buyer' ? buyerName : sellerName)}
            </Text>
          </View>
        )}

        {/* Negotiation History */}
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>
          {isNegotiable ? t('Negotiation History') : t('Offer Details')}
        </Text>
        <View style={styles.timeline}>
          {renderedTimeline}
        </View>

        <View style={{ height: h(120) + insets.bottom }} />
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={[styles.actionFooter, { paddingBottom: insets.bottom + h(14) }]}>
        {submittingAction ? (
          <View style={styles.pendingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.pendingText}>{t('Processing...')}</Text>
          </View>
        ) : isTerminal ? (
          // Terminal state — show view deal or go back
          offer?.status === 'accepted' ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.success, flex: 1 }]}
              onPress={() => navigation.navigate('DealDetails', { dealId: offer?.dealId || offer?.id || offer?._id, item, role: myRole })}
            >
              <Icon name="handshake" size={18} color={COLORS.white} />
              <Text style={styles.acceptBtnText}>{t('View Escrow Deal')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.primary, flex: 1 }]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={18} color={COLORS.white} />
              <Text style={styles.acceptBtnText}>{t('Back to Offers')}</Text>
            </TouchableOpacity>
          )
        ) : (
          // Active state (Negotiation in progress)
          <View>
            {!isMyTurn && (
              <View style={[styles.pendingContainer, { marginBottom: h(8) }]}>
                <Icon name="timer-sand" size={16} color={COLORS.textMuted} />
                <Text style={[styles.pendingText, { flex: 1, fontSize: f(11) }]}>
                  {t('Waiting for {party} to respond...').replace('{party}', currentTurn === 'buyer' ? buyerName : sellerName)}
                </Text>
              </View>
            )}
            <View style={styles.buttonRow}>
              {/* Decline: Visible when it is your turn and negotiation is active */}
              {isMyTurn && (
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={handleReject}>
                  <Icon name="close-circle-outline" size={18} color={COLORS.error} />
                  <Text style={styles.rejectBtnText}>{t('Decline')}</Text>
                </TouchableOpacity>
              )}

              {/* Accept: Visible when it's your turn and the last round was proposed by the other party */}
              {isMyTurn && lastRound && (
                lastRound.proposedBy !== myRole &&
                lastRound.proposed_by !== myRole &&
                lastRound.role !== myRole
              ) && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                  onPress={handleAccept}
                  disabled={submittingAction}
                >
                  <Icon name="check-decagram" size={18} color={COLORS.white} />
                  <Text style={styles.acceptBtnText}>{t('Accept')}</Text>
                </TouchableOpacity>
              )}

              {/* Counter button — visible only when it is your turn */}
              {canShowCounter && (
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.counterBtn,
                    cooldownActive && styles.disabledBtn,
                  ]}
                  onPress={() => !cooldownActive && setCounterModalVisible(true)}
                  disabled={cooldownActive}
                >
                  <Icon name="swap-horizontal" size={18} color={cooldownActive ? COLORS.textMuted : theme.primary} />
                  <Text style={[styles.counterBtnText, { color: cooldownActive ? COLORS.textMuted : theme.primary }]}>
                    {cooldownActive ? t('Counter ({time})').replace('{time}', formatCountdown(cooldownSecs)) : t('Counter')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Counter Offer Modal */}
      <Modal
        visible={counterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCounterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Submit Counter Offer')}</Text>
              <TouchableOpacity onPress={() => { setCounterModalVisible(false); setCounterPriceError(''); }}>
                <Icon name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              {t('Max 5% price movement per round. {info}')
                .replace('{info}', displayRoundCount + 1 < maxRounds 
                  ? t('{remaining} round(s) remaining after this.').replace('{remaining}', maxRounds - displayRoundCount - 1)
                  : t('This is the final round.')
                )}
            </Text>

            <Text style={styles.inputLabel}>{t('Counter Price (₹/Qt)')}</Text>
            <TextInput
              style={[styles.modalInput, counterPriceError ? styles.inputError : null]}
              keyboardType="numeric"
              value={counterPrice}
              onChangeText={v => { setCounterPrice(v); setCounterPriceError(''); }}
              placeholder={lastRound?.price ? t('e.g. {price}').replace('{price}', lastRound.price) : t('e.g. price')}
            />
            {counterPriceError ? (
              <Text style={styles.inlineError}>{t(counterPriceError)}</Text>
            ) : (
              <Text style={styles.hint}>
                {t('Last price: ₹{lastPrice} — Allowed ±5%: ₹{min} – ₹{max}')
                  .replace('{lastPrice}', lastRound?.price || '--')
                  .replace('{min}', lastRound ? +(lastRound.price * 0.951).toFixed(0) : '--')
                  .replace('{max}', lastRound ? +(lastRound.price * 1.049).toFixed(0) : '--')
                }
              </Text>
            )}

            <Text style={styles.inputLabel}>
              {t('Quantity ({unit})').replace('{unit}', item?.unit ? t(item.unit) : 'Ton')}
            </Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={counterQty}
              onChangeText={setCounterQty}
              placeholder={lastRound?.quantity ? t('e.g. {qty}').replace('{qty}', lastRound.quantity) : t('e.g. quantity')}
            />

            <Text style={styles.inputLabel}>{t('Remarks / Conditions')}</Text>
            <TextInput
              style={[styles.modalInput, { height: h(60), textAlignVertical: 'top' }]}
              multiline
              value={counterRemarks}
              onChangeText={setCounterRemarks}
              placeholder={t('Explain your counter terms...')}
            />

            <View style={styles.switchRow}>
              <View style={styles.flex1}>
                <Text style={styles.switchLabel}>{t('Mark as Final Offer')}</Text>
                <Text style={styles.switchDesc}>
                  {isFinalOfferToggle ? t('Other party can ONLY accept or reject — no more counters.') : t('Other party can counter further.')}
                </Text>
              </View>
              <Switch
                value={isFinalOfferToggle}
                onValueChange={setIsFinalOfferToggle}
                trackColor={{ false: '#767577', true: theme.primary + '80' }}
                thumbColor={isFinalOfferToggle ? theme.primary : '#f4f3f4'}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => { setCounterModalVisible(false); setCounterPriceError(''); }}
                disabled={submittingAction}
              >
                <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handleCounterSubmit}
                disabled={submittingAction}
              >
                {submittingAction ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.submitBtnText}>{t('Submit Counter')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // Deal Header Card
  dealHeaderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: w(16),
    marginBottom: h(14),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  dealHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: h(12),
  },
  commodityTitle: {
    fontSize: f(15),
    fontWeight: '800',
    color: COLORS.text,
  },
  commodityVariety: {
    fontSize: f(11),
    color: COLORS.textLight,
    marginTop: h(2),
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    marginTop: h(6),
    backgroundColor: '#F8FAFC',
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: 6,
  },
  partyText: {
    fontSize: f(11),
    color: COLORS.textLight,
  },
  statusBadge: {
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: f(11),
    fontWeight: '700',
  },
  pricingStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: w(12),
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: h(12),
  },
  pricingItem: {
    alignItems: 'center',
    flex: 1,
  },
  pricingLabel: {
    fontSize: f(10),
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  pricingVal: {
    fontSize: f(13),
    fontWeight: '700',
    color: COLORS.text,
    marginTop: h(2),
    textAlign: 'center',
  },
  pricingDivider: {
    width: 1,
    backgroundColor: '#E9ECEF',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: w(8),
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    backgroundColor: '#F8F9FA',
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  metaChipText: {
    fontSize: f(11),
    fontWeight: '600',
  },
  // Status banners
  terminalBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: w(10),
    padding: w(14),
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: h(14),
  },
  terminalBannerTitle: {
    fontSize: f(13),
    fontWeight: '800',
    marginBottom: h(2),
  },
  terminalBannerDesc: {
    fontSize: f(11),
    color: COLORS.textLight,
    lineHeight: h(15),
  },
  roundLimitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: w(12),
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: h(14),
  },
  roundLimitText: {
    fontSize: f(12),
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: w(12),
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: h(14),
  },
  waitingText: {
    fontSize: f(12),
    color: COLORS.textLight,
    flex: 1,
  },
  // Timeline
  sectionTitle: {
    fontSize: f(14),
    fontWeight: '800',
    marginBottom: h(14),
  },
  timeline: {
    paddingLeft: w(4),
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineIndicators: {
    alignItems: 'center',
    marginRight: w(12),
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: h(16),
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#DEE2E6',
    marginVertical: h(4),
  },
  roundCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: w(14),
    marginBottom: h(16),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderLeftWidth: 4,
  },
  myRoundCard: {
    borderLeftColor: COLORS.border,
  },
  theirRoundCard: {
    borderLeftColor: '#3182CE',
  },
  finalRoundCard: {
    borderTopWidth: 2,
    borderTopColor: COLORS.error,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(4),
  },
  roundSender: {
    fontSize: f(11),
    fontWeight: '700',
  },
  roundDate: {
    fontSize: f(10),
    color: COLORS.textMuted,
  },
  roundTitle: {
    fontSize: f(12),
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: h(10),
  },
  roundSpecs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: w(8),
    marginBottom: h(8),
  },
  specLabel: {
    fontSize: f(9),
    color: COLORS.textMuted,
  },
  specVal: {
    fontSize: f(11),
    fontWeight: '700',
    marginTop: h(1),
    color: COLORS.text,
  },
  roundRemarks: {
    fontSize: f(11),
    fontStyle: 'italic',
    color: COLORS.textLight,
    lineHeight: h(15),
  },
  emptyRoundsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: w(24),
    gap: h(8),
  },
  emptyRoundsText: {
    fontSize: f(13),
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  // Action Footer
  actionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingVertical: h(14),
    paddingHorizontal: w(16),
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: w(8),
  },
  actionBtn: {
    flex: 1,
    height: h(44),
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(4),
  },
  rejectBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.error,
    flex: 0.9,
  },
  rejectBtnText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: f(13),
  },
  counterBtn: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
  },
  counterBtnText: {
    fontWeight: '700',
    fontSize: f(12),
  },
  disabledBtn: {
    opacity: 0.55,
    backgroundColor: '#F1F3F5',
  },
  acceptBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: f(13),
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(8),
    paddingVertical: h(4),
  },
  pendingText: {
    fontSize: f(11),
    color: COLORS.textLight,
    flex: 1,
    lineHeight: h(16),
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: w(20),
    paddingBottom: h(30),
    elevation: 10,
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
  modalDesc: {
    fontSize: f(11),
    color: COLORS.textMuted,
    lineHeight: h(15),
    marginBottom: h(12),
  },
  inputLabel: {
    fontSize: f(11),
    fontWeight: '700',
    color: COLORS.textLight,
    marginTop: h(10),
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    paddingHorizontal: w(10),
    height: h(40),
    fontSize: f(13),
    color: COLORS.text,
    backgroundColor: '#F8F9FA',
    marginTop: h(4),
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inlineError: {
    fontSize: f(11),
    color: COLORS.error,
    marginTop: h(2),
    fontWeight: '600',
  },
  hint: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginTop: h(2),
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: w(10),
    marginVertical: h(14),
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  switchLabel: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.text,
  },
  switchDesc: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginTop: h(2),
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
  // Interned helpers — prevent new JSObject allocation every render
  flex1: {
    flex: 1,
  },
  partiesColumn: {
    flex: 1,
    gap: 4,
  },
  remarksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(4),
    marginTop: h(8),
  },
  mockBanner: {
    backgroundColor: '#F6E05E',
    paddingHorizontal: w(16),
    paddingVertical: h(10),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mockBannerText: {
    fontWeight: '800',
    fontSize: f(11),
    color: '#744210',
  },
  swapRoleBtn: {
    backgroundColor: '#000',
    paddingHorizontal: w(12),
    paddingVertical: h(6),
    borderRadius: 6,
  },
  swapRoleBtnText: {
    color: '#fff',
    fontSize: f(10),
    fontWeight: '700',
  },
});
