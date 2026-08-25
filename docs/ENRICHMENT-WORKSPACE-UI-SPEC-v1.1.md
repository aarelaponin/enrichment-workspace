# Enrichment-Workspace Plugin — Allocation Visibility & Traceability Spec

**Version:** 1.1
**Date:** 14 March 2026
**Plugin:** enrichment-workspace
**Depends on:** Enrichment-API Fix Spec v1.1 (Fix 5 for enriched API response)
**Priority:** Medium — operator visibility and workflow efficiency
**Estimated effort:** 1–2 days development + testing

---

## 1. Context and Architecture

The enrichment-workspace is the UI plugin that operators use to manage enrichment records. It communicates with the enrichment-api for all data operations. Forms F03.00–F03.02 serve purely as a data model — operators never interact with them through Joget form views. All allocation visibility must be provided through the enrichment-workspace UI.

The current UI has two allocation-related touchpoints:

- **Detail panel** (`ew-detail.js`): Shows a Fund Allocation section with status badge and an inline allocation breakdown table showing Customer/Qty/Direction.
- **Allocation dialog** (`ew-actions.js`): The full-screen dialog for allocating a trade portion to a customer, with trade summary, customer dropdown, quantity input, and preview.

Both work correctly for basic allocation flow. The gaps are in post-allocation visibility — what the operator sees after allocations are made.

---

## 2. Current State Analysis

### 2.1 Detail Panel — Allocation Breakdown

**File:** `ew-detail.js`, lines 367–392
**Function:** `renderAllocationBreakdown(summary)`

The allocation breakdown table currently renders three columns:

| Column | Source | Issue |
|--------|--------|-------|
| Customer | `lot.customerName \|\| lot.customerId` | Works correctly |
| Qty | `lot.quantity` | Works correctly |
| Dir | `lot.direction` | Works correctly |

Missing information that the operator needs:

| Missing data | Why it matters |
|-------------|----------------|
| Lot ID | Operator needs a reference to identify specific lots (e.g., `LOT-000001`) |
| Amount (local currency) | Financial verification — what was the value of this allocation? |
| Fee share | Transparency — what portion of the trade fee was assigned? |
| Total cost | The actual cost basis recorded for this lot |
| EUR equivalent | Reporting currency comparison across lots in different currencies |
| Allocation date | Audit trail — when was this allocation made? |

---

### 2.2 Detail Panel — Fund Section Header

**File:** `ew-detail.js`, lines 309–332
**Function:** `renderFundSection(r)`

The Fund Allocation section currently shows only the allocation status badge (Fully Allocated / Partially Allocated / Pending) and the allocation button. It does not show:

- Total trade quantity and how much has been allocated vs. remaining
- Number of lots / number of customers involved
- Total allocated amount and fee across all lots

---

### 2.3 Allocation Dialog — Post-Allocation Feedback

**File:** `ew-actions.js`, lines 2205–2223
**Function:** `EW_doAllocateTrade()`

After a successful allocation, the dialog shows a toast notification ("Allocated X units") and immediately closes. The operator is returned to the table view. If they want to allocate the same trade to another customer, they must:

1. Re-select the same record in the table
2. Click "Allocate to Investors" again
3. Wait for the dialog to reload the trade summary and allocation state

For a trade with 10 customers, this means 10 open/close cycles. This is the most impactful workflow efficiency gap.

---

## 3. Enhancement Specifications

### E1: Enriched Allocation Breakdown Table

**File:** `ew-detail.js`
**Function:** `renderAllocationBreakdown(summary)`
**API dependency:** Enrichment-API Fix 5 (enriched `getAllocationSummary` response)

Replace the 3-column breakdown table with a **card layout** (see Section 4.1 for visual spec and CSS classes).

Each lot from the `getAllocationSummary` response is rendered as a card with the following data mapping:

| Card element | Source field | Format |
|-------------|------------|--------|
| Row 1: Customer name | `lot.customerName` | Text, ellipsis overflow |
| Row 1: Direction badge | `lot.direction` | `.badge-buy` / `.badge-sell` |
| Row 1: Quantity | `lot.quantity` | Monospace, right-aligned |
| Row 2: Amount | `lot.totalAmount` | `fmtAmt()` with currency |
| Row 2: Fee | `lot.feeAmount` | `fmtAmt()` with currency, prefixed "-" |
| Row 2: Cost | `lot.totalCostWithFees` | `fmtAmt()` with currency, bold |
| Row 3: Lot ID | `lot.lotId` | Text (e.g., `LOT-000001`) |
| Row 3: Date | `lot.allocationDate` | YYYY-MM-DD |
| Row 3: EUR equiv. | `lot.totalAmountEur` | `fmtAmt()` prefixed "EUR" |

Below the cards, add a summary footer (class `alloc-summary-footer`):

```
Total: 14,200.00 USD · Fee: -19.88 USD · Cost: 14,180.12 USD
EUR equivalent: 13,013.98 EUR
```

**Implementation notes:**

- Replace the existing `ew-alloc-inline-table` with the new card layout (see Section 4.1 for full CSS spec).
- Add a progress bar + text above the cards section (ties into E2).
- Maintain the existing cache mechanism (`EW.state._allocCache`) — invalidate when summary structure changes.
- Reference prototype: `docs/allocation-layout-prototype.html` (Option A tab).

---

### E2: Fund Section Summary Bar

**File:** `ew-detail.js`
**Function:** `renderFundSection(r)`

Add a progress summary between the status badge and the allocation breakdown. This should show the allocation progress even before the async breakdown loads:

```html
<div class="ew-alloc-progress">
  <div class="ew-alloc-progress-bar">
    <div class="ew-alloc-progress-fill" style="width:100%"></div>
  </div>
  <span>100 / 100 units allocated (3 lots)</span>
</div>
```

The progress data can be derived from the enrichment record itself plus the allocation summary. The enrichment record already has `fund_allocation_status`. The secu transaction (fetched via `getSecuTransaction`) has the total quantity. The allocation summary provides the allocated quantity.

To avoid an extra API call on every detail open, use a lazy-load pattern: show the status badge immediately, then fetch the progress data alongside the allocation breakdown. The progress bar and summary text render when the `getAllocationSummary` promise resolves.

---

### E3: Multi-Allocation Workflow (Stay-Open Dialog)

**File:** `ew-actions.js`
**Function:** `EW_doAllocateTrade()`

After a successful allocation, instead of closing the dialog, refresh it in place:

- Update the trade summary ("Already allocated" count increments, "Remaining" decreases).
- Add the new lot to the existing lots table in the dialog.
- Clear the customer dropdown and quantity input for the next allocation.
- Show a success toast inline within the dialog (not as a global toast that would be hidden by the overlay).
- If the trade is now fully allocated (remaining = 0), show a "Fully Allocated" badge and disable the form inputs. Add a "Done" button to close the dialog.
- Keep the "Cancel" button available at all times to exit mid-allocation.

**Implementation approach:**

**Step 1** — After the `allocateTrade` API call succeeds:

```javascript
// Don't close dialog, refresh state instead:
EW.state._alloc.alreadyAllocatedQty += qty;
// Invalidate and re-fetch allocation summary
delete EW.state._allocCache[a.enrichmentId];
EW.api.getAllocationSummary(a.enrichmentId).then(function(summary) {
  // Re-render the lots table and progress bar
  renderAllocDialogBody(secuTrx, summary, customers);
});
```

**Step 2** — Extract the dialog body rendering into a reusable function (currently inline in the Promise chain starting at line 2003). This function should accept the current allocation state and re-render the form section while preserving the overlay and header.

**Step 3** — When remaining reaches 0, replace the form with a completion message:

```html
<div class="ew-alloc-complete">
  <i class="fas fa-check-circle"></i>
  <div>Trade fully allocated to {n} customers in {m} lots</div>
  <button onclick="EW_closeAllocDialog()">Done</button>
</div>
```

---

### E4: Allocation History in Detail Panel

**File:** `ew-detail.js`
**New section in:** `renderPanel(record)`

For allocated or partially allocated records, add an expandable "Allocation History" section below the Fund Allocation section. This section shows the `processing_notes` field from the enrichment record, which already contains timestamped allocation log entries:

```
Allocated 35 shares to ADVERTA GRUPP OÜ (lot af175cca...)
Allocated 35 shares to Aktsiaselts IMG Konsultant (lot 26bd1fad...)
Allocated 30 shares to Balti turu teeninduse OÜ (lot 88b6ec19...)
```

Once the API fix (Fix 2) is deployed, these will show readable lot IDs:

```
Allocated 35 shares to ADVERTA GRUPP OÜ (lot LOT-000001)
Allocated 35 shares to Aktsiaselts IMG Konsultant (lot LOT-000002)
Allocated 30 shares to Balti turu teeninduse OÜ (lot LOT-000003)
```

This section should be collapsed by default and expandable via a toggle, to keep the detail panel compact for already-reviewed records.

---

## 4. Visual Design Notes

All enhancements should follow the existing enrichment-workspace design language:

- Use the existing CSS classes: `ew-alloc-inline-table`, `ew-alloc-inline-summary`, `ew-f-field`, `ew-f-row`.
- Status badges use the existing `st-confirmed` (green), `st-ready` (amber), `st-enriched` (blue) classes.
- Amount formatting: use the existing `fmtAmt()` / `fmtAmount()` helpers. Add currency symbol prefix.
- Progress bars: use the existing `ew-alloc-progress-bar` / `ew-alloc-progress-fill` classes from the allocation dialog.
- Monospace font for numeric values (class `"mono"` already defined in the workspace CSS).
- No new CSS files — all new styles should be added to the existing `ew-detail.css` or `ew-actions.css` inline style blocks.

### 4.1 Layout Decision — Card Layout (Option A) ✓

The detail panel is a slide-out panel typically 400–500px wide. After evaluating three layout options via an interactive prototype, **Option A (Card layout)** was selected.

**Reference prototype:** `docs/allocation-layout-prototype.html` — open in browser to see all three evaluated options.

Each allocation lot is rendered as a compact card:

```
┌──────────────────────────────────────────────┐
│ ADVERTA GRUPP OÜ              BUY       35   │
│ Amount 4,970.00  Fee -6.96  Cost 4,963.04 USD│
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ LOT-000001  2024-06-26  EUR 4,554.46         │
└──────────────────────────────────────────────┘
```

Card structure (3 rows per card):
- **Row 1:** Customer name (truncated with ellipsis if needed) + BUY/SELL badge + quantity (monospace, right-aligned)
- **Row 2:** Amount, Fee, Cost with currency — all monospace, smaller font (11px)
- **Row 3:** Metadata line (dashed top border) — Lot ID, allocation date, EUR equivalent

CSS classes: `.lot-card`, `.lot-card-row1`, `.lot-card-customer`, `.lot-card-qty`, `.lot-card-row2`, `.lot-card-meta`

Cards stack vertically with 8px gap. Background `#f8fafc`, border `1px solid var(--border)`, border-radius `8px`, padding `10px 12px`.

**Why Option A:** No horizontal scrolling needed, all data visible at a glance, works well in narrow panels, consistent with the detail panel's existing field-group styling. Alternatives evaluated were B (scrollable table — required horizontal scrolling) and C (compact table + expandable rows — hid financial data by default).

---

## 5. Implementation Order

| Step | Enhancement | Dependency | Effort |
|------|------------|------------|--------|
| 1 | E2 — Fund Section Summary Bar | None (uses existing data) | 0.5 day |
| 2 | E1 — Enriched Breakdown Table | API Fix 5 (enriched response) | 0.5 day |
| 3 | E4 — Allocation History Section | None (uses `processing_notes`) | 0.25 day |
| 4 | E3 — Stay-Open Dialog | None (refactor only) | 1 day |

E2 and E4 can be implemented immediately without waiting for API changes. E1 requires the enriched API response from the enrichment-api Fix 5. E3 is the most complex change but has no API dependency.

---

## 6. Test Plan

UI testing should be done manually through the enrichment-workspace against the development database after re-running the two test allocations.

### 6.1 E1 — Breakdown Table

| Test | Expected result |
|------|----------------|
| Open detail panel for TRX-2BC7DB (allocated) | Breakdown shows 3 lots with Lot ID, Customer, Qty, Amount, Fee, Cost, EUR equiv., Date |
| Verify ADVERTA lot values | `LOT-000001`, 35 qty, 4,970.00 USD, -6.96 fee, 4,963.04 cost |
| Verify EUR equivalent | Amount EUR = 4,554.46 (4970 × 0.9168) |
| Open detail for TRX-32EC0C (bond) | 2 lots, EUR amounts = local amounts (fxRate = 1.0) |

### 6.2 E2 — Summary Bar

| Test | Expected result |
|------|----------------|
| TRX-2BC7DB detail panel | Progress bar 100%, "100 / 100 units allocated (3 lots)" |
| Partially allocated record | Progress bar proportional, shows remaining count |
| Unallocated record | No progress bar, only "Pending" badge |

### 6.3 E3 — Stay-Open Dialog

| Test | Expected result |
|------|----------------|
| Allocate first customer | Toast shown inline, form cleared, lots table updated, remaining decremented |
| Allocate second customer | Same behavior, lots table now shows 2 rows |
| Allocate last customer (fully allocates) | Form replaced with completion message and Done button |
| Click Done | Dialog closes, table view refreshes, record shows "allocated" status |
| Cancel mid-allocation | Dialog closes, partial allocations are preserved |

### 6.4 E4 — Allocation History

| Test | Expected result |
|------|----------------|
| TRX-2BC7DB detail panel | Collapsed "Allocation History" section visible |
| Expand history | Shows 3 log entries with customer names and lot IDs |
| Unallocated record | No Allocation History section shown |

---

## 7. Future Considerations

The following items are out of scope for this spec but noted for future planning:

- **Batch allocation** — allocate to multiple customers in one dialog submission (proportional split).
- **Undo allocation** — reverse a specific lot (requires API support for lot deletion with position/portfolio rollback).
- **Customer portfolio drill-through** — from the detail panel, link to a portfolio summary view showing all positions and lots for a customer.
- **Bank asset consolidation view** — show the bank-level holding (sum of all customer positions) for an asset, useful for reconciliation.
- **Real-time position tracking** — after daily snapshot confirmation, show market value and unrealized P&L in the portfolio summary.
