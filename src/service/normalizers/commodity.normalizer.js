/**
 * Commodity Normalizer
 *
 * WHY THIS EXISTS:
 *   Backend sends 40+ keys per commodity object. UI needs ~15.
 *   Backend may use _id or id, commodityName or name, etc.
 *   This file is the ONLY place that handles backend key inconsistencies.
 *   All screens get a clean, guaranteed-shape object.
 *
 * USED BY:
 *   - MarketplaceScreen (listing cards)
 *   - TradesScreen (sell listings tab)
 *   - SellCommodities (seller's own listings)
 *   - CommodityDetailsScreen (detail view)
 *   - ReceivedOffersModal (commodity header info)
 *
 * BACKEND CONTRACT (as of June 2025, confirmed with backend team):
 *   id field  → _id (MongoDB ObjectId, always present)
 *   name      → commodityName
 *   price     → sellingPrice
 *   seller    → seller object OR sellerId object (populated)
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract moisture value from qualityParameters array */
function getMoisture(qualityParameters) {
  if (!Array.isArray(qualityParameters) || qualityParameters.length === 0) return null;
  const found = qualityParameters.find(
    p => typeof p?.parameterName === 'string' && p.parameterName.toLowerCase().includes('moisture'),
  );
  return found?.parameterValue ?? null;
}

/** Normalize qualityParameters array to consistent shape */
function normalizeQualityParams(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(p => p?.parameterName || p?.name)
    .map(p => ({
      name: String(p?.parameterName || p?.name || '').trim(),
      val:  String(p?.parameterValue || p?.val  || '').trim(),
    }))
    .filter(p => p.name && p.val);
}

/** Normalize tradeType — backend sends 'EX_WAREHOUSE', UI expects 'EX-Warehouse' */
function normalizeTradeType(raw) {
  const val = raw?.tradeType || raw?.deliveryType || null;
  if (!val) return null;
  if (val === 'EX_WAREHOUSE') return 'EX-Warehouse';
  if (['FOR', 'EX-Warehouse'].includes(val)) return val;
  return null;
}

/** Safe date string — strips time component */
function safeDate(dateStr) {
  if (!dateStr) return null;
  try { return String(dateStr).split('T')[0] || null; } catch { return null; }
}

// ─── Mock data for unit testing (used in __DEV__ only) ────────────────────────

/**
 * Run normalizeCommodity against representative mock shapes to verify
 * the normalizer handles all known backend variations correctly.
 *
 * Call normalizeCommodity.runTests() in Metro console during development.
 *
 * @returns {{ passed: number, failed: number, results: Array }}
 */
function runTests() {
  const testCases = [
    {
      label: 'Standard backend shape (_id, seller object populated)',
      input: {
        _id: 'abc123',
        commodityName: 'Wheat',
        type: 'Kanak',
        quantity: 100,
        unit: 'Ton',
        sellingPrice: 2450,
        sellingPriceUnit: 'Qt',
        weightType: 'Net Weight',
        commodityLocation: 'Indore',
        status: 'active',
        isNegotiable: true,
        tradeType: 'FOR',
        listingEndDate: '2025-12-31T00:00:00.000Z',
        qualityParameters: [{ parameterName: 'Moisture', parameterValue: '12%' }],
        seller: { _id: 's1', firstName: 'Ram', lastName: 'Kumar', role: 'FPO', shopName: 'Ram Traders' },
        commodityImages: [{ url: 'https://example.com/img1.jpg' }],
      },
      expect: { id: 'abc123', name: 'Wheat', price: 2450, location: 'Indore', moisture: '12%', sellerName: 'Ram Kumar' },
    },
    {
      label: 'Alternate shape (id instead of _id, sellerId populated)',
      input: {
        id: 'xyz789',
        commodityName: 'Soybean',
        quantity: 50,
        unit: 'MT',
        sellingPrice: 4820,
        commodityLocation: 'Bhopal',
        status: 'active',
        isNegotiable: false,
        sellerId: { _id: 's2', firstName: 'Suresh', role: 'Trader', shopname: 'Suresh Agro' },
      },
      expect: { id: 'xyz789', name: 'Soybean', price: 4820, shopName: 'Suresh Agro' },
    },
    {
      label: 'EX_WAREHOUSE delivery type normalization',
      input: {
        _id: 'del1',
        commodityName: 'Chana',
        sellingPrice: 5150,
        deliveryType: 'EX_WAREHOUSE',
        exWarehouseAddress: 'Plot 12, MIDC, Pune',
      },
      expect: { id: 'del1', deliveryType: 'EX-Warehouse', exWarehouseAddress: 'Plot 12, MIDC, Pune' },
    },
    {
      label: 'Missing id → returns null',
      input: { commodityName: 'Ghost', sellingPrice: 100 },
      expect: null,
    },
    {
      label: 'Null input → returns null',
      input: null,
      expect: null,
    },
    {
      label: '50 extra backend keys are stripped',
      input: {
        _id: 'strip1',
        commodityName: 'Rice',
        sellingPrice: 3000,
        // Extra backend keys UI never uses:
        __v: 0, internalCode: 'RC001', warehouseRef: 'WH99',
        approvalStatus: 'approved', adminNotes: 'verified', flaggedBy: null,
        createdBy: 'admin', updatedAt: '2025-01-01', deletedAt: null,
        isDeleted: false, bulkDiscountTiers: [], auditLog: [],
      },
      expect: { id: 'strip1', name: 'Rice' },
      assertNoKeys: ['__v', 'internalCode', 'warehouseRef', 'approvalStatus', 'adminNotes', 'bulkDiscountTiers'],
    },
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const tc of testCases) {
    const result = normalizeCommodity(tc.input);
    let ok = true;
    const errors = [];

    if (tc.expect === null) {
      ok = result === null;
      if (!ok) errors.push(`Expected null but got: ${JSON.stringify(result)}`);
    } else {
      for (const [key, expectedVal] of Object.entries(tc.expect)) {
        if (result?.[key] !== expectedVal) {
          ok = false;
          errors.push(`${key}: expected "${expectedVal}" got "${result?.[key]}"`);
        }
      }
    }

    // Verify extra keys were stripped
    if (tc.assertNoKeys && result) {
      for (const key of tc.assertNoKeys) {
        if (key in result || (result._fullItem && key in result._fullItem)) {
          ok = false;
          errors.push(`Key "${key}" should have been stripped but was present`);
        }
      }
    }

    if (ok) passed++;
    else failed++;

    results.push({ label: tc.label, ok, errors });
  }

  if (__DEV__) {
    console.log(`\n🧪 [commodity.normalizer] Tests: ${passed} passed, ${failed} failed`);
    results.forEach(r => {
      if (r.ok) {
        console.log(`  ✅ ${r.label}`);
      } else {
        console.log(`  ❌ ${r.label}`);
        r.errors.forEach(e => console.log(`     → ${e}`));
      }
    });
  }

  return { passed, failed, results };
}

// ─── Core Normalizer ──────────────────────────────────────────────────────────

/**
 * Normalize a raw backend commodity object into a clean UI-ready shape.
 *
 * @param {Object|null} raw - Raw API response item
 * @returns {Object|null} Clean commodity object, or null if invalid
 */
export function normalizeCommodity(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // id is required — without it we cannot identify the item
  const id = raw._id || raw.id;
  if (!id) return null;

  // ── Seller resolution ──
  // Backend may send seller as a populated object (raw.seller) OR as sellerId (populated)
  const seller =
    (raw.seller && typeof raw.seller === 'object')     ? raw.seller :
    (raw.sellerId && typeof raw.sellerId === 'object') ? raw.sellerId :
    {};

  const sellerId =
    seller._id || seller.id ||
    (typeof raw.sellerId === 'string' ? raw.sellerId : null) ||
    (typeof raw.seller   === 'string' ? raw.seller   : null) ||
    null;

  const sellerFirstName = seller.firstName || '';
  const sellerLastName  = seller.lastName  || '';
  const sellerName =
    (sellerFirstName || sellerLastName)
      ? `${sellerFirstName} ${sellerLastName}`.trim()
      : seller.name?.trim() || 'Unknown Seller';

  // shopname → shopName (backend inconsistency)
  const shopName = seller.shopName || seller.shopname || raw.shopName || raw.shopname || '';

  const sellerRole =
    seller.role && ['FPO', 'Trader', 'Miller', 'Corporate'].includes(seller.role)
      ? seller.role
      : 'Trader';

  // ── Quality parameters ──
  const qualityParams = normalizeQualityParams(raw.qualityParameters);
  const moisture      = getMoisture(raw.qualityParameters);

  // ── Delivery type ──
  const deliveryType = normalizeTradeType(raw);

  // ── Card shape (used in list views and detail views) ──
  const card = {
    // ── Clean / Normalized Keys ──
    id:             String(id),
    sellerId:       sellerId ? String(sellerId) : null,
    name:           String(raw.commodityName || '').trim() || '—',
    variety:        String(raw.type           || '').trim() || null,
    quantityLabel:  `${raw.quantity ?? '?'} ${raw.unit || ''}`.trim(),
    price:          raw.sellingPrice != null ? Number(raw.sellingPrice) : null,
    priceUnit:      String(raw.sellingPriceUnit || 'Qt'),
    location:       String(raw.commodityLocation || '').trim() || '—',
    moisture:       moisture ? String(moisture) : '—',
    deliveryType,
    isNegotiable:   raw.isNegotiable !== false,
    status:         String(raw.status || 'active'),
    sellerName,
    sellerRole,
    shopName:       String(shopName),
    listingEndDate: safeDate(raw.listingEndDate),
    images:         Array.isArray(raw.commodityImages) ? raw.commodityImages : [],
    createdAt:      raw.createdAt || null,

    // ── Legacy / Backwards Compatibility Keys (Flat Detail Properties) ──
    commodityName:          String(raw.commodityName || '').trim() || '—',
    type:                   String(raw.type || '').trim() || null,
    sellingPrice:           raw.sellingPrice != null ? Number(raw.sellingPrice) : null,
    sellingPriceUnit:       String(raw.sellingPriceUnit || 'Qt'),
    commodityLocation:      String(raw.commodityLocation || '').trim() || '—',
    commodityImages:        Array.isArray(raw.commodityImages) ? raw.commodityImages : [],
    quantity:               String(raw.quantity ?? ''),
    unit:                   String(raw.unit || ''),
    weightType:             String(raw.weightType || 'Net Weight'),
    weightTolerance:        String(raw.weightTolerance || '—'),
    billingAddress:         String(raw.billingAddress || '—'),
    exWarehouseAddress:     raw.exWarehouseAddress || null,
    paymentTimeline:        String(raw.paymentTimeline || '—'),
    remarks:                String(raw.remarks || ''),
    minimumAcceptablePrice: raw.minimumAcceptablePrice ?? null,
    maxNegotiationRounds:   raw.maxNegotiationRounds ?? 5,
    offerExpiryHours:       raw.offerExpiryHours ?? 24,
    escrowEnabled:          raw.escrowEnabled ?? false,
    buyerTransportAllowed:  raw.buyerTransportAllowed ?? false,
    grade:                  raw.grade || null,
    qualityParameters:      qualityParams,
    sellerRating:           typeof seller.rating === 'number' ? seller.rating : null,
    sellerCompletedTrades:  typeof seller.completedTrades === 'number' ? seller.completedTrades : null,
    isSellerVerified:       seller.isVerified ?? false,
    qualityReport:          Array.isArray(raw.qualityReport) ? raw.qualityReport : [],

    // ── Full detail shape (used in CommodityDetailsScreen, NegotiationDetailsScreen) ──
    // Kept nested so list rendering stays lightweight — detail screens spread this
    detail: {
      id:                    String(id),
      commodityName:         String(raw.commodityName   || '—'),
      type:                  String(raw.type            || '—'),
      quantity:              String(raw.quantity        ?? ''),
      unit:                  String(raw.unit            || ''),
      sellingPrice:          Number(raw.sellingPrice)   || 0,
      sellingPriceUnit:      String(raw.sellingPriceUnit || 'Qt'),
      weightType:            String(raw.weightType      || 'Net Weight'),
      listingEndDate:        safeDate(raw.listingEndDate) || '—',
      weightTolerance:       String(raw.weightTolerance  || '—'),
      billingAddress:        String(raw.billingAddress   || '—'),
      exWarehouseAddress:    raw.exWarehouseAddress      || null,
      paymentTimeline:       String(raw.paymentTimeline  || '—'),
      remarks:               String(raw.remarks          || ''),
      deliveryType,
      isNegotiable:          raw.isNegotiable !== false,
      minimumAcceptablePrice: raw.minimumAcceptablePrice ?? null,
      maxNegotiationRounds:  raw.maxNegotiationRounds   ?? 5,
      offerExpiryHours:      raw.offerExpiryHours       ?? 24,
      commodityLocation:     String(raw.commodityLocation || '—'),
      escrowEnabled:         raw.escrowEnabled           ?? false,
      buyerTransportAllowed: raw.buyerTransportAllowed   ?? false,
      grade:                 raw.grade                   || null,
      moisture:              moisture ? String(moisture) : '—',
      qualityParameters:     qualityParams,
      sellerId:              sellerId ? String(sellerId) : null,
      sellerName,
      shopName:              String(shopName),
      sellerRating:          typeof seller.rating          === 'number' ? seller.rating          : null,
      sellerCompletedTrades: typeof seller.completedTrades === 'number' ? seller.completedTrades : null,
      isSellerVerified:      seller.isVerified             ?? false,
      images:                Array.isArray(raw.commodityImages) ? raw.commodityImages : [],
      qualityReport:         Array.isArray(raw.qualityReport)  ? raw.qualityReport  : [],
    },
  };

  return card;
}

/**
 * Normalize a list of raw commodity objects.
 * Also handles response envelope unwrapping (res.data.commodities / res.commodities / etc.)
 *
 * @param {any} rawResponse - Full API response or raw array
 * @returns {Array} Clean commodity array (empty array on failure)
 */
export function normalizeCommodityList(rawResponse) {
  const list =
    rawResponse?.data?.commodities ||
    rawResponse?.commodities       ||
    rawResponse?.data?.docs        ||
    rawResponse?.docs              ||
    (Array.isArray(rawResponse?.data) ? rawResponse.data : null) ||
    (Array.isArray(rawResponse)       ? rawResponse      : []);

  return list.map(normalizeCommodity).filter(Boolean);
}

// Attach test runner for dev-time validation
normalizeCommodity.runTests = runTests;
