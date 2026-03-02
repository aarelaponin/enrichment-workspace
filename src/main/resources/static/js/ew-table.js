/**
 * ew-table.js — table rendering, sorting, pagination, selection.
 *
 * All field names match the enrichment-api response (snake_case, Joget form element IDs).
 * Column configuration is driven by EW.tabs — each tab defines its own columns.
 */
(function(EW) {
    'use strict';

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** HTML-escape a string. */
    function esc(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    /** Truncate string to n characters. */
    function trunc(s, n) {
        if (!s) return '';
        return s.length > n ? s.substring(0, n) + '...' : s;
    }

    /** Format a numeric amount with 2 decimal places. */
    function fmtAmt(v) {
        if (v === null || v === undefined || v === '') return '';
        var n = parseFloat(v);
        if (isNaN(n)) return esc(String(v));
        return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /** Source type label. */
    function srcLabel(s) {
        if (s === 'bank') return '<b>B</b>';
        if (s === 'secu') return '<b>S</b>';
        return esc(s || '');
    }

    /** Confidence badge. */
    function confBadge(c) {
        if (!c || c === '') return '';
        return '<span class="cf-' + esc(c) + '">' + esc(c) + '</span>';
    }

    /** Origin badge. */
    function originBadge(o) {
        if (!o || o === '') return '';
        return '<span class="origin-' + esc(o) + '">' + esc(o) + '</span>';
    }

    /** Debit/Credit badge. */
    function dcBadge(dc) {
        if (!dc || dc === '') return '';
        return '<span class="dc-' + esc(dc) + '">' + esc(dc) + '</span>';
    }

    /** Render a single cell based on column key. */
    function renderCell(col, r) {
        var key = col.key;
        var v = r[key];

        switch (key) {
            case '_check':
                return '<input type="checkbox" class="ew-row-check" value="' + esc(r.id) + '" />';
            case 'status':
                return '<span class="st-' + esc(v) + '">' + esc(v) + '</span>';
            case 'source_tp':
                return srcLabel(v);
            case 'description':
                return '<span class="ew-desc" title="' + esc(v || '') + '">' + esc(trunc(v, 60)) + '</span>';
            case 'debit_credit':
                return dcBadge(v);
            case 'original_amount':
                return '<span class="ew-amount">' + fmtAmt(v) + '</span>';
            case 'fee_amount':
                return '<span class="ew-amount">' + fmtAmt(v) + '</span>';
            case 'total_amount':
                return '<span class="ew-amount-total">' + fmtAmt(v) + '</span>';
            case 'type_confidence':
                return confBadge(v);
            case 'origin':
                return originBadge(v);
            case 'count':
                return '<span class="ew-amount">' + esc(v != null ? String(v) : '') + '</span>';
            default:
                return esc(v != null ? String(v) : '');
        }
    }

    // ── Status display ──────────────────────────────────────────────────────

    function setStatus(msg) {
        var el = document.getElementById('ew-status');
        if (el) el.textContent = msg;
    }

    function setCount(n) {
        var el = document.getElementById('ew-record-count');
        if (el) el.textContent = n + ' record' + (n !== 1 ? 's' : '');
    }

    // ── Dynamic thead rendering ─────────────────────────────────────────────

    EW.table.renderThead = function() {
        var thead = document.getElementById('ew-thead');
        if (!thead) return;

        var tab = EW.tabs.current();
        var cols = tab.columns;
        var h = '<tr>';

        for (var i = 0; i < cols.length; i++) {
            var col = cols[i];
            if (col.type === 'checkbox') {
                h += '<th class="ew-th-check"><input type="checkbox" id="ew-check-all" /></th>';
            } else {
                var cls = [];
                if (col.sortField) cls.push('ew-sortable');
                if (col.cssClass) cls.push(col.cssClass);
                var clsAttr = cls.length > 0 ? ' class="' + cls.join(' ') + '"' : '';
                var sortAttr = col.sortField ? ' data-sort="' + col.sortField + '"' : '';
                var widthAttr = col.width ? ' style="width:' + col.width + '"' : '';
                h += '<th' + clsAttr + sortAttr + widthAttr + '>' + esc(col.label) + '</th>';
            }
        }

        h += '</tr>';
        thead.innerHTML = h;

        // Re-bind sort and check-all handlers
        EW.table.initSort();
        EW.table.initCheckAll();
    };

    // ── Fetch + render ──────────────────────────────────────────────────────

    EW.table.load = function() {
        var st = EW.state;
        var tab = EW.tabs.current();
        var colCount = tab.columns.length;

        var filterStatus = document.getElementById('ew-filter-status');
        var filterSource = document.getElementById('ew-filter-source');
        var filterCustomer = document.getElementById('ew-filter-customer');

        setStatus('Loading...');

        // Summary tab: placeholder until Phase 9
        if (tab.isSummary) {
            var tbody = document.getElementById('ew-tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="' + colCount + '" class="ew-empty">'
                    + '<i class="fas fa-chart-bar"></i> Statement Summary will be available in a future release.'
                    + '</td></tr>';
            }
            setStatus('');
            setCount(0);
            document.getElementById('ew-pagination').innerHTML = '';
            return;
        }

        var params = {
            page: st.page,
            pageSize: st.pageSize,
            sort: st.sort,
            order: st.order,
            statementId: EW.statementId,
            status: filterStatus ? filterStatus.value : '',
            sourceType: filterSource ? filterSource.value : '',
            customerId: filterCustomer ? filterCustomer.value : ''
        };

        // Apply tab-specific filter overrides
        params = tab.buildFilters(params);

        EW.api.fetchRecords(params)
            .then(function(data) {
                renderData(data, tab, colCount);
            })
            .catch(function(e) {
                renderError(e.message, colCount);
            });
    };

    function renderData(data, tab, colCount) {
        var st = EW.state;
        st.total = data.total || 0;
        st.totalPages = data.totalPages || 0;

        var records = data.records || [];

        // Cache records for detail panel lookup (avoids extra API call)
        st.records = {};
        for (var ri = 0; ri < records.length; ri++) {
            if (records[ri].id) st.records[records[ri].id] = records[ri];
        }

        var tbody = document.getElementById('ew-tbody');
        if (!tbody) return;

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + colCount + '" class="ew-empty">No enrichment records found.</td></tr>';
            setStatus('');
            setCount(0);
            renderPagination();
            return;
        }

        var cols = tab.columns;
        var forceRowClass = tab.rowClass || null;

        var rows = '';
        for (var i = 0; i < records.length; i++) {
            var r = records[i];

            // Row CSS class based on status (or forced by tab)
            var rowClass = forceRowClass || '';
            if (!forceRowClass && r.status) {
                if (r.status === 'error' || r.status === 'manual_review' || r.status === 'ready') {
                    rowClass = 'ew-row-' + r.status;
                }
            }

            rows += '<tr data-id="' + esc(r.id) + '" data-status="' + esc(r.status) + '"'
                + (rowClass ? ' class="' + rowClass + '"' : '')
                + '>';

            for (var j = 0; j < cols.length; j++) {
                var col = cols[j];
                var tdCls = '';
                if (col.cssClass && col.type !== 'checkbox') tdCls = ' class="' + col.cssClass + '"';
                rows += '<td' + tdCls + '>' + renderCell(col, r) + '</td>';
            }

            rows += '</tr>';

            // Error sub-row when status is error and error_message exists
            if (r.status === 'error' && r.error_message) {
                rows += '<tr class="ew-error-row"><td colspan="' + colCount + '">'
                    + '<span class="ew-error-msg"><i class="fas fa-exclamation-triangle"></i> '
                    + esc(r.error_message) + '</span></td></tr>';
            }
        }
        tbody.innerHTML = rows;

        // Bind checkbox change events for selection tracking
        bindRowCheckboxes();

        // Bind row click for detail panel
        bindRowClick();

        setStatus('Loaded in ' + (data.ms || '?') + 'ms');
        setCount(st.total);
        renderPagination();
    }

    function renderSummary(data) {
        var st = EW.state;
        var tab = EW.tabs.current();
        var colCount = tab.columns.length;
        var cols = tab.columns;
        var records = data.records || data.summary || [];
        var tbody = document.getElementById('ew-tbody');
        if (!tbody) return;

        st.total = records.length;
        st.totalPages = 1;

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + colCount + '" class="ew-empty">No summary data available.</td></tr>';
            setStatus('');
            setCount(0);
            renderPagination();
            return;
        }

        var rows = '';
        for (var i = 0; i < records.length; i++) {
            var r = records[i];
            rows += '<tr>';
            for (var j = 0; j < cols.length; j++) {
                rows += '<td>' + renderCell(cols[j], r) + '</td>';
            }
            rows += '</tr>';
        }
        tbody.innerHTML = rows;
        setStatus('');
        setCount(records.length);
        renderPagination();
    }

    function renderError(msg, colCount) {
        var tbody = document.getElementById('ew-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="' + colCount + '" class="ew-error">Error: ' + esc(msg) + '</td></tr>';
        }
        setStatus('Error');
    }

    // ── Row click for detail panel ──────────────────────────────────────────

    function bindRowClick() {
        var rows = document.querySelectorAll('#ew-tbody tr[data-id]');
        for (var i = 0; i < rows.length; i++) {
            rows[i].addEventListener('click', function(e) {
                // Don't open detail when clicking checkboxes
                if (e.target.type === 'checkbox') return;
                var id = this.getAttribute('data-id');
                if (id && EW.detail && EW.detail.open) {
                    var record = EW.state.records && EW.state.records[id];
                    EW.detail.open(id, record);
                }
            });
        }
    }

    // ── Row checkbox binding ────────────────────────────────────────────────

    function bindRowCheckboxes() {
        var checks = document.querySelectorAll('.ew-row-check');
        for (var i = 0; i < checks.length; i++) {
            checks[i].addEventListener('change', function() {
                EW.actions.syncSelection();
            });
        }
    }

    // ── Pagination ──────────────────────────────────────────────────────────

    function renderPagination() {
        var el = document.getElementById('ew-pagination');
        if (!el) return;
        var st = EW.state;

        if (st.totalPages <= 1) {
            el.innerHTML = '';
            return;
        }

        var h = '';
        h += '<button ' + (st.page <= 1 ? 'disabled' : '') + ' onclick="EW_goto(1)">&laquo;</button>';
        h += '<button ' + (st.page <= 1 ? 'disabled' : '') + ' onclick="EW_goto(' + (st.page - 1) + ')">&lsaquo;</button>';

        var start = Math.max(1, st.page - 2);
        var end = Math.min(st.totalPages, start + 4);
        start = Math.max(1, end - 4);

        for (var p = start; p <= end; p++) {
            h += '<button class="' + (p === st.page ? 'ew-page-current' : '') + '" onclick="EW_goto(' + p + ')">' + p + '</button>';
        }

        h += '<button ' + (st.page >= st.totalPages ? 'disabled' : '') + ' onclick="EW_goto(' + (st.page + 1) + ')">&rsaquo;</button>';
        h += '<button ' + (st.page >= st.totalPages ? 'disabled' : '') + ' onclick="EW_goto(' + st.totalPages + ')">&raquo;</button>';
        h += '<span class="ew-page-info">Page ' + st.page + ' of ' + st.totalPages + '</span>';

        el.innerHTML = h;
    }

    // ── Sorting ─────────────────────────────────────────────────────────────

    EW.table.initSort = function() {
        var headers = document.querySelectorAll('.ew-sortable');
        for (var i = 0; i < headers.length; i++) {
            headers[i].addEventListener('click', function() {
                var field = this.getAttribute('data-sort');
                var st = EW.state;
                if (st.sort === field) {
                    st.order = st.order === 'asc' ? 'desc' : 'asc';
                } else {
                    st.sort = field;
                    st.order = 'asc';
                }
                st.page = 1;

                // Update sort indicators
                var all = document.querySelectorAll('.ew-sortable');
                for (var j = 0; j < all.length; j++) {
                    all[j].classList.remove('ew-sort-asc', 'ew-sort-desc');
                }
                this.classList.add('ew-sort-' + st.order);

                EW.table.load();
            });
        }
    };

    // ── Check-all ───────────────────────────────────────────────────────────

    EW.table.initCheckAll = function() {
        var checkAll = document.getElementById('ew-check-all');
        if (checkAll) {
            checkAll.addEventListener('change', function() {
                var checked = this.checked;
                var boxes = document.querySelectorAll('.ew-row-check');
                for (var i = 0; i < boxes.length; i++) {
                    boxes[i].checked = checked;
                }
                EW.actions.syncSelection();
            });
        }
    };

    // ── Global navigation (needed for onclick in dynamic HTML) ──────────

    window.EW_goto = function(p) {
        EW.state.page = p;
        EW.table.load();
    };

})(window.EW || (window.EW = {}));
