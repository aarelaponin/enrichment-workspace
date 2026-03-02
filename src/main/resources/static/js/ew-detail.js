/**
 * ew-detail.js — read-only detail slide-over panel.
 *
 * Opens when clicking a table row. Shows all record fields in 8 collapsible sections.
 * This is the read-only phase — editing comes later.
 */
(function(EW) {
    'use strict';

    // -- Helpers --

    /** HTML-escape a string. */
    function esc(s) {
        if (!s && s !== 0) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    /** Format a numeric amount with 2 decimal places. */
    function fmtAmt(v) {
        if (v === null || v === undefined || v === '') return '';
        var n = parseFloat(v);
        if (isNaN(n)) return esc(String(v));
        return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // -- Field rendering --

    /**
     * Render a single field display.
     * @param {string} label - Field label
     * @param {*} value - Field value
     * @param {Object} [opts] - Options: {muted, badge, dc, err, mono, bold, wide}
     */
    function renderField(label, value, opts) {
        opts = opts || {};
        var cls = opts.wide ? 'ew-f-field wide' : 'ew-f-field';
        var inner;

        if (opts.badge) {
            // Status or confidence badge
            inner = '<span class="st-' + esc(value) + '">' + esc(value || '—') + '</span>';
        } else if (opts.dc) {
            // Debit/Credit display
            inner = '<span class="dc-' + esc(value) + '">'
                + esc(value === 'D' ? 'D (Debit)' : value === 'C' ? 'C (Credit)' : (value || '—'))
                + '</span>';
        } else if (opts.err) {
            inner = '<div class="ew-val err">' + esc(value || '') + '</div>';
        } else {
            var valCls = ['ew-val'];
            if (opts.muted) valCls.push('muted');
            if (opts.mono) valCls.push('mono');
            if (opts.bold) valCls.push('bold');
            inner = '<div class="' + valCls.join(' ') + '">' + esc(value != null ? String(value) : '—') + '</div>';
        }

        return '<div class="' + cls + '"><label>' + esc(label) + '</label>' + inner + '</div>';
    }

    // -- Section rendering --

    /**
     * Render a collapsible section.
     * @param {string} title - Section title
     * @param {number} num - Section number (1-8)
     * @param {string} content - HTML content for the section body
     * @param {boolean} defaultExpanded - Whether section is expanded by default
     */
    function renderSection(title, num, content, defaultExpanded) {
        var display = defaultExpanded ? 'block' : 'none';
        var arrow = defaultExpanded ? '\u25BE' : '\u25B8';

        return '<div class="ew-f-section">'
            + '<button class="ew-f-section-hdr" onclick="EW_toggleSection(this)">'
            + '<span class="ew-sec-num">\u00A7' + num + '</span>'
            + '<span class="ew-sec-title">' + esc(title) + '</span>'
            + '<span class="ew-sec-toggle">' + arrow + '</span>'
            + '</button>'
            + '<div class="ew-f-section-body" style="display:' + display + '">'
            + content
            + '</div></div>';
    }

    // -- Panel rendering --

    function renderPanel(record) {
        var r = record;
        var h = '';

        // Header
        h += '<div class="ew-slide-hdr">'
            + '<div>'
            + '<div class="ew-slide-meta">Enrichment Record</div>'
            + '<h2>' + esc(r.id) + '</h2>'
            + '</div>'
            + '<div class="ew-slide-hdr-right">'
            + '<span class="st-' + esc(r.status) + '">' + esc(r.status || '') + '</span>'
            + '<button class="ew-slide-close" onclick="EW.detail.close()">\u00D7</button>'
            + '</div></div>';

        // Body
        var body = '';

        // Section 1: Traceability — hide if superseded or confirmed
        var showTraceability = r.status !== 'superseded' && r.status !== 'confirmed';
        if (showTraceability) {
            body += renderSection('Traceability', 1,
                '<div class="ew-f-row">'
                + renderField('Source Type', r.source_tp)
                + renderField('Source Trx ID', r.source_trx_id, { muted: true })
                + renderField('Statement', r.statement_id, { muted: true })
                + '</div>',
                true);
        }

        // Section 2: Lineage — show if origin != pipeline
        var showLineage = r.origin && r.origin !== 'pipeline';
        if (showLineage) {
            body += renderSection('Lineage', 2,
                '<div class="ew-f-row">'
                + renderField('Origin', r.origin)
                + renderField('Parent ID', r.parent_enrichment_id, { muted: true })
                + renderField('Group', r.group_id, { muted: true, mono: true })
                + renderField('Seq', r.split_sequence, { muted: true })
                + '</div>'
                + '<div class="ew-f-row">'
                + renderField('Lineage Note', r.lineage_note, { wide: true })
                + '</div>',
                false);
        }

        // Section 3: Transaction Core — always visible, expanded
        body += renderSection('Transaction Core', 3,
            '<div class="ew-f-row">'
            + renderField('Transaction Date', r.transaction_date)
            + renderField('Settlement Date', r.settlement_date)
            + renderField('D/C', r.debit_credit, { dc: true })
            + '</div>'
            + '<div class="ew-f-row">'
            + renderField('Amount', fmtAmt(r.original_amount), { mono: true })
            + renderField('Fee', fmtAmt(r.fee_amount), { mono: true })
            + renderField('Total', fmtAmt(r.total_amount), { mono: true, bold: true })
            + '</div>'
            + '<div class="ew-f-row">'
            + renderField('Source Currency', r.original_currency)
            + '</div>'
            + '<div class="ew-f-row">'
            + renderField('Description', r.description, { wide: true })
            + '</div>',
            true);

        // Section 4: Classification — always visible, expanded
        body += renderSection('Classification', 4,
            '<div class="ew-f-row">'
            + renderField('Internal Type', r.internal_type)
            + renderField('Confidence', r.type_confidence, { badge: true })
            + renderField('Matched Rule', r.matched_rule_id, { muted: true })
            + '</div>',
            true);

        // Section 5: Currency & FX — always visible, collapsed
        body += renderSection('Currency & FX', 5,
            '<div class="ew-f-row">'
            + renderField('Validated Currency', r.validated_currency)
            + renderField('FX Rate to EUR', r.fx_rate_to_eur, { mono: true })
            + renderField('Rate Date', r.fx_rate_date)
            + '</div>'
            + '<div class="ew-f-row">'
            + renderField('Rate Source', r.fx_rate_source)
            + renderField('EUR Amount', fmtAmt(r.base_amount_eur), { mono: true })
            + renderField('EUR Parallel', r.requires_eur_parallel)
            + '</div>',
            false);

        // Section 6: Resolved Entities — always visible, collapsed
        body += renderSection('Resolved Entities', 6,
            '<div class="ew-f-row">'
            + renderField('Customer ID', r.resolved_customer_id)
            + renderField('Customer Code', r.customer_code)
            + renderField('Match Method', r.customer_match_method, { muted: true })
            + '</div>'
            + '<div class="ew-f-row">'
            + renderField('Asset ID', r.resolved_asset_id)
            + renderField('ISIN', r.asset_isin)
            + renderField('Asset Category', r.asset_category)
            + '</div>'
            + '<div class="ew-f-row">'
            + renderField('Counterparty ID', r.counterparty_id)
            + renderField('CP Code', r.counterparty_short_code)
            + renderField('CP Source', r.counterparty_source, { muted: true })
            + '</div>',
            false);

        // Section 7: Fee & Pairing — show if has_fee=Y or status=paired
        var showFee = r.has_fee === 'Y' || r.status === 'paired';
        if (showFee) {
            body += renderSection('Fee & Pairing', 7,
                '<div class="ew-f-row">'
                + renderField('Has Fee', r.has_fee)
                + renderField('Fee Trx ID', r.fee_trx_id, { muted: true })
                + renderField('Pair ID', r.pair_id, { muted: true })
                + '</div>',
                false);
        }

        // Section 8: Status & Notes — always visible, expanded
        var s8 = '<div class="ew-f-row">'
            + renderField('Status', r.status, { badge: true })
            + renderField('Enrichment Time', r.enrichment_timestamp, { muted: true })
            + renderField('Version', r.version, { muted: true })
            + '</div>';
        if (r.status === 'error' && r.error_message) {
            s8 += '<div class="ew-f-row">'
                + renderField('Error Message', r.error_message, { wide: true, err: true })
                + '</div>';
        }
        s8 += '<div class="ew-f-row">'
            + renderField('Processing Notes', r.processing_notes, { wide: true })
            + '</div>';
        body += renderSection('Status & Notes', 8, s8, true);

        h += '<div class="ew-slide-body">' + body + '</div>';

        // Footer — close button only (read-only phase)
        h += '<div class="ew-slide-footer">'
            + '<button class="ew-btn" onclick="EW.detail.close()">Close</button>'
            + '</div>';

        return h;
    }

    // -- Public API --

    /**
     * Open the detail slide-over for a record.
     * @param {string} recordId - The record ID to fetch and display
     * @param {Object} [record] - Pre-loaded record object (avoids API call)
     */
    EW.detail.open = function(recordId, record) {
        var container = document.getElementById('ew-slide-container');
        if (!container) return;

        // Use provided record directly (passed from table row click)
        if (record) {
            container.innerHTML = '<div class="ew-slide-over">'
                + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
                + '<div class="ew-slide-panel">'
                + renderPanel(record)
                + '</div></div>';
            return;
        }

        // Fallback: fetch from API (for deep links, cross-tab navigation)
        container.innerHTML = '<div class="ew-slide-over">'
            + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
            + '<div class="ew-slide-panel">'
            + '<div class="ew-slide-loading"><i class="fas fa-spinner fa-spin"></i> Loading record...</div>'
            + '</div></div>';

        EW.api.fetchRecord(recordId)
            .then(function(record) {
                container.innerHTML = '<div class="ew-slide-over">'
                    + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
                    + '<div class="ew-slide-panel">'
                    + renderPanel(record)
                    + '</div></div>';
            })
            .catch(function(e) {
                container.innerHTML = '<div class="ew-slide-over">'
                    + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
                    + '<div class="ew-slide-panel">'
                    + '<div class="ew-slide-hdr">'
                    + '<div><div class="ew-slide-meta">Enrichment Record</div><h2>Error</h2></div>'
                    + '<div class="ew-slide-hdr-right">'
                    + '<button class="ew-slide-close" onclick="EW.detail.close()">\u00D7</button>'
                    + '</div></div>'
                    + '<div class="ew-slide-body">'
                    + '<div style="padding:32px;text-align:center;color:#dc2626;">'
                    + '<i class="fas fa-exclamation-triangle"></i> Failed to load record: ' + esc(e.message)
                    + '</div></div>'
                    + '<div class="ew-slide-footer">'
                    + '<button class="ew-btn" onclick="EW.detail.close()">Close</button>'
                    + '</div></div></div>';
            });
    };

    /**
     * Close the detail slide-over.
     */
    EW.detail.close = function() {
        var container = document.getElementById('ew-slide-container');
        if (container) container.innerHTML = '';
    };

    // -- Global helper for section toggle (needed for onclick in dynamic HTML) --
    window.EW_toggleSection = function(btn) {
        var body = btn.nextElementSibling;
        var toggle = btn.querySelector('.ew-sec-toggle');
        if (body.style.display === 'none') {
            body.style.display = 'block';
            if (toggle) toggle.textContent = '\u25BE';
        } else {
            body.style.display = 'none';
            if (toggle) toggle.textContent = '\u25B8';
        }
    };

})(window.EW || (window.EW = {}));
