/**
 * ew-filters.js — filter bar event handlers, tab-aware visibility.
 */
(function(EW) {
    'use strict';

    EW.filters.init = function() {
        var btnSearch = document.getElementById('ew-btn-search');
        var btnReset = document.getElementById('ew-btn-reset');

        if (btnSearch) {
            btnSearch.addEventListener('click', function() {
                EW.state.page = 1;
                EW.table.load();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', function() {
                var status = document.getElementById('ew-filter-status');
                var source = document.getElementById('ew-filter-source');
                var customer = document.getElementById('ew-filter-customer');

                if (status) status.value = '';
                if (source) source.value = '';
                if (customer) customer.value = '';

                EW.state.page = 1;
                EW.state.sort = 'transaction_date';
                EW.state.order = 'asc';

                // Clear sort indicators
                var headers = document.querySelectorAll('.ew-sortable');
                for (var i = 0; i < headers.length; i++) {
                    headers[i].classList.remove('ew-sort-asc', 'ew-sort-desc');
                }

                EW.table.load();
            });
        }

        // Set initial filter visibility
        EW.filters.updateForTab(EW.state.currentTab);
    };

    /**
     * Show/hide/lock filter controls based on active tab.
     */
    EW.filters.updateForTab = function(tabId) {
        var filtersBar = document.getElementById('ew-filters');
        var filterStatus = document.getElementById('ew-filter-status');
        var filterSource = document.getElementById('ew-filter-source');
        var filterCustomer = document.getElementById('ew-filter-customer');
        var btnSearch = document.getElementById('ew-btn-search');
        var btnReset = document.getElementById('ew-btn-reset');

        if (!filtersBar) return;

        // Summary tab: hide all filters
        if (tabId === 'summary') {
            filtersBar.style.display = 'none';
            return;
        }

        filtersBar.style.display = 'flex';

        // Reset filter states
        if (filterStatus) {
            filterStatus.disabled = false;
            filterStatus.style.display = '';
        }
        if (filterSource) filterSource.style.display = '';
        if (filterCustomer) filterCustomer.style.display = '';
        if (btnSearch) btnSearch.style.display = '';
        if (btnReset) btnReset.style.display = '';

        switch (tabId) {
            case 'ready':
                // Lock status filter to "ready"
                if (filterStatus) {
                    filterStatus.value = 'ready';
                    filterStatus.disabled = true;
                }
                break;

            case 'confirmed':
                // Lock status filter to "confirmed" — only source/customer remain active
                if (filterStatus) {
                    filterStatus.value = '';
                    filterStatus.disabled = true;
                }
                break;

            case 'history':
                // History: status filter not meaningful, hide it
                if (filterStatus) {
                    filterStatus.value = '';
                    filterStatus.style.display = 'none';
                }
                break;

            case 'workspace':
            default:
                // All filters visible and enabled
                if (filterStatus) {
                    filterStatus.value = '';
                    filterStatus.disabled = false;
                }
                break;
        }
    };

})(window.EW || (window.EW = {}));
