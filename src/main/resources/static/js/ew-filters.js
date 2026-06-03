/**
 * ew-filters.js — filter controls, rendered into the overview panel's filter slot.
 *
 * Renders into #ew-filter-slot (inside the merged overview panel).
 * Falls back to #ew-filters if slot doesn't exist.
 */
(function(EW) {
    'use strict';

    // ── All transaction types for type filter ────────────────────────────────

    var ALL_TYPES = [
        'SEC_BUY','SEC_SELL','EQ_BUY','EQ_SELL','BOND_BUY','BOND_INT',
        'SPLIT_IN','SPLIT_OUT','DIV_INCOME','DIV_TAX','FX_EXCHANGE',
        'LOAN_PAYMENT','LOAN_DISBURSEMENT','INT_INCOME','INT_EXPENSE',
        'COMM_FEE','MGMT_FEE','ADMIN_FEE','LEGAL_FEE','TAX',
        'CASH_IN_OUT','ASSET_RETURN','INV_INCOME'
    ];

    // ── Build active-filter summary string ───────────────────────────────────

    function activeFilterSummary() {
        var parts = [];
        var v;
        v = getVal('ew-filter-status');    if (v) parts.push('status=' + v);
        v = getVal('ew-filter-source');    if (v) parts.push('source=' + v);
        v = getVal('ew-filter-type');      if (v) parts.push('type=' + v);
        v = getVal('ew-filter-customer');  if (v) parts.push('customer=' + v);
        v = getVal('ew-filter-description'); if (v) parts.push('desc=' + v);
        if (getChecked('ew-filter-fund-only')) parts.push('fund only');
        if (getChecked('ew-filter-loan-only')) parts.push('loan only');
        return parts.length > 0 ? parts.join(', ') : 'none';
    }

    // Expose for dashboard mini-summary
    EW.filters.activeFilterSummary = activeFilterSummary;

    // ── Update mini-summary filter text ──────────────────────────────────────

    function updateMiniFilters() {
        var el = document.getElementById('ew-mini-filters');
        if (el) el.textContent = 'Filters: ' + activeFilterSummary();
    }

    // ── Render filter controls into slot ──────────────────────────────────────

    EW.filters.renderForView = function(viewId) {
        // Prefer filter slot inside overview panel; fall back to standalone #ew-filters
        var slot = document.getElementById('ew-filter-slot');
        var bar = slot || document.getElementById('ew-filters');
        if (!bar) return;

        // If using fallback, clear inline display:none that nav may have set
        if (!slot && bar.id === 'ew-filters') bar.style.display = '';

        var view = EW.nav.VIEWS[viewId];

        // Placeholder views or views without columns: clear filters
        if (!view || view.placeholder || !view.columns) {
            bar.innerHTML = '';
            updateMiniFilters();
            return;
        }

        var h = '<div class="ew-filter-controls">';

        // Status filter (not for history view where it's fixed)
        if (viewId !== 'history') {
            h += '<select id="ew-filter-status" class="ew-select">';
            h += '<option value="">All statuses</option>';
            var statuses = ['new','processing','enriched','error','manual_review','in_review','adjusted','ready','paired'];
            for (var i = 0; i < statuses.length; i++) {
                h += '<option value="' + statuses[i] + '">' + statuses[i].replace(/_/g, ' ') + '</option>';
            }
            h += '</select>';
        }

        // Allocation-status filter (lets the user isolate allocated/partially-allocated trades)
        h += '<select id="ew-filter-alloc" class="ew-select">';
        h += '<option value="">All allocations</option>';
        h += '<option value="allocated">Allocated</option>';
        h += '<option value="partially_allocated">Partially allocated</option>';
        h += '</select>';

        // Source filter
        h += '<select id="ew-filter-source" class="ew-select">';
        h += '<option value="">All sources</option>';
        h += '<option value="bank">Bank</option>';
        h += '<option value="secu">Securities</option>';
        h += '</select>';

        // Type filter
        h += '<select id="ew-filter-type" class="ew-select">';
        h += '<option value="">All types</option>';
        for (var t = 0; t < ALL_TYPES.length; t++) {
            h += '<option value="' + ALL_TYPES[t] + '">' + ALL_TYPES[t] + '</option>';
        }
        h += '</select>';

        // Customer search
        h += '<input type="text" id="ew-filter-customer" class="ew-input" placeholder="Customer ID..." />';

        // Description search
        h += '<input type="text" id="ew-filter-description" class="ew-input" placeholder="Description..." style="width:160px" />';

        // Transaction-date range
        h += '<input type="date" id="ew-filter-date-from" class="ew-input" title="From date" />';
        h += '<input type="date" id="ew-filter-date-to" class="ew-input" title="To date" />';

        // Fund-only / Loan-only checkboxes (workspace view only)
        if (viewId === 'workspace') {
            h += '<label class="ew-cb-label"><input type="checkbox" id="ew-filter-fund-only" /> Fund only</label>';
            h += '<label class="ew-cb-label"><input type="checkbox" id="ew-filter-loan-only" /> Loan only</label>';
        }

        // Search / Reset buttons
        h += '<button id="ew-btn-search" class="ew-btn"><i class="fas fa-search"></i> Search</button>';
        h += '<button id="ew-btn-reset" class="ew-btn ew-btn-secondary"><i class="fas fa-undo"></i> Reset</button>';

        h += '</div>'; // .ew-filter-controls

        bar.innerHTML = h;

        // Lock status filter for specific views
        var filterStatus = document.getElementById('ew-filter-status');
        if (viewId === 'ready' && filterStatus) {
            filterStatus.value = 'ready';
            filterStatus.disabled = true;
        }

        // Bind event handlers
        bindFilterEvents();
        updateMiniFilters();
    };

    // ── Backward compat ─────────────────────────────────────────────────────

    EW.filters.updateForTab = function(tabId) {
        EW.filters.renderForView(tabId);
    };

    // ── Collect filter values ───────────────────────────────────────────────

    EW.filters.collect = function() {
        return {
            status: getVal('ew-filter-status'),
            allocationStatus: getVal('ew-filter-alloc'),
            sourceType: getVal('ew-filter-source'),
            internalType: getVal('ew-filter-type'),
            customerId: getVal('ew-filter-customer'),
            descriptionSearch: getVal('ew-filter-description'),
            dateFrom: getVal('ew-filter-date-from'),
            dateTo: getVal('ew-filter-date-to'),
            fundOnly: getChecked('ew-filter-fund-only'),
            loanOnly: getChecked('ew-filter-loan-only')
        };
    };

    EW.filters.reset = function() {
        setVal('ew-filter-status', '');
        setVal('ew-filter-alloc', '');
        setVal('ew-filter-source', '');
        setVal('ew-filter-type', '');
        setVal('ew-filter-customer', '');
        setVal('ew-filter-description', '');
        setVal('ew-filter-date-from', '');
        setVal('ew-filter-date-to', '');
        setChecked('ew-filter-fund-only', false);
        setChecked('ew-filter-loan-only', false);

        EW.state.page = 1;
        EW.state.sort = 'transaction_date';
        EW.state.order = 'asc';

        // Clear sort indicators
        var headers = document.querySelectorAll('.ew-sortable');
        for (var i = 0; i < headers.length; i++) {
            headers[i].classList.remove('ew-sort-asc', 'ew-sort-desc');
        }

        updateMiniFilters();
        EW.table.load();
    };

    // ── Bind handlers ───────────────────────────────────────────────────────

    function bindFilterEvents() {
        var btnSearch = document.getElementById('ew-btn-search');
        var btnReset = document.getElementById('ew-btn-reset');

        if (btnSearch) {
            btnSearch.addEventListener('click', function() {
                EW.state.page = 1;
                updateMiniFilters();
                EW.table.load();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', function() {
                EW.filters.reset();
            });
        }

        // Highlight active filters
        var controls = document.querySelector('.ew-filter-controls');
        if (controls) {
            var inputs = controls.querySelectorAll('select, input[type="text"]');
            for (var i = 0; i < inputs.length; i++) {
                inputs[i].addEventListener('change', function() {
                    if (this.value) {
                        this.classList.add('ew-filter-active');
                    } else {
                        this.classList.remove('ew-filter-active');
                    }
                });
            }
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function getVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    function setVal(id, v) { var el = document.getElementById(id); if (el) { el.value = v; el.classList.remove('ew-filter-active'); } }
    function getChecked(id) { var el = document.getElementById(id); return el ? el.checked : false; }
    function setChecked(id, v) { var el = document.getElementById(id); if (el) el.checked = v; }

    // ── Init (called from ew-main.js) ───────────────────────────────────────

    EW.filters.init = function() {
        // Initial render done by ew-main.js via renderForView
    };

})(window.EW || (window.EW = {}));
