import api from '../api';
import { normalizeCommodity, normalizeCommodityList } from '../normalizers/commodity.normalizer';

const BASE_URL = '/sell-commodity';

/**
 * Create a new sell commodity listing
 * POST /api/sell-commodity/create
 * @param {FormData} data - multipart form data
 * @param {Object} options - { isNegotiable: boolean } — sent as query param (not FormData string)
 * @param {Object} config  - axios config (e.g. { signal })
 */
export const createSellCommodity = async (data, options = {}, config = {}) => {
  const params = {};
  if (typeof options.isNegotiable === 'boolean') {
    params.isNegotiable = options.isNegotiable;
  }
  const response = await api.post(`${BASE_URL}/create`, data, { params, ...config });
  return normalizeCommodity(response.data?.commodity || response.data?.data || response.data);
};

/**
 * Fetch all/filtered sell commodity listings
 * GET /api/sell-commodity/
 * @param {Object} params - { status, sellerId, commodityName, type, page, limit }
 * @param {Object} config - axios config
 */
export const getSellCommodities = async (params, config = {}) => {
  const response = await api.get(`${BASE_URL}/`, { params, ...config });
  return normalizeCommodityList(response.data);
};

/**
 * Fetch details of a specific sell commodity listing
 * GET /api/sell-commodity/:id
 */
export const getSellCommodityById = async (id) => {
  const response = await api.get(`${BASE_URL}/${id}`);
  return normalizeCommodity(response.data?.commodity || response.data?.data || response.data);
};

/**
 * Update an existing sell commodity listing
 * PATCH /api/sell-commodity/:id
 */
export const updateSellCommodity = async (id, data, options = {}, config = {}) => {
  const params = {};
  if (typeof options.isNegotiable === 'boolean') {
    params.isNegotiable = options.isNegotiable;
  }
  const response = await api.patch(`${BASE_URL}/${id}`, data, { params, ...config });
  return normalizeCommodity(response.data?.commodity || response.data?.data || response.data);
};

/**
 * Delete/cancel a sell commodity listing
 * DELETE /api/sell-commodity/:id
 */
export const deleteSellCommodity = async (id) => {
  const response = await api.delete(`${BASE_URL}/${id}`);
  return response.data;
};
