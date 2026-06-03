# SPEC: Income Allocation — Frontend (enrichment-workspace)

**Component:** enrichment-workspace (Joget Custom Builder plugin)
**Date:** 2026-03-15
**Author:** Aare Lapõnin / Claude
**Status:** Draft
**Depends on:** [INCOME-ALLOCATION-SPEC.md](../../enrichment-api/docs/INCOME-ALLOCATION-SPEC.md) (backend)

---

## 1. Overview

This spec covers all frontend changes needed in the `enrichment-workspace` plugin to support income allocation (D2). The backend spec defines the API contracts and algorithm; this document focuses on UI flow, dialog design, detail panel changes, and the routing fix that eliminates the "Type not allocatable" architectural bug.

### Design rule

> An action button must never be enabled if clicking it immediately shows an error. The gate logic in the menu (`isFundSel`) and the gate logic in the dialog must be consistent. `openFundAllocDialog` becomes a router: securities types → trade allocation dialog, income types → income allocation dialog. No enabled button ever leads to a dead end.

---

## 2. Files Changed

| File | Change Type | Summary |
|------|-------------|---------|
| `ew-actions.js` | Modified | Add `INCOME_ALLOC_TYPES` constant, router in `openFundAllocDialog`, new `openIncomeAllocDialog` function with full dialog lifecycle |
| `ew-api.js` | Modified | Add 3 new API methods: `previewIncomeAllocation`, `allocateIncome`, `getIncomeAllocationSummary` |
| `ew-detail.js` | Modified | §8 Fund Allocation section: show income allocation data for income types instead of trade lots; §9 Allocation History: render income allocation records |
| `ew-workspace.css` | Modified | Add styles for income allocation dialog elements (date inputs, preview table, confirm phase) |

---

## 3. Constants & Routing (`ew-actions.js`)

### 3.1 New constant

```javascript
// Line ~19, after ALLOC_TYPES and ALLOC_ELIGIBLE
var INCOME_ALLOC_TYPES = ['DIV_INCOME', 'DIV_TAX', 'BOND_INT'];
```

These are the types eligible for income allocation (proportional share-days distribution). They come from the backend spec §2.

### 3.2 Router in `openFundAllocDialog`

Current code (line 1961) checks `ALLOC_TYPES` and blocks everything else. The fix turns this function into a router:

```javascript
function openFundAllocDialog(selected) {
    if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
    var rec = EW.state.records && EW.state.records[selected[0].id];
    if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

    // ── ROUTER ────────────────────────────────────────────────
    // Income types → income allocation dialog
    if (INCOME_ALLOC_TYPES.indexOf(rec.internal_type) >= 0) {
        return openIncomeAllocDialog(selected);
    }
    // Securities trade types → existing trade allocation dialog
    if (ALLOC_TYPES.indexOf(rec.internal_type) < 0) {
        EW.toast.show('Type "' + rec.internal_type + '" is not allocatable.', 'warning');
        return;
    }
    // ... rest of existing trade allocation logic unchanged ...
}
```

**Key point:** The `ALLOC_TYPES` fallback toast remains as a safety net, but with the router in place, no type that passes `isFundSel()` should ever reach it. The combination of `isFundSel` (menu gate) → router (dialog gate) guarantees consistency.

---

## 4. API Methods (`ew-api.js`)

Three new methods, all following the existing `save` query-param dispatch pattern.

### 4.1 `previewIncomeAllocation`

Computes the allocation without writing anything. Returns the share-days breakdown so the user can review before confirming.

```javascript
/**
 * Preview income allocation (dry-run, no writes).
 * @param {string} enrichmentId - Enrichment record ID
 * @param {string} periodStart  - Accrual period start (YYYY-MM-DD)
 * @param {string} periodEnd    - Accrual period end (YYYY-MM-DD)
 * @returns {Promise<Object>} - { enrichmentId, asset, totalAmount, currency,
 *     totalShareDays, allocations: [{customerId, customerName, shareDays,
 *     holdingDays, avgQtyHeld, allocationPct, allocatedAmount, allocatedAmountEur}], ms }
 */
EW.api.previewIncomeAllocation = function(enrichmentId, periodStart, periodEnd) {
    var payload = {
        previewIncomeAllocation: true,
        enrichmentId: enrichmentId,
        accrualPeriodStart: periodStart,
        accrualPeriodEnd: periodEnd
    };
    var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
    console.log('[EW] PreviewIncomeAllocation:', enrichmentId, periodStart, periodEnd);
    return fetch(url, { headers: headers() }).then(function(r) {
        if (!r.ok) return handleError(r);
        return r.json();
    });
};
```

### 4.2 `allocateIncome`

Executes the allocation: writes `incomeAllocation` records and updates `fund_allocation_status`.

```javascript
/**
 * Execute income allocation (writes records).
 * @param {string} enrichmentId - Enrichment record ID
 * @param {string} periodStart  - Accrual period start (YYYY-MM-DD)
 * @param {string} periodEnd    - Accrual period end (YYYY-MM-DD)
 * @returns {Promise<Object>} - { success, enrichmentId, allocations: [...],
 *     allocationStatus, ms }
 */
EW.api.allocateIncome = function(enrichmentId, periodStart, periodEnd) {
    var payload = {
        allocateIncome: true,
        enrichmentId: enrichmentId,
        accrualPeriodStart: periodStart,
        accrualPeriodEnd: periodEnd
    };
    var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
    console.log('[EW] AllocateIncome:', enrichmentId, periodStart, periodEnd);
    return fetch(url, { headers: headers() }).then(function(r) {
        if (!r.ok) return handleError(r);
        return r.json();
    });
};
```

### 4.3 `getIncomeAllocationSummary`

Fetches existing income allocations for display in the detail panel.

```javascript
/**
 * Fetch income allocation summary for an enrichment record.
 * @param {string} enrichmentId - Enrichment record ID
 * @returns {Promise<Object>} - { enrichmentId, totalAmount, allocatedAmount,
 *     allocationStatus, allocations: [{incomeAllocId, customerId, customerName,
 *     allocationPct, allocatedAmount, shareDays, holdingDays}], ms }
 */
EW.api.getIncomeAllocationSummary = function(enrichmentId) {
    var payload = { incomeAllocationSummary: true, enrichmentId: enrichmentId };
    var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
    console.log('[EW] IncomeAllocationSummary:', enrichmentId);
    return fetch(url, { headers: headers() }).then(function(r) {
        if (!r.ok) return handleError(r);
        return r.json();
    });
};
```

---

## 5. Income Allocation Dialog (`ew-actions.js`)

### 5.1 Single-button flow with inline confirmation

The dialog uses a **single primary action button** with progressive disclosure:

1. **Input phase** — User sees the income summary and enters/adjusts accrual period dates. The "Allocate Income" button is always enabled once dates are valid.
2. **Confirm phase** — Clicking "Allocate Income" calls the preview endpoint behind the scenes, shows the computed share-days breakdown inline, and the button changes to "Confirm & Allocate". The user reviews and clicks to commit, or adjusts dates (which resets back to input phase).

This avoids the poor UX of a mandatory preview step with a disabled action button. The backend's `previewIncomeAllocation` → `allocateIncome` flow is preserved, but the preview is triggered automatically by the single button rather than requiring a separate click.

### 5.2 Dialog structure

```
openIncomeAllocDialog(selected)
├── Validate: single record, in cache, eligible status
├── Check: not already allocated (fund_allocation_status !== 'allocated')
├── Render dialog shell
├── Fetch enrichment record details (or use cached rec)
├── Render dialog body:
│   ├── Income Summary card (read-only)
│   ├── Accrual Period inputs (date pickers)
│   ├── Preview container (empty initially)
│   └── Footer: [Cancel] [Allocate Income] (enabled when dates valid)
├── On "Allocate Income" click (phase=input):
│   ├── Validate dates
│   ├── Call EW.api.previewIncomeAllocation(id, start, end)
│   ├── Show loading spinner in button
│   ├── Render preview table with share-days per customer
│   ├── Change button to "Confirm & Allocate" (phase=confirm)
│   └── On error: toast with error, stay in input phase
├── On date change (while phase=confirm):
│   ├── Clear preview table
│   └── Reset button to "Allocate Income" (phase=input)
└── On "Confirm & Allocate" click (phase=confirm):
    ├── Call EW.api.allocateIncome(id, start, end)
    ├── On success: toast, close dialog, reload table + detail
    └── On error: toast with error message, re-enable button
```

### 5.3 Dialog HTML layout

**Phase 1 — Input (initial state):**
```
┌─────────────────────────────────────────────────────────┐
│  Income Allocation                                  [×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Income Summary ──────────────────────────────────┐  │
│  │ Enrichment ID   TRX-9395BD                        │  │
│  │ Type            DIV_INCOME                        │  │
│  │ Asset           MU (US5951121038)                 │  │
│  │ Amount          81.25 USD                         │  │
│  │ Date            2024-07-24                        │  │
│  │ FX Rate         0.9204 (→ EUR)                    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ACCRUAL PERIOD                                         │
│                                                         │
│  Start date: [ 2024-04-01 ]   End date: [ 2024-07-24 ] │
│  ℹ Typically: ex-dividend date to record date.          │
│                                                         │
│              [Cancel]      [🪙 Allocate Income]          │
└─────────────────────────────────────────────────────────┘
```

**Phase 2 — Confirm (after clicking "Allocate Income"):**
```
┌─────────────────────────────────────────────────────────┐
│  Income Allocation                                  [×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Income Summary ──────────────────────────────────┐  │
│  │ (same as above)                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ACCRUAL PERIOD                                         │
│  Start: 2024-04-01  End: 2024-07-24                     │
│                                                         │
│  ┌─ Allocation Preview ──────────────────────────────┐  │
│  │                                                    │  │
│  │  Customer            Days  Avg Qty  Share-Days     │  │
│  │  ─────────────────── ──── ──────── ──────────     │  │
│  │  ADVERTA GRUPP OÜ     37    15.0      555.0       │  │
│  │  ASKEMBLA A.M. OÜ     37     5.0      185.0       │  │
│  │                                                    │  │
│  │  Customer            Pct     Amount    EUR         │  │
│  │  ─────────────────── ─────── ──────── ────────    │  │
│  │  ADVERTA GRUPP OÜ    75.00%   60.94    56.07      │  │
│  │  ASKEMBLA A.M. OÜ    25.00%   20.31    18.69      │  │
│  │  ─────────────────── ─────── ──────── ────────    │  │
│  │  TOTAL               100.0%   81.25    74.76      │  │
│  │                                                    │  │
│  │  Total share-days: 740 · 2 customers · 38 days    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│              [Cancel]    [✓ Confirm & Allocate]          │
└─────────────────────────────────────────────────────────┘
```

**Key UX points:**
- No separate "Preview" button — the primary action button drives the flow.
- In confirm phase, date inputs become read-only text; changing dates (via "edit" link or re-opening) resets to input phase.
- The button label change from "Allocate Income" → "Confirm & Allocate" signals that the user is now committing.

### 5.4 Date defaults

When the dialog opens, pre-fill dates with sensible defaults based on available data:

| Field | Default | Rationale |
|-------|---------|-----------|
| End date | `rec.transaction_date` | Income event date is typically the record/payment date |
| Start date | 90 days before end date | Conservative default; user adjusts to ex-dividend date |

The hint text "Typically: ex-dividend date to record date" helps the user understand what to enter.

### 5.5 Validation (client-side)

Before calling preview:

| Check | Message |
|-------|---------|
| Start date empty | "Enter the accrual period start date." |
| End date empty | "Enter the accrual period end date." |
| End before start | "End date must be after start date." |
| Period > 366 days | "Accrual period seems too long (>1 year). Please check dates." (warning, not block) |

### 5.6 State management

Similar to existing trade allocation state at `EW.state._alloc`:

```javascript
EW.state._incomeAlloc = {
    enrichmentId: '...',
    rec: { ... },           // cached enrichment record
    periodStart: '...',     // user-entered start date
    periodEnd: '...',       // user-entered end date
    preview: null,          // API response from previewIncomeAllocation
    phase: 'input'          // 'input' | 'loading' | 'confirm' | 'allocating'
};
```

### 5.7 Function signatures

```javascript
// Main entry point (called from router)
function openIncomeAllocDialog(selected) { ... }

// Render the dialog body HTML
function renderIncomeAllocBody() { ... }

// Render the preview table after API call
function renderIncomePreviewTable(preview) { ... }

// Global handlers (window-exposed for onclick)
window.EW_doAllocateIncome = function() { ... }   // Handles both phases: input → preview, confirm → commit
window.EW_closeIncomeAllocDialog = function() { ... }
```

### 5.8 Implementation sketch

```javascript
function openIncomeAllocDialog(selected) {
    if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
    var rec = EW.state.records && EW.state.records[selected[0].id];
    if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

    // Check eligible status
    if (ALLOC_ELIGIBLE.indexOf(rec.status) < 0) {
        EW.toast.show('Status "' + rec.status + '" not eligible for allocation.', 'warning');
        return;
    }
    // Check not already allocated
    if (rec.fund_allocation_status === 'allocated') {
        EW.toast.show('Income is already fully allocated.', 'info');
        return;
    }
    // Check asset is resolved
    if (!rec.resolved_asset_id) {
        EW.toast.show('No asset linked. Resolve the asset before allocating income.', 'warning');
        return;
    }

    // Store state
    var defaultEnd = rec.transaction_date || '';
    var defaultStart = '';
    if (defaultEnd) {
        var d = new Date(defaultEnd);
        d.setDate(d.getDate() - 90);
        defaultStart = d.toISOString().substring(0, 10);
    }
    EW.state._incomeAlloc = {
        enrichmentId: rec.id,
        rec: rec,
        periodStart: defaultStart,
        periodEnd: defaultEnd,
        preview: null,
        phase: 'input'
    };

    // Render dialog shell — button is enabled from the start
    var html = '<div class="ew-overlay" id="ew-income-alloc-overlay">'
        + '<div class="ew-dialog ew-dialog-wide">'
        +   '<div class="ew-dialog-header"><h3>Income Allocation</h3>'
        +   '<button class="ew-dialog-close" onclick="EW_closeIncomeAllocDialog()">&times;</button></div>'
        +   '<div class="ew-dialog-body" id="ew-income-alloc-body">'
        +     renderIncomeAllocBody()
        +   '</div>'
        +   '<div class="ew-dialog-footer">'
        +     '<button class="ew-btn-cancel" onclick="EW_closeIncomeAllocDialog()">Cancel</button>'
        +     '<button class="ew-btn-save" id="ew-income-alloc-btn" onclick="EW_doAllocateIncome()">'
        +       '<i class="fas fa-coins"></i> Allocate Income'
        +     '</button>'
        +   '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    bindOverlayClose('ew-income-alloc-overlay');

    // Listen for date changes → reset to input phase if in confirm phase
    var startEl = document.getElementById('ew-ia-start');
    var endEl = document.getElementById('ew-ia-end');
    var resetToInput = function() {
        var ia = EW.state._incomeAlloc;
        if (ia && ia.phase === 'confirm') {
            ia.phase = 'input';
            ia.preview = null;
            var container = document.getElementById('ew-ia-preview-container');
            if (container) container.innerHTML = '';
            var btn = document.getElementById('ew-income-alloc-btn');
            if (btn) btn.innerHTML = '<i class="fas fa-coins"></i> Allocate Income';
        }
    };
    if (startEl) startEl.addEventListener('change', resetToInput);
    if (endEl) endEl.addEventListener('change', resetToInput);
}

function renderIncomeAllocBody() {
    var ia = EW.state._incomeAlloc;
    var rec = ia.rec;
    var h = '';

    // Income summary card
    h += '<div class="ew-alloc-summary">'
        + '<div class="ew-alloc-summary-hdr"><i class="fas fa-hand-holding-usd"></i> Income Summary</div>'
        + '<div class="ew-alloc-summary-grid">'
        + '<div class="ew-alloc-field"><label>Enrichment ID</label><div>' + esc(rec.id) + '</div></div>'
        + '<div class="ew-alloc-field"><label>Type</label><div>' + esc(rec.internal_type) + '</div></div>'
        + '<div class="ew-alloc-field"><label>Asset</label><div>' + esc(rec.resolved_asset_id || '—')
        +   (rec.asset_isin ? ' <span style="font-size:.78em;color:#94a3b8">(' + esc(rec.asset_isin) + ')</span>' : '')
        + '</div></div>'
        + '<div class="ew-alloc-field"><label>Amount</label><div class="mono">' + fmtAmount(rec.total_amount) + ' ' + esc(rec.validated_currency || rec.original_currency || '') + '</div></div>'
        + '<div class="ew-alloc-field"><label>Date</label><div>' + esc(rec.transaction_date || '—') + '</div></div>'
        + '<div class="ew-alloc-field"><label>FX Rate</label><div class="mono">' + (rec.fx_rate_to_eur || '—') + '</div></div>'
        + '</div></div>';

    // Accrual period inputs (no separate Preview button — primary action handles it)
    h += '<div class="ew-split-divider">Accrual Period</div>';
    h += '<div class="ew-f-row">'
        + '<div class="ew-f-field"><label>Start Date</label>'
        + '<input type="date" class="ew-edit-input" id="ew-ia-start" value="' + esc(ia.periodStart) + '" /></div>'
        + '<div class="ew-f-field"><label>End Date</label>'
        + '<input type="date" class="ew-edit-input" id="ew-ia-end" value="' + esc(ia.periodEnd) + '" /></div>'
        + '</div>';
    h += '<div style="font-size:.78em;color:#94a3b8;margin-top:2px">'
        + '<i class="fas fa-info-circle"></i> '
        + 'Typically: ex-dividend date to record date. '
        + 'System reconstructs daily holdings from allocation lots in this period.</div>';

    // Preview placeholder
    h += '<div id="ew-ia-preview-container"></div>';

    return h;
}

function renderIncomePreviewTable(preview) {
    var allocs = preview.allocations || [];
    if (allocs.length === 0) {
        return '<div style="color:#dc2626;margin-top:12px;font-size:.88em">'
            + '<i class="fas fa-exclamation-circle"></i> No customers held this asset during the period.</div>';
    }

    var totalShareDays = parseFloat(preview.totalShareDays) || 0;
    var totalAmount = parseFloat(preview.totalAmount) || 0;
    var currency = preview.currency || '';
    var periodDays = 0;
    if (preview.accrualPeriodStart && preview.accrualPeriodEnd) {
        var d1 = new Date(preview.accrualPeriodStart), d2 = new Date(preview.accrualPeriodEnd);
        periodDays = Math.round((d2 - d1) / 86400000) + 1;
    }

    var h = '<div class="ew-split-divider">Allocation Preview</div>';
    h += '<table class="ew-alloc-lots-table"><thead><tr>'
        + '<th>Customer</th>'
        + '<th style="text-align:right">Days Held</th>'
        + '<th style="text-align:right">Avg Qty</th>'
        + '<th style="text-align:right">Share-Days</th>'
        + '<th style="text-align:right">Pct</th>'
        + '<th style="text-align:right">Amount (' + esc(currency) + ')</th>'
        + '<th style="text-align:right">EUR</th>'
        + '</tr></thead><tbody>';

    var sumAmt = 0, sumEur = 0;
    for (var i = 0; i < allocs.length; i++) {
        var a = allocs[i];
        var pct = parseFloat(a.allocationPct) || 0;
        var amt = parseFloat(a.allocatedAmount) || 0;
        var eur = parseFloat(a.allocatedAmountEur) || 0;
        sumAmt += amt;
        sumEur += eur;

        h += '<tr>'
            + '<td>' + esc(a.customerName || a.customerId) + '</td>'
            + '<td style="text-align:right">' + (a.holdingDays || '—') + '</td>'
            + '<td style="text-align:right;font-family:monospace">' + fmtAmount(a.avgQtyHeld) + '</td>'
            + '<td style="text-align:right;font-family:monospace">' + fmtAmount(a.shareDays) + '</td>'
            + '<td style="text-align:right">' + (pct * 100).toFixed(2) + '%</td>'
            + '<td style="text-align:right;font-family:monospace">' + fmtAmount(amt) + '</td>'
            + '<td style="text-align:right;font-family:monospace">' + fmtAmount(eur) + '</td>'
            + '</tr>';
    }

    h += '<tr class="ew-alloc-lots-total">'
        + '<td><strong>TOTAL</strong></td>'
        + '<td></td><td></td>'
        + '<td style="text-align:right;font-family:monospace"><strong>' + fmtAmount(totalShareDays) + '</strong></td>'
        + '<td style="text-align:right"><strong>100.00%</strong></td>'
        + '<td style="text-align:right;font-family:monospace"><strong>' + fmtAmount(sumAmt) + '</strong></td>'
        + '<td style="text-align:right;font-family:monospace"><strong>' + fmtAmount(sumEur) + '</strong></td>'
        + '</tr>';

    h += '</tbody></table>';

    h += '<div style="font-size:.78em;color:#64748b;margin-top:6px">'
        + 'Total share-days: ' + fmtAmount(totalShareDays)
        + ' · ' + allocs.length + ' customer' + (allocs.length !== 1 ? 's' : '')
        + ' · ' + periodDays + ' day period'
        + '</div>';

    return h;
}
```

### 5.9 Global event handlers

The single button (`EW_doAllocateIncome`) handles both phases:
- **phase=input** → validates dates, calls preview API, shows breakdown, transitions to confirm phase
- **phase=confirm** → calls allocateIncome API, commits the allocation

```javascript
window.EW_doAllocateIncome = function() {
    var ia = EW.state._incomeAlloc;
    if (!ia) return;

    // ── PHASE: CONFIRM → commit the allocation ──────────
    if (ia.phase === 'confirm' && ia.preview) {
        var btn = document.getElementById('ew-income-alloc-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Allocating…'; }
        ia.phase = 'allocating';

        EW.api.allocateIncome(ia.enrichmentId, ia.periodStart, ia.periodEnd)
            .then(function(result) {
                var count = (result.allocations || []).length;
                EW.toast.show('Income allocated to ' + count + ' customer' + (count !== 1 ? 's' : '') + '.', 'success');
                EW_closeIncomeAllocDialog();
                if (EW.state._allocCache) delete EW.state._allocCache[ia.enrichmentId];
                EW.table.load();
                setTimeout(function() { EW.detail.open(ia.enrichmentId); }, 400);
            })
            .catch(function(e) {
                EW.toast.show('Allocation failed: ' + e.message, 'error');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirm & Allocate'; }
                ia.phase = 'confirm';
            });
        return;
    }

    // ── PHASE: INPUT → validate, preview, show breakdown ──────────
    var startEl = document.getElementById('ew-ia-start');
    var endEl = document.getElementById('ew-ia-end');
    var start = startEl ? startEl.value : '';
    var end = endEl ? endEl.value : '';

    // Validate
    if (!start) { EW.toast.show('Enter the accrual period start date.', 'warning'); return; }
    if (!end) { EW.toast.show('Enter the accrual period end date.', 'warning'); return; }
    if (end < start) { EW.toast.show('End date must be after start date.', 'warning'); return; }

    ia.periodStart = start;
    ia.periodEnd = end;
    ia.phase = 'loading';

    // Show loading in button
    var btn = document.getElementById('ew-income-alloc-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Computing…'; }

    // Show loading in preview container
    var container = document.getElementById('ew-ia-preview-container');
    if (container) {
        container.innerHTML = '<div class="ew-slide-loading" style="margin:12px 0">'
            + '<i class="fas fa-spinner fa-spin"></i> Computing share-days allocation…</div>';
    }

    EW.api.previewIncomeAllocation(ia.enrichmentId, start, end)
        .then(function(preview) {
            ia.preview = preview;
            ia.phase = 'confirm';
            var container = document.getElementById('ew-ia-preview-container');
            if (container) container.innerHTML = renderIncomePreviewTable(preview);
            // Change button to confirm mode
            var btn = document.getElementById('ew-income-alloc-btn');
            if (btn && preview.allocations && preview.allocations.length > 0) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-check"></i> Confirm & Allocate';
            } else if (btn) {
                // No customers found — keep button in input mode label but disabled
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-coins"></i> Allocate Income';
                ia.phase = 'input';
            }
        })
        .catch(function(e) {
            ia.phase = 'input';
            var container = document.getElementById('ew-ia-preview-container');
            if (container) {
                container.innerHTML = '<div style="color:#dc2626;font-size:.88em;margin:12px 0">'
                    + '<i class="fas fa-exclamation-circle"></i> ' + esc(e.message) + '</div>';
            }
            var btn = document.getElementById('ew-income-alloc-btn');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-coins"></i> Allocate Income'; }
        });
};

window.EW_closeIncomeAllocDialog = function() {
    var overlay = document.getElementById('ew-income-alloc-overlay');
    if (overlay) overlay.remove();
    EW.state._incomeAlloc = null;
};
```

---

## 6. Detail Panel Changes (`ew-detail.js`)

### 6.1 Income type detection

Add a helper alongside the existing `isAllocType`:

```javascript
// Line ~216, after isAllocType
var INCOME_TYPES = ['DIV_INCOME', 'DIV_TAX', 'BOND_INT'];
function isIncomeAllocType(r) {
    return INCOME_TYPES.indexOf(r.internal_type) >= 0;
}
```

### 6.2 §8 Section title

Currently (line 647):
```javascript
var sec8Title = isAllocType(r) ? 'Trade Allocation' : 'Fund Allocation';
```

Change to:
```javascript
var sec8Title = isAllocType(r) ? 'Trade Allocation'
    : isIncomeAllocType(r) ? 'Income Allocation'
    : 'Fund Allocation';
```

### 6.3 `renderFundSection` — income-specific content

Current `renderFundSection` shows trade allocation progress (lot count, quantity bar). For income types, it should show income allocation data instead.

Add early branch at the top of `renderFundSection`:

```javascript
function renderFundSection(r) {
    // Income types → dedicated rendering
    if (isIncomeAllocType(r)) {
        return renderIncomeAllocSection(r);
    }
    // ... existing trade allocation rendering unchanged ...
}
```

New function:

```javascript
function renderIncomeAllocSection(r) {
    var allocStatus = r.fund_allocation_status || 'pending';
    var statusLabel = allocStatus === 'allocated' ? 'Fully Allocated' : 'Pending';
    var statusCls = allocStatus === 'allocated' ? 'st-confirmed' : 'st-enriched';

    var h = '<div class="ew-f-row">';
    h += '<div class="ew-f-field"><label>Allocation Status</label>'
        + '<span class="' + statusCls + '" style="font-size:.84em;padding:2px 8px;border-radius:3px">'
        + esc(statusLabel) + '</span></div>';
    h += '<div class="ew-f-field"><label>Asset</label><div>'
        + esc(r.resolved_asset_id || '—') + '</div></div>';
    h += '</div>';

    // Async-loaded allocation details
    if (allocStatus === 'allocated') {
        h += '<div id="ew-income-alloc-detail">'
            + '<div class="ew-alloc-inline-loading"><i class="fas fa-spinner fa-spin"></i> Loading income allocations…</div>'
            + '</div>';
    }

    // Allocate button
    if (isEditable(r.status) && allocStatus !== 'allocated') {
        h += '<button class="ew-op-btn highlight" style="margin-top:6px" onclick="EW.actions.execute(\'allocFund\')">'
            + '<i class="fas fa-coins"></i> Allocate Income</button>';
    }

    return h;
}
```

### 6.4 Async loading for income allocations

After the detail panel renders, if the record is an income type with `fund_allocation_status !== 'pending'`, load income allocation data:

In `EW.detail.open`, after the existing `loadAllocationData(record.id)` call, add:

```javascript
// Income allocation async load
if (isIncomeAllocType(record) && allocStatus !== 'pending') {
    loadIncomeAllocationData(record.id);
}
```

New async loader:

```javascript
function loadIncomeAllocationData(enrichmentId) {
    var detailEl = document.getElementById('ew-income-alloc-detail');
    if (!detailEl) return;
    if (!EW.api.getIncomeAllocationSummary) return;

    EW.api.getIncomeAllocationSummary(enrichmentId)
        .then(function(data) {
            var target = document.getElementById('ew-income-alloc-detail');
            if (!target) return;
            target.innerHTML = renderIncomeAllocBreakdown(data);
        })
        .catch(function() {
            var target = document.getElementById('ew-income-alloc-detail');
            if (target) target.innerHTML = '<div class="ew-alloc-inline-summary" style="color:#94a3b8;font-style:italic">Could not load income allocation details.</div>';
        });
}

function renderIncomeAllocBreakdown(data) {
    var allocs = data.allocations || [];
    if (allocs.length === 0) return '<div class="ew-alloc-inline-summary">No allocations.</div>';

    var h = '<table class="ew-alloc-lots-table" style="margin-top:8px"><thead><tr>'
        + '<th>Customer</th>'
        + '<th style="text-align:right">Share-Days</th>'
        + '<th style="text-align:right">Pct</th>'
        + '<th style="text-align:right">Amount</th>'
        + '</tr></thead><tbody>';

    for (var i = 0; i < allocs.length; i++) {
        var a = allocs[i];
        var pct = parseFloat(a.allocationPct) || 0;
        h += '<tr>'
            + '<td>' + esc(a.customerName || a.customerId) + '</td>'
            + '<td style="text-align:right;font-family:monospace">' + fmtAmt(a.shareDays) + '</td>'
            + '<td style="text-align:right">' + (pct * 100).toFixed(2) + '%</td>'
            + '<td style="text-align:right;font-family:monospace">' + fmtAmt(a.allocatedAmount) + '</td>'
            + '</tr>';
    }

    h += '</tbody></table>';
    return h;
}
```

### 6.5 Ribbon update for income types

Currently (line 253), the blue "Fund transaction — allocate to investors" ribbon shows for all unallocated fund types. Update to show income-specific text:

```javascript
} else if (isFundTrx(r) && r.status !== 'paired' && r.fund_allocation_status !== 'allocated') {
    var ribbonText = isIncomeAllocType(r)
        ? 'Income transaction — allocate to investors'
        : 'Fund transaction — allocate to investors';
    h += '<div class="ew-ctx-ribbon blue">'
        + '<i class="fas fa-chart-pie"></i> '
        + '<span>' + ribbonText + '</span>'
        + '<button class="ew-ctx-btn" onclick="EW.actions.execute(\'allocFund\')">Allocate</button>'
        + '</div>';
}
```

### 6.6 Op bar button label

In `renderOpBar` (line 283):

```javascript
if (isFundTrx(r) && r.fund_allocation_status !== 'allocated') {
    var allocLabel = isAllocType(r) ? 'Allocate Trade'
        : isIncomeAllocType(r) ? 'Allocate Income'
        : 'Fund Alloc';
    h += '<button class="ew-op-btn highlight" ...>' + allocLabel + '</button>';
}
```

---

## 7. CSS Changes (`ew-workspace.css`)

Minimal additions — reuses existing dialog and table styles.

```css
/* Income allocation date inputs row */
.ew-ia-dates {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    margin: 8px 0;
}
.ew-ia-dates .ew-edit-input[type="date"] {
    width: 160px;
}

/* Preview table total row */
.ew-alloc-lots-table tr.ew-alloc-lots-total td {
    border-top: 2px solid #e2e8f0;
    padding-top: 6px;
}

/* Income allocation detail in slide-over */
#ew-income-alloc-detail {
    margin-top: 8px;
}
```

---

## 8. Interaction with Existing Trade Allocation

The income allocation dialog and trade allocation dialog are separate code paths that share:

| Shared element | Location | Notes |
|---------------|----------|-------|
| Menu gate `isFundSel()` | `ew-actions.js:31` | Unchanged — enables button for both securities and fund/income types |
| Toolbar item `allocFund` | `ew-actions.js:84` | Unchanged — `needsFund: true` |
| `openFundAllocDialog` router | `ew-actions.js:1961` | **Modified** — routes to appropriate dialog |
| `ALLOC_ELIGIBLE` statuses | `ew-actions.js:19` | Shared — same eligible statuses for both allocation types |
| Dialog CSS classes | `ew-workspace.css` | Shared — `ew-overlay`, `ew-dialog`, `ew-dialog-wide`, `ew-alloc-summary`, etc. |
| Toast notifications | `EW.toast` | Shared |
| Table reload | `EW.table.load()` | Shared — called after successful allocation |

The two dialogs do NOT share:

| Element | Trade allocation | Income allocation |
|---------|-----------------|-------------------|
| Overlay ID | `ew-alloc-overlay` | `ew-income-alloc-overlay` |
| State key | `EW.state._alloc` | `EW.state._incomeAlloc` |
| API methods | `getSecuTransaction`, `getAllocationSummary`, `allocateTrade` | `previewIncomeAllocation`, `allocateIncome`, `getIncomeAllocationSummary` |
| Flow | Single-step (select customer + qty, allocate) | Single-button with confirm (enter dates → click → preview shown → click again to commit) |
| Global handlers | `EW_doAllocateTrade`, `EW_closeAllocDialog` | `EW_doAllocateIncome`, `EW_closeIncomeAllocDialog` |

---

## 9. Edge Cases — Frontend-Specific

| Case | Handling |
|------|----------|
| No `resolved_asset_id` on income record | Block in dialog: "No asset linked. Resolve the asset before allocating income." |
| User changes dates after confirm phase | Preview table clears, button resets to "Allocate Income" (input phase), user can click again |
| Preview returns 0 customers | Show red message: "No customers held this asset during the period." Button resets to input phase, stays disabled until dates change. |
| API timeout during preview | Show error in preview container, button re-enables with "Allocate Income" label, user can retry |
| Dialog closed during API call | Guards check `document.getElementById('ew-ia-preview-container')` before writing; stale callbacks become no-ops |
| Record already allocated, user opens dialog | Blocked early: "Income is already fully allocated." toast |
| User double-clicks Allocate | Button disables immediately on click; `phase` set to `allocating` prevents re-entry |

---

## 10. Testing Checklist

### 10.1 Router

- [ ] Select a `DIV_INCOME` record → click "Allocate to Investors" → income allocation dialog opens (not trade dialog, not "Type not allocatable" error)
- [ ] Select a `DIV_TAX` record → same behavior
- [ ] Select an `EQ_BUY` record → trade allocation dialog opens (unchanged behavior)
- [ ] Select a `SEC_SELL` record → trade allocation dialog opens (unchanged behavior)

### 10.2 Income allocation dialog

- [ ] Dialog shows correct income summary (type, amount, currency, asset, date)
- [ ] Date defaults: end = transaction_date, start = 90 days prior
- [ ] Click "Allocate Income" without dates → validation toast
- [ ] Click "Allocate Income" with end < start → validation toast
- [ ] Click "Allocate Income" with valid dates → button shows "Computing…" → preview table appears → button changes to "Confirm & Allocate"
- [ ] Preview table shows correct customer breakdown with share-days, pct, amounts
- [ ] Change dates while in confirm phase → preview clears, button resets to "Allocate Income"
- [ ] Click "Confirm & Allocate" → button shows "Allocating…" → success toast → dialog closes
- [ ] After allocation: table reloads, detail panel shows "Fully Allocated"
- [ ] Error from API → toast with message, button re-enables

### 10.3 Detail panel

- [ ] `DIV_INCOME` with `fund_allocation_status = 'pending'` → §8 shows "Income Allocation" title, "Pending" status, "Allocate Income" button
- [ ] `DIV_INCOME` with `fund_allocation_status = 'allocated'` → §8 shows "Fully Allocated", async-loads income allocation breakdown table
- [ ] Green ribbon shows for allocated income types
- [ ] Blue ribbon shows "Income transaction — allocate to investors" for unallocated income types
- [ ] Op bar shows "Allocate Income" label (not "Fund Alloc") for income types
- [ ] `EQ_BUY` detail panel unchanged — still shows "Trade Allocation" §8

### 10.4 Regression

- [ ] Existing trade allocation (EQ_BUY, EQ_SELL) still works end-to-end
- [ ] Existing SELL validation ("insufficient holdings") still surfaces correctly
- [ ] No console errors on any dialog open/close cycle
