import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import COLORS from '../../constant/colors';
import { w, h, mw, f } from '../../utils/responsive';
import { showAlert } from '../../components/CustomAlertBox';
import { SafeScreen } from '../../components/SafeScreen';
import { selectUser } from '../../store/authSelectors';
import { useTranslation } from '../../hook/useTranslation';

const WAREHOUSES = [
  {
    id: '1',
    name: 'Arya Ag-Indore Agri Hub',
    location: 'Indore, Madhya Pradesh',
    type: 'Dry Storage',
    capacity: '15,000 MT',
    available: '4,200 MT',
    pricePerTon: '₹120/Month',
    rating: 4.8,
    features: ['WDRA Registered', 'NCDEX Approved', '24/7 CCTV'],
    suitableFor: ['Wheat', 'Soybean', 'Chana'],
  },
  {
    id: '2',
    name: 'Jaipur Grain Storage complex',
    location: 'Jaipur, Rajasthan',
    type: 'Dry & Cold Storage',
    capacity: '20,000 MT',
    available: '11,500 MT',
    pricePerTon: '₹140/Month',
    rating: 4.7,
    features: ['Insurance Covered', 'WDRA Registered', 'Moisture Test'],
    suitableFor: ['Mustard', 'Barley', 'Wheat'],
  },
  {
    id: '3',
    name: 'Gujarat Cold Chain Warehouse',
    location: 'Mehsana, Gujarat',
    type: 'Cold Storage',
    capacity: '8,000 MT',
    available: '1,800 MT',
    pricePerTon: '₹350/Month',
    rating: 4.9,
    features: ['Temperature Controlled', 'Pest Control', 'Insurance Covered'],
    suitableFor: ['Potato', 'Spices', 'Onion'],
  },
  {
    id: '4',
    name: 'Karnal Buffer Stock Yard',
    location: 'Karnal, Haryana',
    type: 'Dry Storage',
    capacity: '25,000 MT',
    available: '8,900 MT',
    pricePerTon: '₹110/Month',
    rating: 4.6,
    features: ['Rail Siding', 'WDRA Registered', 'Fire Safety'],
    suitableFor: ['Rice', 'Wheat', 'Maize'],
  },
];

export default function WarehouseScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // PERFORMANCE FIX: Single granular selector — WarehouseScreen only needs
  // user.role for theming. Subscribing to the entire auth slice caused
  // re-renders from unrelated auth actions (profileLoading, sendOtpError, etc.).
  const user = useSelector(selectUser);
  const selectedRole = user?.role || 'FPO';
  const roleColor = {
    FPO: COLORS.fpoPrimary,
    Trader: COLORS.traderPrimary,
    Miller: COLORS.millerPrimary,
    Corporate: COLORS.corporatePrimary,
  }[selectedRole] || COLORS.fpoPrimary;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [commodity, setCommodity] = useState('');
  const [quantity, setQuantity] = useState('');
  const [duration, setDuration] = useState('');

  const qtyVal = parseFloat(quantity) || 0;
  const durationVal = parseFloat(duration) || 0;
  const estimatedCost = qtyVal * durationVal * 120;

  const filteredWarehouses = WAREHOUSES.filter(wh => {
    const matchesSearch =
      wh.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wh.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' ||
      (selectedCategory === 'Cold Storage' && wh.type.includes('Cold')) ||
      (selectedCategory === 'WDRA' && wh.features.includes('WDRA Registered')) ||
      (selectedCategory === 'NCDEX' && wh.features.includes('NCDEX Approved'));
    return matchesSearch && matchesCategory;
  });

  const handleBookPress = (wh) => {
    setSelectedWarehouse(wh);
    setBookingModalVisible(true);
  };

  const submitBooking = () => {
    if (!commodity || !quantity || !duration) {
      Alert.alert(t('Error'), t('Please fill all details'));
      return;
    }
    setBookingModalVisible(false);
    
    // Show premium alert
    showAlert({
      type: 'info',
      title: t('Booking Confirmed!'),
      message: t("Successfully booked storage for {quantity} MT of {commodity} at {warehouse} for {duration} months. Our agent will call you for quality verification.")
        .replace('{quantity}', quantity)
        .replace('{commodity}', commodity)
        .replace('{warehouse}', selectedWarehouse.name)
        .replace('{duration}', duration),
      buttons: [{ text: t('OK'), style: 'default' }],
    });

    // Reset form
    setCommodity('');
    setQuantity('');
    setDuration('');
  };

  const handleTransferPress = (wh) => {
    showAlert({
      type: 'confirm',
      title: t('Transfer Stored Stock'),
      message: t("Would you like to initiate a warehouse receipt transfer or release ownership of stored commodities at {warehouse}?")
        .replace('{warehouse}', wh.name),
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Initiate Transfer'),
          style: 'default',
          onPress: () => {
            showAlert({
              type: 'info',
              title: t('Initiated Successfully'),
              message: t('Ownership transfer request raised. Our representative will verify warehouse receipts.'),
              buttons: [{ text: t('OK') }]
            });
          }
        }
      ]
    });
  };

  return (
    <SafeScreen style={styles.container} top={false} bottom={true}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: roleColor, paddingTop: insets.top + h(10) }]}>
        <Text style={styles.headerTitle}>{t('Warehouse Storage')}</Text>
        <Text style={styles.headerSubtitle}>{t('Search, compare, and book verified storage online')}</Text>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Icon name="magnify" size={24} color={COLORS.textMuted} />
          <TextInput
            placeholder={t('Search city, state or warehouse name')}
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {['All', 'Cold Storage', 'WDRA', 'NCDEX'].map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: roleColor },
                ]}
              >
                <Text style={[styles.filterChipText, isActive && styles.activeChipText]}>
                  {t(cat)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Warehouse list */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {filteredWarehouses.map(wh => (
          <View key={wh.id} style={styles.whCard}>
            {/* Card header */}
            <View style={styles.whHeader}>
              <View style={styles.whTitleWrapper}>
                <Text style={styles.whName}>{wh.name}</Text>
                <View style={styles.locationWrapper}>
                  <Icon name="map-marker" size={14} color={COLORS.textMuted} />
                  <Text style={styles.whLocation}>{wh.location}</Text>
                </View>
              </View>
              <View style={styles.ratingBox}>
                <Icon name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>{wh.rating}</Text>
              </View>
            </View>

            {/* Tags */}
            <View style={styles.tagsContainer}>
              {wh.features.map((feat, index) => (
                <View key={index} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{t(feat)}</Text>
                </View>
              ))}
            </View>

            {/* Info specs */}
            <View style={styles.specsRow}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>{t('Capacity')}</Text>
                <Text style={styles.specVal}>{t(wh.capacity)}</Text>
              </View>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>{t('Available')}</Text>
                <Text style={[styles.specVal, { color: COLORS.success }]}>{t(wh.available)}</Text>
              </View>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>{t('Price')}</Text>
                <Text style={[styles.specVal, { color: roleColor }]}>{t(wh.pricePerTon)}</Text>
              </View>
            </View>

            {/* Suitable Crops */}
            <Text style={styles.cropsLabel}>
              {t('Suitable for:')} <Text style={styles.cropsVal}>{wh.suitableFor.map(c => t(c)).join(', ')}</Text>
            </Text>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => handleBookPress(wh)}
                style={[styles.bookButton, { backgroundColor: roleColor, flex: 1 }]}
              >
                <Icon name="calendar-check" size={18} color={COLORS.white} />
                <Text style={styles.bookButtonText}>{t('Book Storage')}</Text>
              </TouchableOpacity>

              {(selectedRole === 'Trader' || selectedRole === 'Corporate') && (
                <TouchableOpacity
                  onPress={() => handleTransferPress(wh)}
                  style={[styles.transferButton, { borderColor: roleColor }]}
                >
                  <Icon name="swap-horizontal" size={18} color={roleColor} />
                  <Text style={[styles.transferButtonText, { color: roleColor }]}>{t('Transfer Stock')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {filteredWarehouses.length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon name="warehouse" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('No warehouses found matching filters.')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Booking Modal */}
      {selectedWarehouse && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={bookingModalVisible}
          onRequestClose={() => setBookingModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('Book Storage Space')}</Text>
                <TouchableOpacity onPress={() => setBookingModalVisible(false)}>
                  <Icon name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalWhName}>{selectedWarehouse.name}</Text>
              <Text style={styles.modalWhLoc}>{selectedWarehouse.location}</Text>

              {/* Form fields */}
              <Text style={styles.inputLabel}>{t('Commodity Type')}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t('e.g. Wheat, Soybean')}
                placeholderTextColor={COLORS.textMuted}
                value={commodity}
                onChangeText={setCommodity}
              />

              <Text style={styles.inputLabel}>{t('Quantity (MT)')}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t('e.g. 50')}
                keyboardType="numeric"
                placeholderTextColor={COLORS.textMuted}
                value={quantity}
                onChangeText={setQuantity}
              />

              <Text style={styles.inputLabel}>{t('Duration (Months)')}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t('e.g. 3')}
                keyboardType="numeric"
                placeholderTextColor={COLORS.textMuted}
                value={duration}
                onChangeText={setDuration}
              />

              {/* Estimate calculation */}
              {quantity !== '' && duration !== '' && (
                <View style={styles.calcBox}>
                  <Text style={styles.calcTitle}>{t('Estimated Cost')}</Text>
                  <Text style={[styles.calcValue, { color: roleColor }]}>
                    {t("₹{cost} / total duration").replace('{cost}', estimatedCost.toLocaleString('en-IN'))}
                  </Text>
                  <Text style={styles.calcHint}>{t('*Calculated at base rate of ₹120/MT/month')}</Text>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                onPress={submitBooking}
                style={[styles.submitButton, { backgroundColor: roleColor }]}
              >
                <Text style={styles.submitButtonText}>{t('Confirm and Book')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingVertical: h(20),
    paddingHorizontal: w(20),
    borderBottomLeftRadius: mw(24),
    borderBottomRightRadius: mw(24),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerTitle: {
    fontSize: f(22),
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: f(12),
    color: COLORS.white + 'CC',
    marginTop: h(4),
  },
  searchSection: {
    paddingHorizontal: w(20),
    marginTop: h(16),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: w(12),
    borderRadius: mw(12),
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    height: h(46),
  },
  searchInput: {
    flex: 1,
    fontSize: f(14),
    color: COLORS.text,
    marginLeft: w(8),
  },
  filterContainer: {
    paddingVertical: h(12),
    gap: w(8),
  },
  filterChip: {
    paddingHorizontal: w(14),
    paddingVertical: h(6),
    borderRadius: mw(20),
    backgroundColor: '#E9ECEF',
    marginRight: w(6),
  },
  filterChipText: {
    fontSize: f(12),
    color: COLORS.textLight,
    fontWeight: '600',
  },
  activeChipText: {
    color: COLORS.white,
  },
  listContent: {
    paddingHorizontal: w(20),
    paddingBottom: h(30),
  },
  whCard: {
    backgroundColor: COLORS.white,
    borderRadius: mw(16),
    padding: mw(16),
    marginBottom: h(16),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  whHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  whTitleWrapper: {
    flex: 1,
  },
  whName: {
    fontSize: f(16),
    fontWeight: '700',
    color: COLORS.text,
  },
  locationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: h(4),
  },
  whLocation: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginLeft: w(4),
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: mw(8),
  },
  ratingText: {
    fontSize: f(12),
    fontWeight: '700',
    color: '#D97706',
    marginLeft: w(4),
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: w(6),
    marginTop: h(12),
  },
  tagBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: mw(6),
  },
  tagText: {
    fontSize: f(10),
    color: COLORS.textLight,
    fontWeight: '500',
  },
  specsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: mw(10),
    padding: mw(12),
    marginTop: h(14),
  },
  specItem: {
    alignItems: 'center',
    flex: 1,
  },
  specLabel: {
    fontSize: f(11),
    color: COLORS.textMuted,
    marginBottom: h(2),
  },
  specVal: {
    fontSize: f(14),
    fontWeight: '700',
    color: COLORS.text,
  },
  cropsLabel: {
    fontSize: f(12),
    color: COLORS.textMuted,
    marginTop: h(12),
    marginBottom: h(4),
  },
  cropsVal: {
    fontWeight: '600',
    color: COLORS.text,
  },
  bookButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: h(12),
    borderRadius: mw(12),
    marginTop: h(14),
    gap: w(6),
  },
  bookButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(14),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: h(40),
  },
  emptyText: {
    fontSize: f(14),
    color: COLORS.textMuted,
    marginTop: h(10),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: mw(24),
    borderTopRightRadius: mw(24),
    paddingHorizontal: w(20),
    paddingTop: h(20),
    paddingBottom: h(30),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(16),
  },
  modalTitle: {
    fontSize: f(18),
    fontWeight: '800',
    color: COLORS.text,
  },
  modalWhName: {
    fontSize: f(15),
    fontWeight: '700',
    color: COLORS.text,
  },
  modalWhLoc: {
    fontSize: f(12),
    color: COLORS.textMuted,
    marginBottom: h(16),
  },
  inputLabel: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: h(6),
    marginTop: h(12),
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: mw(10),
    paddingHorizontal: w(12),
    height: h(44),
    fontSize: f(14),
    color: COLORS.text,
  },
  calcBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: mw(10),
    padding: mw(12),
    marginTop: h(20),
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  calcTitle: {
    fontSize: f(11),
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: h(2),
  },
  calcValue: {
    fontSize: f(18),
    fontWeight: '800',
  },
  calcHint: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginTop: h(4),
  },
  submitButton: {
    paddingVertical: h(14),
    borderRadius: mw(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(20),
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: f(15),
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: w(10),
    marginTop: h(14),
  },
  transferButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: h(12),
    borderRadius: mw(12),
    borderWidth: 1.5,
    flex: 1,
    gap: w(6),
  },
  transferButtonText: {
    fontWeight: '700',
    fontSize: f(14),
  },
});
