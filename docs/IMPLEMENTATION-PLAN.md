# Holistic Implementation Plan — Manual Workspace Operations

**Date:** 2026-03-09
**Scope:** All operations from WORKSPACE-OPERATIONS-SPEC.md
**Covers:** enrichment-api (backend) + enrichment-workspace (frontend) changes
**Depends on:** rows-enrichment/docs/SPEC.md (pipeline, persister, field catalog, pairing), DEV-PLAN.md (phases WS-2..WS-4)

---

## 1. Current State Inventory

### 1.1 enrichment-api — Save Dispatcher Patterns (7 existing)

| Dispatch Key | Handler | Line |
|---|---|---|
| `{create:true, fields:{...}}` | `handleCreate()` | 1002 |
| `{split:true, id:"...", allocations:[...]}` | `handleSplit()` | 1121 |
| `{merge:true, sourceIds/recordIds:"...", ...}` | `handleMerge()` | 1180 |
| `{delete:true, id:"..."}` | `handleDelete()` | 1249 |
| `{statusTransition:true, id:"...", targetStatus:"..."}` | `handleStatusTransition()` | 1291 |
| `{confirm:true, recordIds:[...]}` | `handleConfirm()` | 1407 |
| `{targetStatus:"...", recordIds:[...]}` | `handleBatchAction()` | 1353 |
| (fallback: `{id, version, ...fields}`) | `handleInlineSave()` | 1039 |

**No loan, fund, pair, period, or customer-search handlers exist yet.**

### 1.2 enrichment-workspace — UI Operation Status

| Operation | Spec § | UI Dialog | API Client | API Backend | Status |
|---|---|---|---|---|---|
| Reclassify | §2.1 | ✅ Full (1538) | ✅ saveRecord | ✅ inlineSave | **DONE** |
| Reassign Customer | §2.2 | ✅ Full (1606) | ✅ saveRecord | ✅ inlineSave | **PARTIAL** — no customer search API |
| Edit Amounts | §2.3 | ✅ Inline edit | ✅ saveRecord | ✅ inlineSave | **DONE** |
| Flip D/C | §2.4 | ✅ Full (1739) | ✅ saveRecord | ✅ inlineSave | **DONE** |
| FX Override | §2.5 | ✅ Full (1664) | ✅ saveRecord | ✅ inlineSave | **DONE** |
| GL Override | §2.6 | ❌ Stub | — | — | **NOT STARTED** |
| Processing Note | §2.7 | ✅ Detail panel | ✅ saveRecord | ✅ inlineSave | **DONE** |
| Generic Split | §3.1 | ✅ Full (1031) | ✅ splitRecord | ✅ handleSplit | **DONE** |
| Loan Payment Split | §3.2 | ✅ Full (1755) | ✅ splitLoan | ❌ No handler | **UI DONE, API MISSING** |
| Multi-Period Accrual | §3.3 | ❌ Stub | — | — | **NOT STARTED** |
| Fee Disaggregation | §3.4 | ❌ Stub | — | — | **NOT STARTED** |
| Link Loan Contract | §4.1 | ✅ Full (1836) | ✅ linkLoan (→saveRecord) | ✅ inlineSave | **PARTIAL** — no loan contract search API |
| Verify Interest | §4.2 | — | — | — | **NOT STARTED** |
| Update Outstanding Balance | §4.3a | — | — | — | **NOT STARTED** |
| Create Interest Accrual | §4.3b | — | — | — | **NOT STARTED** |
| Flag Early Repayment | §4.4 | — | — | — | **NOT STARTED** |
| Fund Allocation | §5.5 | ⚠️ Stub (1885) | ✅ allocateFund | ❌ No handler | **STUB** |
| Investor Deposit | §5.2 | — | — | — | **NOT STARTED** |
| Investor Withdrawal | §5.3 | — | — | — | **NOT STARTED** |
| NAV Calculation | §5.4 | — | — | — | **NOT STARTED** |
| Allocation Preview | §5.6 | — | — | — | **NOT STARTED** |
| Manual Pair (Secu) | §6.1 | — | — | — | **NOT STARTED** |
| Unpair | §6.2 | — | — | — | **NOT STARTED** |
| Link COMM_FEE | §6.3 | ❌ Stub | — | — | **NOT STARTED** |
| Link DIV_TAX | §6.4 | ❌ Stub | — | — | **NOT STARTED** |
| Settle Difference | §6.5 | — | — | — | **NOT STARTED** |
| Pair FX Legs | §7.1 | ❌ Stub | — | — | **NOT STARTED** |
| FX Gain/Loss | §7.3 | — | — | — | **NOT STARTED** |
| Create Accrual | §8.1 | — | — | — | **NOT STARTED** |
| Reverse Accrual | §8.2 | — | — | — | **NOT STARTED** |
| Lock Period | §8.3 | — | — | — | **NOT STARTED** |
| Reclassify Period | §8.4 | — | — | — | **NOT STARTED** |
| Bulk Mark Ready | §9.1 | ✅ Full | ✅ batchTransition | ✅ handleBatchAction | **DONE** |
| Bulk Confirm | §9.2 | ✅ Full | ✅ confirmRecords | ✅ handleConfirm | **DONE** |
| Reprocess | §9.3 | ✅ Full | ✅ batchTransition | ✅ handleBatchAction | **DONE** |
| Export CSV | §9.4 | ✅ Full | ✅ fetchAllRecords | — | **DONE** |
| Delete | — | ✅ Full | ✅ deleteRecords | ✅ handleDelete | **DONE** |
| New Manual Entry | — | ✅ Full | ✅ createRecord | ✅ handleCreate | **DONE** |
| Merge | — | ✅ Full | ✅ mergeRecords | ✅ handleMerge | **DONE** |

**Summary: 15 DONE, 3 PARTIAL, 17 NOT STARTED.**

### 1.3 Customer Display Issue (Pre-requisite Fix)

The workspace shows UUID from `resolved_customer_id` instead of human-readable `customerId`. The enrichment-api has uncommitted `resolveCustomerCodes()` JDBC code (~lines 1476–1603) that performs a 3-strategy lookup. This must be committed, built, and deployed before any customer-related operations work properly.

---

## 2. Implementation Phases

### Phase A — Pre-requisite Fixes (API)

Must be done first. All are enrichment-api changes.

#### A1. Customer Resolution (commit existing code)
- **What:** Commit the existing `resolveCustomerCodes()` and `lookupCustomerCodes()` methods in EnrichmentApiPlugin.java
- **API file:** `EnrichmentApiPlugin.java` ~lines 1476–1603 (already written, uncommitted)
- **Effect:** Records listing will return `customer_code` field with human-readable customer ID
- **UI impact:** ew-table.js already uses `customer_code` field — will work automatically after API deploy

#### A2. Customer Search Endpoint
- **What:** New dispatcher key `{customerSearch:true, query:"..."}` for type-ahead search
- **API file:** `EnrichmentApiPlugin.java` — add to `dispatchSaveParam()` (line ~965)
- **Logic:** JDBC query on `app_fd_customer` table searching `c_customerName`, `c_registrationNumber`, `c_personalId`, `c_customerFirstName`, `c_customerLastName` using LIKE. Return: id, customerId, customerName, type, kycStatus, riskCategory.
- **UI impact:** Fixes the Reassign Customer dialog (§2.2) — currently has manual ID input, should have type-ahead search

#### A3. Loan Contract List/Search Endpoint
- **What:** New dispatcher key `{loanSearch:true, query:"...", customerId:"..."}`
- **API file:** `EnrichmentApiPlugin.java` — add to `dispatchSaveParam()`
- **Logic:** JDBC query on `app_fd_loanContract` (F02.04). Filter by customerId, loanId substring, referenceNumber. Return: id, loanId, loanType, customerId, principalAmount, interestRate, interestCalcBasis, maturityDate, status, outstandingBalance.
- **UI impact:** Feeds the Loan Payment Split (§3.2) and Link Loan (§4.1) dialogs, replacing the current placeholder `fetchLoanContracts()` that returns `[]`

#### A4. Loan Split Dispatcher
- **What:** New dispatcher key `{splitLoan:true, recordId:"...", loanId:"...", principalAmount:N, interestAmount:N}`
- **API file:** `EnrichmentApiPlugin.java` — add to `dispatchSaveParam()`
- **Logic:** Reuse existing `handleSplit()` but with loan-specific child field overrides:
  - Child 1: `internal_type=LOAN_PAYMENT`, `loan_id=loanId`, amount=principalAmount
  - Child 2: `internal_type=INT_INCOME` (if C) or `INT_EXPENSE` (if D), `loan_id=loanId`, amount=interestAmount
  - Optional child 3: fee amount (remainder)
- **UI impact:** The existing `splitLoan()` API client method already sends this exact payload format — will work immediately

---

### Phase B — Core Operation Wiring (API + UI)

Operations that need both backend and frontend work.

#### ~~B1. GL Override (§2.6)~~ — REMOVED FROM SCOPE
**Reason:** F01.05 is the enrichment/preparation layer. GL account determination is a downstream
concern handled by `gl-preparator` when creating F01.06 journal entries. The GL account is derived
automatically from IntTp + D/C + customer using 01-coa-accounts.md rules. If GL overrides are ever
needed, they belong in the gl-preparator plugin, not in the enrichment workspace.
**Action:** Remove the glOverride menu item from ew-actions.js toolbar. The `gl_debit_override`,
`gl_credit_override`, `gl_override_reason` fields remain on F01.05 for potential future use but
are not exposed in the workspace UI.

#### B2. Multi-Period Accrual Split (§3.3)

| Layer | Change |
|---|---|
| **API** | Uses existing `handleSplit()` — children get different `transaction_date` values per period. Per-child field overrides already supported (Phase WS-3). |
| **UI** | New dialog: period range picker, allocation method selector (equal/day-count/manual), auto-generated period lines, running total. Remove `stub: true`. |

#### B3. Fee Disaggregation (§3.4)

| Layer | Change |
|---|---|
| **API** | Uses existing `handleSplit()` — children get different `internal_type` values (fee subtypes). Already supported. |
| **UI** | New dialog: same as Generic Split but IntTp dropdown filtered to fee types only. Can be a variant of the existing split dialog. Remove `stub: true`. |

#### B4. Link COMM_FEE to Trade (§6.3)

| Layer | Change |
|---|---|
| **API** | Uses existing `handleInlineSave()` — sets `source_reference` field on the COMM_FEE record. Need `source_reference` in `EDITABLE_FIELDS`. |
| **UI** | New dialog: extract ticker from description `\(([A-Z0-9]+)\)`, filter secu trades by ticker and date proximity, show match. On save: `saveRecord(id, {source_reference: tradeId})`. Remove `stub: true`. |

#### B5. Link DIV_TAX to Dividend (§6.4)

| Layer | Change |
|---|---|
| **API** | Same as B4 — `source_reference` field. |
| **UI** | New dialog: extract ticker from "Income tax withheld ({TICKER})", match against DIV_INCOME records. Same save pattern. Remove `stub: true`. |

#### B6. Pair FX Legs (§7.1)

| Layer | Change |
|---|---|
| **API** | New dispatcher key `{pairFX:true, legA:"id", legB:"id"}`. Handler creates a pair link (sets `source_reference` on both records pointing to each other) and transitions both to PAIRED. |
| **UI** | New dialog: show current FX_EXCHANGE record, auto-find matching opposite-leg FX_EXCHANGE (same date, opposite D/C, same rate). Show cross-check. Remove `stub: true`. |

---

### Phase C — Loan Contract Operations (API + UI + Form Changes)

#### C1. Verify Interest Calculation (§4.2) — Read-only panel

| Layer | Change |
|---|---|
| **API** | New dispatcher key `{loanDetail:true, loanId:"..."}` returning full contract details + payment history (last 5 loan-linked F01.05 records). Also calculates expected interest: `principal × rate/100 × days / basisDays`. |
| **UI** | New read-only panel in detail slide-over (not a dialog). Shows contract rate, day-count basis, outstanding principal, period, expected vs actual amount, variance indicator. |

#### C2. Update Outstanding Balance (§4.3a) — Automatic trigger

| Layer | Change |
|---|---|
| **API** | In `handleConfirm()` (line 1407): after confirming, check if record has `loan_id` set. If `internal_type` in {LOAN_PAYMENT, LOAN_DISBURSEMENT}, update F02.04 `outstandingBalance` field via FormDataDao. |
| **Form** | Add `outstandingBalance`, `lastBalanceUpdateDate`, `lastBalanceUpdateTrxId` to F02.04 |
| **UI** | No UI needed — fires automatically on confirm |

#### C3. Create Interest Accrual (§4.3b)

| Layer | Change |
|---|---|
| **API** | Uses existing `handleCreate()` — creates a manual F01.05 record with `source_tp=manual, origin=accrual, internal_type=INT_INCOME/INT_EXPENSE, loan_id=contract`. Optionally creates linked reversal record. |
| **UI** | New dialog: loan contract picker, period range, auto-calculated amount from contract terms, GL account display, auto-reverse checkbox. Creates record via `EW.api.createRecord()`. |

#### C4. Flag Early Repayment (§4.4) — Automatic check

| Layer | Change |
|---|---|
| **API** | In loan split handler (Phase A4): compare amount against contract schedule. Return `earlyRepaymentWarning` flag in response with variance details. |
| **UI** | Conditional warning banner in Loan Split dialog. Action buttons: "Split into scheduled + prepayment", "Confirm as scheduled", "Mark as full repayment". |

---

### Phase D — Fund Allocation Model (API + UI + New Forms)

This is the largest workstream. Requires 3 new Joget forms.

#### D0. Create Forms in Joget

| Form | ID | Table | Key Fields |
|---|---|---|---|
| F03.01 | `investorPosition` | `investor_position` | positionId, customerId, unitBalance, status |
| F03.02 | `navCalculation` | `nav_calculation` | navId, calculationDate, netAssetValue, navPerUnit, totalUnitsOutstanding, status |
| F03.03 | `fundAllocation` | `fund_allocation` | allocationId, sourceEnrichmentId, navId, customerId, allocationPercentage, allocatedAmount, status |

Also add to F01.05: `fund_allocation_status` (SelectBox: null / allocated / partially_allocated)

#### D1. Investor Position CRUD API

| Dispatch Key | Operation |
|---|---|
| `{investorList:true}` | List all active investor positions |
| `{investorDeposit:true, recordId, units}` | Record deposit → update unitBalance |
| `{investorWithdraw:true, recordId, units}` | Record withdrawal → update unitBalance |

#### D2. NAV Calculation API

| Dispatch Key | Operation |
|---|---|
| `{navList:true}` | List NAV calculations (most recent first) |
| `{navCreate:true, date, totalAssets, totalLiabilities, totalUnits}` | Create NAV draft |
| `{navConfirm:true, navId}` | Confirm NAV (4-eyes) |

#### D3. Fund Allocation API

| Dispatch Key | Operation |
|---|---|
| `{allocateFund:true, recordId, navId}` | Calculate proportional allocation for all investors and create F03.03 records. Returns preview first if `preview:true`. |
| `{allocationPreview:true, recordIds}` | Batch preview of allocations for multiple records |

#### D4. Fund Allocation UI

| Component | Description |
|---|---|
| **Fund Allocation dialog** | Replace stub (line 1885). NAV selector, allocation preview table (investor × units × share% × amount), confirm button. |
| **Fund nav view** | New sidebar view panels for NAV calculation, investor positions |
| **Investor deposit/withdrawal dialog** | On ASSET_RETURN where counterparty is investor: show units calculation |
| **Allocation preview modal** | Batch view before posting fund-level transactions |

---

### Phase E — Securities & Pairing (API + UI)

#### E1. Manual Pair (§6.1)

| Layer | Change |
|---|---|
| **API** | New dispatcher: `{pair:true, bankId:"...", secuId:"..."}`. Sets `pair_id` on both records, transitions both to PAIRED. |
| **UI** | New dialog: show bank SEC_BUY/SEC_SELL, auto-filter matching secu trades (same direction, amount ±5%, date ±3 days). Match quality indicators. |

#### E2. Unpair (§6.2)

| Layer | Change |
|---|---|
| **API** | New dispatcher: `{unpair:true, recordId:"..."}`. Clears `pair_id` on both records, transitions PAIRED → ENRICHED. |
| **UI** | Button in detail panel when status=PAIRED. Confirmation dialog. |

#### E3. Settlement Difference (§6.5)

| Layer | Change |
|---|---|
| **API** | Uses existing `handleSplit()` with pre-populated amounts. |
| **UI** | Triggered from PAIRED record detail when pair has non-zero discrepancy. Opens split dialog pre-filled with adjustment child. |

---

### Phase F — Period-End Operations (API + UI + New Form)

#### F0. Create Period Lock Form

| Form | ID | Table | Key Fields |
|---|---|---|---|
| F03.04 | `periodLock` | `period_lock` | period (YYYY-MM), lockedBy, lockedDate, status |

#### F1. Create Accrual Entry (§8.1)

| Layer | Change |
|---|---|
| **API** | Uses existing `handleCreate()`. Accrual-specific: creates linked reversal record if auto-reverse checked. |
| **UI** | New dialog: accrual type, related entity (loan/customer), period, amount (auto-calc for loans), reversal checkbox. |

#### F2. Reverse Accrual (§8.2)

| Layer | Change |
|---|---|
| **API** | Uses existing `handleCreate()`. Creates mirror record with opposite D/C, linked via `acc_post_id`. |
| **UI** | Button on accrual records (origin=accrual). Confirmation dialog showing original + reversal. |

#### F3. Lock Period (§8.3)

| Layer | Change |
|---|---|
| **API** | New dispatcher: `{lockPeriod:true, period:"YYYY-MM"}`. Validates all records in period are CONFIRMED/SUPERSEDED, creates F03.04 record. Guards all save operations against locked periods. |
| **UI** | New dialog in period-end panel. Shows: period, record counts by status, reconciliation status. Block if unresolved records exist. |

#### F4. Reclassify Between Periods (§8.4)

| Layer | Change |
|---|---|
| **API** | Uses existing `handleInlineSave()` — changes `transaction_date`. Validates target period not locked. |
| **UI** | Button in detail panel. Date picker constrained to unlocked periods. |

---

## 3. Priority & Dependency Order

```
Phase A (Pre-requisites)
  A1 Customer Resolution ← must deploy first
  A2 Customer Search API
  A3 Loan Contract List API
  A4 Loan Split Dispatcher
     │
Phase B (Core Operations) ── can run in parallel
  B1 GL Override
  B2 Multi-Period Accrual Split
  B3 Fee Disaggregation
  B4 Link COMM_FEE
  B5 Link DIV_TAX
  B6 Pair FX Legs
     │
Phase C (Loan) ── depends on A3, A4
  C1 Interest Verification
  C2 Outstanding Balance Update
  C3 Interest Accrual Creation
  C4 Early Repayment Flag
     │
Phase D (Fund) ── can start after A1
  D0 Create 3 Joget forms
  D1 Investor Position CRUD
  D2 NAV Calculation
  D3 Fund Allocation API
  D4 Fund Allocation UI
     │
Phase E (Securities Pairing) ── can run in parallel with C, D
  E1 Manual Pair
  E2 Unpair
  E3 Settlement Difference
     │
Phase F (Period-End) ── depends on all above
  F0 Period Lock form
  F1 Create Accrual
  F2 Reverse Accrual
  F3 Lock Period
  F4 Reclassify Period
```

---

## 4. New API Dispatcher Keys Summary

All new dispatcher keys to add to `dispatchSaveParam()` in `EnrichmentApiPlugin.java`:

| Dispatch Key | Phase | Purpose |
|---|---|---|
| `{customerSearch:true, query}` | A2 | Customer type-ahead search |
| `{loanSearch:true, query, customerId}` | A3 | Loan contract search |
| `{splitLoan:true, recordId, loanId, principalAmount, interestAmount}` | A4 | Loan payment split |
| `{loanDetail:true, loanId}` | C1 | Loan contract detail + payment history |
| `{pairFX:true, legA, legB}` | B6 | FX leg pairing |
| `{pair:true, bankId, secuId}` | E1 | Securities manual pair |
| `{unpair:true, recordId}` | E2 | Break pair |
| `{investorList:true}` | D1 | List investor positions |
| `{investorDeposit:true, recordId, units}` | D1 | Record investor deposit |
| `{investorWithdraw:true, recordId, units}` | D1 | Record investor withdrawal |
| `{navList:true}` | D2 | List NAV calculations |
| `{navCreate:true, ...}` | D2 | Create NAV draft |
| `{navConfirm:true, navId}` | D2 | Confirm NAV |
| `{allocateFund:true, recordId, navId, preview}` | D3 | Fund allocation (with preview mode) |
| `{allocationPreview:true, recordIds}` | D3 | Batch allocation preview |
| `{lockPeriod:true, period}` | F3 | Lock accounting period |

**Total: 16 new dispatcher keys** added to the 8 existing ones.

---

## 5. F01.05 Fields Used by Manual Operations

All these fields **already exist** on F01.05 (added in DEV-PLAN Phase WS-2, confirmed in EDITABLE_FIELDS):

| Field ID | Type | Phase | Purpose | Status |
|---|---|---|---|---|
| `gl_debit_override` | TextField | B1 | Manual GL debit account | ✅ Exists |
| `gl_credit_override` | TextField | B1 | Manual GL credit account | ✅ Exists |
| `gl_override_reason` | TextArea | B1 | GL override justification | ✅ Exists |
| `fund_allocation_status` | SelectBox | D3 | null / allocated / partially_allocated | ✅ Exists |
| `period_locked` | Hidden | F3 | "yes" if period is locked | ✅ Exists |
| `source_reference` | TextField | B4, B5, B6 | FK to related trade/dividend/FX leg | ✅ Exists |
| `acc_post_id` | TextField | F1, F2 | FK linking accrual ↔ reversal | ✅ Exists |
| `pair_id` | TextField | E1, E2 | FK linking paired records | ✅ Exists (used by gl-preparator pairing) |

No new F01.05 fields needed. The enrichment-api EDITABLE_FIELDS set (Phase WS-2) already includes all of these.

---

## 6. New Forms Required

| Form | Joget ID | Phase | Table |
|---|---|---|---|
| F03.01 Investor Position | `investorPosition` | D0 | `app_fd_investorPosition` |
| F03.02 NAV Calculation | `navCalculation` | D0 | `app_fd_navCalculation` |
| F03.03 Fund Allocation | `fundAllocation` | D0 | `app_fd_fundAllocation` |
| F03.04 Period Lock | `periodLock` | F0 | `app_fd_periodLock` |

---

## 7. New F02.04 (Loan Contract) Fields

| Field ID | Type | Phase | Purpose |
|---|---|---|---|
| `outstandingBalance` | TextField (numeric) | C2 | Current outstanding principal |
| `lastBalanceUpdateDate` | DatePicker | C2 | Date of last balance update |
| `lastBalanceUpdateTrxId` | TextField | C2 | FK to last confirming trxEnrichment |

---

## 8. UI API Client Methods Needed (ew-api.js)

| Method | Phase | Exists? |
|---|---|---|
| `EW.api.searchCustomers(query)` | A2 | ❌ New |
| `EW.api.searchLoanContracts(query, customerId)` | A3 | ⚠️ `fetchLoanContracts()` exists as placeholder returning `[]` |
| `EW.api.splitLoan(recordId, loanId, principal, interest)` | A4 | ✅ Already exists |
| `EW.api.linkLoan(recordId, loanId)` | — | ✅ Already exists |
| `EW.api.getLoanDetail(loanId)` | C1 | ❌ New |
| `EW.api.pairFX(legA, legB)` | B6 | ❌ New |
| `EW.api.pairSecu(bankId, secuId)` | E1 | ❌ New |
| `EW.api.unpair(recordId)` | E2 | ❌ New |
| `EW.api.listInvestors()` | D1 | ❌ New |
| `EW.api.recordInvestorDeposit(recordId, units)` | D1 | ❌ New |
| `EW.api.recordInvestorWithdrawal(recordId, units)` | D1 | ❌ New |
| `EW.api.listNavCalculations()` | D2 | ❌ New |
| `EW.api.createNavCalculation(data)` | D2 | ❌ New |
| `EW.api.confirmNav(navId)` | D2 | ❌ New |
| `EW.api.allocateFund(recordId, allocations)` | D3 | ✅ Already exists |
| `EW.api.previewAllocations(recordIds)` | D3 | ❌ New |
| `EW.api.lockPeriod(period)` | F3 | ❌ New |

---

## 9. CLAUDE.md Improvements

Both plugin CLAUDE.md files need cross-plugin awareness sections.

### enrichment-workspace/CLAUDE.md — Add:

```markdown
### Cross-plugin architecture (critical)

The workspace is UI-only. ALL data access goes through enrichment-api REST endpoints.
When a workspace feature requires data that the API doesn't provide yet, the fix belongs
in enrichment-api, NOT in the workspace plugin. Never attempt to access Joget FormDataDao,
form IDs, or database tables from the workspace plugin.

**Common pattern:** If the UI needs to display a resolved/human-readable value (e.g.,
customer name instead of UUID, loan contract details instead of loan_id), check if
enrichment-api already resolves it in its response. If not, add resolution logic to
enrichment-api first, then consume it in the workspace JS.

**Reference files in docs/:**
- `F01.05-trxEnrichment.json` — complete F01.05 form definition (52 fields)
- `F01.05-trxEnrichment-List.json` — Joget DataList config showing how the standard
  Joget list resolves FK fields (e.g., resolved_customer_id → customerId via
  FormOptionsBinder). The enrichment-api must replicate these lookups in JDBC.
- `F10.01-customer.json` — customer form showing that `customerId` is a ConcatField
  of `personalId` + `registrationNumber`, not a simple stored field.
```

### enrichment-api/CLAUDE.md — Add:

```markdown
### Cross-plugin architecture (critical)

The enrichment-api is the ONLY data access layer for the enrichment-workspace UI plugin.
The workspace JS calls this API via fetch(). When the workspace needs new data or new
operations, the changes go here first (new dispatcher key), then the workspace wires the UI.

**Customer resolution:** The `resolveCustomerCodes()` method performs JDBC lookup on
`app_fd_customer` to convert UUID (resolved_customer_id) → human-readable customerId.
The F10.01 customer form's `customerId` field is a ConcatField of `personalId` +
`registrationNumber`. See enrichment-workspace/docs/F10.01-customer.json.

**Reference files:**
- `enrichment-workspace/docs/F01.05-trxEnrichment-List.json` — shows how Joget natively
  resolves FK fields via FormOptionsBinder. The API must replicate these lookups in JDBC.
```

---

## 10. Effort Estimates

| Phase | API Effort | UI Effort | Form Changes | Total |
|---|---|---|---|---|
| A (Pre-requisites) | Medium (4 dispatchers) | Small (search wiring) | None | 2–3 days |
| B (Core Ops) | Small (mostly reuse) | Medium (6 dialogs) | 3 F01.05 fields | 3–4 days |
| C (Loan) | Medium (3 features) | Medium (3 panels) | 3 F02.04 fields | 3–4 days |
| D (Fund) | Large (6 dispatchers) | Large (4 panels + view) | 3 new forms + 1 field | 5–7 days |
| E (Securities) | Medium (3 dispatchers) | Medium (2 dialogs) | None | 2–3 days |
| F (Period-End) | Medium (2 dispatchers) | Medium (3 dialogs) | 1 new form + 1 field | 3–4 days |
| **Total** | | | | **18–25 days** |

---

## 11. Cross-References to rows-enrichment SPEC.md

The rows-enrichment `SPEC.md` defines the automated pipeline that runs BEFORE manual workspace operations. Key dependencies:

| SPEC.md Section | Relevance to Manual Operations |
|---|---|
| §2 Execution Flow | Manual operations apply AFTER pipeline enrichment. Status guards prevent manual changes to records still in pipeline (NEW, PROCESSING). |
| §3.3 CustomerIdentificationStep | Sets `resolved_customer_id`, `customer_code`, `customer_match_method`. Reassign Customer (§2.2) overrides these to `MANUAL`. |
| §3.5 F14RuleMappingStep | Sets `internal_type`, `type_confidence`, `matched_rule_id`. Reclassify (§2.1) overrides these. |
| §3.6 BankAssetHintStep | Sets asset fields for bank DIV/INT. Persister fix (§4.5 in BANK-ASSET-HINT-SPEC.md) required for these to persist. |
| §3.7 LoanResolutionStep | Sets `loan_id`, `loan_direction`, `loan_resolution_method`. Link Loan (§4.1) overrides to `MANUAL`. |
| §3.8 FXConversionStep | Sets `fx_rate_to_eur`, `fx_rate_date`, `fx_rate_source`. FX Override (§2.5) overrides these. |
| §4 Persister | `EnrichmentDataPersister.buildEnrichmentRow()` — all F01.05 fields and their guards. The `isSecu` guard on asset block affects bank transactions. |
| §5 Pairing | `TransactionPairingStep` sets `pair_id` and status→PAIRED. Manual Pair (§6.1) and Unpair (§6.2) must follow the same `pair_id` conventions used by gl-preparator. |

**Important:** The `gl-preparator` plugin also reads/writes `pair_id` on F01.05 records (see `EnrichmentStatusUpdater.java` and `TransactionPairPersister.java`). Any manual pairing/unpairing must be compatible with gl-preparator's expectations.

---

## 12. Implementation Notes for Claude Code

When implementing any operation, follow this checklist:

1. **Check if API dispatcher exists** — search `dispatchSaveParam()` in `EnrichmentApiPlugin.java`
2. **Check if API client method exists** — search `EW.api.` in `ew-api.js`
3. **Check if UI dialog exists** — search action handler in `ew-actions.js`
4. **Check if form fields exist** — look at F01.05 form definition in `docs/F01.05-trxEnrichment.json`
5. **Check EDITABLE_FIELDS** — in `EnrichmentService.java`, any new field must be added to the editable set
6. **Bump VERSION** — in `EnrichmentWorkspaceMenu.java` for cache busting after any JS/CSS change
7. **Build both plugins** — `mvn clean package` in both enrichment-api/ and enrichment-workspace/
8. **Deploy both JARs** — via Joget Plugin Manager

**Never attempt to read Joget forms or database tables from the workspace plugin.**
The workspace is UI-only; all data access goes through enrichment-api.
