import { USE_DUMMY_API } from '../../config';

// Simulate network delay
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const dummyRequirements = [
  {
    _id: 'req_123',
    commodity: 'Wheat',
    quantity: 50,
    targetPrice: 2400,
    location: 'Indore, MP',
    buyerId: {
      _id: 'buyer_001',
      firstName: 'Rajesh',
      lastName: 'Sharma',
      shopName: 'Sharma Traders',
    },
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
];

export const requirementService = {
  /**
   * Fetch all active buyer requirements
   */
  getAllRequirements: async () => {
    if (USE_DUMMY_API) {
      await delay(800);
      return {
        success: true,
        data: {
          requirements: dummyRequirements,
        },
      };
    }

    // TODO: replace with real API — axios.get('/api/v1/requirements')
  },

  /**
   * Submit a new buyer requirement
   * @param {Object} payload 
   */
  submitRequirement: async (payload) => {
    if (USE_DUMMY_API) {
      await delay(1000);
      const newReq = {
        _id: `req_${Math.random().toString(36).substring(2, 9)}`,
        ...payload,
        buyerId: {
          _id: 'buyer_001',
          firstName: 'Current',
          lastName: 'User',
        },
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      dummyRequirements.push(newReq);
      return {
        success: true,
        data: newReq,
      };
    }

    // TODO: replace with real API — axios.post('/api/v1/requirements', payload)
  },
};
