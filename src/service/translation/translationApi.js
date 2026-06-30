import apiClient from '../api';

const translationApi = {
  /**
   * Translates text into target language using Google Translation API (via backend route)
   * Method: POST
   * Route: /translate-text
   * @param {string|string[]} text - Text or array of texts to translate
   * @param {string} targetLang - Target language code (e.g. "hi", "en", "ta")
   * @param {Object} [config] - Axios request configuration options (e.g., abort signal)
   */
  translateText: async (text, targetLang, config = {}) => {
    try {
      const response = await apiClient.post('/translate-text', { text, targetLang }, config);
      return response.data;
    } catch (error) {
      console.error('[API] translateText error:', error);
      throw error;
    }
  },
};

export default translationApi;
