import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from '@react-native-documents/picker';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, mw, f } from '../../../utils/responsive';
import { showAlert } from '../../../components/CustomAlertBox';
import { createSellCommodity, updateSellCommodity } from '../../../service/sell/sellCommodity';

const ROLE_THEMES = {
  FPO: { primary: COLORS.fpoPrimary, secondary: COLORS.fpoSecondary, light: COLORS.fpoLight, text: COLORS.fpoText },
  Trader: { primary: COLORS.traderPrimary, secondary: COLORS.traderSecondary, light: COLORS.traderLight, text: COLORS.traderText },
  Miller: { primary: COLORS.millerPrimary, secondary: COLORS.millerSecondary, light: COLORS.millerLight, text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

export default function SellCommodities({ route, navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  
  // Dynamically calculate bottom padding for the tab bar to avoid overlap
  const bottomTabBarHeight = useBottomTabBarHeight();

  // Focus Tracker State for Inputs
  const [focusedField, setFocusedField] = useState(null);

  // Form State fields
  const [commodityName, setCommodityName] = useState('');
  const [type, setType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('Ton');
  const [sellingPrice, setSellingPrice] = useState('');
  const [sellingPriceUnit, setSellingPriceUnit] = useState('Ton');
  const [weightType, setWeightType] = useState('Net Weight');
  const [listingEndDate, setListingEndDate] = useState('');
  const [weightTolerance, setWeightTolerance] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [exWarehouseAddress, setExWarehouseAddress] = useState('');
  const [paymentTimeline, setPaymentTimeline] = useState('');
  const [remarks, setRemarks] = useState('');
  const [deliveryType, setDeliveryType] = useState('FOR');
  const [isNegotiable, setIsNegotiable] = useState(true);
  const [minimumAcceptablePrice, setMinimumAcceptablePrice] = useState('');
  const [maxNegotiationRounds, setMaxNegotiationRounds] = useState('');
  const [offerExpiryHours, setOfferExpiryHours] = useState('');
  const [commodityLocation, setCommodityLocation] = useState('');
  const [escrowEnabled, setEscrowEnabled] = useState(true);
  const [buyerTransportAllowed, setBuyerTransportAllowed] = useState(false);

  // Fixed/Static quality metrics (placeholders, editable directly)
  const [moisture, setMoisture] = useState('');
  const [foreignMaterial, setForeignMaterial] = useState('');
  const [broken, setBroken] = useState('');

  // Media states
  const [commodityImages, setCommodityImages] = useState([]);
  const [qualityReport, setQualityReport] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Check for pre-filled data passed via route parameters (Edit mode)
  const editItem = route?.params?.editItem;

  useEffect(() => {
    if (editItem) {
      setCommodityName(editItem.commodityName || '');
      setType(editItem.type || '');
      setQuantity(editItem.quantity ? String(editItem.quantity) : '');
      const loadedUnit = editItem.unit || 'Ton';
      setUnit(loadedUnit);
      setSellingPrice(editItem.sellingPrice ? String(editItem.sellingPrice) : '');
      // Derive price unit from the loaded quantity unit
      const unitPriceMap = { Ton: 'Ton', Quintal: 'Qt', Kg: 'Kg' };
      setSellingPriceUnit(unitPriceMap[loadedUnit] || editItem.sellingPriceUnit || 'Ton');
      setWeightType(editItem.weightType || 'Net Weight');
      setListingEndDate(editItem.listingEndDate || '');
      
      const cleanToleranceVal = (val) => {
        if (!val) return '';
        return val.replace(/[^\d.]/g, '').trim();
      };
      setWeightTolerance(cleanToleranceVal(editItem.weightTolerance));
      
      setBillingAddress(editItem.billingAddress || '');
      setExWarehouseAddress(editItem.exWarehouseAddress || '');
      setPaymentTimeline(editItem.paymentTimeline || '');
      setRemarks(editItem.remarks || '');
      setDeliveryType(editItem.deliveryType || 'FOR');
      setIsNegotiable(editItem.isNegotiable !== false);
      setMinimumAcceptablePrice(editItem.minimumAcceptablePrice ? String(editItem.minimumAcceptablePrice) : '');
      setMaxNegotiationRounds(editItem.maxNegotiationRounds ? String(editItem.maxNegotiationRounds) : '');
      setOfferExpiryHours(editItem.offerExpiryHours ? String(editItem.offerExpiryHours) : '');
      setCommodityLocation(editItem.commodityLocation || '');
      setEscrowEnabled(editItem.escrowEnabled !== false);
      setBuyerTransportAllowed(Boolean(editItem.buyerTransportAllowed));
      
      // Parse static quality metrics from parameters array
      if (Array.isArray(editItem.qualityParameters)) {
        const findParam = (keys) => {
          return editItem.qualityParameters.find(p => {
            const pName = (p.name || p.parameterName || '').toLowerCase();
            return keys.some(k => pName.includes(k));
          });
        };
        const m = findParam(['moisture']);
        const fMat = findParam(['foreign']);
        const b = findParam(['broken']);

        const cleanPctVal = (param) => {
          if (!param) return '';
          const rawVal = param.val || param.parameterValue || '';
          return rawVal.replace(/%/g, '').trim();
        };

        setMoisture(cleanPctVal(m));
        setForeignMaterial(cleanPctVal(fMat));
        setBroken(cleanPctVal(b));
      }
      setCommodityImages([]);
      setQualityReport([]);
    }
  }, [editItem]);

  const handleAddImages = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 10,
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        showAlert({ type: 'error', title: 'Image Error', message: result.errorMessage || 'Failed to pick images.' });
        return;
      }
      if (result.assets && Array.isArray(result.assets)) {
        setCommodityImages(result.assets);
      }
    } catch (err) {
      console.log('Image picker err:', err);
      showAlert({ type: 'error', title: 'Unexpected Error', message: 'Something went wrong while opening the gallery.' });
    }
  };

  const handleAddReport = async () => {
    try {
      const result = await DocumentPicker.pick({
        allowMultiSelection: true,
        type: [DocumentPicker.types.pdf],
      });
      if (result && Array.isArray(result)) {
        setQualityReport(result);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('DocumentPicker err:', err);
        showAlert({ type: 'error', title: 'File Error', message: 'Failed to pick the document.' });
      }
    }
  };

  const handlePostListing = async () => {
    const cName = commodityName.trim();
    const cQty = Number(quantity);
    const cPrice = Number(sellingPrice);

    const formatPct = (val) => {
      const cleaned = val.replace(/%/g, '').trim();
      return cleaned ? `${cleaned}%` : '';
    };

    // --- Validation Guards ---
    if (!cName) {
      showAlert({ type: 'error', title: 'Missing Info', message: 'Commodity Name is required.' });
      return;
    }
    if (!quantity || isNaN(cQty) || cQty <= 0) {
      showAlert({ type: 'error', title: 'Invalid Quantity', message: 'Please enter a valid quantity greater than 0.' });
      return;
    }
    if (!sellingPrice || isNaN(cPrice) || cPrice <= 0) {
      showAlert({ type: 'error', title: 'Invalid Price', message: 'Please enter a valid price greater than 0.' });
      return;
    }
    if (deliveryType === 'EX_WAREHOUSE' && !exWarehouseAddress.trim()) {
      showAlert({ type: 'error', title: 'Missing Address', message: 'Pickup Warehouse Address is required for Ex-Warehouse delivery.' });
      return;
    }

    const formatTolerance = (val) => {
      const trimmed = val.trim();
      if (!trimmed) return '+/- 1%';
      const numbersOnly = trimmed.replace(/[^\d.]/g, '');
      return numbersOnly ? `+/- ${numbersOnly}%` : trimmed;
    };

    // Apply safe defaults for empty fields to conform with backend API requirements
    const finalLocation = commodityLocation.trim() || 'Indore, MP';
    const finalBilling = billingAddress.trim() || 'Indore Mandi Complex, MP';
    const finalTolerance = formatTolerance(weightTolerance);
    const finalTimeline = paymentTimeline.trim() || 'Within 3 days of delivery';

    let finalExpiryDate = listingEndDate.trim();
    if (!finalExpiryDate) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      finalExpiryDate = d.toISOString().split('T')[0];
    } else {
      const parsedDate = new Date(finalExpiryDate);
      if (isNaN(parsedDate.getTime())) {
        showAlert({ type: 'error', title: 'Invalid Date', message: 'Listing end date is invalid. Use YYYY-MM-DD format.' });
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsedDate <= today) {
        showAlert({ type: 'error', title: 'Invalid Date', message: 'Listing end date must be a future date.' });
        return;
      }
    }

    let minPrice = null;
    let maxRounds = 5;
    let expHours = 24;

    if (isNegotiable) {
      minPrice = minimumAcceptablePrice ? Number(minimumAcceptablePrice) : null;
      if (minimumAcceptablePrice && (isNaN(minPrice) || minPrice <= 0 || minPrice > cPrice)) {
        showAlert({ type: 'error', title: 'Invalid Minimum Price', message: 'Minimum acceptable price must be a valid number and cannot exceed expected price.' });
        return;
      }
      maxRounds = maxNegotiationRounds ? Number(maxNegotiationRounds) : 5;
      if (isNaN(maxRounds) || maxRounds < 1 || maxRounds > 20) {
        showAlert({ type: 'error', title: 'Invalid Rounds', message: 'Max negotiation rounds must be between 1 and 20.' });
        return;
      }
      expHours = offerExpiryHours ? Number(offerExpiryHours) : 24;
      if (isNaN(expHours) || expHours < 1 || expHours > 720) {
        showAlert({ type: 'error', title: 'Invalid Expiry', message: 'Offer expiry must be between 1 and 720 hours.' });
        return;
      }
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      
      formData.append('commodityName', cName);
      if (type.trim()) formData.append('type', type.trim());
      formData.append('quantity', cQty.toString());
      formData.append('unit', unit);
      formData.append('sellingPrice', cPrice.toString());
      formData.append('sellingPriceUnit', sellingPriceUnit);
      formData.append('weightType', weightType);
      formData.append('listingEndDate', finalExpiryDate);
      formData.append('deliveryType', deliveryType);
      formData.append('weightTolerance', finalTolerance);
      formData.append('billingAddress', finalBilling);
      
      if (exWarehouseAddress.trim() && deliveryType === 'EX_WAREHOUSE') {
        formData.append('exWarehouseAddress', exWarehouseAddress.trim());
      }
      formData.append('paymentTimeline', finalTimeline);
      if (remarks.trim()) formData.append('remarks', remarks.trim());
      formData.append('isNegotiable', isNegotiable.toString());
      
      if (isNegotiable) {
        if (minPrice !== null) formData.append('minimumAcceptablePrice', minPrice.toString());
        formData.append('maxNegotiationRounds', maxRounds.toString());
        formData.append('offerExpiryHours', expHours.toString());
      }
      
      formData.append('commodityLocation', finalLocation);
      formData.append('escrowEnabled', escrowEnabled.toString());
      formData.append('buyerTransportAllowed', buyerTransportAllowed.toString());
      
      // Dynamic quality params mapping from static fields
      const validQualityParams = [];
      if (moisture.trim()) validQualityParams.push({ name: 'Moisture', val: formatPct(moisture) });
      if (foreignMaterial.trim()) validQualityParams.push({ name: 'Foreign Material', val: formatPct(foreignMaterial) });
      if (broken.trim()) validQualityParams.push({ name: 'Broken', val: formatPct(broken) });

      validQualityParams.forEach((param, index) => {
        formData.append(`qualityParameters[${index}][parameterName]`, param.name);
        formData.append(`qualityParameters[${index}][parameterValue]`, param.val);
      });

      const MAX_IMG_BYTES = 5 * 1024 * 1024;
      if (Array.isArray(commodityImages)) {
        for (const img of commodityImages) {
          if (!img?.uri) continue;
          if (img.fileSize && img.fileSize > MAX_IMG_BYTES) {
            showAlert({
              type: 'error',
              title: 'Image Too Large',
              message: `"${img.fileName || 'An image'}" exceeds the 5 MB limit.`,
            });
            setSubmitting(false);
            return;
          }
          formData.append('commodityImages', {
            uri: img.uri,
            type: img.type || 'image/jpeg',
            name: img.fileName || `image_${Date.now()}.jpg`,
          });
        }
      }

      if (Array.isArray(qualityReport)) {
        for (const doc of qualityReport) {
          if (!doc?.uri) continue;
          formData.append('qualityReport', {
            uri: doc.uri,
            type: doc.type || 'application/pdf',
            name: doc.name || `report_${Date.now()}.pdf`,
          });
        }
      }

      const rawUpdatedItem = editItem?.id ? {
        _id: editItem.id,
        commodityName: cName,
        type: type.trim(),
        quantity: cQty,
        unit,
        sellingPrice: cPrice,
        sellingPriceUnit,
        weightType,
        listingEndDate: finalExpiryDate,
        deliveryType,
        weightTolerance: finalTolerance,
        billingAddress: finalBilling,
        exWarehouseAddress: exWarehouseAddress.trim(),
        paymentTimeline: finalTimeline,
        remarks: remarks.trim(),
        isNegotiable,
        minimumAcceptablePrice: minimumAcceptablePrice ? Number(minimumAcceptablePrice) : null,
        maxNegotiationRounds: maxRounds,
        offerExpiryHours: expHours,
        commodityLocation: finalLocation,
        escrowEnabled,
        buyerTransportAllowed,
        qualityParameters: [
          { parameterName: 'Moisture', parameterValue: formatPct(moisture) },
          { parameterName: 'Foreign Material', parameterValue: formatPct(foreignMaterial) },
          { parameterName: 'Broken', parameterValue: formatPct(broken) },
        ].filter(p => p.parameterValue),
        seller: editItem.seller || {},
      } : null;

      if (editItem?.id) {
        await updateSellCommodity(editItem.id, formData);
      } else {
        await createSellCommodity(formData);
      }

      // Reset Form State
      setCommodityName('');
      setType('');
      setQuantity('');
      setSellingPrice('');
      setRemarks('');
      setMinimumAcceptablePrice('');
      setMaxNegotiationRounds('');
      setOfferExpiryHours('');
      setListingEndDate('');
      setCommodityLocation('');
      setBillingAddress('');
      setWeightTolerance('');
      setPaymentTimeline('');
      setExWarehouseAddress('');
      setMoisture('');
      setForeignMaterial('');
      setBroken('');
      setCommodityImages([]);
      setQualityReport([]);

      // Clear route param
      navigation.setParams({ editItem: null });

      showAlert({
        type: 'success',
        title: editItem ? '🎉 Listing Updated!' : '🎉 Listing Published!',
        message: editItem 
          ? 'Your sell offer details have been updated successfully.'
          : 'Your sell offer is now live on the marketplace. Buyers can view and bid on it.',
        buttons: [
          {
            text: 'View Marketplace',
            onPress: () => {
              if (rawUpdatedItem) {
                navigation.navigate('Market', { rawUpdatedItem });
              } else {
                navigation.navigate('Market');
              }
            },
          },
          { text: 'OK' },
        ],
      });
    } catch (error) {
      const backendErrors = error?.backendError?.errors;
      let errMsg;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        errMsg = backendErrors
          .map(e => `• ${e.field ? e.field + ': ' : ''}${e.message || 'Invalid value'}`)
          .join('\n');
      } else {
        errMsg =
          error?.backendError?.message ||
          error?.message ||
          'Failed to save listing. Please try again.';
      }
      showAlert({
        type: 'error',
        title: 'Submission Failed',
        message: errMsg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Unit → forced price unit mapping
  const UNIT_TO_PRICE_UNIT = { Ton: 'Ton', Quintal: 'Qt', Kg: 'Kg' };

  // Reusable Selector Chip Builder
  const renderChip = (currentVal, itemVal, setter, onChangeSideEffect) => {
    const isActive = currentVal === itemVal;
    return (
      <TouchableOpacity
        key={itemVal}
        onPress={() => {
          setter(itemVal);
          if (onChangeSideEffect) onChangeSideEffect(itemVal);
        }}
        style={[
          styles.pickerChip,
          isActive ? { backgroundColor: theme.primary, borderColor: theme.primary } : styles.inactivePickerChip
        ]}
        activeOpacity={0.8}
      >
        <Text style={[styles.pickerChipText, isActive ? styles.activePickerChipText : styles.inactivePickerChipText]}>
          {itemVal}
        </Text>
      </TouchableOpacity>
    );
  };

  // Price-unit chip — locked to whatever the quantity unit dictates
  const renderPriceUnitChip = (itemVal) => {
    const lockedVal = UNIT_TO_PRICE_UNIT[unit] || 'Ton';
    const isActive  = lockedVal === itemVal;
    const isLocked  = !isActive; // every other chip is disabled
    return (
      <View
        key={itemVal}
        style={[
          styles.pickerChip,
          isActive
            ? { backgroundColor: theme.primary, borderColor: theme.primary }
            : [styles.inactivePickerChip, { opacity: 0.35 }],
        ]}
      >
        <Text
          style={[
            styles.pickerChipText,
            isActive ? styles.activePickerChipText : styles.inactivePickerChipText,
          ]}
        >
          {itemVal}
        </Text>
        {isLocked && (
          <Icon name="lock-outline" size={10} color={COLORS.textMuted} style={{ marginLeft: w(3) }} />
        )}
      </View>
    );
  };

  // Delivery-specific chip renderer
  const renderDeliveryChip = (currentVal, itemVal, label, setter) => {
    const isActive = currentVal === itemVal;
    return (
      <TouchableOpacity
        key={itemVal}
        onPress={() => setter(itemVal)}
        style={[
          styles.pickerChip,
          isActive ? { backgroundColor: theme.primary, borderColor: theme.primary } : styles.inactivePickerChip
        ]}
        activeOpacity={0.8}
      >
        <Text style={[styles.pickerChipText, isActive ? styles.activePickerChipText : styles.inactivePickerChipText]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeScreen style={styles.container} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title={editItem ? "Edit Sell Offer" : "Post Sell Offer"}
        subtitle={editItem ? "Update crop stock details and republish" : "Publish crop stock details to find buyers"}
        showBackButton={Boolean(editItem)}
        onBackPress={() => {
          navigation.setParams({ editItem: null });
          navigation.goBack();
        }}
      />

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomTabBarHeight + h(20) }]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Intro Card */}
        <View style={[styles.introCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '1F' }]}>
          <View style={[styles.introIconContainer, { backgroundColor: theme.primary + '14' }]}>
            <Icon name="handshake-outline" size={24} color={theme.primary} />
          </View>
          <View style={styles.introTextContainer}>
            <Text style={[styles.introTitle, { color: theme.primary }]}>
              {editItem ? "Editing Listing Mode" : "Direct Market Access"}
            </Text>
            <Text style={styles.introDesc}>
              {editItem 
                ? "Modifying active transaction terms. Updates will reflect immediately on the marketplace."
                : "List your commodity to connect with verified buyers. Enable escrow safety for guaranteed payments."}
            </Text>
          </View>
        </View>
        
        {/* Section 1: Crop Specifications */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + '10' }]}>
              <Icon name="corn" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionHeading, { color: theme.primary }]}>Crop Specifications</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Commodity Name *</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'commodityName' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={commodityName}
              onChangeText={setCommodityName}
              placeholder="e.g. Wheat, Soybean"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('commodityName')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Variety / Type</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'type' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={type}
              onChangeText={setType}
              placeholder="e.g. Lokwan, Desi"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('type')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Available Qty *</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'quantity' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="e.g. 50"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('quantity')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Unit</Text>
            <View style={styles.pickerRow}>
              {['Ton', 'Quintal', 'Kg'].map((u) =>
                renderChip(unit, u, setUnit, (selectedUnit) => {
                  setSellingPriceUnit(UNIT_TO_PRICE_UNIT[selectedUnit] || 'Ton');
                })
              )}
            </View>
          </View>
        </View>

        {/* Section 2: Expected Price & Counter Bids */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + '10' }]}>
              <Icon name="currency-inr" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionHeading, { color: theme.primary }]}>Pricing & Counter Bids</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Expected Price *</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'sellingPrice' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={sellingPrice}
              onChangeText={setSellingPrice}
              placeholder="e.g. 2400"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('sellingPrice')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Per Unit</Text>
            <Text style={[styles.inputHint, { color: theme.primary }]}>
              Locked to quantity unit — change unit above to update
            </Text>
            <View style={styles.pickerRow}>
              {['Ton', 'Qt', 'Kg'].map((pu) => renderPriceUnitChip(pu))}
            </View>
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.switchContent}>
              <Text style={styles.switchLabel}>Allow Bidding / Counter Offers</Text>
              <Text style={styles.switchDesc}>Permit buyers to negotiate transaction pricing</Text>
            </View>
            <Switch
              value={isNegotiable}
              onValueChange={setIsNegotiable}
              trackColor={{ false: '#E2E8F0', true: theme.primary + '80' }}
              thumbColor={isNegotiable ? theme.primary : '#F1F5F9'}
            />
          </View>

          {isNegotiable && (
            <View style={[styles.subConfigCard, { borderColor: theme.primary + '20', marginBottom: h(16) }]}>
              <Text style={[styles.subConfigTitle, { color: theme.primary }]}>Bidding Parameters</Text>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Min Price (₹)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    focusedField === 'minimumAcceptablePrice' && { borderColor: theme.primary, backgroundColor: COLORS.white }
                  ]}
                  value={minimumAcceptablePrice}
                  onChangeText={setMinimumAcceptablePrice}
                  placeholder="e.g. 2300"
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textMuted}
                  onFocus={() => setFocusedField('minimumAcceptablePrice')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Max Negotiation Rounds</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    focusedField === 'maxNegotiationRounds' && { borderColor: theme.primary, backgroundColor: COLORS.white }
                  ]}
                  value={maxNegotiationRounds}
                  onChangeText={setMaxNegotiationRounds}
                  placeholder="e.g. 5"
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textMuted}
                  onFocus={() => setFocusedField('maxNegotiationRounds')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Offer Expiry (Hours)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    focusedField === 'offerExpiryHours' && { borderColor: theme.primary, backgroundColor: COLORS.white }
                  ]}
                  value={offerExpiryHours}
                  onChangeText={setOfferExpiryHours}
                  placeholder="e.g. 24"
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textMuted}
                  onFocus={() => setFocusedField('offerExpiryHours')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>
          )}
        </View>

        {/* Section 3: Delivery & Logistics */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + '10' }]}>
              <Icon name="truck-delivery-outline" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionHeading, { color: theme.primary }]}>Logistics & Fulfillment</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Delivery Clause</Text>
            <View style={styles.pickerRow}>
              {renderDeliveryChip(deliveryType, 'FOR', 'Delivered (FOR)', setDeliveryType)}
              {renderDeliveryChip(deliveryType, 'EX_WAREHOUSE', 'Ex-Warehouse', setDeliveryType)}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Weight Basis</Text>
            <View style={styles.pickerRow}>
              {['Net Weight', 'Gross Weight'].map((wType) => renderChip(weightType, wType, setWeightType))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Stock Location</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'commodityLocation' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={commodityLocation}
              onChangeText={setCommodityLocation}
              placeholder="e.g. Indore, MP"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('commodityLocation')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Listing Expiry Date</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'listingEndDate' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={listingEndDate}
              onChangeText={setListingEndDate}
              placeholder="e.g. YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('listingEndDate')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Billing Address</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'billingAddress' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={billingAddress}
              onChangeText={setBillingAddress}
              placeholder="e.g. Indore Mandi Complex, MP"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('billingAddress')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {deliveryType === 'EX_WAREHOUSE' && (
            <View style={[styles.subConfigCard, { borderColor: theme.primary + '20', marginBottom: h(16), marginTop: h(4) }]}>
              <Text style={styles.inputLabel}>Pickup Warehouse Address *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  focusedField === 'exWarehouseAddress' && { borderColor: theme.primary, backgroundColor: COLORS.white }
                ]}
                value={exWarehouseAddress}
                onChangeText={setExWarehouseAddress}
                placeholder="Exact warehouse or Mandi yard storage code"
                placeholderTextColor={COLORS.textMuted}
                onFocus={() => setFocusedField('exWarehouseAddress')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          )}

          <View style={styles.switchContainer}>
            <View style={styles.switchContent}>
              <Text style={styles.switchLabel}>🔐 Secured Escrow Deal</Text>
              <Text style={styles.switchDesc}>Secure funds in neutral escrow account before dispatch</Text>
            </View>
            <Switch
              value={escrowEnabled}
              onValueChange={setEscrowEnabled}
              trackColor={{ false: '#E2E8F0', true: theme.primary + '80' }}
              thumbColor={escrowEnabled ? theme.primary : '#F1F5F9'}
            />
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.switchContent}>
              <Text style={styles.switchLabel}>Allow Buyer Logistics Option</Text>
              <Text style={styles.switchDesc}>Buyer may supply transport to pick up goods</Text>
            </View>
            <Switch
              value={buyerTransportAllowed}
              onValueChange={setBuyerTransportAllowed}
              trackColor={{ false: '#E2E8F0', true: theme.primary + '80' }}
              thumbColor={buyerTransportAllowed ? theme.primary : '#F1F5F9'}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Weight Tolerance (%)</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'weightTolerance' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={weightTolerance}
              onChangeText={setWeightTolerance}
              placeholder="e.g. 1"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('weightTolerance')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Payment Release Clause</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'paymentTimeline' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={paymentTimeline}
              onChangeText={setPaymentTimeline}
              placeholder="e.g. Within 3 days of delivery"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('paymentTimeline')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>

        {/* Section 4: Quality Parameters & Media */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + '10' }]}>
              <Icon name="clipboard-check-outline" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionHeading, { color: theme.primary }]}>Quality & Lab Assays</Text>
          </View>

          <Text style={styles.subCardLabel}>Crop Quality Metrics</Text>

          {/* Static parameters form fields */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Moisture Parameter (%)</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'moisture' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={moisture}
              onChangeText={setMoisture}
              placeholder="e.g. 12"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('moisture')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Foreign Material (%)</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'foreignMaterial' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={foreignMaterial}
              onChangeText={setForeignMaterial}
              placeholder="e.g. 1"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('foreignMaterial')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Broken / Damaged (%)</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'broken' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={broken}
              onChangeText={setBroken}
              placeholder="e.g. 2"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('broken')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Upload Cards */}
          <View style={styles.mediaRow}>
            <TouchableOpacity
              onPress={handleAddImages}
              style={[
                styles.uploadCard,
                { borderColor: theme.primary },
                commodityImages.length > 0 && { backgroundColor: theme.primary + '08' }
              ]}
              activeOpacity={0.7}
            >
              <Icon name="camera-plus-outline" size={24} color={theme.primary} />
              <Text style={[styles.uploadCardText, { color: theme.primary }]}>Crop Images</Text>
              <Text style={styles.uploadCardHint}>Max 5MB (PNG/JPG)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAddReport}
              style={[
                styles.uploadCard,
                { borderColor: theme.primary },
                qualityReport.length > 0 && { backgroundColor: theme.primary + '08' }
              ]}
              activeOpacity={0.7}
            >
              <Icon name="file-pdf-box" size={24} color={theme.primary} />
              <Text style={[styles.uploadCardText, { color: theme.primary }]}>Quality Reports</Text>
              <Text style={styles.uploadCardHint}>Add PDF lab reports</Text>
            </TouchableOpacity>
          </View>

          {/* Image Thumbnails Previews */}
          {commodityImages.length > 0 && (
            <View style={styles.thumbnailContainer}>
              <Text style={styles.previewHeading}>Selected Images ({commodityImages.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailList}>
                {commodityImages.map((img, index) => (
                  <View key={index} style={styles.thumbnailWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.thumbnail} />
                    <TouchableOpacity
                      style={styles.thumbnailClose}
                      onPress={() => setCommodityImages(commodityImages.filter((_, i) => i !== index))}
                    >
                      <Icon name="close" size={11} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* PDF Files Previews */}
          {qualityReport.length > 0 && (
            <View style={styles.reportContainer}>
              <Text style={styles.previewHeading}>Selected Reports ({qualityReport.length})</Text>
              {qualityReport.map((doc, index) => (
                <View key={index} style={styles.reportCard}>
                  <Icon name="file-pdf-box" size={22} color="#E53E3E" />
                  <Text style={styles.reportName} numberOfLines={1} ellipsizeMode="middle">
                    {doc.name || 'lab_report.pdf'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setQualityReport(qualityReport.filter((_, i) => i !== index))}
                    style={styles.reportDelete}
                  >
                    <Icon name="trash-can-outline" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.inputLabel}>Additional Remarks or Special Terms</Text>
          <TextInput
            style={[
              styles.textInput,
              styles.textArea,
              focusedField === 'remarks' && { borderColor: theme.primary, backgroundColor: COLORS.white }
            ]}
            multiline
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Moisture standards, packing material quality, loading timeline constraints..."
            placeholderTextColor={COLORS.textMuted}
            onFocus={() => setFocusedField('remarks')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        {/* Submit Action */}
        <TouchableOpacity
          onPress={handlePostListing}
          style={[styles.submitBtn, { backgroundColor: theme.primary }]}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <View style={styles.submitBtnRow}>
              <Icon name="cloud-upload-outline" size={20} color={COLORS.white} />
              <Text style={styles.submitBtnText}>
                {editItem ? "Update Sell Listing" : "Publish Sell Listing"}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Cancel Edit Button */}
        {editItem && (
          <TouchableOpacity
            onPress={() => {
              navigation.setParams({ editItem: null });
              navigation.goBack();
            }}
            style={[styles.cancelEditBtn, { borderColor: theme.primary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelEditBtnText, { color: theme.primary }]}>Cancel Edit</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: w(16),
    paddingTop: h(16),
    gap: h(16),
  },
  introCard: {
    flexDirection: 'row',
    borderRadius: mw(14),
    borderWidth: 1.5,
    padding: w(14),
    alignItems: 'center',
    gap: w(12),
  },
  introIconContainer: {
    width: mw(42),
    height: mw(42),
    borderRadius: mw(21),
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTextContainer: {
    flex: 1,
  },
  introTitle: {
    fontSize: f(14),
    fontWeight: '700',
    marginBottom: h(2),
  },
  introDesc: {
    fontSize: f(11),
    color: COLORS.textLight,
    lineHeight: h(16),
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: mw(14),
    padding: w(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(10),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: h(12),
    marginBottom: h(16),
  },
  sectionIconContainer: {
    width: mw(32),
    height: mw(32),
    borderRadius: mw(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: f(14),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: h(14),
    gap: w(12),
  },
  halfCol: {
    flex: 1,
  },
  thirdCol: {
    flex: 1,
  },
  formGroup: {
    marginBottom: h(16),
  },
  inputLabel: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: h(4),
    letterSpacing: 0.3,
  },
  inputHint: {
    fontSize: f(10),
    fontWeight: '600',
    marginBottom: h(6),
    opacity: 0.75,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: mw(10),
    paddingHorizontal: w(12),
    height: h(44),
    fontSize: f(13),
    color: COLORS.text,
    backgroundColor: '#F8FAFC',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: w(6),
    height: h(44),
    alignItems: 'center',
  },
  pickerChip: {
    flex: 1,
    height: h(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: mw(10),
    paddingHorizontal: w(8),
    gap: w(6),
  },
  inactivePickerChip: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  pickerChipText: {
    fontSize: f(12),
    fontWeight: '700',
  },
  activePickerChipText: {
    color: COLORS.white,
  },
  inactivePickerChipText: {
    color: COLORS.textLight,
  },
  chipCheck: {
    marginRight: w(2),
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: mw(10),
    paddingHorizontal: w(14),
    paddingVertical: h(12),
    marginBottom: h(16),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  switchContent: {
    flex: 1,
    marginRight: w(8),
  },
  switchLabel: {
    fontSize: f(12.5),
    fontWeight: '700',
    color: COLORS.text,
  },
  switchDesc: {
    fontSize: f(10.5),
    color: COLORS.textMuted,
    marginTop: h(3),
    lineHeight: h(14),
  },
  subConfigCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: mw(10),
    padding: w(12),
    marginVertical: h(10),
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: h(10),
  },
  subConfigTitle: {
    fontSize: f(11),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: h(4),
  },
  subCardLabel: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: h(10),
  },
  mediaRow: {
    flexDirection: 'row',
    gap: w(12),
    marginBottom: h(14),
  },
  uploadCard: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: mw(12),
    paddingVertical: h(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  uploadCardText: {
    fontSize: f(12),
    fontWeight: '700',
    marginTop: h(6),
    marginBottom: h(2),
  },
  uploadCardHint: {
    fontSize: f(9),
    color: COLORS.textMuted,
  },
  previewHeading: {
    fontSize: f(11),
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: h(8),
  },
  thumbnailContainer: {
    marginBottom: h(14),
  },
  thumbnailList: {
    gap: w(10),
    paddingVertical: h(4),
  },
  thumbnailWrapper: {
    position: 'relative',
    width: mw(64),
    height: mw(64),
    borderRadius: mw(8),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailClose: {
    position: 'absolute',
    top: mw(2),
    right: mw(2),
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: mw(16),
    height: mw(16),
    borderRadius: mw(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportContainer: {
    marginBottom: h(14),
    gap: h(6),
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: mw(8),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: w(10),
    paddingVertical: h(8),
    gap: w(8),
  },
  reportName: {
    flex: 1,
    fontSize: f(12),
    color: COLORS.text,
    fontWeight: '500',
  },
  reportDelete: {
    padding: w(4),
  },
  textArea: {
    height: h(80),
    textAlignVertical: 'top',
    paddingTop: h(10),
    marginTop: h(6),
  },
  submitBtn: {
    height: h(50),
    borderRadius: mw(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: h(10),
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: f(14),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cancelEditBtn: {
    height: h(46),
    borderRadius: mw(12),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: h(6),
    backgroundColor: COLORS.white,
  },
  cancelEditBtnText: {
    fontSize: f(14),
    fontWeight: '700',
  },
});
