# Enrichment Workspace — Consolidated Specification

**Plugin**: enrichment-workspace v2.0
**Type**: Joget DX 8.1 UserviewMenu Plugin
**Service Class**: `org.joget.gam.enrichment.ui.EnrichmentWorkspaceMenu`
**Companion**: enrichment-api v1.0 (REST data contract)
**Date**: 2026-03-08
**Supersedes**: enrichment-workspace-specification.md (v1.0.0, 2026-03-03), WORKSPACE-OPERATIONS-SPEC.md (v1.0, 2026-03-08), ENRICHMENT-WORKSPACE-GAP-ANALYSIS.md

---

## Table of Contents

1. [Architecture & Principles](#1-architecture--principles)
2. [UI Layout & Navigation](#2-ui-layout--navigation)
3. [Views & Column Definitions](#3-views--column-definitions)
4. [Summary Dashboard](#4-summary-dashboard)
5. [Toolbar & Selection](#5-toolbar--selection)
6. [Detail Panel (Slide-Over)](#6-detail-panel-slide-over)
7. [Field Editability Matrix](#7-field-editability-matrix)
8. [Operations Catalog](#8-operations-catalog)
9. [Status Lifecycle & Transitions](#9-status-lifecycle--transitions)
10. [Data Model](#10-data-model)
11. [API Contract](#11-api-contract)
12. [Frontend / Backend Responsibility Split](#12-frontend--backend-responsibility-split)
13. [Plugin Configuration](#13-plugin-configuration)
14. [Loading Sequence & Session State](#14-loading-sequence--session-state)
15. [Error Handling & Feedback](#15-error-handling--feedback)
16. [Deployment Checklist](#16-deployment-checklist)
17. [Implementation Status & Roadmap](#17-implementation-status--roadmap)

---

## 1. Architecture & Principles

### 1.1 Single Responsibility

The enrichment-workspace is a **UI-only plugin**. It renders the manual enrichment interface where back-office users review, adjust, and approve enriched transactions before posting. It:

**DOES**: Render views, tables, detail panels, dialogs; manage UI state (selection, filters, pagination); launch operation dialogs; display validation feedback and reconciliation panels.

**DOES NOT**: Create/update database records directly; interact with Joget forms (F01.05, F02.04, F03.xx); manage user roles or access control; trigger GL posting or pipeline processing.

### 1.2 Strict API Dependency

```
Browser (workspace JS)  ──HTTP REST──▶  enrichment-api  ──FormDataDao──▶  Joget Forms
```

All data operations — reads, writes, status transitions, splits, merges, confirmations, loan operations, fund allocation — flow through the enrichment-api REST plugin. The workspace never imports or references form IDs, table names, or FormDataDao. This separation must be preserved for every new operation.

### 1.3 Framework Integration

- Status badges use gam-framework `Status` enum values
- Status transitions respect gam-framework `StatusManager` rules
- Field visibility and editability align with status-based permissions
- Audit fields use gam-framework tracking
- Cross-references: gam-framework-specification.md, enrichment-api-specification.md

### 1.4 Design System

- Font: Segoe UI / Helvetica Neue / Arial
- Background: #f1f5f9 (light gray)
- Sidebar: #1a365d (dark blue)
- Accent: #6ee7b7 (green, active items)
- Primary button: #1a365d
- Danger button: #dc2626
- Success: #16a34a
- Warning: #d97706
- All badges use per-status color map (see §9.3)
- Reference prototype: enrichment-workspace-v2.html

---

## 2. UI Layout & Navigation

### 2.1 Page Structure

```
┌──────────┬────────────────────────────────────────┐
│          │  Top Bar: Title, version, period, count │
│  Side-   ├────────────────────────────────────────┤
│  bar     │  Summary Dashboard (collapsible §4)     │
│  Nav     ├────────────────────────────────────────┤
│          │  Toolbar (§5)                           │
│  §2.2    ├────────────────────────────────────────┤
│          │  Filters bar                            │
│          ├────────────────────────────────────────┤
│          │  Transaction Table (§3)                 │
│          │                                         │
│          ├────────────────────────────────────────┤
│          │  Pagination                             │
└──────────┴────────────────────────────────────────┘
```

### 2.2 Sidebar Navigation

The sidebar is implemented by joget; the enrichment workspace is a custom view in the joget UI Builder.

### 2.3 Top Bar

Displays: page title (with version badge), period range (e.g., "Jun–Aug 2024"), total record count, load time. When a statement filter is active, shows filter indicator with clear link.

---

## 3. Views & Column Definitions

### 3.1 Workspace View (Primary)

**Filter**: All active statuses except `superseded` and `confirmed`.
**Has checkboxes**: Yes
**Has toolbar**: Yes
**Row click**: Opens detail panel (§6)

| # | Column | Field | Width | Sortable | Renderer |
|---|--------|-------|-------|----------|----------|
| 1 | ☐ | _check | 34px | No | Checkbox |
| 2 | Status | status | 82px | Yes | Status badge (§9.3) |
| 3 | Src | source_tp | 36px | Yes | Source badge (B/S/M) |
| 4 | Date | transaction_date | 78px | Yes | YYYY-MM-DD |
| 5 | Type | internal_type | 108px | Yes | Type badge with category color + loan/fund icons |
| 6 | Description | description | flex | Yes | Truncated 56 chars, link-styled, click opens detail |
| 7 | D/C | debit_credit | 32px | Yes | D (red) / C (green) / N (gray) |
| 8 | Amount | original_amount | 90px | Yes | Monospace, right-aligned, negative=red |
| 9 | Fee | fee_amount | 68px | Yes | Monospace, right-aligned |
| 10 | Total | total_amount | 94px | Yes | Monospace, right-aligned, bold |
| 11 | Ccy | validated_currency | 36px | Yes | Bold |
| 12 | Customer | customer_code | 76px | Yes | Fund customer (bold blue), UNK (red warning), missing (muted) |
| 13 | Asset | resolved_asset_id | 52px | Yes | Muted dash if empty |
| 14 | CP | counterparty_short_code | 36px | Yes | Muted dash if empty |
| 15 | Origin | origin | 48px | No | Text (auto/split/merge/manual) |
| 16 | Conf. | type_confidence | 66px | Yes | Confidence badge |

**Row tinting**: error → #FFF5F5 (light red), manual_review → #FFFDE7 (light yellow), ready → #F1F8E9 (light green), paired → #f5f5ff (light indigo), selected → #eff6ff (light blue).

**Type badge categories** (color-coded by domain):

| Category | Types | Badge color |
|----------|-------|-------------|
| loan | LOAN_PAYMENT, LOAN_DISBURSEMENT, INT_INCOME, INT_EXPENSE | Amber (#fef3c7 / #92400e) |
| sec | SEC_BUY, SEC_SELL, EQ_BUY, EQ_SELL, BOND_BUY, BOND_INT, SPLIT_IN, SPLIT_OUT | Indigo (#e0e7ff / #3730a3) |
| fund | DIV_INCOME, DIV_TAX, ASSET_RETURN, INV_INCOME | Blue (#dbeafe / #1e40af) |
| fx | FX_EXCHANGE | Green (#d1fae5 / #065f46) |
| fee | COMM_FEE, MGMT_FEE, ADMIN_FEE, LEGAL_FEE, TAX | Pink (#fce7f3 / #9d174d) |

**Inline icons** (after type badge):
- 🔗 when `loan_id` is populated (linked to loan contract)
- 📊 when transaction is fund-type and not yet allocated

### 3.2 Ready for Posting View

**Filter**: `status = ready` only
**Has checkboxes**: Yes
**Toolbar**: Confirm for Posting, Return to Workspace
**Columns**: Same as workspace minus Status and Origin columns.

### 3.3 Posting Queue View

**Filter**: `posting_status IN (pending, error)`
**Has checkboxes**: Yes
**Toolbar**: Revoke, Retry
**Columns**: Status, Date, Type, Description, D/C, Total, Ccy, Customer, Asset, CP, Confirmed By, Conf. Date

### 3.4 Posted Operations View

**Filter**: `posting_status = posted`
**Read-only**: No checkboxes, no toolbar
**Columns**: Posted Date, Trx Date, Type, Description, D/C, Total, Ccy, EUR Amount, Customer, Asset, CP, Journal Ref, Posted By

### 3.5 Split/Merge History View

**Filter**: `origin IN (split, merge)`
**Read-only**: No checkboxes, no toolbar
**Columns**: Origin (badge), Status, Group ID (monospace), Seq, Date, Src, Type, Description, Total, Ccy, Customer, Lineage Note, Created At

### 3.6 Fund Allocation View

**Filter**: Fund transactions (customer_code = fund customer OR is_fund flag) with status not paired/confirmed
**Has checkboxes**: Yes
**Toolbar**: Allocate Selected
**Columns**: Checkbox, Date, Type, Description, D/C, Amount, Ccy, Allocation Status (pending/allocated)

### 3.7 NAV Calculation View

**Source**: F03.02 navCalculation via enrichment-api
**Toolbar**: + New NAV Calculation
**Columns**: Date, Total Assets, Total Liabilities, NAV, Units Outstanding, NAV/Unit, Status, By

### 3.8 Investor Positions View

**Source**: F03.01 investorPosition via enrichment-api
**Toolbar**: + Add Investor
**Columns**: Investor Name, Units, Share %, Value (at NAV), Since Date, Status
**Footer row**: Totals

### 3.9 Loan Contracts View

**Source**: F02.04 loanContract via enrichment-api
**Read-only**: Informational reference
**Columns**: Contract ID, Type, Customer, Principal, Outstanding, Rate %, Basis, Maturity, Status

### 3.10 Filters Bar

Available across workspace, ready, and fund allocation views:

| Filter | Type | Options |
|--------|------|---------|
| Status | Select | All active / enriched / paired / adjusted / in_review / ready / manual_review / error |
| Source | Select | All / Bank (B) / Securities (S) / Manual (M) |
| Type | Select | All / each of the 17+ IntTp values |
| Customer | Text input | Customer ID search |
| Description | Text input | Substring search |
| Fund only | Checkbox | Show only fund transactions |
| Loan only | Checkbox | Show only loan transactions |

---

## 4. Summary Dashboard

The summary dashboard is **collapsible** (toggle button with chevron). When collapsed, shows a compact one-line mini-summary with colored dots.

### 4.1 KPI Cards (top row)

| Card | Value | Sub-text | Color |
|------|-------|----------|-------|
| Total Records | Count | "{enriched} enriched · {paired} paired" | Default |
| Automation Rate | Percentage | "{auto}/{total} auto-enriched" | Green when ≥95% |
| Loan Transactions | Count | "{linked} linked to contracts" | Default |
| Fund Transactions | Count | "Customer {fundId} — needs allocation" | Default |
| Needs Attention | Count | "Missing/unknown customer" | Amber (shown only if >0) |

### 4.2 Statement Overview Table

| Column | Content |
|--------|---------|
| Statement | Name + ID |
| Source | Badge (B/S) |
| Records | Total count (bold) |
| Enriched | Count (green if >0) |
| Paired | Count (indigo if >0) |
| Ready | Count (dark green, bold if >0) |
| Confirmed | Count (green if >0) |
| Errors | Count (red, bold, ⚠ prefix if >0) |

Clicking a statement row filters the workspace table below to that statement. "Click a statement row to filter the workspace below" hint shown.

### 4.3 Collapsed State

When collapsed, the toggle bar shows: "Overview" label + mini-summary with colored dots: "{n} records · {pct}% auto · {n} loan · {n} fund · {n} attention"

---

## 5. Toolbar & Selection

### 5.1 Workspace Toolbar

Layout (left to right):

```
[✓ Confirm] [→ Mark Ready]  |  [⑂ Split ▾] [⊕ Merge]  |  [⚡ Operations ▾]  |  [↻ Reprocess] [× Delete]  ··spacer··  [＋ New Entry] [📥 Export]  [N selected]
```

**Button enable/disable rules**:

| Button | Enabled when |
|--------|-------------|
| Confirm | Any selected has status = `ready` |
| Mark Ready | Any selected has status in `[enriched, adjusted, in_review, paired]` |
| Split ▾ | Exactly 1 selected, status in `[enriched, adjusted, in_review, ready]` |
| Merge | 2+ selected, ALL status in `[enriched, adjusted, in_review]` |
| Operations ▾ | Exactly 1 selected, status is editable |
| Reprocess | Any selected has status in `[error, manual_review]` |
| Delete | Any selected has status in `[error, manual_review]` |
| New Entry | Always enabled |
| Export | Always enabled |

### 5.2 Split Dropdown

| Item | Icon | Condition | Description |
|------|------|-----------|-------------|
| Generic Split | ⑂ | Always | Split into N children with manual amount allocation |
| Loan Payment Split | 🏦 | Selected is LOAN_PAYMENT type | Split into principal + interest with contract lookup |
| Multi-Period Accrual | 📅 | — | Split across accounting periods (future) |
| Fee Disaggregation | 💰 | — | Split bundled fees into components (future) |

### 5.3 Operations Dropdown

| Item | Icon | Condition | Description |
|------|------|-----------|-------------|
| Reclassify Type | 🏷 | Editable | Change internal_type with reason |
| Reassign Customer | 👤 | Editable | Change customer with type-ahead search |
| Flip D/C | ↕ | Editable | Swap debit/credit direction |
| — separator — | | | |
| Override FX Rate | 💱 | Editable | Override pipeline FX rate |
| Override GL Account | 📒 | Editable | Override GL debit/credit accounts |
| — separator — | | | |
| Link to Loan Contract | 🔗 | Loan type | Associate with F02.04 contract |
| Allocate to Investors | 📊 | Fund transaction | Proportional split to investors |
| Pair FX Legs | 🔄 | FX_EXCHANGE type | Link opposite D/C FX legs |
| Link Fee to Trade | 📎 | COMM_FEE type | Associate fee with originating trade |
| Link Tax to Dividend | 📎 | DIV_TAX type | Associate tax with dividend income |

Items with unmet conditions are shown at 50% opacity with pointer-events disabled.

### 5.4 Ready View Toolbar

```
[✓ Confirm for Posting]  [Return to Workspace]
```

### 5.5 Selection Management

- Row checkboxes toggle individual selection
- Header checkbox toggles select-all for current page
- Selection count badge updates in real-time
- Selection clears on tab switch, filter change, or after successful action
- `wsSel` Set tracks selected IDs in memory

---

## 6. Detail Panel (Slide-Over)

### 6.1 Invocation

Opens when user clicks a description link in the transaction table. Slides in from the right (620px width, animation: translateX 0.2s).

### 6.2 Panel Layout

```
┌──────────────────────────────────────────────────┐
│  Header: "Enrichment Record" / ENR-xxx [Type] [Status] ✕  │
├──────────────────────────────────────────────────┤
│  Context Ribbons (conditional, §6.3)                       │
│  Operation Button Bar (§6.4)                               │
├──────────────────────────────────────────────────┤
│  §1 Traceability (collapsed by default)                    │
│  §2 Transaction (expanded)                                 │
│  §3 Classification (expanded)                              │
│  §4 Currency & FX (collapsed)                              │
│  §5 Resolved Entities (collapsed)                          │
│  §6 Loan Contract (conditional — shown when loan_id set)   │
│  §7 Fund Allocation (conditional — shown for fund trx)     │
│  §8 Status & Notes (expanded)                              │
├──────────────────────────────────────────────────┤
│  Footer: [Save] [Close]  ·····  [→ Mark Ready] / [↩ Return] │
└──────────────────────────────────────────────────┘
```

### 6.3 Context-Aware Ribbons

Displayed above the operation bar, alerting user to suggested actions:

| Condition | Color | Message | Action Button |
|-----------|-------|---------|---------------|
| Loan type, no loan_id | Amber (#fffbeb) | "Loan transaction not linked to a contract" | Link Contract |
| LOAN_PAYMENT with loan_id | Blue (#eff6ff) | "This payment can be split into principal + interest" | Loan Split |
| Fund transaction, not paired | Blue (#eff6ff) | "Fund transaction — allocate to investors" | Allocate |
| customer_code = "UNK" | Amber (#fffbeb) | "Customer is unknown — needs reassignment" | Reassign |

### 6.4 Operation Button Bar

Context-sensitive quick-action buttons inside the detail panel (shown only when record is editable):

- **Always**: Reclassify, Reassign, Split
- **Loan types**: Loan Split (highlighted blue border)
- **Fund transactions**: Fund Alloc (highlighted blue border)
- **Non-EUR currency**: FX Override

### 6.5 Section Definitions

Each section is a collapsible accordion with §N number badge, title, and ▾/▸ toggle.

**§1 Traceability** (RO always): source_tp, enrichment_id, statement_id
**§2 Transaction** (editable per matrix): transaction_date, settlement_date, debit_credit, original_amount, fee_amount, total_amount, description
**§3 Classification** (partially editable): internal_type (editable, type badge), type_confidence (RO badge), matched_rule_id (RO)
**§4 Currency & FX** (partially editable): validated_currency, fx_rate_to_eur (editable for non-EUR), fx_rate_source, base_amount_eur (RO computed)
**§5 Resolved Entities** (editable per matrix): customer_code, resolved_customer_id, resolved_asset_id, counterparty_id, counterparty_short_code
**§6 Loan Contract** (conditional, RO): Embedded contract card showing contract ID, customer, outstanding balance, interest rate, day-count basis, maturity date. Only shown when loan_id is populated.
**§7 Fund Allocation** (conditional): Shows allocation status. If not allocated, shows warning + "Allocate to Investors" button. If allocated, shows investor breakdown table.
**§8 Status & Notes**: status (RO badge), origin (RO), version (RO), processing_notes (always editable)

### 6.6 Save Flow

1. User clicks Save
2. `collectFormData()` diffs against original record — only changed fields included
3. Payload: `{ id, version, ...changedFields }`
4. Call `PUT /records/{id}` via enrichment-api
5. Success → toast, close panel, refresh table
6. Version conflict (409) → toast "Record modified by another user", auto-reload panel
7. Validation error (400) → toast with message, highlight invalid fields, keep panel open

---

## 7. Field Editability Matrix

### 7.1 Rules

- **Editable statuses**: enriched, error (notes only), manual_review (notes only), in_review, adjusted, ready, paired, processing (notes only)
- **Terminal statuses** (no edits): confirmed, superseded
- **processing_notes**: Always editable regardless of status (`alwaysEditable: true`)
- **Auto-transition**: Editing a field in `enriched` status auto-transitions to `adjusted`

### 7.2 Matrix (52 Fields × 11 Statuses)

Legend: **E** = editable, **RO** = read-only, **AE** = always editable, **H** = hidden, **—** = not applicable

#### Traceability Fields (always RO)

| Field | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| source_tp | RO | RO | RO | RO | RO | RO | RO | RO | RO | H | H |
| source_trx_id | RO | RO | RO | RO | RO | RO | RO | RO | RO | H | H |
| statement_id | RO | RO | RO | RO | RO | RO | RO | RO | RO | H | H |

#### Lineage Fields (shown when origin ≠ "pipeline")

| Field | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| origin | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| parent_enrichment_id | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| group_id | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| split_sequence | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| lineage_note | — | E | E | E | E | E | E | E | E | RO | RO |

#### Transaction Core Fields

| Field | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| transaction_date | — | E | E | E | E | E | E | E | E | RO | RO |
| settlement_date | — | E | E | E | E | E | E | E | E | RO | RO |
| debit_credit | — | E | E | E | E | E | E | E | E | RO | RO |
| original_amount | — | E | E | E | E | E | E | E | E | RO | RO |
| fee_amount | — | E | E | E | E | E | E | E | E | RO | RO |
| total_amount | — | E | E | E | E | E | E | E | E | RO | RO |
| original_currency | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| description | — | E | E | E | E | E | E | E | E | RO | RO |

#### Classification Fields

| Field | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| internal_type | — | E | E | E | E | E | E | E | E | RO | RO |
| type_confidence | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| matched_rule_id | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |

#### Currency & FX Fields

| Field | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| validated_currency | — | E | E | E | E | E | E | E | E | RO | RO |
| fx_rate_to_eur | — | E | E | E | E | E | E | E | E | RO | RO |
| fx_rate_date | — | E | E | E | E | E | E | E | E | RO | RO |
| fx_rate_source | — | E | E | E | E | E | E | E | E | RO | RO |
| base_amount_eur | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| requires_eur_parallel | — | E | E | E | E | E | E | E | E | RO | RO |

#### Resolved Entity Fields

| Field | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| resolved_customer_id | — | E | E | E | E | E | E | E | E | RO | RO |
| customer_code | — | E | E | E | E | E | E | E | E | RO | RO |
| customer_match_method | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| resolved_asset_id | — | E | E | E | E | E | E | E | E | RO | RO |
| asset_isin | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| asset_category | — | E | E | E | E | E | E | E | E | RO | RO |
| counterparty_id | — | E | E | E | E | E | E | E | E | RO | RO |
| counterparty_short_code | — | E | E | E | E | E | E | E | E | RO | RO |
| counterparty_source | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |

#### Fee & Pairing Fields (shown when has_fee=Y or status=paired)

| Field | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| has_fee | — | E | E | E | E | E | E | E | E | RO | RO |
| fee_trx_id | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| pair_id | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |

#### Status & Notes Fields

| Field | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| status | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| enrichment_timestamp | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| version | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| error_message | — | — | — | RO | — | — | — | — | — | — | — |
| processing_notes | AE | AE | AE | AE | AE | AE | AE | AE | AE | AE | AE |

#### New Fields (not yet on F01.05)

| Field | Type | Purpose | Implementation Status |
|-------|------|---------|----------------------|
| gl_debit_override | TextField | Manual GL debit account override | ❌ NOT ON FORM |
| gl_credit_override | TextField | Manual GL credit account override | ❌ NOT ON FORM |
| gl_override_reason | TextArea | Audit trail for GL override | ❌ NOT ON FORM |
| fund_allocation_status | Select | pending / allocated / partial | ⚠ EXISTS BUT DORMANT |
| loan_id | TextField | FK to loan contract | ⚠ CHECK IF ON FORM |

---

## 8. Operations Catalog

### 8.1 Operation Availability by Status

| Operation | ENRICHED | IN_REVIEW | ADJUSTED | PAIRED | READY | MANUAL_REVIEW | ERROR |
|-----------|:--------:|:---------:|:--------:|:------:|:-----:|:-------------:|:-----:|
| Field edits (§8.2) | ✓ | ✓ | ✓ | — | ✓ | — | — |
| Split (§8.3) | ✓ | ✓ | ✓ | — | ✓ | — | — |
| Loan ops (§8.4) | ✓ | ✓ | ✓ | — | ✓ | — | — |
| Fund alloc (§8.5) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Securities (§8.6) | ✓ | ✓ | ✓ | ✓ | — | — | — |
| FX ops (§8.7) | ✓ | ✓ | ✓ | — | — | — | — |
| Mark ready | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Confirm | — | — | — | — | ✓ | — | — |
| Reprocess | — | — | — | — | — | ✓ | ✓ |
| Delete | — | — | — | — | — | ✓ | ✓ |

### 8.2 Transaction Adjustment Operations

**8.2.1 Reclassify Transaction Type**

- **Dialog**: Shows current type, confidence badge, matched rule. Quick suggestion chips for common reclassifications. Dropdown with all 17+ IntTp values. Mandatory reason textarea.
- **Backend**: `PUT /records/{id}` with `{ internal_type, type_confidence: "manual_override", reclassify_reason }`. API auto-transitions enriched → adjusted.
- **Implementation**: ✅ Can use existing generic PUT endpoint

**8.2.2 Reassign Customer**

- **Dialog**: Shows current customer. Type-ahead search input querying `GET /customers?search=`. Results table showing: ID, Name, Type (Corp/Ind), KYC status, Risk level. Radio selection. Mandatory reason textarea.
- **Backend**: `PUT /records/{id}` with `{ resolved_customer_id, customer_code, customer_match_method: "manual" }`
- **Implementation**: ⚠ Needs `GET /customers?search=` endpoint on enrichment-api

**8.2.3 Edit Amounts**

- **Where**: Detail panel §2 Transaction section, inline input fields
- **Backend**: Standard `PUT /records/{id}` with changed amount fields
- **Implementation**: ✅ Existing

**8.2.4 Flip D/C**

- **Where**: Operations dropdown or detail panel
- **Backend**: `PUT /records/{id}` with `{ debit_credit: flipped_value }`
- **Implementation**: ✅ Can use existing generic PUT

**8.2.5 Override FX Rate**

- **Dialog**: Shows current rate, rate source, rate date. Input for new rate + rate date + rate source (dropdown: manual, bloomberg, ecb, corporate_rate). Shows computed resulting EUR amount.
- **Frontend**: Calculates preview EUR amount = total / new_rate
- **Backend**: `PUT /records/{id}` with `{ fx_rate_to_eur, fx_rate_date, fx_rate_source: "manual" }`
- **Implementation**: ✅ Can use existing generic PUT

**8.2.6 Override GL Account**

- **Dialog**: Input for GL debit account, GL credit account, reason textarea.
- **Backend**: `PUT /records/{id}` with `{ gl_debit_override, gl_credit_override, gl_override_reason }`
- **Implementation**: ❌ Needs new fields on F01.05

**8.2.7 Add Processing Notes**

- **Where**: Detail panel §8, always-editable textarea
- **Backend**: `PUT /records/{id}` with `{ processing_notes }`
- **Implementation**: ✅ Existing

### 8.3 Split & Allocation Operations

**8.3.1 Generic Split**

- **Dialog**: Shows source record info (ID, type, total, currency). Mode selector chips (Manual / Equal split / Percentage). Table with rows: #, Type (select), Customer (input), Amount (input), Total (computed). Running sum with remaining indicator (green ✓ when zero). "+ Add Row" button.
- **Validation**: Sum of child amounts must equal parent total (tolerance ±0.01). Each child must have a type.
- **Backend**: `POST /records/{id}/split` with `{ allocations: [{ amount, fee, customer_code, internal_type, description }] }`. Parent → SUPERSEDED, children created with origin=split.
- **Implementation**: ✅ Existing endpoint

**8.3.2 Loan Payment Split**

- **Dialog**: Shows source transaction info. Embedded loan contract card (§6.5 §6 Loan Contract) resolved from loan_id. Payment allocation table:
  - Row 1: Principal (type=LOAN_PAYMENT), amount input
  - Row 2: Interest (type=INT_INCOME), amount input, expected column (computed), variance indicator
- **Expected interest calculation**: `outstanding_balance × annual_rate × days / day_count_basis`
- **Variance indicator**: <1% green, 1-5% amber, >5% red
- **Formula display**: Shows "Expected = {outstanding} × {rate}% × {days}d / {basis} = {result}"
- **Backend**: `POST /records/{id}/split-loan` with `{ loanId, principalAmount, interestAmount }`. API resolves contract internally, validates, creates two children, optionally updates outstanding balance.
- **Implementation**: ❌ Needs new endpoint + loan contract read endpoints

**8.3.3 Multi-Period Accrual Split** (future)

- Split a single transaction across multiple accounting periods
- **Implementation**: ❌ Not designed

**8.3.4 Fee Disaggregation** (future)

- Split bundled fee into component fees (advisory, custody, trading)
- **Implementation**: ❌ Not designed

### 8.4 Loan Contract Operations

**8.4.1 Link to Loan Contract**

- **Dialog**: Shows transaction info. Current link status (linked/not linked). Auto-suggested contracts (matched from description). Contract table with radio selection: Contract ID, Customer, Outstanding, Rate, Maturity.
- **Backend**: `PUT /records/{id}/link-loan` with `{ loanId }`. API validates contract exists, currency matches, contract is active.
- **Implementation**: ❌ Needs new endpoint + `GET /loan-contracts` endpoint

**8.4.2 Verify Interest Calculation**

- **Where**: Loan Payment Split dialog (integrated, not standalone)
- **Backend**: `GET /records/{id}/verify-interest?loanId={id}&days={n}`. Returns expected interest amount.
- **Implementation**: ❌ Needs new endpoint

**8.4.3 Update Outstanding Balance**

- **When**: After loan payment is confirmed, outstanding balance on the loan contract should decrease.
- **Backend**: Post-confirmation hook, not a workspace action. Enrichment-api handles this when confirming loan payment splits.
- **Implementation**: ❌ Needs F02.04 fields (outstandingBalance, lastBalanceUpdateDate, lastBalanceUpdateTrxId)

**8.4.4 Flag Early Repayment**

- **When**: Payment exceeds scheduled amount by >10%
- **Where**: Warning ribbon in detail panel
- **Implementation**: ❌ Future

### 8.5 Fund Allocation Operations

**Context**: Genesis Asset Management (customer 12345678, is_fund=yes) buys/sells securities in bulk on behalf of multiple investor-depositors. Fund transactions must be allocated to investors proportionally based on unit holdings.

**8.5.1 Allocate Fund Transaction to Investors**

- **Dialog**: Shows transaction info. NAV reference selector (dropdown of confirmed NAV calculations). Total units outstanding. Allocation preview table:
  - Columns: Investor Name, Units, Share %, Allocated Amount, EUR Equivalent
  - Footer: Totals row summing to 100%
  - Rounding: ±0.01 adjustment applied to largest investor position
- **Backend**: `POST /records/{id}/allocate-fund` with `{ navId, allocations: [{ investorId, units, amount }] }`. API creates per-investor child records, marks parent with fund_allocation_status=allocated.
- **Implementation**: ❌ Needs new endpoint + F03.01/F03.02/F03.03 forms

**8.5.2 Record Investor Deposit/Withdrawal**

- **Where**: Investor Positions view
- **Backend**: `POST /fund/investors/{id}/deposit` / `POST /fund/investors/{id}/withdrawal` with `{ amount, units, date }`
- **Implementation**: ❌ Needs fund infrastructure

**8.5.3 NAV Calculation**

- **Where**: NAV Calculation view → "+ New NAV Calculation" dialog
- **Backend**: `POST /fund/nav` with `{ date, totalAssets, totalLiabilities, unitsOutstanding }`
- **Implementation**: ❌ Needs fund infrastructure

### 8.6 Securities & Pairing Operations

**8.6.1 Manual Pair (Bank ↔ Securities)**

- **Backend**: `POST /records/{id}/pair` with `{ pairWithId }`. Validates opposite source types, compatible amounts.
- **Implementation**: ❌ Needs new endpoint

**8.6.2 Unpair**

- **Backend**: `POST /records/{id}/unpair`. Clears pair_id on both records.
- **Implementation**: ❌ Needs new endpoint

**8.6.3 Link COMM_FEE to Trade**

- **Backend**: `POST /records/{id}/link-fee` with `{ tradeRecordId }`. Validates fee type, sets fee_trx_id.
- **Implementation**: ❌ Needs new endpoint

**8.6.4 Link DIV_TAX to Dividend**

- **Backend**: `POST /records/{id}/link-tax` with `{ dividendRecordId }`. Validates tax type, links to dividend.
- **Implementation**: ❌ Needs new endpoint

### 8.7 FX Operations

**8.7.1 Pair FX Legs**

- **Backend**: `POST /records/{id}/pair-fx` with `{ otherLegId }`. Validates opposite D/C, same date, FX type.
- **Implementation**: ❌ Needs new endpoint

**8.7.2 FX Gain/Loss Entry**

- **Backend**: `POST /records/create-fx-gain-loss` with `{ pairId, rate, settlementRate }`. Creates manual entry.
- **Implementation**: ❌ Needs new endpoint

### 8.8 Period-End Operations

**8.8.1 Create Accrual Entry**

- **Backend**: `POST /records/create-accrual` with `{ type, amount, currency, period, description }`. Creates manual-origin record.
- **Implementation**: ❌ Needs new endpoint

**8.8.2 Reverse Prior Accrual**

- **Backend**: `POST /records/reverse-accrual` with `{ originalAccrualId }`. Creates reversing entry, links to original.
- **Implementation**: ❌ Needs new endpoint

**8.8.3 Lock Period**

- **Backend**: `POST /periods/{period}/lock`. Prevents further edits to records in that period.
- **Implementation**: ❌ Needs new endpoint + F03.04 periodLock form

### 8.9 Batch & Workflow Operations

**8.9.1 Bulk Mark Ready**

- **Backend**: `POST /records/status` with `{ recordIds, targetStatus: "ready" }`
- **Implementation**: ✅ Existing batch transition endpoint

**8.9.2 Bulk Confirm for Posting**

- **Dialog**: Shows reconciliation table (per-currency: statement total, batch total, remaining, status). Validation gates: all classified, all have customer, fund allocation check, loan linkage check.
- **Backend**: `POST /records/confirm` with `{ recordIds, allowPartial }`. Validates status=READY, runs reconciliation, JDBC transaction for READY → CONFIRMED.
- **Implementation**: ✅ Existing endpoint

**8.9.3 Re-Enrich**

- **Backend**: `POST /records/re-enrich` with `{ recordIds }`. Resets records to NEW, triggers pipeline re-run.
- **Implementation**: ❌ Needs new endpoint

**8.9.4 Export for Review**

- **Frontend**: Generates CSV from current filtered view
- **Backend (optional)**: `GET /records/export?filters=...` for server-side CSV generation
- **Implementation**: ⚠ Frontend can generate; backend endpoint optional

### 8.10 Cross-Reference: Operations × Transaction Types

| IntTp | Reclassify | Reassign | Split | Loan Split | Fund Alloc | Pair | Link Fee | Link Tax | FX Pair |
|-------|:----------:|:--------:|:-----:|:----------:|:----------:|:----:|:--------:|:--------:|:-------:|
| LOAN_PAYMENT | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| LOAN_DISBURSEMENT | ✓ | ✓ | — | — | — | — | — | — | — |
| INT_INCOME | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| INT_EXPENSE | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| SEC_BUY / EQ_BUY | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| SEC_SELL / EQ_SELL | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| BOND_BUY | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| BOND_INT | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| DIV_INCOME | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| DIV_TAX | ✓ | ✓ | — | — | ✓ | — | — | ✓ | — |
| COMM_FEE | ✓ | ✓ | — | — | ✓ | — | ✓ | — | — |
| MGMT_FEE | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| ADMIN_FEE | ✓ | ✓ | — | — | — | — | — | — | — |
| FX_EXCHANGE | ✓ | ✓ | — | — | ✓ | — | — | — | ✓ |
| TAX | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| SPLIT_IN/OUT | ✓ | — | — | — | ✓ | ✓ | — | — | — |
| ASSET_RETURN | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| INV_INCOME | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| CASH_IN_OUT | ✓ | ✓ | ✓ | — | — | — | — | — | — |

---

## 9. Status Lifecycle & Transitions

### 9.1 Status Diagram

```
NEW → PROCESSING → ENRICHED ──→ IN_REVIEW ──→ ADJUSTED ──→ READY ──→ CONFIRMED (terminal)
                       │              │              │
                       ├──────────────┴──────────────┘
                       │         (any edit = ADJUSTED)
                       │
                       └── MANUAL_REVIEW ← ERROR
                                ↓
                           RE_ENRICH → NEW (restart)

PAIRED ──→ READY ──→ CONFIRMED
     └──→ MANUAL_REVIEW

SUPERSEDED (terminal — parent after split/merge)
```

### 9.2 Transition Rules (from StatusManager)

| From | To | Trigger |
|------|----|---------|
| enriched → adjusted | Auto on field edit | PUT /records/{id} |
| enriched/adjusted/in_review/paired → ready | User action | Mark Ready button |
| ready → confirmed | User action | Confirm for Posting |
| ready → enriched | User action | Return to Workspace |
| error/manual_review → new | User action | Reprocess |
| any editable → superseded | System | Split/merge (parent record) |

### 9.3 Status Badge Colors

| Status | Background | Foreground | Font |
|--------|-----------|------------|------|
| new | #E3F2FD | #1565C0 | normal |
| processing | #FFF3E0 | #E65100 | normal |
| enriched | #E8F5E9 | #2E7D32 | normal |
| error | #FFEBEE | #C62828 | **bold** |
| manual_review | #FFF8E1 | #F57F17 | normal |
| in_review | #F3E5F5 | #6A1B9A | normal |
| adjusted | #E0F2F1 | #00695C | normal |
| ready | #C8E6C9 | #1B5E20 | **bold** |
| paired | #E8EAF6 | #283593 | normal |
| confirmed | #E8F5E9 | #1B5E20 | normal |
| superseded | #F5F5F5 | #9E9E9E | ~~strikethrough~~ |

### 9.4 Confidence Badge Colors

| Confidence | Background | Foreground |
|------------|-----------|------------|
| rule_match | #E8F5E9 | #2E7D32 |
| tentative | #FFF8E1 | #F57F17 |
| unclassified | #FFEBEE | #C62828 |
| manual_override | #E0F2F1 | #00695C |

---

## 10. Data Model

### 10.1 Existing Forms

**F01.05 trxEnrichment** — 52 fields, central enrichment form. All transactions flow through this form. See F01.05-trxEnrichment.json for full field definitions.

**F02.04 loanContract** — Loan contracts. Fields: loanId, loanType, contractDate, customerId, principalAmount, currency, interestRate, interestCalcBasis, repaymentType, maturityDate, GL accounts, collateral, notes.

### 10.2 Missing Fields on Existing Forms

**F01.05 — 3 new fields needed:**

| Field | Type | Purpose |
|-------|------|---------|
| gl_debit_override | TextField | Manual GL debit account |
| gl_credit_override | TextField | Manual GL credit account |
| gl_override_reason | TextArea | Reason for GL override (audit trail) |

**F02.04 — 3 new fields needed:**

| Field | Type | Purpose |
|-------|------|---------|
| outstandingBalance | Numeric | Current outstanding principal |
| lastBalanceUpdateDate | DatePicker | When balance was last updated |
| lastBalanceUpdateTrxId | TextField | FK to confirming trxEnrichment record |

### 10.3 New Forms Required

**F03.01 investorPosition** — Tracks investor unit balances in the pooled fund:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| investorPositionId | TextField | Yes | Primary key |
| investorName | TextField | Yes | Full name |
| investorType | Select | Yes | individual / corporate |
| unitBalance | Numeric | Yes | Current unit holdings (6 decimals) |
| percentageShare | Numeric | Yes | Computed from unitBalance / totalUnits |
| initialInvestmentDate | DatePicker | Yes | First deposit date |
| lastTransactionDate | DatePicker | No | Most recent deposit/withdrawal |
| status | Select | Yes | active / suspended / closed |
| currency | TextField | Yes | Position currency (EUR) |
| notes | TextArea | No | Free-text notes |

**F03.02 navCalculation** — Period NAV snapshots:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| navId | TextField | Yes | Primary key |
| calculationDate | DatePicker | Yes | NAV reference date |
| totalAssets | Numeric | Yes | Sum of all fund assets |
| totalLiabilities | Numeric | Yes | Sum of all fund liabilities |
| netAssetValue | Numeric | Yes | Assets minus liabilities |
| unitsOutstanding | Numeric | Yes | Total units across all investors |
| navPerUnit | Numeric | Yes | NAV / unitsOutstanding (6 decimals) |
| status | Select | Yes | draft / confirmed |
| calculatedBy | TextField | Yes | User who created |
| confirmedBy | TextField | No | User who confirmed |
| notes | TextArea | No | Calculation notes |

**F03.03 fundAllocation** — Per-investor transaction allocations:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| allocationId | TextField | Yes | Primary key |
| sourceEnrichmentId | TextField | Yes | FK to F01.05 record |
| investorPositionId | TextField | Yes | FK to F03.01 |
| navId | TextField | Yes | FK to F03.02 (reference NAV) |
| allocatedUnits | Numeric | Yes | Units allocated |
| allocatedAmount | Numeric | Yes | Amount in transaction currency |
| allocatedAmountEur | Numeric | Yes | EUR equivalent |
| percentageShare | Numeric | Yes | Investor's share at time of allocation |
| allocationDate | DatePicker | Yes | When allocation was recorded |
| status | Select | Yes | pending / confirmed |

**F03.04 periodLock** — Period lock status:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| periodId | TextField | Yes | Period identifier (YYYY-MM) |
| lockedAt | DateTime | Yes | When period was locked |
| lockedBy | TextField | Yes | User who locked |
| status | Select | Yes | open / locked |
| reason | TextArea | No | Lock reason |

---

## 11. API Contract

### 11.1 Authentication

All requests include headers:
```
api_id: <API Builder ID from EW_CONFIG>
api_key: <API key from EW_CONFIG>
Accept: application/json
```

### 11.2 Existing Endpoints (enrichment-api v1.0)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | /health | Health check | ✅ |
| GET | /records | Paginated listing with filters/sort/search | ✅ |
| GET | /records/{id} | Single record | ✅ |
| PUT | /records/{id} | Inline edit with optimistic locking | ✅ |
| POST | /records/{id}/status | Single status transition | ✅ |
| POST | /records/status | Batch status transition | ✅ |
| DELETE | /records/{id} | Delete (status-restricted) | ✅ |
| GET | /summary | Per-statement summary counts | ✅ |
| GET | /reconciliation/{stmId} | Per-currency reconciliation | ✅ |
| POST | /records/confirm | Batch confirm for posting | ✅ |
| POST | /records/{id}/split | Generic split | ✅ |
| POST | /records/merge | Merge multiple records | ✅ |

### 11.3 Required New Endpoints

#### Loan Operations

| Method | Endpoint | Purpose | Priority |
|--------|----------|---------|----------|
| GET | /loan-contracts | List loan contracts (search/filter) | Phase A |
| GET | /loan-contracts/{id} | Single contract details | Phase A |
| POST | /records/{id}/split-loan | Loan payment split (principal + interest) | Phase A |
| PUT | /records/{id}/link-loan | Link transaction to loan contract | Phase A |
| GET | /records/{id}/verify-interest | Calculate expected interest for contract | Phase A |

#### Fund Operations

| Method | Endpoint | Purpose | Priority |
|--------|----------|---------|----------|
| GET | /fund/investors | List investor positions | Phase B |
| GET | /fund/nav | NAV calculation history | Phase B |
| POST | /fund/nav | Create NAV calculation | Phase B |
| POST | /records/{id}/allocate-fund | Allocate fund transaction to investors | Phase B |
| POST | /fund/investors/{id}/deposit | Record investor deposit | Phase B |
| POST | /fund/investors/{id}/withdrawal | Record investor withdrawal | Phase B |

#### Securities & Pairing

| Method | Endpoint | Purpose | Priority |
|--------|----------|---------|----------|
| POST | /records/{id}/pair | Manual pair bank↔securities | Phase C |
| POST | /records/{id}/unpair | Remove pairing | Phase C |
| POST | /records/{id}/link-fee | Link COMM_FEE to trade | Phase C |
| POST | /records/{id}/link-tax | Link DIV_TAX to dividend | Phase C |
| POST | /records/{id}/pair-fx | Pair FX legs | Phase C |

#### Supporting Operations

| Method | Endpoint | Purpose | Priority |
|--------|----------|---------|----------|
| GET | /customers | Customer search (type-ahead) | Phase D |
| POST | /records/create-accrual | Create accrual entry | Phase D |
| POST | /records/reverse-accrual | Reverse prior accrual | Phase D |
| POST | /records/re-enrich | Reset and re-run pipeline | Phase D |
| GET | /records/export | Export filtered records as CSV | Phase D |
| POST | /periods/{period}/lock | Lock accounting period | Phase D |

### 11.4 Inline Dispatcher (Joget compatibility)

Due to Joget's API Builder routing, some operations use the GET /records?save={json} dispatcher pattern. The `save` parameter contains JSON that routes to the appropriate handler:

```javascript
// Split
GET /records?save={"split":true,"recordId":"ENR-001","allocations":[...]}

// Merge
GET /records?save={"merge":true,"recordIds":"ENR-002,ENR-003"}

// Confirm
GET /records?save={"confirm":true,"recordIds":"ENR-001,ENR-002","allowPartial":true}

// Status transition
GET /records?save={"recordIds":"ENR-001,ENR-002","targetStatus":"ready"}

// Create
GET /records?save={"create":true,"field1":"value1",...}

// Delete
GET /records?save={"delete":true,"id":"ENR-001"}
```

---

## 12. Frontend / Backend Responsibility Split

### 12.1 Backend (enrichment-api) — must handle

| Operation | Reason |
|-----------|--------|
| All record mutations (create/update/delete) | Atomic writes, validation, audit |
| Status transitions | StatusManager rules enforcement |
| Split (generic + loan) | Parent supersede + child creation must be atomic |
| Merge | Multi-record atomicity |
| Confirm for posting | Reconciliation + validation gates + transactional |
| Fund allocation | Cross-form writes (F01.05 + F03.03), proportional calculation |
| Link to loan contract | Cross-form lookup (F02.04), validation |
| Interest verification | Calculation using contract terms |
| Period lock | Enforcement across all records |
| Optimistic locking | Version conflict detection |

### 12.2 Frontend (workspace JS) — handles

| Operation | Reason |
|-----------|--------|
| Filter/sort/search | Pure UI state |
| Column visibility, summary toggle | UI preference |
| Selection management | Checkbox state |
| Detail panel rendering | Read-only display |
| Context-aware ribbons | UI logic based on type + status |
| Operation button visibility | UI logic based on type + status + selection |
| Allocation preview calculation | Fast feedback (simple math) — backend validates on confirm |
| Interest preview calculation | Fast feedback — backend provides authoritative calculation |
| CSV export from current view | Client-side generation |
| Toast notifications | UI feedback |

### 12.3 Design Decisions

| Question | Decision |
|----------|----------|
| Where does loan contract data come from? | Enrichment-api proxies (GET /loan-contracts). Workspace has single API dependency. |
| Where does customer search come from? | Enrichment-api proxies (GET /customers?search=). Same single-API principle. |
| Where does fund investor data come from? | Enrichment-api exposes (GET /fund/investors). Fund forms are backend concern. |
| Who calculates interest preview? | Frontend shows quick preview; backend provides authoritative result via /verify-interest. |
| Who calculates allocation proportions? | Frontend shows preview; backend validates and applies rounding on confirm. |

---

## 13. Plugin Configuration

### 13.1 Joget Property Panel

```json
{
  "title": "Enrichment Workspace Configuration",
  "properties": [
    {
      "group": "General",
      "fields": [
        { "name": "label", "label": "Menu Label", "type": "textfield", "required": true, "value": "Enrichment Workspace" },
        { "name": "customId", "label": "Custom HTML ID", "type": "textfield", "regex_validation": "^[a-zA-Z0-9_]*$" }
      ]
    },
    {
      "group": "API Connection",
      "fields": [
        { "name": "apiId", "label": "API Builder ID", "type": "textfield", "required": true },
        { "name": "apiKey", "label": "API Key", "type": "textfield", "required": true }
      ]
    },
    {
      "group": "Field Mapping",
      "fields": [
        { "name": "tableName", "label": "Table Name", "type": "textfield", "required": true, "value": "trx_enrichment" },
        { "name": "formId", "label": "Form ID", "type": "textfield", "required": true, "value": "trxEnrichment" }
      ]
    },
    {
      "group": "Styling",
      "fields": [
        { "name": "customCssClass", "label": "Custom CSS Class", "type": "textfield" },
        { "name": "pageSize", "label": "Records Per Page", "type": "textfield", "value": "20" }
      ]
    }
  ]
}
```

### 13.2 Runtime Configuration

```javascript
window.EW_CONFIG = {
  apiBase: '/jw/api/enrichment',
  apiId: 'enrichment-api',
  apiKey: '<api-key>',
  statementId: null,            // Optional URL param filter
  pageSize: 20,
  version: '2.0.0'
};
```

---

## 14. Loading Sequence & Session State

### 14.1 Page Load Order

1. FreeMarker template renders HTML skeleton + injects `EW_CONFIG`
2. JS module load order:
   - ew-config.js → `window.EW` namespace
   - ew-api.js → `EW.api` methods
   - ew-toast.js → notification system
   - ew-tabs.js → tab definitions + switching
   - ew-table.js → table rendering, sorting, pagination
   - ew-actions.js → toolbar logic + action handlers
   - ew-detail.js → form rendering + save logic
   - ew-filters.js → filter controls
   - ew-main.js → initialization

3. ew-main.js initialization:
   ```javascript
   EW.tabs.init();
   EW.table.renderThead();
   EW.actions.renderToolbar();
   EW.table.load();
   EW.filters.init();
   ```

### 14.2 Session State

```javascript
EW.state = {
  page: 1,
  pageSize: 20,                // Persisted in localStorage
  sort: 'dateCreated',
  order: 'asc',
  total: 0,
  totalPages: 0,
  selectedIds: [],
  currentTab: 'workspace',
  records: {},                  // In-memory cache: { id: recordObj }
  summaryCollapsed: false       // Summary panel toggle state
};
```

---

## 15. Error Handling & Feedback

### 15.1 Toast Notifications

`EW.toast.show(message, type)`:
- **success** (green): auto-dismiss 4s — "Record saved", "N records marked as ready"
- **error** (red): auto-dismiss 8s — "Failed to save: {message}"
- **warning** (orange): auto-dismiss 8s — "N records skipped (ineligible status)"
- **info** (blue): auto-dismiss 4s — informational messages

### 15.2 Validation Errors (400)

Detail panel remains open. Toast shows error message. Invalid fields highlighted with red border. Field-level error messages shown inline if API provides them.

### 15.3 Version Conflict (409)

Toast: "Record modified by another user — reloading". Automatically fetch fresh record from API. Reload detail panel with updated data. User must re-apply changes.

### 15.4 Row-Level Errors

Error-status rows show inline error message in a sub-row: `⚠ {error_message}` spanning full table width, light red background.

---

## 16. Deployment Checklist

- [ ] enrichment-api plugin installed and configured in API Builder
- [ ] API Builder ID and key configured in workspace plugin properties
- [ ] MySQL table `app_fd_trx_enrichment` exists with correct schema
- [ ] Joget form `trxEnrichment` (F01.05) deployed
- [ ] gam-framework plugin installed (Status, StatusManager, EntityType)
- [ ] New F01.05 fields added (gl_debit_override, gl_credit_override, gl_override_reason)
- [ ] F02.04 loan contract fields added (outstandingBalance, lastBalanceUpdateDate, lastBalanceUpdateTrxId)
- [ ] F03.01 investorPosition form created and deployed
- [ ] F03.02 navCalculation form created and deployed
- [ ] F03.03 fundAllocation form created and deployed
- [ ] F03.04 periodLock form created and deployed
- [ ] Loan contracts seeded in F02.04
- [ ] Investor positions seeded in F03.01
- [ ] Initial NAV calculation created in F03.02
- [ ] All toolbar actions tested (mark ready, split, loan split, merge, confirm, reprocess, delete)
- [ ] Detail panel editing tested for all editable statuses
- [ ] Fund allocation workflow tested end-to-end
- [ ] Loan payment split tested with interest verification
- [ ] Filtering and pagination tested with 142+ records
- [ ] Statement scoping tested
- [ ] Browser testing: Chrome, Firefox, Safari (latest)
- [ ] Load test: 50+ concurrent users, 1000+ records per statement

---

## 17. Implementation Status & Roadmap

### 17.1 Current State

| Component | Status | Coverage |
|-----------|--------|----------|
| Enrichment-API core (CRUD, split, merge, confirm) | ✅ Complete | 12 endpoints |
| Workspace UI (basic views, toolbar, detail panel) | ✅ Phase 3 of 8 | 7 basic actions |
| Field editability matrix | ✅ Specified | 52 fields × 11 statuses |
| UI prototype (v2) | ✅ Complete | All operations shown |
| F01.05 form | ✅ Deployed | 52 fields (missing 3 new) |
| F02.04 loan contract | ⚠ Exists | Missing 3 balance fields |
| F03.01–F03.04 fund forms | ❌ Not created | Spec complete, forms needed |
| Loan API endpoints | ❌ Not implemented | 5 endpoints needed |
| Fund API endpoints | ❌ Not implemented | 6 endpoints needed |
| Securities/pairing endpoints | ❌ Not implemented | 5 endpoints needed |
| Supporting endpoints | ❌ Not implemented | 6 endpoints needed |

### 17.2 Implementation Phases

**Phase 1 — New UI + Loan Workflow** (highest customer value, delivers working product):

This phase delivers the complete v2 workspace UI with the loan workflow — the most common manual operation for the customer. At the end of Phase 1, the user has a fully functional enrichment workspace that handles the 142-transaction dataset end-to-end, with loan payment splits as the star feature.

*1A. Workspace UI — evolve existing plugin to v2 design (no sidebar — Joget Userview handles navigation):*
1. Evolve enrichment-workspace plugin JS to match v2 prototype styling (keep what works, reshape to v2)
2. Collapsible summary dashboard (OVERVIEW) with KPI cards and statement overview — chevron toggle, mini-summary line when collapsed
3. Toolbar with Split dropdown and Operations dropdown (both wired)
4. Transaction table with type badges (category colors), inline icons (🔗 loan, 📊 fund), row tinting
5. Collapsible filters section — chevron toggle, active filter summary line when collapsed (e.g. "Filters: status=enriched, type=LOAN_PAYMENT")
6. Detail panel (slide-over) with context-aware ribbons and operation button bar
7. All 8 detail sections including conditional §6 Loan Contract and §7 Fund Allocation
8. Pagination (configurable page size)
9. Toast notifications for all actions

*1B. Enrichment-API — loan endpoints:*
1. Add 3 missing fields to F02.04 (outstandingBalance, lastBalanceUpdateDate, lastBalanceUpdateTrxId)
2. `GET /loan-contracts` — list/search loan contracts (workspace needs contract picker)
3. `GET /loan-contracts/{id}` — single contract details (for contract card in detail panel)
4. `POST /records/{id}/split-loan` — loan payment split into principal + interest (resolves contract, validates, creates children)
5. `PUT /records/{id}/link-loan` — link transaction to loan contract (validates contract exists, currency, active status)
6. `GET /records/{id}/verify-interest` — calculate expected interest (rate × outstanding × days / basis)

*1C. Workspace UI — loan dialogs wired to API:*
1. Loan Payment Split dialog: contract card, principal/interest allocation, expected interest display, variance indicator
2. Link to Loan Contract dialog: auto-suggested contracts from description, contract picker table
3. Context ribbon: "This payment can be split into principal + interest" for LOAN_PAYMENT with loan_id
4. Context ribbon: "Loan transaction not linked to a contract" warning
5. Loan Contracts sidebar view (read-only reference table from GET /loan-contracts)

*1D. Core workspace operations wired to existing API:*
1. Generic split dialog (calls existing POST /records/{id}/split)
2. Merge dialog (calls existing POST /records/merge)
3. Confirm for Posting dialog with reconciliation (calls existing POST /records/confirm)
4. Mark Ready / Return to Workspace (calls existing POST /records/status)
5. Reprocess, Delete (calls existing endpoints)
6. New Manual Entry dialog (calls existing create)
7. Reclassify, Reassign Customer, Flip D/C, FX Override, GL Override (all via existing PUT /records/{id})
8. Detail panel Save with optimistic locking (existing PUT /records/{id})

*Phase 1 acceptance criteria:*
- [ ] Plugin renders within Joget content area (no duplicate sidebar — navigation via Joget Userview)
- [ ] Summary dashboard (OVERVIEW) shows KPI cards, statement overview, collapses/expands with mini-summary
- [ ] Filters section collapses/expands with active filter summary line
- [ ] Transaction table renders 142 records with correct type badges, row tinting, icons
- [ ] All filters work (status, source, type, customer, description, fund-only, loan-only)
- [ ] Selection + toolbar enable/disable rules match §5.1
- [ ] Split dropdown shows 4 items, Operations dropdown shows 11 items
- [ ] Detail panel opens with all 8 sections, context ribbons, operation bar
- [ ] Generic split works end-to-end via API
- [ ] Merge works end-to-end via API
- [ ] Loan Payment Split works: contract lookup → interest verification → split → children created
- [ ] Link to Loan Contract works: search → select → link saved
- [ ] Confirm for Posting works with reconciliation check
- [ ] All field edits save via PUT with optimistic locking
- [ ] Toast feedback for all operations
- [ ] Tested with 142-record dataset

**Phase 2 — Fund Infrastructure** (new capability):
1. Create F03.01, F03.02, F03.03 forms in Joget
2. Seed initial data (3 investors, first NAV calculation)
3. Add fund endpoints: GET /fund/investors, GET /fund/nav, POST /fund/nav, POST /records/{id}/allocate-fund, POST /fund/investors/{id}/deposit, POST /fund/investors/{id}/withdrawal
4. Wire workspace: Fund Allocation view, NAV Calculation view, Investor Positions view, allocation dialog

**Phase 3 — Securities Pairing**:
1. Add pair/unpair/link-fee/link-tax/pair-fx endpoints
2. Wire workspace: pairing dialogs, fee/tax linking

**Phase 4 — Supporting Operations**:
1. Add GET /customers (customer search for reassign dialog type-ahead)
2. Add 3 GL override fields to F01.05
3. Add accrual/reversal/re-enrich/export/period-lock endpoints
4. Create F03.04 periodLock form
5. Wire workspace: remaining dialogs

**Phase 5 — Posting Pipeline** (beyond workspace scope):
1. GL posting plugin (CONFIRMED → journal entries)
2. Loan balance updater (post-confirmation hook → F02.04 outstanding balance)
3. Fund position updater (post-confirmation hook → F03.01 unit balances)

---

*This specification supersedes: enrichment-workspace-specification.md (v1.0.0, 2026-03-03), WORKSPACE-OPERATIONS-SPEC.md (v1.0, 2026-03-08), ENRICHMENT-WORKSPACE-GAP-ANALYSIS.md (2026-03-08). Those documents are retained as historical reference only.*
