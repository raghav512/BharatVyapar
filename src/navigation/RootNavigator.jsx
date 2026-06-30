import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { selectIsAuthenticated, selectIsAuthChecked } from '../store/authSelectors';

import { checkStoredToken, clearAuth } from '../store/authSlice';
import { initializeLanguageThunk } from '../store/languageSlice';
import { setUnauthorizedCallback } from '../service/api';

import SplashScreen from '../screen/SplashScreen';
import AuthStack from './AuthStack/AuthStack';
import AppStack from './AppStack/AppStack';

export default function RootNavigator() {
  const dispatch = useDispatch();
  // PERFORMANCE FIX: Three separate subscriptions instead of one whole-slice
  // selector. Each only re-renders RootNavigator when its specific field changes.
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAuthChecked   = useSelector(selectIsAuthChecked);

  const [isLangInitialized, setIsLangInitialized] = useState(false);

  useEffect(() => {
    dispatch(initializeLanguageThunk())
      .unwrap()
      .catch(() => {})
      .finally(() => {
        setIsLangInitialized(true);
      });
  }, [dispatch]);

  useEffect(() => {
    // Small delay before checking token
    const timer = setTimeout(() => {
      dispatch(checkStoredToken());
    }, 1500);

    return () => clearTimeout(timer);
  }, [dispatch]);

  useEffect(() => {
    setUnauthorizedCallback(() => {
      dispatch(clearAuth());
    });

    return () => {
      setUnauthorizedCallback(null);
    };
  }, [dispatch]);

  if (!isAuthChecked || !isLangInitialized) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
