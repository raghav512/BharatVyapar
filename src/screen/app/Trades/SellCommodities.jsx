import React from 'react';
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
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import DatePicker from 'react-native-date-picker';
import { selectUser, selectSelectedRole } from '../../../store/authSelectors';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, mw, f } from '../../../utils/responsive';
import { showAlert } from '../../../components/CustomAlertBox';
import KycBanner from '../../../components/KycBanner';
import { useSellCommoditiesForm, IMAGE_MAX_SIZE_MB, UNIT_TO_PRICE_UNIT } from './hooks/useSellCommoditiesForm';
import { useTranslation } from '../../../hook/useTranslation';

const ROLE_THEMES = {
  FPO: { primary: COLORS.fpoPrimary, secondary: COLORS.fpoSecondary, light: COLORS.fpoLight, text: COLORS.fpoText },
  Trader: { primary: COLORS.traderPrimary, secondary: COLORS.traderSecondary, light: COLORS.traderLight, text: COLORS.traderText },
  Miller: { primary: COLORS.millerPrimary, secondary: COLORS.millerSecondary, light: COLORS.millerLight, text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};



const SelectorChip = ({ itemVal, isActive, theme, onPress }) => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pickerChip,
        isActive ? { backgroundColor: theme.primary, borderColor: theme.primary } : styles.inactivePickerChip
      ]}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={t('Select unit {unit}').replace('{unit}', itemVal)}
      accessibilityState={{ selected: isActive }}
    >
      <Text style={[styles.pickerChipText, isActive ? styles.activePickerChipText : styles.inactivePickerChipText]}>
        {itemVal}
      </Text>
    </TouchableOpacity>
  );
};

const PriceUnitChip = ({ itemVal, isActive, theme }) => {
  const { t } = useTranslation();
  const isLocked = !isActive;
  return (
    <View
      style={[
        styles.pickerChip,
        isActive
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : [styles.inactivePickerChip, { opacity: 0.35 }],
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={t('{value} price unit{locked}').replace('{value}', itemVal).replace('{locked}', isLocked ? t(', locked') : '')}
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

export default function SellCommodities({ route, navigation }) {
  const { t } = useTranslation();
  // PERFORMANCE FIX: Two granular selectors — SellCommodities only re-renders
  // when user or selectedRole change, not on profileLoading or other auth fields.
  // This is critical since this is a large form screen with many child inputs.
  const user      = useSelector(selectUser);
  const stateRole = useSelector(selectSelectedRole);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  
  // Dynamically calculate bottom padding for the tab bar to avoid overlap
  const bottomTabBarHeight = useBottomTabBarHeight();

  const { state, setters, handlers, editItem, dispatch } = useSellCommoditiesForm({ route, navigation });

  const {
    focusedField,
    commodityName,
    type,
    quantity,
    unit,
    sellingPrice,
    sellingPriceUnit,
    weightType,
    listingEndDate,
    deliveryType,
    exWarehouseAddress,
    weightTolerance,
    billingAddress,
    paymentTimeline,
    remarks,
    isNegotiable,
    minimumAcceptablePrice,
    maxNegotiationRounds,
    offerExpiryHours,
    commodityLocation,
    isDatePickerOpen,
    moisture,
    foreignMaterial,
    broken,
    customQualityParams,
    isModalVisible,
    modalParamName,
    modalParamValue,
    commodityImages,
    qualityReport,
    submitting,
  } = state;

  const {
    setFocusedField,
    setCommodityName,
    setType,
    setQuantity,
    setSellingPrice,
    setListingEndDate,
    setDeliveryType,
    setExWarehouseAddress,
    setWeightTolerance,
    setBillingAddress,
    setPaymentTimeline,
    setRemarks,
    setIsNegotiable,
    setMinimumAcceptablePrice,
    setMaxNegotiationRounds,
    setOfferExpiryHours,
    setCommodityLocation,
    setIsDatePickerOpen,
    setMoisture,
    setForeignMaterial,
    setBroken,
    setCustomQualityParams,
    setIsModalVisible,
    setModalParamName,
    setModalParamValue,
    setCommodityImages,
    setQualityReport,
    setDeletedImages,
    setDeletedReports,
  } = setters;

  const {
    handleAddImages,
    handleAddReport,
    handlePostListing,
    handleUnitChange,
    handleWeightTypeChange,
  } = handlers;

  return (
    <SafeScreen style={styles.container} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title={editItem ? t('Edit Sell Offer') : t('Post Sell Offer')}
        subtitle={editItem ? t('Update crop stock details and republish') : t('Publish crop stock details to find buyers')}
        showBackButton={false}
      />

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomTabBarHeight + h(20) }]} 
        showsVerticalScrollIndicator={false}
      >
        <KycBanner actionType="sell" />

        {/* Intro Card */}
        <View style={[styles.introCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '1F' }]}>
          <View style={[styles.introIconContainer, { backgroundColor: theme.primary + '14' }]}>
            <Icon name="handshake-outline" size={24} color={theme.primary} />
          </View>
          <View style={styles.introTextContainer}>
            <Text style={[styles.introTitle, { color: theme.primary }]}>
              {editItem ? t("Editing Listing Mode") : t("Direct Market Access")}
            </Text>
            <Text style={styles.introDesc}>
              {editItem 
                ? t("Modifying active transaction terms. Updates will reflect immediately on the marketplace.")
                : t("List your commodity to connect with verified buyers. Enable escrow safety for guaranteed payments.")}
            </Text>
          </View>
        </View>
        
        {/* Section 1: Crop Specifications */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + '10' }]}>
              <Icon name="corn" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionHeading, { color: theme.primary }]}>{t('Crop Specifications')}</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Commodity Name *')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'commodityName' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={commodityName}
              onChangeText={setCommodityName}
              placeholder={t('e.g. Wheat, Soybean')}
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('commodityName')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Commodity Name')}
              accessibilityHint={t('Enter the name of the crop, required')}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Variety / Type')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'type' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={type}
              onChangeText={setType}
              placeholder={t('e.g. Lokwan, Desi')}
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('type')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Variety or Type')}
              accessibilityHint={t('Enter the specific crop variety or type')}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Available Qty *')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'quantity' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t('e.g. 50')}
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('quantity')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Available Quantity')}
              accessibilityHint={t('Enter the numeric quantity of crop available, required')}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Unit')}</Text>
            <View style={styles.pickerRow}>
              {['Ton', 'Quintal', 'Kg'].map((u) => (
                <SelectorChip
                  key={u}
                  itemVal={u}
                  isActive={unit === u}
                  theme={theme}
                  onPress={() => handleUnitChange(u)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Section 2: Expected Price & Counter Bids */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + '10' }]}>
              <Icon name="currency-inr" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionHeading, { color: theme.primary }]}>{t('Pricing & Counter Bids')}</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Expected Price *')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'sellingPrice' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={sellingPrice}
              onChangeText={setSellingPrice}
              placeholder={t('e.g. 2400')}
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('sellingPrice')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Expected Price')}
              accessibilityHint={t('Enter the expected selling price in rupees, required')}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Per Unit')}</Text>
            <Text style={[styles.inputHint, { color: theme.primary }]}>
              {t('Locked to quantity unit — change unit above to update')}
            </Text>
            <View style={styles.pickerRow}>
              {['Ton', 'Qt', 'Kg'].map((pu) => (
                <PriceUnitChip
                  key={pu}
                  itemVal={pu}
                  isActive={(UNIT_TO_PRICE_UNIT[unit] || 'Ton') === pu}
                  theme={theme}
                />
              ))}
            </View>
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.switchContent}>
              <Text style={styles.switchLabel}>{t('Allow Bidding / Counter Offers')}</Text>
              <Text style={styles.switchDesc}>{t('Permit buyers to negotiate transaction pricing')}</Text>
            </View>
            <Switch
              value={isNegotiable}
              onValueChange={setIsNegotiable}
              trackColor={{ false: '#E2E8F0', true: theme.primary + '80' }}
              thumbColor={isNegotiable ? theme.primary : '#F1F5F9'}
              accessible={true}
              accessibilityLabel={t('Allow Bidding and Counter Offers')}
              accessibilityHint={t('Double tap to toggle whether buyers can negotiate pricing')}
              accessibilityState={{ checked: isNegotiable }}
            />
          </View>

          {isNegotiable && (
            <View style={[styles.subConfigCard, { borderColor: theme.primary + '20', marginBottom: h(16) }]}>
              <Text style={[styles.subConfigTitle, { color: theme.primary }]}>{t('Bidding Parameters')}</Text>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>{t('Min Price (₹)')}</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    focusedField === 'minimumAcceptablePrice' && { borderColor: theme.primary, backgroundColor: COLORS.white }
                  ]}
                  value={minimumAcceptablePrice}
                  onChangeText={setMinimumAcceptablePrice}
                  placeholder={t('e.g. 2300')}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textMuted}
                  onFocus={() => setFocusedField('minimumAcceptablePrice')}
                  onBlur={() => setFocusedField(null)}
                  accessible={true}
                  accessibilityLabel={t('Minimum Price')}
                  accessibilityHint={t('Enter the minimum acceptable negotiation price in rupees')}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>{t('Max Negotiation Rounds')}</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    focusedField === 'maxNegotiationRounds' && { borderColor: theme.primary, backgroundColor: COLORS.white }
                  ]}
                  value={maxNegotiationRounds}
                  onChangeText={setMaxNegotiationRounds}
                  placeholder={t('e.g. 5')}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textMuted}
                  onFocus={() => setFocusedField('maxNegotiationRounds')}
                  onBlur={() => setFocusedField(null)}
                  accessible={true}
                  accessibilityLabel={t('Maximum Negotiation Rounds')}
                  accessibilityHint={t('Enter the maximum rounds of counter bidding, between 1 and 20')}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>{t('Offer Expiry (Hours)')}</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    focusedField === 'offerExpiryHours' && { borderColor: theme.primary, backgroundColor: COLORS.white }
                  ]}
                  value={offerExpiryHours}
                  onChangeText={setOfferExpiryHours}
                  placeholder={t('e.g. 24')}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textMuted}
                  onFocus={() => setFocusedField('offerExpiryHours')}
                  onBlur={() => setFocusedField(null)}
                  accessible={true}
                  accessibilityLabel={t('Offer Expiry Hours')}
                  accessibilityHint={t('Enter the number of hours before counter bids expire, between 1 and 720')}
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
            <Text style={[styles.sectionHeading, { color: theme.primary }]}>{t('Logistics & Fulfillment')}</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Weight Basis')}</Text>
            <View style={styles.pickerRow}>
              {['Net Weight', 'Gross Weight'].map((wType) => (
                <SelectorChip
                  key={wType}
                  itemVal={wType}
                  isActive={weightType === wType}
                  theme={theme}
                  onPress={() => handleWeightTypeChange(wType)}
                />
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Delivery Clause')}</Text>
            <View style={styles.pickerRow}>
              {['FOR', 'Ex-Warehouse'].map((dType) => (
                <SelectorChip
                  key={dType}
                  itemVal={dType}
                  isActive={
                    dType === 'FOR'
                      ? deliveryType === 'FOR'
                      : deliveryType === 'EX_WAREHOUSE'
                  }
                  theme={theme}
                  onPress={() => setDeliveryType(dType === 'FOR' ? 'FOR' : 'EX_WAREHOUSE')}
                />
              ))}
            </View>
          </View>

          {deliveryType === 'EX_WAREHOUSE' && (
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>{t('Pickup Warehouse Address *')}</Text>
              <TextInput
                style={[
                  styles.textInput,
                  focusedField === 'exWarehouseAddress' && { borderColor: theme.primary, backgroundColor: COLORS.white }
                ]}
                value={exWarehouseAddress}
                onChangeText={setExWarehouseAddress}
                placeholder={t('Enter warehouse storage address')}
                placeholderTextColor={COLORS.textMuted}
                onFocus={() => setFocusedField('exWarehouseAddress')}
                onBlur={() => setFocusedField(null)}
                accessible={true}
                accessibilityLabel={t('Pickup Warehouse Address')}
                accessibilityHint={t('Enter the warehouse address, required for Ex-Warehouse delivery')}
              />
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Stock Location *')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'commodityLocation' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={commodityLocation}
              onChangeText={setCommodityLocation}
              placeholder={t('e.g. Indore, MP')}
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('commodityLocation')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Stock Location')}
              accessibilityHint={t('Enter the city or district where crop stock is currently stored, required')}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Listing Expiry Date *')}</Text>
            {process.env.NODE_ENV === 'test' ? (
              <TextInput
                style={styles.textInput}
                value={listingEndDate}
                onChangeText={setListingEndDate}
                placeholder={t('e.g. YYYY-MM-DD')}
                placeholderTextColor={COLORS.textMuted}
                accessible={true}
                accessibilityLabel={t('Listing Expiry Date')}
              />
            ) : (
              <TouchableOpacity
                style={[
                  styles.textInput,
                  styles.datePickerInput,
                  focusedField === 'listingEndDate' && { borderColor: theme.primary, backgroundColor: COLORS.white }
                ]}
                onPress={() => {
                  setFocusedField('listingEndDate');
                  setIsDatePickerOpen(true);
                }}
                activeOpacity={0.8}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('Listing Expiry Date')}
                accessibilityHint={t('Currently set to {date}. Tap to select a future date.').replace('{date}', listingEndDate || t('not set'))}
              >
                <Text style={[styles.dateText, !listingEndDate && styles.placeholderText]}>
                  {listingEndDate || t('Select Expiry Date')}
                </Text>
                <Icon name="calendar-month-outline" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Billing Address')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'billingAddress' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={billingAddress}
              onChangeText={setBillingAddress}
              placeholder={t('e.g. Indore Mandi Complex, MP')}
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('billingAddress')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Billing Address')}
              accessibilityHint={t('Enter the billing address for the offer')}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Weight Tolerance (%)')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'weightTolerance' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={weightTolerance}
              onChangeText={setWeightTolerance}
              placeholder={t('e.g. 1')}
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('weightTolerance')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Weight Tolerance percentage')}
              accessibilityHint={t('Enter the weight tolerance percentage')}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Payment Release Clause')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'paymentTimeline' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={paymentTimeline}
              onChangeText={setPaymentTimeline}
              placeholder={t('e.g. Within 3 days of delivery')}
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('paymentTimeline')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Payment Release Clause')}
              accessibilityHint={t('Enter the timelines or terms for payment release')}
            />
          </View>
        </View>

        {/* Section 4: Quality Parameters & Media */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + '10' }]}>
              <Icon name="clipboard-check-outline" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionHeading, { color: theme.primary }]}>{t('Quality & Lab Assays')}</Text>
          </View>

          <Text style={styles.subCardLabel}>{t('Crop Quality Metrics')}</Text>

          {/* Static parameters form fields */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Moisture Parameter (%)')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'moisture' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={moisture}
              onChangeText={setMoisture}
              placeholder={t('e.g. 12')}
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('moisture')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Moisture percentage')}
              accessibilityHint={t('Enter the crop moisture percentage, value must be between 0 and 100')}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Foreign Material (%)')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'foreignMaterial' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={foreignMaterial}
              onChangeText={setForeignMaterial}
              placeholder={t('e.g. 1')}
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('foreignMaterial')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Foreign Material percentage')}
              accessibilityHint={t('Enter the percentage of foreign material, value must be between 0 and 100')}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('Broken / Damaged (%)')}</Text>
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'broken' && { borderColor: theme.primary, backgroundColor: COLORS.white }
              ]}
              value={broken}
              onChangeText={setBroken}
              placeholder={t('e.g. 2')}
              keyboardType="numeric"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedField('broken')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel={t('Broken percentage')}
              accessibilityHint={t('Enter the percentage of broken or damaged grains, value must be between 0 and 100')}
            />
          </View>

          {/* Custom Dynamic parameters list */}
          {customQualityParams.length > 0 && (
            <View style={styles.customParamsContainer}>
              {customQualityParams.map((param, index) => (
                <View key={index} style={[styles.customParamRow, { borderColor: theme.primary + '30' }]}>
                  <View style={styles.customParamInfo}>
                    <Text style={styles.customParamName}>{t(param.name)}</Text>
                    <Text style={[styles.customParamValue, { color: theme.primary }]}>{param.value}%</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setCustomQualityParams(prev => prev.filter((_, i) => i !== index));
                    }}
                    style={styles.customParamDeleteBtn}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('Delete custom parameter {param}').replace('{param}', t(param.name))}
                  >
                    <Icon name="close-circle-outline" size={20} color={COLORS.error || '#EF4444'} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add More Button */}
          <TouchableOpacity
            style={[styles.addMoreBtn, { borderColor: theme.primary }]}
            onPress={() => {
              dispatch({
                type: 'SET_FIELDS',
                fields: {
                  modalParamName: '',
                  modalParamValue: '',
                  isModalVisible: true
                }
              });
            }}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('Add custom quality parameters')}
            accessibilityHint={t('Double tap to open custom parameters dialog')}
          >
            <Icon name="plus" size={18} color={theme.primary} />
            <Text style={[styles.addMoreBtnText, { color: theme.primary }]}>{t('Add More Parameters')}</Text>
          </TouchableOpacity>

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
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('Crop Images. {count} of 3 added.').replace('{count}', commodityImages.length)}
              accessibilityHint={t('Double tap to choose images from gallery')}
            >
              <Icon name="camera-plus-outline" size={24} color={theme.primary} />
              <Text style={[styles.uploadCardText, { color: theme.primary }]}>
                {t('Crop Images')} {commodityImages.length > 0 ? `(${commodityImages.length}/3)` : ''}
              </Text>
              <Text style={styles.uploadCardHint}>{t('Max {size}MB (PNG/JPG)').replace('{size}', IMAGE_MAX_SIZE_MB)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAddReport}
              style={[
                styles.uploadCard,
                { borderColor: theme.primary },
                qualityReport.length > 0 && { backgroundColor: theme.primary + '08' }
              ]}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('Quality Reports. {count} reports added.').replace('{count}', qualityReport.length)}
              accessibilityHint={t('Double tap to pick PDF documents')}
            >
              <Icon name="file-pdf-box" size={24} color={theme.primary} />
              <Text style={[styles.uploadCardText, { color: theme.primary }]}>{t('Quality Reports')}</Text>
              <Text style={styles.uploadCardHint}>{t('Add PDF lab reports')}</Text>
            </TouchableOpacity>
          </View>

          {/* Image Thumbnails Previews */}
          {commodityImages.length > 0 && (
            <View style={styles.thumbnailContainer}>
              <Text style={styles.previewHeading}>{t('Selected Images ({count})').replace('{count}', commodityImages.length)}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailList}>
                {commodityImages.map((img, index) => (
                  <View key={index} style={styles.thumbnailWrapper}>
                    <Image source={{ uri: img.uri || img.url }} style={styles.thumbnail} />
                     <TouchableOpacity
                       style={styles.thumbnailClose}
                       onPress={() => {
                         const target = img;
                         if (target.url || target.key) {
                           setDeletedImages(prev => [...prev, target.key || target.url]);
                         }
                         setCommodityImages(commodityImages.filter((_, i) => i !== index));
                       }}
                       accessible={true}
                       accessibilityRole="button"
                       accessibilityLabel={t('Remove selected image {index}').replace('{index}', index + 1)}
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
              <Text style={styles.previewHeading}>{t('Selected Reports ({count})').replace('{count}', qualityReport.length)}</Text>
              {qualityReport.map((doc, index) => (
                <View key={index} style={styles.reportCard}>
                  <Icon name="file-pdf-box" size={22} color="#E53E3E" />
                  <Text style={styles.reportName} numberOfLines={1} ellipsizeMode="middle">
                    {doc.name || doc.key?.split('/').pop() || doc.url?.split('/').pop() || 'lab_report.pdf'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const target = doc;
                      if (target.url || target.key) {
                        setDeletedReports(prev => [...prev, target.key || target.url]);
                      }
                      setQualityReport(qualityReport.filter((_, i) => i !== index));
                    }}
                    style={styles.reportDelete}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('Remove report {name}').replace('{name}', doc.name || t('document'))}
                  >
                    <Icon name="trash-can-outline" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.inputLabel}>{t('Additional Remarks or Special Terms')}</Text>
          <TextInput
            style={[
              styles.textInput,
              styles.textArea,
              focusedField === 'remarks' && { borderColor: theme.primary, backgroundColor: COLORS.white }
            ]}
            multiline
            value={remarks}
            onChangeText={setRemarks}
            placeholder={t('Moisture standards, packing material quality, loading timeline constraints...')}
            placeholderTextColor={COLORS.textMuted}
            onFocus={() => setFocusedField('remarks')}
            onBlur={() => setFocusedField(null)}
            accessible={true}
            accessibilityLabel={t('Additional Remarks or Special Terms')}
            accessibilityHint={t('Enter any additional remarks or details for the listing')}
          />
        </View>

        {/* Submit Action */}
        <TouchableOpacity
          onPress={handlePostListing}
          style={[styles.submitBtn, { backgroundColor: theme.primary }]}
          disabled={submitting}
          activeOpacity={0.85}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={submitting ? t('Submitting Offer') : (editItem ? t('Update Sell Offer') : t('Publish Sell Offer'))}
          accessibilityHint={editItem ? t('Double tap to submit your listing updates') : t('Double tap to publish your listing to the marketplace')}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <View style={styles.submitBtnRow}>
              <Icon name="cloud-upload-outline" size={20} color={COLORS.white} />
              <Text style={styles.submitBtnText}>
                {editItem ? t('Update Sell Listing') : t('Publish Sell Listing')}
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
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('Cancel editing offer')}
            accessibilityHint={t('Double tap to revert updates and go back')}
          >
            <Text style={[styles.cancelEditBtnText, { color: theme.primary }]}>{t('Cancel Edit')}</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
      <DatePicker
        modal
        open={isDatePickerOpen}
        date={(() => {
          if (!listingEndDate) return new Date();
          const parsed = new Date(listingEndDate);
          if (isNaN(parsed.getTime())) return new Date();
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return parsed < today ? new Date() : parsed;
        })()}
        minimumDate={new Date()}
        mode="date"
        theme="light"
        onConfirm={(date) => {
          setIsDatePickerOpen(false);
          setFocusedField(null);
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          setListingEndDate(`${yyyy}-${mm}-${dd}`);
        }}
        onCancel={() => {
          setIsDatePickerOpen(false);
          setFocusedField(null);
        }}
      />

      {/* Custom Modal for Adding Quality Parameters */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: theme.primary }]}>{t('Add Quality Parameters')}</Text>

            {/* Currently Added Parameters list inside the Modal */}
            {customQualityParams.length > 0 && (
              <View style={styles.modalParamsList}>
                <Text style={styles.modalLabel}>{t('Added Parameters ({count})').replace('{count}', String(customQualityParams.length))}</Text>
                <ScrollView 
                  style={{ maxHeight: h(100) }} 
                  contentContainerStyle={styles.modalParamsChips}
                  nestedScrollEnabled={true}
                >
                  {customQualityParams.map((param, index) => (
                    <View key={index} style={[styles.modalAddedParamChip, { borderColor: theme.primary + '30', backgroundColor: theme.primary + '08' }]}>
                      <Text style={styles.modalAddedParamText}>
                        {t(param.name)}: <Text style={[styles.modalAddedParamVal, { color: theme.primary }]}>{param.value}%</Text>
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setCustomQualityParams(prev => prev.filter((_, i) => i !== index));
                        }}
                        style={styles.modalAddedParamDelete}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={t('Delete custom parameter {name}').replace('{name}', t(param.name))}
                      >
                        <Icon name="close" size={13} color={COLORS.error || '#EF4444'} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.modalLabel}>{t('Select Pre-defined Parameter')}</Text>
            <View style={styles.modalChipsRow}>
              {[
                'Insect damage / infestation',
                'Admixture / other crop',
                'Shrivelled / immature grains',
                'Broken grains / kernels',
                'Discolouration'
              ].map((opt) => {
                const isSelected = modalParamName === opt;
                const optText = t(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setModalParamName(opt)}
                    style={[
                      styles.modalChip,
                      isSelected
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : styles.modalChipInactive,
                    ]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={optText}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        isSelected ? { color: COLORS.white } : { color: COLORS.textLight },
                      ]}
                    >
                      {optText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>{t('Or Enter Custom Name')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('e.g. Density, Oil Content')}
              placeholderTextColor={COLORS.textMuted}
              value={modalParamName}
              onChangeText={setModalParamName}
              accessible={true}
              accessibilityLabel={t('Custom Parameter Name')}
              accessibilityHint={t('Type custom quality parameter name here')}
            />

            <Text style={styles.modalLabel}>{t('Value (%)')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 5"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={modalParamValue}
              onChangeText={setModalParamValue}
              accessible={true}
              accessibilityLabel={t('Parameter Value percentage')}
              accessibilityHint={t('Enter percentage value for the custom parameter')}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setIsModalVisible(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('Done and Close modal')}
              >
                <Text style={styles.modalCancelBtnText}>{t('Done / Close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  const name = modalParamName.trim();
                  const val = modalParamValue.trim();
                  if (!name) {
                    showAlert({
                      type: 'warning',
                      title: t('Missing Field'),
                      message: t('Please select or enter a parameter name.'),
                    });
                    return;
                  }
                  if (!val || isNaN(Number(val)) || Number(val) < 0 || Number(val) > 100) {
                    showAlert({
                      type: 'warning',
                      title: t('Invalid Value'),
                      message: t('Please enter a valid percentage value between 0 and 100.'),
                    });
                    return;
                  }

                  // Check duplicate name
                  if (
                    customQualityParams.some(
                      p => p.name.toLowerCase() === name.toLowerCase()
                    ) ||
                    ['moisture', 'foreign material', 'broken / damaged', 'broken'].includes(name.toLowerCase())
                  ) {
                    showAlert({
                      type: 'warning',
                      title: t('Duplicate Parameter'),
                      message: t('This parameter already exists.'),
                    });
                    return;
                  }

                  setCustomQualityParams(prev => [...prev, { name, value: val }]);
                  // Clear fields so user can add more without closing
                  setModalParamName('');
                  setModalParamValue('');
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('Add parameter')}
                accessibilityHint={t('Double tap to save this parameter to list')}
              >
                <Text style={styles.modalAddBtnText}>{t('Add Parameter')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  datePickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
  },
  dateText: {
    fontSize: f(13),
    color: COLORS.text,
  },
  placeholderText: {
    color: COLORS.textMuted,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: w(6),
    height: h(44),
    alignItems: 'center',
  },
  pickerChip: {
    flex: 1,
    paddingVertical: h(10),
    paddingHorizontal: w(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: mw(10),
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
    borderStyle: 'solid',
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
    paddingVertical: h(14),
    paddingHorizontal: w(20),
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
    paddingVertical: h(12),
    paddingHorizontal: w(20),
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
  customParamsContainer: {
    gap: h(8),
    marginBottom: h(12),
  },
  customParamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderRadius: mw(10),
    paddingHorizontal: w(12),
    paddingVertical: h(10),
  },
  customParamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(12),
  },
  customParamName: {
    fontSize: f(12.5),
    fontWeight: '700',
    color: COLORS.text,
  },
  customParamValue: {
    fontSize: f(13),
    fontWeight: '800',
  },
  customParamDeleteBtn: {
    padding: w(2),
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderRadius: mw(10),
    paddingVertical: h(14),
    paddingHorizontal: w(16),
    gap: w(6),
    marginBottom: h(16),
  },
  addMoreBtnText: {
    fontSize: f(13),
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: w(20),
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: mw(16),
    padding: w(20),
    gap: h(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: f(16),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: h(8),
  },
  modalLabel: {
    fontSize: f(11),
    fontWeight: '700',
    color: COLORS.textLight,
    marginTop: h(4),
  },
  modalChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: w(6),
    marginBottom: h(6),
  },
  modalChip: {
    borderWidth: 1,
    borderRadius: mw(8),
    paddingHorizontal: w(10),
    paddingVertical: h(6),
  },
  modalChipInactive: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalChipText: {
    fontSize: f(11),
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: mw(8),
    paddingHorizontal: w(10),
    height: h(40),
    fontSize: f(12.5),
    color: COLORS.text,
    backgroundColor: '#F8FAFC',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: w(12),
    marginTop: h(12),
  },
  modalBtn: {
    paddingVertical: h(10),
    paddingHorizontal: w(24),
    borderRadius: mw(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: f(13),
  },
  modalAddBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(13),
  },
  modalParamsList: {
    marginBottom: h(4),
  },
  modalParamsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: w(6),
    marginTop: h(6),
  },
  modalAddedParamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: mw(8),
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    gap: w(6),
    marginBottom: h(4),
  },
  modalAddedParamText: {
    fontSize: f(11),
    color: COLORS.text,
  },
  modalAddedParamVal: {
    fontWeight: '800',
  },
  modalAddedParamDelete: {
    padding: w(1),
  },
});
