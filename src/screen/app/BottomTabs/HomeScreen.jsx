import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectUser, selectSelectedRole } from '../../../store/authSelectors';
import { SafeScreen } from '../../../components/SafeScreen';
import AppHeader from '../../../components/AppHeader';
import COLORS from '../../../constant/colors';
import { w, h, f,mw} from '../../../utils/responsive';
import { syncUserToDisplayData } from '../../../service/user/userService';
import { showAlert } from '../../../components/CustomAlertBox';
import { useTranslation } from '../../../hook/useTranslation';
import RequirementBottomSheet from '../../../components/RequirementBottomSheet';
import { requirementService } from '../../../service/trade/requirement.service';

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
      { label: 'Active Listings', value: '8 Offers', icon: 'storefront' },
    ],
    actions: [
      { name: 'Buy', description: 'Explore market listings and place offers', icon: 'cart-outline', tab: 'Market', highlight: true },
      { name: 'Sell', description: 'Publish crop stock details to find buyers', icon: 'storefront-outline', screen: 'Sell', highlight: true },
    ],
  },
  Trader: {
    stats: [
      { label: 'Purchased Stock', value: '3,400 MT', icon: 'warehouse' },
      { label: 'Trade Finance', value: '₹45.0 L', icon: 'cash-multiple' },
      { label: 'Active Bids', value: '12 Bids', icon: 'gavel' },
    ],
    actions: [
      { name: 'Buy', description: 'Explore market listings and place offers', icon: 'cart-outline', tab: 'Market', highlight: true },
      { name: 'Sell', description: 'Publish crop stock details to find buyers', icon: 'storefront-outline', screen: 'Sell', highlight: true },
    ],
  },
  Miller: {
    stats: [
      { label: 'Milling Stock', value: '2,100 MT', icon: 'warehouse' },
      { label: 'Material Loans', value: '₹30.0 L', icon: 'cash-multiple' },
      { label: 'Buy Indents', value: '4 Active', icon: 'clipboard-list' },
    ],
    actions: [
      { name: 'Buy', description: 'Explore market listings and place offers', icon: 'cart-outline', tab: 'Market', highlight: true },
      { name: 'Sell', description: 'Publish crop stock details to find buyers', icon: 'storefront-outline', screen: 'Sell', highlight: true },
    ],
  },
  Corporate: {
    stats: [
      { label: 'Bulk Inventory', value: '12,500 MT', icon: 'warehouse' },
      { label: 'Corporate Credit', value: '₹1.2 Cr', icon: 'cash-multiple' },
      { label: 'Open Tenders', value: '6 Bids', icon: 'file-document-outline' },
    ],
    actions: [
      { name: 'Buy', description: 'Explore market listings and place offers', icon: 'cart-outline', tab: 'Market', highlight: true },
      { name: 'Sell', description: 'Publish crop stock details to find buyers', icon: 'storefront-outline', screen: 'Sell', highlight: true },
    ],
  },
};

function HomeScreen({ navigation }) {
  // PERFORMANCE FIX: Two separate subscriptions — HomeScreen only re-renders
  // when user or selectedRole change, not on profileLoading or other auth fields.
  const user      = useSelector(selectUser);
  const stateRole = useSelector(selectSelectedRole);
  const { t }     = useTranslation();
  
  // Deal Lifecycle Engine: Buyer Requirements
  const [requirements, setRequirements] = React.useState([]);
  const [showRequirementModal, setShowRequirementModal] = React.useState(false);
  const [loadingRequirements, setLoadingRequirements] = React.useState(false);

  React.useEffect(() => {
    const fetchRequirements = async () => {
      setLoadingRequirements(true);
      try {
        const res = await requirementService.getAllRequirements();
        if (res?.success) {
          setRequirements(res.data.requirements);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingRequirements(false);
      }
    };
    fetchRequirements();
  }, []);

  const handleRequirementSubmit = async (payload) => {
    const res = await requirementService.submitRequirement(payload);
    if (res?.success) {
      setRequirements(prev => [...prev, res.data]);
    }
  };
  
  const selectedRole = useMemo(() => stateRole || user?.role || 'FPO', [stateRole, user?.role]);
  const roleTheme = useMemo(() => ROLE_THEMES[selectedRole] || ROLE_THEMES.FPO, [selectedRole]);
  const config = useMemo(() => ROLE_CONFIGS[selectedRole] || ROLE_CONFIGS.FPO, [selectedRole]);
  const { top: topInset } = useSafeAreaInsets();

  const handleAction = useCallback((item) => {
    try {
      console.log(`[HomeScreen] handleAction navigation triggered: target screen=${item.screen}, tab=${item.tab}`);
      if (item.screen) {
        navigation.navigate(item.screen);
      } else if (item.tab) {
        navigation.navigate(item.tab);
      }
    } catch (error) {
      console.error('[HomeScreen] handleAction navigation failure:', error);
      showAlert({
        type: 'error',
        title: 'Navigation Error',
        message: 'Could not complete the transition to the requested page.',
        buttons: [{ text: 'OK' }]
      });
    }
  }, [navigation]);

  const displayData = useMemo(() => syncUserToDisplayData(user), [user]);
  const fullName = useMemo(() => {
    return [displayData.firstName, displayData.lastName].filter(Boolean).join(' ').trim();
  }, [displayData.firstName, displayData.lastName]);

  // Precalculated layouts and colors to optimize JSX and avoid layout calculation overhead
  const headerPaddingTop = useMemo(() => topInset + h(10), [topInset]);
  const userNameStyle = useMemo(() => [styles.userName, { color: roleTheme.primary }], [roleTheme.primary]);
  const welcomeText = useMemo(() => fullName || user?.phone || t('Partner'), [fullName, user?.phone, t]);

  const stats = useMemo(() => {
    return (config.stats || []).map((stat) => ({
      ...stat,
      label: t(stat.label),
      value: t(stat.value),
      iconWrapperStyle: [
        styles.statIconWrapper,
        { backgroundColor: roleTheme.primary + '15' }
      ],
      iconColor: roleTheme.primary
    }));
  }, [config.stats, roleTheme.primary, t]);

  const quickActions = useMemo(() => {
    return (config.actions || []).map((act) => {
      return {
        ...act,
        name: t(act.name),
        description: t(act.description),
        buttonStyle: [
          styles.actionButton,
          {
            borderColor: roleTheme.primary + '20',
          }
        ],
        iconCircleStyle: [
          styles.actionIconCircle,
          { backgroundColor: roleTheme.primary + '10' }
        ],
        iconColor: roleTheme.primary,
        textStyle: [
          styles.actionText,
          { color: roleTheme.primary }
        ],
        descriptionStyle: [
          styles.actionDescription,
        ]
      };
    });
  }, [config.actions, roleTheme.primary, t]);

  return (
    <SafeScreen style={styles.safeContainer} top={false} bottom={false}>
      <AppHeader
        backgroundColor={roleTheme.primary}
        paddingTop={headerPaddingTop}
        title={t("Bharat FPO Vyapar")}
        subtitle={t(`${selectedRole} Dashboard`)}
        showBackButton={false}
        showLanguageSwitcher={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View 
          style={styles.welcomeHeader}
          accessible={true}
          accessibilityRole="header"
          accessibilityLabel={`${t("Welcome back,")} ${welcomeText}. ${t("Empowering your agricultural trade transactions.")}`}
        >
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeTitle}>{t("Welcome back,")}</Text>
              <Text style={userNameStyle}>
                {welcomeText}
              </Text>
              <Text style={styles.welcomeSubtitle}>{t("Empowering your agricultural trade transactions.")}</Text>
            </View>
            <View style={[styles.avatarCircle, { backgroundColor: roleTheme.primary }]}>
              <Text style={styles.avatarText}>
                {welcomeText ? welcomeText.substring(0, 1).toUpperCase() : 'B'}
              </Text>
            </View>
          </View>
        </View>

        {/* Buyer Requirement Section */}
        {requirements.length === 0 && !loadingRequirements ? (
          <TouchableOpacity 
            style={[styles.welcomeHeader, { backgroundColor: roleTheme.light, borderColor: roleTheme.primary }]}
            onPress={() => setShowRequirementModal(true)}
          >
            <View style={styles.welcomeRow}>
              <View style={styles.welcomeTextContainer}>
                <Text style={[styles.welcomeTitle, { color: roleTheme.primary, fontWeight: 'bold' }]}>
                  {t("Looking for a specific commodity?")}
                </Text>
                <Text style={[styles.welcomeSubtitle, { color: roleTheme.text }]}>
                  {t("Post your requirement here and sellers will contact you directly.")}
                </Text>
              </View>
              <View style={[styles.avatarCircle, { backgroundColor: roleTheme.primary }]}>
                <Icon name="plus" size={24} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        ) : requirements.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("My Requirements")}</Text>
              <TouchableOpacity onPress={() => setShowRequirementModal(true)}>
                <Icon name="plus-circle" size={24} color={roleTheme.primary} />
              </TouchableOpacity>
            </View>
            {requirements.map((req, idx) => (
              <View key={idx} style={styles.requirementCard}>
                <View style={styles.reqHeaderRow}>
                  <Text style={styles.reqCommodity}>{req.commodity}</Text>
                  <View style={[styles.reqBadge, { backgroundColor: roleTheme.primary + '15' }]}>
                    <Text style={[styles.reqBadgeText, { color: roleTheme.primary }]}>Active</Text>
                  </View>
                </View>
                <View style={styles.reqDetailsRow}>
                  <Text style={styles.reqDetailText}>{t("Qty:")} <Text style={{fontWeight: '700'}}>{req.quantity} Qt</Text></Text>
                  <Text style={styles.reqDetailText}>{t("Target:")} <Text style={{fontWeight: '700'}}>₹{req.targetPrice}</Text></Text>
                  <Text style={styles.reqDetailText}>{t("Loc:")} <Text style={{fontWeight: '700'}}>{req.location}</Text></Text>
                </View>
              </View>
            ))}
          </  >
        ) : null}

        {/* Stats Row */}
        {stats.length > 0 ? (
          <View style={styles.statsContainer}>
            {stats.map((stat, idx) => (
              <View 
                key={idx} 
                style={styles.statCard}
                accessible={true}
                accessibilityLabel={`${stat.label}: ${stat.value}`}
              >
                <View style={stat.iconWrapperStyle}>
                  <Icon name={stat.icon} size={18} color={stat.iconColor} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer} accessible={true} accessibilityLabel={t("No stats available.")}>
            <Text style={styles.emptyText}>{t("No stats available")}</Text>
          </View>
        )}

        {/* Trade Operations Section */}
        <View style={styles.sectionHeader} accessible={true} accessibilityRole="header">
          <Text style={styles.sectionTitle}>{t("Trade Operations")}</Text>
        </View>
        {quickActions.length > 0 ? (
          <View style={styles.gridContainer}>
            {quickActions.map((act, idx) => (
              <TouchableOpacity
                key={idx}
                style={act.buttonStyle}
                onPress={() => handleAction(act)}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t("Navigate to {name}").replace('{name}', act.name)}
                accessibilityHint={t("Opens the {name} feature").replace('{name}', act.name)}
              >
                <View style={act.iconCircleStyle}>
                  <Icon name={act.icon} size={24} color={act.iconColor} />
                </View>
                <Text style={act.textStyle}>{act.name}</Text>
                <Text style={act.descriptionStyle}>{act.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer} accessible={true} accessibilityLabel={t("No actions available.")}>
            <Text style={styles.emptyText}>{t("No actions available")}</Text>
          </View>
        )}

        {/* Help & Support */}
        <View style={[styles.supportCard, { borderColor: roleTheme.primary + '15' }]}>
          <View style={styles.supportRow}>
            <View style={[styles.supportIconContainer, { backgroundColor: roleTheme.primary + '15' }]}>
              <Icon name="headset" size={20} color={roleTheme.primary} />
            </View>
            <View style={styles.supportTextContainer}>
              <Text style={[styles.supportTitle, { color: roleTheme.primary }]}>{t("Help & Support Desk")}</Text>
              <Text style={styles.supportDesc}>{t("Have questions about trades or transactions? We are here 24/7.")}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.supportBtn, { backgroundColor: roleTheme.primary }]}
              activeOpacity={0.8}
              onPress={() => showAlert({
                type: 'info',
                title: t('Support Helpdesk'),
                message: t('Our helpline is active. Connecting you to a support agent shortly.'),
                buttons: [{ text: t('OK') }]
              })}
            >
              <Text style={styles.supportBtnText}>{t("Contact")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <RequirementBottomSheet 
        visible={showRequirementModal} 
        onClose={() => setShowRequirementModal(false)}
        onSubmit={handleRequirementSubmit}
      />
    </SafeScreen>
  );
}

export default React.memo(HomeScreen);

const styles = StyleSheet.create({
  safeContainer: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: w(16),
    paddingBottom: h(30),
    paddingTop: h(12),
  },
  welcomeHeader: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: w(16),
    marginBottom: h(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeTextContainer: {
    flex: 1,
    paddingRight: w(12),
  },
  welcomeTitle: {
    fontSize: f(13),
    color: '#64748B',
    fontWeight: '600',
  },
  userName: {
    fontSize: f(20),
    fontWeight: '800',
    marginTop: h(2),
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontSize: f(11),
    color: '#94A3B8',
    marginTop: h(4),
    lineHeight: h(15),
    fontWeight: '500',
  },
  avatarCircle: {
    width: w(50),
    height: w(50),
    borderRadius: mw(25),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: f(20),
    color: COLORS.white,
    fontWeight: '800',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: h(20),
    gap: w(10),
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingVertical: h(14),
    paddingHorizontal: w(8),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: h(8),
  },
  statValue: {
    fontSize: f(14),
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: f(10),
    fontWeight: '700',
    color: '#64748B',
    marginTop: h(2),
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(12),
    paddingHorizontal: w(2),
  },
  sectionTitle: {
    fontSize: f(15),
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.1,
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: h(24),
    gap: w(12),
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: h(20),
    paddingHorizontal: w(12),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: h(10),
  },
  actionText: {
    fontSize: f(15),
    fontWeight: '800',
    marginBottom: h(4),
  },
  actionDescription: {
    fontSize: f(10),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: h(14),
    paddingHorizontal: w(4),
    color: '#64748B',
  },
  supportCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    padding: w(16),
    marginTop: h(8),
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: w(12),
  },
  supportTextContainer: {
    flex: 1,
    paddingRight: w(8),
  },
  supportTitle: {
    fontSize: f(14),
    fontWeight: '800',
    marginBottom: h(2),
  },
  supportDesc: {
    fontSize: f(11),
    color: '#64748B',
    lineHeight: h(15),
    fontWeight: '500',
  },
  supportBtn: {
    paddingHorizontal: w(14),
    paddingVertical: h(8),
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportBtnText: {
    color: COLORS.white,
    fontSize: f(11),
    fontWeight: '800',
  },
  emptyContainer: {
    padding: h(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: h(16),
  },
  emptyText: {
    fontSize: f(13),
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  requirementCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: w(16),
    marginBottom: h(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  reqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(10),
  },
  reqCommodity: {
    fontSize: f(15),
    fontWeight: '800',
    color: '#0F172A',
  },
  reqBadge: {
    paddingHorizontal: w(8),
    paddingVertical: h(4),
    borderRadius: 6,
  },
  reqBadgeText: {
    fontSize: f(10),
    fontWeight: '700',
  },
  reqDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  reqDetailText: {
    fontSize: f(12),
    color: '#64748B',
  },
});
