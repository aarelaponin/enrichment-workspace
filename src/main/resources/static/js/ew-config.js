/**
 * ew-config.js — EW namespace initialization.
 * Reads window.EW_CONFIG (injected by FreeMarker) and sets up shared state.
 */
(function() {
    'use strict';

    var cfg = window.EW_CONFIG || {};

    window.EW = {
        // API connection
        apiBase: cfg.apiBase || '/jw/api/enrichment',
        apiId: cfg.apiId || '',
        apiKey: cfg.apiKey || '',

        // Context
        statementId: cfg.statementId || '',
        version: cfg.version || '0.0.0',

        // Pagination state
        state: {
            page: 1,
            pageSizes: (function() {
                var sizes = [10, 20, 50, 100];
                var d = cfg.pageSize || 20;
                if (sizes.indexOf(d) === -1) { sizes.push(d); sizes.sort(function(a, b) { return a - b; }); }
                return sizes;
            })(),
            pageSize: (function() {
                var defaultSize = cfg.pageSize || 20;
                var sizes = [10, 20, 50, 100];
                if (sizes.indexOf(defaultSize) === -1) sizes.push(defaultSize);
                var stored = localStorage.getItem('ew-pageSize');
                if (stored) { var n = parseInt(stored, 10); if (sizes.indexOf(n) !== -1) return n; }
                return defaultSize;
            })(),
            sort: 'dateCreated',
            order: 'asc',
            total: 0,
            totalPages: 0,
            selectedIds: [],
            currentView: 'workspace',
            currentTab: 'workspace',  // backward compat alias
            panelCollapsed: localStorage.getItem('ew-panelCollapsed') === 'true'
        },

        // Sub-modules populated by other JS files
        api: {},
        table: {},
        tabs: {},
        nav: {},
        actions: {},
        filters: {},
        toast: {},
        detail: {},
        dashboard: {}
    };
})();
