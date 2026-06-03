/**
 * ew-nav.js — sidebar navigation and per-view column definitions.
 *
 * Replaces ew-tabs.js. 11 sidebar views instead of 5 tabs.
 * Backward-compatible: EW.tabs aliased to EW.nav.
 */
(function(EW) {
    'use strict';

    EW.nav = {};

    // ── Column definitions ──────────────────────────────────────────────────

    var COL_CHECKBOX   = { key: '_check',    label: '',            sortField: null,               width: '32px', cssClass: 'ew-th-check', type: 'checkbox' };
    var COL_TRX_ID     = { key: 'id',       label: 'Trx ID',     sortField: 'id',               width: null,   cssClass: null };
    var COL_STATUS     = { key: 'status',    label: 'Status',      sortField: 'status',           width: null,   cssClass: null };
    var COL_SRC        = { key: 'source_tp', label: 'Src',         sortField: 'source_tp',        width: null,   cssClass: null };
    var COL_DATE       = { key: 'transaction_date', label: 'Date', sortField: 'transaction_date', width: null,   cssClass: null };
    var COL_TYPE       = { key: 'internal_type',    label: 'Type', sortField: 'internal_type',    width: null,   cssClass: null };
    var COL_DESC       = { key: 'description',      label: 'Description', sortField: null,        width: null,   cssClass: null };
    var COL_DC         = { key: 'debit_credit',     label: 'D/C',  sortField: 'debit_credit',     width: null,   cssClass: null };
    var COL_AMOUNT     = { key: 'original_amount',  label: 'Amount', sortField: 'original_amount', width: null,  cssClass: 'ew-th-amount' };
    var COL_FEE        = { key: 'fee_amount',       label: 'Fee',   sortField: 'fee_amount',       width: null,  cssClass: 'ew-th-amount' };
    var COL_TOTAL      = { key: 'total_amount',     label: 'Total', sortField: 'total_amount',     width: null,  cssClass: 'ew-th-amount' };
    var COL_CCY        = { key: 'validated_currency', label: 'Ccy', sortField: 'validated_currency', width: null, cssClass: null };
    var COL_CUSTOMER   = { key: 'customer_code', label: 'Customer', sortField: 'resolved_customer_id', width: null, cssClass: null };
    var COL_ASSET      = { key: 'resolved_asset_id', label: 'Asset', sortField: 'resolved_asset_id', width: null, cssClass: null };
    var COL_CP         = { key: 'counterparty_short_code', label: 'CP', sortField: 'counterparty_short_code', width: null, cssClass: null };
    var COL_ORIGIN     = { key: 'origin',           label: 'Origin', sortField: 'origin',          width: null,  cssClass: null };
    var COL_CONF       = { key: 'type_confidence',  label: 'Conf.',  sortField: 'type_confidence', width: null,  cssClass: null };
    var COL_CONFIRMED_BY   = { key: 'confirmed_by',     label: 'Confirmed By', sortField: 'confirmed_by', width: null, cssClass: null };
    var COL_CONFIRMED_DATE = { key: 'confirmed_date',   label: 'Conf. Date',   sortField: 'confirmed_date', width: null, cssClass: null };
    var COL_GROUP      = { key: 'group_id',         label: 'Group',  sortField: 'group_id',        width: null,  cssClass: null };
    var COL_SEQ        = { key: 'sequence_number',  label: 'Seq',    sortField: 'sequence_number', width: null,  cssClass: null };
    var COL_LINEAGE    = { key: 'lineage_note',     label: 'Lineage Note', sortField: null,        width: null,  cssClass: null };
    var COL_CREATED    = { key: 'dateCreated',      label: 'Created', sortField: 'dateCreated',    width: null,  cssClass: null };

    // ── View definitions ────────────────────────────────────────────────────

    EW.nav.VIEWS = {
        workspace: {
            id: 'workspace',
            label: 'Enrichment Workspace',
            icon: 'fas fa-exchange-alt',
            hasBadge: true,
            hasCheckbox: true,
            hasToolbar: true,
            hasDashboard: true,
            columns: [
                COL_CHECKBOX, COL_TRX_ID, COL_STATUS, COL_SRC, COL_DATE, COL_TYPE, COL_DESC,
                COL_DC, COL_AMOUNT, COL_FEE, COL_TOTAL, COL_CCY, COL_CUSTOMER,
                COL_ASSET, COL_CP, COL_ORIGIN, COL_CONF
            ],
            buildFilters: function(params) {
                if (!params.status) {
                    params.excludeStatuses = ['superseded', 'confirmed'];
                }
                return params;
            }
        },
        ready: {
            id: 'ready',
            label: 'Ready for Posting',
            icon: 'fas fa-check',
            hasBadge: true,
            hasCheckbox: true,
            hasToolbar: true,
            rowClass: 'ew-row-ready',
            columns: [
                COL_CHECKBOX, COL_TRX_ID, COL_SRC, COL_DATE, COL_TYPE, COL_DESC,
                COL_DC, COL_AMOUNT, COL_FEE, COL_TOTAL, COL_CCY, COL_CUSTOMER,
                COL_ASSET, COL_CP
            ],
            buildFilters: function(params) {
                params.status = 'ready';
                return params;
            }
        },
        queue: {
            id: 'queue',
            label: 'Posting Queue',
            icon: 'fas fa-paper-plane',
            placeholder: { icon: 'fas fa-paper-plane', text: 'No operations in posting queue' }
        },
        posted: {
            id: 'posted',
            label: 'Posted Operations',
            icon: 'fas fa-book',
            placeholder: { icon: 'fas fa-book', text: 'No posted operations yet \u2014 confirm transactions from the workspace first' }
        },
        history: {
            id: 'history',
            label: 'Split/Merge History',
            icon: 'fas fa-code-branch',
            hasBadge: false,
            hasCheckbox: false,
            hasToolbar: false,
            columns: [
                COL_ORIGIN, COL_STATUS, COL_GROUP, COL_SEQ, COL_DATE, COL_SRC,
                COL_TYPE, COL_DESC, COL_TOTAL, COL_CCY, COL_CUSTOMER,
                COL_LINEAGE, COL_CREATED
            ],
            buildFilters: function(params) {
                params.origins = ['split', 'merge'];
                return params;
            }
        },
        fund: {
            id: 'fund',
            label: 'Fund Allocation',
            icon: 'fas fa-chart-pie',
            placeholder: { icon: 'fas fa-chart-pie', text: 'Fund Allocation \u2014 allocate fund-level transactions to investor positions' }
        },
        nav: {
            id: 'nav',
            label: 'NAV Calculation',
            icon: 'fas fa-chart-line',
            placeholder: { icon: 'fas fa-chart-line', text: 'NAV Calculation \u2014 compute Net Asset Value per unit' }
        },
        investors: {
            id: 'investors',
            label: 'Investor Positions',
            icon: 'fas fa-users',
            placeholder: { icon: 'fas fa-users', text: 'Investor Positions \u2014 view current investor holdings and allocations' }
        },
        stm: {
            id: 'stm',
            label: 'Statements',
            icon: 'fas fa-folder',
            placeholder: { icon: 'fas fa-folder', text: 'Statements \u2014 links to Enrichment Workspace via filters' }
        },
        loans: {
            id: 'loans',
            label: 'Loan Contracts',
            icon: 'fas fa-university',
            placeholder: { icon: 'fas fa-university', text: 'Loan Contracts \u2014 view and manage loan contracts' }
        },
        mdm: {
            id: 'mdm',
            label: 'Master Data',
            icon: 'fas fa-cog',
            placeholder: { icon: 'fas fa-cog', text: 'Master Data: Customers, Assets, Counterparties, FX Rates, Transaction Types' }
        }
    };

    /** Ordered view IDs for sidebar. */
    EW.nav.ORDER = ['workspace', 'ready', 'queue', 'posted', 'history', 'fund', 'nav', 'investors', 'stm', 'loans', 'mdm'];

    /** Get current view definition. */
    EW.nav.current = function() {
        return EW.nav.VIEWS[EW.state.currentView] || EW.nav.VIEWS.workspace;
    };

    // ── View switching ──────────────────────────────────────────────────────

    EW.nav.switchTo = function(viewId) {
        if (!EW.nav.VIEWS[viewId]) return;
        if (EW.state.currentView === viewId) return;

        EW.state.currentView = viewId;
        EW.state.currentTab = viewId; // backward compat
        EW.state.page = 1;
        EW.state.selectedIds = [];

        // Update page title
        var view = EW.nav.VIEWS[viewId];
        var titleEl = document.getElementById('ew-page-title');
        if (titleEl) {
            titleEl.innerHTML = esc(view.label) + ' <span class="ew-version-badge">v' + esc(EW.version) + '</span>';
        }

        // Close any open detail panel
        if (EW.detail && EW.detail.close) EW.detail.close();

        // Render view
        EW.nav.renderView(viewId);
    };

    /** Render the current view content. */
    EW.nav.renderView = function(viewId) {
        var view = EW.nav.VIEWS[viewId];
        var content = document.getElementById('ew-content');
        if (!content) return;

        // Placeholder views
        if (view.placeholder) {
            // Hide dashboard, toolbar, filters, table, pagination
            setVisible('ew-dashboard', false);
            setVisible('ew-toolbar', false);
            setVisible('ew-filters', false);
            var tableWrap = content.querySelector('.ew-table-wrap');
            if (tableWrap) tableWrap.style.display = 'none';
            setVisible('ew-pagination', false);
            setVisible('ew-recon-panel', false);

            // Show placeholder in tbody area
            var tbody = document.getElementById('ew-tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="16" class="ew-empty">'
                    + '<div class="ew-placeholder">'
                    + '<div class="ew-ph-icon"><i class="' + esc(view.placeholder.icon) + '"></i></div>'
                    + '<p>' + esc(view.placeholder.text) + '</p>'
                    + '</div></td></tr>';
            }
            if (tableWrap) tableWrap.style.display = '';
            return;
        }

        // Data views: show table infrastructure
        var tableWrap2 = content.querySelector('.ew-table-wrap');
        if (tableWrap2) tableWrap2.style.display = '';

        // Dashboard panel always renders (hosts both KPI cards + filter slot)
        setVisible('ew-dashboard', true);
        if (EW.dashboard && EW.dashboard.render) {
            EW.dashboard.render();
        }

        // Toolbar
        if (EW.actions && EW.actions.renderToolbar) {
            EW.actions.renderToolbar();
        }

        // Filters
        if (EW.filters && EW.filters.renderForView) {
            EW.filters.renderForView(viewId);
        }

        // Re-render thead and load data
        if (view.columns) {
            EW.table.renderThead();
            setVisible('ew-pagination', true);
            EW.table.load();
        } else {
            setVisible('ew-pagination', false);
        }
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    function esc(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function setVisible(id, show) {
        var el = document.getElementById(id);
        if (el) el.style.display = show ? '' : 'none';
    }

    // ── Init ────────────────────────────────────────────────────────────────

    EW.nav.init = function() {
        // Sidebar removed — navigation handled by Joget's userview sidebar
    };

    // ── Backward compatibility: EW.tabs → EW.nav ────────────────────────────

    EW.tabs = {
        TABS: EW.nav.VIEWS,
        ORDER: EW.nav.ORDER,
        current: EW.nav.current,
        switchTo: EW.nav.switchTo,
        init: EW.nav.init
    };

    // ── Global handler for onclick in dynamic HTML ──────────────────────────

    window.EW_switchTab = function(tabId) {
        EW.nav.switchTo(tabId);
    };

    window.EW_clearStmFilter = function() {
        var sf = document.getElementById('ew-stm-filter');
        if (sf) sf.style.display = 'none';
        // Reload current view without statement filter
        EW.table.load();
    };

})(window.EW || (window.EW = {}));
