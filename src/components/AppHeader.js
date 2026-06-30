import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector, useDispatch } from 'react-redux';
import { changeLanguageThunk } from '../store/languageSlice';
import COLORS from '../constant/colors';
import { w, h, f } from '../utils/responsive';

/**
 * AppHeader
 *
 * Props:
 *  - backgroundColor  {string}   Header bg color (required)
 *  - title            {string}   Bold screen title (centered)
 *  - subtitle         {string}   Light descriptive line below title
 *  - showBackButton   {bool|null}
 *       null (default) → auto-detects: shows back button if navigation.canGoBack() is true.
 *       true           → always show (even on a stack root).
 *       false          → always hide (use on tab-root screens).
 *  - onBackPress      {fn}       Custom back handler; falls back to navigation.goBack()
 *  - rightAction      {object}   Optional right icon: { icon, onPress, label }
 *  - showLanguageSwitcher {bool} If true, renders language switch icon on the right
 *  - children         {node}     Rendered below the title row (e.g. search bars)
 */
const AppHeader = ({
  backgroundColor,
  title,
  subtitle,
  children,
  showBackButton = null,   // null = auto-detect via canGoBack()
  onBackPress,
  rightAction,
  showLanguageSwitcher = false,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const currentLanguage = useSelector((state) => state.language?.currentLanguage || 'en');

  const [isModalVisible, setIsModalVisible] = useState(false);

  const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
  ];

  // Auto-detect: if caller didn't explicitly set showBackButton,
  // show the button only when the navigator actually has a screen to go back to.
  const canGoBack = navigation.canGoBack();
  const shouldShowBack = showBackButton === null ? canGoBack : showBackButton;

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (canGoBack) {
      navigation.goBack();
    }
  };

  const handleLanguageToggle = () => {
    setIsModalVisible(true);
  };

  const handleSelectLanguage = (langCode) => {
    console.log(`[Layer 1: AppHeader] User selected language: [${langCode}] (Previous: [${currentLanguage}])`);
    dispatch(changeLanguageThunk(langCode));
    setIsModalVisible(false);
  };

  return (
    <View style={[styles.header, { backgroundColor, paddingTop: insets.top }]}>
      <View style={styles.headerTopRow}>

        {/* ── Left: Back Button or spacer ─────────────────────────── */}
        {shouldShowBack ? (
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.sideBtn}
            activeOpacity={0.75}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Navigates to the previous screen"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.iconCircle}>
              <Icon name="arrow-left" size={f(20)} color={COLORS.white} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.sideSlot} />
        )}

        {/* ── Centre: Title + Subtitle ─────────────────────────────── */}
        <View style={styles.textContainer}>
          {title ? (
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* ── Right: Language Switcher, Custom action or balancing spacer ─────────────── */}
        {showLanguageSwitcher ? (
          <TouchableOpacity
            onPress={handleLanguageToggle}
            style={styles.sideBtn}
            activeOpacity={0.75}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Change language. Current language is ${currentLanguage === 'en' ? 'English' : 'Hindi'}`}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[styles.iconCircle, styles.iconCircleRight, currentLanguage === 'hi' && styles.activeIconCircle]}>
              <Icon
                name="translate"
                size={f(20)}
                color={COLORS.white}
              />
            </View>
          </TouchableOpacity>
        ) : rightAction ? (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={styles.sideBtn}
            activeOpacity={0.75}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={rightAction.label || 'Action'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[styles.iconCircle, styles.iconCircleRight]}>
              <Icon
                name={rightAction.icon || 'dots-vertical'}
                size={f(20)}
                color={COLORS.white}
              />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.sideSlot} />
        )}

      </View>

      {children}

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                <Icon name="close" size={f(24)} color={COLORS.textLight || '#666666'} />
              </TouchableOpacity>
            </View>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOption, isSelected && styles.langOptionSelected]}
                  onPress={() => handleSelectLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langOptionText, isSelected && styles.langOptionTextSelected]}>
                    {lang.label}
                  </Text>
                  {isSelected && <Icon name="check" size={f(20)} color={backgroundColor || COLORS.fpoPrimary || '#2B4D21'} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default React.memo(AppHeader);

const BTN = 36; // px — fixed size, NOT w() so width === height === borderRadius*2 always

const styles = StyleSheet.create({
  header: {
    paddingBottom: h(18),
    paddingHorizontal: w(14),
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: h(8),
    minHeight: h(44),
  },

  // ── Side slots ────────────────────────────────────────────────────────────
  sideBtn: {
    width: BTN,
    height: BTN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlot: {
    width: BTN,
    height: BTN,
  },

  // ── Back / Right icon circle ──────────────────────────────────────────────
  iconCircle: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,                        // perfect circle always
    backgroundColor: 'rgba(255, 255, 255, 0.22)', // visible frosted glass
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',      // subtle white ring
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)', // higher visibility for active translation
    borderColor: '#FFFFFF',
  },

  // ── Title / Subtitle ──────────────────────────────────────────────────────
  textContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: w(6),
  },
  title: {
    fontSize: f(17),
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: f(12),
    fontWeight: '400',
    color: COLORS.white,
    opacity: 0.82,
    marginTop: h(3),
    textAlign: 'center',
    lineHeight: h(17),
  },

  // ── Language Modal ────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: w(20),
    paddingBottom: h(40),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(20),
  },
  modalTitle: {
    fontSize: f(18),
    fontWeight: '700',
    color: COLORS.black,
  },
  closeBtn: {
    padding: w(4),
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: h(16),
    paddingHorizontal: w(16),
    borderRadius: 12,
    marginBottom: h(8),
    backgroundColor: '#F8F9FA',
  },
  langOptionSelected: {
    backgroundColor: 'rgba(56, 189, 104, 0.1)', // Assuming COLORS.primary is approx this green
    borderColor: 'rgba(56, 189, 104, 0.3)',
    borderWidth: 1,
  },
  langOptionText: {
    fontSize: f(16),
    color: COLORS.black,
    fontWeight: '500',
  },
  langOptionTextSelected: {
    color: COLORS.primary, // Assuming this is defined
    fontWeight: '700',
  },
});
