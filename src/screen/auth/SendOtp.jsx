import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { sendOtp } from '../../store/authSlice';
import { useAuth } from '../../hook/useAuth';
import COLORS from '../../constant/colors';
import { w, h, mw, f } from '../../utils/responsive';
import { useTranslation } from '../../hook/useTranslation';

export default function SendOtp({ route, navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const selectedRole = route?.params?.selectedRole || 'FPO';
  const roleColor = route?.params?.roleColor || COLORS.fpoSecondary;

  const [mobile, setMobile] = useState('');
  const [formError, setFormError] = useState('');
  const { sendOtpLoading, sendOtpError } = useAuth();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMobileChange = value => {
    const digitsOnly = value.replace(/[^0-9]/g, '');
    setMobile(digitsOnly);
    setFormError('');
  };

  const handleLoginWithOtp = async () => {
    if (mobile.length !== 10) {
      setFormError(t('Please enter a valid 10-digit mobile number.'));
      return;
    }
    if (!selectedRole) {
      setFormError(t('Please select a role.'));
      return;
    }

    setFormError('');

    Animated.sequence([
      Animated.timing(btnScale, {
        toValue: 0.97,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.spring(btnScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const action = await dispatch(sendOtp({ mobile, role: selectedRole }));

    if (sendOtp.rejected.match(action)) {
      setFormError(t(action.payload || 'Unable to send OTP. Please try again.'));
      return;
    }

    if (sendOtp.fulfilled.match(action)) {
      navigation.navigate('VerifyMobileOtp', {
        mobile,
        selectedRole,
        roleColor,
      });
    }
  };

  const progressWidth = (mobile.length / 10) * 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Animated.View
          style={[
            styles.flex,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconCircle, { backgroundColor: roleColor }]}>
                <Text
                  style={{
                    fontSize:
                      selectedRole === 'Corporate'
                        ? 15
                        : selectedRole?.length > 5
                        ? 13
                        : 16,
                    fontWeight: '600',
                    color: COLORS.white,
                    letterSpacing: selectedRole === 'Corporate' ? -0.5 : 0,
                    transform: [
                      { scaleX: selectedRole === 'Corporate' ? 0.9 : 1 },
                    ],
                  }}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {t(selectedRole)}
                </Text>
              </View>
              <Text style={styles.appName}>{t('Bharat FPO Vyapar')}</Text>
              <Text style={styles.tagline}>{t('Aapka Business, Aapki Tarakki')}</Text>
            </View>

            {/* Card */}
            <View style={[styles.card, { shadowColor: roleColor }]}>
              <View style={styles.roleTag}>
                <Text
                  style={[
                    styles.roleBadge,
                    { backgroundColor: roleColor + '20', color: roleColor },
                  ]}
                >
                  {t(selectedRole)}
                </Text>
              </View>

              <Text style={styles.cardTitle}>{t('Enter Mobile Number')}</Text>
              <Text style={styles.cardSubtitle}>
                {t("We'll send an OTP to verify your number")}
              </Text>

              {/* Phone input */}
              <View style={styles.inputWrapper}>
                <View style={styles.countryCode}>
                  <Text style={[styles.countryCodeText, { color: roleColor }]}>
                    +91
                  </Text>
                  <View style={styles.codeDivider} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t('Mobile number')}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                  value={mobile}
                  onChangeText={handleMobileChange}
                  editable={!sendOtpLoading}
                />
                {mobile.length === 10 && (
                  <Text style={[styles.checkmark, { color: COLORS.success }]}>
                    ✓
                  </Text>
                )}
              </View>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: `${progressWidth}%`,
                      backgroundColor:
                        mobile.length === 10 ? COLORS.success : roleColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressHint}>
                {t('{length}/10 digits').replace('{length}', String(mobile.length))}
              </Text>

              {/* Error */}
              {!!formError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.stickyFooter}>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: roleColor },
                  (mobile.length !== 10 || sendOtpLoading) && styles.btnDisabled,
                ]}
                onPress={handleLoginWithOtp}
                disabled={mobile.length !== 10 || sendOtpLoading}
                activeOpacity={0.9}
              >
                {sendOtpLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnText}>{t('Send OTP')}</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.footerNote}>
              {t('By continuing, you agree to our Terms & Privacy Policy')}
            </Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: { flex: 1 },

  scrollContent: {
    paddingHorizontal: w(24),
    paddingTop: h(30),
    paddingBottom: h(16),
  },

  stickyFooter: {
    paddingHorizontal: w(24),
    paddingTop: h(12),
    paddingBottom: h(16),
    backgroundColor: COLORS.white,
  },

  // Header
  header: { alignItems: 'center', marginBottom: h(28) },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: h(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    paddingHorizontal: 10,
  },
  iconText: {
    fontSize: f(18),
    fontWeight: '700',
    color: COLORS.white,
  },
  appName: {
    fontSize: f(24),
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: f(12),
    color: COLORS.textMuted,
    marginTop: h(4),
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: w(20),
    paddingVertical: h(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },

  roleTag: {
    alignItems: 'flex-start',
    marginBottom: h(8),
  },
  roleBadge: {
    fontSize: f(12),
    fontWeight: '700',
    paddingHorizontal: w(12),
    paddingVertical: h(4),
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: f(18),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: h(4),
  },
  cardSubtitle: {
    fontSize: f(13),
    color: COLORS.textMuted,
    marginBottom: h(20),
  },

  // Input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    paddingHorizontal: w(14),
    marginBottom: h(12),
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: w(8),
  },
  countryCodeText: {
    fontSize: f(16),
    fontWeight: '700',
  },
  codeDivider: {
    width: 1,
    height: h(22),
    backgroundColor: '#DEE2E6',
    marginLeft: w(8),
  },
  input: {
    flex: 1,
    paddingVertical: h(14),
    fontSize: f(16),
    color: COLORS.text,
    fontWeight: '600',
    letterSpacing: 1,
  },
  checkmark: {
    fontSize: f(18),
    fontWeight: '700',
  },

  // Progress
  progressTrack: {
    height: h(4),
    backgroundColor: '#E9ECEF',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: h(4),
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressHint: {
    fontSize: f(11),
    color: COLORS.textMuted,
    textAlign: 'right',
    marginBottom: h(8),
  },

  // Error
  errorBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    padding: w(12),
    marginBottom: h(8),
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: f(13),
  },

  // Button
  btn: {
    paddingVertical: h(16),
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: f(16),
  },

  footerNote: {
    textAlign: 'center',
    fontSize: f(11),
    color: COLORS.textMuted,
    marginTop: h(12),
  },
});
