import translationApi from './translationApi';

// Map to store active, in-flight translation promises: `${targetLang}:${text}` -> Promise<string>
const activeRequests = new Map();
// Set to track requests that failed in the current session to avoid spamming the backend
const failedRequests = new Set();

/**
 * Validates translation input parameters.
 * @param {string} text 
 * @param {string} targetLang 
 * @returns {boolean}
 */
const isValidInput = (text, targetLang) => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return false;
  }
  if (!targetLang || typeof targetLang !== 'string' || !targetLang.trim()) {
    return false;
  }
  return true;
};

/**
 * Extracts a single translated string from various response payload wrappers.
 * @param {any} responsePayload 
 * @returns {string} The trimmed translated text, or empty string.
 */
const extractSingleTranslation = (responsePayload) => {
  let translated = '';
  if (typeof responsePayload === 'string') {
    translated = responsePayload;
  } else if (responsePayload && typeof responsePayload === 'object') {
    if (typeof responsePayload.translatedText === 'string') {
      translated = responsePayload.translatedText;
    } else if (typeof responsePayload.translation === 'string') {
      translated = responsePayload.translation;
    } else if (responsePayload.data && typeof responsePayload.data.translatedText === 'string') {
      translated = responsePayload.data.translatedText;
    } else if (responsePayload.data && typeof responsePayload.data.translation === 'string') {
      translated = responsePayload.data.translation;
    } else if (typeof responsePayload.data === 'string') {
      translated = responsePayload.data;
    }
  }
  return (translated && typeof translated === 'string') ? translated.trim() : '';
};

/**
 * Extracts an array of translated strings from various response payload wrappers.
 * @param {any} responsePayload 
 * @returns {string[]|null} The array of translated strings, or null if invalid format.
 */
const extractBatchTranslations = (responsePayload) => {
  let list = null;
  if (Array.isArray(responsePayload)) {
    list = responsePayload;
  } else if (responsePayload && typeof responsePayload === 'object') {
    if (Array.isArray(responsePayload.translatedText)) {
      list = responsePayload.translatedText;
    } else if (Array.isArray(responsePayload.translation)) {
      list = responsePayload.translation;
    } else if (responsePayload.data && Array.isArray(responsePayload.data.translatedText)) {
      list = responsePayload.data.translatedText;
    } else if (responsePayload.data && Array.isArray(responsePayload.data.translation)) {
      list = responsePayload.data.translation;
    } else if (Array.isArray(responsePayload.data)) {
      list = responsePayload.data;
    }
  }
  return list;
};

/**
 * Service to translate text with validation, active request deduplication, and memory-tracked failure control.
 * @param {string} text - Text to translate.
 * @param {string} targetLang - Target language code.
 * @param {Object} [config] - Request configuration options (e.g. signal).
 * @returns {Promise<string>} The translated text, or original text on failure/invalid input.
 */
export const translateTextService = async (text, targetLang, config = {}) => {
  const trimmedText = (text || '').trim();
  const trimmedLang = (targetLang || '').trim().toLowerCase();

  // Guard: Invalid or empty inputs
  if (!Number.isNaN(Number(trimmedText.replace(/,/g, '')))) {
    return text;
  }

  if (!isValidInput(trimmedText, trimmedLang)) {
    return text;
  }

  // Guard: Source language matches target language
  if (trimmedLang === 'en') {
    return text;
  }

  const requestKey = `${trimmedLang}:${trimmedText}`;

  // Guard: If it failed in this session, return original text immediately to avoid infinite loops
  if (failedRequests.has(requestKey)) {
    return text;
  }

  // Deduplicate active requests: If this translation is already in flight, reuse the promise
  if (activeRequests.has(requestKey)) {
    return activeRequests.get(requestKey);
  }

  const translationPromise = (async () => {
    try {
      const responsePayload = await translationApi.translateText(trimmedText, trimmedLang, config);
      
      const translated = extractSingleTranslation(responsePayload);
      if (translated) {
        return translated;
      }
      
      throw new Error(`Invalid translation output format. Received: ${JSON.stringify(responsePayload)}`);
    } catch (error) {
      console.error(`[Layer 4: translationService] API FAILURE for "${trimmedText.substring(0, 20)}...":`, error);
      // Mark as failed for the current session to avoid infinite dispatch loops
      failedRequests.add(requestKey);
      throw error;
    } finally {
      // Always cleanup key when execution ends (fulfilled or rejected)
      activeRequests.delete(requestKey);
    }
  })();

  activeRequests.set(requestKey, translationPromise);
  return translationPromise;
};

/**
 * Translates an array of strings in batches, observing limits (max 100 items or 4500 characters).
 * Falls back to translating in parallel as individual requests if the backend fails to process array inputs.
 * @param {string[]} texts - Array of texts to translate.
 * @param {string} targetLang - Target language code.
 * @param {Object} [config] - Request configuration options.
 * @returns {Promise<Object>} A dictionary mapping input texts to translated texts.
 */
export const translateBatchService = async (texts, targetLang, config = {}) => {
  const trimmedLang = (targetLang || '').trim().toLowerCase();

  // Guard: Source language matches target language or empty array
  if (trimmedLang === 'en' || !Array.isArray(texts) || texts.length === 0) {
    return {};
  }

  // De-duplicate and filter input strings
  const filteredTexts = Array.from(new Set(texts))
    .map(t => (t || '').trim())
    .filter(t => {
      if (!t) return false;
      const cleanWithoutCommas = t.replace(/,/g, '');
      if (!Number.isNaN(Number(cleanWithoutCommas))) return false;
      
      const requestKey = `${trimmedLang}:${t}`;
      if (failedRequests.has(requestKey)) return false;

      return true;
    });

  if (filteredTexts.length === 0) {
    return {};
  }

  // Chunking logic based on Google Translate constraints (100 strings & 4500 chars limit)
  const chunks = [];
  let currentChunk = [];
  let currentChunkChars = 0;

  for (const text of filteredTexts) {
    if (currentChunk.length >= 100 || (currentChunkChars + text.length) > 4500) {
      chunks.push(currentChunk);
      currentChunk = [text];
      currentChunkChars = text.length;
    } else {
      currentChunk.push(text);
      currentChunkChars += text.length;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const resultMap = {};

  // Process chunks in parallel
  const chunkPromises = chunks.map(async (chunk) => {
    try {
      // 1. Primary path: Attempt batch call to the backend
      const responsePayload = await translationApi.translateText(chunk, trimmedLang, config);
      const translatedList = extractBatchTranslations(responsePayload);

      if (Array.isArray(translatedList) && translatedList.length === chunk.length) {
        chunk.forEach((original, idx) => {
          const val = translatedList[idx];
          let translated = '';
          if (val) {
            if (typeof val === 'string') {
              translated = val;
            } else if (typeof val === 'object') {
              translated = val.translatedText || val.translation || '';
            }
          }
          if (translated && typeof translated === 'string' && translated.trim()) {
            resultMap[original] = translated.trim();
          } else {
            resultMap[original] = original;
          }
        });
      } else {
        throw new Error(`Size mismatch or invalid payload structure. Expected ${chunk.length}, parsed ${translatedList?.length}`);
      }
    } catch (batchErr) {
      console.warn(`[Layer 4: translationService] Batch request failed. Falling back to parallel individual requests. Error:`, batchErr.message || batchErr);
      
      // 2. Fallback path: Request each item inside the chunk in parallel using Promise.all
      const individualPromises = chunk.map(async (text) => {
        const requestKey = `${trimmedLang}:${text}`;
        try {
          const res = await translationApi.translateText(text, trimmedLang, config);
          const val = extractSingleTranslation(res);
          if (val) {
            resultMap[text] = val;
          } else {
            resultMap[text] = text;
          }
        } catch (individualErr) {
          console.error(`[Layer 4: translationService] Fallback translation failed for "${text.substring(0, 15)}...":`, individualErr.message || individualErr);
          failedRequests.add(requestKey);
          resultMap[text] = text;
        }
      });

      await Promise.all(individualPromises);
    }
  });

  await Promise.all(chunkPromises);
  return resultMap;
};
