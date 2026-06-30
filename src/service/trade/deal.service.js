import { USE_DUMMY_API } from '../../config';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export const dealService = {
  /**
   * Update the status of a deal
   * @param {string} dealId 
   * @param {string} status 
   */
  updateDealStatus: async (dealId, status) => {
    if (USE_DUMMY_API) {
      await delay(800);
      return {
        success: true,
        data: {
          _id: dealId,
          status: status, // e.g. 'DISPATCH_PENDING', 'PO_UPLOADED'
          updatedAt: new Date().toISOString(),
        },
      };
    }
    // TODO: replace with real API — axios.patch(`/api/v1/deals/${dealId}/status`, { status })
  },

  /**
   * Upload a single document for a deal (e.g. PO, E-Invoice, etc.)
   * @param {string} dealId 
   * @param {string} docType 
   * @param {Object} file 
   */
  uploadDealDocument: async (dealId, docType, file) => {
    if (USE_DUMMY_API) {
      await delay(1200);
      return {
        success: true,
        data: {
          _id: `doc_${Math.random().toString(36).substring(2, 9)}`,
          docType: docType,
          fileUrl: `https://mock-storage.com/${file.name || 'document.pdf'}`,
          uploadedAt: new Date().toISOString(),
        },
      };
    }
    // TODO: replace with real API — Form data upload to axios.post(`/api/v1/deals/${dealId}/documents`, formData)
  },

  /**
   * Confirm all dispatch documents are uploaded
   * @param {string} dealId 
   */
  confirmDispatch: async (dealId) => {
    if (USE_DUMMY_API) {
      await delay(800);
      return {
        success: true,
        data: {
          _id: dealId,
          status: 'DISPATCHED',
          updatedAt: new Date().toISOString(),
        },
      };
    }
    // TODO: replace with real API — axios.post(`/api/v1/deals/${dealId}/dispatch-confirm`)
  },

  /**
   * Submit a debit note for a delivered deal
   * @param {string} dealId 
   * @param {Object} payload 
   */
  submitDebitNote: async (dealId, payload) => {
    if (USE_DUMMY_API) {
      await delay(1000);
      return {
        success: true,
        data: {
          _id: dealId,
          status: 'DISPUTED',
          debitNote: {
            _id: `dn_${Math.random().toString(36).substring(2, 9)}`,
            adjustedAmount: payload.adjustedAmount,
            reason: payload.reason,
            createdAt: new Date().toISOString(),
          },
        },
      };
    }
    // TODO: replace with real API — axios.post(`/api/v1/deals/${dealId}/debit-note`, payload)
  }
};

// Simulate submitting a quote (bid) against a buyer's requirement
export const submitQuoteAgainstRequirement = async (requirementId, payload) => {
  await delay(1200);
  if (!USE_DUMMY_API) {
    throw new Error('Not implemented for real backend yet');
  }
  return {
    success: true,
    message: 'Quote submitted successfully',
    quoteId: `quote_${Date.now()}`
  };
};

// Simulate getting submitted quotes (for the seller)
export const getMySubmittedQuotes = async (sellerId) => {
  await delay(800);
  if (!USE_DUMMY_API) {
    return [];
  }
  // Mock data representing bids the seller has placed on buyer demands
  return [
    {
      id: 'quote_1',
      requirementId: 'req_1',
      buyerId: 'buyer_123',
      commodity: { commodityName: 'Wheat' }, // Normalizing to match OfferCard shape
      quantity: 50,
      price: 2500,
      priceUnit: 'Qt',
      status: 'pending',
      displayStatus: 'pending',
      currentTurn: 'buyer',
      createdAt: new Date().toISOString()
    }
  ];
};

// Simulate getting received quotes (for the buyer)
export const getReceivedQuotesOnRequirements = async (buyerId) => {
  await delay(800);
  if (!USE_DUMMY_API) {
    return [];
  }
  return [
    {
      id: 'quote_2',
      requirementId: 'req_2',
      sellerId: 'seller_456',
      commodity: { commodityName: 'Soybean' }, 
      quantity: 100,
      price: 4600,
      priceUnit: 'Qt',
      status: 'in_negotiation',
      displayStatus: 'in_negotiation',
      currentTurn: 'buyer',
      createdAt: new Date().toISOString()
    }
  ];
};

