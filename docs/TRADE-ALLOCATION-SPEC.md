# Trade Allocation to Customers — Implementation Spec

**Version:** 1.1
**Date:** 2026-03-10
**Scope:** Phase D1 from CUSTODY-PORTFOLIO-SPEC.md — allocate a single pooled securities trade to one customer at a time.
**Depends on:** SPEC.md (enrichment-workspace), CUSTODY-PORTFOLIO-SPEC.md (data model), enrichment-api v1.0 (dispatch pattern)

---

## 1. Overview

GAM executes securities trades (EQ_BUY, EQ_SELL, etc.) in bulk on the market. A single trade of 1,000 META shares may belong to multiple customers. The operator allocates portions of each trade to individual customers one at a time. Each allocation creates an F03.02 allocationLot record, updates (or creates) an F03.01 portfolioPosition record, and refreshes the F03.00 customerPortfolio summary.

**Scope of this spec:** Single-customer allocation only. The operator selects one enrichment record, enters one customer and a quantity, and submits. The operation is repeated for each customer who participates in the trade. Batch/proportional allocation is deferred to a future phase.

---

## 1.1 Data Hierarchy

The custody portfolio model has four layers. The top three are persisted; the bottom is the source of truth from which the upper layers are derived.

```
F03.00  customerPortfolio        One record per customer.
  │     (consolidated summary)   Totals: cost basis, market value, unrealized P&L.
  │                              Read-only. Refreshed by API after each allocation
  │                              or by scheduled job (after snapshot confirmation).
  │
  ├── F03.01  portfolioPosition  One record per customer × asset.
  │           (asset breakdown)  Quantity held, cost basis, average cost.
  │                              Maintained as side-effect of lot operations.
  │                              Each F03.01 row is a grid row in F03.00's
  │                              asset breakdown view.
  │
  │     ├── F03.02  allocationLot   One record per trade allocation.
  │     │           (individual lot) Immutable after creation. Source of truth.
  │     │                            BUY lots: remainingQuantity decreases on sells.
  │     │                            SELL lots: reference consumed BUY lots.
  │     │
  │     └── F03.02  ...             (more lots for same customer × asset)
  │
  └── F03.01  ...                (more asset positions for same customer)
```

**Aggregation directions from F03.01:**

- **Customer view:** WHERE customerId = X → all asset positions for that customer → sums into F03.00.
- **Bank asset view:** WHERE assetId = Y → all customer positions for that asset → bank's consolidated holding.

Both are computed queries; F03.00 persists the customer direction for display and reporting.

---

## 1.2 F03.00 — Customer Portfolio (`customerPortfolio`)

**Table:** `customerPortfolio`
**Purpose:** Read-only consolidated summary of a customer's portfolio. One record per customer. Refreshed (not edited) by the API after allocations or daily snapshot confirmations.

| Field ID | Type | Label | Notes |
|---|---|---|---|
| `portfolioId` | IdGeneratorField | Portfolio ID | Format: `CPF-??????` |
| `customerId` | TextField | Customer | FK to customerForm. Unique — one portfolio per customer. |
| `customerDisplayName` | TextField | Customer Name | Denormalized for display. |
| `positionCount` | TextField | # Positions | Count of active F03.01 rows for this customer. |
| `totalCostBasis` | TextField | Total Cost Basis | Sum of F03.01.totalCostBasis across all positions. In EUR. |
| `totalMarketValue` | TextField | Total Market Value | Sum of (F03.01.quantity × F03.04.marketPrice) across all positions. In EUR. Requires latest snapshot. |
| `totalUnrealizedPnl` | TextField | Unrealized P&L | = totalMarketValue − totalCostBasis. |
| `totalRealizedPnl` | TextField | Realized P&L (YTD) | Sum of F03.02 SELL lots' realizedPnl for current year. In EUR. |
| `currency` | TextField | Reporting Currency | Always `EUR`. |
| `lastRefreshedAt` | TextField | Last Refreshed | Timestamp of last recalculation. |
| `snapshotDate` | DatePicker | Snapshot Date | The F03.04 snapshot date used for market values. |
| `status` | SelectBox | Status | `active` / `closed`. Active if any F03.01 position is active. |

**Lifecycle:**

- **Created:** By the `allocateTrade` API operation when a customer receives their first-ever lot. The API checks if F03.00 exists for this customer; if not, creates it.
- **Refreshed (cost basis fields):** After each `allocateTrade` call. The API recalculates `totalCostBasis`, `positionCount`, and `totalRealizedPnl` from F03.01/F03.02.
- **Refreshed (market value fields):** After daily snapshot confirmation (F03.04). A separate refresh operation or scheduled job recalculates `totalMarketValue` and `totalUnrealizedPnl` from F03.01 quantities × F03.04 prices.
- **Never edited by users.** Read-only in all views.

**Note on staleness:** `totalMarketValue` and `totalUnrealizedPnl` are only as fresh as the latest confirmed F03.04 snapshot. The `snapshotDate` field tells the user which date's prices are reflected. Between snapshots, these fields may be stale. The `totalCostBasis` and `positionCount` are always current (updated on every allocation).

---

## 2. Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  Workspace JS (ew-actions.js)                                        │
│                                                                      │
│  1. User selects 1 enrichment record, clicks "Allocate to Investors" │
│  2. Dialog opens with trade summary (read from EW.state.records)     │
│  3. Dialog fetches secu transaction data for qty/price               │
│  4. User picks customer, enters quantity                             │
│  5. Frontend shows preview: amount, fee share, total cost            │
│  6. User clicks Allocate                                             │
│  7. POST /records?save={allocateTrade:true, ...}                     │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  enrichment-api (EnrichmentApiPlugin.java)                           │
│                                                                      │
│  dispatchSaveParam() → peek.has("allocateTrade")                     │
│    → handleAllocateTrade(json)                                       │
│      → EnrichmentService.allocateTrade(...)                          │
│                                                                      │
│  Within a single JDBC transaction:                                   │
│    a. Load enrichment record (F01.05) — validate status + type       │
│    b. Load secu transaction (F01.04) — get qty, price, fee           │
│    c. Validate: customer qty <= remaining unallocated qty             │
│    d. Calculate: lot amounts, proportional fee, totalCostWithFees    │
│    e. Insert F03.02 allocationLot record                             │
│    f. Upsert F03.01 portfolioPosition (create if first lot)         │
│    g. Upsert F03.00 customerPortfolio (create if first position)    │
│    h. Update F01.05 fund_allocation_status                           │
│    i. Return result                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Part A — Workspace UI (enrichment-workspace)

### 3.1 Entry Point

The existing `allocFund` action in ew-actions.js line 399 routes to `openFundAllocDialog()` (line 1952). This stub must be replaced with the full implementation.

Button visibility rule (already in toolbar config, line 76):
```javascript
{ id: 'allocFund', icon: 'fas fa-chart-pie', label: 'Allocate to Investors', needsFund: true }
```

The `needsFund` flag currently shows the button for fund-type transactions. For Phase D1, the button should also be visible for securities types. Rename the visibility condition or add a parallel check:
```javascript
needsAllocation: function(rec) {
    var ALLOC_TYPES = ['EQ_BUY','EQ_SELL','BOND_BUY','BOND_SELL','SEC_BUY','SEC_SELL'];
    return ALLOC_TYPES.indexOf(rec.internal_type) >= 0;
}
```

### 3.2 Preconditions (validated in openFundAllocDialog)

| Check | Error message |
|---|---|
| Exactly 1 record selected | "Select exactly 1 record to allocate." |
| `internal_type` in {EQ_BUY, EQ_SELL, BOND_BUY, BOND_SELL, SEC_BUY, SEC_SELL} | "This record type cannot be allocated to investors." |
| `status` in {ENRICHED, IN_REVIEW, ADJUSTED, READY, PAIRED} | "Record status '{status}' is not eligible for allocation." |
| For security types: `pair_id` is not empty (bank settlement confirmed) | "Securities transaction must be paired with bank settlement before allocation." |
| For security types with `has_fee=yes`: `fee_trx_id` is not empty (full pairing) | "Securities transaction requires full pairing (principal + fee) before allocation." |
| `fund_allocation_status` is not `allocated` | "This trade is already fully allocated." |

### 3.3 Dialog Layout — "Allocate Trade to Customer"

```
┌──────────────────────────────────────────────────────────┐
│  Allocate Trade to Customer                          [×] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ Trade Summary (read-only) ────────────────────────┐  │
│  │  ID: ENR-00042        Date: 2025-07-15             │  │
│  │  Asset: META (US30303M1027)    Ccy: USD            │  │
│  │  Direction: BUY                                    │  │
│  │  Total Qty: 1,000     Price: 460.00                │  │
│  │  Amount: 460,000.00   Fee: 230.00                  │  │
│  │  Already allocated: 600 / 1,000 (3 lots)           │  │
│  │  Remaining: 400                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Customer     [ ▾ Select customer_____________ ]         │
│  Quantity     [ ________________ ]                        │
│                                                          │
│  ┌─ Preview ──────────────────────────────────────────┐  │
│  │  Amount:         184,000.00 USD                    │  │
│  │  Fee share:           92.00 USD                    │  │
│  │  Total cost:     184,092.00 USD                    │  │
│  │  Remaining after: 0                                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                          [Cancel]  [Allocate]            │
└──────────────────────────────────────────────────────────┘
```

### 3.4 Dialog State

```javascript
EW.state._alloc = {
    enrichmentId: null,      // F01.05 record id
    rec: null,               // cached enrichment record
    secuTrx: null,           // fetched secu transaction data (qty, price, fee)
    alreadyAllocatedQty: 0,  // sum of existing lots for this enrichment
    totalQty: 0,             // from secu transaction
    totalFee: 0,             // from secu transaction
    pricePerUnit: 0          // from secu transaction
};
```

### 3.5 Fetching Secu Transaction Data

The enrichment record (F01.05) does not store `quantity` or `price` as separate fields. These exist on F01.04 (secuTotalTransaction) linked via `source_record_id`. The dialog needs this data to show the trade summary and calculate preview amounts.

**Option A (recommended):** Add a new dispatch key to enrichment-api that returns secu transaction fields for a given enrichment ID. This keeps the single-API-dependency principle:
```javascript
EW.api.getSecuTransaction = function(enrichmentId) {
    var payload = { secuTransaction: true, enrichmentId: enrichmentId };
    var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
    return fetch(url, { headers: headers() }).then(handleResponse);
};
```

**Option B:** Use the existing `source_record_id` field on the enrichment record to construct a direct Joget form data read. This breaks the single-API principle and should be avoided.

**Option C:** Include secu transaction fields in the enrichment record's GET /records/{id} response via a join or extra fields. This requires enrichment-api changes but avoids a second call.

For existing lots (to calculate "already allocated"), add another dispatch key:
```javascript
EW.api.getAllocationSummary = function(enrichmentId) {
    var payload = { allocationSummary: true, enrichmentId: enrichmentId };
    var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
    return fetch(url, { headers: headers() }).then(handleResponse);
};
```
Returns: `{ allocatedQty: 600, lotCount: 3, lots: [{lotId, customerId, quantity}] }`.

### 3.6 Customer Dropdown

The customer list is needed in the dialog. Two approaches:

**Option A (recommended):** New dispatch key to enrichment-api:
```javascript
EW.api.getCustomers = function(search) {
    var payload = { customers: true, search: search || '' };
    var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
    return fetch(url, { headers: headers() }).then(handleResponse);
};
```
Returns: `[{ customerId, displayName }]`. Excludes the fund entity (is_fund=yes).

**Option B:** Use Joget's built-in /web/json/app/.../form/options/... endpoint. Breaks single-API principle.

### 3.7 Preview Calculation (client-side, real-time)

Fires on quantity input change:
```javascript
function updateAllocPreview() {
    var a = EW.state._alloc;
    var qty = parseFloat(document.getElementById('ew-alloc-qty').value) || 0;
    var amount = qty * a.pricePerUnit;
    var feeShare = a.totalQty > 0 ? a.totalFee * (qty / a.totalQty) : 0;
    var totalCost = amount + feeShare;
    var remainingAfter = (a.totalQty - a.alreadyAllocatedQty) - qty;

    // Render preview box
    // Enable/disable Allocate button: qty > 0 && qty <= remaining && customer selected
}
```

### 3.8 Submit

```javascript
window.EW_doAllocateTrade = function() {
    var a = EW.state._alloc;
    var customerId = document.getElementById('ew-alloc-customer').value;
    var qty = parseFloat(document.getElementById('ew-alloc-qty').value);

    if (!customerId || !qty) return;

    var btn = document.getElementById('ew-alloc-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Allocating…';

    var payload = {
        allocateTrade: true,
        enrichmentId: a.enrichmentId,
        customerId: customerId,
        quantity: qty
    };

    var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
    fetch(url, { headers: EW.api.headers() })
        .then(function(r) {
            if (!r.ok) return EW.api.handleError(r);
            return r.json();
        })
        .then(function(data) {
            EW.toast.show('Allocated ' + qty + ' shares to customer.', 'success');
            EW_closeOverlay('ew-alloc-overlay');
            EW.state.selectedIds = [];
            EW.table.load();
        })
        .catch(function(e) {
            EW.toast.show('Allocation failed: ' + e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-chart-pie"></i> Allocate';
        });
};
```

### 3.9 Files to Modify

| File | Change |
|---|---|
| `ew-actions.js` | Replace `openFundAllocDialog()` stub (lines 1952–1977) with full dialog. Add `EW_doAllocateTrade`, `updateAllocPreview` functions. |
| `ew-actions.js` | Update toolbar visibility: add `needsAllocation` check alongside `needsFund`. |
| `ew-api.js` | Add `EW.api.getSecuTransaction()`, `EW.api.getAllocationSummary()`, `EW.api.getCustomers()`, `EW.api.allocateTrade()`. |
| `ew-detail.js` | Update the allocation-related buttons (lines 242, 268, 298) to use the same action ID and reflect new label. |

---

## 4. Part B — Enrichment API (enrichment-api)

### 4.1 New Dispatch Keys

Add to `dispatchSaveParam()` in EnrichmentApiPlugin.java, after existing keys:

```java
// Trade allocation (D1)
if (peek.has("allocateTrade") && peek.has("enrichmentId") && peek.has("customerId")) {
    return handleAllocateTrade(json);
}

// Supporting queries for allocation dialog
if (peek.has("secuTransaction") && peek.has("enrichmentId")) {
    return handleGetSecuTransaction(json);
}
if (peek.has("allocationSummary") && peek.has("enrichmentId")) {
    return handleGetAllocationSummary(json);
}
if (peek.has("customers")) {
    return handleGetCustomers(json);
}
```

### 4.2 handleGetSecuTransaction

**Purpose:** Return the secu transaction fields (quantity, price, fee, ticker, currency) for a given enrichment ID, so the workspace dialog can show the trade summary.

**Logic:**
1. Load F01.05 record by `enrichmentId`.
2. Read `source_record_id` from the enrichment record.
3. Load F01.04 record by `source_record_id` (table: `secu_total_trx`).
4. Return relevant fields.

**Response:**
```json
{
  "enrichmentId": "ENR-00042",
  "sourceRecordId": "STX-001",
  "ticker": "META",
  "quantity": 1000,
  "price": 460.00,
  "amount": 460000.00,
  "fee": 230.00,
  "totalAmount": 460230.00,
  "currency": "USD",
  "type": "BUY",
  "ms": 12
}
```

**Error cases:**
- Enrichment record not found → 404
- No `source_record_id` on enrichment → 400 "Enrichment record has no linked securities transaction"
- Secu transaction not found → 400 "Securities transaction not found for source_record_id={id}"

### 4.3 handleGetAllocationSummary

**Purpose:** Return how much of this trade has already been allocated (sum of existing F03.02 lots for this `sourceEnrichmentId`).

**Logic:**
1. Query F03.02 (table: `allocationLot`) where `sourceEnrichmentId = enrichmentId`.
2. Sum `quantity` across all matching lots.
3. Return summary.

**Response:**
```json
{
  "enrichmentId": "ENR-00042",
  "allocatedQty": 600.0,
  "lotCount": 3,
  "lots": [
    { "lotId": "LOT-000001", "customerId": "C001", "customerName": "Anna", "quantity": 200.0, "direction": "BUY" },
    { "lotId": "LOT-000002", "customerId": "C002", "customerName": "Boris", "quantity": 300.0, "direction": "BUY" },
    { "lotId": "LOT-000003", "customerId": "C003", "customerName": "Clara", "quantity": 100.0, "direction": "BUY" }
  ],
  "ms": 5
}
```

### 4.4 handleGetCustomers

**Purpose:** Return customer list for the allocation dialog dropdown.

**Logic:**
1. Query F10.01 (table: `customerForm`) where `is_fund != 'yes'`.
2. Optional: filter by `search` parameter (LIKE on `displayName` or `customerId`).
3. Return list.

**Response:**
```json
{
  "customers": [
    { "customerId": "C001", "displayName": "Anna Kask" },
    { "customerId": "C002", "displayName": "Boris Ivanov" }
  ],
  "ms": 3
}
```

### 4.5 handleAllocateTrade — Main Operation

**Purpose:** Allocate a portion of a pooled trade to a single customer. Creates one F03.02 lot, updates F03.01 position, updates F01.05 status.

**Request:**
```json
{
  "allocateTrade": true,
  "enrichmentId": "ENR-00042",
  "customerId": "C001",
  "quantity": 400.0
}
```

**Validation (before transaction):**

| Step | Check | Error |
|---|---|---|
| V1 | Enrichment record exists | 404 "Record not found" |
| V2 | `internal_type` in {EQ_BUY, EQ_SELL, BOND_BUY, BOND_SELL, SEC_BUY, SEC_SELL} | 400 "Record type '{type}' is not eligible for trade allocation" |
| V3 | `status` in {ENRICHED, IN_REVIEW, ADJUSTED, READY, PAIRED} | 400 "Record status '{status}' is not eligible for allocation" |
| V4 | `fund_allocation_status` != `allocated` | 400 "Trade is already fully allocated" |
| V5 | Linked secu transaction exists and has quantity/price | 400 "No securities transaction data available" |
| V6 | Customer exists and is not the fund entity | 400 "Invalid customer" |
| V7 | Requested quantity > 0 | 400 "Quantity must be positive" |
| V8 | Requested quantity <= remaining unallocated quantity (tolerance 0.000001) | 400 "Requested quantity {q} exceeds remaining {r}" |
| V9 | For SELL: customer has sufficient position in F03.01 | 400 "Customer has insufficient holdings ({held} < {requested})" |

**Processing (within JDBC transaction):**

```
Step 1 — Compute lot fields
    pricePerUnit   = secuTrx.price
    totalAmount    = quantity × pricePerUnit
    feeAmount      = secuTrx.fee × (quantity / secuTrx.quantity)
    totalCostFees  = totalAmount + feeAmount
    currency       = secuTrx.currency
    direction      = "BUY" or "SELL" (derived from internal_type)
    assetId        = enrichment.resolved_asset_id
    assetTicker    = secuTrx.ticker
    allocationDate = enrichment.transaction_date

Step 2 — Generate lot ID
    lotId = IdGenerator with format "LOT-??????"

Step 3 — Resolve/create F03.01 portfolioPosition
    Find existing: WHERE customerId = ? AND assetId = ? AND status = 'active'
    If not found (BUY):
        Create new F03.01 record:
            positionId          = IdGenerator "PP-??????"
            customerId          = input customerId
            customerDisplayName = from customer record
            assetId             = enrichment.resolved_asset_id
            assetTicker         = secuTrx.ticker
            assetIsin           = enrichment.asset_isin (if available)
            quantity            = 0 (will be updated below)
            totalCostBasis      = 0
            currency            = secuTrx.currency
            firstAcquisitionDate = allocationDate
            status              = "active"
    If not found (SELL):
        Error — cannot sell without position

Step 4 — Insert F03.02 allocationLot record
    All fields from Step 1, plus:
        positionId        = resolved F03.01 positionId
        sourceEnrichmentId = enrichmentId
        remainingQuantity = quantity (for BUY; for SELL = 0)
        allocationMethod  = "MANUAL"

Step 5 — Update F03.01 portfolioPosition
    For BUY:
        quantity         += lot.quantity
        totalCostBasis   += lot.totalCostWithFees
        averageCostPerUnit = totalCostBasis / quantity
        lastTransactionDate = allocationDate
    For SELL:
        quantity         -= lot.quantity
        totalCostBasis   -= costBasisUsed (for AVERAGE: avgCost × soldQty)
        averageCostPerUnit = quantity > 0 ? totalCostBasis / quantity : 0
        lastTransactionDate = allocationDate
        If quantity == 0 → status = "closed"

Step 6 — Upsert F03.00 customerPortfolio
    Find existing: WHERE customerId = ?
    If not found:
        Create new F03.00 record:
            portfolioId         = IdGenerator "CPF-??????"
            customerId          = input customerId
            customerDisplayName = from customer record
            positionCount       = 1
            totalCostBasis      = lot.totalCostWithFees (EUR converted)
            totalMarketValue    = null (populated by snapshot refresh)
            totalUnrealizedPnl  = null
            totalRealizedPnl    = 0
            currency            = "EUR"
            lastRefreshedAt     = now
            status              = "active"
    If found:
        Recalculate from F03.01 rows for this customer:
            positionCount    = count of active F03.01 WHERE customerId = ?
            totalCostBasis   = sum of F03.01.totalCostBasis (EUR converted)
            lastRefreshedAt  = now

Step 7 — Update F01.05 enrichment record
    newAllocatedQty = previousAllocatedQty + lot.quantity
    If newAllocatedQty >= secuTrx.quantity (within tolerance 0.000001):
        fund_allocation_status = "allocated"
    Else:
        fund_allocation_status = "partially_allocated"
    Append to processing_notes: "Allocated {qty} shares to {customerName} (lot {lotId})"

Step 8 — Commit transaction
```

**Response:**
```json
{
  "success": true,
  "lotId": "LOT-000004",
  "positionId": "PP-000012",
  "positionCreated": false,
  "portfolioId": "CPF-000003",
  "portfolioCreated": false,
  "direction": "BUY",
  "quantity": 400.0,
  "totalAmount": 184000.00,
  "feeAmount": 92.00,
  "totalCostWithFees": 184092.00,
  "currency": "USD",
  "allocationStatus": "allocated",
  "remainingQty": 0.0,
  "ms": 45
}
```

### 4.6 SELL-Specific Logic (Phase D5 — deferred detail)

For SELL allocations, Step 4 must also compute cost basis. The method comes from F03.05 costBasisConfig. For Phase D1, only AVERAGE cost is supported:

```
costBasisPerUnit  = position.totalCostBasis / position.quantity
totalCostBasis    = costBasisPerUnit × soldQuantity
realizedPnl       = totalAmount − totalCostBasis
```

FIFO/LIFO require consuming specific BUY lots (updating their `remainingQuantity` and recording `consumedLotIds`). This is Phase D5 scope per CUSTODY-PORTFOLIO-SPEC.md.

### 4.7 Cross-Table Access

The allocation operation reads/writes across multiple Joget form tables. The enrichment-api's current split/merge operations only work within the enrichment table (F01.05). The allocation operation needs access to:

| Table | Joget Form ID | Access |
|---|---|---|
| `trx_enrichment` | `trxEnrichment` | Read enrichment record, update `fund_allocation_status` |
| `secu_total_trx` | `secuTotalTransaction` | Read quantity, price, fee, ticker |
| `allocationLot` | `allocationLot` | Insert new lot, read existing lots for summary |
| `portfolioPosition` | `portfolioPosition` | Read/insert/update position |
| `customerPortfolio` | `customerPortfolio` | Read/insert/update consolidated portfolio |
| `customerForm` | `customerForm` | Read customer list |

All access via JdbcHelper within a single JDBC connection/transaction. Table names should be configurable via the plugin's ValidationConfig (new section `allocation`):

```json
{
  "allocation": {
    "secuTable": "secu_total_trx",
    "lotTable": "allocationLot",
    "positionTable": "portfolioPosition",
    "portfolioTable": "customerPortfolio",
    "customerTable": "customerForm",
    "secuEnrichmentLinkField": "enrichment_id",
    "enrichmentSourceField": "source_record_id",
    "enrichmentAssetField": "resolved_asset_id",
    "enrichmentStatusField": "status",
    "enrichmentAllocStatusField": "fund_allocation_status",
    "enrichmentNotesField": "processing_notes"
  }
}
```

### 4.8 Files to Modify

| File | Change |
|---|---|
| `EnrichmentApiPlugin.java` | Add dispatch keys in `dispatchSaveParam()`. Add handler methods: `handleAllocateTrade()`, `handleGetSecuTransaction()`, `handleGetAllocationSummary()`, `handleGetCustomers()`. |
| `EnrichmentService.java` | Add `allocateTrade()` method with full transactional logic. Add `getSecuTransaction()`, `getAllocationSummary()`, `getCustomers()` query methods. |
| `ValidationConfig.java` | Add `AllocationConfig` inner class with table/field mappings. Parse from the `allocation` key in the config JSON. |
| `JdbcHelper.java` | May need new helper: `loadRowByField(conn, table, fieldName, fieldValue)` for lookups by non-PK fields (e.g., find secu trx by enrichment_id, find position by customerId+assetId). |

### 4.9 ID Generation

The enrichment-api currently generates child IDs for split as `parentId + "-S" + seq`. For allocation lots and positions, use Joget's `UuidGenerator` or a counter-based approach:

```java
// Option A: UUID-based (simple, unique)
String lotId = "LOT-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

// Option B: Counter-based via Joget EnvironmentVariable (matches form's IdGeneratorField format)
String lotId = generateId("LOT-??????", "allocationLotCounter");
```

Option B is preferred for consistency with the F03.02 form definition (which uses `IdGeneratorField` with format `LOT-??????`). The `generateId` helper should use Joget's `EnvironmentVariableDao` to increment the counter atomically.

---

## 5. Implementation Order

| Step | Scope | Description |
|---|---|---|
| **B1** | API | Add `AllocationConfig` to ValidationConfig, parse new config section |
| **B2** | API | Implement `handleGetCustomers()` — simple query, no transaction needed |
| **B3** | API | Implement `handleGetSecuTransaction()` — two table reads |
| **B4** | API | Implement `handleGetAllocationSummary()` — aggregate query on allocationLot |
| **B5** | API | Implement `handleAllocateTrade()` — full transactional operation (BUY only first) |
| **A1** | UI | Add `EW.api.getCustomers()`, `getSecuTransaction()`, `getAllocationSummary()`, `allocateTrade()` to ew-api.js |
| **A2** | UI | Replace `openFundAllocDialog()` stub with full dialog (trade summary + form + preview) |
| **A3** | UI | Add preview calculation and submit handler |
| **A4** | UI | Update toolbar visibility for `allocFund` action |
| **T1** | Test | Test BUY allocation: create lot, create position, update enrichment status |
| **T2** | Test | Test partial allocation: 2 sequential allocations, verify quantities |
| **T3** | Test | Test full allocation: verify `fund_allocation_status = allocated` |
| **T4** | Test | Test validation: wrong type, wrong status, over-allocation |

Start with B1–B4 (API read operations) so the dialog can be developed and tested against real data. Then B5 (write) and A1–A4 (UI) can proceed in parallel.

---

## 6. Open Questions

| # | Question | Default assumption |
|---|---|---|
| 1 | Should the operator be able to override price per unit for a specific lot (e.g., different execution prices within a bulk order)? | No — all lots share the trade's price. Revisit in Phase D6. |
| 2 | Should EUR amounts be computed at allocation time or deferred to a batch FX conversion? | Deferred. `totalAmountEur` and `feeAmountEur` left null, populated later by FX batch or snapshot. |
| 3 | When an enrichment record is fully allocated, should its status change (e.g., to READY)? | No — only `fund_allocation_status` changes. Status transitions remain independent. |
| 4 | Should the customer dropdown be filtered to those who have orders for this asset? | No — any non-fund customer can receive an allocation. Order management is future scope. |
| 5 | Should a "quick allocate all remaining to customer X" shortcut exist? | Yes — when the user enters the remaining quantity, detect and show "Allocate remaining" hint. UI-only convenience, same API call. |
