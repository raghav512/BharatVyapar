import api from '../api';
import { normalizeCommodity, normalizeCommodityList } from '../normalizers/commodity.normalizer';
import { normalizeOffer, normalizeOfferList } from '../normalizers/offer.normalizer';

const BASE_URL = '/buy-commodity';

/**
 * Submit initial offer on a commodity listing
 * POST /api/buy-commodity/offers
 */
export const submitOffer = async (offerData) => {
  const response = await api.post(`${BASE_URL}/offers`, offerData);
  return normalizeOffer(response.data?.offer || response.data?.data || response.data);
};

/**
 * Fetch offers submitted by the current buyer
 * GET /api/buy-commodity/offers
 */
export const getOffers = async (params) => {
  const response = await api.get(`${BASE_URL}/offers`, { params });
  return normalizeOfferList(response.data);
};

/**
 * Fetch all offers received for a specific commodity listing (Seller view)
 * GET /api/buy-commodity/offers/received/:commodityId
 */
export const getReceivedOffers = async (commodityId) => {
  const response = await api.get(`${BASE_URL}/offers/received/${commodityId}`);
  return normalizeOfferList(response.data);
};

/**
 * Fetch offer details with full negotiation history
 * GET /api/buy-commodity/offers/:id
 */
export const getOfferDetails = async (offerId) => {
  const response = await api.get(`${BASE_URL}/offers/${offerId}`);
  return normalizeOffer(response.data?.offer || response.data?.data || response.data);
};

/**
 * Submit counter offer
 * POST /api/buy-commodity/offers/:id/counter
 */
export const submitCounterOffer = async (offerId, counterData) => {
  const response = await api.post(`${BASE_URL}/offers/${offerId}/counter`, counterData);
  return normalizeOffer(response.data?.offer || response.data?.data || response.data);
};

/**
 * Accept negotiation offer
 * POST /api/buy-commodity/offers/:id/accept
 */
export const acceptOffer = async (offerId) => {
  const response = await api.post(`${BASE_URL}/offers/${offerId}/accept`);
  return normalizeOffer(response.data?.offer || response.data?.data || response.data);
};

/**
 * Reject negotiation offer
 * POST /api/buy-commodity/offers/:id/reject
 */
export const rejectOffer = async (offerId, rejectData) => {
  const response = await api.post(`${BASE_URL}/offers/${offerId}/reject`, rejectData);
  return normalizeOffer(response.data?.offer || response.data?.data || response.data);
};

/**
 * Get details of an Escrow Deal
 * GET /api/buy-commodity/deals/:dealId
 */
export const getDealDetails = async (dealId) => {
  const response = await api.get(`${BASE_URL}/deals/${dealId}`);
  // Deal is a different entity — return raw but unwrapped (no normalizer yet)
  return response.data?.deal || response.data?.data || response.data;
};

/**
 * Update the Escrow/Payment status of a deal
 * PATCH /api/buy-commodity/deals/:dealId/escrow
 */
export const updateEscrowStatus = async (dealId, escrowStatus) => {
  const response = await api.patch(`${BASE_URL}/deals/${dealId}/escrow`, { escrowStatus });
  return response.data;
};
