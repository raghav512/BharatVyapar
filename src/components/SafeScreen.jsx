import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * SafeScreen — wrapper component to handle safe area insets automatically.
 *
 * Props:
 *  - top    (default: true)  → status bar area. Set top={false} when screen has a
 *                              custom header/hero image that should go behind the status bar.
 *                              In that case, manually add `paddingTop: insets.top` inside the header.
 *
 *  - bottom (default: true)  → home indicator / gesture bar area (iPhone) or nav bar (Android).
 *                              Set bottom={false} if you have a fixed bottom tab bar already
 *                              handling its own inset (e.g. react-navigation bottom tabs).
 *
 *  - left / right (default: true) → handles landscape notch on tablets/iPads.
 *                              Set left={false} right={false} if your layout uses full-width
 *                              backgrounds and you want content to span edge-to-edge.
 *
 *  - style → extra styles on the outer View (e.g. backgroundColor).
 *
 * Common edge cases:
 *
 *  1. Custom colored header that extends behind status bar:
 *       <SafeScreen top={false}>
 *         <View style={{ paddingTop: insets.top, backgroundColor: 'green' }}> ...header </View>
 *       </SafeScreen>
 *
 *  2. Screen inside a react-navigation stack (top handled by header bar):
 *       <SafeScreen top={false} bottom={false}> ...content </SafeScreen>
 *
 *  3. Modal/bottom-sheet screen — only bottom inset matters:
 *       <SafeScreen top={false}> ...modal content </SafeScreen>
 *
 *  4. Landscape tablet where content shouldn't hug the notch sides:
 *       <SafeScreen> ...content </SafeScreen>  ← keep left/right true (default)
 */
const SafeScreen = ({
  children,
  style,
  top = true,
  bottom = true,
  left = true,
  right = true,
}) => {
  const insets = useSafeAreaInsets();

  const insetStyle = useMemo(
    () => ({
      paddingTop: top ? insets.top : 0,
      paddingBottom: bottom ? insets.bottom : 0,
      paddingLeft: left ? insets.left : 0,
      paddingRight: right ? insets.right : 0,
    }),
    [top, bottom, left, right, insets],
  );

  return <View style={[styles.container, insetStyle, style]}>{children}</View>;
};

export { SafeScreen };
export default SafeScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
