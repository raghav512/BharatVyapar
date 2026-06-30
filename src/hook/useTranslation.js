import { useCallback, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { translateTextThunk } from '../store/languageSlice';
import { storage } from '../service/storage';

// Module-level registry to track translation request status across all component instances
// key format: `${targetLang}_${text}`
// status can be: 'pending' | 'success' | 'failed'
const translationRegistry = new Map();

/**
 * Custom hook to translate text elements dynamically in React components.
 *
 * Usage:
 *   const { t, currentLanguage } = useTranslation();
 *   return <Text>{t('Welcome back')}</Text>;
 */
export const useTranslation = () => {
  const dispatch = useDispatch();
  const currentLanguage = useSelector(state => state.language.currentLanguage);

  // Directly consume translations from Redux. 
  // Redux already initializes synchronously from MMKV in languageSlice.js.
  const reduxTranslations = useSelector(
    state => state.language.appTranslations[currentLanguage],
  ) || {};

  const t = useCallback(
    text => {
      if (!text || typeof text !== 'string') {
        return '';
      }

      const cleanText = text.trim();
      if (!cleanText) {
        return '';
      }

      // English is the source language, return immediately without lookup
      if (currentLanguage === 'en') {
        return text;
      }

      // Check the Redux translations state
      const translated = reduxTranslations[cleanText];
      if (translated !== undefined) {
        return translated;
      }

      // Cache miss check: Check in-flight/failed status to prevent infinite loops
      const cacheKey = `${currentLanguage}_${cleanText}`;
      const status = translationRegistry.get(cacheKey);

      if (status === 'pending' || status === 'failed') {
        return text; // Return original text while translation is in-flight or failed
      }

      // Mark as pending immediately to prevent subsequent renders during the same tick from dispatching
      translationRegistry.set(cacheKey, 'pending');

      // Trigger translation thunk in background
      setTimeout(() => {
        dispatch(
          translateTextThunk({ text: cleanText, targetLang: currentLanguage }),
        )
          .unwrap()
          .then(() => {
            translationRegistry.set(cacheKey, 'success');
          })
          .catch(() => {
            translationRegistry.set(cacheKey, 'failed');
          });
      }, 0);

      // Fallback: return the original English text while in-flight
      return text;
    },
    [currentLanguage, reduxTranslations, dispatch],
  );

  return { t, currentLanguage };
};

