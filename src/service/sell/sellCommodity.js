import api from '../api';

const BASE_URL = '/sell-commodity';

/**
 * Create a new sell commodity listing
 * Method: POST
 * Route: /api/sell-commodity/create
 * @param {Object|FormData} data 
 * Expected Fields: commodityName, quantity, unit, sellingPrice, sellingPriceUnit, etc.
 */
export const createSellCommodity = async (data) => {
  console.log('[API] createSellCommodity called with data:', data);
  try {
    const response = await api.post(`${BASE_URL}/create`, data);
    console.log('[API] createSellCommodity success:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] createSellCommodity error:', error);
    throw error;
  }
};

/**
 * Fetch all/filtered sell commodity listings (paginated)
 * Method: GET
 * Route: /api/sell-commodity/
 * @param {Object} params 
 * Query: status, sellerId, commodityName, type, page, limit
 */
export const getSellCommodities = async (params) => {
  console.log('[API] getSellCommodities called with params:', params);
  try {
    const response = await api.get(`${BASE_URL}/`, { params });
    console.log('[API] getSellCommodities success:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] getSellCommodities error:', error);
    throw error;
  }
};

/**
 * Fetch details of a specific sell commodity listing
 * Method: GET
 * Route: /api/sell-commodity/:id
 * @param {string} id 
 */
export const getSellCommodityById = async (id) => {
  console.log(`[API] getSellCommodityById called for id: ${id}`);
  try {
    const response = await api.get(`${BASE_URL}/${id}`);
    console.log('[API] getSellCommodityById success:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] getSellCommodityById error:', error);
    throw error;
  }
};

/**
 * Update an existing sell commodity listing
 * Method: PATCH
 * Route: /api/sell-commodity/:id
 * @param {string} id 
 * @param {Object|FormData} data 
 */
export const updateSellCommodity = async (id, data) => {
  console.log(`[API] updateSellCommodity called for id: ${id} with data:`, data);
  try {
    const response = await api.patch(`${BASE_URL}/${id}`, data);
    console.log('[API] updateSellCommodity success:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] updateSellCommodity error:', error);
    throw error;
  }
};

/**
 * Delete/cancel a sell commodity listing
 * Method: DELETE
 * Route: /api/sell-commodity/:id
 * @param {string} id 
 */
export const deleteSellCommodity = async (id) => {
  console.log(`[API] deleteSellCommodity called for id: ${id}`);
  try {
    const response = await api.delete(`${BASE_URL}/${id}`);
    console.log('[API] deleteSellCommodity success:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] deleteSellCommodity error:', error);
    throw error;
  }
};
