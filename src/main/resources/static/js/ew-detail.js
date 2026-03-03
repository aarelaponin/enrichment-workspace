/**
 * ew-detail.js — detail slide-over panel with inline editing.
 *
 * Opens when clicking a table row. Shows all record fields in 8 collapsible sections.
 * Fields are editable when the record's status allows it, driven by the FIELDS config.
 */
(function(EW) {
    'use strict';

    // ── Field configuration ──────────────────────────────────────────────────

    /**
     * Editable field definitions. Each key is a record field ID.
     * Fields not listed here are always read-only.
     */
    var FIELDS = {
        // Section 3: Transaction Core
        transaction_date:      { type: 'date',     label: 'Transaction Date',    required: true },
        settlement_date:       { type: 'date',     label: 'Settlement Date',     required: true },
        debit_credit:          { type: 'select',   label: 'D/C',                 required: true,
            options: [['D','D (Debit)'],['C','C (Credit)']] },
        original_amount:       { type: 'decimal',  label: 'Amount',              required: true },
        fee_amount:            { type: 'decimal',  label: 'Fee' },
        total_amount:          { type: 'decimal',  label: 'Total',               required: true },
        description:           { type: 'textarea', label: 'Description',         maxlen: 500 },
        // Section 4: Classification
        internal_type:         { type: 'select',   label: 'Internal Type',       required: true,
            options: [['SEC_BUY','SEC_BUY'],['SEC_SELL','SEC_SELL'],
                      ['BOND_BUY','BOND_BUY'],['BOND_COUPON','BOND_COUPON'],
                      ['DIV_INCOME','DIV_INCOME'],['CASH_IN_OUT','CASH_IN_OUT'],
                      ['FX_EXCHANGE','FX_EXCHANGE'],['COMMISSION','COMMISSION']] },
        // Section 5: Currency & FX
        validated_currency:    { type: 'text',     label: 'Validated Currency',  required: true },
        fx_rate_to_eur:        { type: 'decimal',  label: 'FX Rate to EUR' },
        fx_rate_date:          { type: 'date',     label: 'Rate Date' },
        fx_rate_source:        { type: 'select',   label: 'Rate Source',
            options: [['ecb','ECB'],['bloomberg','Bloomberg'],
                      ['manual_override','Manual Override'],['other','Other']] },
        requires_eur_parallel: { type: 'select',   label: 'EUR Parallel',
            options: [['yes','Yes'],['no','No']] },
        // Section 6: Resolved Entities
        resolved_customer_id:  { type: 'text',     label: 'Customer ID',         required: true },
        customer_code:         { type: 'text',     label: 'Customer Code' },
        resolved_asset_id:     { type: 'text',     label: 'Asset ID' },
        asset_category:        { type: 'select',   label: 'Asset Category',
            options: [['EQ','Equity'],['FI','Fixed Income'],['CE','Cash Equiv']] },
        counterparty_id:       { type: 'text',     label: 'Counterparty ID' },
        counterparty_short_code: { type: 'text',   label: 'CP Code' },
        has_fee:               { type: 'select',   label: 'Has Fee',
            options: [['yes','Yes'],['no','No']] },
        // Section 2: Lineage
        lineage_note:          { type: 'textarea', label: 'Lineage Note',        maxlen: 500 },
        // Section 8: Status & Notes
        processing_notes:      { type: 'textarea', label: 'Processing Notes',    maxlen: 1000, alwaysEditable: true }
    };

    /** Statuses that allow editing. */
    var EDITABLE_STATUSES = {
        enriched: true, error: true, manual_review: true, in_review: true,
        adjusted: true, ready: true, paired: true, processing: true
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

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

    /** Check if a status allows editing. */
    function isEditable(status) {
        return EDITABLE_STATUSES[status] === true;
    }

    // ── Read-only field rendering ────────────────────────────────────────────

    /**
     * Render a single read-only field display.
     * @param {string} label - Field label
     * @param {*} value - Field value
     * @param {Object} [opts] - Options: {muted, badge, dc, err, mono, bold, wide}
     */
    function renderField(label, value, opts) {
        opts = opts || {};
        var cls = opts.wide ? 'ew-f-field wide' : 'ew-f-field';
        var inner;

        if (opts.badge) {
            inner = '<span class="st-' + esc(value) + '">' + esc(value || '\u2014') + '</span>';
        } else if (opts.dc) {
            inner = '<span class="dc-' + esc(value) + '">'
                + esc(value === 'D' ? 'D (Debit)' : value === 'C' ? 'C (Credit)' : (value || '\u2014'))
                + '</span>';
        } else if (opts.err) {
            inner = '<div class="ew-val err">' + esc(value || '') + '</div>';
        } else {
            var valCls = ['ew-val'];
            if (opts.muted) valCls.push('muted');
            if (opts.mono) valCls.push('mono');
            if (opts.bold) valCls.push('bold');
            inner = '<div class="' + valCls.join(' ') + '">' + esc(value != null ? String(value) : '\u2014') + '</div>';
        }

        return '<div class="' + cls + '"><label>' + esc(label) + '</label>' + inner + '</div>';
    }

    // ── Edit field rendering ─────────────────────────────────────────────────

    /**
     * Render an editable field.
     * @param {string} fieldId - The record field key
     * @param {*} value - Current value
     * @param {Object} cfg - FIELDS config entry
     * @param {boolean} wide - Whether this is a wide field
     */
    function renderEditField(fieldId, value, cfg, wide) {
        var cls = wide ? 'ew-f-field wide' : 'ew-f-field';
        var val = (value != null && value !== undefined) ? String(value) : '';
        var reqCls = (cfg.required && !val) ? ' ew-edit-required' : '';
        var inner;

        switch (cfg.type) {
            case 'select':
                inner = '<select class="ew-edit-select' + reqCls + '" name="' + esc(fieldId) + '">';
                inner += '<option value="">\u2014</option>';
                if (cfg.options) {
                    for (var i = 0; i < cfg.options.length; i++) {
                        var opt = cfg.options[i];
                        var sel = (val === opt[0]) ? ' selected' : '';
                        inner += '<option value="' + esc(opt[0]) + '"' + sel + '>' + esc(opt[1]) + '</option>';
                    }
                }
                inner += '</select>';
                break;
            case 'textarea':
                var maxlen = cfg.maxlen ? ' maxlength="' + cfg.maxlen + '"' : '';
                inner = '<textarea class="ew-edit-textarea' + reqCls + '" name="' + esc(fieldId) + '"'
                    + maxlen + '>' + esc(val) + '</textarea>';
                break;
            case 'date':
                inner = '<input type="date" class="ew-edit-input' + reqCls + '" name="' + esc(fieldId)
                    + '" value="' + esc(val) + '" />';
                break;
            case 'decimal':
                inner = '<input type="number" step="any" class="ew-edit-input' + reqCls + '" name="'
                    + esc(fieldId) + '" value="' + esc(val) + '" />';
                break;
            default: // text
                inner = '<input type="text" class="ew-edit-input' + reqCls + '" name="' + esc(fieldId)
                    + '" value="' + esc(val) + '" />';
                break;
        }

        return '<div class="' + cls + '"><label>' + esc(cfg.label) + '</label>' + inner + '</div>';
    }

    /**
     * Render a field — editable or read-only depending on edit mode and field config.
     * @param {string} fieldId - Record field key
     * @param {*} value - Current value
     * @param {boolean} editMode - Whether the panel is in edit mode
     * @param {Object} [readOnlyOpts] - Options for read-only rendering
     * @param {boolean} [wide] - Wide field
     */
    function renderFieldAuto(fieldId, value, editMode, readOnlyOpts, wide) {
        var cfg = FIELDS[fieldId];
        if (editMode && cfg) {
            return renderEditField(fieldId, value, cfg, wide);
        }
        // Not editable or no config — render read-only
        var label = cfg ? cfg.label : fieldId;
        var opts = readOnlyOpts || {};
        if (wide) opts.wide = true;
        return renderField(label, value, opts);
    }

    // ── Section rendering ────────────────────────────────────────────────────

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

    // ── Panel rendering ──────────────────────────────────────────────────────

    function renderPanel(record) {
        var r = record;
        var edit = isEditable(r.status);
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

        // Section 1: Traceability — always read-only, hide if superseded or confirmed
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
                + renderFieldAuto('lineage_note', r.lineage_note, edit, null, true)
                + '</div>',
                false);
        }

        // Section 3: Transaction Core — always visible, expanded
        body += renderSection('Transaction Core', 3,
            '<div class="ew-f-row">'
            + renderFieldAuto('transaction_date', r.transaction_date, edit)
            + renderFieldAuto('settlement_date', r.settlement_date, edit)
            + renderFieldAuto('debit_credit', r.debit_credit, edit, { dc: !edit })
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('original_amount', r.original_amount, edit, { mono: true })
            + renderFieldAuto('fee_amount', r.fee_amount, edit, { mono: true })
            + renderFieldAuto('total_amount', r.total_amount, edit, { mono: true, bold: true })
            + '</div>'
            + '<div class="ew-f-row">'
            + renderField('Source Currency', r.original_currency)
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('description', r.description, edit, null, true)
            + '</div>',
            true);

        // Section 4: Classification — always visible, expanded
        body += renderSection('Classification', 4,
            '<div class="ew-f-row">'
            + renderFieldAuto('internal_type', r.internal_type, edit)
            + renderField('Confidence', r.type_confidence, { badge: true })
            + renderField('Matched Rule', r.matched_rule_id, { muted: true })
            + '</div>',
            true);

        // Section 5: Currency & FX — always visible, collapsed
        body += renderSection('Currency & FX', 5,
            '<div class="ew-f-row">'
            + renderFieldAuto('validated_currency', r.validated_currency, edit)
            + renderFieldAuto('fx_rate_to_eur', r.fx_rate_to_eur, edit, { mono: true })
            + renderFieldAuto('fx_rate_date', r.fx_rate_date, edit)
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('fx_rate_source', r.fx_rate_source, edit)
            + renderField('EUR Amount', fmtAmt(r.base_amount_eur), { mono: true })
            + renderFieldAuto('requires_eur_parallel', r.requires_eur_parallel, edit)
            + '</div>',
            false);

        // Section 6: Resolved Entities — always visible, collapsed
        body += renderSection('Resolved Entities', 6,
            '<div class="ew-f-row">'
            + renderFieldAuto('resolved_customer_id', r.resolved_customer_id, edit)
            + renderFieldAuto('customer_code', r.customer_code, edit)
            + renderField('Match Method', r.customer_match_method, { muted: true })
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('resolved_asset_id', r.resolved_asset_id, edit)
            + renderField('ISIN', r.asset_isin)
            + renderFieldAuto('asset_category', r.asset_category, edit)
            + '</div>'
            + '<div class="ew-f-row">'
            + renderFieldAuto('counterparty_id', r.counterparty_id, edit)
            + renderFieldAuto('counterparty_short_code', r.counterparty_short_code, edit)
            + renderField('CP Source', r.counterparty_source, { muted: true })
            + '</div>',
            false);

        // Section 7: Fee & Pairing — show if has_fee=Y or status=paired
        var showFee = r.has_fee === 'Y' || r.status === 'paired';
        if (showFee) {
            body += renderSection('Fee & Pairing', 7,
                '<div class="ew-f-row">'
                + renderFieldAuto('has_fee', r.has_fee, edit)
                + renderField('Fee Trx ID', r.fee_trx_id, { muted: true })
                + renderField('Pair ID', r.pair_id, { muted: true })
                + '</div>',
                false);
        }

        // Section 8: Status & Notes — always visible, expanded
        // processing_notes is always editable (alwaysEditable flag)
        var notesEditable = edit || (FIELDS.processing_notes && FIELDS.processing_notes.alwaysEditable);
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
            + renderFieldAuto('processing_notes', r.processing_notes, notesEditable, null, true)
            + '</div>';
        body += renderSection('Status & Notes', 8, s8, true);

        h += '<div class="ew-slide-body">' + body + '</div>';

        // Footer
        if (edit || notesEditable) {
            h += '<div class="ew-slide-footer">'
                + '<button class="ew-btn-cancel" onclick="EW.detail.close()">Cancel</button>'
                + '<button class="ew-btn-save" onclick="EW_saveRecord()">Save</button>'
                + '</div>';
        } else {
            h += '<div class="ew-slide-footer">'
                + '<button class="ew-btn" onclick="EW.detail.close()">Close</button>'
                + '</div>';
        }

        return h;
    }

    // ── Form data collection ─────────────────────────────────────────────────

    /**
     * Collect all edited field values from the DOM and diff against original record.
     * Returns { id, version, ...changedFields } or null if nothing changed.
     */
    function collectFormData(record) {
        var panel = document.querySelector('.ew-slide-panel');
        if (!panel) return null;

        var changed = {};
        var hasChanges = false;

        // Query all named inputs in the panel
        var inputs = panel.querySelectorAll('[name]');
        for (var i = 0; i < inputs.length; i++) {
            var el = inputs[i];
            var fieldId = el.getAttribute('name');
            var newVal = el.value;
            var origVal = (record[fieldId] != null && record[fieldId] !== undefined)
                ? String(record[fieldId]) : '';

            if (newVal !== origVal) {
                changed[fieldId] = newVal;
                hasChanges = true;
            }
        }

        if (!hasChanges) return null;

        changed.version = record.version;
        return changed;
    }

    // ── Current record reference for save ────────────────────────────────────

    var currentRecord = null;

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Open the detail slide-over for a record.
     * @param {string} recordId - The record ID to fetch and display
     * @param {Object} [record] - Pre-loaded record object (avoids API call)
     */
    EW.detail.open = function(recordId, record) {
        var container = document.getElementById('ew-slide-container');
        if (!container) return;

        if (record) {
            currentRecord = record;
            container.innerHTML = '<div class="ew-slide-over">'
                + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
                + '<div class="ew-slide-panel">'
                + renderPanel(record)
                + '</div></div>';
            return;
        }

        // Fallback: fetch from API
        container.innerHTML = '<div class="ew-slide-over">'
            + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
            + '<div class="ew-slide-panel">'
            + '<div class="ew-slide-loading"><i class="fas fa-spinner fa-spin"></i> Loading record...</div>'
            + '</div></div>';

        EW.api.fetchRecord(recordId)
            .then(function(rec) {
                currentRecord = rec;
                container.innerHTML = '<div class="ew-slide-over">'
                    + '<div class="ew-slide-bg" onclick="EW.detail.close()"></div>'
                    + '<div class="ew-slide-panel">'
                    + renderPanel(rec)
                    + '</div></div>';
            })
            .catch(function(e) {
                currentRecord = null;
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
        currentRecord = null;
    };

    // ── Save handler ─────────────────────────────────────────────────────────

    window.EW_saveRecord = function() {
        if (!currentRecord) return;

        var data = collectFormData(currentRecord);
        if (!data) {
            EW.toast.show('No changes to save', 'info');
            return;
        }

        // Disable save button to prevent double-click
        var saveBtn = document.querySelector('.ew-btn-save');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        var recordId = currentRecord.id;

        EW.api.saveRecord(recordId, data)
            .then(function(updated) {
                EW.toast.show('Record saved successfully', 'success');

                // Update cache
                if (EW.state.records) {
                    EW.state.records[recordId] = updated;
                }

                // Refresh table and close panel
                EW.detail.close();
                EW.table.load();
            })
            .catch(function(e) {
                // Re-enable save button
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                }

                if (e.status === 409) {
                    // Version conflict — reload panel with fresh data
                    EW.toast.show('Record modified by another user \u2014 reloading', 'error');
                    EW.api.fetchRecord(recordId)
                        .then(function(fresh) {
                            if (EW.state.records) {
                                EW.state.records[recordId] = fresh;
                            }
                            EW.detail.open(recordId, fresh);
                        })
                        .catch(function() {
                            EW.detail.close();
                        });
                } else {
                    EW.toast.show(e.message || 'Failed to save record', 'error');
                }
            });
    };

    // ── Global helper for section toggle ──────────────────────────────────────

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
