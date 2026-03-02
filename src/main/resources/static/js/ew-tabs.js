/**
 * ew-tabs.js — tab navigation and per-tab column definitions.
 *
 * Five tabs: workspace, ready, confirmed, history, summary.
 * Each tab defines its own column config, API filter, and toolbar.
 */
(function(EW) {
    'use strict';

    EW.tabs = {};

    // ── Column definitions per tab ──────────────────────────────────────────

    var COL_CHECKBOX   = { key: '_check',    label: '',            sortField: null,               width: '32px', cssClass: 'ew-th-check', type: 'checkbox' };
    var COL_STATUS     = { key: 'status',    label: 'Status',      sortField: 'status',           width: null,   cssClass: null };
    var COL_SRC        = { key: 'source_tp', label: 'Src',         sortField: 'source_tp',        width: null,   cssClass: null };
    var COL_DATE       = { key: 'transaction_date', label: 'Date', sortField: 'transaction_date', width: null,   cssClass: null };
    var COL_TYPE       = { key: 'internal_type',    label: 'Type', sortField: 'internal_type',    width: null,   cssClass: null };
    var COL_DESC       = { key: 'description',      label: 'Description', sortField: null,        width: null,   cssClass: null };
    var COL_DC         = { key: 'debit_credit',     label: 'D/C',  sortField: 'debit_credit',     width: null,   cssClass: null };
    var COL_AMOUNT     = { key: 'original_amount',  label: 'Amount', sortField: 'original_amount', width: null,  cssClass: 'ew-th-amount' };
    var COL_FEE        = { key: 'fee_amount',       label: 'Fee',   sortField: null,               width: null,  cssClass: 'ew-th-amount' };
    var COL_TOTAL      = { key: 'total_amount',     label: 'Total', sortField: 'total_amount',     width: null,  cssClass: 'ew-th-amount' };
    var COL_CCY        = { key: 'validated_currency', label: 'Ccy', sortField: 'validated_currency', width: null, cssClass: null };
    var COL_CUSTOMER   = { key: 'customer_code',    label: 'Customer', sortField: 'customer_code', width: null,  cssClass: null };
    var COL_ASSET      = { key: 'resolved_asset_id', label: 'Asset', sortField: null,              width: null,  cssClass: null };
    var COL_CP         = { key: 'counterparty_short_code', label: 'CP', sortField: null,           width: null,  cssClass: null };
    var COL_ORIGIN     = { key: 'origin',           label: 'Origin', sortField: 'origin',          width: null,  cssClass: null };
    var COL_CONF       = { key: 'type_confidence',  label: 'Conf.',  sortField: null,              width: null,  cssClass: null };
    var COL_CONFIRMED_BY   = { key: 'confirmed_by',     label: 'Confirmed By', sortField: null,   width: null,  cssClass: null };
    var COL_CONFIRMED_DATE = { key: 'confirmed_date',   label: 'Conf. Date',   sortField: 'confirmed_date', width: null, cssClass: null };
    var COL_GROUP      = { key: 'group_id',         label: 'Group',  sortField: 'group_id',        width: null,  cssClass: null };
    var COL_SEQ        = { key: 'sequence_number',  label: 'Seq',    sortField: 'sequence_number', width: null,  cssClass: null };
    var COL_LINEAGE    = { key: 'lineage_note',     label: 'Lineage Note', sortField: null,        width: null,  cssClass: null };
    var COL_CREATED    = { key: 'dateCreated',      label: 'Created', sortField: 'dateCreated',    width: null,  cssClass: null };
    // Summary tab columns
    var COL_SUM_STATUS = { key: 'status',       label: 'Status',        sortField: null, width: null, cssClass: null };
    var COL_SUM_CCY    = { key: 'currency',     label: 'Currency',      sortField: null, width: null, cssClass: null };
    var COL_SUM_COUNT  = { key: 'count',        label: 'Count',         sortField: null, width: null, cssClass: 'ew-th-amount' };
    var COL_SUM_TOTAL  = { key: 'total_amount', label: 'Total Amount',  sortField: null, width: null, cssClass: 'ew-th-amount' };
    var COL_SUM_EARLY  = { key: 'earliest_date', label: 'Earliest Date', sortField: null, width: null, cssClass: null };
    var COL_SUM_LATE   = { key: 'latest_date',  label: 'Latest Date',   sortField: null, width: null, cssClass: null };

    // ── Tab definitions ─────────────────────────────────────────────────────

    EW.tabs.TABS = {
        workspace: {
            id: 'workspace',
            label: 'Enrichment Workspace',
            icon: 'fas fa-exchange-alt',
            hasBadge: true,
            hasCheckbox: true,
            hasToolbar: true,
            columns: [
                COL_CHECKBOX, COL_STATUS, COL_SRC, COL_DATE, COL_TYPE, COL_DESC,
                COL_DC, COL_AMOUNT, COL_FEE, COL_TOTAL, COL_CCY, COL_CUSTOMER,
                COL_ASSET, COL_CP, COL_ORIGIN, COL_CONF
            ],
            buildFilters: function(params) {
                // Exclude superseded and confirmed
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
                COL_CHECKBOX, COL_SRC, COL_DATE, COL_TYPE, COL_DESC,
                COL_DC, COL_AMOUNT, COL_FEE, COL_TOTAL, COL_CCY, COL_CUSTOMER,
                COL_ASSET, COL_CP
            ],
            buildFilters: function(params) {
                params.status = 'ready';
                return params;
            }
        },
        confirmed: {
            id: 'confirmed',
            label: 'Confirmed Records',
            icon: 'fas fa-lock',
            hasBadge: true,
            hasCheckbox: false,
            hasToolbar: false,
            columns: [
                COL_STATUS, COL_DATE, COL_TYPE, COL_DESC,
                COL_DC, COL_TOTAL, COL_CCY, COL_CUSTOMER,
                COL_ASSET, COL_CP, COL_CONFIRMED_BY, COL_CONFIRMED_DATE
            ],
            buildFilters: function(params) {
                params.status = 'confirmed';
                return params;
            }
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
        summary: {
            id: 'summary',
            label: 'Statement Summary',
            icon: 'fas fa-chart-bar',
            hasBadge: false,
            hasCheckbox: false,
            hasToolbar: false,
            columns: [
                COL_SUM_STATUS, COL_SUM_CCY, COL_SUM_COUNT, COL_SUM_TOTAL,
                COL_SUM_EARLY, COL_SUM_LATE
            ],
            isSummary: true,
            buildFilters: function(params) {
                return params;
            }
        }
    };

    /** Ordered tab IDs for rendering. */
    EW.tabs.ORDER = ['workspace', 'ready', 'confirmed', 'history', 'summary'];

    /** Get current tab definition. */
    EW.tabs.current = function() {
        return EW.tabs.TABS[EW.state.currentTab] || EW.tabs.TABS.workspace;
    };

    // ── Tab switching ───────────────────────────────────────────────────────

    EW.tabs.switchTo = function(tabId) {
        if (!EW.tabs.TABS[tabId]) return;
        if (EW.state.currentTab === tabId) return;

        EW.state.currentTab = tabId;
        EW.state.page = 1;
        EW.state.selectedIds = [];

        // Update active tab class
        var tabEls = document.querySelectorAll('.ew-tab');
        for (var i = 0; i < tabEls.length; i++) {
            var el = tabEls[i];
            if (el.getAttribute('data-tab') === tabId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }

        // Update toolbar visibility
        EW.actions.renderToolbar();

        // Update filter visibility
        if (EW.filters.updateForTab) {
            EW.filters.updateForTab(tabId);
        }

        // Re-render thead and load data
        EW.table.renderThead();
        EW.table.load();
    };

    // ── Init ────────────────────────────────────────────────────────────────

    EW.tabs.init = function() {
        var tabEls = document.querySelectorAll('.ew-tab');
        for (var i = 0; i < tabEls.length; i++) {
            tabEls[i].addEventListener('click', function() {
                var tabId = this.getAttribute('data-tab');
                EW.tabs.switchTo(tabId);
            });
        }
    };

    // ── Global handler for onclick in dynamic HTML ──────────────────────────

    window.EW_switchTab = function(tabId) {
        EW.tabs.switchTo(tabId);
    };

})(window.EW || (window.EW = {}));
