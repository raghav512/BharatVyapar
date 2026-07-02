/**
 * Offer Normalizer
 *
 * WHY THIS EXISTS:
 *   Offer objects come from multiple endpoints with slightly different shapes.
 *   NegotiationDetailsScreen had 6+ lines of guessing just to find buyer/seller IDs.
 *   This normalizer consolidates all that into one place.
 *
 * USED BY:
 *   - TradesScreen (buy offers list)
 *   - ReceivedOffersModal (seller view of received offers)
 *   - NegotiationDetailsScreen (full negotiation thread)
 *
 * BACKEND CONTRACT (as of June 2025):
 *   id         → _id
 *   buyer      → buyerId (populated object) or buyerId (string ref)
 *   seller     → sellerId (populated object) or sellerId (string ref)
 *   rounds     → negotiationHistory array
 *   turn       → currentTurn ('buyer' | 'seller')
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract string ID from either an object ({ _id, id }) or a plain string */
function extractId(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return String(val._id || val.id || '');
  return null;
}

/** Build display name from a user object */
function buildUserName(userObj) {
  if (!userObj || typeof userObj !== 'object') return null;
  const first = userObj.firstName || '';
  const last  = userObj.lastName  || '';
  const full  = `${first} ${last}`.trim();
  return full || userObj.name?.trim() || null;
}

/** Normalize negotiation history rounds */
function normalizeRounds(raw, buyerId) {
  const rounds = raw?.negotiationHistory || raw?.rounds || [];
  if (!Array.isArray(rounds)) return [];

  return rounds.map((rd, index) => {
    // Determine proposedBy role — backend may use different field names
    const proposedBy =
      rd.proposedBy    ||
      rd.proposed_by   ||
      rd.role          ||
      // Fallback: compare offeredBy with known buyerId
      (rd.offeredBy && buyerId && String(rd.offeredBy) === String(buyerId) ? 'buyer' : 'seller');

    return {
      roundNumber: rd.roundNumber ?? rd.round_number ?? (index + 1),
      proposedBy,
      price:       Number(rd.price)    || 0,
      quantity:    Number(rd.quantity) || 0,
      remarks:     rd.remarks          || '',
      tradeType:   rd.tradeType        || null,
      isFinal:     rd.isFinal ?? rd.is_final ?? rd.isFinalOffer ?? false,
      createdAt:   rd.createdAt ?? rd.created_at ?? null,
    };
  });
}

// ─── Mock Test Data ────────────────────────────────────────────────────────────

/**
 * Verify normalizer handles all known backend response shapes.
 * Call normalizeOffer.runTests() in Metro console during development.
 */
function runTests() {
  const testCases = [
    {
      label: 'Standard offer with populated buyerId object',
      input: {
        _id: 'offer1',
        price: 2450,
        quantity: 10,
        status: 'pending',
        currentTurn: 'seller',
        roundCount: 1,
        isNegotiable: true,
        tradeType: 'FOR',
        createdAt: '2025-06-01T10:00:00Z',
        buyerId: {
          _id: 'buyer1',
          firstName: 'Rajesh',
          lastName: 'Sharma',
          shopName: 'Sharma Agro',
          state: 'MP',
          rating: 4.5,
          role: 'Trader',
        },
        commodityId: { _id: 'comm1' },
        negotiationHistory: [
          { roundNumber: 1, proposedBy: 'buyer', price: 2400, quantity: 10 },
        ],
      },
      expect: {
        id: 'offer1',
        price: 2450,
        status: 'pending',
        currentTurn: 'seller',
        buyerId: 'buyer1',
        buyerName: 'Sharma Agro (Rajesh Sharma)',
        buyerState: 'MP',
        commodityId: 'comm1',
      },
    },
    {
      label: 'Offer with buyer as plain string ref (not populated)',
      input: {
        _id: 'offer2',
        price: 3000,
        quantity: 20,
        status: 'countered',
        buyerId: 'buyerStringId',
        currentTurn: 'buyer',
      },
      expect: {
        id: 'offer2',
        price: 3000,
        status: 'countered',
        buyerId: 'buyerStringId',
        buyerName: 'Buyer', // fallback when buyer not populated
      },
    },
    {
      label: 'Missing _id → returns null',
      input: { price: 100, status: 'pending' },
      expect: null,
    },
    {
      label: 'Null input → returns null',
      input: null,
      expect: null,
    },
    {
      label: 'Rounds normalized correctly',
      input: {
        _id: 'offer3',
        price: 5000,
        buyerId: { _id: 'b3' },
        negotiationHistory: [
          { roundNumber: 1, proposed_by: 'buyer', price: 4800 },
          { roundNumber: 2, role: 'seller', price: 5100 },
        ],
      },
      expect: { id: 'offer3', roundsCount: 2 },
    },
    {
      label: 'shopName fallback from shopname (lowercase)',
      input: {
        _id: 'offer4',
        price: 2000,
        buyerId: { _id: 'b4', firstName: 'Mohan', shopname: 'Mohan Traders' },
      },
      expect: { id: 'offer4', buyerName: 'Mohan Traders (Mohan)' },
    },
    {
      label: '50 extra backend keys are stripped',
      input: {
        _id: 'strip2',
        price: 1000,
        buyerId: { _id: 'b5' },
        // Keys UI never needs:
        __v: 0, internalRef: 'XYZ', auditTrail: [], moderationFlag: false,
        paymentGatewayRef: 'pg123', riskScore: 0.1,
      },
      expect: { id: 'strip2', price: 1000 },
      assertNoKeys: ['__v', 'internalRef', 'auditTrail', 'moderationFlag', 'paymentGatewayRef'],
    },
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const tc of testCases) {
    const result = normalizeOffer(tc.input);
    let ok = true;
    const errors = [];

    if (tc.expect === null) {
      ok = result === null;
      if (!ok) errors.push(`Expected null but got: ${JSON.stringify(result)}`);
    } else {
      for (const [key, expectedVal] of Object.entries(tc.expect)) {
        if (key === 'roundsCount') {
          if (result?.rounds?.length !== expectedVal) {
            ok = false;
            errors.push(`rounds.length: expected ${expectedVal} got ${result?.rounds?.length}`);
          }
        } else if (result?.[key] !== expectedVal) {
          ok = false;
          errors.push(`${key}: expected "${expectedVal}" got "${result?.[key]}"`);
        }
      }
    }

    if (tc.assertNoKeys && result) {
      for (const key of tc.assertNoKeys) {
        if (key in result) {
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
    console.log(`\n🧪 [offer.normalizer] Tests: ${passed} passed, ${failed} failed`);
    results.forEach(r => {
      if (r.ok) console.log(`  ✅ ${r.label}`);
      else {
        console.log(`  ❌ ${r.label}`);
        r.errors.forEach(e => console.log(`     → ${e}`));
      }
    });
  }

  return { passed, failed, results };
}

// ─── Core Normalizer ──────────────────────────────────────────────────────────

/**
 * Normalize a raw backend offer object into a clean UI-ready shape.
 *
 * @param {Object|null} raw - Raw API offer object
 * @returns {Object|null} Clean offer, or null if invalid
 */
export function normalizeOffer(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw._id || raw.id;
  if (!id) return null;

  // ── Buyer resolution ──
  const buyerObj  = (raw.buyerId  && typeof raw.buyerId  === 'object') ? raw.buyerId  :
                    (raw.buyer    && typeof raw.buyer    === 'object') ? raw.buyer    : null;
  const buyerIdStr = buyerObj ? extractId(buyerObj) : extractId(raw.buyerId || raw.buyer);
  const buyerId   = buyerObj ? { ...buyerObj, _id: buyerIdStr, id: buyerIdStr } : buyerIdStr;

  const buyerFullName = buildUserName(buyerObj);
  const shopName      = buyerObj?.shopName || buyerObj?.shopname || '';
  // Display: "ShopName (Full Name)" if shop exists, else full name, else 'Buyer'
  const buyerName     = shopName && buyerFullName
    ? `${shopName} (${buyerFullName})`
    : buyerFullName || shopName || 'Buyer';

  // ── Seller resolution ──
  const sellerObj = (raw.sellerId && typeof raw.sellerId === 'object') ? raw.sellerId :
                    (raw.seller   && typeof raw.seller   === 'object') ? raw.seller   : null;
  const sellerIdStr = sellerObj ? extractId(sellerObj) : extractId(raw.sellerId || raw.seller);
  const sellerId  = sellerObj ? { ...sellerObj, _id: sellerIdStr, id: sellerIdStr } : sellerIdStr;

  // ── Commodity resolution ──
  const commObj      = (raw.commodityId && typeof raw.commodityId === 'object') ? raw.commodityId :
                       (raw.commodity   && typeof raw.commodity   === 'object') ? raw.commodity   : null;
  const commodityId  = commObj ? extractId(commObj) : extractId(raw.commodityId || raw.commodity);

  // ── Negotiation rounds ──
  const rounds = normalizeRounds(raw, buyerIdStr);

  // Resolve currentTurn using fallback logic similar to NegotiationDetailsScreen if missing from backend
  let resolvedTurn = raw.currentTurn || raw.current_turn || null;
  if (!resolvedTurn) {
    if (rounds.length === 0) {
      resolvedTurn = 'seller';
    } else {
      const lastRound = rounds[rounds.length - 1];
      const lastSender = lastRound.proposedBy || lastRound.role;
      if (lastSender === 'buyer') {
        resolvedTurn = 'seller';
      } else if (lastSender === 'seller') {
        resolvedTurn = 'buyer';
      } else {
        resolvedTurn = 'seller';
      }
    }
  }

  return {
    id:            String(id),
    price:         Number(raw.price)    || 0,
    quantity:      Number(raw.quantity) || 0,
    status:        String(raw.status    || 'pending').toLowerCase(),
    currentTurn:   resolvedTurn,
    roundCount:    raw.roundCount       ?? 0,
    maxRounds:     raw.maxNegotiationRounds ?? 5,
    tradeType:     raw.tradeType        || 'FOR',
    remarks:       raw.remarks          || '',
    isNegotiable:  raw.isNegotiable !== false,
    isFinalOffer:  raw.isFinalOffer     ?? false,
    dealId:        extractId(raw.dealId || raw.deal),
    createdAt:     raw.createdAt        || null,
    expiresAt:     raw.expiresAt        || raw.expiry || null,

    // Buyer info (safe to use directly in UI)
    buyerId,
    buyerName,
    buyerRating:   buyerObj?.rating  ?? null,
    buyerState:    buyerObj?.state   || '',
    buyerRole:     buyerObj?.role    || null,

    // Seller info
    sellerId,

    // Commodity ref
    commodityId,

    // Commodity details (nested object resolved to support both new and legacy keys)
    commodity: commObj ? {
      ...commObj,
      id:                    extractId(commObj),
      name:                  String(commObj.commodityName || commObj.name || '').trim() || '—',
      commodityName:         String(commObj.commodityName || commObj.name || '').trim() || '—',
      type:                  String(commObj.type          || commObj.variety || '').trim() || null,
      variety:               String(commObj.type          || commObj.variety || '').trim() || null,
      grade:                 commObj.grade || null,
      unit:                  String(commObj.unit || ''),
      isNegotiable:          commObj.isNegotiable !== false,
      maxNegotiationRounds:  commObj.maxNegotiationRounds ?? 5,
      sellerId:              extractId(commObj.sellerId || commObj.seller),
    } : null,

    // Negotiation thread
    rounds,
  };
}

/**
 * Normalize a list of raw offer objects.
 * Handles response envelope unwrapping.
 *
 * @param {any} rawResponse - Full API response or array
 * @returns {Array} Clean offer array
 */
export function normalizeOfferList(rawResponse) {
  const list =
    rawResponse?.data?.offers  ||
    rawResponse?.offers        ||
    rawResponse?.data?.data    ||
    (Array.isArray(rawResponse?.data) ? rawResponse.data : null) ||
    (Array.isArray(rawResponse)       ? rawResponse      : []);

  return list.map(normalizeOffer).filter(Boolean);
}

// Attach test runner for dev-time validation
normalizeOffer.runTests = runTests;
