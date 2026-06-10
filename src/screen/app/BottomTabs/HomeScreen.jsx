import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, f } from '../../../utils/responsive';

const ROLE_THEMES = {
  FPO: {
    primary: COLORS.fpoPrimary,
    secondary: COLORS.fpoSecondary,
    light: COLORS.fpoLight,
    text: COLORS.fpoText,
    accent: '#38A169',
  },
  Trader: {
    primary: COLORS.traderPrimary,
    secondary: COLORS.traderSecondary,
    light: COLORS.traderLight,
    text: COLORS.traderText,
    accent: '#4C51BF',
  },
  Miller: {
    primary: COLORS.millerPrimary,
    secondary: COLORS.millerSecondary,
    light: COLORS.millerLight,
    text: COLORS.millerText,
    accent: '#DD6B20',
  },
  Corporate: {
    primary: COLORS.corporatePrimary,
    secondary: COLORS.corporateSecondary,
    light: COLORS.corporateLight,
    text: COLORS.corporateText,
    accent: '#E53E3E',
  },
};

const ROLE_CONFIGS = {
  FPO: {
    stats: [
      { label: 'Member Stock', value: '1,250 MT', icon: 'warehouse' },
      { label: 'Active Loans', value: '₹18.5 L', icon: 'cash-multiple' },
      { label: 'Active Listings', value: '8 Offers', icon: 'storefront' },
    ],
    actions: [
      { name: 'Book Storage', icon: 'warehouse', screen: 'WarehouseScreen' },
      { name: 'Apply Loan', icon: 'cash-refund', screen: 'FinanceScreen' },
      { name: 'Marketplace', icon: 'cart', tab: 'Market' },
    ],
  },
  Trader: {
    stats: [
      { label: 'Purchased Stock', value: '3,400 MT', icon: 'warehouse' },
      { label: 'Trade Finance', value: '₹45.0 L', icon: 'cash-multiple' },
      { label: 'Active Bids', value: '12 Bids', icon: 'gavel' },
    ],
    actions: [
      { name: 'Locate Storage', icon: 'warehouse', screen: 'WarehouseScreen' },
      { name: 'Trade Finance', icon: 'cash-refund', screen: 'FinanceScreen' },
      { name: 'Market Intel', icon: 'chart-box-outline', tab: 'Market' },
    ],
  },
  Miller: {
    stats: [
      { label: 'Milling Stock', value: '2,100 MT', icon: 'warehouse' },
      { label: 'Material Loans', value: '₹30.0 L', icon: 'cash-multiple' },
      { label: 'Buy Indents', value: '4 Active', icon: 'clipboard-list' },
    ],
    actions: [
      { name: 'Factory Storage', icon: 'warehouse', screen: 'WarehouseScreen' },
      { name: 'Grain Purchase', icon: 'cart', tab: 'Market' },
      { name: 'Capital Loan', icon: 'cash-refund', screen: 'FinanceScreen' },
    ],
  },
  Corporate: {
    stats: [
      { label: 'Bulk Inventory', value: '12,500 MT', icon: 'warehouse' },
      { label: 'Corporate Credit', value: '₹1.2 Cr', icon: 'cash-multiple' },
      { label: 'Open Tenders', value: '6 Bids', icon: 'file-document-outline' },
    ],
    actions: [
      { name: 'Bulk Storage', icon: 'warehouse', screen: 'WarehouseScreen' },
      { name: 'Procure Grains', icon: 'cart', tab: 'Market' },
      { name: 'Credit Limit', icon: 'cash-refund', screen: 'FinanceScreen' },
    ],
  },
};

const MANDI_PRICES = [
  { crop: 'Wheat (Kanak)', price: '₹2,450/Qtl', change: '+₹25', up: true },
  { crop: 'Soybean (Yellow)', price: '₹4,820/Qtl', change: '-₹40', up: false },
  { crop: 'Chana (Gram)', price: '₹5,150/Qtl', change: '+₹15', up: true },
];

export default function HomeScreen({ navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  
  const roleTheme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;
  const config = ROLE_CONFIGS[selectedRole] || ROLE_CONFIGS.FPO;
  const { top: topInset } = useSafeAreaInsets();

  const handleAction = (item) => {
    if (item.screen) {
      navigation.navigate(item.screen);
    } else if (item.tab) {
      navigation.navigate(item.tab);
    }
  };

  return (
    <SafeScreen style={{ backgroundColor: roleTheme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={roleTheme.primary}
        paddingTop={topInset + h(10)}
        title="Bharat FPO Vyapar"
        subtitle={`${selectedRole} Dashboard`}
        showBackButton={false}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Welcome back,</Text>
          <Text style={[styles.userName, { color: roleTheme.primary }]}>
            {user?.name || user?.phone || 'Partner'}
          </Text>
          <Text style={styles.welcomeSubtitle}>Manage your agriculture trading & storage seamlessly.</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsContainer}>
          {config.stats.map((stat, idx) => (
            <View key={idx} style={styles.statCard}>
              <Icon name={stat.icon} size={24} color={roleTheme.primary} style={styles.statIcon} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.gridContainer}>
          {config.actions.map((act, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.actionButton}
              onPress={() => handleAction(act)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: roleTheme.primary + '15' }]}>
                <Icon name={act.icon} size={28} color={roleTheme.primary} />
              </View>
              <Text style={styles.actionText}>{act.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mandi Ticker */}
        <Text style={styles.sectionTitle}>Live Mandi Prices</Text>
        <View style={styles.mandiCard}>
          {MANDI_PRICES.map((item, idx) => (
            <View key={idx} style={[styles.mandiRow, idx !== MANDI_PRICES.length - 1 && styles.borderBottom]}>
              <Text style={styles.cropName}>{item.crop}</Text>
              <View style={styles.mandiPriceCol}>
                <Text style={styles.cropPrice}>{item.price}</Text>
                <View style={styles.mandiTrend}>
                  <Icon
                    name={item.up ? 'trending-up' : 'trending-down'}
                    size={16}
                    color={item.up ? COLORS.success : COLORS.error}
                  />
                  <Text style={[styles.cropChange, { color: item.up ? COLORS.success : COLORS.error }]}>
                    {item.change}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* AI recommendation widget */}
        
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: w(16),
    paddingBottom: h(20),
    paddingTop: h(12),
  },
  welcomeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: w(16),
    marginBottom: h(16),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  welcomeTitle: {
    fontSize: f(14),
    color: COLORS.textLight,
  },
  userName: {
    fontSize: f(20),
    fontWeight: '800',
    marginTop: h(2),
  },
  welcomeSubtitle: {
    fontSize: f(12),
    color: COLORS.textMuted,
    marginTop: h(4),
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: h(20),
    gap: w(8),
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: w(12),
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  statIcon: {
    marginBottom: h(4),
  },
  statValue: {
    fontSize: f(14),
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginTop: h(2),
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: f(15),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: h(10),
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: h(20),
    rowGap: h(12),
  },
  actionButton: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: h(16),
    paddingHorizontal: w(12),
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  actionIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: h(8),
  },
  actionText: {
    fontSize: f(13),
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  mandiCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: w(16),
    marginBottom: h(20),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  mandiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: h(14),
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  cropName: {
    fontSize: f(13),
    fontWeight: '600',
    color: COLORS.text,
  },
  mandiPriceCol: {
    alignItems: 'flex-end',
  },
  cropPrice: {
    fontSize: f(13),
    fontWeight: '700',
    color: COLORS.text,
  },
  mandiTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: h(2),
  },
  cropChange: {
    fontSize: f(11),
    fontWeight: '600',
    marginLeft: w(2),
  },
  recommendationCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: w(16),
    marginBottom: h(10),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: h(6),
  },
  recTitle: {
    fontSize: f(13),
    fontWeight: '700',
    marginLeft: w(6),
  },
  recContent: {
    fontSize: f(12),
    color: COLORS.textLight,
    lineHeight: h(18),
  },
});
