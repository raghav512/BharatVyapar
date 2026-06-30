import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryDb = {};
let isInitialized = false;

/**
 * Preloads all keys from AsyncStorage into the in-memory memoryDb cache.
 * Await this during app bootstrap (e.g. in the loading screen) to guarantee
 * synchronous storage access in subsequent code.
 */
export const initStorage = async () => {
  if (isInitialized) return;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(keys);
    pairs.forEach(([key, val]) => {
      if (val !== null) {
        memoryDb[key] = val;
      }
    });
    isInitialized = true;
    console.log('[Storage] AsyncStorage preloaded into memory cache successfully. Keys count:', keys.length);
  } catch (e) {
    console.error('[Storage] Failed to preload AsyncStorage:', e);
  }
};

const storageInstance = {
  getString: (key) => {
    return memoryDb[key] || null;
  },
  set: (key, value) => {
    const strVal = String(value);
    memoryDb[key] = strVal;
    
    // Background fire-and-forget persistence to AsyncStorage
    AsyncStorage.setItem(key, strVal).catch(err => {
      console.error(`[Storage] Failed to persist key "${key}" to AsyncStorage:`, err);
    });
  },
  delete: (key) => {
    delete memoryDb[key];
    
    // Background fire-and-forget deletion from AsyncStorage
    AsyncStorage.removeItem(key).catch(err => {
      console.error(`[Storage] Failed to delete key "${key}" from AsyncStorage:`, err);
    });
  },
  clearAll: () => {
    Object.keys(memoryDb).forEach(k => {
      delete memoryDb[k];
    });
    
    // Background fire-and-forget clear from AsyncStorage
    AsyncStorage.clear().catch(err => {
      console.error('[Storage] Failed to clear AsyncStorage:', err);
    });
  }
};

export const storage = storageInstance;
