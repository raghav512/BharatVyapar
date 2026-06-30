import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { verifyOtp } from '../../store/authSlice';
import { useAuth } from '../../hook/useAuth';
import COLORS from '../../constant/colors';
import { w, h, mw, f } from '../../utils/responsive';
import { useTranslation } from '../../hook/useTranslation';

export default function VerifyMobileOtp({ route, navigation }) {
  const {
    mobile,
    selectedRole,
    roleColor = COLORS.fpoSecondary,
  } = route?.params || {};
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { verifyOtpLoading, verifyOtpError } = useAuth();
  const inputs = useRef([]);
  const scrollViewRef = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const boxScales = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(1)),
  ).current;

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

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      scrollViewRef.current?.scrollTo({ y: 80, animated: true });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const animateBox = idx => {
    Animated.sequence([
      Animated.timing(boxScales[idx], {
        toValue: 1.15,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(boxScales[idx], {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleChange = (text, idx) => {
    if (/^[0-9]?$/.test(text)) {
      const newOtp = [...otp];
      newOtp[idx] = text;
      setOtp(newOtp);
      setError('');
      if (text) {
        animateBox(idx);
        if (idx < 5) {
          inputs.current[idx + 1].focus();
        }
      }
    }
  };

  const handleKeyPress = ({ nativeEvent }, idx) => {
    if (nativeEvent.key === 'Backspace') {
      if (otp[idx] === '' && idx > 0) {
        const newOtp = [...otp];
        newOtp[idx - 1] = '';
        setOtp(newOtp);
        inputs.current[idx - 1].focus();
      }
    }
  };

  const handleVerify = async () => {
    const enteredOtp = otp.join('');

    if (enteredOtp.length < 6) {
      setError(t('Please enter all 6 digits'));
      shakeError();
      return;
    }

    setError('');
    Keyboard.dismiss();

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

    const action = await dispatch(
      verifyOtp({ mobile, otp: enteredOtp, role: selectedRole, roleColor }),
    );

    if (verifyOtp.rejected.match(action)) {
      setError(t(action.payload || 'Verify OTP failed'));
      shakeError();
    }
  };

  const handleResend = () => {
    setOtp(['', '', '', '', '', '']);
    inputs.current[0]?.focus();
  };

  const filledCount = otp.filter(d => d !== '').length;

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
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconCircle, { backgroundColor: roleColor }]}>
                <Text
                  style={{
                    fontSize:
                      selectedRole === 'Corporate'
                        ? 12
                        : selectedRole?.length > 5
                        ? 13
                        : 16,
                    fontWeight: '600',
                    color: COLORS.white,
                    letterSpacing: selectedRole === 'Corporate' ? -0.8 : 0,
                    transform: [
                      { scaleX: selectedRole === 'Corporate' ? 0.85 : 1 },
                    ],
                  }}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {t(selectedRole)}
                </Text>
              </View>
              <Text style={styles.appName}>{t('Bharat FPO Vyapar')}</Text>
              <Text style={styles.tagline}>
                {t('{role} Login').replace('{role}', t(selectedRole))}
              </Text>
            </View>

            {/* Card */}
            <Animated.View
              style={[
                styles.card,
                {
                  shadowColor: roleColor,
                  transform: [{ translateX: shakeAnim }],
                },
              ]}
            >
              <Text style={styles.cardTitle}>{t('Enter OTP')}</Text>
              <Text style={styles.cardSubtitle}>{t('6-digit code sent to')}</Text>

              <View style={styles.mobileRow}>
                <Text style={[styles.mobile, { color: roleColor }]}>
                  +91 {mobile}
                </Text>
              </View>

              {/* OTP boxes */}
              <View style={styles.otpRow}>
                {otp.map((digit, idx) => (
                  <Animated.View
                    key={idx}
                    style={[
                      styles.otpBoxWrap,
                      { transform: [{ scale: boxScales[idx] }] },
                    ]}
                  >
                    <TextInput
                      ref={el => (inputs.current[idx] = el)}
                      style={[
                        styles.otpBox,
                        digit !== '' && [
                          styles.otpBoxFilled,
                          { borderColor: roleColor },
                        ],
                      ]}
                      keyboardType="numeric"
                      maxLength={1}
                      value={digit}
                      onChangeText={text => handleChange(text, idx)}
                      onKeyPress={e => handleKeyPress(e, idx)}
                      returnKeyType={idx === 5 ? 'done' : 'next'}
                      onSubmitEditing={handleVerify}
                      autoFocus={idx === 0}
                      selectionColor={roleColor}
                    />
                  </Animated.View>
                ))}
              </View>

              {/* Progress */}
              <View style={styles.progressDots}>
                {otp.map((digit, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      digit !== ''
                        ? [styles.dotFilled, { backgroundColor: roleColor }]
                        : styles.dotEmpty,
                    ]}
                  />
                ))}
              </View>

              {/* Error */}
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Verify Button */}
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <TouchableOpacity
                  style={[
                    styles.btn,
                    { backgroundColor: roleColor },
                    (filledCount < 6 || verifyOtpLoading) && styles.btnDisabled,
                  ]}
                  onPress={handleVerify}
                  disabled={filledCount < 6 || verifyOtpLoading}
                  activeOpacity={0.9}
                >
                  {verifyOtpLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.btnText}>{t('Verify OTP')}</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Resend */}
              <View style={styles.resendRow}>
                <Text style={styles.resendText}>{t("Didn't receive code? ")}</Text>
                <TouchableOpacity onPress={handleResend}>
                  <Text style={[styles.resendLink, { color: roleColor }]}>
                    {t('Resend')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Footer */}
            <Text style={styles.footerNote}>
              {t('By continuing, you agree to our Terms & Privacy Policy')}
            </Text>
          </ScrollView>
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
    paddingTop: h(20),
    paddingBottom: h(40),
  },

  // Header
  header: { alignItems: 'center', marginBottom: h(24) },
  iconCircle: {
    width: 80,
    height: 80,
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
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    flexWrap: 'nowrap',
    fontSize: 16,
  },
  appName: {
    fontSize: f(34),
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
    borderRadius: 24,
    paddingHorizontal: w(20),
    paddingVertical: h(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },

  cardTitle: {
    fontSize: f(20),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: h(4),
  },
  cardSubtitle: {
    fontSize: f(13),
    color: COLORS.textMuted,
    marginBottom: h(2),
  },
  mobileRow: {
    marginBottom: h(18),
  },
  mobile: {
    fontSize: f(15),
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // OTP
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: h(14),
    gap: w(8),
  },
  otpBoxWrap: {},
  otpBox: {
    width: mw(44),
    height: mw(54),
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: f(20),
    fontWeight: '700',
    color: COLORS.text,
    backgroundColor: '#F8F9FA',
  },
  otpBoxFilled: {
    backgroundColor: COLORS.white,
  },

  // Progress
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: w(8),
    marginBottom: h(14),
  },
  dot: {
    width: w(8),
    height: w(8),
    borderRadius: w(4),
  },
  dotFilled: {},
  dotEmpty: { backgroundColor: '#E9ECEF' },

  // Error
  errorBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    padding: w(12),
    marginBottom: h(12),
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

  // Resend
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: h(14),
  },
  resendText: {
    fontSize: f(13),
    color: COLORS.textMuted,
  },
  resendLink: {
    fontSize: f(13),
    fontWeight: '700',
  },

  footerNote: {
    textAlign: 'center',
    fontSize: f(11),
    color: COLORS.textMuted,
    marginTop: h(20),
  },
});
