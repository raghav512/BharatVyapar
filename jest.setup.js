import { Animated } from 'react-native';
const React = require('react');

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Polyfill FormData for Jest inspection
class MockFormData {
  constructor() {
    this._parts = [];
  }
  append(key, value) {
    this._parts.push([key, value]);
  }
}
global.FormData = MockFormData;

// Mock Safe Area
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children, style, ...props }) => (
      <View style={style} {...props}>
        {children}
      </View>
    ),
    useSafeAreaInsets: () => ({ top: 20, right: 0, bottom: 0, left: 0 }),
  };
});

// Mock Navigation
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: () => true,
      addListener: jest.fn(() => () => {}),
      setParams: jest.fn(),
    }),
    useFocusEffect: (cb) => {
      React.useEffect(() => {
        const cleanup = cb();
        return () => {
          if (typeof cleanup === 'function') cleanup();
        };
      }, [cb]);
    },
  };
});

// Mock Bottom Tabs Navigation utilities extending actual module to support createBottomTabNavigator
jest.mock('@react-navigation/bottom-tabs', () => {
  const actual = jest.requireActual('@react-navigation/bottom-tabs');
  return {
    ...actual,
    useBottomTabBarHeight: () => 60,
  };
});

// Mock Vector Icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ name, size, color, ...props }) => (
    <Text {...props}>Icon-{name}</Text>
  );
});

jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ name, size, color, ...props }) => (
    <Text {...props}>Icon-{name}</Text>
  );
});

// Mock Document Picker
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: { allFiles: 'allFiles', images: 'images', pdf: 'pdf' },
  isCancel: jest.fn(),
}));

// Mock Image Picker
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

// Mock Notifee
jest.mock('@notifee/react-native', () => ({
  displayNotification: jest.fn(),
  createChannel: jest.fn(),
}));

// Mock Firebase Messaging
jest.mock('@react-native-firebase/app', () => ({
  initializeApp: jest.fn(),
}));
jest.mock('@react-native-firebase/messaging', () => () => ({
  requestPermission: jest.fn(() => Promise.resolve(1)),
  getToken: jest.fn(() => Promise.resolve('mock-fcm-token')),
  onMessage: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
}));

// Mock Animated timing and spring on react-native directly to bypass animation delays
Animated.timing = (value, config) => ({
  start: (callback) => {
    value.setValue(config.toValue);
    if (callback) callback({ finished: true });
  },
  stop: () => {},
});
Animated.spring = (value, config) => ({
  start: (callback) => {
    value.setValue(config.toValue);
    if (callback) callback({ finished: true });
  },
  stop: () => {},
});
Animated.parallel = (animations) => ({
  start: (callback) => {
    if (Array.isArray(animations)) {
      animations.forEach((anim) => anim?.start?.());
    }
    if (callback) callback({ finished: true });
  },
  stop: () => {},
});
Animated.sequence = (animations) => ({
  start: (callback) => {
    if (Array.isArray(animations)) {
      animations.forEach((anim) => anim?.start?.());
    }
    if (callback) callback({ finished: true });
  },
  stop: () => {},
});

// Mock react-native-blob-util
jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: {
      DownloadDir: 'mock-download-dir',
      DocumentDir: 'mock-document-dir',
    },
  },
  config: jest.fn(() => ({
    fetch: jest.fn(() => Promise.resolve({
      path: () => 'mock-path',
    })),
  })),
  android: {
    actionViewIntent: jest.fn(() => Promise.resolve()),
  },
  ios: {
    previewDocument: jest.fn(),
  },
}));

// Mock react-native-date-picker
jest.mock('react-native-date-picker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props) => <View {...props} />;
});

// Mock InteractionManager to run callbacks synchronously under test
try {
  const rn = require('react-native');
  if (rn.InteractionManager) {
    rn.InteractionManager.runAfterInteractions = (callback) => {
      if (typeof callback === 'function') {
        callback();
      }
      return {
        then: (onFulfilled) => {
          if (typeof onFulfilled === 'function') onFulfilled();
          return Promise.resolve();
        },
        done: () => {},
        cancel: () => {},
      };
    };
  }
} catch (e) {
  console.warn('Failed to mock InteractionManager:', e);
}

// Mock requestIdleCallback and cancelIdleCallback globally for Jest
global.requestIdleCallback = (callback) => {
  if (typeof callback === 'function') {
    callback();
  }
  return 1;
};
global.cancelIdleCallback = () => {};

// Mock useTranslation globally
jest.mock('./src/hook/useTranslation', () => ({
  useTranslation: () => ({
    t: (str) => str || '',
    currentLanguage: 'en',
  }),
}));



