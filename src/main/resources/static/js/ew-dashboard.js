/**
 * ew-dashboard.js — collapsible overview panel with KPI cards + filter slot.
 *
 * Merges dashboard and filters into a single collapsible panel.
 * CSS-only toggle (no re-render on expand/collapse).
 * On data reload, KPIs update in-place to preserve filter input values.
 */
(function(EW) {
    'use strict';

    /** Type category mapping (same as TY_CAT in v2 prototype). */
    var TY_CAT = {
        LOAN_PAYMENT: 'loan', LOAN_DISBURSEMENT: 'loan', INT_INCOME: 'loan', INT_EXPENSE: 'loan',
        SEC_BUY: 'sec', SEC_SELL: 'sec', EQ_BUY: 'sec', EQ_SELL: 'sec',
        BOND_BUY: 'sec', BOND_INT: 'sec', SPLIT_IN: 'sec', SPLIT_OUT: 'sec',
        DIV_INCOME: 'fund', DIV_TAX: 'fund', ASSET_RETURN: 'fund', INV_INCOME: 'fund',
        FX_EXCHANGE: 'fx',
        COMM_FEE: 'fee', MGMT_FEE: 'fee', ADMIN_FEE: 'fee', LEGAL_FEE: 'fee', TAX: 'fee'
    };

    /** Check if a type is a loan type. */
    EW.dashboard.isLoanType = function(ty) {
        return TY_CAT[ty] === 'loan';
    };

    /** Check if a record is a fund transaction. */
    EW.dashboard.isFundTrx = function(r) {
        return r.customer_code === '12345678' || TY_CAT[r.internal_type] === 'fund';
    };

    /** Expose TY_CAT for table/detail use. */
    EW.dashboard.TY_CAT = TY_CAT;

    function esc(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    // ── Stats computation ─────────────────────────────────────────────────────

    function computeStats() {
        var records = EW.state.records || {};
        var recs = [];
        for (var k in records) {
            if (records.hasOwnProperty(k)) recs.push(records[k]);
        }
        var total = EW.state.total || recs.length || 0;
        var loanCount = 0, fundCount = 0, needsAttn = 0, autoCount = 0, linkedLoan = 0;
        for (var i = 0; i < recs.length; i++) {
            var r = recs[i];
            if (EW.dashboard.isLoanType(r.internal_type)) {
                loanCount++;
                if (r.loan_id) linkedLoan++;
            }
            if (EW.dashboard.isFundTrx(r)) fundCount++;
            if (r.customer_code === 'UNK' || (!r.customer_code && r.status !== 'superseded' && r.status !== 'confirmed')) needsAttn++;
            if (r.origin === 'pipeline' || r.origin === 'auto') autoCount++;
        }
        var autoRate = recs.length > 0 ? Math.round((autoCount / recs.length) * 100) : 0;
        return { total: total, loanCount: loanCount, fundCount: fundCount, needsAttn: needsAttn,
                 autoCount: autoCount, linkedLoan: linkedLoan, autoRate: autoRate, pageCount: recs.length };
    }

    // ── Build KPI cards HTML ──────────────────────────────────────────────────

    function buildCards(s) {
        var h = '';
        h += '<div class="ew-s-card"><div class="ew-s-label">Total Records</div><div class="ew-s-val">' + s.total + '</div><div class="ew-s-sub">Page ' + EW.state.page + ' of ' + (EW.state.totalPages || 1) + '</div></div>';
        h += '<div class="ew-s-card green"><div class="ew-s-label">Automation Rate</div><div class="ew-s-val">' + s.autoRate + '%</div><div class="ew-s-sub">' + s.autoCount + '/' + s.pageCount + ' auto-enriched</div></div>';
        h += '<div class="ew-s-card"><div class="ew-s-label">Loan Transactions</div><div class="ew-s-val">' + s.loanCount + '</div><div class="ew-s-sub">' + s.linkedLoan + ' linked to contracts</div></div>';
        h += '<div class="ew-s-card"><div class="ew-s-label">Fund Transactions</div><div class="ew-s-val">' + s.fundCount + '</div><div class="ew-s-sub">Customer 12345678</div></div>';
        if (s.needsAttn > 0) {
            h += '<div class="ew-s-card amber"><div class="ew-s-label">Needs Attention</div><div class="ew-s-val">' + s.needsAttn + '</div><div class="ew-s-sub">Missing/unknown customer</div></div>';
        }
        return h;
    }

    // ── Build KPI mini dots HTML ──────────────────────────────────────────────

    function buildKpiDots(s) {
        var h = '<span><span class="ew-dot" style="background:#1a365d"></span>' + s.total + ' records</span>'
            + '<span><span class="ew-dot" style="background:#16a34a"></span>' + s.autoRate + '% auto</span>'
            + '<span><span class="ew-dot" style="background:#92400e"></span>' + s.loanCount + ' loan</span>'
            + '<span><span class="ew-dot" style="background:#1e40af"></span>' + s.fundCount + ' fund</span>';
        if (s.needsAttn > 0) {
            h += '<span><span class="ew-dot" style="background:#d97706"></span>' + s.needsAttn + ' attn</span>';
        }
        return h;
    }

    // ── Get filter summary text ───────────────────────────────────────────────

    function getFilterSummary() {
        if (EW.filters && EW.filters.activeFilterSummary) {
            return 'Filters: ' + EW.filters.activeFilterSummary();
        }
        return 'Filters: none';
    }

    // ── Build full panel shell ─────────────────────────────────────────────────

    function buildShell(hasDashboard, collapsed, s) {
        var label = hasDashboard ? 'Overview' : 'Filters';

        // Mini-summary parts
        var miniParts = '';
        if (hasDashboard) {
            miniParts += '<span id="ew-mini-kpi">' + buildKpiDots(s) + '</span>';
            miniParts += '<span class="ew-st-sep">|</span>';
        }
        miniParts += '<span id="ew-mini-filters">' + esc(getFilterSummary()) + '</span>';

        var h = '<div class="ew-summary' + (collapsed ? ' ew-collapsed' : '') + '">';

        // Toggle button
        h += '<button class="ew-summary-toggle" onclick="EW_togglePanel()">';
        h += '<span class="ew-st-label">' + label + '</span>';
        h += '<div class="ew-st-mini">' + miniParts + '</div>';
        h += '<span class="ew-st-arrow' + (collapsed ? '' : ' up') + '">\u25BE</span>';
        h += '</button>';

        // Expandable inner
        h += '<div class="ew-summary-inner' + (collapsed ? ' collapsed' : '') + '">';

        // KPI cards (only if hasDashboard)
        if (hasDashboard) {
            h += '<div class="ew-summary-cards">' + buildCards(s) + '</div>';
        }

        // Filter slot — filters.js renders into this
        h += '<div id="ew-filter-slot"' + (hasDashboard ? '' : ' class="ew-filter-slot-no-cards"') + '></div>';

        h += '</div>'; // .ew-summary-inner
        h += '</div>'; // .ew-summary

        return h;
    }

    // ── In-place update (data reload — preserve filter inputs) ────────────────

    function updateInPlace(panel, hasDashboard, s) {
        // Update KPI cards
        if (hasDashboard) {
            var cards = panel.querySelector('.ew-summary-cards');
            if (cards) cards.innerHTML = buildCards(s);
        }

        // Update KPI dots in mini-summary
        var miniKpi = document.getElementById('ew-mini-kpi');
        if (miniKpi) miniKpi.innerHTML = buildKpiDots(s);

        // Update filter summary in mini-summary
        var miniFilters = document.getElementById('ew-mini-filters');
        if (miniFilters) miniFilters.textContent = getFilterSummary();
    }

    // ── Render ──────────────────────────────────────────────────────────────

    EW.dashboard.render = function() {
        var container = document.getElementById('ew-dashboard');
        if (!container) return;

        var view = EW.nav.current();
        var hasDashboard = view.hasDashboard === true;
        var collapsed = EW.state.panelCollapsed;
        var s = computeStats();

        // Full re-render on first render or view change
        var panel = container.querySelector('.ew-summary');
        if (!panel || EW.dashboard._lastView !== EW.state.currentView) {
            container.innerHTML = buildShell(hasDashboard, collapsed, s);
            EW.dashboard._lastView = EW.state.currentView;
            return;
        }

        // In-place update: KPI numbers + mini-summary only (preserves filter inputs)
        updateInPlace(panel, hasDashboard, s);
    };

    // ── Toggle handler (CSS-only — no re-render) ──────────────────────────────

    window.EW_togglePanel = function() {
        var panel = document.querySelector('.ew-summary');
        if (!panel) return;

        EW.state.panelCollapsed = !EW.state.panelCollapsed;
        localStorage.setItem('ew-panelCollapsed', EW.state.panelCollapsed ? 'true' : 'false');

        panel.classList.toggle('ew-collapsed');

        var inner = panel.querySelector('.ew-summary-inner');
        if (inner) inner.classList.toggle('collapsed');

        var arrow = panel.querySelector('.ew-st-arrow');
        if (arrow) arrow.classList.toggle('up');
    };

})(window.EW || (window.EW = {}));
