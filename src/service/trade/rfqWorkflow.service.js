import api from '../api';
import { USE_DUMMY_API } from '../../config';
const FORCE_DUMMY = true;

export const REQUIREMENT_STATUS = {
  OPEN: 'OPEN',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};

export const QUOTE_STATUS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  EXPIRED: 'Expired',
};

export const ORDER_STATUS = {
  PENDING_DISPATCH: 'Pending Dispatch',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
};

const MARKET_VISIBLE_STATUSES = [
  REQUIREMENT_STATUS.OPEN,
  REQUIREMENT_STATUS.PARTIALLY_FILLED,
];

const ACTIVE_QUOTE_STATUSES = [
  QUOTE_STATUS.PENDING,
];

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const currentBuyer = {
  _id: 'buyer_001',
  firstName: 'Raghav',
  lastName: 'Gupta',
  shopName: 'Raghav Procurement',
};

// A different dummy buyer to simulate "other user's" requirements in marketplace
const otherBuyer = {
  _id: 'buyer_other_999',
  firstName: 'Rajesh',
  lastName: 'Sharma',
  shopName: 'Sharma Traders',
};

const currentSeller = {
  _id: 'seller_001',
  firstName: 'Current',
  lastName: 'Seller',
  shopName: 'Seller Agro',
  rating: 4.6,
};

// currentBuyer ki ID — HomeScreen pe ye requirements dikhti hain
const CURRENT_BUYER_ID = 'buyer_001';

const dummyRequirements = [
  // ── Raghav (logged-in user) ke requirements — HomeScreen pe dikhenge ──
  {
    _id: 'req_001',
    id: 'req_001',
    commodity: 'Wheat',
    quantity: 50,
    remainingQuantity: 50,
    unit: 'Qt',
    expectedPrice: 2400,
    location: 'Indore, MP',
    grade: 'A',
    moisture: '11%',
    harvestYear: '2026',
    deliveryDate: '2026-07-15',
    remarks: 'Need clean, mill-ready stock.',
    buyerId: currentBuyer,
    status: REQUIREMENT_STATUS.OPEN,
    createdAt: nowIso(),
  },
  {
    _id: 'req_002',
    id: 'req_002',
    commodity: 'Soybean',
    quantity: 120,
    remainingQuantity: 70,
    unit: 'Qt',
    expectedPrice: 4550,
    location: 'Ujjain, MP',
    grade: 'FAQ',
    moisture: '10%',
    harvestYear: '2025',
    deliveryDate: '2026-07-20',
    remarks: 'Partial supply accepted.',
    buyerId: currentBuyer,
    status: REQUIREMENT_STATUS.PARTIALLY_FILLED,
    createdAt: nowIso(),
  },
  // ── Rajesh Sharma (otherBuyer) ke requirements — Marketplace pe dikhenge ──
  {
    _id: 'req_123',
    id: 'req_123',
    commodity: 'Wheat',
    quantity: 50,
    remainingQuantity: 50,
    unit: 'Qt',
    expectedPrice: 2400,
    location: 'Indore, MP',
    grade: 'A',
    moisture: '11%',
    harvestYear: '2026',
    deliveryDate: '2026-07-15',
    remarks: 'Need clean, mill-ready stock.',
    buyerId: otherBuyer,
    status: REQUIREMENT_STATUS.OPEN,
    createdAt: nowIso(),
  },
  {
    _id: 'req_124',
    id: 'req_124',
    commodity: 'Soybean',
    quantity: 120,
    remainingQuantity: 70,
    unit: 'Qt',
    expectedPrice: 4550,
    location: 'Ujjain, MP',
    grade: 'FAQ',
    moisture: '10%',
    harvestYear: '2025',
    deliveryDate: '2026-07-20',
    remarks: 'Partial supply accepted.',
    buyerId: otherBuyer,
    status: REQUIREMENT_STATUS.PARTIALLY_FILLED,
    createdAt: nowIso(),
  },
];

const dummyQuotes = [
  // ── Raghav ke req_001 (Wheat) pe received quotes — BuyerQuoteDashboard mein dikhenge ──
  {
    _id: 'quote_001',
    id: 'quote_001',
    requirementId: 'req_001',
    sellerId: currentSeller,
    sellerName: 'Suresh Patel',
    sellerRating: 4.3,
    offeredQuantity: 30,
    quotePrice: 2350,
    dispatchTime: '2 days',
    remarks: 'Grade A wheat, ready for dispatch.',
    status: QUOTE_STATUS.PENDING,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    _id: 'quote_002',
    id: 'quote_002',
    requirementId: 'req_001',
    sellerId: { _id: 'seller_002', firstName: 'Mohan', lastName: 'Verma', shopName: 'Verma Agro', rating: 4.8 },
    sellerName: 'Mohan Verma',
    sellerRating: 4.8,
    offeredQuantity: 50,
    quotePrice: 2380,
    dispatchTime: '4 days',
    remarks: 'Mill-ready stock, moisture 10.5%.',
    status: QUOTE_STATUS.PENDING,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  // ── Raghav ke req_002 (Soybean) pe received quotes ──
  {
    _id: 'quote_003',
    id: 'quote_003',
    requirementId: 'req_002',
    sellerId: currentSeller,
    sellerName: 'Suresh Patel',
    sellerRating: 4.3,
    offeredQuantity: 50,
    quotePrice: 4525,
    dispatchTime: '3 days',
    remarks: 'Can dispatch immediately after approval.',
    status: QUOTE_STATUS.PENDING,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    _id: 'quote_004',
    id: 'quote_004',
    requirementId: 'req_002',
    sellerId: { _id: 'seller_003', firstName: 'Ramesh', lastName: 'Yadav', shopName: 'Yadav Traders', rating: 4.1 },
    sellerName: 'Ramesh Yadav',
    sellerRating: 4.1,
    offeredQuantity: 70,
    quotePrice: 4480,
    dispatchTime: '5 days',
    remarks: 'FAQ grade, partial supply available.',
    status: QUOTE_STATUS.REJECTED,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  // ── Rajesh Sharma ke req_123/req_124 pe quotes (Marketplace mein Submit Quote se aate hain) ──
  {
    _id: 'quote_101',
    id: 'quote_101',
    requirementId: 'req_123',
    sellerId: currentSeller,
    sellerName: 'Suresh Patel',
    sellerRating: 4.3,
    offeredQuantity: 30,
    quotePrice: 2350,
    dispatchTime: '2 days',
    remarks: 'Grade A wheat, ready for dispatch.',
    status: QUOTE_STATUS.PENDING,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    _id: 'quote_103',
    id: 'quote_103',
    requirementId: 'req_124',
    sellerId: currentSeller,
    sellerName: 'Suresh Patel',
    sellerRating: 4.3,
    offeredQuantity: 50,
    quotePrice: 4525,
    dispatchTime: '3 days',
    remarks: 'Can dispatch immediately after approval.',
    status: QUOTE_STATUS.PENDING,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

const dummyPurchaseOrders = [
  // ── BuyerOrdersScreen: Raghav ka accepted PO (buyer side) ──
  {
    id: 'po_demo_001',
    _id: 'po_demo_001',
    quoteId: 'quote_003',
    requirementId: 'req_002',
    buyer: currentBuyer,
    seller: currentSeller,
    commodity: 'Soybean',
    approvedQuantity: 50,
    finalPrice: 4525,
    deliveryDetails: {
      location: 'Ujjain, MP',
      deliveryDate: '2026-07-20',
      dispatchTime: '3 days',
      unit: 'Qt',
    },
    orderStatus: ORDER_STATUS.PENDING_DISPATCH,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  // ── SellerOrdersScreen: Raghav ka dispatched PO (seller side) ──
  {
    id: 'po_demo_002',
    _id: 'po_demo_002',
    quoteId: 'quote_101',
    requirementId: 'req_123',
    buyer: otherBuyer,
    seller: currentSeller,
    commodity: 'Wheat',
    approvedQuantity: 30,
    finalPrice: 2350,
    deliveryDetails: {
      location: 'Indore, MP',
      deliveryDate: '2026-07-15',
      dispatchTime: '2 days',
      unit: 'Qt',
    },
    orderStatus: ORDER_STATUS.DISPATCHED,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];
const dummyNotifications = [];

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeRequirement = (payload = {}) => {
  const quantity = normalizeNumber(payload.quantity);
  const id = payload._id || payload.id || makeId('req');
  return {
    _id: id,
    id,
    commodity: String(payload.commodity || '').trim(),
    quantity,
    remainingQuantity: normalizeNumber(payload.remainingQuantity, quantity),
    unit: String(payload.unit || 'Qt').trim(),
    expectedPrice: normalizeNumber(payload.expectedPrice ?? payload.targetPrice),
    targetPrice: normalizeNumber(payload.expectedPrice ?? payload.targetPrice),
    location: String(payload.location || '').trim(),
    grade: String(payload.grade || '').trim(),
    moisture: String(payload.moisture || '').trim(),
    harvestYear: String(payload.harvestYear || '').trim(),
    deliveryDate: payload.deliveryDate || null,
    remarks: String(payload.remarks || '').trim(),
    buyerId: payload.buyerId || currentBuyer,
    status: payload.status || REQUIREMENT_STATUS.OPEN,
    createdAt: payload.createdAt || nowIso(),
    updatedAt: payload.updatedAt || nowIso(),
  };
};

const validateRequirementPayload = (payload = {}) => {
  const required = ['commodity', 'quantity', 'unit', 'expectedPrice', 'location'];
  const missing = required.filter((key) => payload[key] == null || String(payload[key]).trim() === '');
  if (missing.length) {
    throw new Error(`Missing requirement fields: ${missing.join(', ')}`);
  }
  if (normalizeNumber(payload.quantity) <= 0) throw new Error('Quantity must be greater than zero.');
  if (normalizeNumber(payload.expectedPrice) <= 0) throw new Error('Expected price must be greater than zero.');
};

const validateQuotePayload = (payload = {}, requirement) => {
  if (!requirement) throw new Error('Requirement not found.');
  if (!MARKET_VISIBLE_STATUSES.includes(requirement.status)) {
    throw new Error('Quotes can only be submitted for open requirements.');
  }
  const offeredQuantity = normalizeNumber(payload.offeredQuantity);
  const quotePrice = normalizeNumber(payload.quotePrice ?? payload.offeredPrice);
  if (offeredQuantity <= 0) throw new Error('Offered quantity must be greater than zero.');
  if (offeredQuantity > normalizeNumber(requirement.remainingQuantity)) {
    throw new Error('Offered quantity cannot exceed remaining quantity.');
  }
  if (quotePrice <= 0) throw new Error('Quote price must be greater than zero.');
};

const isPendingQuote = (quote) => quote?.status === QUOTE_STATUS.PENDING;

const findRequirement = (requirementId) =>
  dummyRequirements.find((item) => (item.id || item._id) === requirementId);

const requirementForQuote = (quote) => findRequirement(quote.requirementId) || {};

const toQuoteCard = (quote) => {
  const requirement = requirementForQuote(quote);
  return {
    id: quote.id || quote._id,
    _id: quote._id || quote.id,
    requirementId: quote.requirementId,
    sellerId: quote.sellerId,
    sellerName: quote.sellerName || `${quote.sellerId?.firstName || ''} ${quote.sellerId?.lastName || ''}`.trim() || 'Seller',
    sellerRating: quote.sellerRating ?? quote.sellerId?.rating ?? 0,
    commodity: { commodityName: requirement.commodity || 'Commodity' },
    quantity: quote.offeredQuantity,
    offeredQuantity: quote.offeredQuantity,
    price: quote.quotePrice,
    quotePrice: quote.quotePrice,
    priceUnit: requirement.unit || 'Qt',
    dispatchTime: quote.dispatchTime,
    status: quote.status,
    displayStatus: String(quote.status || QUOTE_STATUS.PENDING).toLowerCase(),
    currentTurn: 'buyer',
    createdAt: quote.createdAt,
    requirement,
  };
};

const enqueueNotification = ({ recipientRole, recipientId, title, message, type, entityId }) => {
  dummyNotifications.unshift({
    id: makeId('ntf'),
    recipientRole,
    recipientId,
    title,
    message,
    type,
    entityId,
    read: false,
    createdAt: nowIso(),
  });
};

const createPurchaseOrderFromQuote = (quote, requirement, acceptedQuantity) => {
  const id = makeId('po');
  const po = {
    id,
    _id: id,
    quoteId: quote.id || quote._id,
    requirementId: requirement.id || requirement._id,
    buyer: requirement.buyerId,
    seller: quote.sellerId,
    commodity: requirement.commodity,
    approvedQuantity: acceptedQuantity,
    finalPrice: quote.quotePrice,
    deliveryDetails: {
      location: requirement.location,
      deliveryDate: requirement.deliveryDate,
      dispatchTime: quote.dispatchTime,
      unit: requirement.unit,
    },
    orderStatus: ORDER_STATUS.PENDING_DISPATCH,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  dummyPurchaseOrders.unshift(po);
  return po;
};

export const rfqWorkflowService = {
  getRequirements: async ({ marketplaceOnly = false, excludeBuyerId = null } = {}) => {
    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.get('/requirements', {
        params: marketplaceOnly ? { status: MARKET_VISIBLE_STATUSES.join(',') } : undefined,
      });
      return response.data;
    }

    await delay(500);
    const requirements = dummyRequirements
      .map(normalizeRequirement)
      .filter((item) => {
        if (marketplaceOnly && !MARKET_VISIBLE_STATUSES.includes(item.status)) return false;
        if (excludeBuyerId) {
          const buyerId = item.buyerId?._id || item.buyerId;
          if (String(buyerId) === String(excludeBuyerId)) return false;
        }
        return true;
      });

    return { success: true, data: { requirements } };
  },

  createRequirement: async (payload) => {
    validateRequirementPayload(payload);

    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.post('/requirements', {
        ...payload,
        remainingQuantity: payload.quantity,
        status: REQUIREMENT_STATUS.OPEN,
      });
      return response.data;
    }

    await delay(600);
    const id = makeId('req');
    const requirement = normalizeRequirement({
      ...payload,
      _id: id,
      id,
      remainingQuantity: payload.quantity,
      buyerId: payload.buyerId || currentBuyer,
      status: REQUIREMENT_STATUS.OPEN,
    });
    dummyRequirements.unshift(requirement);
    return { success: true, data: requirement };
  },

  submitOrUpdateQuote: async (requirementId, payload = {}, sellerId = currentSeller._id) => {
    const requirement = findRequirement(requirementId);
    validateQuotePayload(payload, requirement);

    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.post(`/requirements/${requirementId}/quotes`, payload);
      return response.data;
    }

    await delay(600);
    const existing = dummyQuotes.find((quote) => (
      quote.requirementId === requirementId &&
      (quote.sellerId?._id || quote.sellerId) === sellerId &&
      ACTIVE_QUOTE_STATUSES.includes(quote.status)
    ));

    const quoteId = existing?._id || existing?.id || makeId('quote');
    const nextQuote = {
      ...(existing || {}),
      _id: quoteId,
      id: quoteId,
      requirementId,
      sellerId: existing?.sellerId || currentSeller,
      sellerName: 'Current Seller',
      sellerRating: 4.6,
      offeredQuantity: normalizeNumber(payload.offeredQuantity),
      quotePrice: normalizeNumber(payload.quotePrice ?? payload.offeredPrice),
      dispatchTime: String(payload.dispatchTime || '').trim(),
      remarks: String(payload.remarks ?? payload.notes ?? '').trim(),
      status: QUOTE_STATUS.PENDING,
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    if (existing) {
      Object.assign(existing, nextQuote);
    } else {
      dummyQuotes.unshift(nextQuote);
      enqueueNotification({
        recipientRole: 'buyer',
        recipientId: requirement.buyerId?._id || requirement.buyerId,
        title: 'New Quote Received',
        message: `${nextQuote.sellerName} quoted ${nextQuote.offeredQuantity} ${requirement.unit} for ${requirement.commodity}.`,
        type: 'NEW_QUOTE_RECEIVED',
        entityId: nextQuote.id,
      });
    }

    return {
      success: true,
      message: existing ? 'Quote updated successfully' : 'Quote submitted successfully',
      data: nextQuote,
    };
  },

  getSubmittedQuotes: async () => {
    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.get('/quotes/my-submitted');
      return response.data?.data || [];
    }
    await delay(350);
    return dummyQuotes.map(toQuoteCard);
  },

  getReceivedQuotes: async ({ requirementId = null } = {}) => {
    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.get('/quotes/received', { params: requirementId ? { requirementId } : undefined });
      return response.data?.data || [];
    }
    await delay(350);
    return dummyQuotes
      .filter((quote) => !requirementId || quote.requirementId === requirementId)
      .map(toQuoteCard);
  },

  acceptQuote: async (quoteId) => {
    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.post(`/quotes/${quoteId}/accept`);
      return response.data;
    }

    await delay(700);
    const quote = dummyQuotes.find((item) => (item.id || item._id) === quoteId);
    if (!quote) throw new Error('Quote not found.');
    if (!isPendingQuote(quote)) throw new Error('Only pending quotes can be accepted.');

    const requirement = findRequirement(quote.requirementId);
    if (!requirement) throw new Error('Requirement not found.');
    if (!MARKET_VISIBLE_STATUSES.includes(requirement.status)) {
      throw new Error('Requirement is not open for quote acceptance.');
    }

    const acceptedQuantity = normalizeNumber(quote.offeredQuantity);
    if (acceptedQuantity <= 0) throw new Error('Requirement is already filled.');
    if (acceptedQuantity > normalizeNumber(requirement.remainingQuantity)) {
      throw new Error('Quote quantity exceeds remaining requirement quantity.');
    }

    requirement.remainingQuantity = normalizeNumber(requirement.remainingQuantity) - acceptedQuantity;
    requirement.status = requirement.remainingQuantity > 0
      ? REQUIREMENT_STATUS.PARTIALLY_FILLED
      : REQUIREMENT_STATUS.FILLED;
    requirement.updatedAt = nowIso();

    quote.status = QUOTE_STATUS.ACCEPTED;
    quote.updatedAt = nowIso();

    if (requirement.status === REQUIREMENT_STATUS.FILLED) {
      dummyQuotes.forEach((item) => {
        if (item.requirementId === quote.requirementId && item.id !== quote.id && isPendingQuote(item)) {
          item.status = QUOTE_STATUS.EXPIRED;
          item.updatedAt = nowIso();
        }
      });
    }

    const purchaseOrder = createPurchaseOrderFromQuote(quote, requirement, acceptedQuantity);

    enqueueNotification({
      recipientRole: 'seller',
      recipientId: quote.sellerId?._id || quote.sellerId,
      title: 'Quote Accepted',
      message: `Your quote for ${requirement.commodity} was accepted.`,
      type: 'QUOTE_ACCEPTED',
      entityId: quote.id || quote._id,
    });

    return { success: true, data: { quote, requirement, purchaseOrder } };
  },

  rejectQuote: async (quoteId) => {
    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.post(`/quotes/${quoteId}/reject`);
      return response.data;
    }

    await delay(400);
    const quote = dummyQuotes.find((item) => (item.id || item._id) === quoteId);
    if (!quote) throw new Error('Quote not found.');
    if (!isPendingQuote(quote)) throw new Error('Only pending quotes can be rejected.');
    quote.status = QUOTE_STATUS.REJECTED;
    quote.updatedAt = nowIso();

    enqueueNotification({
      recipientRole: 'seller',
      recipientId: quote.sellerId?._id || quote.sellerId,
      title: 'Quote Rejected',
      message: 'Your quote was rejected by the buyer.',
      type: 'QUOTE_REJECTED',
      entityId: quote.id || quote._id,
    });

    return { success: true, data: quote };
  },

  getSellerOrders: async () => {
    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.get('/purchase-orders/seller');
      return response.data?.data || [];
    }
    await delay(350);
    return dummyPurchaseOrders;
  },

  getBuyerOrders: async () => {
    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.get('/purchase-orders/buyer');
      return response.data?.data || [];
    }
    await delay(350);
    return dummyPurchaseOrders;
  },

  updateOrderStatus: async (orderId, nextStatus) => {
    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.patch(`/purchase-orders/${orderId}/status`, { status: nextStatus });
      return response.data;
    }

    await delay(400);
    const order = dummyPurchaseOrders.find((item) => (item.id || item._id) === orderId);
    if (!order) throw new Error('Purchase order not found.');
    order.orderStatus = nextStatus;
    order.updatedAt = nowIso();

    if (nextStatus === ORDER_STATUS.DISPATCHED) {
      enqueueNotification({
        recipientRole: 'buyer',
        recipientId: order.buyer?._id || order.buyer,
        title: 'Dispatch Started',
        message: `${order.commodity} dispatch has started.`,
        type: 'DISPATCH_STARTED',
        entityId: order.id,
      });
    }

    if (nextStatus === ORDER_STATUS.DELIVERED) {
      enqueueNotification({
        recipientRole: 'buyer',
        recipientId: order.buyer?._id || order.buyer,
        title: 'Delivery Completed',
        message: `${order.commodity} delivery has been completed.`,
        type: 'DELIVERY_COMPLETED',
        entityId: order.id,
      });
    }

    return { success: true, data: order };
  },

  getNotifications: async () => {
    if (!USE_DUMMY_API && !FORCE_DUMMY) {
      const response = await api.get('/notifications');
      return response.data?.data || [];
    }
    await delay(200);
    return dummyNotifications;
  },
};
