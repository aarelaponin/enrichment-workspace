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
            pageSize: cfg.pageSize || 20,
            sort: 'dateCreated',
            order: 'asc',
            total: 0,
            totalPages: 0,
            selectedIds: [],
            currentTab: 'workspace'
        },

        // Sub-modules populated by other JS files
        api: {},
        table: {},
        tabs: {},
        actions: {},
        filters: {},
        toast: {},
        detail: {}
    };
})();
