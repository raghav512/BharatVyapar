import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, f } from '../../../utils/responsive';

const ROLE_THEMES = {
  FPO: { primary: COLORS.fpoPrimary, secondary: COLORS.fpoSecondary, light: COLORS.fpoLight, text: COLORS.fpoText },
  Trader: { primary: COLORS.traderPrimary, secondary: COLORS.traderSecondary, light: COLORS.traderLight, text: COLORS.traderText },
  Miller: { primary: COLORS.millerPrimary, secondary: COLORS.millerSecondary, light: COLORS.millerLight, text: COLORS.millerText },
  Corporate: { primary: COLORS.corporatePrimary, secondary: COLORS.corporateSecondary, light: COLORS.corporateLight, text: COLORS.corporateText },
};

const TRADES_DATA = [
  {
    id: 'TR-1024',
    crop: 'Wheat (Lokwan)',
    quantity: '50 MT',
    value: '₹12,00,000',
    partner: 'Vikas Trading Corp',
    status: 'In Transit',
    statusColor: '#DD6B20',
    date: '08 Jun 2026',
    progress: 0.6,
  },
  {
    id: 'TR-0985',
    crop: 'Soybean (Yellow)',
    quantity: '30 MT',
    value: '₹14,25,000',
    partner: 'Kailash Millers Ltd',
    status: 'Payment Pending',
    statusColor: '#3182CE',
    date: '05 Jun 2026',
    progress: 0.3,
  },
  {
    id: 'TR-0842',
    crop: 'Chana (Gram)',
    quantity: '40 MT',
    value: '₹20,60,000',
    partner: 'Direct Agro Mills',
    status: 'Delivered',
    statusColor: '#38A169',
    date: '28 May 2026',
    progress: 1.0,
  },
];

export default function TradesScreen({ navigation }) {
  const { user, selectedRole: stateRole } = useSelector(state => state.auth);
  const selectedRole = stateRole || user?.role || 'FPO';
  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO;

  const [activeTab, setActiveTab] = useState('ongoing'); // ongoing or completed

  const filteredTrades = TRADES_DATA.filter(t => 
    activeTab === 'ongoing' ? t.status !== 'Delivered' : t.status === 'Delivered'
  );

  return (
    <SafeScreen style={{ backgroundColor: theme.light }} top={false} bottom={false}>
      <AppHeader
        backgroundColor={theme.primary}
        title="My Trades"
        subtitle="Track your active & history trades"
        showBackButton={false}
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ongoing' && styles.activeTabBorder]}
          onPress={() => setActiveTab('ongoing')}
        >
          <Text style={[styles.tabText, activeTab === 'ongoing' && { color: theme.primary, fontWeight: '700' }]}>
            ⏳ Ongoing Trades
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'completed' && styles.activeTabBorder]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && { color: theme.primary, fontWeight: '700' }]}>
            ✅ Completed
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredTrades.length > 0 ? (
          filteredTrades.map((trade) => (
            <TouchableOpacity 
              key={trade.id} 
              style={styles.tradeCard}
              onPress={() => navigation.navigate('DealDetails', { dealId: trade.id })}
              activeOpacity={0.9}
            >
              <View style={styles.tradeHeader}>
                <View>
                  <Text style={styles.tradeId}>{trade.id}</Text>
                  <Text style={styles.tradeCrop}>{trade.crop}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: trade.statusColor + '15' }]}>
                  <Text style={[styles.statusText, { color: trade.statusColor }]}>{trade.status}</Text>
                </View>
              </View>

              <View style={styles.partnerRow}>
                <Icon name="handshake" size={16} color={COLORS.textMuted} />
                <Text style={styles.partnerText}>Partner: {trade.partner}</Text>
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Qty</Text>
                  <Text style={styles.detailValue}>{trade.quantity}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Val</Text>
                  <Text style={styles.detailValue}>{trade.value}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{trade.date}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${trade.progress * 100}%`, backgroundColor: trade.statusColor }
                  ]} 
                />
              </View>
              
              <View style={styles.footerActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => navigation.navigate('DealDetails', { dealId: trade.id })}
                >
                  <Icon name="eye-outline" size={16} color={theme.primary} />
                  <Text style={[styles.actionBtnText, { color: theme.primary }]}>Track Deal Progress</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Icon name="handshake-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No trades found.</Text>
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: h(14),
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTabBorder: {
    borderBottomColor: COLORS.border,
  },
  tabText: {
    fontSize: f(13),
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  listContent: {
    padding: w(16),
    paddingBottom: h(20),
  },
  tradeCard: {
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
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: h(10),
  },
  tradeId: {
    fontSize: f(11),
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tradeCrop: {
    fontSize: f(15),
    fontWeight: '700',
    color: COLORS.text,
    marginTop: h(2),
  },
  statusBadge: {
    paddingHorizontal: w(10),
    paddingVertical: h(4),
    borderRadius: 8,
  },
  statusText: {
    fontSize: f(11),
    fontWeight: '700',
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: h(12),
    gap: w(6),
  },
  partnerText: {
    fontSize: f(12),
    color: COLORS.textLight,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: w(10),
    marginBottom: h(12),
  },
  detailBlock: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: f(10),
    color: COLORS.textMuted,
    marginBottom: h(2),
  },
  detailValue: {
    fontSize: f(12),
    fontWeight: '700',
    color: COLORS.text,
  },
  progressTrack: {
    height: h(6),
    backgroundColor: '#E9ECEF',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: h(14),
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  footerActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
    paddingTop: h(12),
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(4),
  },
  borderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: '#F1F3F5',
  },
  actionBtnText: {
    fontSize: f(12),
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(80),
  },
  emptyText: {
    fontSize: f(13),
    color: COLORS.textMuted,
    marginTop: h(10),
    textAlign: 'center',
  },
});
