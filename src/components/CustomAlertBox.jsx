import React, {
  useImperativeHandle,
  forwardRef,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import COLORS from '../constant/colors';
import { getFriendlyErrorMessage } from '../utils/errorUtils';

const { width } = Dimensions.get('window');

/* ─── Type config ─────────────────────────────────────────── */
const TYPE_CONFIG = {
  success: {
    icon: 'checkmark-circle',
    color: COLORS.success,
    bg: '#F0FDF4',
    iconBg: '#DCFCE7',
  },
  error: {
    icon: 'close-circle',
    color: COLORS.error,
    bg: '#FEF2F2',
    iconBg: '#FEE2E2',
  },
  warning: {
    icon: 'warning',
    color: COLORS.warning,
    bg: '#FFFBEB',
    iconBg: '#FEF3C7',
  },
  info: {
    icon: 'information-circle',
    color: COLORS.info,
    bg: '#EFF6FF',
    iconBg: '#DBEAFE',
  },
  confirm: {
    icon: 'help-circle',
    color: '#7C3AED',
    bg: '#F5F3FF',
    iconBg: '#EDE9FE',
  },
};

/* ─── Default fallback ────────────────────────────────────── */
const DEFAULT = TYPE_CONFIG.info;

/* ─── Singleton ref (set by <CustomAlertBox />) ─────────── */
let _alertRef = null;

/**
 * Call this anywhere in your app to show a sweet alert.
 * @param {{ type?: string, title: string, message: string, buttons?: Array }} options
 */
export const showAlert = options => {
  if (_alertRef) {
    _alertRef.show(options);
  }
};

/* ─── Internal Alert Component (controlled via ref) ─────── */
const CustomAlertInner = forwardRef((_, ref) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState({
    type: 'info',
    title: '',
    message: '',
    buttons: [],
  });

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  // Track the running composite animation so we can stop it on unmount
  // and prevent dangling AnimatedEvent bridge listeners (AnimatedEvent.js:81 leak)
  const animRef = useRef(null);

  useEffect(() => {
    return () => {
      // Synchronously detach any pending native-driver listeners
      animRef.current?.stop();
      scaleAnim.stopAnimation();
      opacityAnim.stopAnimation();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    show(options) {
      setConfig({
        type: options.type || 'info',
        title: options.title || '',
        message: options.message ? getFriendlyErrorMessage(options.message) : '',
        buttons:
          options.buttons && options.buttons.length > 0
            ? options.buttons
            : [{ text: 'OK', style: 'default' }],
      });
      setVisible(true);
      animRef.current = Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]);
      animRef.current.start();
    },
  }));

  const handleClose = btn => {
    animRef.current = Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]);
    animRef.current.start(() => {
      setVisible(false);
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      if (btn?.onPress) btn.onPress();
    });
  };

  const typeConf = TYPE_CONFIG[config.type] || DEFAULT;

  const getButtonStyle = style => {
    if (style === 'destructive') return styles.btnDestructive;
    if (style === 'cancel') return styles.btnCancel;
    return [styles.btnDefault, { backgroundColor: typeConf.color }];
  };

  const getButtonTextStyle = style => {
    if (style === 'cancel') return styles.btnCancelText;
    return styles.btnDefaultText;
  };

  const getDynamicBtnStyle = btn => {
    const text = btn?.text || 'OK';
    const textLength = text.length;
    const horizontalPadding = Math.max(6, 20 - textLength);
    const verticalPadding = textLength > 10 ? 10 : 13;
    return {
      paddingHorizontal: horizontalPadding,
      paddingVertical: verticalPadding,
    };
  };

  const getDynamicBtnTextStyle = btn => {
    const text = btn?.text || 'OK';
    const textLength = text.length;
    const fontSize = textLength > 12 ? 12 : textLength > 8 ? 13.5 : 15;
    return {
      fontSize,
    };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => handleClose(null)}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: typeConf.bg },
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* ── Icon ── */}
          <View
            style={[styles.iconWrapper, { backgroundColor: typeConf.iconBg }]}
          >
            <Icon name={typeConf.icon} size={38} color={typeConf.color} />
          </View>

          {/* ── Title ── */}
          {!!config.title && (
            <Text style={[styles.title, { color: typeConf.color }]}>
              {config.title}
            </Text>
          )}

          {/* ── Message ── */}
          {!!config.message && (
            <Text style={styles.message}>{config.message}</Text>
          )}

          {/* ── Divider ── */}
          <View
            style={[styles.divider, { backgroundColor: typeConf.color + '30' }]}
          />

          {/* ── Buttons ── */}
          {(() => {
            const isVertical = config.buttons.length > 3 || config.buttons.some(btn => btn.text && btn.text.length > 16);
            return (
              <View
                style={[
                  styles.btnRow,
                  isVertical ? { flexDirection: 'column' } : { flexDirection: 'row' },
                  config.buttons.length === 1 && { justifyContent: 'center' },
                ]}
              >
                {config.buttons.map((btn, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.8}
                    style={[
                      styles.btn,
                      getButtonStyle(btn.style),
                      getDynamicBtnStyle(btn),
                      isVertical ? { width: '100%', flex: 0 } : { flex: 1 },
                      config.buttons.length === 1 && { minWidth: 140 },
                    ]}
                    onPress={() => handleClose(btn)}
                  >
                    <Text style={[getButtonTextStyle(btn.style), getDynamicBtnTextStyle(btn)]}>
                      {btn.text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ─── Host component — mount once in App.js ─────────────── */
export const CustomAlertBox = () => {
  const ref = useRef(null);

  // register the singleton
  React.useEffect(() => {
    _alertRef = ref.current;
    return () => {
      _alertRef = null;
    };
  }, []);

  return <CustomAlertInner ref={ref} />;
};

/* ─── Styles ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: width - 48,
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  divider: {
    width: '100%',
    height: 1,
    marginVertical: 22,
    borderRadius: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDefault: {
    // backgroundColor set dynamically
  },
  btnDefaultText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  btnCancel: {
    backgroundColor: COLORS.border,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnCancelText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
  btnDestructive: {
    backgroundColor: COLORS.error,
  },
});
