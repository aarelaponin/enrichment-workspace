# Enrichment Workspace — Gap Analysis

**Date:** 2026-03-08
**Scope:** Holistic readiness assessment for enrichment-workspace implementation
**Inputs:** WORKSPACE-OPERATIONS-SPEC.md, enrichment-api codebase, UI prototype v2, form definitions

---

## 1. Architecture Verdict: Clean Separation ✓

The current architecture is **sound**. The enrichment-workspace JS code has zero knowledge of Joget forms — it only talks to the enrichment-api via REST, using abstract field identifiers (`statement_id`, `transaction_date`, etc.). The enrichment-api properly encapsulates all FormDataDao interactions.

```
Browser (workspace JS)  ──HTTP REST──▸  enrichment-api  ──FormDataDao──▸  Joget Forms
     ↑                                      ↑                                ↑
  Knows only field names            Knows form table names          F01.05, F02.04, F03.xx
  and API endpoints                 and field mappings
```

**This must be preserved.** Every new operation below must go through the enrichment-api. The workspace must never import or reference form IDs.

---

## 2. Enrichment-API: Current vs Required

### What EXISTS (12 endpoints, ~11% of spec)

| # | Endpoint | Purpose |
|---|----------|---------|
| 1 | `GET /health` | Health check |
| 2 | `GET /records` | Paginated listing with filters/sort |
| 3 | `GET /records/{id}` | Single record |
| 4 | `PUT /records/{id}` | Inline edit with optimistic locking |
| 5 | `POST /records/{id}/status` | Single status transition |
| 6 | `POST /records/status` | Batch status transition |
| 7 | `DELETE /records/{id}` | Delete (status-restricted) |
| 8 | `GET /summary` | Per-statement summary counts |
| 9 | `GET /reconciliation/{stmId}` | Per-currency reconciliation |
| 10 | `POST /records/confirm` | Batch confirm (READY → CONFIRMED) |
| 11 | `POST /records/{id}/split` | Generic split with amount allocation |
| 12 | `POST /records/merge` | Merge multiple into one |

Generic `PUT /records/{id}` can handle reclassify, reassign customer, flip D/C, edit amounts, and FX override as field updates — but **without business logic validation** (e.g., no interest calculation for loan splits, no investor proportion checks for fund allocation).

### What is MISSING — grouped by priority

#### Priority 1: Loan Operations (MVP — most common user workflow)

| Endpoint | Purpose | Why needed |
|----------|---------|------------|
| `POST /records/{id}/split-loan` | Loan payment split into principal + interest | Must look up loan contract, calculate expected interest, validate variance |
| `PUT /records/{id}/link-loan` | Link transaction to loan contract | Must validate contract exists, currency matches, contract is active |
| `GET /loan-contracts` | List available loan contracts | Workspace needs to show contract picker — **but workspace must not query F02.04 directly** |
| `GET /loan-contracts/{id}` | Get contract details | For displaying contract card in split dialog |
| `GET /records/{id}/verify-interest` | Calculate expected interest | Uses contract rate, outstanding balance, day-count basis |

**Key architectural issue:** The workspace needs loan contract data (for the contract picker, split dialog, interest verification). Currently there is no way to get this through the enrichment-api. Either:

- **Option A:** Add loan-related read endpoints to enrichment-api (it becomes a gateway)
- **Option B:** Create a separate `loan-api` plugin that the workspace also calls
- **Option C:** The enrichment-api's split-loan endpoint accepts a `loanId` parameter and internally resolves the contract

**Recommendation:** Option A for reads (GET loan-contracts), Option C for writes (split-loan resolves internally). This keeps the workspace with a single API dependency while the enrichment-api orchestrates cross-form operations.

#### Priority 2: Fund Allocation Operations

| Endpoint | Purpose | Why needed |
|----------|---------|------------|
| `GET /fund/investors` | List investor positions | Workspace needs investor table for allocation preview |
| `GET /fund/nav` | Get current/historical NAV | Required for allocation calculation |
| `POST /fund/nav` | Create NAV calculation | Period-end workflow |
| `POST /records/{id}/allocate-fund` | Allocate fund transaction to investors | Proportional split based on unit holdings |
| `POST /fund/investors/{id}/deposit` | Record investor deposit (units) | Changes unit balance |
| `POST /fund/investors/{id}/withdrawal` | Record investor withdrawal | Changes unit balance |

**Critical prerequisite gap:** The entire fund data model (F03.01, F03.02, F03.03) does not exist yet. See §3 below.

#### Priority 3: Securities & Pairing

| Endpoint | Purpose | Why needed |
|----------|---------|------------|
| `POST /records/{id}/pair` | Manual pair bank↔securities | Links two transactions with pair_id |
| `POST /records/{id}/unpair` | Remove pairing | Clears pair_id |
| `POST /records/{id}/link-fee` | Link COMM_FEE to a trade | Associates fee with originating SEC_BUY/SELL |
| `POST /records/{id}/link-tax` | Link DIV_TAX to dividend | Associates tax withholding with DIV_INCOME |

These are relatively simple — they update `pair_id` and related fields. The enrichment-api's generic `PUT` could handle this, but dedicated endpoints provide validation (e.g., pair must be opposite D/C, same asset, same date range).

#### Priority 4: Period-End & Batch

| Endpoint | Purpose |
|----------|---------|
| `POST /records/create-accrual` | Create accrual entry (manual origin) |
| `POST /records/reverse-accrual` | Reverse prior period accrual |
| `POST /periods/{period}/lock` | Lock period (prevent edits) |
| `POST /records/batch-ready` | Bulk mark as ready |
| `POST /records/re-enrich` | Reset and re-run enrichment pipeline |
| `GET /records/export` | Export filtered records as CSV |

---

## 3. Missing Data Infrastructure

### 3A. Fund Management Forms — DO NOT EXIST

The WORKSPACE-OPERATIONS-SPEC.md §5 specifies three new forms. **None have been created:**

| Form | ID | Purpose | Status |
|------|----|---------|--------|
| Investor Position | F03.01 | Track investor unit balances | ❌ Not created |
| NAV Calculation | F03.02 | Period NAV snapshots | ❌ Not created |
| Fund Allocation | F03.03 | Per-investor transaction allocations | ❌ Not created |

**What needs to happen:**
1. Create F03.01, F03.02, F03.03 form definitions (JSON)
2. Deploy forms to Joget (creates database tables)
3. Add fund endpoints to enrichment-api (or create fund-api plugin)
4. Wire workspace JS to call fund endpoints

### 3B. Missing Fields on Existing Forms

**F01.05 trxEnrichment — missing 3 fields from §11:**

| Field | Type | Purpose |
|-------|------|---------|
| `gl_debit_override` | TextField | Manual GL account override |
| `gl_credit_override` | TextField | Manual GL account override |
| `gl_override_reason` | TextArea | Audit trail for GL override |

Note: `fund_allocation_status` already exists in schema but is dormant (no code reads/writes it).

**F02.04 Loan Contract — missing 3 fields from §13:**

| Field | Type | Purpose |
|-------|------|---------|
| `outstandingBalance` | Numeric | Current outstanding principal |
| `lastBalanceUpdateDate` | DatePicker | When balance was last updated |
| `lastBalanceUpdateTrxId` | TextField | FK to confirming trxEnrichment record |

These are needed for the loan payment split to calculate expected interest and update the balance after confirmation.

---

## 4. Frontend vs Backend Responsibility Distribution

### What MUST be backend (enrichment-api)

| Operation | Why backend |
|-----------|-------------|
| Split (generic + loan) | Amount validation, parent supersede, child creation — must be atomic |
| Merge | Multi-record atomicity, field resolution |
| Confirm for posting | Reconciliation check, validation gates, status transition — must be transactional |
| Fund allocation | Proportional calculation, rounding adjustment, multi-table write (F01.05 + F03.03) |
| Link to loan contract | Cross-form lookup (F02.04), validation |
| Interest verification | Calculation using contract terms (rate, basis, outstanding) |
| Period lock | Must enforce across all records in period |
| Status transitions | StatusManager validation, audit trail |
| Optimistic locking | Version conflict detection |
| Record creation | Generates IDs, sets origin, timestamps |
| Re-enrich | Triggers pipeline re-run |

### What CAN be frontend (workspace JS)

| Operation | Why frontend is OK |
|-----------|-------------------|
| Filter/sort/search | Already implemented — pure UI state |
| Column visibility toggle | UI preference |
| Summary collapse toggle | UI preference (just implemented) |
| Reclassify type | Simple field update via `PUT /records/{id}` — but frontend should show type suggestions |
| Reassign customer | Simple field update — but frontend should show customer search/picker |
| Flip D/C | Simple field update |
| FX rate override | Simple field update — but frontend should show rate comparison |
| GL account override | Simple field update (once fields exist) |
| Add processing notes | Simple field update |
| Selection management | Checkboxes, multi-select — pure UI |
| Detail panel rendering | Read-only display of record data |
| Context-aware suggestions | "This payment can be split" ribbons — UI logic based on transaction type |
| Export preview | Frontend generates CSV from current view |

### Gray area — needs design decision

| Operation | Options |
|-----------|---------|
| **Interest calculation preview** | Option A: Frontend JS calculates (simple formula, fast) vs Option B: Backend calculates (authoritative, uses contract data). **Recommendation:** Backend provides calculation via `GET /verify-interest`, frontend displays it. |
| **Allocation preview** | Option A: Frontend calculates proportions (simple math) vs Option B: Backend calculates (handles rounding, authoritative). **Recommendation:** Frontend shows preview (fast feedback), backend validates on confirm. |
| **Loan contract search** | Option A: Frontend calls enrichment-api which proxies to loan data vs Option B: Frontend calls a separate loan-api. **Recommendation:** Option A — single API dependency. |
| **Customer search** | Similar to loan contracts — workspace needs customer lookup. **Recommendation:** Add `GET /customers?search=` endpoint to enrichment-api. |

---

## 5. Specification Gaps

### 5A. The Spec says things the API doesn't specify

The WORKSPACE-OPERATIONS-SPEC.md describes operations but doesn't define:

1. **API contracts** — No REST endpoint definitions for the new operations (request/response schemas)
2. **Error handling** — What happens when loan split interest variance exceeds threshold?
3. **Permissions** — Which operations require which user roles?
4. **Concurrency** — What if two users try to allocate the same fund transaction?
5. **Undo** — Can a fund allocation be reversed? Under what conditions?

### 5B. The UI prototype shows things the Spec doesn't cover

1. **Customer search with KYC/risk display** — Where does this data come from?
2. **Contract auto-suggestion from description** — What matching algorithm?
3. **Fund allocation rounding rules** — Largest-investor adjustment is mentioned but not formalized
4. **Batch fund allocation** — The UI shows "Allocate Selected" but the spec only describes single-transaction allocation

### 5C. Neither Spec nor UI addresses

1. **Posting to GL** — The confirm step makes records CONFIRMED, but what creates actual journal entries?
2. **Posting to loan contracts** — After confirming a loan payment split, who updates the outstanding balance on F02.04?
3. **Posting to fund positions** — After confirming a fund allocation, who updates investor unit balances on F03.01?
4. **Reversal handling** — If a confirmed record is later found to be wrong, what's the reversal workflow?
5. **Multi-currency fund** — The fund holds USD and EUR assets; how does NAV handle this?
6. **Audit trail** — Who changed what, when? The version field exists but there's no change history endpoint.

---

## 6. Implementation Roadmap — What to Build Next

### Phase A: Complete Loan Workflow (highest customer value)

1. Add missing fields to F02.04 (outstandingBalance, lastBalanceUpdateDate, lastBalanceUpdateTrxId)
2. Add to enrichment-api: `GET /loan-contracts`, `GET /loan-contracts/{id}`, `POST /records/{id}/split-loan`, `GET /records/{id}/verify-interest`
3. Add to enrichment-api: `PUT /records/{id}/link-loan`
4. Wire workspace JS: loan split dialog calls new endpoints, contract picker populates from API

### Phase B: Build Fund Infrastructure (new capability)

1. Create F03.01, F03.02, F03.03 form definitions in Joget
2. Seed initial investor data (the 3 investors from the prototype)
3. Add to enrichment-api: `GET /fund/investors`, `GET /fund/nav`, `POST /fund/nav`, `POST /records/{id}/allocate-fund`
4. Wire workspace JS: Fund Allocation sidebar view, allocation dialog

### Phase C: Securities Pairing & Linking

1. Add to enrichment-api: `POST /records/{id}/pair`, `/unpair`, `/link-fee`, `/link-tax`
2. Wire workspace JS: pairing dialog, fee/tax linking

### Phase D: Supporting Operations

1. Add `GET /customers?search=` to enrichment-api (customer search for reassign dialog)
2. Add missing GL override fields to F01.05
3. Add `POST /records/create-accrual`, `POST /records/reverse-accrual`
4. Add `GET /records/export`

### Phase E: Posting Pipeline (beyond enrichment-workspace scope)

1. Design GL posting plugin (reads CONFIRMED records, creates journal entries)
2. Design loan balance updater (post-confirmation hook updates F02.04 outstanding balance)
3. Design fund position updater (post-confirmation hook updates F03.01 unit balances)

---

## 7. Summary Scorecard

| Area | Status | Readiness |
|------|--------|-----------|
| Architecture (workspace → API → forms) | ✅ Excellent | Ready |
| Enrichment-API CRUD + split/merge/confirm | ✅ Solid | Ready |
| Loan contract form (F02.04) | ⚠️ Exists but missing 3 fields | Needs update |
| Loan operations in API | ❌ Not implemented | Needs Phase A |
| Fund forms (F03.01–03) | ❌ Do not exist | Needs Phase B |
| Fund operations in API | ❌ Not implemented | Needs Phase B |
| Securities pairing in API | ❌ Not implemented | Needs Phase C |
| Customer search in API | ❌ Not implemented | Needs Phase D |
| GL override fields on F01.05 | ❌ Missing 3 fields | Needs Phase D |
| Frontend/backend split | ✅ Clear | Ready |
| Posting pipeline (GL, loans, fund) | ❌ Not designed | Needs Phase E |
| Workspace UI prototype | ✅ Comprehensive | Ready |
| Workspace JS implementation | ⚠️ Phase 3 of 8 | In progress |
