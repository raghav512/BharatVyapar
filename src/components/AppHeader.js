import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import COLORS from '../constant/colors';
import { w, h, f } from '../utils/responsive';

const AppHeader = ({
  backgroundColor,
  title,
  subtitle,
  children,
  showBackButton = true,
  onBackPress,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Handle back press gracefully
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const shouldShowBack = showBackButton;

  return (
    <View style={[styles.header, { backgroundColor, paddingTop: insets.top }]}>
      <View style={styles.headerTopRow}>
        {shouldShowBack && (
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={24} color={COLORS.white} />
          </TouchableOpacity>
        )}
        <View style={styles.textContainer}>
          {title && (
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              style={styles.subtitle}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {children}
    </View>
  );
};

export default AppHeader;

const styles = StyleSheet.create({
  header: {
    paddingBottom: h(20),
    paddingHorizontal: w(20),
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(10),
    position: 'relative',
    minHeight: h(32),
  },
  backButton: {
    position: 'absolute',
    left: 0,
    zIndex: 10,
    padding: w(4),
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: w(32),
  },
  title: {
    fontSize: f(16),
    color: COLORS.white,
    opacity: 0.9,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: f(16),
    fontWeight: '800',
    color: COLORS.white,
    marginTop: h(4),
    textAlign: 'center',
  },
});
