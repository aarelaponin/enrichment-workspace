/**
 * ew-detail.js — detail slide-over panel with inline editing.
 *
 * Opens when clicking a table row. Shows all record fields in 8 collapsible sections.
 * Fields are editable when the record's status allows it, driven by the FIELDS config.
 */
(function(EW) {
    'use strict';

    // ── Field configuration ──────────────────────────────────────────────────

    /**
     * Editable field definitions. Each key is a record field ID.
     * Fields not listed here are always read-only.
     */
    var FIELDS = {
        // Section 3: Transaction Core
        transaction_date:      { type: 'date',     label: 'Transaction Date',    required: true },
        settlement_date:       { type: 'date',     label: 'Settlement Date',     required: true },
        debit_credit:          { type: 'select',   label: 'D/C',                 required: true,
            options: [['D','D (Debit)'],['C','C (Credit)']] },
        original_amount:       { type: 'decimal',  label: 'Amount',              required: true },
        fee_amount:            { type: 'decimal',  label: 'Fee' },
        total_amount:          { type: 'decimal',  label: 'Total',               required: true },
        description:           { type: 'textarea', label: 'Description',         maxlen: 500 },
        // Section 4: Classification
        internal_type:         { type: 'select',   label: 'Internal Type',       required: true,
            options: [['SEC_BUY','SEC_BUY'],['SEC_SELL','SEC_SELL'],
                      ['BOND_BUY','BOND_BUY'],['BOND_COUPON','BOND_COUPON'],
                      ['DIV_INCOME','DIV_INCOME'],['CASH_IN_OUT','CASH_IN_OUT'],
                      ['FX_EXCHANGE','FX_EXCHANGE'],['COMMISSION','COMMISSION']] },
        // Section 5: Currency & FX
        validated_currency:    { type: 'text',     label: 'Validated Currency',  required: true },
        fx_rate_to_eur:        { type: 'decimal',  label: 'FX Rate to EUR' },
        fx_rate_date:          { type: 'date',     label: 'Rate Date' },
        fx_rate_source:        { type: 'select',   label: 'Rate Source',
            options: [['ecb','ECB'],['bloomberg','Bloomberg'],
                      ['manual_override','Manual Override'],['other','Other']] },
        requires_eur_parallel: { type: 'select',   label: 'EUR Parallel',
            options: [['yes','Yes'],['no','No']] },
        // Section 6: Resolved Entities
        resolved_customer_id:  { type: 'text',     label: 'Customer ID',         required: true },
        customer_code:         { type: 'text',     label: 'Customer Code' },
        resolved_asset_id:     { type: 'text',     label: 'Asset ID' },
        asset_category:        { type: 'select',   label: 'Asset Category',
            options: [['EQ','Equity'],['FI','Fixed Income'],['CE','Cash Equiv']] },
        counterparty_id:       { type: 'text',     label: 'Counterparty ID' },
        counterparty_short_code: { type: 'text',   label: 'CP Code' },
        has_fee:               { type: 'select',   label: 'Has Fee',
            options: [['yes','Yes'],['no','No']] },
        // Section 2: Lineage
        lineage_note:          { type: 'textarea', label: 'Lineage Note',        maxlen: 500 },
        // Section 8: Status & Notes
        processing_notes:      { type: 'textarea', label: 'Processing Notes',    maxlen: 1000, alwaysEditable: true }
    };

    /** Statuses that allow editing. */
    var EDITABLE_STATUSES = {
        enriched: true, error: true, manual_review: true, in_review: true,
        adjusted: true, ready: true, paired: true, processing: true
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** HTML-escape a string. */
    function esc(s) {
        if (!s && s !== 0) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    /** Format a numeric amount with 2 decimal places. */
    function fmtAmt(v) {
        if (v === null || v === undefined || v === '') return '';
        var n = parseFloat(v);
        if (isNaN(n)) return esc(String(v));
        return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /** Check if a status allows editing. */
    function isEditable(status) {
        return EDITABLE_STATUSES[status] === true;
    }

    // ── Read-only field rendering ────────────────────────────────────────────

    /**
     * Render a single read-only field display.
     * @param {string} label - Field label
     * @param {*} value - Field value
     * @param {Object} [opts] - Options: {muted, badge, dc, err, mono, bold, wide}
     */
    function renderField(label, value, opts) {
        opts = opts || {};
        var cls = opts.wide ? 'ew-f-field wide' : 'ew-f-field';
        var inner;

        if (opts.badge) {
            inner = '<span class="st-' + esc(value) + '">' + esc(value || '\u2014') + '</span>';
        } else if (opts.dc) {
            inner = '<span class="dc-' + esc(value) + '">'
                + esc(value === 'D' ? 'D (Debit)' : value === 'C' ? 'C (Credit)' : (value || '\u2014'))
                + '</span>';
        } else if (opts.err) {
            inner = '<div class="ew-val err">' + esc(value || '') + '</div>';
        } else {
            var valCls = ['ew-val'];
            if (opts.muted) valCls.push('muted');
            if (opts.mono) valCls.push('mono');
            if (opts.bold) valCls.push('bold');
            inner = '<div class="' + valCls.join(' ') + '">' + esc(value != null ? String(value) : '\u2014') + '</div>';
        }

        return '<div class="' + cls + '"><label>' + esc(label) + '</label>' + inner + '</div>';
    }

    // ── Edit field rendering ─────────────────────────────────────────────────

    /**
     * Render an editable field.
     * @param {string} fieldId - The record field key
     * @param {*} value - Current value
     * @param {Object} cfg - FIELDS config entry
     * @param {boolean} wide - Whether this is a wide field
     */
    function renderEditField(fieldId, value, cfg, wide) {
        var cls = wide ? 'ew-f-field wide' : 'ew-f-field';
        var val = (value != null && value !== undefined) ? String(value) : '';
        var reqCls = (cfg.required && !val) ? ' ew-edit-required' : '';
        var inner;

        switch (cfg.type) {
            case 'select':
                inner = '<select class="ew-edit-select' + reqCls + '" name="' + esc(fieldId) + '">';
                inner += '<option value="">\u2014</option>';
                if (cfg.options) {
                    for (var i = 0; i < cfg.options.length; i++) {
                        var opt = cfg.options[i];
                        var sel = (val === opt[0]) ? ' selected' : '';
                        inner += '<option value="' + esc(opt[0]) + '"' + sel + '>' + esc(opt[1]) + '</option>';
                    }
                }
                inner += '</select>';
                break;
            case 'textarea':
                var maxlen = cfg.maxlen ? ' maxlength="' + cfg.maxlen + '"' : '';
                inner = '<textarea class="ew-edit-textarea' + reqCls + '" name="' + esc(fieldId) + '"'
                    + maxlen + '>' + esc(val) + '</textarea>';
                break;
            case 'date':
                inner = '<input type="date" class="ew-edit-input' + reqCls + '" name="' + esc(fieldId)
                    + '" value="' + esc(val) + '" />';
                break;
            case 'decimal':
                inner = '<input type="number" step="any" class="ew-edit-input' + reqCls + '" name="'
                    + esc(fieldId) + '" value="' + esc(val) + '" />';
                break;
            default: // text
                inner = '<input type="text" class="ew-edit-input' + reqCls + '" name="' + esc(fieldId)
                    + '" value="' + esc(val) + '" />';
                break;
        }

        return '<div class="' + cls + '"><label>' + esc(cfg.label) + '</label>' + inner + '</div>';
    }

    /**
     * Render a field — editable or read-only depending on edit mode and field config.
     * @param {string} fieldId - Record field key
     * @param {*} value - Current value
     * @param {boolean} editMode - Whether the panel is in edit mode
     * @param {Object} [readOnlyOpts] - Options for read-only rendering
     * @param {boolean} [wide] - Wide field
     */
    function renderFieldAuto(fieldId, value, editMode, readOnlyOpts, wide) {
        var cfg = FIELDS[fieldId];
        if (editMode && cfg) {
            return renderEditField(fieldId, value, cfg, wide);
        }
        // Not editable or no config — render read-only
        var label = cfg ? cfg.label : fieldId;
        var opts = readOnlyOpts || {};
        if (wide) opts.wide = true;
        return renderField(label, value, opts);
    }

    // ── Section rendering ────────────────────────────────────────────────────

    function renderSection(title, num, content, defaultExpanded) {
        var display = defaultExpanded ? 'block' : 'none';
        var arrow = defaultExpanded ? '\u25BE' : '\u25B8';

        return '<div class="ew-f-section">'
            + '<button class="ew-f-section-hdr" onclick="EW_toggleSection(this)">'
            + '<span class="ew-sec-num">\u00A7' + num + '</span>'
            + '<span class="ew-sec-title">' + esc(title) + '</span>'
            + '<span class="ew-sec-toggle">' + arrow + '</span>'
            + '</button>'
            + '<div class="ew-f-section-body" style="display:' + display + '">'
            + content
            + '</div></div>';
    }

    // ── Panel rendering ──────────────────────────────────────────────────────

    // ── Context helpers ──────────────────────────────────────────────────

    var TY_CAT;
    function getCat(ty) {
        if (!TY_CAT) TY_CAT = (EW.dashboard && EW.dashboard.TY_CAT) || {};
        return TY_CAT[ty] || '';
    }
    function isLoanType(ty) { return getCat(ty) === 'loan'; }
    function isAllocType(r) {
        var A = ['EQ_BUY','EQ_SELL','BOND_BUY','BOND_SELL','SEC_BUY','SEC_SELL'];
        return A.indexOf(r.internal_type) >= 0;
    }
    var INCOME_TYPES = ['DIV_INCOME', 'DIV_TAX', 'BOND_INT'];
    function isIncomeAllocType(r) { return INCOME_TYPES.indexOf(r.internal_type) >= 0; }
    function isFundTrx(r) { return r.customer_code === '12345678' || getCat(r.internal_type) === 'fund' || isAllocType(r) || isIncomeAllocType(r); }

    // ── Context ribbons ───────────────────────────────────────────────────

    function renderRibbons(r) {
        var h = '';
        // Loan type without linked contract
        if (isLoanType(r.internal_type) && !r.loan_id) {
            h += '<div class="ew-ctx-ribbon amber">'
                + '<i class="fas fa-exclamation-triangle"></i> '
                + '<span>Loan transaction not linked to a contract</span>'
                + '<button class="ew-ctx-btn" onclick="EW.actions.execute(\'linkLoan\')">Link Contract</button>'
                + '</div>';
        }
        // LOAN_PAYMENT with linked contract — can split
        if (r.internal_type === 'LOAN_PAYMENT' && r.loan_id) {
            h += '<div class="ew-ctx-ribbon blue">'
                + '<i class="fas fa-info-circle"></i> '
                + '<span>Loan payment can be split into principal + interest</span>'
                + '<button class="ew-ctx-btn" onclick="EW.actions.execute(\'loanPaymentSplit\')">Loan Split</button>'
                + '</div>';
        }
        // Fund/sec transaction allocation ribbon
        if (isFundTrx(r) && r.fund_allocation_status === 'allocated') {
            h += '<div class="ew-ctx-ribbon green">'
                + '<i class="fas fa-check-circle"></i> '
                + '<span>Fully allocated</span>'
                + '</div>';
        } else if (isAllocType(r) && r.fund_allocation_status !== 'allocated') {
            h += '<div class="ew-ctx-ribbon indigo">'
                + '<i class="fas fa-chart-pie"></i> '
                + '<span>Securities trade \u2014 allocate to customers</span>'
                + '<button class="ew-ctx-btn" onclick="EW.actions.execute(\'allocFund\')">Allocate</button>'
                + '</div>';
        } else if (isFundTrx(r) && r.status !== 'paired' && r.fund_allocation_status !== 'allocated') {
            var ribbonText = isIncomeAllocType(r)
                ? 'Income transaction \u2014 allocate to investors'
                : 'Fund transaction \u2014 allocate to investors';
            h += '<div class="ew-ctx-ribbon blue">'
                + '<i class="fas fa-chart-pie"></i> '
                + '<span>' + ribbonText + '</span>'
                + '<button class="ew-ctx-btn" onclick="EW.actions.execute(\'allocFund\')">Allocate</button>'
                + '</div>';
        }
        // Unknown customer
        if (r.customer_code === 'UNK') {
            h += '<div class="ew-ctx-ribbon amber">'
                + '<i class="fas fa-user-times"></i> '
                + '<span>Unknown customer — manual assignment needed</span>'
                + '<button class="ew-ctx-btn" onclick="EW.actions.execute(\'reassign\')">Reassign</button>'
                + '</div>';
        }
        return h;
    }

    // ── Operation button bar ──────────────────────────────────────────────

    function renderOpBar(r) {
        if (!isEditable(r.status)) return '';
        var h = '<div class="ew-op-bar">';
        h += '<button class="ew-op-btn" onclick="EW.actions.execute(\'reclassify\')"><i class="fas fa-tag"></i> Reclassify</button>';
        h += '<button class="ew-op-btn" onclick="EW.actions.execute(\'reassign\')"><i class="fas fa-user-edit"></i> Reassign</button>';
        h += '<button class="ew-op-btn" onclick="EW.actions.execute(\'splitRecord\')"><i class="fas fa-code-branch"></i> Split</button>';
        if (isLoanType(r.internal_type)) {
            h += '<button class="ew-op-btn highlight" onclick="EW.actions.execute(\'loanPaymentSplit\')"><i class="fas fa-university"></i> Loan Split</button>';
        }
        if (isFundTrx(r) && r.fund_allocation_status !== 'allocated') {
            var allocLabel = isAllocType(r) ? 'Allocate Trade'
                : isIncomeAllocType(r) ? 'Allocate Income' : 'Fund Alloc';
            h += '<button class="ew-op-btn highlight" onclick="EW.actions.execute(\'allocFund\')"><i class="fas fa-chart-pie"></i> ' + allocLabel + '</button>';
        }
        if (r.validated_currency && r.validated_currency !== 'EUR') {
            h += '<button class="ew-op-btn" onclick="EW.actions.execute(\'fxOverride\')"><i class="fas fa-euro-sign"></i> FX Override</button>';
        }
        h += '</div>';
        return h;
    }

    // ── Loan Contract section ─────────────────────────────────────────────

    function renderLoanSection(r) {
        if (!r.loan_id) return '';
        return '<div class="ew-contract-card">'
            + '<div class="ew-cc-hdr"><i class="fas fa-file-contract"></i> Linked Contract: ' + esc(r.loan_id) + '</div>'
            + '<div class="ew-cc-grid">'
            + '<div class="ew-cc-field"><label>Contract ID</label><div>' + esc(r.loan_id) + '</div></div>'
            + '<div class="ew-cc-field"><label>Status</label><div>Active</div></div>'
            + '</div>'
            + '<div class="ew-cc-note">Full contract details available when loan API is connected.</div>'
            + '</div>';
    }

    // ── Fund Allocation section ───────────────────────────────────────────

    function renderFundSection(r) {
        // Income types → dedicated rendering
        if (isIncomeAllocType(r)) { return renderIncomeAllocSection(r); }

        var allocStatus = r.fund_allocation_status || 'pending';
        var statusLabel = allocStatus === 'allocated' ? 'Fully Allocated'
            : allocStatus === 'partially_allocated' ? 'Partially Allocated' : 'Pending';
        var statusCls = allocStatus === 'allocated' ? 'st-confirmed'
            : allocStatus === 'partially_allocated' ? 'st-ready' : 'st-enriched';

        var h = '<div class="ew-f-row">';
        h += '<div class="ew-f-field"><label>Allocation Status</label>'
            + '<span class="' + statusCls + '" style="font-size:.84em;padding:2px 8px;border-radius:3px">' + esc(statusLabel) + '</span></div>';
        h += '</div>';
        // Progress bar + breakdown placeholders — loaded async after DOM insertion
        if (allocStatus !== 'pending') {
            h += '<div id="ew-alloc-progress" class="ew-alloc-inline">'
                + '<div class="ew-alloc-inline-loading"><i class="fas fa-spinner fa-spin"></i> Loading progress\u2026</div>'
                + '</div>';
            h += '<div id="ew-alloc-breakdown" class="ew-alloc-inline">'
                + '<div class="ew-alloc-inline-loading"><i class="fas fa-spinner fa-spin"></i> Loading allocations\u2026</div>'
                + '</div>';
        }
        if (isEditable(r.status) && allocStatus !== 'allocated') {
            var btnLabel = isAllocType(r) ? 'Allocate Trade to Customer' : 'Allocate to Investors';
            h += '<button class="ew-op-btn highlight" style="margin-top:6px" onclick="EW.actions.execute(\'allocFund\')">'
                + '<i class="fas fa-chart-pie"></i> ' + btnLabel + '</button>';
        }
        return h;
    }

    // ── Income Allocation section ───────────────────────────────────────────

    function renderIncomeAllocSection(r) {
        var allocStatus = r.fund_allocation_status || 'pending';
        var statusLabel = allocStatus === 'allocated' ? 'Fully Allocated' : 'Pending';
        var statusCls = allocStatus === 'allocated' ? 'st-confirmed' : 'st-enriched';

        var h = '<div class="ew-f-row">';
        h += '<div class="ew-f-field"><label>Allocation Status</label>'
            + '<span class="' + statusCls + '" style="font-size:.84em;padding:2px 8px;border-radius:3px">'
            + esc(statusLabel) + '</span></div>';
        h += '<div class="ew-f-field"><label>Asset</label><div>'
            + esc(r.resolved_asset_id || '\u2014') + '</div></div>';
        h += '</div>';

        // Async-loaded allocation details
        if (allocStatus === 'allocated') {
            h += '<div id="ew-income-alloc-detail">'
                + '<div class="ew-alloc-inline-loading"><i class="fas fa-spinner fa-spin"></i> Loading income allocations\u2026</div>'
                + '</div>';
        }

        // Allocate button
        if (isEditable(r.status) && allocStatus !== 'allocated') {
            h += '<button class="ew-op-btn highlight" style="margin-top:6px" onclick="EW.actions.execute(\'allocFund\')">'
                + '<i class="fas fa-coins"></i> Allocate Income</button>';
        }

        return h;
    }

    // ── Income allocation breakdown (async) ──────────────────────────────

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

    // ── Allocation breakdown (async) ──────────────────────────────────────

    /** Cache to avoid re-fetching on re-open. */
    if (!EW.state._allocCache) EW.state._allocCache = {};

    /** Load allocation progress + breakdown into placeholder divs. */
    function loadAllocationData(enrichmentId) {
        var progressEl = document.getElementById('ew-alloc-progress');
        var breakdownEl = document.getElementById('ew-alloc-breakdown');
        if (!progressEl && !breakdownEl) return;

        // Check cache first
        var cached = EW.state._allocCache[enrichmentId];
        if (cached && cached.summary) {
            if (progressEl) progressEl.innerHTML = renderProgressBar(cached.summary, cached.secuTrx);
            if (breakdownEl) breakdownEl.innerHTML = renderAllocationBreakdown(cached.summary, cached.secuTrx);
            return;
        }

        if (!EW.api.getAllocationSummary) return;

        // Fetch both in parallel
        var promises = [EW.api.getAllocationSummary(enrichmentId)];
        if (EW.api.getSecuTransaction) {
            promises.push(EW.api.getSecuTransaction(enrichmentId));
        } else {
            promises.push(Promise.resolve(null));
        }

        Promise.all(promises)
            .then(function(results) {
                var summary = results[0];
                var secuTrx = results[1];
                EW.state._allocCache[enrichmentId] = { summary: summary, secuTrx: secuTrx };
                // Re-check elements still exist (panel might have closed)
                var pTarget = document.getElementById('ew-alloc-progress');
                if (pTarget) pTarget.innerHTML = renderProgressBar(summary, secuTrx);
                var bTarget = document.getElementById('ew-alloc-breakdown');
                if (bTarget) bTarget.innerHTML = renderAllocationBreakdown(summary, secuTrx);
            })
            .catch(function() {
                var pTarget = document.getElementById('ew-alloc-progress');
                if (pTarget) pTarget.innerHTML = '';
                var bTarget = document.getElementById('ew-alloc-breakdown');
                if (bTarget) bTarget.innerHTML = '<div class="ew-alloc-inline-summary" style="color:#94a3b8;font-style:italic">Could not load allocation details.</div>';
            });
    }

    /** Render progress bar showing allocation completion. */
    function renderProgressBar(summary, secuTrx) {
        var lots = summary.lots || [];
        var allocQty = parseFloat(summary.allocatedQty) || 0;
        var lotCount = summary.lotCount || lots.length;
        var totalQty = secuTrx ? (parseFloat(secuTrx.quantity) || 0) : 0;

        if (lotCount === 0 && totalQty === 0) return '';

        var pct = totalQty > 0 ? Math.min((allocQty / totalQty) * 100, 100) : 0;
        var pctCls = pct === 0 ? 'empty' : pct >= 99.9999 ? 'full' : 'partial';

        var custCount = 0;
        var seen = {};
        for (var i = 0; i < lots.length; i++) {
            var cid = lots[i].customerId || lots[i].customerName;
            if (cid && !seen[cid]) { seen[cid] = true; custCount++; }
        }

        var text = fmtAmt(allocQty) + ' / ' + fmtAmt(totalQty) + ' units allocated'
            + ' \u00B7 ' + lotCount + ' lot' + (lotCount !== 1 ? 's' : '')
            + ' \u00B7 ' + custCount + ' customer' + (custCount !== 1 ? 's' : '');

        return '<div class="ew-alloc-progress-row">'
            + '<div class="ew-alloc-progress-bar"><div class="ew-alloc-progress-fill ' + pctCls + '" style="width:' + pct.toFixed(1) + '%"></div></div>'
            + '<span>' + text + '</span>'
            + '</div>';
    }

    /** Render allocation breakdown as lot cards. */
    function renderAllocationBreakdown(summary, secuTrx) {
        var lots = summary.lots || [];
        var allocQty = parseFloat(summary.allocatedQty) || 0;
        var lotCount = summary.lotCount || lots.length;

        if (lotCount === 0) {
            return '<div class="ew-alloc-inline-summary" style="color:#94a3b8;font-style:italic">No allocations yet.</div>';
        }

        var totalQty = secuTrx ? (parseFloat(secuTrx.quantity) || 0) : 0;
        var price = secuTrx ? (parseFloat(secuTrx.price) || 0) : 0;
        var totalFee = secuTrx ? (parseFloat(secuTrx.fee) || 0) : 0;
        var currency = secuTrx ? (secuTrx.currency || '') : '';

        var h = '';
        var sumAmount = 0, sumFee = 0, sumCost = 0, sumEur = 0;
        var hasEur = false;

        for (var i = 0; i < lots.length; i++) {
            var lot = lots[i];
            var qty = parseFloat(lot.quantity) || 0;
            // Use API values if available, else compute client-side
            var lotAmount = lot.totalAmount != null ? parseFloat(lot.totalAmount) : (qty * price);
            var lotFee = lot.feeAmount != null ? parseFloat(lot.feeAmount) : (totalQty > 0 ? (qty / totalQty) * totalFee : 0);
            var lotCost = lot.totalCostWithFees != null ? parseFloat(lot.totalCostWithFees) : (lotAmount + lotFee);
            var lotEur = lot.totalAmountEur != null ? parseFloat(lot.totalAmountEur) : null;

            sumAmount += lotAmount;
            sumFee += lotFee;
            sumCost += lotCost;
            if (lotEur !== null) { sumEur += lotEur; hasEur = true; }

            var dir = lot.direction || '\u2014';
            var dirCls = dir === 'BUY' ? 'badge-buy' : dir === 'SELL' ? 'badge-sell' : '';

            h += '<div class="ew-lot-card">';
            // Row 1: customer, direction badge, quantity
            h += '<div class="ew-lot-row1">';
            h += '<span class="ew-lot-customer">' + esc(lot.customerName || lot.customerId || '\u2014') + '</span>';
            if (dirCls) h += '<span class="' + dirCls + '">' + esc(dir) + '</span>';
            h += '<span class="ew-lot-qty">' + fmtAmt(qty) + '</span>';
            h += '</div>';
            // Row 2: amount, fee, cost, currency
            h += '<div class="ew-lot-row2">';
            h += '<span>Amount <span class="val">' + fmtAmt(lotAmount) + '</span></span>';
            h += '<span>Fee <span class="val">' + fmtAmt(lotFee) + '</span></span>';
            h += '<span>Cost <span class="val" style="font-weight:700">' + fmtAmt(lotCost) + '</span></span>';
            if (currency) h += '<span>' + esc(currency) + '</span>';
            h += '</div>';
            // Row 3: lot ID, date (if available), EUR amount (if available)
            var metaParts = [];
            if (lot.lotId || lot.id) metaParts.push(esc(lot.lotId || lot.id));
            if (lot.allocationDate) metaParts.push(esc(lot.allocationDate));
            if (lotEur !== null) metaParts.push('EUR ' + fmtAmt(lotEur));
            if (metaParts.length > 0) {
                h += '<div class="ew-lot-meta">';
                for (var m = 0; m < metaParts.length; m++) {
                    h += '<span>' + metaParts[m] + '</span>';
                }
                h += '</div>';
            }
            h += '</div>';
        }

        // Summary footer
        h += '<div class="ew-alloc-summary-footer">';
        h += 'Total: <strong>' + fmtAmt(sumAmount) + (currency ? ' ' + esc(currency) : '') + '</strong>';
        h += ' \u00B7 Fee: <strong>' + fmtAmt(sumFee) + (currency ? ' ' + esc(currency) : '') + '</strong>';
        h += ' \u00B7 Cost: <strong>' + fmtAmt(sumCost) + (currency ? ' ' + esc(currency) : '') + '</strong>';
        if (hasEur) {
            h += '<br>EUR equivalent: <strong>' + fmtAmt(sumEur) + ' EUR</strong>';
        }
        h += '</div>';

        return h;
    }

    // ── Allocation History ──────────────────────────────────────────────

    /** Render allocation history from processing_notes. */
    function renderAllocationHistory(notes) {
        if (!notes) {
            return '<div class="ew-alloc-history" style="color:#94a3b8;font-style:italic">No allocation history available.</div>';
        }

        var lines = String(notes).split('\n');
        var entries = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.indexOf('Allocated ') === 0) {
                entries.push(line);
            }
        }

        if (entries.length === 0) {
            return '<div class="ew-alloc-history" style="color:#94a3b8;font-style:italic">No allocation history available.</div>';
        }

        var h = '<div class="ew-alloc-history">';
        for (var j = 0; j < entries.length; j++) {
            h += '<div class="ew-alloc-history-entry">'
                + '<i class="fas fa-chart-pie"></i> ' + esc(entries[j])
                + '</div>';
        }
        h += '</div>';
        return h;
    }

    // ── Panel rendering ──────────────────────────────────────────────────

    function renderPanel(record) {
        var r = record;
        var edit = isEditable(r.status);
        var h = '';

        // Header
        h += '<div class="ew-slide-hdr">'
            + '<div>'
            + '<div class="ew-slide-meta">Enrichment Record</div>'
            + '<h2>' + esc(r.id) + '</h2>'
            + '</div>'
            + '<div class="ew-slide-hdr-right">'
            + '<span class="st-' + esc(r.status) + '">' + esc(r.status || '') + '</span>'
            + '<button class="ew-slide-close" onclick="EW.detail.close()">\u00D7</button>'
            + '</div></div>';

        // Context ribbons
        h += renderRibbons(r);

        // Operation button bar
        h += renderOpBar(r);

        // Body
        var body = '';

        // §1 Traceability — always read-only, hide if superseded or confirmed
        var showTraceability = r.status !== 'superseded' && r.status !== 'confirmed';
        if (showTraceability) {
            body += renderSection('Traceability', 1,
                '<div class="ew-f-row">'
                + renderField('Transaction ID', r.id)
                + renderField('Source Type', r.source_tp)
                + renderField('Source Trx ID', r.source_trx_id, { muted: true })
                + renderField('Statement', r.statement_id, { muted: true })
                + '</div>',
                true);
        }

        // §2 Lineage — show if origin != pipeline
        var showLineage = r.origin && r.origin !== 'pipeline';
        if (showLineage) {
            body += renderSection('Lineage', 2,
                '<div class="ew-f-row">'
                + renderField('Origin', r.origin)
                + renderField('Parent ID', r.parent_enrichment_id, { muted: true })
                + renderField('Group', r.group_id, { muted: true, mono: true })
                + renderField('Seq', r.split_sequence, { muted: true })
                + '</div>'
                + '<div class="ew-f-row">'
                + renderFieldAuto('lineage_note', r.lineage_note, edit, null, true)
                + '</div>',
                false);
        }

        // §3 Transaction Core — always visible, expanded
        body += renderSection('Transaction Core', 3,
            '<div class="ew-f-row">'
            + renderFieldAuto('transaction_date', r.transaction_date, edit)
            + renderFieldAuto('settlement_date', r.settlement_date, edit)
            + renderFieldAuto('debit_credit', r.debit_credit, edit, { dc: !edit })
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('original_amount', r.original_amount, edit, { mono: true })
            + renderFieldAuto('fee_amount', r.fee_amount, edit, { mono: true })
            + renderFieldAuto('total_amount', r.total_amount, edit, { mono: true, bold: true })
            + '</div>'
            + '<div class="ew-f-row">'
            + renderField('Source Currency', r.original_currency)
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('description', r.description, edit, null, true)
            + '</div>',
            true);

        // §4 Classification — always visible, expanded
        body += renderSection('Classification', 4,
            '<div class="ew-f-row">'
            + renderFieldAuto('internal_type', r.internal_type, edit)
            + renderField('Confidence', r.type_confidence, { badge: true })
            + renderField('Matched Rule', r.matched_rule_id, { muted: true })
            + '</div>',
            true);

        // §5 Currency & FX — always visible, collapsed
        body += renderSection('Currency & FX', 5,
            '<div class="ew-f-row">'
            + renderFieldAuto('validated_currency', r.validated_currency, edit)
            + renderFieldAuto('fx_rate_to_eur', r.fx_rate_to_eur, edit, { mono: true })
            + renderFieldAuto('fx_rate_date', r.fx_rate_date, edit)
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('fx_rate_source', r.fx_rate_source, edit)
            + renderField('EUR Amount', fmtAmt(r.base_amount_eur), { mono: true })
            + renderFieldAuto('requires_eur_parallel', r.requires_eur_parallel, edit)
            + '</div>',
            false);

        // §6 Resolved Entities — always visible, collapsed
        body += renderSection('Resolved Entities', 6,
            '<div class="ew-f-row">'
            + renderFieldAuto('resolved_customer_id', r.resolved_customer_id, edit)
            + renderFieldAuto('customer_code', r.customer_code, edit)
            + renderField('Match Method', r.customer_match_method, { muted: true })
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('resolved_asset_id', r.resolved_asset_id, edit)
            + renderField('ISIN', r.asset_isin)
            + renderFieldAuto('asset_category', r.asset_category, edit)
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('counterparty_id', r.counterparty_id, edit)
            + renderFieldAuto('counterparty_short_code', r.counterparty_short_code, edit)
            + renderField('CP Source', r.counterparty_source, { muted: true })
            + '</div>',
            false);

        // §7 Loan Contract — show when loan_id populated
        if (r.loan_id) {
            body += renderSection('Loan Contract', 7, renderLoanSection(r), true);
        }

        // §8 Trade/Fund Allocation — show for fund/sec transactions
        if (isFundTrx(r)) {
            var sec8Title = isAllocType(r) ? 'Trade Allocation'
                : isIncomeAllocType(r) ? 'Income Allocation'
                : 'Fund Allocation';
            var sec8Expand = r.fund_allocation_status === 'partially_allocated' || r.fund_allocation_status === 'allocated';
            body += renderSection(sec8Title, 8, renderFundSection(r), sec8Expand);
        }

        // §9 Allocation History — show for allocated/partially allocated fund transactions
        if (isFundTrx(r) && (r.fund_allocation_status === 'partially_allocated' || r.fund_allocation_status === 'allocated')) {
            body += renderSection('Allocation History', 9, renderAllocationHistory(r.processing_notes), false);
        }

        // Fee & Pairing — show if has_fee=yes or status=paired (conditional)
        var showFee = r.has_fee === 'yes' || r.has_fee === 'Y' || r.status === 'paired';
        if (showFee) {
            var feeNum = 10;
            body += renderSection('Fee & Pairing', feeNum,
                '<div class="ew-f-row">'
                + renderFieldAuto('has_fee', r.has_fee, edit)
                + renderField('Fee Trx ID', r.fee_trx_id, { muted: true })
                + renderField('Pair ID', r.pair_id, { muted: true })
                + '</div>',
                false);
        }

        // Status & Notes — always visible, expanded
        var notesEditable = edit || (FIELDS.processing_notes && FIELDS.processing_notes.alwaysEditable);
        var sn = '<div class="ew-f-row">'
            + renderField('Status', r.status, { badge: true })
            + renderField('Enrichment Time', r.enrichment_timestamp, { muted: true })
            + renderField('Version', r.version, { muted: true })
            + '</div>';
        if (r.status === 'error' && r.error_message) {
            sn += '<div class="ew-f-row">'
                + renderField('Error Message', r.error_message, { wide: true, err: true })
                + '</div>';
        }
        sn += '<div class="ew-f-row">'
            + renderFieldAuto('processing_notes', r.processing_notes, notesEditable, null, true)
            + '</div>';
        body += renderSection('Status & Notes', 11, sn, true);

        h += '<div class="ew-slide-body">' + body + '</div>';

        // Footer
        if (edit || notesEditable) {
            h += '<div class="ew-slide-footer">'
                + '<button class="ew-btn-cancel" onclick="EW.detail.close()">Cancel</button>'
                + '<button class="ew-btn-save" onclick="EW_saveRecord()">Save</button>'
                + '</div>';
        } else {
            h += '<div class="ew-slide-footer">'
                + '<button class="ew-btn" onclick="EW.detail.close()">Close</button>'
                + '</div>';
        }

        return h;
    }

    // ── Form data collection ─────────────────────────────────────────────────

    /**
     * Collect all edited field values from the DOM and diff against original record.
     * Returns { id, version, ...changedFields } or null if nothing changed.
     */
    function collectFormData(record) {
        var panel = document.querySelector('.ew-slide-panel');
        if (!panel) return null;

        var changed = {};
        var hasChanges = false;

        // Query all named inputs in the panel
        var inputs = panel.querySelectorAll('[name]');
        for (var i = 0; i < inputs.length; i++) {
            var el = inputs[i];
            var fieldId = el.getAttribute('name');
            var newVal = el.value;
            var origVal = (record[fieldId] != null && record[fieldId] !== undefined)
                ? String(record[fieldId]) : '';

            if (newVal !== origVal) {
                changed[fieldId] = newVal;
                hasChanges = true;
            }
        }

        if (!hasChanges) return null;

        changed.version = record.version;
        return changed;
    }

    // ── Current record reference for save ────────────────────────────────────

    var currentRecord = null;

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Open the detail slide-over for a record.
     * @param {string} recordId - The record ID to fetch and display
     * @param {Object} [record] - Pre-loaded record object (avoids API call)
     */
    EW.detail.open = function(recordId, record) {
        var container = document.getElementById('ew-slide-container');
        if (!container) return;

        if (record) {
            currentRecord = record;
            container.innerHTML = '<div class="ew-slide-over">'
                + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
                + '<div class="ew-slide-panel">'
                + renderPanel(record)
                + '</div></div>';
            // Async-load allocation breakdown if placeholder was rendered
            var allocStatus = record.fund_allocation_status || 'pending';
            if (allocStatus !== 'pending' && isFundTrx(record)) {
                loadAllocationData(record.id);
            }
            // Income allocation async load
            if (isIncomeAllocType(record) && allocStatus !== 'pending') {
                loadIncomeAllocationData(record.id);
            }
            return;
        }

        // Fallback: fetch from API
        container.innerHTML = '<div class="ew-slide-over">'
            + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
            + '<div class="ew-slide-panel">'
            + '<div class="ew-slide-loading"><i class="fas fa-spinner fa-spin"></i> Loading record...</div>'
            + '</div></div>';

        EW.api.fetchRecord(recordId)
            .then(function(rec) {
                currentRecord = rec;
                container.innerHTML = '<div class="ew-slide-over">'
                    + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
                    + '<div class="ew-slide-panel">'
                    + renderPanel(rec)
                    + '</div></div>';
                // Async-load allocation breakdown if placeholder was rendered
                var allocStatus = rec.fund_allocation_status || 'pending';
                if (allocStatus !== 'pending' && isFundTrx(rec)) {
                    loadAllocationData(rec.id);
                }
                // Income allocation async load
                if (isIncomeAllocType(rec) && allocStatus !== 'pending') {
                    loadIncomeAllocationData(rec.id);
                }
            })
            .catch(function(e) {
                currentRecord = null;
                container.innerHTML = '<div class="ew-slide-over">'
                    + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
                    + '<div class="ew-slide-panel">'
                    + '<div class="ew-slide-hdr">'
                    + '<div><div class="ew-slide-meta">Enrichment Record</div><h2>Error</h2></div>'
                    + '<div class="ew-slide-hdr-right">'
                    + '<button class="ew-slide-close" onclick="EW.detail.close()">\u00D7</button>'
                    + '</div></div>'
                    + '<div class="ew-slide-body">'
                    + '<div style="padding:32px;text-align:center;color:#dc2626;">'
                    + '<i class="fas fa-exclamation-triangle"></i> Failed to load record: ' + esc(e.message)
                    + '</div></div>'
                    + '<div class="ew-slide-footer">'
                    + '<button class="ew-btn" onclick="EW.detail.close()">Close</button>'
                    + '</div></div></div>';
            });
    };

    /**
     * Close the detail slide-over.
     */
    EW.detail.close = function() {
        var container = document.getElementById('ew-slide-container');
        if (container) container.innerHTML = '';
        currentRecord = null;
    };

    // ── Save handler ─────────────────────────────────────────────────────────

    window.EW_saveRecord = function() {
        if (!currentRecord) return;

        var data = collectFormData(currentRecord);
        if (!data) {
            EW.toast.show('No changes to save', 'info');
            return;
        }

        // Disable save button to prevent double-click
        var saveBtn = document.querySelector('.ew-btn-save');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        var recordId = currentRecord.id;

        EW.api.saveRecord(recordId, data)
            .then(function(updated) {
                EW.toast.show('Record saved successfully', 'success');

                // Update cache
                if (EW.state.records) {
                    EW.state.records[recordId] = updated;
                }

                // Refresh table and close panel
                EW.detail.close();
                EW.table.load();
            })
            .catch(function(e) {
                // Re-enable save button
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                }

                if (e.status === 409) {
                    // Version conflict — reload panel with fresh data
                    EW.toast.show('Record modified by another user \u2014 reloading', 'error');
                    EW.api.fetchRecord(recordId)
                        .then(function(fresh) {
                            if (EW.state.records) {
                                EW.state.records[recordId] = fresh;
                            }
                            EW.detail.open(recordId, fresh);
                        })
                        .catch(function() {
                            EW.detail.close();
                        });
                } else {
                    EW.toast.show(e.message || 'Failed to save record', 'error');
                }
            });
    };

    // ── Global helper for section toggle ──────────────────────────────────────

    window.EW_toggleSection = function(btn) {
        var body = btn.nextElementSibling;
        var toggle = btn.querySelector('.ew-sec-toggle');
        if (body.style.display === 'none') {
            body.style.display = 'block';
            if (toggle) toggle.textContent = '\u25BE';
        } else {
            body.style.display = 'none';
            if (toggle) toggle.textContent = '\u25B8';
        }
    };

})(window.EW || (window.EW = {}));
