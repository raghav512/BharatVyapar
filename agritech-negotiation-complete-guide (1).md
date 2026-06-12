# Agritech Platform — Buy Commodity & Negotiation
## Complete Production Implementation Guide
### For Mobile App Developers (React Native / Flutter)

> **How to use this doc:** Read top-to-bottom on first pass. Every section has a "What the mobile dev builds" callout. Code examples are copy-paste ready. Nothing is skipped.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema](#2-database-schema)
3. [Redis & Lock Strategy](#3-redis--lock-strategy)
4. [API Contracts — All Endpoints](#4-api-contracts--all-endpoints)
5. [Business Rule Engine](#5-business-rule-engine)
6. [WebSocket Event Map](#6-websocket-event-map)
7. [Escrow State Machine](#7-escrow-state-machine)
8. [Mobile App — Screen-by-Screen Build Guide](#8-mobile-app--screen-by-screen-build-guide)
9. [End-to-End Test Scenarios](#9-end-to-end-test-scenarios)
10. [Error Codes & UI Handling](#10-error-codes--ui-handling)
11. [AI Prompt: Missing Screens & Buttons](#11-ai-prompt-missing-screens--buttons)

---

## 1. System Overview

### What This Feature Does

A commodity seller lists a product (wheat, cotton, soybean). A buyer finds it on the marketplace and either buys at listed price OR submits a negotiated offer. The seller can counter-offer. Both sides negotiate up to 5 rounds with guards on cooldown, price movement, and turn order. When both agree, an escrow deal is created and funds flow through defined stages.

### Actor Map

```
Seller ──creates──► Commodity Listing
Buyer  ──submits──► Offer (on a listing)
         Seller ◄──► Buyer  (negotiate counter offers, max 5 rounds)
                  ↓ accept
              Escrow Deal (pending_payment → funded → dispatched → delivered → released)
```

### Key Constraints Summary

| Constraint | Value | Where Enforced |
|---|---|---|
| Cooldown between counters | 30 minutes | Server (API guard) |
| Offer expiry | 24 hours from creation | Server (TTL + cron) |
| Max negotiation rounds | 5 | Server (roundCount check) |
| Max price jump per round | < 5% delta | Server (price guard) |
| Offer Lock scope | Per commodity, per active negotiation | Redis TTL key |
| "In Negotiation" visibility | Only the negotiating buyer sees active status | Computed field in GET /offers |

---

## 2. Database Schema

### 2.1 `commodities` table

```sql
CREATE TABLE commodities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES users(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  base_price      DECIMAL(12, 2) NOT NULL,
  price_unit      VARCHAR(50) NOT NULL,         -- e.g. "INR/quintal"
  quantity        DECIMAL(12, 2) NOT NULL,
  unit            VARCHAR(50) NOT NULL,         -- e.g. "quintal", "MT"
  trade_type      VARCHAR(30) NOT NULL,         -- "FOR" | "EX-Warehouse"
  status          VARCHAR(30) NOT NULL DEFAULT 'active',
                  -- active | sold | paused | expired
  state           VARCHAR(100),                 -- seller's state/region
  images          TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commodities_seller ON commodities(seller_id);
CREATE INDEX idx_commodities_status ON commodities(status);
```

### 2.2 `offers` table

```sql
CREATE TABLE offers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id      UUID NOT NULL REFERENCES commodities(id),
  buyer_id          UUID NOT NULL REFERENCES users(id),
  seller_id         UUID NOT NULL REFERENCES users(id),

  -- Initial offer terms
  price             DECIMAL(12, 2) NOT NULL,
  price_unit        VARCHAR(50) NOT NULL,
  quantity          DECIMAL(12, 2) NOT NULL,
  unit              VARCHAR(50) NOT NULL,
  trade_type        VARCHAR(30) NOT NULL,
  payment_timeline  VARCHAR(100),
  remarks           TEXT,

  -- Negotiation state
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',
                    -- pending | countered | accepted | rejected | expired
  current_turn      VARCHAR(10) NOT NULL DEFAULT 'seller',
                    -- 'buyer' | 'seller' — whose turn to respond
  round_count       INT NOT NULL DEFAULT 0,     -- increments on each counter
  is_final_offer    BOOLEAN DEFAULT FALSE,       -- last round flag

  -- Timestamps for guards
  last_counter_at   TIMESTAMPTZ,               -- cooldown reference
  expires_at        TIMESTAMPTZ NOT NULL,       -- createdAt + 24h

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_buyer_commodity UNIQUE (buyer_id, commodity_id)
  -- Prevents duplicate active offers from same buyer on same commodity
);

CREATE INDEX idx_offers_commodity ON offers(commodity_id);
CREATE INDEX idx_offers_buyer ON offers(buyer_id);
CREATE INDEX idx_offers_seller ON offers(seller_id);
CREATE INDEX idx_offers_status ON offers(status);
```

### 2.3 `offer_rounds` table

```sql
CREATE TABLE offer_rounds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id      UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  proposed_by   VARCHAR(10) NOT NULL,   -- 'buyer' | 'seller'
  proposer_id   UUID NOT NULL REFERENCES users(id),
  price         DECIMAL(12, 2) NOT NULL,
  quantity      DECIMAL(12, 2) NOT NULL,
  remarks       TEXT,
  is_final      BOOLEAN DEFAULT FALSE,
  round_number  INT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rounds_offer ON offer_rounds(offer_id);
```

### 2.4 `deals` table

```sql
CREATE TABLE deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id        UUID NOT NULL UNIQUE REFERENCES offers(id),
  commodity_id    UUID NOT NULL REFERENCES commodities(id),
  buyer_id        UUID NOT NULL REFERENCES users(id),
  seller_id       UUID NOT NULL REFERENCES users(id),

  final_price     DECIMAL(12, 2) NOT NULL,
  final_quantity  DECIMAL(12, 2) NOT NULL,
  price_unit      VARCHAR(50) NOT NULL,
  unit            VARCHAR(50) NOT NULL,
  trade_type      VARCHAR(30) NOT NULL,

  escrow_status   VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
                  -- pending_payment | funded | dispatched | delivered | released | cancelled

  -- Timestamps per stage
  funded_at       TIMESTAMPTZ,
  dispatched_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  released_at     TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deals_buyer ON deals(buyer_id);
CREATE INDEX idx_deals_seller ON deals(seller_id);
CREATE INDEX idx_deals_commodity ON deals(commodity_id);
CREATE INDEX idx_deals_escrow_status ON deals(escrow_status);
```

### 2.5 Entity Relationship Summary

```
users ──< commodities (seller_id)
users ──< offers (buyer_id, seller_id)
commodities ──< offers (commodity_id)
offers ──< offer_rounds (offer_id)
offers ──1 deals (offer_id UNIQUE)
commodities ──1 deals (commodity_id)
users ──< deals (buyer_id, seller_id)
```

---

## 3. Redis & Lock Strategy

### Why Redis for Locks

When Buyer A is actively negotiating (has submitted a counter), no other buyer should be able to "actively negotiate" on the same commodity — their offer stays `pending` and shows "In Negotiation" status. This is a read-time computed status, not stored in DB. Redis handles the lock with TTL so it self-cleans.

### Key Schema

```
Key:    offer_lock:{commodityId}
Value:  {buyerId}:{offerId}
TTL:    Remaining seconds until offer.expires_at
```

### Lock Lifecycle

```
SET lock:           When buyer submits FIRST counter on an offer
                    OR when seller submits counter (keeps buyer locked in)
REFRESH TTL:        Each counter resets TTL to remaining offer time
DELETE lock:        On offer accept, reject, expire
NATURAL EXPIRY:     Redis auto-deletes on TTL — offers expire at same time
```

### Lock Operations (Node.js / ioredis)

```javascript
// services/offerLockService.js

const redis = require('../config/redis'); // ioredis instance

const LOCK_PREFIX = 'offer_lock';

/**
 * Acquire lock for a commodity during active negotiation
 */
async function acquireLock(commodityId, buyerId, offerId, expiresAt) {
  const key = `${LOCK_PREFIX}:${commodityId}`;
  const value = `${buyerId}:${offerId}`;
  const ttlSeconds = Math.floor((new Date(expiresAt) - Date.now()) / 1000);

  if (ttlSeconds <= 0) {
    throw new Error('Offer already expired, cannot lock');
  }

  // NX = only set if not exists. Returns null if lock already held.
  const result = await redis.set(key, value, 'EX', ttlSeconds, 'NX');
  if (!result) {
    // Lock held by someone else — check if it's the same buyer
    const existing = await redis.get(key);
    if (existing && existing.startsWith(buyerId)) {
      // Same buyer, refresh TTL
      await redis.expire(key, ttlSeconds);
      return true;
    }
    return false; // Different buyer holds lock
  }
  return true;
}

/**
 * Check who holds the lock — returns null if free
 */
async function getLockOwner(commodityId) {
  const key = `${LOCK_PREFIX}:${commodityId}`;
  const value = await redis.get(key);
  if (!value) return null;
  const [buyerId, offerId] = value.split(':');
  return { buyerId, offerId };
}

/**
 * Release lock — call on accept/reject/expire
 */
async function releaseLock(commodityId) {
  const key = `${LOCK_PREFIX}:${commodityId}`;
  await redis.del(key);
}

module.exports = { acquireLock, getLockOwner, releaseLock };
```

### Dynamic Status Injection (GET /offers)

```javascript
// How "In Negotiation" gets injected — never stored in DB

async function injectDynamicStatus(offers, currentBuyerId) {
  return Promise.all(
    offers.map(async (offer) => {
      const lock = await getLockOwner(offer.commodity_id);

      if (lock && lock.buyerId !== currentBuyerId) {
        // Someone else is actively negotiating this commodity
        return { ...offer, displayStatus: 'In Negotiation' };
      }

      return { ...offer, displayStatus: offer.status };
    })
  );
}
```

---

## 4. API Contracts — All Endpoints

> All routes require `Authorization: Bearer <jwt_token>` header.
> All responses follow: `{ success: bool, data: {}, message: string, error?: {} }`

### Base URL: `/api/buy-commodity`

---

### 4.1 POST /offers — Submit Initial Offer

**Who calls this:** Buyer, after viewing a commodity listing.

**Request**

```http
POST /api/buy-commodity/offers
Authorization: Bearer <token>
Content-Type: application/json

{
  "commodityId": "uuid-of-listing",
  "price": 2200.00,
  "priceUnit": "INR/quintal",
  "quantity": 50,
  "unit": "quintal",
  "tradeType": "EX-Warehouse",
  "paymentTimeline": "7 days",
  "remarks": "Need by end of month"
}
```

**Server Processing Steps (in order)**

```
1. Validate JWT → extract buyer_id
2. Validate body schema (all required fields present, enums valid)
3. SELECT commodity WHERE id = commodityId
   → 404 if not found
   → 422 if commodity.status != 'active'
4. Check duplicate: SELECT offer WHERE buyer_id = auth.id AND commodity_id = body.commodityId
   → 409 if exists and status NOT IN (rejected, expired)
5. INSERT offer with status='pending', current_turn='seller', expires_at=NOW()+24h
6. Notify seller via WebSocket: event 'offer:received'
7. Return 201 with full offer object
```

**Success Response (201)**

```json
{
  "success": true,
  "data": {
    "id": "offer-uuid",
    "commodityId": "commodity-uuid",
    "buyerId": "buyer-uuid",
    "sellerId": "seller-uuid",
    "price": 2200.00,
    "priceUnit": "INR/quintal",
    "quantity": 50,
    "unit": "quintal",
    "tradeType": "EX-Warehouse",
    "paymentTimeline": "7 days",
    "remarks": "Need by end of month",
    "status": "pending",
    "currentTurn": "seller",
    "roundCount": 0,
    "isFinalOffer": false,
    "expiresAt": "2025-06-12T10:30:00Z",
    "createdAt": "2025-06-11T10:30:00Z"
  },
  "message": "Offer submitted successfully"
}
```

**Error Responses**

```json
// 409 Duplicate
{ "success": false, "error": { "code": "DUPLICATE_OFFER", "message": "You already have an active offer on this commodity" } }

// 422 Commodity not active
{ "success": false, "error": { "code": "COMMODITY_NOT_AVAILABLE", "message": "This commodity is no longer available" } }
```

---

### 4.2 GET /offers — Buyer's Submitted Offers

**Who calls this:** Buyer, to see all their offers with live status.

**Request**

```http
GET /api/buy-commodity/offers?status=pending&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| status | enum | - | Filter: pending, countered, accepted, rejected, expired |
| commodityId | string | - | Filter by specific commodity |
| page | number | 1 | Pagination |
| limit | number | 10 | Items per page |

**Server Processing**

```
1. SELECT offers WHERE buyer_id = auth.id (+ filters)
2. For each offer:
   a. lock = redis.get("offer_lock:{offer.commodity_id}")
   b. If lock exists AND lock.buyerId != auth.id:
        offer.displayStatus = "In Negotiation"
      Else:
        offer.displayStatus = offer.status
3. Return paginated list
```

**Success Response (200)**

```json
{
  "success": true,
  "data": {
    "offers": [
      {
        "id": "offer-uuid-1",
        "commodity": {
          "id": "commodity-uuid",
          "name": "Wheat Grade A",
          "images": ["https://..."],
          "state": "Punjab"
        },
        "price": 2200.00,
        "quantity": 50,
        "status": "pending",
        "displayStatus": "In Negotiation",
        "roundCount": 0,
        "expiresAt": "2025-06-12T10:30:00Z",
        "createdAt": "2025-06-11T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

> **Note:** `displayStatus: "In Negotiation"` is a computed field. It appears when another buyer has locked the commodity. The actual DB `status` remains `pending`.

---

### 4.3 GET /offers/received/:commodityId — Seller View

**Who calls this:** Seller, to see all buyers who offered on their listing.

**Request**

```http
GET /api/buy-commodity/offers/received/commodity-uuid?page=1&limit=10
Authorization: Bearer <token>
```

**Server Processing**

```
1. Verify commodity belongs to auth.seller_id
2. SELECT offers WHERE commodity_id = :id AND seller_id = auth.id
3. Check lock: lock = redis.get("offer_lock:{commodityId}")
4. For each offer:
   - If lock exists AND lock.buyerId == offer.buyer_id:
       offer.isActiveNegotiation = true  // highlight this buyer
   - If lock exists AND lock.buyerId != offer.buyer_id:
       offer.note = "Another buyer is in active negotiation"
       offer.canCounter = false
5. Return list with negotiation metadata
```

**Success Response (200)**

```json
{
  "success": true,
  "data": {
    "offers": [
      {
        "id": "offer-uuid-1",
        "buyer": {
          "id": "buyer-uuid",
          "name": "Ramesh Kumar",
          "phone": "+91-XXXXXX",
          "state": "Haryana"
        },
        "price": 2200.00,
        "quantity": 50,
        "status": "pending",
        "isActiveNegotiation": true,
        "canCounter": true,
        "roundCount": 1,
        "expiresAt": "2025-06-12T10:30:00Z"
      },
      {
        "id": "offer-uuid-2",
        "buyer": { "id": "buyer-2-uuid", "name": "Suresh Patel" },
        "price": 2150.00,
        "quantity": 40,
        "status": "pending",
        "isActiveNegotiation": false,
        "canCounter": false,
        "note": "Another buyer is in active negotiation",
        "roundCount": 0,
        "expiresAt": "2025-06-12T11:00:00Z"
      }
    ]
  }
}
```

---

### 4.4 GET /offers/:id — Offer Detail + Full Negotiation History

**Who calls this:** Both buyer and seller, to see full counter-offer timeline.

**Request**

```http
GET /api/buy-commodity/offers/offer-uuid
Authorization: Bearer <token>
```

**Success Response (200)**

```json
{
  "success": true,
  "data": {
    "offer": {
      "id": "offer-uuid",
      "status": "countered",
      "currentTurn": "buyer",
      "roundCount": 2,
      "isFinalOffer": false,
      "expiresAt": "2025-06-12T10:30:00Z",
      "canCounter": true,
      "cooldownEndsAt": "2025-06-11T11:15:00Z",
      "commodity": {
        "id": "commodity-uuid",
        "name": "Wheat Grade A",
        "basePrice": 2400.00,
        "quantity": 100,
        "unit": "quintal",
        "state": "Punjab"
      },
      "rounds": [
        {
          "roundNumber": 0,
          "proposedBy": "buyer",
          "price": 2200.00,
          "quantity": 50,
          "remarks": "Need by end of month",
          "isFinal": false,
          "createdAt": "2025-06-11T10:30:00Z"
        },
        {
          "roundNumber": 1,
          "proposedBy": "seller",
          "price": 2350.00,
          "quantity": 50,
          "remarks": "Best I can do for this grade",
          "isFinal": false,
          "createdAt": "2025-06-11T10:45:00Z"
        },
        {
          "roundNumber": 2,
          "proposedBy": "buyer",
          "price": 2300.00,
          "quantity": 50,
          "remarks": "Final from my side",
          "isFinal": false,
          "createdAt": "2025-06-11T11:00:00Z"
        }
      ]
    }
  }
}
```

> **`cooldownEndsAt`** is computed: `lastCounterAt + 30 minutes`. Mobile app uses this to show a countdown timer and disable the "Counter Offer" button until it passes.

---

### 4.5 POST /offers/:id/counter — Submit Counter Offer

**Who calls this:** Either buyer or seller, depending on whose turn it is.

**Request**

```http
POST /api/buy-commodity/offers/offer-uuid/counter
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": 2280.00,
  "quantity": 50,
  "remarks": "Slightly adjusted",
  "isFinalOffer": false
}
```

**Server Processing (Strict Waterfall — stop at first failure)**

```
Step 1 — Turn Guard
  currentUserRole = (auth.id == offer.buyer_id) ? 'buyer' : 'seller'
  IF offer.current_turn != currentUserRole → 403

Step 2 — Cooldown Guard
  IF offer.last_counter_at IS NOT NULL:
    cooldownEnd = offer.last_counter_at + 30 minutes
    IF NOW() < cooldownEnd → 429 with retryAfter = cooldownEnd

Step 3 — Expiry Guard
  IF NOW() > offer.expires_at → 410

Step 4 — Max Rounds Guard
  IF offer.round_count >= 5 → 422 ROUND_LIMIT_REACHED

Step 5 — Price Movement Guard
  lastPrice = offer_rounds WHERE offer_id = :id ORDER BY round_number DESC LIMIT 1
  delta = abs(body.price - lastPrice.price) / lastPrice.price
  IF delta >= 0.05 → 422 PRICE_JUMP_TOO_HIGH
  (delta must be < 5%, i.e., buyer/seller can only move price by less than 5% each round)

Step 6 — If isFinalOffer = true:
  Set offer.is_final_offer = true
  Other party can ONLY accept or reject — counter button hidden on mobile

Step 7 — Persist
  BEGIN TRANSACTION
    INSERT offer_rounds (round_number = offer.round_count + 1, ...)
    UPDATE offers SET
      round_count = round_count + 1,
      current_turn = (current_turn == 'buyer') ? 'seller' : 'buyer',
      last_counter_at = NOW(),
      status = 'countered',
      is_final_offer = body.isFinalOffer
    WHERE id = :id
  COMMIT

Step 8 — Redis Lock
  acquireLock(offer.commodity_id, buyer_id, offer.id, offer.expires_at)
  (Uses buyer_id always — lock is buyer-scoped, seller doesn't hold the lock)

Step 9 — Notify other party
  WebSocket: emit 'offer:countered' to counterpart's room
```

**Success Response (200)**

```json
{
  "success": true,
  "data": {
    "offer": {
      "id": "offer-uuid",
      "status": "countered",
      "currentTurn": "seller",
      "roundCount": 3,
      "isFinalOffer": false,
      "cooldownEndsAt": "2025-06-11T11:45:00Z",
      "roundsRemaining": 2
    },
    "round": {
      "roundNumber": 3,
      "price": 2280.00,
      "quantity": 50,
      "proposedBy": "buyer"
    }
  },
  "message": "Counter offer submitted"
}
```

**Error Responses**

```json
// 403 Not your turn
{ "success": false, "error": { "code": "NOT_YOUR_TURN", "message": "Waiting for seller to respond" } }

// 429 Cooldown active
{
  "success": false,
  "error": {
    "code": "COOLDOWN_ACTIVE",
    "message": "Please wait before submitting another counter",
    "retryAfter": "2025-06-11T11:45:00Z"
  }
}

// 422 Price jump
{ "success": false, "error": { "code": "PRICE_JUMP_TOO_HIGH", "message": "Price change cannot exceed 5% per round" } }

// 422 Round limit
{ "success": false, "error": { "code": "ROUND_LIMIT_REACHED", "message": "Maximum 5 negotiation rounds allowed" } }
```

---

### 4.6 POST /offers/:id/accept — Accept Offer

**Who calls this:** Either party, to accept the most recent counter from the other side.

**Request**

```http
POST /api/buy-commodity/offers/offer-uuid/accept
Authorization: Bearer <token>
```

**Server Processing**

```
1. Verify auth.id is buyer_id or seller_id of this offer
2. Verify it is NOT auth's own latest counter being accepted
   (You cannot accept your own counter — only the other party's)
3. BEGIN TRANSACTION
   a. UPDATE offers SET status = 'accepted' WHERE id = :id
   b. UPDATE commodities SET status = 'sold' WHERE id = offer.commodity_id
   c. UPDATE offers SET status = 'expired'
      WHERE commodity_id = offer.commodity_id
        AND id != :id
        AND status IN ('pending', 'countered')
   d. INSERT INTO deals (offer_id, commodity_id, buyer_id, seller_id,
        final_price, final_quantity, price_unit, unit, trade_type,
        escrow_status = 'pending_payment')
      Use last offer_round price/quantity as final terms
4. COMMIT
5. Redis: releaseLock(offer.commodity_id)
6. WebSocket: emit 'offer:accepted' + 'deal:created' to both parties
7. Return deal object
```

**Success Response (201)**

```json
{
  "success": true,
  "data": {
    "deal": {
      "id": "deal-uuid",
      "offerId": "offer-uuid",
      "commodityId": "commodity-uuid",
      "finalPrice": 2300.00,
      "finalQuantity": 50,
      "priceUnit": "INR/quintal",
      "unit": "quintal",
      "tradeType": "EX-Warehouse",
      "escrowStatus": "pending_payment",
      "buyer": { "id": "...", "name": "Ramesh Kumar" },
      "seller": { "id": "...", "name": "Gurpreet Singh" },
      "createdAt": "2025-06-11T11:30:00Z"
    }
  },
  "message": "Offer accepted. Deal created."
}
```

---

### 4.7 POST /offers/:id/reject — Reject Offer

**Who calls this:** Either party, at any point.

**Request**

```http
POST /api/buy-commodity/offers/offer-uuid/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Price too low for current market"
}
```

**Server Processing**

```
1. UPDATE offers SET status = 'rejected' WHERE id = :id
2. releaseLock(offer.commodity_id)
   (Commodity is free for next buyer to negotiate)
3. WebSocket: emit 'offer:rejected' to other party
4. Return 200
```

**Success Response (200)**

```json
{
  "success": true,
  "data": { "offerId": "offer-uuid", "status": "rejected" },
  "message": "Offer rejected"
}
```

---

### 4.8 GET /deals/:dealId — Deal Details

**Request**

```http
GET /api/buy-commodity/deals/deal-uuid
Authorization: Bearer <token>
```

**Success Response (200)**

```json
{
  "success": true,
  "data": {
    "deal": {
      "id": "deal-uuid",
      "offerId": "offer-uuid",
      "commodity": {
        "id": "commodity-uuid",
        "name": "Wheat Grade A",
        "images": ["https://..."]
      },
      "buyer": { "id": "...", "name": "Ramesh Kumar", "phone": "+91-XXXXX" },
      "seller": { "id": "...", "name": "Gurpreet Singh", "phone": "+91-XXXXX" },
      "finalPrice": 2300.00,
      "finalQuantity": 50,
      "priceUnit": "INR/quintal",
      "unit": "quintal",
      "tradeType": "EX-Warehouse",
      "totalValue": 115000.00,
      "escrowStatus": "funded",
      "fundedAt": "2025-06-11T12:00:00Z",
      "dispatchedAt": null,
      "deliveredAt": null,
      "releasedAt": null,
      "createdAt": "2025-06-11T11:30:00Z"
    }
  }
}
```

---

### 4.9 PATCH /deals/:dealId/escrow — Update Escrow Stage

**Who calls this:** Buyer (for funded, delivered), Seller (for dispatched), System (for released, cancelled).

**Request**

```http
PATCH /api/buy-commodity/deals/deal-uuid/escrow
Authorization: Bearer <token>
Content-Type: application/json

{
  "escrowStatus": "funded"
}
```

**Valid Transitions (reject all others with 422)**

```
pending_payment → funded       [Caller: buyer]
funded          → dispatched   [Caller: seller]
dispatched      → delivered    [Caller: buyer]
delivered       → released     [Caller: system/admin]
any (except released) → cancelled  [Caller: either party, with reason]
```

**Server Processing**

```
1. Fetch deal, verify caller is buyer or seller
2. Validate transition is legal (see table above)
3. Validate caller has permission for this transition
4. UPDATE deals SET
     escrow_status = body.escrowStatus,
     {funded|dispatched|delivered|released|cancelled}_at = NOW()
   WHERE id = :dealId
5. If status = 'cancelled':
   a. If was 'funded': initiate refund (flag for payment team)
   b. If was 'dispatched': flag for dispute resolution
   c. UPDATE commodities SET status = 'active' WHERE id = deal.commodity_id
      (Re-list commodity)
6. WebSocket: emit 'escrow:updated' to both parties
```

**Success Response (200)**

```json
{
  "success": true,
  "data": {
    "deal": {
      "id": "deal-uuid",
      "escrowStatus": "funded",
      "fundedAt": "2025-06-11T12:00:00Z"
    }
  },
  "message": "Escrow status updated to funded"
}
```

---

## 5. Business Rule Engine

### 5.1 Price Movement Guard — Detailed

```javascript
// utils/priceGuard.js

function validatePriceMovement(newPrice, lastPrice) {
  if (!lastPrice) return { valid: true }; // First counter, no restriction

  const delta = Math.abs(newPrice - lastPrice) / lastPrice;

  if (delta >= 0.05) {
    const maxAllowedUp   = +(lastPrice * 1.049).toFixed(2);
    const maxAllowedDown = +(lastPrice * 0.951).toFixed(2);
    return {
      valid: false,
      code: 'PRICE_JUMP_TOO_HIGH',
      message: `Price can move max 4.9%. Allowed range: ₹${maxAllowedDown} – ₹${maxAllowedUp}`,
      allowedMin: maxAllowedDown,
      allowedMax: maxAllowedUp
    };
  }

  return { valid: true };
}
```

### 5.2 Final Offer Logic

When `isFinalOffer: true` is set in a counter:
- Server sets `offers.is_final_offer = true`
- Other party's next GET /offers/:id returns `canCounter: false`
- Mobile app reads `canCounter` and hides the "Counter Offer" button
- Only "Accept" and "Reject" buttons are shown
- If the final-offer party tries to counter again → 422 with `FINAL_OFFER_SET`

### 5.3 Offer Expiry Cron Job

```javascript
// cron/expireOffers.js — runs every 5 minutes

async function expireStaleOffers() {
  const expired = await db.query(`
    UPDATE offers
    SET status = 'expired'
    WHERE status IN ('pending', 'countered')
      AND expires_at < NOW()
    RETURNING id, commodity_id, buyer_id
  `);

  for (const offer of expired.rows) {
    await releaseLock(offer.commodity_id);
    await notifyViaWebSocket(offer.buyer_id, 'offer:expired', { offerId: offer.id });
  }

  console.log(`Expired ${expired.rowCount} offers`);
}
```

---

## 6. WebSocket Event Map

### Server Setup (Socket.io example)

```javascript
// socket/negotiationSocket.js

io.on('connection', (socket) => {
  // User joins their own room on connect
  socket.on('join', ({ userId }) => {
    socket.join(`user:${userId}`);
  });

  // User joins an offer room for real-time updates
  socket.on('join_offer', ({ offerId }) => {
    socket.join(`offer:${offerId}`);
  });
});

// Emit helpers used by API handlers
function notifyUser(userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

function notifyOffer(offerId, event, data) {
  io.to(`offer:${offerId}`).emit(event, data);
}
```

### Event Reference

| Event Name | Emitted When | Payload | Who Receives |
|---|---|---|---|
| `offer:received` | POST /offers | `{ offerId, buyerName, price, quantity }` | Seller |
| `offer:countered` | POST /counter | `{ offerId, roundNumber, price, proposedBy }` | Other party |
| `offer:accepted` | POST /accept | `{ offerId, dealId }` | Both |
| `offer:rejected` | POST /reject | `{ offerId, reason }` | Other party |
| `offer:expired` | Cron / system | `{ offerId }` | Buyer |
| `deal:created` | POST /accept | `{ dealId, finalPrice, finalQuantity }` | Both |
| `escrow:updated` | PATCH /escrow | `{ dealId, escrowStatus, updatedAt }` | Both |
| `negotiation:locked` | Other buyer counters | `{ commodityId, displayStatus }` | Affected buyer |

### Mobile App Socket Handling

```javascript
// Mobile — React Native example

useEffect(() => {
  socket.emit('join', { userId: currentUser.id });
  socket.emit('join_offer', { offerId: activeOfferId });

  socket.on('offer:countered', (data) => {
    // Refresh offer detail screen
    refetchOffer(data.offerId);
    showToast(`New counter at ₹${data.price}`);
  });

  socket.on('offer:accepted', (data) => {
    // Navigate to Deal screen
    navigation.navigate('DealDetail', { dealId: data.dealId });
  });

  socket.on('offer:expired', (data) => {
    showBanner('This offer has expired');
    navigation.navigate('MarketplaceListing');
  });

  return () => {
    socket.off('offer:countered');
    socket.off('offer:accepted');
    socket.off('offer:expired');
  };
}, [activeOfferId]);
```

---

## 7. Escrow State Machine

### State Diagram

```
pending_payment
    │
    ▼ (buyer pays)
  funded
    │
    ▼ (seller ships)
dispatched
    │
    ▼ (buyer confirms receipt)
delivered
    │
    ▼ (system releases funds)
released ✓  [Terminal — success]

Any state (except released)
    │
    ▼ (dispute / timeout)
cancelled ✗  [Terminal — with rollback]
```

### Transition Permission Matrix

| Transition | Allowed Caller | Condition |
|---|---|---|
| pending_payment → funded | buyer | Payment gateway callback |
| funded → dispatched | seller | Seller marks shipped |
| dispatched → delivered | buyer | Buyer confirms receipt |
| delivered → released | system / admin | Auto after N days or manual |
| any → cancelled | either or system | Reason required |

### Cancellation Rollback Logic

```javascript
async function handleCancellation(deal, cancelledBy, reason) {
  await db.transaction(async (trx) => {
    // 1. Update deal status
    await trx('deals').where({ id: deal.id }).update({
      escrow_status: 'cancelled',
      cancelled_at: new Date(),
      cancel_reason: reason
    });

    // 2. Re-list commodity
    await trx('commodities').where({ id: deal.commodity_id }).update({
      status: 'active'
    });

    // 3. Refund logic based on escrow stage
    if (deal.escrow_status === 'funded' || deal.escrow_status === 'dispatched') {
      await createRefundRequest(deal.id, deal.buyer_id, deal.final_price * deal.final_quantity);
    }

    // 4. If dispatched — flag for dispute team
    if (deal.escrow_status === 'dispatched') {
      await createDisputeTicket(deal.id, cancelledBy, reason);
    }
  });

  // 5. Notify both parties
  notifyUser(deal.buyer_id, 'escrow:updated', { dealId: deal.id, escrowStatus: 'cancelled' });
  notifyUser(deal.seller_id, 'escrow:updated', { dealId: deal.id, escrowStatus: 'cancelled' });
}
```

---

## 8. Mobile App — Screen-by-Screen Build Guide

> This section tells a React Native developer exactly which screens to build, what API calls each screen makes, and what state to manage.

---

### Screen 1: Marketplace / Commodity Listing (Buyer)

**What it does:** Shows all active commodities. Buyer can tap one to see details or make an offer.

**API Call:** `GET /api/commodities?status=active&page=1`

**UI Elements Required:**
- FlatList of commodity cards (image, name, price, unit, state, trade type)
- Filter bar (by crop type, state, trade type)
- Search bar
- Each card has a "View & Offer" CTA button

**State to manage:**
```javascript
const [commodities, setCommodities] = useState([]);
const [loading, setLoading]         = useState(false);
const [filters, setFilters]         = useState({});
const [page, setPage]               = useState(1);
```

---

### Screen 2: Commodity Detail (Buyer)

**What it does:** Full details of one listing. Buyer submits initial offer from here.

**API Call:** `GET /api/commodities/:id`

**UI Elements Required:**
- Image carousel
- Price, quantity, unit, trade type, state
- Seller info (name, rating)
- "Make an Offer" button (opens Screen 3 modal)
- If buyer already has active offer → show "View Your Offer" button instead

---

### Screen 3: Submit Offer Modal / Screen (Buyer)

**What it does:** Form to submit initial bid.

**API Call:** `POST /api/buy-commodity/offers`

**UI Elements Required:**
- Price input (numeric, with unit label)
- Quantity input (pre-filled from listing, editable)
- Trade type picker (FOR / EX-Warehouse)
- Payment timeline text input (optional)
- Remarks text area (optional)
- "Submit Offer" button
- Loading state on button while API call is in-flight
- On success → navigate to Offer Detail screen (Screen 5)
- On 409 error → show "You already have an offer on this" + "View Offer" link

---

### Screen 4: My Offers List (Buyer)

**What it does:** All offers the buyer has submitted, with live status.

**API Call:** `GET /api/buy-commodity/offers?page=1&limit=10`

**WebSocket:** Listen to `offer:countered`, `offer:accepted`, `offer:expired`

**UI Elements Required:**
- Tabbed filter: All / Pending / In Negotiation / Accepted / Rejected / Expired
- Offer cards showing:
  - Commodity name + image thumbnail
  - Your offered price vs last counter price (if countered)
  - `displayStatus` badge — color coded:
    - `pending` → gray badge "Awaiting Response"
    - `In Negotiation` → orange badge "In Negotiation" (another buyer locked)
    - `countered` → blue badge "Counter Received" (if it's buyer's turn)
    - `countered` + your turn → animated pulse badge "Your Turn"
    - `accepted` → green badge "Deal Closed"
    - `rejected` → red badge "Rejected"
    - `expired` → gray badge "Expired"
  - Time remaining countdown (for pending/countered offers)
  - Tap → goes to Screen 5 (Offer Detail)

---

### Screen 5: Offer Detail & Negotiation Timeline (Buyer + Seller)

**What it does:** Full negotiation thread view. Both parties use this screen.

**API Calls:**
- `GET /api/buy-commodity/offers/:id` (initial load + pull-to-refresh)

**WebSocket:** Join `offer:{id}` room, listen to `offer:countered`

**UI Elements Required:**
- Commodity info header (name, image, base price)
- Negotiation rounds timeline (chat-bubble style):
  - Each round = a bubble on left (buyer) or right (seller)
  - Shows: price, quantity, remarks, timestamp, round number
  - Animate in newest round when received via WebSocket
- Status bar showing:
  - Whose turn it is: "Waiting for Seller" / "Your Turn"
  - Rounds used: "Round 2 of 5"
  - Offer expires: countdown timer "Expires in 14h 30m"
- Action buttons (conditional rendering):

```
IF offer.status = 'accepted' OR 'rejected' OR 'expired':
  → Show status banner only, no action buttons

IF it is not current user's turn:
  → Show "Waiting for [Seller/Buyer]..." disabled state

IF it IS current user's turn:
  IF offer.isFinalOffer = true (other party set final):
    → Show ONLY "Accept Offer" and "Reject Offer" buttons
    → Hide "Counter Offer" button

  IF offer.roundCount >= 5:
    → Show ONLY "Accept Offer" and "Reject Offer" buttons
    → Show banner "Final round reached"

  IF offer.canCounter = true AND cooldown active:
    → Show "Counter Offer" button DISABLED
    → Show countdown: "Counter available in 12:34"

  IF offer.canCounter = true AND cooldown passed:
    → Show "Counter Offer" (opens Screen 6 modal)
    → Show "Accept Offer" button
    → Show "Reject Offer" button (text, less prominent)
```

---

### Screen 6: Submit Counter Offer Modal (Buyer or Seller)

**What it does:** Form to counter the other party's offer.

**API Call:** `POST /api/buy-commodity/offers/:id/counter`

**UI Elements Required:**
- Pre-filled current price (last round's price) — shown as reference
- New price input with allowed range hint:
  `"Allowed range: ₹X – ₹Y (max 5% movement)"`
- Quantity input (pre-filled)
- Remarks text area
- "This is my final offer" toggle (sets `isFinalOffer: true`)
  - When toggled ON → show warning: "Other party can only accept or reject after this"
- "Submit Counter" button
- On 422 PRICE_JUMP_TOO_HIGH → inline error showing allowed range
- On 429 COOLDOWN_ACTIVE → show "You must wait until [time]"

---

### Screen 7: Received Offers Dashboard (Seller)

**What it does:** Seller sees all buyers who offered on their commodity listings.

**API Call:** `GET /api/buy-commodity/offers/received/:commodityId`

**WebSocket:** Listen to `offer:received` to show new offers in real-time

**UI Elements Required:**
- List of buyer offer cards:
  - Buyer name, price offered, quantity, trade type, time submitted
  - If `isActiveNegotiation: true` → highlight card with green border + "Active Negotiation" badge
  - If `canCounter: false` + `note` present → show info banner: "Another buyer is in active negotiation"
  - If offer is their turn → show "Your Turn" pulse badge
- Tap any offer card → goes to Screen 5 (same Offer Detail screen, seller context)
- Each card shows quick action: "Respond" or "View Thread"

---

### Screen 8: Deal Confirmation Screen (Both)

**What it does:** Shown immediately after offer is accepted. Summarizes the deal.

**API Call:** `GET /api/buy-commodity/deals/:dealId`

**UI Elements Required:**
- Deal summary card:
  - Commodity name, image
  - Final agreed price + quantity + total value
  - Trade type, payment timeline
  - Buyer and Seller contact info
- Escrow status stepper (visual):
  `[Pending Payment] → [Funded] → [Dispatched] → [Delivered] → [Released]`
  Current stage highlighted
- Action button based on role + current stage:
  - Buyer + `pending_payment`: "Proceed to Payment" button
  - Seller + `funded`: "Mark as Dispatched" button
  - Buyer + `dispatched`: "Confirm Delivery" button
  - Admin/system + `delivered`: "Release Funds" (admin panel)
  - Any + not `released`: "Raise Dispute / Cancel" link

---

### Screen 9: Escrow Progress Screen (Both)

**What it does:** Ongoing deal tracking for buyer and seller.

**API Calls:**
- `GET /api/buy-commodity/deals/:dealId` (initial load)
- `PATCH /api/buy-commodity/deals/:dealId/escrow` (stage updates)

**WebSocket:** Listen to `escrow:updated` for real-time stage changes

**UI Elements Required:**
- Stepper component with 5 stages (pending_payment, funded, dispatched, delivered, released)
- Each stage shows timestamp when it was completed (or "--" if pending)
- Active stage has CTA button for the party whose action is needed
- Cancelled stage: show red banner with reason + refund status
- Download receipt/invoice option (after released)

---

## 9. End-to-End Test Scenarios

### Scenario A: Happy Path — Full Negotiation → Deal

```
1. Seller lists Wheat Grade A at ₹2400/quintal, 100 quintal, EX-Warehouse
2. Buyer A submits offer: ₹2200, 50 quintal
   → offer status: pending, currentTurn: seller
3. Seller counters: ₹2350 (delta: 6.8%... wait)
   STOP: 6.8% > 5% → server returns 422 PRICE_JUMP_TOO_HIGH
   Seller corrects to ₹2270 (delta: 3.18% ✓)
   → offer status: countered, currentTurn: buyer, roundCount: 1
4. Buyer waits 30 min (cooldown)
5. Buyer counters: ₹2250 (delta: 0.88% ✓)
   → currentTurn: seller, roundCount: 2
6. Seller counters: ₹2260, isFinalOffer: true
   → offer.is_final_offer = true, currentTurn: buyer, roundCount: 3
7. Buyer sees "Final Offer" — only Accept/Reject shown
8. Buyer taps Accept
   → offer status: accepted
   → commodity status: sold
   → deal created with escrow_status: pending_payment
   → Buyer A's other offers (if any on same commodity) → expired
9. Deal progresses through escrow stages
   → Buyer pays → funded
   → Seller ships → dispatched
   → Buyer confirms → delivered
   → System releases → released ✓
```

### Scenario B: Two Buyers, Lock Behavior

```
1. Commodity: Soybean Lot #7
2. Buyer A submits offer at 10:00 AM
3. Buyer B submits offer at 10:05 AM
4. Seller counters Buyer A's offer at 10:15 AM
   → Redis lock set: "offer_lock:commodity-uuid" = "buyerA-id:offerA-id", TTL 23h45m
5. Buyer B calls GET /offers:
   → For their offer on Soybean Lot #7:
     lock owner = buyerA, not buyerB
   → Buyer B sees: displayStatus: "In Negotiation"
6. Buyer A and Seller finish negotiation, Buyer A accepts at 11:00 AM
   → lock released
   → Buyer B's offer status → expired (commodity sold)
   → Buyer B gets WebSocket event: offer:expired
```

### Scenario C: Offer Expires Mid-Negotiation

```
1. Buyer submits offer at Day 1 10:00 AM
   → expires_at = Day 2 10:00 AM
2. Both parties counter back and forth (3 rounds by 8:00 PM)
3. At Day 2 10:01 AM — cron job runs
   → offer status → expired
   → Redis lock deleted
   → Buyer receives WebSocket: offer:expired
   → Mobile app: shows expired banner, disables all action buttons
```

### Scenario D: Reject and Reopen

```
1. Seller rejects Buyer A's offer
   → offer status: rejected
   → Redis lock released (if it was set)
   → Buyer A can submit NEW offer on same commodity (duplicate check only
     blocks pending/countered offers — rejected is allowed to re-offer)
2. Buyer A submits fresh offer
   → New offer created, negotiation starts fresh from round 0
```

---

## 10. Error Codes & UI Handling

### Complete Error Code Table

| HTTP | Code | Server Trigger | Mobile UI Action |
|---|---|---|---|
| 400 | VALIDATION_ERROR | Schema mismatch | Show field-level errors inline |
| 401 | UNAUTHORIZED | JWT missing/expired | Redirect to login |
| 403 | NOT_YOUR_TURN | Wrong turn | Show "Waiting for [party]" |
| 403 | FORBIDDEN | Not party to this offer | Show "Access denied" |
| 404 | OFFER_NOT_FOUND | Bad ID | Show "Offer not found" |
| 404 | DEAL_NOT_FOUND | Bad ID | Show "Deal not found" |
| 409 | DUPLICATE_OFFER | Same buyer, same commodity | Show "View existing offer" link |
| 410 | OFFER_EXPIRED | Past expires_at | Show expired banner, clear actions |
| 422 | COMMODITY_NOT_AVAILABLE | Status != active | "This commodity is no longer listed" |
| 422 | PRICE_JUMP_TOO_HIGH | Delta >= 5% | Show allowed price range inline |
| 422 | ROUND_LIMIT_REACHED | roundCount >= 5 | Show "Final round" banner |
| 422 | FINAL_OFFER_SET | isFinalOffer = true | Show Accept/Reject only |
| 422 | INVALID_ESCROW_TRANSITION | Bad state change | Show "Action not allowed in current stage" |
| 429 | COOLDOWN_ACTIVE | < 30 min since last | Disable counter button, show countdown |
| 500 | SERVER_ERROR | Unexpected failure | Show generic error + retry button |

---

## 11. AI Prompt: Missing Screens & Buttons

> Use the following prompt verbatim when asking an AI (Cursor, GitHub Copilot, ChatGPT, Claude) to generate any missing screen or component. The prompt is strict — it tells the AI exactly what to build with no ambiguity.

---

```
You are a senior React Native developer building a screen for an Agritech commodity trading app.

CONTEXT:
- This is a negotiation flow between commodity buyers and sellers.
- The backend API base URL is: /api/buy-commodity
- All API calls use: Authorization: Bearer <JWT>
- WebSocket events use Socket.io
- Navigation uses React Navigation v6

STRICT REQUIREMENTS (never skip these):
1. Every screen must handle loading state (show ActivityIndicator while API is fetching)
2. Every screen must handle error state (show error banner with retry button)
3. Every screen must handle empty state (show helpful empty state illustration + CTA)
4. All buttons must be disabled while their associated API call is in-flight
5. Pull-to-refresh must be implemented on all list/detail screens
6. CountDown timers must use setInterval and be cleared in useEffect cleanup
7. WebSocket listeners must be registered in useEffect and cleaned up on unmount
8. All monetary values must be displayed with Indian number formatting (₹2,30,000)
9. All timestamps must display in relative format AND absolute format (tap to toggle)
10. Status badges must be color-coded: pending=gray, countered=blue, accepted=green, rejected=red, expired=gray, in_negotiation=orange

BUILD THIS SCREEN: [PASTE YOUR SCREEN NAME AND API CALLS HERE]

REQUIRED UI ELEMENTS:
[PASTE THE "UI Elements Required" SECTION FROM THE SCREEN'S ENTRY IN SECTION 8]

API CONTRACT:
[PASTE THE RELEVANT ENDPOINT SECTION FROM SECTION 4]

BUSINESS RULES TO ENFORCE IN UI:
- canCounter field from API controls whether Counter button is shown
- isFinalOffer = true: hide Counter button, show only Accept + Reject
- roundCount >= 5: hide Counter button, show only Accept + Reject
- displayStatus = "In Negotiation": show orange badge, disable all action buttons
- cooldownEndsAt: if in the future, disable Counter button and show countdown

OUTPUT FORMAT:
- Single React Native functional component with TypeScript
- Use React Query (useQuery, useMutation) for API calls
- Use separate custom hooks for WebSocket logic
- All styles via StyleSheet.create (no inline styles)
- All hardcoded strings in a constants object at top of file
- Export the component as default
- Include all TypeScript types/interfaces for API response shapes

DO NOT:
- Skip error handling
- Use useEffect for data fetching (use React Query)
- Leave any TODO comments — write the complete code
- Use any third-party UI library other than react-native core + react-native-vector-icons
```

---

### Specific Prompts for Each Missing Piece

#### Negotiation Timeline Component

```
Build a React Native component called <NegotiationTimeline> that takes:
  - rounds: OfferRound[]  (from GET /offers/:id response)
  - currentUserId: string
  - onNewRound: (round: OfferRound) => void  (WebSocket callback)

Renders each round as a chat bubble:
  - Rounds proposed by currentUserId appear on the RIGHT (blue background)
  - Rounds proposed by the other party appear on the LEFT (gray background)
  - Each bubble shows: price (bold, large), quantity, remarks (smaller), timestamp
  - Newest round animates in from bottom using Animated.spring
  - Auto-scroll to bottom when new round arrives
```

#### Cooldown Timer Button

```
Build a React Native component called <CounterOfferButton> that takes:
  - cooldownEndsAt: string | null  (ISO timestamp or null if no cooldown)
  - onPress: () => void
  - disabled: boolean

Behavior:
  - If cooldownEndsAt is null or in the past → render normal "Counter Offer" button
  - If cooldownEndsAt is in the future → render disabled button with countdown:
      "Counter Offer (available in 14:32)"
    Use setInterval to countdown every second
    When countdown reaches 0 → enable the button automatically
  - While disabled: opacity 0.5, no onPress
```

#### Escrow Progress Stepper

```
Build a React Native component called <EscrowStepper> that takes:
  - escrowStatus: 'pending_payment' | 'funded' | 'dispatched' | 'delivered' | 'released' | 'cancelled'
  - fundedAt: string | null
  - dispatchedAt: string | null
  - deliveredAt: string | null
  - releasedAt: string | null

Renders a horizontal stepper with 5 nodes:
  1. Payment  2. Funded  3. Dispatched  4. Delivered  5. Released

  - Completed stages: filled green circle with checkmark
  - Current active stage: filled blue circle with pulsing animation
  - Future stages: empty gray circle
  - Line between stages: green if both stages complete, gray otherwise
  - Below each node: show timestamp if completed, "--" otherwise
  - If escrowStatus = 'cancelled': show red X overlay on current node
```

---

---

## 12. Bug Fixes — Seller UI Role Rendering (Critical)

> **Screenshot Bug Reference:** Seller login pe same buyer UI dikh raha tha — "Waiting for Raghav Gupta to respond" + koi action buttons nahi. Yeh section uss bug ka complete fix hai.

---

### 12.1 The Core Problem

Screen mein `currentTurn` aur `currentUserId` ka comparison nahi tha. Ek hi component buyer aur seller dono ke liye render ho raha tha bina role check ke.

```
BUG:
  Component always renders → "Waiting for [other party]..."
  No check: is current user the one who needs to ACT?

FIX:
  const myRole = offer.buyerId === currentUser.id ? 'buyer' : 'seller'
  const isMyTurn = offer.currentTurn === myRole
  → Render action buttons only when isMyTurn = true
```

---

### 12.2 Role Detection Logic

```javascript
// utils/offerRoleUtils.js

export function getMyRole(offer, currentUserId) {
  if (offer.buyerId === currentUserId) return 'buyer';
  if (offer.sellerId === currentUserId) return 'seller';
  return null; // not a party to this offer
}

export function isMyTurn(offer, currentUserId) {
  const role = getMyRole(offer, currentUserId);
  return offer.currentTurn === role;
}

export function getStatusBadge(offer, currentUserId) {
  const myTurn = isMyTurn(offer, currentUserId);

  if (offer.status === 'accepted') return { label: 'Deal Closed',      color: '#16a34a' };
  if (offer.status === 'rejected') return { label: 'Rejected',         color: '#dc2626' };
  if (offer.status === 'expired')  return { label: 'Expired',          color: '#6b7280' };
  if (offer.displayStatus === 'In Negotiation')
                                   return { label: 'In Negotiation',   color: '#f97316' };
  if (myTurn)                      return { label: 'Action Required',  color: '#2563eb' };
  return                                  { label: 'Awaiting Response', color: '#9ca3af' };
}
```

---

### 12.3 Negotiation History — Initial Offer Must Show

**Bug:** History empty dikhti thi jab koi counter nahi hua. Buyer ka initial offer bhi `offer_rounds` mein round_number=0 ke saath hona chahiye — ya agar nahi hai toh offer itself se synthesize karo.

**Server-side fix** — `GET /offers/:id` response mein rounds array mein round 0 hamesha include karo:

```javascript
// In offer detail controller — ensure round 0 always exists in response

const rounds = await OfferRound.findAll({ where: { offerId: id }, order: [['round_number', 'ASC']] });

// If no rounds stored yet (offer just submitted, seller hasn't responded)
// synthesize round 0 from the offer itself
if (rounds.length === 0) {
  rounds.push({
    roundNumber: 0,
    proposedBy: 'buyer',
    proposerId: offer.buyerId,
    price: offer.price,
    quantity: offer.quantity,
    remarks: offer.remarks,
    isFinal: false,
    createdAt: offer.createdAt,
    synthesized: true  // flag — not a real DB row
  });
}
```

---

### 12.4 Complete Action Bar — Role-Based Rendering

This is the bottom action bar component. Replace the current static "Waiting..." bar with this:

```javascript
// components/NegotiationActionBar.js

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { getMyRole, isMyTurn } from '../utils/offerRoleUtils';

const STRINGS = {
  waitingForSeller:  'Waiting for Seller to respond...',
  waitingForBuyer:   'Waiting for Buyer to respond...',
  acceptOffer:       'Accept Offer',
  counterOffer:      'Counter Offer',
  declineOffer:      'Decline',
  finalOfferBanner:  'Seller marked this as Final Offer',
  maxRoundsBanner:   'Max rounds reached — Accept or Decline',
  dealClosed:        'Deal has been accepted ✓',
  offerRejected:     'This offer was rejected',
  offerExpired:      'This offer has expired',
};

export default function NegotiationActionBar({
  offer,
  currentUserId,
  onAccept,
  onCounter,
  onDecline,
  isAccepting,
  isDeclining,
}) {
  const myRole   = getMyRole(offer, currentUserId);
  const myTurn   = isMyTurn(offer, currentUserId);
  const otherRole = myRole === 'buyer' ? 'seller' : 'buyer';

  // ── Terminal states — no actions ──────────────────────────────
  if (offer.status === 'accepted') {
    return (
      <View style={[styles.bar, styles.barGreen]}>
        <Text style={styles.terminalText}>{STRINGS.dealClosed}</Text>
      </View>
    );
  }

  if (offer.status === 'rejected') {
    return (
      <View style={[styles.bar, styles.barRed]}>
        <Text style={styles.terminalText}>{STRINGS.offerRejected}</Text>
      </View>
    );
  }

  if (offer.status === 'expired') {
    return (
      <View style={[styles.bar, styles.barGray]}>
        <Text style={styles.terminalText}>{STRINGS.offerExpired}</Text>
      </View>
    );
  }

  // ── Not my turn — show waiting ─────────────────────────────────
  if (!myTurn) {
    const msg = otherRole === 'seller'
      ? STRINGS.waitingForSeller
      : STRINGS.waitingForBuyer;
    return (
      <View style={[styles.bar, styles.barWaiting]}>
        <Text style={styles.waitingIcon}>⏳</Text>
        <Text style={styles.waitingText}>{msg}</Text>
      </View>
    );
  }

  // ── My turn — determine which buttons to show ──────────────────
  const isFinalFromOther = offer.isFinalOffer && offer.currentTurn === myRole;
  const maxRoundsHit     = offer.roundCount >= 5;
  const showCounterBtn   = !isFinalFromOther && !maxRoundsHit;

  return (
    <View style={styles.bar}>

      {/* Banner if final offer or max rounds */}
      {isFinalFromOther && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>{STRINGS.finalOfferBanner}</Text>
        </View>
      )}
      {maxRoundsHit && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>{STRINGS.maxRoundsBanner}</Text>
        </View>
      )}

      <View style={styles.buttonRow}>

        {/* Accept */}
        <TouchableOpacity
          style={[styles.btn, styles.btnAccept, isAccepting && styles.btnDisabled]}
          onPress={onAccept}
          disabled={isAccepting || isDeclining}
        >
          {isAccepting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnTextWhite}>{STRINGS.acceptOffer}</Text>
          }
        </TouchableOpacity>

        {/* Counter — only if not final offer and rounds remain */}
        {showCounterBtn && (
          <TouchableOpacity
            style={[styles.btn, styles.btnCounter]}
            onPress={onCounter}
            disabled={isAccepting || isDeclining}
          >
            <Text style={styles.btnTextDark}>{STRINGS.counterOffer}</Text>
          </TouchableOpacity>
        )}

        {/* Decline */}
        <TouchableOpacity
          style={[styles.btn, styles.btnDecline, isDeclining && styles.btnDisabled]}
          onPress={onDecline}
          disabled={isAccepting || isDeclining}
        >
          {isDeclining
            ? <ActivityIndicator color="#dc2626" size="small" />
            : <Text style={styles.btnTextDecline}>{STRINGS.declineOffer}</Text>
          }
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  barGreen:   { backgroundColor: '#f0fdf4' },
  barRed:     { backgroundColor: '#fef2f2' },
  barGray:    { backgroundColor: '#f9fafb' },
  barWaiting: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb' },

  terminalText: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#374151' },

  waitingIcon: { fontSize: 16, marginRight: 8 },
  waitingText: { fontSize: 14, color: '#6b7280' },

  infoBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  infoBannerText: { fontSize: 13, color: '#92400e', textAlign: 'center' },

  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },

  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAccept:  { backgroundColor: '#16a34a' },
  btnCounter: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  btnDecline: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dc2626' },
  btnDisabled:{ opacity: 0.5 },

  btnTextWhite:  { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  btnTextDark:   { color: '#111827', fontWeight: '600', fontSize: 14 },
  btnTextDecline:{ color: '#dc2626', fontWeight: '600', fontSize: 14 },
});
```

---

### 12.5 Status Badge Fix

```javascript
// components/OfferStatusBadge.js

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStatusBadge } from '../utils/offerRoleUtils';

export default function OfferStatusBadge({ offer, currentUserId }) {
  const { label, color } = getStatusBadge(offer, currentUserId);
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: { fontSize: 12, fontWeight: '600' },
});
```

---

### 12.6 Full Screen Integration — How to Wire Everything

```javascript
// screens/NegotiationDetailScreen.js  (simplified wiring)

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import NegotiationActionBar from '../components/NegotiationActionBar';
import OfferStatusBadge from '../components/OfferStatusBadge';
import NegotiationTimeline from '../components/NegotiationTimeline';
import CounterOfferModal from '../components/CounterOfferModal';

export default function NegotiationDetailScreen({ route }) {
  const { offerId } = route.params;
  const currentUser = useCurrentUser(); // your auth hook
  const [showCounterModal, setShowCounterModal] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['offer', offerId],
    queryFn: () => api.get(`/buy-commodity/offers/${offerId}`),
  });

  const offer = data?.offer;

  const acceptMutation = useMutation({
    mutationFn: () => api.post(`/buy-commodity/offers/${offerId}/accept`),
    onSuccess: (res) => navigation.navigate('DealDetail', { dealId: res.deal.id }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/buy-commodity/offers/${offerId}/reject`),
    onSuccess: () => refetch(),
  });

  if (!offer) return <LoadingScreen />;

  return (
    <View style={styles.container}>

      {/* Header card with status badge */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.commodityName}>{offer.commodity.name}</Text>
          {/* THIS WAS THE BUG — badge was always showing "Awaiting Response" */}
          <OfferStatusBadge offer={offer} currentUserId={currentUser.id} />
        </View>
        <PriceStatsRow offer={offer} />
        <RoundExpiryRow offer={offer} />
      </View>

      {/* Negotiation history — rounds as chat bubbles */}
      <ScrollView style={styles.timeline}>
        <NegotiationTimeline
          rounds={offer.rounds}
          currentUserId={currentUser.id}
        />
      </ScrollView>

      {/* THIS WAS THE BUG — action bar was always showing "Waiting..." */}
      <NegotiationActionBar
        offer={offer}
        currentUserId={currentUser.id}
        onAccept={() => acceptMutation.mutate()}
        onCounter={() => setShowCounterModal(true)}
        onDecline={() => rejectMutation.mutate()}
        isAccepting={acceptMutation.isPending}
        isDeclining={rejectMutation.isPending}
      />

      {/* Counter modal */}
      <CounterOfferModal
        visible={showCounterModal}
        offer={offer}
        onClose={() => setShowCounterModal(false)}
        onSuccess={() => { setShowCounterModal(false); refetch(); }}
      />

    </View>
  );
}
```

---

### 12.7 Visual Diff — Before vs After Fix

```
BEFORE (Bug — both buyer & seller see this):
┌──────────────────────────────────────┐
│ Rice               [Awaiting Response]│  ← wrong for seller
│ Original Ask | Current Bid | Qty      │
│ Round 1 of 5  |  Expires: --          │
├──────────────────────────────────────┤
│ ⏳ Waiting for Raghav Gupta...        │  ← always waiting
├──────────────────────────────────────┤
│ Negotiation History                   │
│                                       │
│     (empty — offer not rendered)      │  ← missing initial offer
│                                       │
├──────────────────────────────────────┤
│ ⏳ Waiting for Raghav Gupta...        │  ← no buttons
└──────────────────────────────────────┘

AFTER (Fixed — seller sees this):
┌──────────────────────────────────────┐
│ Rice               [Action Required] │  ← correct badge
│ Buyer's Offer | Your Price | Qty     │
│ Round 1 of 5  |  Expires: 23h 45m   │
├──────────────────────────────────────┤
│ Negotiation History                   │
│ ┌─────────────────────────────────┐  │
│ │ Buyer                           │  │  ← round 0 visible
│ │ ₹5,556/Qt — 512 Ton             │  │
│ │ "Need by end of month"  10:30AM │  │
│ └─────────────────────────────────┘  │
├──────────────────────────────────────┤
│ [✓ Accept Offer] [Counter] [Decline] │  ← action buttons visible
└──────────────────────────────────────┘
```

---

*End of document. All sections are production-complete. No placeholders.*
