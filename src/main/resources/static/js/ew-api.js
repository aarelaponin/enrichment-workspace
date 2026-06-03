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
        if (params.dateFrom) qs += '&dateFrom=' + encodeURIComponent(params.dateFrom);
        if (params.dateTo) qs += '&dateTo=' + encodeURIComponent(params.dateTo);

        // Build filter= parameter (comma-separated field=value pairs)
        var filters = [];
        if (params.statementId) filters.push('statement_id=' + params.statementId);
        if (params.status) filters.push('status=' + params.status);
        if (params.allocationStatus) filters.push('fund_allocation_status=' + params.allocationStatus);
        if (params.sourceType) filters.push('source_tp=' + params.sourceType);
        if (params.internalType) filters.push('internal_type=' + params.internalType);

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
        var searches = [];
        if (params.customerId) searches.push('customer_code:' + params.customerId);
        if (params.descriptionSearch) searches.push('description:' + params.descriptionSearch);
        if (searches.length > 0) qs += '&search=' + encodeURIComponent(searches.join(','));

        // Client-side only filters (fundOnly, loanOnly) — passed as hints, handled post-fetch if API doesn't support
        if (params.fundOnly) qs += '&fundOnly=true';
        if (params.loanOnly) qs += '&loanOnly=true';

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
     * Save (update) an enrichment record via POST /records/save.
     * @param {string} id - Record ID
     * @param {Object} data - { version, ...changedFields }
     * @returns {Promise<Object>} - Updated record or error
     */
    EW.api.saveRecord = function(id, data) {
        var body = JSON.parse(JSON.stringify(data));
        body.id = id;

        console.log('[EW] Saving record:', id, body);

        // Piggyback on /records endpoint (the only route Joget reliably resolves).
        // The 'save' query param triggers inline-save logic on the server.
        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(body));

        return fetch(url, { headers: headers() }).then(function(r) {
            if (!r.ok) {
                return r.text().then(function(text) {
                    var msg = 'HTTP ' + r.status;
                    var parsed = null;
                    try { parsed = JSON.parse(text); } catch (e) { /* ignore */ }
                    if (parsed && parsed.message) msg = parsed.message;
                    else if (parsed && parsed.error) msg = parsed.error;
                    else if (text) msg += ': ' + text.substring(0, 200);

                    var err = new Error(msg);
                    err.status = r.status;
                    if (parsed) err.body = parsed;
                    throw err;
                });
            }
            return r.json();
        });
    };

    /**
     * Batch status transition for multiple records.
     * @param {string[]} recordIds - Array of record IDs
     * @param {string} targetStatus - Target status code (e.g. 'ready', 'processing', 'enriched')
     * @param {string} [reason] - Optional reason for the transition
     * @returns {Promise<Object>} - { succeeded: [...], failed: [...], ms }
     */
    EW.api.batchTransitionStatus = function(recordIds, targetStatus, reason) {
        var payload = { recordIds: recordIds.join(','), targetStatus: targetStatus };
        if (reason) payload.reason = reason;

        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] Batch transition:', targetStatus, 'for', recordIds.length, 'records');

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

    /**
     * Confirm records for posting.
     * @param {string[]} recordIds - Array of record IDs
     * @param {boolean} [allowPartial] - Allow partial confirmation (default true)
     * @returns {Promise<Object>} - { confirmed, confirmedRecords, skipped, validationErrors, reconciliation, ms }
     */
    EW.api.confirmRecords = function(recordIds, allowPartial) {
        var payload = { confirm: true, recordIds: recordIds.join(','), allowPartial: allowPartial !== false };

        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] Confirm:', recordIds.length, 'records');

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

    /**
     * Delete records (batch).
     * @param {string[]} recordIds - Array of record IDs
     * @returns {Promise<Object>} - { deleted, deletedRecords, skipped, ms }
     */
    EW.api.deleteRecords = function(recordIds) {
        var payload = { 'delete': true, recordIds: recordIds.join(',') };

        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] Delete:', recordIds.length, 'records');

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

    /**
     * Split a record into multiple allocations.
     * @param {string} recordId - Record ID to split
     * @param {Array} allocations - [{amount, description}, ...]
     * @returns {Promise<Object>} - { children, childRecords, ms }
     */
    EW.api.splitRecord = function(recordId, allocations) {
        var payload = { split: true, recordId: recordId, allocations: allocations };

        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] Split:', recordId, 'into', allocations.length, 'parts');

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

    /**
     * Merge multiple records into one.
     * @param {string[]} recordIds - Array of record IDs to merge
     * @returns {Promise<Object>} - { mergedRecord, superseded, ms }
     */
    EW.api.mergeRecords = function(recordIds) {
        var payload = { merge: true, recordIds: recordIds.join(',') };

        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] Merge:', recordIds.length, 'records');

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

    /**
     * Create a new manual enrichment record.
     * @param {Object} fields - Record fields (statement_id, transaction_date, etc.)
     * @returns {Promise<Object>} - Created record
     */
    EW.api.createRecord = function(fields) {
        var payload = { newManual: true };
        for (var k in fields) {
            if (fields.hasOwnProperty(k)) payload[k] = fields[k];
        }

        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] Create manual record');

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

    /**
     * Fetch per-statement reconciliation data.
     * @param {string} statementId - Statement ID
     * @returns {Promise<Object>} - { statementId, isFinalConfirmation, currencies: [...], ms }
     */
    EW.api.fetchReconciliation = function(statementId) {
        var url = EW.apiBase + '/reconciliation/' + encodeURIComponent(statementId);
        console.log('[EW] Fetching reconciliation:', url);

        return fetch(url, { headers: headers() })
            .then(function(r) {
                if (!r.ok) return handleError(r);
                return r.json();
            });
    };

    /**
     * Fetch ALL records across all pages for the current filter set.
     * Uses a large pageSize (500) and iterates pages sequentially.
     * @param {Object} params - Same as fetchRecords (page/pageSize will be overridden)
     * @returns {Promise<Array>} - Array of all matching records
     */
    EW.api.fetchAllRecords = function(params) {
        var allParams = Object.assign({}, params, { page: 1, pageSize: 500 });
        var allRecords = [];

        function fetchPage(page) {
            allParams.page = page;
            return EW.api.fetchRecords(allParams).then(function(data) {
                allRecords = allRecords.concat(data.records || []);
                if (page < (data.totalPages || 1)) {
                    return fetchPage(page + 1);
                }
                return allRecords;
            });
        }

        return fetchPage(1);
    };

    /**
     * Fetch statement summary.
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

    // ── Loan / Fund API stubs ─────────────────────────────────────────────

    /**
     * Split a loan payment into principal + interest.
     * @param {string} recordId - Record ID
     * @param {string} loanId - Loan contract ID
     * @param {number} principalAmount - Principal portion
     * @param {number} interestAmount - Interest portion
     * @returns {Promise<Object>}
     */
    EW.api.splitLoan = function(recordId, loanId, principalAmount, interestAmount) {
        var payload = {
            splitLoan: true,
            recordId: recordId,
            loanId: loanId,
            principalAmount: principalAmount,
            interestAmount: interestAmount
        };
        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] Loan split:', recordId);
        return fetch(url, { headers: headers() }).then(function(r) {
            if (!r.ok) return handleError(r);
            return r.json();
        });
    };

    /**
     * Link a record to a loan contract.
     * @param {string} recordId - Record ID
     * @param {string} loanId - Loan contract ID
     * @returns {Promise<Object>}
     */
    EW.api.linkLoan = function(recordId, loanId) {
        return EW.api.saveRecord(recordId, { loan_id: loanId });
    };

    /**
     * Fetch loan contracts (placeholder — returns empty until API exists).
     * @returns {Promise<Array>}
     */
    EW.api.fetchLoanContracts = function() {
        return Promise.resolve([]);
    };

    /**
     * Fetch securities transaction details for trade allocation.
     * @param {string} enrichmentId - Enrichment record ID
     * @returns {Promise<Object>} - { enrichmentId, sourceRecordId, ticker, quantity, price, amount, fee, currency, type, assetId, assetIsin, transactionDate, ms }
     */
    EW.api.getSecuTransaction = function(enrichmentId) {
        var payload = { secuTransaction: true, enrichmentId: enrichmentId };
        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] SecuTransaction:', enrichmentId);
        return fetch(url, { headers: headers() }).then(function(r) {
            if (!r.ok) return handleError(r);
            return r.json();
        });
    };

    /**
     * Fetch allocation summary (existing lots) for a trade.
     * @param {string} enrichmentId - Enrichment record ID
     * @returns {Promise<Object>} - { enrichmentId, allocatedQty, lotCount, lots:[...], ms }
     */
    EW.api.getAllocationSummary = function(enrichmentId) {
        var payload = { allocationSummary: true, enrichmentId: enrichmentId };
        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] AllocationSummary:', enrichmentId);
        return fetch(url, { headers: headers() }).then(function(r) {
            if (!r.ok) return handleError(r);
            return r.json();
        });
    };

    /**
     * Customers who currently hold the asset of this trade (open qty > 0), with
     * their available quantity. Used to constrain the SELL allocation dropdown.
     * @returns {Promise<Object>} - { holders: [{customerId, displayName, quantity}] }
     */
    EW.api.getAssetHolders = function(enrichmentId) {
        var payload = { assetHolders: true, enrichmentId: enrichmentId };
        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        return fetch(url, { headers: headers() }).then(function(r) {
            if (!r.ok) return handleError(r);
            return r.json();
        });
    };

    /**
     * Search customers for allocation dropdown.
     * @param {string} search - Search term
     * @returns {Promise<Object>} - { customers:[{customerId, displayName}], ms }
     */
    EW.api.getCustomers = function(search) {
        var payload = { customers: true, search: search || '' };
        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] Customers:', search);
        return fetch(url, { headers: headers() }).then(function(r) {
            if (!r.ok) return handleError(r);
            return r.json();
        });
    };

    /**
     * Allocate a quantity of a trade to a customer.
     * @param {string} enrichmentId - Enrichment record ID
     * @param {string} customerId - Customer ID
     * @param {number} quantity - Quantity to allocate
     * @returns {Promise<Object>} - { success, lotId, positionId, direction, quantity, totalAmount, feeAmount, totalCostWithFees, currency, allocationStatus, remainingQty, ms }
     */
    EW.api.allocateTrade = function(enrichmentId, customerId, quantity) {
        var payload = {
            allocateTrade: true,
            enrichmentId: enrichmentId,
            customerId: customerId,
            quantity: String(quantity)
        };
        var url = EW.apiBase + '/records?save=' + encodeURIComponent(JSON.stringify(payload));
        console.log('[EW] AllocateTrade:', enrichmentId, customerId, quantity);
        return fetch(url, { headers: headers() }).then(function(r) {
            if (!r.ok) return handleError(r);
            return r.json();
        });
    };

    // ── Income Allocation API ──────────────────────────────────────────────

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

})(window.EW || (window.EW = {}));
