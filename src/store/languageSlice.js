import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translateTextService, translateBatchService } from '../service/translation/translationService';
import { storage, initStorage } from '../service/storage';
import enStrings from '../locales/en.json';
import hiStrings from '../locales/hi.json';

const LOCALES = {
  en: enStrings,
  hi: hiStrings,
};

/**
 * Async Thunk to translate a piece of text.
 * Checks the existing cache state before calling the translation API.
 * Automatically saves new translations into AsyncStorage to maintain persistence.
 */
export const translateTextThunk = createAsyncThunk(
  'language/translateText',
  async ({ text, targetLang }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const langCache = state.language.appTranslations[targetLang] || {};
      
      // Secondary check: if it was already fetched and stored during this tick
      if (langCache[text]) {
        return { text, targetLang, translatedText: langCache[text] };
      }

      // Fetch translation
      const translatedText = await translateTextService(text, targetLang);

      return { text, targetLang, translatedText };
    } catch (error) {
      console.error(`[Layer 3: Redux Thunk] translateTextThunk ERROR for "${text.substring(0, 20)}...":`, error);
      return rejectWithValue(error.message || error);
    }
  }
);

/**
 * Async Thunk to translate multiple text strings in a single batch request.
 */
export const translateBatchThunk = createAsyncThunk(
  'language/translateBatch',
  async ({ texts, targetLang }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const langCache = state.language.appTranslations[targetLang] || {};

      // Filter out texts that are already cached in Redux store
      const textsToTranslate = (texts || []).filter(text => {
        const clean = (text || '').trim();
        return clean && langCache[clean] === undefined;
      });

      if (textsToTranslate.length === 0) {
        return { translations: {}, targetLang };
      }

      // Call batch translation service
      const translations = await translateBatchService(textsToTranslate, targetLang);
      return { translations, targetLang };
    } catch (error) {
      console.error('[Layer 3: Redux Thunk] translateBatchThunk ERROR:', error);
      return rejectWithValue(error.message || error);
    }
  }
);

/**
 * Async Thunk to change the application language.
 * Saves the selected language preference to AsyncStorage.
 */
export const changeLanguageThunk = createAsyncThunk(
  'language/changeLanguage',
  async (lang, { dispatch }) => {
    try {
      storage.set('app_language', lang);
      // 10x Developer Fallback: Persist to AsyncStorage to guarantee save across app kills 
      // even if MMKV is falling back to memory (e.g. during Chrome debugging or missing native module)
      await AsyncStorage.setItem('bharat_vyapar_language', lang);
      dispatch(setLanguage(lang));
      dispatch(syncTranslationsThunk());
    } catch (error) {
      console.error('[Layer 3: Redux Thunk] changeLanguageThunk ERROR:', error);
    }
  }
);

/**
 * Async Thunk to load language settings and cache from AsyncStorage on startup.
 */
export const initializeLanguageThunk = createAsyncThunk(
  'language/initializeLanguage',
  async (_, { dispatch }) => {
    try {
      // Clean up legacy translation caches to free device storage
      await AsyncStorage.removeItem('bharat_vyapar_translation_cache').catch(() => {});
      await AsyncStorage.removeItem('bharat_vyapar_translation_cache_v2').catch(() => {});

      // Await storage preload from AsyncStorage
      await initStorage();

      const savedLang = storage.getString('app_language') || 'en';
      dispatch(setLanguage(savedLang));

      // Merge translations from preloaded memory cache into Redux store
      const cachedVersion = storage.getString('translation_version');
      if (cachedVersion === TRANSLATION_VERSION) {
        const cachedRaw = storage.getString(`translations_${savedLang}`);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            dispatch(loadCache({ [savedLang]: cached }));
          } catch (e) {
            console.error('[Layer 3: Redux Thunk] Failed to parse cached translations on init:', e);
          }
        }
      }

      dispatch(syncTranslationsThunk());
    } catch (error) {
      console.error('[Layer 3: Redux Thunk] initializeLanguageThunk error:', error);
    }
  }
);

/**
 * Async Thunk to sync missing translations in the background.
 * Compares current translations against en.json keys, and fetches any missing translations in a batch.
 */
export const syncTranslationsThunk = createAsyncThunk(
  'language/syncTranslations',
  async (_, { getState, dispatch }) => {
    try {
      const state = getState();
      const currentLang = state.language.currentLanguage;
      if (currentLang === 'en') return;

      const enKeys = Object.keys(enStrings);
      const currentTranslations = state.language.appTranslations[currentLang] || {};

      // Find keys that are missing or untranslated (i.e. value is equal to key or undefined)
      const missingKeys = enKeys.filter(key => {
        return !currentTranslations[key] || currentTranslations[key] === key;
      });

      if (missingKeys.length === 0) {
        console.log(`[i18n] Sync: All ${enKeys.length} keys are up to date for language "${currentLang}".`);
        return;
      }

      console.log(`[i18n] Sync: Found ${missingKeys.length} missing/untranslated keys for language "${currentLang}". Fetching...`);
      await dispatch(translateBatchThunk({ texts: missingKeys, targetLang: currentLang })).unwrap();
      console.log(`[i18n] Sync: Successfully updated ${missingKeys.length} translations for language "${currentLang}".`);
    } catch (error) {
      console.warn('[i18n] Background translation sync failed:', error);
    }
  }
);

const TRANSLATION_VERSION = 'v2'; // Increment to invalidate legacy translations cache

const getInitialLanguage = () => {
  try {
    return storage.getString('app_language') || 'en';
  } catch (e) {
    return 'en';
  }
};

const getInitialTranslations = () => {
  const translations = { en: enStrings };
  try {
    
    Object.keys(LOCALES).forEach(lang => {
      if (lang === 'en') return;
      const fallback = LOCALES[lang] || {};
      const cachedVersion = storage.getString('translation_version');
      let cached = {};
      
      if (cachedVersion === TRANSLATION_VERSION) {
        const cachedRaw = storage.getString(`translations_${lang}`);
        if (cachedRaw) {
          try {
            cached = JSON.parse(cachedRaw);
          } catch (err) {
            console.error(`[Layer 3: Redux] Failed to parse cached translations for ${lang}:`, err);
          }
        }
      } else {
        storage.delete(`translations_${lang}`);
      }
      
      translations[lang] = { ...fallback, ...cached };
    });
    
    const cachedVersion = storage.getString('translation_version');
    if (cachedVersion !== TRANSLATION_VERSION) {
      storage.set('translation_version', TRANSLATION_VERSION);
    }
  } catch (e) {
    console.error('[Layer 3: Redux] Failed to initialize translations from MMKV:', e);
  }
  return translations;
};

const languageSlice = createSlice({
  name: 'language',
  initialState: {
    currentLanguage: getInitialLanguage(),
    appTranslations: getInitialTranslations(),
    isLoading: false,
  },
  reducers: {
    setLanguage: (state, action) => {
      const lang = action.payload;
      state.currentLanguage = lang;
      if (!state.appTranslations[lang]) {
        const fallback = LOCALES[lang] || {};
        state.appTranslations[lang] = { ...fallback };
      }
    },
    loadCache: (state, action) => {
      state.appTranslations = {
        ...state.appTranslations,
        ...action.payload,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(translateTextThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(translateTextThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const { text, targetLang, translatedText } = action.payload;
        if (!state.appTranslations[targetLang]) {
          state.appTranslations[targetLang] = {};
        }
        state.appTranslations[targetLang][text] = translatedText;

        // Persist the entire updated translation dictionary back to MMKV
        try {
          storage.set(`translations_${targetLang}`, JSON.stringify(state.appTranslations[targetLang]));
        } catch (err) {
          console.error(`[Layer 3: Redux] MMKV write error for translations_${targetLang}:`, err);
        }
      })
      .addCase(translateTextThunk.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(translateBatchThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(translateBatchThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const { translations, targetLang } = action.payload;
        if (!state.appTranslations[targetLang]) {
          state.appTranslations[targetLang] = {};
        }
        
        // Merge translated values into the store
        Object.assign(state.appTranslations[targetLang], translations);

        // Persist the entire updated dictionary back to MMKV
        try {
          storage.set(`translations_${targetLang}`, JSON.stringify(state.appTranslations[targetLang]));
        } catch (err) {
          console.error(`[Layer 3: Redux] MMKV write error in batch for translations_${targetLang}:`, err);
        }
      })
      .addCase(translateBatchThunk.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const { setLanguage, loadCache } = languageSlice.actions;
export default languageSlice.reducer;
