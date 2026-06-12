import api from '../api';

const BASE_URL = '/buy-commodity';

/**
 * Submit initial offer on a commodity listing
 * Method: POST
 * Route: /api/buy-commodity/offers
 * @param {Object} offerData
 * Fields: commodityId, price, priceUnit, quantity, unit, tradeType, paymentTimeline, remarks
 */
export const submitOffer = async (offerData) => {
  console.log('[API] submitOffer called with:', offerData);
  try {
    const response = await api.post(`${BASE_URL}/offers`, offerData);
    console.log('[API] submitOffer success:', response.data);
    return response.data;
  } catch (error) {
    console.warn('[API] submitOffer error:', error);
    throw error;
  }
};

/**
 * Fetch offers submitted by the current buyer, with optional filters
 * Method: GET
 * Route: /api/buy-commodity/offers
 * @param {Object} params - Query parameters (status, commodityId, page, limit)
 */
export const getOffers = async (params) => {
  console.log('[API] getOffers called with params:', params);
  try {
    const response = await api.get(`${BASE_URL}/offers`, { params });
    console.log('[API] getOffers success:', response.data);
    return response.data;
  } catch (error) {
    console.warn('[API] getOffers error:', error);
    throw error;
  }
};

/**
 * Fetch all offers received for a specific commodity listing (Seller view)
 * Method: GET
 * Route: /api/buy-commodity/offers/received/:commodityId
 * @param {string} commodityId
 */
export const getReceivedOffers = async (commodityId) => {
  console.log(`[API] getReceivedOffers called for commodityId: ${commodityId}`);
  try {
    const response = await api.get(`${BASE_URL}/offers/received/${commodityId}`);
    console.log('[API] getReceivedOffers success:', response.data);
    return response.data;
  } catch (error) {
    console.warn('[API] getReceivedOffers error:', error);
    throw error;
  }
};

/**
 * Fetch offer details along with full negotiation history
 * Method: GET
 * Route: /api/buy-commodity/offers/:id
 * @param {string} offerId
 */
export const getOfferDetails = async (offerId) => {
  console.log(`[API] getOfferDetails called for id: ${offerId}`);
  try {
    const response = await api.get(`${BASE_URL}/offers/${offerId}`);
    console.log('[API] getOfferDetails success:', response.data);
    return response.data;
  } catch (error) {
    console.warn('[API] getOfferDetails error:', error);
    throw error;
  }
};

/**
 * Submit counter offer
 * Method: POST
 * Route: /api/buy-commodity/offers/:id/counter
 * @param {string} offerId
 * @param {Object} counterData
 * Fields: price, quantity, remarks, isFinalOffer
 */
export const submitCounterOffer = async (offerId, counterData) => {
  console.log(`[API] submitCounterOffer called for offerId: ${offerId} with data:`, counterData);
  try {
    const response = await api.post(`${BASE_URL}/offers/${offerId}/counter`, counterData);
    console.log('[API] submitCounterOffer success:', response.data);
    return response.data;
  } catch (error) {
    console.warn('[API] submitCounterOffer error:', error);
    throw error;
  }
};

/**
 * Accept negotiation offer
 * Method: POST
 * Route: /api/buy-commodity/offers/:id/accept
 * @param {string} offerId
 */
export const acceptOffer = async (offerId) => {
  console.log(`[API] acceptOffer called for offerId: ${offerId}`);
  try {
    const response = await api.post(`${BASE_URL}/offers/${offerId}/accept`);
    console.log('[API] acceptOffer success:', response.data);
    return response.data;
  } catch (error) {
    console.warn('[API] acceptOffer error:', error);
    throw error;
  }
};

/**
 * Reject negotiation offer
 * Method: POST
 * Route: /api/buy-commodity/offers/:id/reject
 * @param {string} offerId
 * @param {Object} rejectData - Fields: reason
 */
export const rejectOffer = async (offerId, rejectData) => {
  console.log(`[API] rejectOffer called for offerId: ${offerId} with data:`, rejectData);
  try {
    const response = await api.post(`${BASE_URL}/offers/${offerId}/reject`, rejectData);
    console.log('[API] rejectOffer success:', response.data);
    return response.data;
  } catch (error) {
    console.warn('[API] rejectOffer error:', error);
    throw error;
  }
};

/**
 * Get details of an Escrow Deal
 * Method: GET
 * Route: /api/buy-commodity/deals/:dealId
 * @param {string} dealId
 */
export const getDealDetails = async (dealId) => {
  console.log(`[API] getDealDetails called for dealId: ${dealId}`);
  try {
    const response = await api.get(`${BASE_URL}/deals/${dealId}`);
    console.log('[API] getDealDetails success:', response.data);
    return response.data;
  } catch (error) {
    console.warn('[API] getDealDetails error:', error);
    throw error;
  }
};

/**
 * Update the Escrow/Payment status of a deal
 * Method: PATCH
 * Route: /api/buy-commodity/deals/:dealId/escrow
 * @param {string} dealId
 * @param {string} escrowStatus
 */
export const updateEscrowStatus = async (dealId, escrowStatus) => {
  console.log(`[API] updateEscrowStatus called for dealId: ${dealId} with status: ${escrowStatus}`);
  try {
    const response = await api.patch(`${BASE_URL}/deals/${dealId}/escrow`, { escrowStatus });
    console.log('[API] updateEscrowStatus success:', response.data);
    return response.data;
  } catch (error) {
    console.warn('[API] updateEscrowStatus error:', error);
    throw error;
  }
};
