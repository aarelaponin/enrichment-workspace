/**
 * ew-api.js — fetch wrappers for enrichment-api endpoints.
 *
 * API uses: filter=field=value,field=value  search=field:value
 * All field names are snake_case (Joget form element IDs).
 */
(function(EW) {
    'use strict';

    /**
     * Build standard headers for API calls.
     */
    function headers(extra) {
        var h = {
            'Accept': 'application/json',
            'api_id': EW.apiId,
            'api_key': EW.apiKey
        };
        if (extra) {
            for (var k in extra) {
                if (extra.hasOwnProperty(k)) h[k] = extra[k];
            }
        }
        return h;
    }

    /**
     * Handle non-OK response: read body and throw descriptive error.
     */
    function handleError(r) {
        return r.text().then(function(body) {
            var msg = 'HTTP ' + r.status;
            try {
                var json = JSON.parse(body);
                if (json.message) msg += ': ' + json.message;
                else if (json.error) msg += ': ' + json.error;
            } catch (e) {
                if (body) msg += ': ' + body.substring(0, 200);
            }
            console.error('[EW] API error', r.status, 'URL:', r.url, 'Body:', body);
            throw new Error(msg);
        });
    }

    /**
     * Fetch enrichment records with current filters and pagination.
     * @param {Object} params - { page, pageSize, sort, order, status, sourceType, customerId, statementId }
     * @returns {Promise<Object>} - { records, total, totalPages, page, pageSize, ms }
     */
    /**
     * Fetch enrichment records with current filters and pagination.
     * @param {Object} params - { page, pageSize, sort, order, status, sourceType, customerId, statementId, excludeStatuses, origins }
     * @returns {Promise<Object>} - { records, total, totalPages, page, pageSize, ms }
     */
    EW.api.fetchRecords = function(params) {
        var qs = 'page=' + (params.page || 1)
            + '&pageSize=' + (params.pageSize || 20)
            + '&sort=' + (params.sort || 'dateCreated')
            + '&order=' + (params.order || 'asc');

        // Build filter= parameter (comma-separated field=value pairs)
        var filters = [];
        if (params.statementId) filters.push('statement_id=' + params.statementId);
        if (params.status) filters.push('status=' + params.status);
        if (params.sourceType) filters.push('source_tp=' + params.sourceType);

        // Tab-specific: origin filter (history tab)
        if (params.origins && params.origins.length > 0) {
            for (var i = 0; i < params.origins.length; i++) {
                filters.push('origin=' + params.origins[i]);
            }
        }

        if (filters.length > 0) qs += '&filter=' + encodeURIComponent(filters.join(','));

        // Negative filters: exclude statuses (workspace tab excludes superseded+confirmed)
        if (params.excludeStatuses && params.excludeStatuses.length > 0) {
            qs += '&excludeStatus=' + encodeURIComponent(params.excludeStatuses.join(','));
        }

        // Build search= parameter (field:value for substring match)
        if (params.customerId) qs += '&search=' + encodeURIComponent('customer_code:' + params.customerId);

        var url = EW.apiBase + '/records?' + qs;
        console.log('[EW] Fetching:', url);

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

    /**
     * Fetch a single enrichment record by ID.
     * @param {string} id - Record ID
     * @returns {Promise<Object>} - Full record object
     */
    EW.api.fetchRecord = function(id) {
        var url = EW.apiBase + '/records/' + encodeURIComponent(id);
        console.log('[EW] Fetching record:', url);

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

    /**
     * Fetch statement summary (placeholder — full implementation in Phase 9).
     * @param {Object} params - { statementId }
     * @returns {Promise<Object>} - { records/summary }
     */
    EW.api.fetchSummary = function(params) {
        var qs = '';
        if (params.statementId) qs = '?statement_id=' + encodeURIComponent(params.statementId);

        var url = EW.apiBase + '/summary' + qs;
        console.log('[EW] Fetching summary:', url);

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

})(window.EW || (window.EW = {}));
