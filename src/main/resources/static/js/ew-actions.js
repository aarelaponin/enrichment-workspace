/**
 * ew-actions.js — toolbar button handlers and selection management.
 *
 * All action buttons are stubs in Phase 2 — they log + toast "Not yet implemented".
 * Actual logic wired in Phase 5 (confirm, split/merge, reprocess, delete).
 */
(function(EW) {
    'use strict';

    EW.actions = {};

    // ── Editable status check ──────────────────────────────────────────────

    var EDITABLE_STATUSES_SET = { enriched: 1, adjusted: 1, in_review: 1, ready: 1, paired: 1 };
    function isEditableSel(s) { return EDITABLE_STATUSES_SET[s.status] === 1; }

    // ── Trade allocation constants ───────────────────────────────────────────
    var ALLOC_TYPES = ['EQ_BUY','EQ_SELL','BOND_BUY','BOND_SELL','SEC_BUY','SEC_SELL'];
    var ALLOC_ELIGIBLE = ['enriched','adjusted','in_review','ready','paired'];
    var INCOME_ALLOC_TYPES = ['DIV_INCOME', 'DIV_TAX', 'BOND_INT'];

    // ── Loan/Fund helpers ───────────────────────────────────────────────────

    function isLoanTypeSel(sel) {
        if (sel.length !== 1) return false;
        var r = EW.state.records && EW.state.records[sel[0].id];
        if (!r) return false;
        var TY = EW.dashboard && EW.dashboard.TY_CAT;
        return TY && TY[r.internal_type] === 'loan';
    }

    function isFundSel(sel) {
        if (sel.length !== 1) return false;
        var r = EW.state.records && EW.state.records[sel[0].id];
        if (!r) return false;
        var TY = EW.dashboard && EW.dashboard.TY_CAT;
        return r.customer_code === '12345678'
            || (EW.dashboard && EW.dashboard.isFundTrx && EW.dashboard.isFundTrx(r))
            || (TY && TY[r.internal_type] === 'sec');
    }

    // ── v2 Toolbar definitions ───────────────────────────────────────────────

    var TOOLBAR_WORKSPACE = {
        items: [
            { id: 'confirmForPosting', label: 'Confirm', icon: 'fas fa-check', cls: 'primary',
                enabled: function(sel) { return sel.some(function(s) { return s.status === 'ready'; }); } },
            { id: 'markReady', label: 'Mark Ready', icon: 'fas fa-arrow-right',
                enabled: function(sel) { return sel.some(function(s) { return ['enriched','adjusted','in_review','paired'].indexOf(s.status) >= 0; }); } },
            { type: 'separator' },
            { id: 'splitDropdown', label: 'Split \u25BE', icon: 'fas fa-code-branch', dropdown: 'split',
                enabled: function(sel) { return sel.length === 1 && isEditableSel(sel[0]); } },
            { id: 'mergeRecords', label: 'Merge', icon: 'fas fa-compress',
                enabled: function(sel) { return sel.length >= 2 && sel.every(function(s) { return ['enriched','adjusted','in_review'].indexOf(s.status) >= 0; }); } },
            { type: 'separator' },
            { id: 'opsDropdown', label: 'Operations \u25BE', icon: 'fas fa-bolt', dropdown: 'ops',
                enabled: function(sel) { return sel.length === 1 && isEditableSel(sel[0]); } },
            { type: 'separator' },
            { id: 'reprocess', label: 'Reprocess', icon: 'fas fa-redo',
                enabled: function(sel) { return sel.some(function(s) { return ['error','manual_review','new','processing'].indexOf(s.status) >= 0; }); } },
            { id: 'deleteRecord', label: 'Delete', icon: 'fas fa-trash', cls: 'danger',
                enabled: function(sel) { return sel.some(function(s) { return ['new','error','manual_review'].indexOf(s.status) >= 0; }); } },
            { type: 'spacer' },
            { id: 'newManual', label: 'New Entry', icon: 'fas fa-plus',
                enabled: function() { return true; } },
            { id: 'exportCSV', label: 'Export', icon: 'fas fa-download',
                enabled: function() { return true; } }
        ],
        dropdowns: {
            split: [
                { id: 'splitRecord', icon: 'fas fa-code-branch', label: 'Generic Split' },
                { id: 'loanPaymentSplit', icon: 'fas fa-university', label: 'Loan Payment Split', needsLoan: true },
                { id: 'multiPeriodAccrual', icon: 'fas fa-calendar-alt', label: 'Multi-Period Accrual', stub: true },
                { id: 'feeDisaggregation', icon: 'fas fa-receipt', label: 'Fee Disaggregation', stub: true }
            ],
            ops: [
                { id: 'reclassify', icon: 'fas fa-tag', label: 'Reclassify Type' },
                { id: 'reassign', icon: 'fas fa-user-edit', label: 'Reassign Customer' },
                { id: 'flipDC', icon: 'fas fa-exchange-alt', label: 'Flip D/C' },
                { type: 'separator' },
                { id: 'fxOverride', icon: 'fas fa-euro-sign', label: 'FX Override' },
                { type: 'separator' },
                { id: 'linkLoan', icon: 'fas fa-link', label: 'Link Loan Contract', needsLoan: true },
                { id: 'allocFund', icon: 'fas fa-chart-pie', label: 'Allocate to Investors', needsFund: true },
                { id: 'pairFX', icon: 'fas fa-arrows-alt-h', label: 'Pair FX Legs', stub: true },
                { id: 'linkFee', icon: 'fas fa-receipt', label: 'Link Fee', stub: true },
                { id: 'linkTax', icon: 'fas fa-file-invoice', label: 'Link Tax Withholding', stub: true }
            ]
        }
    };

    var TOOLBAR_READY = {
        items: [
            { id: 'confirmForPosting', label: 'Confirm', icon: 'fas fa-check', cls: 'primary',
                enabled: function(sel) { return sel.length > 0; } },
            { id: 'returnToWorkspace', label: 'Return to Editing', icon: 'fas fa-undo',
                enabled: function(sel) { return sel.length > 0; } }
        ]
    };

    var TOOLBARS = {
        workspace: TOOLBAR_WORKSPACE,
        ready: TOOLBAR_READY
    };

    // ── Selection helpers ───────────────────────────────────────────────────

    /** Get selected records as array of {id, status}. */
    EW.actions.getSelectedRecords = function() {
        var result = [];
        var checks = document.querySelectorAll('.ew-row-check:checked');
        for (var i = 0; i < checks.length; i++) {
            var tr = checks[i].closest('tr');
            if (tr) {
                result.push({
                    id: tr.getAttribute('data-id'),
                    status: tr.getAttribute('data-status')
                });
            }
        }
        return result;
    };

    /** Update selection count badge. */
    function updateSelectionCount() {
        var badge = document.getElementById('ew-selection-count');
        var count = EW.state.selectedIds.length;
        if (badge) {
            if (count > 0) {
                badge.textContent = count + ' selected';
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    /** Sync selectedIds from DOM checkboxes. */
    EW.actions.syncSelection = function() {
        var checks = document.querySelectorAll('.ew-row-check:checked');
        var ids = [];
        for (var i = 0; i < checks.length; i++) {
            ids.push(checks[i].value);
        }
        EW.state.selectedIds = ids;
        updateSelectionCount();
        EW.actions.updateToolbar();
    };

    // ── Active dropdown tracking ────────────────────────────────────────────

    var activeDropdown = null;

    function closeAllDropdowns() {
        var dds = document.querySelectorAll('.ew-tb-dropdown.open');
        for (var i = 0; i < dds.length; i++) dds[i].classList.remove('open');
        activeDropdown = null;
    }

    function toggleDropdown(ddId) {
        var dd = document.getElementById(ddId);
        if (!dd) return;
        if (dd.classList.contains('open')) {
            dd.classList.remove('open');
            activeDropdown = null;
        } else {
            closeAllDropdowns();
            dd.classList.add('open');
            activeDropdown = ddId;
        }
    }

    // Close dropdowns on outside click
    document.addEventListener('click', function(e) {
        if (activeDropdown && !e.target.closest('.ew-tb-group')) {
            closeAllDropdowns();
        }
    });

    // ── Toolbar rendering ───────────────────────────────────────────────────

    /** Render toolbar buttons for the current view. */
    EW.actions.renderToolbar = function() {
        var container = document.getElementById('ew-toolbar');
        if (!container) return;

        var view = EW.nav.current();
        var toolbarDef = TOOLBARS[view.id];

        if (!toolbarDef || !view.hasToolbar) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'flex';

        var items = toolbarDef.items;
        var dropdowns = toolbarDef.dropdowns || {};
        var selected = EW.actions.getSelectedRecords();

        var html = '';

        // Selection count pill — first element in toolbar
        var selCount = EW.state.selectedIds.length;
        html += '<span class="ew-selection-pill" id="ew-selection-count"'
            + (selCount > 0 ? '' : ' style="display:none"')
            + '>' + selCount + ' selected</span>';

        for (var i = 0; i < items.length; i++) {
            var btn = items[i];
            if (btn.type === 'separator') {
                html += '<span class="ew-toolbar-sep"></span>';
            } else if (btn.type === 'spacer') {
                html += '<span class="ew-toolbar-spacer"></span>';
            } else if (btn.dropdown) {
                // Button with dropdown
                var ddEnabled = btn.enabled ? btn.enabled(selected) : true;
                var ddItems = dropdowns[btn.dropdown] || [];
                html += '<div class="ew-tb-group">';
                html += '<button class="ew-toolbar-btn' + (btn.cls ? ' ' + btn.cls : '') + '" id="ew-action-' + btn.id + '"'
                    + ' data-dropdown="ew-dd-' + btn.dropdown + '"'
                    + (ddEnabled ? '' : ' disabled')
                    + '><i class="' + btn.icon + '"></i> ' + btn.label + '</button>';
                html += '<div class="ew-tb-dropdown" id="ew-dd-' + btn.dropdown + '">';
                for (var d = 0; d < ddItems.length; d++) {
                    var dd = ddItems[d];
                    if (dd.type === 'separator') {
                        html += '<div class="ew-dd-sep"></div>';
                    } else {
                        var ddDisabled = dd.stub ||
                            (dd.needsLoan && !isLoanTypeSel(selected)) ||
                            (dd.needsFund && !isFundSel(selected));
                        html += '<button class="ew-dd-item' + (ddDisabled ? ' disabled' : '') + '"'
                            + ' data-action="' + dd.id + '"'
                            + (ddDisabled ? ' disabled' : '')
                            + '><span class="ew-dd-ic"><i class="' + dd.icon + '"></i></span> ' + dd.label + '</button>';
                    }
                }
                html += '</div></div>';
            } else {
                var enabled = btn.enabled ? btn.enabled(selected) : true;
                html += '<button class="ew-toolbar-btn' + (btn.cls ? ' ' + btn.cls : '') + '" id="ew-action-' + btn.id + '" data-action="' + btn.id + '"'
                    + (enabled ? '' : ' disabled')
                    + '><i class="' + btn.icon + '"></i> ' + btn.label + '</button>';
            }
        }

        container.innerHTML = html;

        // Bind click handlers for action buttons
        var actionBtns = container.querySelectorAll('.ew-toolbar-btn[data-action]');
        for (var j = 0; j < actionBtns.length; j++) {
            actionBtns[j].addEventListener('click', function() {
                var action = this.getAttribute('data-action');
                EW.actions.execute(action);
            });
        }

        // Bind dropdown toggle buttons
        var ddBtns = container.querySelectorAll('.ew-toolbar-btn[data-dropdown]');
        for (var k = 0; k < ddBtns.length; k++) {
            ddBtns[k].addEventListener('click', function(e) {
                e.stopPropagation();
                var ddId = this.getAttribute('data-dropdown');
                toggleDropdown(ddId);
            });
        }

        // Bind dropdown item clicks (bind to ALL items, check disabled at click time)
        var ddItemBtns = container.querySelectorAll('.ew-dd-item');
        for (var m = 0; m < ddItemBtns.length; m++) {
            ddItemBtns[m].addEventListener('click', function() {
                if (this.disabled || this.classList.contains('disabled')) return;
                var action = this.getAttribute('data-action');
                closeAllDropdowns();
                EW.actions.execute(action);
            });
        }
    };

    /** Enable/disable toolbar buttons based on current selection. */
    EW.actions.updateToolbar = function() {
        var view = EW.nav.current();
        var toolbarDef = TOOLBARS[view.id];
        if (!toolbarDef) return;

        var selected = EW.actions.getSelectedRecords();
        var items = toolbarDef.items;

        for (var i = 0; i < items.length; i++) {
            var btn = items[i];
            if (!btn.id || !btn.enabled) continue;
            var el = document.getElementById('ew-action-' + btn.id);
            if (el) {
                el.disabled = !btn.enabled(selected);
            }
        }

        // Update dropdown item states
        var dropdowns = toolbarDef.dropdowns || {};
        for (var ddKey in dropdowns) {
            if (!dropdowns.hasOwnProperty(ddKey)) continue;
            var ddItems = dropdowns[ddKey];
            for (var d = 0; d < ddItems.length; d++) {
                var dd = ddItems[d];
                if (!dd.id) continue;
                var ddEl = document.querySelector('.ew-dd-item[data-action="' + dd.id + '"]');
                if (ddEl) {
                    var ddDisabled = dd.stub ||
                        (dd.needsLoan && !isLoanTypeSel(selected)) ||
                        (dd.needsFund && !isFundSel(selected));
                    ddEl.disabled = ddDisabled;
                    if (ddDisabled) ddEl.classList.add('disabled');
                    else ddEl.classList.remove('disabled');
                }
            }
        }
    };

    // ── Status eligibility maps ──────────────────────────────────────────────

    var ELIGIBLE_STATUSES = {
        markReady:          ['enriched', 'adjusted', 'in_review', 'paired'],
        reprocess:          ['error', 'manual_review', 'new', 'processing'],
        returnToWorkspace:  ['ready']
    };

    var TARGET_STATUS = {
        markReady:          'ready',
        returnToWorkspace:  'enriched'
    };

    // Reprocess advances records toward enriched via valid transitions
    var REPROCESS_TARGET = {
        error:          'new',          // error → new (restart)
        new:            'processing',   // new → processing
        processing:     'enriched',     // processing → enriched
        manual_review:  'enriched'      // manual_review → enriched (after fix)
    };

    var ACTION_LABELS = {
        markReady:          'marked as ready',
        reprocess:          'sent for reprocessing',
        returnToWorkspace:  'returned to workspace'
    };

    // ── Action execution ──────────────────────────────────────────────────

    EW.actions.execute = function(actionId) {
        var selected = EW.actions.getSelectedRecords();
        console.log('[EW] Action:', actionId, 'Selected:', selected);

        // Reprocess: split by source status since each needs a different target
        if (actionId === 'reprocess') {
            executeReprocess(selected);
            return;
        }

        // Phase 4 actions (single target status)
        if (TARGET_STATUS[actionId]) {
            executeBatchTransition(actionId, selected);
            return;
        }

        // Phase 5: Confirm for posting
        if (actionId === 'confirmForPosting') {
            openConfirmDialog(selected);
            return;
        }

        // Phase 6: Delete
        if (actionId === 'deleteRecord') {
            openDeleteDialog(selected);
            return;
        }

        // Phase 6: New Manual Entry
        if (actionId === 'newManual') {
            openNewManualDialog();
            return;
        }

        // Phase 6: Split
        if (actionId === 'splitRecord') {
            openSplitDialog(selected);
            return;
        }

        // Phase 6: Merge
        if (actionId === 'mergeRecords') {
            openMergeDialog(selected);
            return;
        }

        // Export CSV
        if (actionId === 'exportCSV') {
            executeExportCSV();
            return;
        }

        // New v2 operations
        if (actionId === 'reclassify') { openReclassifyDialog(selected); return; }
        if (actionId === 'reassign') { openReassignDialog(selected); return; }
        if (actionId === 'fxOverride') { openFxOverrideDialog(selected); return; }
        if (actionId === 'glOverride') { openGlOverrideDialog(selected); return; }
        if (actionId === 'flipDC') { executeFlipDC(selected); return; }
        if (actionId === 'loanPaymentSplit') { openLoanSplitDialog(selected); return; }
        if (actionId === 'linkLoan') { openLinkLoanDialog(selected); return; }
        if (actionId === 'allocFund') { openFundAllocDialog(selected); return; }

        EW.toast.show('"' + actionId + '" is not yet implemented.', 'info');
    };

    function executeReprocess(selected) {
        var eligible = ELIGIBLE_STATUSES.reprocess;
        var label = ACTION_LABELS.reprocess;

        // Group eligible records by their reprocess target
        var byTarget = {};
        var skipped = 0;
        for (var i = 0; i < selected.length; i++) {
            var s = selected[i];
            if (eligible.indexOf(s.status) >= 0) {
                var target = REPROCESS_TARGET[s.status];
                if (!byTarget[target]) byTarget[target] = [];
                byTarget[target].push(s.id);
            } else {
                skipped++;
            }
        }

        if (skipped > 0) {
            EW.toast.show(skipped + ' record' + (skipped !== 1 ? 's' : '') + ' skipped (ineligible status)', 'info');
        }

        var targets = Object.keys(byTarget);
        if (targets.length === 0) {
            EW.toast.show('No eligible records for this action.', 'warning');
            return;
        }

        var btn = document.getElementById('ew-action-reprocess');
        if (btn) btn.disabled = true;

        // Fire one API call per target status, collect all results
        var promises = [];
        for (var t = 0; t < targets.length; t++) {
            promises.push(EW.api.batchTransitionStatus(byTarget[targets[t]], targets[t]));
        }

        Promise.all(promises)
            .then(function(results) {
                var totalSucceeded = 0;
                var allFailed = [];
                for (var r = 0; r < results.length; r++) {
                    var data = results[r];
                    totalSucceeded += (data.succeeded || []).length;
                    allFailed = allFailed.concat(data.failed || []);
                }

                if (totalSucceeded > 0) {
                    EW.toast.show(totalSucceeded + ' record' + (totalSucceeded !== 1 ? 's' : '') + ' ' + label, 'success');
                }
                if (allFailed.length > 0) {
                    var failMsgs = [];
                    for (var k = 0; k < allFailed.length && k < 3; k++) {
                        failMsgs.push(allFailed[k].id + ': ' + (allFailed[k].error || 'unknown error'));
                    }
                    if (allFailed.length > 3) failMsgs.push('...and ' + (allFailed.length - 3) + ' more');
                    EW.toast.show('Failed: ' + failMsgs.join('; '), 'error');
                }

                EW.state.selectedIds = [];
                EW.table.load();
            })
            .catch(function(e) {
                EW.toast.show('Action failed: ' + e.message, 'error');
            })
            .then(function() {
                if (btn) btn.disabled = false;
            });
    }

    function executeBatchTransition(actionId, selected) {
        var eligible = ELIGIBLE_STATUSES[actionId];
        var targetStatus = TARGET_STATUS[actionId];
        var label = ACTION_LABELS[actionId];

        // Filter to eligible records
        var eligibleRecords = [];
        var skipped = 0;
        for (var i = 0; i < selected.length; i++) {
            if (eligible.indexOf(selected[i].status) >= 0) {
                eligibleRecords.push(selected[i]);
            } else {
                skipped++;
            }
        }

        if (skipped > 0) {
            EW.toast.show(skipped + ' record' + (skipped !== 1 ? 's' : '') + ' skipped (ineligible status)', 'info');
        }

        if (eligibleRecords.length === 0) {
            EW.toast.show('No eligible records for this action.', 'warning');
            return;
        }

        var ids = [];
        for (var j = 0; j < eligibleRecords.length; j++) {
            ids.push(eligibleRecords[j].id);
        }

        // Disable the clicked button during the API call
        var btn = document.getElementById('ew-action-' + actionId);
        if (btn) btn.disabled = true;

        EW.api.batchTransitionStatus(ids, targetStatus)
            .then(function(data) {
                var succeeded = data.succeeded || [];
                var failed = data.failed || [];

                if (succeeded.length > 0) {
                    EW.toast.show(succeeded.length + ' record' + (succeeded.length !== 1 ? 's' : '') + ' ' + label, 'success');
                }
                if (failed.length > 0) {
                    var failMsgs = [];
                    for (var k = 0; k < failed.length && k < 3; k++) {
                        failMsgs.push(failed[k].id + ': ' + (failed[k].error || 'unknown error'));
                    }
                    if (failed.length > 3) failMsgs.push('...and ' + (failed.length - 3) + ' more');
                    EW.toast.show('Failed: ' + failMsgs.join('; '), 'error');
                }

                // Refresh table and clear selection
                EW.state.selectedIds = [];
                EW.table.load();
            })
            .catch(function(e) {
                EW.toast.show('Action failed: ' + e.message, 'error');
            })
            .then(function() {
                // Re-enable button (finally block equivalent)
                if (btn) btn.disabled = false;
            });
    }

    // ── Confirm for Posting dialog ──────────────────────────────────────────

    function openConfirmDialog(selected) {
        // Filter to ready-only records
        var readyRecords = [];
        var skippedCount = 0;
        for (var i = 0; i < selected.length; i++) {
            if (selected[i].status === 'ready') {
                readyRecords.push(selected[i]);
            } else {
                skippedCount++;
            }
        }

        if (readyRecords.length === 0) {
            EW.toast.show('No records with "ready" status to confirm.', 'warning');
            return;
        }

        // Build currency breakdown from cached records
        var currencyMap = {};
        for (var j = 0; j < readyRecords.length; j++) {
            var rec = EW.state.records && EW.state.records[readyRecords[j].id];
            if (!rec) continue;
            var ccy = rec.validated_currency || '—';
            if (!currencyMap[ccy]) currencyMap[ccy] = { count: 0, total: 0 };
            currencyMap[ccy].count++;
            var amt = parseFloat(rec.total_amount);
            if (!isNaN(amt)) currencyMap[ccy].total += amt;
        }

        // Build summary HTML
        var summaryRows = '';
        var currencies = Object.keys(currencyMap).sort();
        for (var k = 0; k < currencies.length; k++) {
            var c = currencies[k];
            var info = currencyMap[c];
            summaryRows += '<tr>'
                + '<td>' + esc(c) + '</td>'
                + '<td style="text-align:right">' + info.count + '</td>'
                + '<td style="text-align:right">' + fmtAmount(info.total) + '</td>'
                + '</tr>';
        }

        var skippedNote = '';
        if (skippedCount > 0) {
            skippedNote = '<p class="ew-confirm-note">'
                + '<i class="fas fa-info-circle"></i> '
                + skippedCount + ' record' + (skippedCount !== 1 ? 's' : '') + ' skipped (not in "ready" status)'
                + '</p>';
        }

        var ids = [];
        for (var m = 0; m < readyRecords.length; m++) ids.push(readyRecords[m].id);

        var html = '<div class="ew-overlay" id="ew-confirm-overlay">'
            + '<div class="ew-dialog ew-dialog-wide">'
            +   '<div class="ew-dialog-header">'
            +     '<h3>Confirm for Posting</h3>'
            +     '<button class="ew-dialog-close" onclick="EW_closeConfirmDialog()">&times;</button>'
            +   '</div>'
            +   '<div class="ew-dialog-body">'
            +     '<p>Confirm <strong>' + readyRecords.length + '</strong> record' + (readyRecords.length !== 1 ? 's' : '') + ' for posting?</p>'
            +     '<table class="ew-confirm-summary">'
            +       '<thead><tr><th>Currency</th><th style="text-align:right">Count</th><th style="text-align:right">Total Amount</th></tr></thead>'
            +       '<tbody>' + summaryRows + '</tbody>'
            +     '</table>'
            +     skippedNote
            +     '<div class="ew-recon-section" id="ew-confirm-recon">'
            +       '<div class="ew-split-divider">Reconciliation</div>'
            +       '<div class="ew-recon-loading"><i class="fas fa-spinner fa-spin"></i> Loading reconciliation\u2026</div>'
            +     '</div>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeConfirmDialog()">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-confirm-btn" onclick="EW_doConfirm()">'
            +       '<i class="fas fa-paper-plane"></i> Confirm'
            +     '</button>'
            +   '</div>'
            + '</div>'
            + '</div>';

        // Store IDs for the confirm handler
        EW.state._confirmIds = ids;

        document.body.insertAdjacentHTML('beforeend', html);

        // Close on overlay click (outside dialog)
        document.getElementById('ew-confirm-overlay').addEventListener('click', function(e) {
            if (e.target === this) EW_closeConfirmDialog();
        });

        // Load reconciliation data asynchronously
        if (EW.statementId && EW.api.fetchReconciliation) {
            EW.api.fetchReconciliation(EW.statementId)
                .then(function(recon) {
                    var container = document.getElementById('ew-confirm-recon');
                    if (!container) return; // dialog was closed
                    container.innerHTML = '<div class="ew-split-divider">Reconciliation</div>'
                        + EW.actions.buildReconTable(recon);
                })
                .catch(function() {
                    var container = document.getElementById('ew-confirm-recon');
                    if (container) container.innerHTML = ''; // silently remove on failure
                });
        } else {
            var reconEl = document.getElementById('ew-confirm-recon');
            if (reconEl) reconEl.innerHTML = '';
        }
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtAmount(v) {
        if (v === null || v === undefined || isNaN(v)) return '';
        return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ── Shared reconciliation table builder ─────────────────────────────────

    /**
     * Build reconciliation HTML from API response.
     * @param {Object} recon - { statementId, isFinalConfirmation, currencies: [...] }
     * @returns {string} HTML
     */
    EW.actions.buildReconTable = function(recon) {
        if (!recon || !recon.currencies || recon.currencies.length === 0) {
            return '<div class="ew-recon-note">No reconciliation data available.</div>';
        }

        var html = '';

        if (recon.isFinalConfirmation) {
            html += '<div class="ew-recon-final">'
                + '<i class="fas fa-check-circle"></i> Statement fully reconciled — all records confirmed.'
                + '</div>';
        }

        html += '<table class="ew-recon-table">'
            + '<thead><tr>'
            + '<th>Currency</th>'
            + '<th style="text-align:right">Source Input</th>'
            + '<th style="text-align:right">Output (Confirmed)</th>'
            + '<th style="text-align:right">Remaining</th>'
            + '<th style="text-align:right">Discrepancy</th>'
            + '</tr></thead><tbody>';

        for (var i = 0; i < recon.currencies.length; i++) {
            var c = recon.currencies[i];
            var discCls = c.withinTolerance ? 'ew-recon-ok' : 'ew-recon-warn';
            var discText = fmtAmount(c.discrepancy);
            if (c.withinTolerance) discText += ' \u2713';

            html += '<tr>'
                + '<td>' + esc(c.currency) + '</td>'
                + '<td style="text-align:right">' + fmtAmount(c.adjustedInput != null ? c.adjustedInput : c.sourceInput) + '</td>'
                + '<td style="text-align:right">' + fmtAmount(c.output) + '</td>'
                + '<td style="text-align:right">' + fmtAmount(c.remaining) + '</td>'
                + '<td style="text-align:right" class="' + discCls + '">' + discText + '</td>'
                + '</tr>';
        }

        html += '</tbody></table>';

        if (!recon.isFinalConfirmation) {
            html += '<div class="ew-recon-note">'
                + 'Partial confirmation \u2014 active records remain. '
                + 'Discrepancies may resolve as remaining records are processed.'
                + '</div>';
        }

        return html;
    };

    // Global handlers for onclick in dynamic HTML
    window.EW_closeConfirmDialog = function() {
        var overlay = document.getElementById('ew-confirm-overlay');
        if (overlay) overlay.remove();
        EW.state._confirmIds = null;
    };

    window.EW_doConfirm = function() {
        var ids = EW.state._confirmIds;
        if (!ids || ids.length === 0) return;

        var btn = document.getElementById('ew-confirm-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming\u2026';
        }

        EW.api.confirmRecords(ids, true)
            .then(function(data) {
                var confirmed = data.confirmed || 0;
                var validationErrors = data.validationErrors || [];
                var skipped = data.skipped || [];

                if (confirmed > 0) {
                    EW.toast.show(confirmed + ' record' + (confirmed !== 1 ? 's' : '') + ' confirmed for posting.', 'success');
                }

                if (validationErrors.length > 0) {
                    var msgs = [];
                    for (var i = 0; i < validationErrors.length && i < 3; i++) {
                        var ve = validationErrors[i];
                        var errors = ve.errors || [];
                        msgs.push(ve.id + ': ' + errors.join(', '));
                    }
                    if (validationErrors.length > 3) msgs.push('...and ' + (validationErrors.length - 3) + ' more');
                    EW.toast.show('Validation errors: ' + msgs.join('; '), 'warning', 8000);
                }

                if (skipped.length > 0) {
                    EW.toast.show(skipped.length + ' record' + (skipped.length !== 1 ? 's' : '') + ' skipped (ineligible status).', 'info');
                }

                // Show post-confirm reconciliation if available
                if (data.reconciliation) {
                    var container = document.getElementById('ew-confirm-recon');
                    if (container) {
                        container.innerHTML = '<div class="ew-split-divider">Reconciliation (Updated)</div>'
                            + EW.actions.buildReconTable(data.reconciliation);

                        // Change footer to a single Close button
                        var footer = document.querySelector('#ew-confirm-overlay .ew-dialog-footer');
                        if (footer) {
                            footer.innerHTML = '<button class="ew-btn-save" onclick="EW_closeConfirmDialog(); EW.state.selectedIds = []; EW.table.load();">'
                                + '<i class="fas fa-check"></i> Close'
                                + '</button>';
                        }
                        return; // don't close dialog yet — let user review reconciliation
                    }
                }

                // Close dialog and refresh
                EW_closeConfirmDialog();
                EW.state.selectedIds = [];
                EW.table.load();
            })
            .catch(function(e) {
                EW.toast.show('Confirm failed: ' + e.message, 'error');
                // Re-enable button for retry
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Confirm';
                }
            });
    };

    // ── Delete dialog ───────────────────────────────────────────────────────

    var DELETE_ELIGIBLE = ['new', 'error', 'manual_review'];

    function openDeleteDialog(selected) {
        var eligible = [];
        var skippedCount = 0;
        for (var i = 0; i < selected.length; i++) {
            if (DELETE_ELIGIBLE.indexOf(selected[i].status) >= 0) {
                eligible.push(selected[i]);
            } else {
                skippedCount++;
            }
        }

        if (eligible.length === 0) {
            EW.toast.show('No eligible records to delete.', 'warning');
            return;
        }

        var skippedNote = '';
        if (skippedCount > 0) {
            skippedNote = '<p class="ew-confirm-note">'
                + '<i class="fas fa-info-circle"></i> '
                + skippedCount + ' record' + (skippedCount !== 1 ? 's' : '') + ' skipped (ineligible status)'
                + '</p>';
        }

        var ids = [];
        for (var j = 0; j < eligible.length; j++) ids.push(eligible[j].id);

        var html = '<div class="ew-overlay" id="ew-delete-overlay">'
            + '<div class="ew-dialog">'
            +   '<div class="ew-dialog-header">'
            +     '<h3>Delete Records</h3>'
            +     '<button class="ew-dialog-close" onclick="EW_closeDeleteDialog()">&times;</button>'
            +   '</div>'
            +   '<div class="ew-dialog-body">'
            +     '<p><i class="fas fa-exclamation-triangle" style="color:#dc2626"></i> '
            +     'Are you sure you want to delete <strong>' + eligible.length + '</strong> record'
            +     (eligible.length !== 1 ? 's' : '') + '? This action cannot be undone.</p>'
            +     skippedNote
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeDeleteDialog()">Cancel</button>'
            +     '<button class="ew-btn-danger" id="ew-delete-btn" onclick="EW_doDelete()">'
            +       '<i class="fas fa-trash"></i> Delete'
            +     '</button>'
            +   '</div>'
            + '</div>'
            + '</div>';

        EW.state._deleteIds = ids;
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('ew-delete-overlay').addEventListener('click', function(e) {
            if (e.target === this) EW_closeDeleteDialog();
        });
    }

    window.EW_closeDeleteDialog = function() {
        var overlay = document.getElementById('ew-delete-overlay');
        if (overlay) overlay.remove();
        EW.state._deleteIds = null;
    };

    window.EW_doDelete = function() {
        var ids = EW.state._deleteIds;
        if (!ids || ids.length === 0) return;

        var btn = document.getElementById('ew-delete-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting\u2026';
        }

        EW.api.deleteRecords(ids)
            .then(function(data) {
                var deleted = data.deleted || data.deletedRecords || ids.length;
                if (typeof deleted === 'object') deleted = deleted.length || 0;
                EW.toast.show(deleted + ' record' + (deleted !== 1 ? 's' : '') + ' deleted.', 'success');
                EW_closeDeleteDialog();
                EW.state.selectedIds = [];
                EW.table.load();
            })
            .catch(function(e) {
                EW.toast.show('Delete failed: ' + e.message, 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
                }
            });
    };

    // ── New Manual Entry dialog ─────────────────────────────────────────────

    var INTERNAL_TYPE_OPTIONS = [
        ['SEC_BUY','SEC_BUY'],['SEC_SELL','SEC_SELL'],
        ['BOND_BUY','BOND_BUY'],['BOND_COUPON','BOND_COUPON'],
        ['DIV_INCOME','DIV_INCOME'],['CASH_IN_OUT','CASH_IN_OUT'],
        ['FX_EXCHANGE','FX_EXCHANGE'],['COMMISSION','COMMISSION']
    ];

    function manualField(name, label, type, required) {
        var reqCls = required ? ' ew-edit-required' : '';
        var reqAttr = required ? ' required' : '';
        var inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';
        var stepAttr = type === 'number' ? ' step="any"' : '';
        return '<div class="ew-f-field">'
            + '<label>' + esc(label) + (required ? ' *' : '') + '</label>'
            + '<input type="' + inputType + '" class="ew-edit-input' + reqCls + '" name="' + esc(name) + '"'
            + stepAttr + reqAttr + ' />'
            + '</div>';
    }

    function manualSelectField(name, label, options, required) {
        var reqCls = required ? ' ew-edit-required' : '';
        var html = '<div class="ew-f-field">'
            + '<label>' + esc(label) + (required ? ' *' : '') + '</label>'
            + '<select class="ew-edit-select' + reqCls + '" name="' + esc(name) + '">'
            + '<option value="">\u2014</option>';
        for (var i = 0; i < options.length; i++) {
            html += '<option value="' + esc(options[i][0]) + '">' + esc(options[i][1]) + '</option>';
        }
        html += '</select></div>';
        return html;
    }

    function openNewManualDialog() {
        var html = '<div class="ew-overlay" id="ew-manual-overlay">'
            + '<div class="ew-dialog ew-dialog-wide">'
            +   '<div class="ew-dialog-header">'
            +     '<h3>New Manual Entry</h3>'
            +     '<button class="ew-dialog-close" onclick="EW_closeManualDialog()">&times;</button>'
            +   '</div>'
            +   '<div class="ew-dialog-body">'
            +     '<div class="ew-f-row">'
            +       manualField('transaction_date', 'Transaction Date', 'date', true)
            +       manualField('settlement_date', 'Settlement Date', 'date', true)
            +       manualSelectField('debit_credit', 'D/C', [['D','D (Debit)'],['C','C (Credit)']], true)
            +     '</div>'
            +     '<div class="ew-f-row">'
            +       manualField('original_amount', 'Amount', 'number', true)
            +       manualField('validated_currency', 'Currency', 'text', true)
            +       manualSelectField('internal_type', 'Internal Type', INTERNAL_TYPE_OPTIONS, true)
            +     '</div>'
            +     '<div class="ew-f-row">'
            +       manualField('resolved_customer_id', 'Customer ID', 'text', true)
            +       manualField('fee_amount', 'Fee Amount', 'number', false)
            +     '</div>'
            +     '<div class="ew-f-row">'
            +       '<div class="ew-f-field wide">'
            +         '<label>Description</label>'
            +         '<textarea class="ew-edit-textarea" name="description" maxlength="500"></textarea>'
            +       '</div>'
            +     '</div>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeManualDialog()">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-manual-btn" onclick="EW_doCreateManual()">'
            +       '<i class="fas fa-plus"></i> Create'
            +     '</button>'
            +   '</div>'
            + '</div>'
            + '</div>';

        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('ew-manual-overlay').addEventListener('click', function(e) {
            if (e.target === this) EW_closeManualDialog();
        });
    }

    window.EW_closeManualDialog = function() {
        var overlay = document.getElementById('ew-manual-overlay');
        if (overlay) overlay.remove();
    };

    window.EW_doCreateManual = function() {
        var overlay = document.getElementById('ew-manual-overlay');
        if (!overlay) return;

        var required = ['transaction_date', 'settlement_date', 'debit_credit',
                        'original_amount', 'validated_currency', 'internal_type',
                        'resolved_customer_id'];
        var fields = {};
        var missing = [];

        var inputs = overlay.querySelectorAll('[name]');
        for (var i = 0; i < inputs.length; i++) {
            var name = inputs[i].getAttribute('name');
            var val = inputs[i].value.trim();
            if (val) fields[name] = val;
        }

        for (var j = 0; j < required.length; j++) {
            if (!fields[required[j]]) missing.push(required[j]);
        }

        if (missing.length > 0) {
            EW.toast.show('Required fields missing: ' + missing.join(', '), 'warning');
            return;
        }

        // Auto-add statement_id
        if (EW.statementId) fields.statement_id = EW.statementId;

        var btn = document.getElementById('ew-manual-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating\u2026';
        }

        EW.api.createRecord(fields)
            .then(function() {
                EW.toast.show('Manual record created.', 'success');
                EW_closeManualDialog();
                EW.state.selectedIds = [];
                EW.table.load();
            })
            .catch(function(e) {
                EW.toast.show('Create failed: ' + e.message, 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-plus"></i> Create';
                }
            });
    };

    // ── Split dialog ────────────────────────────────────────────────────────

    var SPLIT_ELIGIBLE = ['enriched', 'adjusted', 'in_review', 'ready'];

    function buildSplitRow(n) {
        return '<div class="ew-split-row" data-row="' + n + '">'
            + '<span class="ew-split-row-num">#' + n + '</span>'
            + '<input type="number" step="any" class="ew-edit-input ew-split-amount" placeholder="Amount" oninput="EW_updateSplitTotal()" />'
            + '<input type="text" class="ew-edit-input" placeholder="Description (optional)" style="flex:2" />'
            + (n > 2 ? '<button type="button" class="ew-split-remove" onclick="EW_removeSplitRow(this)" title="Remove">&times;</button>' : '<span style="width:28px"></span>')
            + '</div>';
    }

    function openSplitDialog(selected) {
        if (selected.length !== 1) {
            EW.toast.show('Select exactly 1 record to split.', 'warning');
            return;
        }

        var sel = selected[0];
        if (SPLIT_ELIGIBLE.indexOf(sel.status) < 0) {
            EW.toast.show('Record status "' + sel.status + '" is not eligible for split.', 'warning');
            return;
        }

        var rec = EW.state.records && EW.state.records[sel.id];
        if (!rec) {
            EW.toast.show('Record data not found in cache.', 'error');
            return;
        }

        var amt = parseFloat(rec.original_amount);
        var amtDisplay = isNaN(amt) ? '—' : fmtAmount(amt);

        EW.state._splitRecordId = sel.id;
        EW.state._splitOriginalAmount = amt;
        EW.state._splitRowCount = 2;

        var html = '<div class="ew-overlay" id="ew-split-overlay">'
            + '<div class="ew-dialog ew-dialog-wide">'
            +   '<div class="ew-dialog-header">'
            +     '<h3>Split Record</h3>'
            +     '<button class="ew-dialog-close" onclick="EW_closeSplitDialog()">&times;</button>'
            +   '</div>'
            +   '<div class="ew-dialog-body">'
            +     '<div class="ew-split-source">'
            +       '<div><strong>ID:</strong> ' + esc(rec.id) + '</div>'
            +       '<div><strong>Amount:</strong> ' + amtDisplay + '</div>'
            +       '<div><strong>Currency:</strong> ' + esc(rec.validated_currency || '—') + '</div>'
            +       '<div><strong>Date:</strong> ' + esc(rec.transaction_date || '—') + '</div>'
            +     '</div>'
            +     '<div class="ew-split-divider">Allocations</div>'
            +     '<div id="ew-split-rows">'
            +       buildSplitRow(1)
            +       buildSplitRow(2)
            +     '</div>'
            +     '<div class="ew-split-controls">'
            +       '<button type="button" class="ew-btn-cancel" onclick="EW_addSplitRow()">'
            +         '<i class="fas fa-plus"></i> Add Row'
            +       '</button>'
            +       '<div>'
            +         '<span class="ew-split-total" id="ew-split-total">Total: 0.00</span>'
            +         '<span class="ew-split-diff ew-split-unbalanced" id="ew-split-diff">Remaining: ' + amtDisplay + '</span>'
            +       '</div>'
            +     '</div>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeSplitDialog()">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-split-btn" onclick="EW_doSplit()" disabled>'
            +       '<i class="fas fa-code-branch"></i> Split'
            +     '</button>'
            +   '</div>'
            + '</div>'
            + '</div>';

        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('ew-split-overlay').addEventListener('click', function(e) {
            if (e.target === this) EW_closeSplitDialog();
        });
    }

    window.EW_closeSplitDialog = function() {
        var overlay = document.getElementById('ew-split-overlay');
        if (overlay) overlay.remove();
        EW.state._splitRecordId = null;
        EW.state._splitOriginalAmount = null;
        EW.state._splitRowCount = null;
    };

    window.EW_addSplitRow = function() {
        var container = document.getElementById('ew-split-rows');
        if (!container) return;
        EW.state._splitRowCount = (EW.state._splitRowCount || 2) + 1;
        container.insertAdjacentHTML('beforeend', buildSplitRow(EW.state._splitRowCount));
    };

    window.EW_removeSplitRow = function(btn) {
        var row = btn.closest('.ew-split-row');
        if (row) row.remove();
        // Renumber remaining rows
        var rows = document.querySelectorAll('#ew-split-rows .ew-split-row');
        for (var i = 0; i < rows.length; i++) {
            var num = rows[i].querySelector('.ew-split-row-num');
            if (num) num.textContent = '#' + (i + 1);
        }
        EW_updateSplitTotal();
    };

    window.EW_updateSplitTotal = function() {
        var inputs = document.querySelectorAll('.ew-split-amount');
        var total = 0;
        for (var i = 0; i < inputs.length; i++) {
            var v = parseFloat(inputs[i].value);
            if (!isNaN(v)) total += v;
        }

        var orig = EW.state._splitOriginalAmount;
        if (isNaN(orig)) orig = 0;
        var diff = orig - total;
        var balanced = Math.abs(diff) < 0.005;

        var totalEl = document.getElementById('ew-split-total');
        if (totalEl) totalEl.textContent = 'Total: ' + fmtAmount(total);

        var diffEl = document.getElementById('ew-split-diff');
        if (diffEl) {
            if (balanced) {
                diffEl.textContent = 'Balanced \u2713';
                diffEl.className = 'ew-split-diff ew-split-balanced';
            } else {
                diffEl.textContent = 'Remaining: ' + fmtAmount(diff);
                diffEl.className = 'ew-split-diff ew-split-unbalanced';
            }
        }

        var btn = document.getElementById('ew-split-btn');
        if (btn) btn.disabled = !balanced;
    };

    window.EW_doSplit = function() {
        var recordId = EW.state._splitRecordId;
        if (!recordId) return;

        var rows = document.querySelectorAll('#ew-split-rows .ew-split-row');
        if (rows.length < 2) {
            EW.toast.show('At least 2 allocation rows are required.', 'warning');
            return;
        }

        var allocations = [];
        for (var i = 0; i < rows.length; i++) {
            var amtInput = rows[i].querySelector('.ew-split-amount');
            var descInput = rows[i].querySelectorAll('.ew-edit-input')[1];
            var amt = amtInput ? amtInput.value.trim() : '';
            var desc = descInput ? descInput.value.trim() : '';

            if (!amt) {
                EW.toast.show('All allocation amounts must be filled.', 'warning');
                return;
            }
            var alloc = { amount: amt };
            if (desc) alloc.description = desc;
            allocations.push(alloc);
        }

        var btn = document.getElementById('ew-split-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Splitting\u2026';
        }

        EW.api.splitRecord(recordId, allocations)
            .then(function(data) {
                var children = data.children || (data.childRecords ? data.childRecords.length : allocations.length);
                if (typeof children === 'object') children = children.length || 0;
                EW.toast.show('Record split into ' + children + ' parts.', 'success');
                EW_closeSplitDialog();
                EW.state.selectedIds = [];
                EW.table.load();
            })
            .catch(function(e) {
                EW.toast.show('Split failed: ' + e.message, 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-code-branch"></i> Split';
                }
            });
    };

    // ── Merge dialog ────────────────────────────────────────────────────────

    var MERGE_ELIGIBLE = ['enriched', 'adjusted', 'in_review'];

    function openMergeDialog(selected) {
        var eligible = [];
        var skippedCount = 0;
        for (var i = 0; i < selected.length; i++) {
            if (MERGE_ELIGIBLE.indexOf(selected[i].status) >= 0) {
                eligible.push(selected[i]);
            } else {
                skippedCount++;
            }
        }

        if (eligible.length < 2) {
            EW.toast.show('At least 2 eligible records are required to merge.', 'warning');
            return;
        }

        // Build record detail rows and compute merged preview
        var tableRows = '';
        var totalAmount = 0;
        var earliestDate = null;
        var currencies = {};
        var statementIds = {};
        var ids = [];

        for (var j = 0; j < eligible.length; j++) {
            var rec = EW.state.records && EW.state.records[eligible[j].id];
            var amt = 0;
            var ccy = '—';
            var date = '—';
            var stmId = '';

            if (rec) {
                amt = parseFloat(rec.original_amount);
                if (isNaN(amt)) amt = 0;
                ccy = rec.validated_currency || '—';
                date = rec.transaction_date || '—';
                stmId = rec.statement_id || '';
                currencies[ccy] = true;
                if (stmId) statementIds[stmId] = true;
                if (!earliestDate || (rec.transaction_date && rec.transaction_date < earliestDate)) {
                    earliestDate = rec.transaction_date;
                }
            }
            totalAmount += amt;

            tableRows += '<tr>'
                + '<td>' + esc(eligible[j].id) + '</td>'
                + '<td><span class="st-' + esc(eligible[j].status) + '">' + esc(eligible[j].status) + '</span></td>'
                + '<td style="text-align:right">' + fmtAmount(amt) + '</td>'
                + '<td>' + esc(ccy) + '</td>'
                + '<td>' + esc(date) + '</td>'
                + '</tr>';

            ids.push(eligible[j].id);
        }

        // Warnings
        var warnings = '';
        var ccyKeys = Object.keys(currencies);
        if (ccyKeys.length > 1) {
            warnings += '<div class="ew-merge-warning"><i class="fas fa-exclamation-triangle"></i> '
                + 'Records have different currencies: ' + ccyKeys.join(', ')
                + '</div>';
        }
        var stmKeys = Object.keys(statementIds);
        if (stmKeys.length > 1) {
            warnings += '<div class="ew-merge-warning"><i class="fas fa-exclamation-triangle"></i> '
                + 'Records belong to different statements: ' + stmKeys.join(', ')
                + '</div>';
        }

        var skippedNote = '';
        if (skippedCount > 0) {
            skippedNote = '<p class="ew-confirm-note">'
                + '<i class="fas fa-info-circle"></i> '
                + skippedCount + ' record' + (skippedCount !== 1 ? 's' : '') + ' skipped (ineligible status)'
                + '</p>';
        }

        var html = '<div class="ew-overlay" id="ew-merge-overlay">'
            + '<div class="ew-dialog ew-dialog-wide">'
            +   '<div class="ew-dialog-header">'
            +     '<h3>Merge Records</h3>'
            +     '<button class="ew-dialog-close" onclick="EW_closeMergeDialog()">&times;</button>'
            +   '</div>'
            +   '<div class="ew-dialog-body">'
            +     '<p>Merge <strong>' + eligible.length + '</strong> records into one?</p>'
            +     '<table class="ew-merge-table">'
            +       '<thead><tr><th>Record ID</th><th>Status</th><th style="text-align:right">Amount</th><th>Currency</th><th>Date</th></tr></thead>'
            +       '<tbody>' + tableRows + '</tbody>'
            +     '</table>'
            +     '<div class="ew-split-divider">Merged Preview</div>'
            +     '<div class="ew-split-source">'
            +       '<div><strong>Total Amount:</strong> ' + fmtAmount(totalAmount) + '</div>'
            +       '<div><strong>Earliest Date:</strong> ' + esc(earliestDate || '—') + '</div>'
            +       '<div><strong>Currency:</strong> ' + esc(ccyKeys.length === 1 ? ccyKeys[0] : 'mixed') + '</div>'
            +     '</div>'
            +     warnings
            +     skippedNote
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeMergeDialog()">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-merge-btn" onclick="EW_doMerge()">'
            +       '<i class="fas fa-compress"></i> Merge'
            +     '</button>'
            +   '</div>'
            + '</div>'
            + '</div>';

        EW.state._mergeIds = ids;
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('ew-merge-overlay').addEventListener('click', function(e) {
            if (e.target === this) EW_closeMergeDialog();
        });
    }

    window.EW_closeMergeDialog = function() {
        var overlay = document.getElementById('ew-merge-overlay');
        if (overlay) overlay.remove();
        EW.state._mergeIds = null;
    };

    window.EW_doMerge = function() {
        var ids = EW.state._mergeIds;
        if (!ids || ids.length < 2) return;

        var btn = document.getElementById('ew-merge-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Merging\u2026';
        }

        EW.api.mergeRecords(ids)
            .then(function() {
                EW.toast.show(ids.length + ' records merged into 1.', 'success');
                EW_closeMergeDialog();
                EW.state.selectedIds = [];
                EW.table.load();
            })
            .catch(function(e) {
                EW.toast.show('Merge failed: ' + e.message, 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-compress"></i> Merge';
                }
            });
    };

    // ── CSV Export ───────────────────────────────────────────────────────────

    /** Strip HTML tags from a string. */
    function stripHtml(s) {
        if (!s) return '';
        var tmp = document.createElement('div');
        tmp.innerHTML = s;
        return tmp.textContent || tmp.innerText || '';
    }

    /** Escape a value for CSV (RFC 4180). */
    function csvEscape(val) {
        if (val === null || val === undefined) return '';
        var s = String(val);
        if (s.indexOf('"') >= 0 || s.indexOf(',') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    /** Build CSV string from columns and records. */
    function buildCSV(columns, records) {
        var cols = [];
        for (var i = 0; i < columns.length; i++) {
            if (columns[i].key === '_check') continue;
            cols.push(columns[i]);
        }

        // Header row
        var lines = [];
        var headerLine = [];
        for (var h = 0; h < cols.length; h++) {
            headerLine.push(csvEscape(cols[h].label));
        }
        lines.push(headerLine.join(','));

        // Data rows
        for (var r = 0; r < records.length; r++) {
            var row = [];
            for (var c = 0; c < cols.length; c++) {
                var key = cols[c].key;
                var val = records[r][key];
                // Use raw values for amounts (no locale formatting)
                if (val === null || val === undefined) val = '';
                row.push(csvEscape(String(val)));
            }
            lines.push(row.join(','));
        }

        return '\uFEFF' + lines.join('\r\n');
    }

    /** Build CSV from summary data (different column structure). */
    function buildSummaryCSV(columns, records) {
        return buildCSV(columns, records);
    }

    /** Trigger CSV file download. */
    function downloadCSV(csv, filename) {
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        // Non-bubbling click to bypass Joget's document-level click handler
        link.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: false }));
        setTimeout(function() {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 200);
    }

    /** Generate export filename with today's date. */
    function exportFilename() {
        var d = new Date();
        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return 'enrichment-workspace-' + yyyy + '-' + mm + '-' + dd + '.csv';
    }

    /** Execute CSV export: selected rows or all records. */
    function executeExportCSV() {
        var tab = EW.nav.current();
        var columns = tab.columns;
        var selected = tab.hasCheckbox ? EW.actions.getSelectedRecords() : [];

        // Summary tab: export the rendered summary data
        if (tab.isSummary) {
            exportSummaryCSV(columns);
            return;
        }

        if (selected.length > 0) {
            // Export selected rows from cache
            var records = [];
            for (var i = 0; i < selected.length; i++) {
                var rec = EW.state.records && EW.state.records[selected[i].id];
                if (rec) records.push(rec);
            }
            if (records.length === 0) {
                EW.toast.show('No record data available for selection.', 'warning');
                return;
            }
            var csv = buildCSV(columns, records);
            downloadCSV(csv, exportFilename());
            EW.toast.show(records.length + ' record' + (records.length !== 1 ? 's' : '') + ' exported.', 'success');
        } else {
            // Fetch all records matching current filters
            EW.toast.show('Fetching all records for export\u2026', 'info');

            var filterStatus = document.getElementById('ew-filter-status');
            var filterSource = document.getElementById('ew-filter-source');
            var filterCustomer = document.getElementById('ew-filter-customer');

            var params = {
                sort: EW.state.sort,
                order: EW.state.order,
                statementId: EW.statementId,
                status: filterStatus ? filterStatus.value : '',
                sourceType: filterSource ? filterSource.value : '',
                customerId: filterCustomer ? filterCustomer.value : ''
            };
            params = tab.buildFilters(params);

            EW.api.fetchAllRecords(params)
                .then(function(records) {
                    if (records.length === 0) {
                        EW.toast.show('No records to export.', 'warning');
                        return;
                    }
                    var csv = buildCSV(columns, records);
                    downloadCSV(csv, exportFilename());
                    EW.toast.show(records.length + ' record' + (records.length !== 1 ? 's' : '') + ' exported.', 'success');
                })
                .catch(function(e) {
                    EW.toast.show('Export failed: ' + e.message, 'error');
                });
        }
    }

    /** Export summary tab data. */
    function exportSummaryCSV(columns) {
        // Re-fetch summary to get current data
        EW.api.fetchSummary({ statementId: EW.statementId })
            .then(function(data) {
                var records = data.records || data.summary || [];
                if (records.length === 0) {
                    EW.toast.show('No summary data to export.', 'warning');
                    return;
                }
                var csv = buildSummaryCSV(columns, records);
                downloadCSV(csv, exportFilename());
                EW.toast.show(records.length + ' summary row' + (records.length !== 1 ? 's' : '') + ' exported.', 'success');
            })
            .catch(function(e) {
                EW.toast.show('Export failed: ' + e.message, 'error');
            });
    }

    /** Global handler for export button in pagination area. */
    window.EW_exportCSV = function() {
        executeExportCSV();
    };

    // ── Reclassify Type dialog ──────────────────────────────────────────────

    var ALL_INT_TYPES = [
        'SEC_BUY','SEC_SELL','EQ_BUY','EQ_SELL','BOND_BUY','BOND_INT',
        'SPLIT_IN','SPLIT_OUT','DIV_INCOME','DIV_TAX','FX_EXCHANGE',
        'LOAN_PAYMENT','LOAN_DISBURSEMENT','INT_INCOME','INT_EXPENSE',
        'COMM_FEE','MGMT_FEE','ADMIN_FEE','LEGAL_FEE','TAX',
        'CASH_IN_OUT','ASSET_RETURN','INV_INCOME'
    ];

    function openReclassifyDialog(selected) {
        if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
        var rec = EW.state.records && EW.state.records[selected[0].id];
        if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

        var quickTypes = ['LOAN_PAYMENT','INT_INCOME','SEC_BUY','SEC_SELL','DIV_INCOME','FX_EXCHANGE','COMM_FEE'];
        var chips = '';
        for (var i = 0; i < quickTypes.length; i++) {
            chips += '<button class="ew-dd-item" style="display:inline-flex;padding:4px 10px;border:1px solid #e2e8f0;border-radius:16px;font-size:.74em;margin:0 4px 4px 0" '
                + 'onclick="document.getElementById(\'ew-reclass-type\').value=\'' + quickTypes[i] + '\'">' + quickTypes[i] + '</button>';
        }

        var opts = '<option value="">Select type...</option>';
        for (var t = 0; t < ALL_INT_TYPES.length; t++) {
            var sel = rec.internal_type === ALL_INT_TYPES[t] ? ' selected' : '';
            opts += '<option value="' + ALL_INT_TYPES[t] + '"' + sel + '>' + ALL_INT_TYPES[t] + '</option>';
        }

        var html = '<div class="ew-overlay" id="ew-reclass-overlay">'
            + '<div class="ew-dialog">'
            +   '<div class="ew-dialog-header"><h3>Reclassify Type</h3>'
            +   '<button class="ew-dialog-close" onclick="EW_closeOverlay(\'ew-reclass-overlay\')">&times;</button></div>'
            +   '<div class="ew-dialog-body">'
            +     '<p>Current: <strong>' + esc(rec.internal_type || '\u2014') + '</strong> '
            +     '(confidence: ' + esc(rec.type_confidence || '\u2014') + ')</p>'
            +     '<div style="margin:10px 0">' + chips + '</div>'
            +     '<div class="ew-f-field"><label>New Type</label>'
            +       '<select class="ew-edit-select" id="ew-reclass-type">' + opts + '</select></div>'
            +     '<div class="ew-f-field" style="margin-top:8px"><label>Reason *</label>'
            +       '<textarea class="ew-edit-textarea" id="ew-reclass-reason" placeholder="Why are you reclassifying this transaction?"></textarea></div>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeOverlay(\'ew-reclass-overlay\')">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-reclass-btn" onclick="EW_doReclassify()">Save</button>'
            +   '</div></div></div>';

        EW.state._reclassRecordId = rec.id;
        EW.state._reclassVersion = rec.version;
        document.body.insertAdjacentHTML('beforeend', html);
        bindOverlayClose('ew-reclass-overlay');
    }

    window.EW_doReclassify = function() {
        var type = document.getElementById('ew-reclass-type').value;
        var reason = document.getElementById('ew-reclass-reason').value.trim();
        if (!type) { EW.toast.show('Select a type.', 'warning'); return; }
        if (!reason) { EW.toast.show('Reason is required.', 'warning'); return; }

        var btn = document.getElementById('ew-reclass-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }

        EW.api.saveRecord(EW.state._reclassRecordId, {
            version: EW.state._reclassVersion,
            internal_type: type,
            type_confidence: 'manual_override',
            processing_notes: reason
        }).then(function() {
            EW.toast.show('Type reclassified to ' + type, 'success');
            EW_closeOverlay('ew-reclass-overlay');
            EW.table.load();
        }).catch(function(e) {
            EW.toast.show('Reclassify failed: ' + e.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        });
    };

    // ── Reassign Customer dialog ─────────────────────────────────────────────

    function openReassignDialog(selected) {
        if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
        var rec = EW.state.records && EW.state.records[selected[0].id];
        if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

        var html = '<div class="ew-overlay" id="ew-reassign-overlay">'
            + '<div class="ew-dialog">'
            +   '<div class="ew-dialog-header"><h3>Reassign Customer</h3>'
            +   '<button class="ew-dialog-close" onclick="EW_closeOverlay(\'ew-reassign-overlay\')">&times;</button></div>'
            +   '<div class="ew-dialog-body">'
            +     '<p>Current customer: <strong>' + esc(rec.customer_code || '\u2014') + '</strong>'
            +     (rec.resolved_customer_id ? ' (ID: ' + esc(rec.resolved_customer_id) + ')' : '') + '</p>'
            +     '<div class="ew-f-field" style="margin-top:10px"><label>Customer ID</label>'
            +       '<input type="text" class="ew-edit-input" id="ew-reassign-custid" placeholder="Enter customer ID..." '
            +       'value="' + esc(rec.resolved_customer_id || '') + '" /></div>'
            +     '<div class="ew-f-field" style="margin-top:6px"><label>Customer Code</label>'
            +       '<input type="text" class="ew-edit-input" id="ew-reassign-custcode" placeholder="Customer code..." '
            +       'value="' + esc(rec.customer_code || '') + '" /></div>'
            +     '<div class="ew-f-field" style="margin-top:8px"><label>Reason</label>'
            +       '<textarea class="ew-edit-textarea" id="ew-reassign-reason" placeholder="Why are you reassigning?"></textarea></div>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeOverlay(\'ew-reassign-overlay\')">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-reassign-btn" onclick="EW_doReassign()">Save</button>'
            +   '</div></div></div>';

        EW.state._reassignRecordId = rec.id;
        EW.state._reassignVersion = rec.version;
        document.body.insertAdjacentHTML('beforeend', html);
        bindOverlayClose('ew-reassign-overlay');
    }

    window.EW_doReassign = function() {
        var custId = document.getElementById('ew-reassign-custid').value.trim();
        var custCode = document.getElementById('ew-reassign-custcode').value.trim();
        var reason = document.getElementById('ew-reassign-reason').value.trim();
        if (!custId && !custCode) { EW.toast.show('Enter a customer ID or code.', 'warning'); return; }

        var btn = document.getElementById('ew-reassign-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }

        var data = { version: EW.state._reassignVersion, customer_match_method: 'manual' };
        if (custId) data.resolved_customer_id = custId;
        if (custCode) data.customer_code = custCode;
        if (reason) data.processing_notes = reason;

        EW.api.saveRecord(EW.state._reassignRecordId, data).then(function() {
            EW.toast.show('Customer reassigned', 'success');
            EW_closeOverlay('ew-reassign-overlay');
            EW.table.load();
        }).catch(function(e) {
            EW.toast.show('Reassign failed: ' + e.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        });
    };

    // ── FX Override dialog ──────────────────────────────────────────────────

    function openFxOverrideDialog(selected) {
        if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
        var rec = EW.state.records && EW.state.records[selected[0].id];
        if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

        var curRate = rec.fx_rate_to_eur || '';
        var curAmt = parseFloat(rec.total_amount) || 0;

        var html = '<div class="ew-overlay" id="ew-fx-overlay">'
            + '<div class="ew-dialog">'
            +   '<div class="ew-dialog-header"><h3>FX Override</h3>'
            +   '<button class="ew-dialog-close" onclick="EW_closeOverlay(\'ew-fx-overlay\')">&times;</button></div>'
            +   '<div class="ew-dialog-body">'
            +     '<p>Currency: <strong>' + esc(rec.validated_currency || '\u2014') + '</strong>'
            +     ' | Amount: <strong>' + fmtAmount(curAmt) + '</strong>'
            +     ' | Current rate: <strong>' + esc(curRate || 'none') + '</strong></p>'
            +     '<div class="ew-f-row" style="margin-top:10px">'
            +       '<div class="ew-f-field"><label>New FX Rate</label>'
            +         '<input type="number" step="any" class="ew-edit-input" id="ew-fx-rate" value="' + esc(curRate) + '" oninput="EW_fxPreview()" /></div>'
            +       '<div class="ew-f-field"><label>Rate Date</label>'
            +         '<input type="date" class="ew-edit-input" id="ew-fx-date" value="' + esc(rec.fx_rate_date || '') + '" /></div>'
            +     '</div>'
            +     '<div class="ew-f-field" style="margin-top:6px"><label>Rate Source</label>'
            +       '<select class="ew-edit-select" id="ew-fx-source">'
            +         '<option value="manual_override" selected>Manual Override</option>'
            +         '<option value="ecb">ECB</option><option value="bloomberg">Bloomberg</option>'
            +       '</select></div>'
            +     '<div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:6px;font-size:.88em">'
            +       'EUR equivalent: <strong id="ew-fx-preview">' + fmtAmount(curRate ? curAmt * parseFloat(curRate) : 0) + '</strong>'
            +     '</div>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeOverlay(\'ew-fx-overlay\')">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-fx-btn" onclick="EW_doFxOverride()">Save</button>'
            +   '</div></div></div>';

        EW.state._fxRecordId = rec.id;
        EW.state._fxVersion = rec.version;
        EW.state._fxAmount = curAmt;
        document.body.insertAdjacentHTML('beforeend', html);
        bindOverlayClose('ew-fx-overlay');
    }

    window.EW_fxPreview = function() {
        var rate = parseFloat(document.getElementById('ew-fx-rate').value);
        var preview = document.getElementById('ew-fx-preview');
        if (preview && !isNaN(rate)) {
            preview.textContent = fmtAmount(EW.state._fxAmount * rate);
        }
    };

    window.EW_doFxOverride = function() {
        var rate = document.getElementById('ew-fx-rate').value.trim();
        if (!rate) { EW.toast.show('Enter a rate.', 'warning'); return; }

        var btn = document.getElementById('ew-fx-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }

        EW.api.saveRecord(EW.state._fxRecordId, {
            version: EW.state._fxVersion,
            fx_rate_to_eur: rate,
            fx_rate_date: document.getElementById('ew-fx-date').value || '',
            fx_rate_source: document.getElementById('ew-fx-source').value || 'manual_override'
        }).then(function() {
            EW.toast.show('FX rate overridden', 'success');
            EW_closeOverlay('ew-fx-overlay');
            EW.table.load();
        }).catch(function(e) {
            EW.toast.show('FX override failed: ' + e.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        });
    };

    // ── GL Override dialog ──────────────────────────────────────────────────

    function openGlOverrideDialog(selected) {
        if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
        var rec = EW.state.records && EW.state.records[selected[0].id];
        if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

        var html = '<div class="ew-overlay" id="ew-gl-overlay">'
            + '<div class="ew-dialog">'
            +   '<div class="ew-dialog-header"><h3>GL Override</h3>'
            +   '<button class="ew-dialog-close" onclick="EW_closeOverlay(\'ew-gl-overlay\')">&times;</button></div>'
            +   '<div class="ew-dialog-body">'
            +     '<div style="margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:6px;font-size:.88em">'
            +       '<div><strong>Current GL Mapping</strong></div>'
            +       '<div style="margin-top:4px">Debit: <strong>' + esc(rec.gl_debit_code || rec.gl_debit_override || '\u2014') + '</strong></div>'
            +       '<div>Credit: <strong>' + esc(rec.gl_credit_code || rec.gl_credit_override || '\u2014') + '</strong></div>'
            +       '<div>Type: <strong>' + esc(rec.internal_type || '\u2014') + '</strong>'
            +       ' | D/C: <strong>' + esc(rec.debit_credit || '\u2014') + '</strong>'
            +       ' | Amount: <strong>' + fmtAmount(parseFloat(rec.total_amount) || 0) + '</strong></div>'
            +     '</div>'
            +     '<div class="ew-f-row">'
            +       '<div class="ew-f-field"><label>Debit Account Override</label>'
            +         '<input type="text" class="ew-edit-input" id="ew-gl-debit" value="' + esc(rec.gl_debit_override || '') + '" placeholder="e.g. 1200" /></div>'
            +       '<div class="ew-f-field"><label>Credit Account Override</label>'
            +         '<input type="text" class="ew-edit-input" id="ew-gl-credit" value="' + esc(rec.gl_credit_override || '') + '" placeholder="e.g. 3100" /></div>'
            +     '</div>'
            +     '<div class="ew-f-field" style="margin-top:6px"><label>Reason for Override</label>'
            +       '<textarea class="ew-edit-input" id="ew-gl-reason" rows="3" placeholder="Why are you overriding the GL mapping?">'
            +         esc(rec.gl_override_reason || '') + '</textarea></div>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeOverlay(\'ew-gl-overlay\')">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-gl-btn" onclick="EW_doGlOverride()">Save</button>'
            +   '</div></div></div>';

        EW.state._glRecordId = rec.id;
        EW.state._glVersion = rec.version;
        document.body.insertAdjacentHTML('beforeend', html);
        bindOverlayClose('ew-gl-overlay');
    }

    window.EW_doGlOverride = function() {
        var debit = document.getElementById('ew-gl-debit').value.trim();
        var credit = document.getElementById('ew-gl-credit').value.trim();
        var reason = document.getElementById('ew-gl-reason').value.trim();

        if (!debit && !credit) { EW.toast.show('Enter at least one account.', 'warning'); return; }
        if (!reason) { EW.toast.show('Provide a reason for the override.', 'warning'); return; }

        var btn = document.getElementById('ew-gl-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }

        var fields = { version: EW.state._glVersion, gl_override_reason: reason };
        if (debit) fields.gl_debit_override = debit;
        if (credit) fields.gl_credit_override = credit;

        EW.api.saveRecord(EW.state._glRecordId, fields).then(function() {
            EW.toast.show('GL mapping overridden', 'success');
            EW_closeOverlay('ew-gl-overlay');
            EW.table.load();
        }).catch(function(e) {
            EW.toast.show('GL override failed: ' + e.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        });
    };

    // ── Flip D/C ────────────────────────────────────────────────────────────

    function executeFlipDC(selected) {
        if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
        var rec = EW.state.records && EW.state.records[selected[0].id];
        if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

        var newDC = rec.debit_credit === 'D' ? 'C' : rec.debit_credit === 'C' ? 'D' : rec.debit_credit;
        EW.api.saveRecord(rec.id, { version: rec.version, debit_credit: newDC })
            .then(function() {
                EW.toast.show('D/C flipped to ' + newDC, 'success');
                EW.table.load();
            })
            .catch(function(e) { EW.toast.show('Flip failed: ' + e.message, 'error'); });
    }

    // ── Loan Payment Split dialog ───────────────────────────────────────────

    function openLoanSplitDialog(selected) {
        if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
        var rec = EW.state.records && EW.state.records[selected[0].id];
        if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

        var amt = parseFloat(rec.total_amount) || 0;

        var html = '<div class="ew-overlay" id="ew-loansplit-overlay">'
            + '<div class="ew-dialog ew-dialog-wide">'
            +   '<div class="ew-dialog-header"><h3>Loan Payment Split</h3>'
            +   '<button class="ew-dialog-close" onclick="EW_closeOverlay(\'ew-loansplit-overlay\')">&times;</button></div>'
            +   '<div class="ew-dialog-body">'
            +     '<div class="ew-split-source">'
            +       '<div><strong>ID:</strong> ' + esc(rec.id) + '</div>'
            +       '<div><strong>Amount:</strong> ' + fmtAmount(amt) + '</div>'
            +       '<div><strong>Currency:</strong> ' + esc(rec.validated_currency || '\u2014') + '</div>'
            +       '<div><strong>Contract:</strong> ' + esc(rec.loan_id || 'Not linked') + '</div>'
            +     '</div>'
            +     '<div class="ew-split-divider">Principal / Interest Allocation</div>'
            +     '<div class="ew-f-row">'
            +       '<div class="ew-f-field"><label>Principal Amount</label>'
            +         '<input type="number" step="any" class="ew-edit-input" id="ew-ls-principal" oninput="EW_lsCalc()" /></div>'
            +       '<div class="ew-f-field"><label>Interest Amount</label>'
            +         '<input type="number" step="any" class="ew-edit-input" id="ew-ls-interest" oninput="EW_lsCalc()" /></div>'
            +     '</div>'
            +     '<div id="ew-ls-variance" style="margin-top:8px"></div>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeOverlay(\'ew-loansplit-overlay\')">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-ls-btn" onclick="EW_doLoanSplit()">Split</button>'
            +   '</div></div></div>';

        EW.state._lsRecordId = rec.id;
        EW.state._lsLoanId = rec.loan_id || '';
        EW.state._lsAmount = amt;
        document.body.insertAdjacentHTML('beforeend', html);
        bindOverlayClose('ew-loansplit-overlay');
    }

    window.EW_lsCalc = function() {
        var p = parseFloat(document.getElementById('ew-ls-principal').value) || 0;
        var i = parseFloat(document.getElementById('ew-ls-interest').value) || 0;
        var total = p + i;
        var diff = Math.abs(total - EW.state._lsAmount);
        var pct = EW.state._lsAmount ? (diff / Math.abs(EW.state._lsAmount)) * 100 : 0;
        var cls = pct < 1 ? 'ok' : pct < 5 ? 'warn' : 'err';
        var clsMap = { ok: 'background:#f0fdf4;color:#16a34a', warn: 'background:#fffbeb;color:#d97706', err: 'background:#fef2f2;color:#dc2626' };

        var el = document.getElementById('ew-ls-variance');
        if (el) {
            el.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.78em;font-weight:600;padding:3px 8px;border-radius:4px;'
                + clsMap[cls] + '">'
                + 'Sum: ' + fmtAmount(total) + ' / ' + fmtAmount(EW.state._lsAmount)
                + ' (variance: ' + pct.toFixed(1) + '%)'
                + '</span>';
        }
    };

    window.EW_doLoanSplit = function() {
        var principal = parseFloat(document.getElementById('ew-ls-principal').value);
        var interest = parseFloat(document.getElementById('ew-ls-interest').value);
        if (isNaN(principal) || isNaN(interest)) { EW.toast.show('Enter both amounts.', 'warning'); return; }

        var btn = document.getElementById('ew-ls-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Splitting\u2026'; }

        EW.api.splitLoan(EW.state._lsRecordId, EW.state._lsLoanId, principal, interest)
            .then(function() {
                EW.toast.show('Loan payment split completed', 'success');
                EW_closeOverlay('ew-loansplit-overlay');
                EW.state.selectedIds = [];
                EW.table.load();
            })
            .catch(function(e) {
                EW.toast.show('Loan split failed: ' + e.message, 'error');
                if (btn) { btn.disabled = false; btn.textContent = 'Split'; }
            });
    };

    // ── Link to Loan Contract dialog ────────────────────────────────────────

    function openLinkLoanDialog(selected) {
        if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
        var rec = EW.state.records && EW.state.records[selected[0].id];
        if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

        var html = '<div class="ew-overlay" id="ew-linkloan-overlay">'
            + '<div class="ew-dialog">'
            +   '<div class="ew-dialog-header"><h3>Link to Loan Contract</h3>'
            +   '<button class="ew-dialog-close" onclick="EW_closeOverlay(\'ew-linkloan-overlay\')">&times;</button></div>'
            +   '<div class="ew-dialog-body">'
            +     '<p>Current: <strong>' + esc(rec.loan_id || 'Not linked') + '</strong></p>'
            +     '<div class="ew-f-field" style="margin-top:10px"><label>Loan Contract ID</label>'
            +       '<input type="text" class="ew-edit-input" id="ew-ll-loanid" placeholder="e.g. LC-2024-001" '
            +       'value="' + esc(rec.loan_id || '') + '" /></div>'
            +     '<p style="margin-top:10px;font-size:.82em;color:#64748b;font-style:italic">'
            +       'Loan contract lookup will be available when the Loan API is deployed.</p>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeOverlay(\'ew-linkloan-overlay\')">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-ll-btn" onclick="EW_doLinkLoan()">Link</button>'
            +   '</div></div></div>';

        EW.state._llRecordId = rec.id;
        EW.state._llVersion = rec.version;
        document.body.insertAdjacentHTML('beforeend', html);
        bindOverlayClose('ew-linkloan-overlay');
    }

    window.EW_doLinkLoan = function() {
        var loanId = document.getElementById('ew-ll-loanid').value.trim();
        if (!loanId) { EW.toast.show('Enter a loan contract ID.', 'warning'); return; }

        var btn = document.getElementById('ew-ll-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Linking\u2026'; }

        EW.api.linkLoan(EW.state._llRecordId, loanId)
            .then(function() {
                EW.toast.show('Linked to ' + loanId, 'success');
                EW_closeOverlay('ew-linkloan-overlay');
                EW.table.load();
            })
            .catch(function(e) {
                EW.toast.show('Link failed: ' + e.message, 'error');
                if (btn) { btn.disabled = false; btn.textContent = 'Link'; }
            });
    };

    // ── Trade Allocation dialog ─────────────────────────────────────────────

    function openFundAllocDialog(selected) {
        if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
        var rec = EW.state.records && EW.state.records[selected[0].id];
        if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

        // Income types → income allocation dialog
        if (INCOME_ALLOC_TYPES.indexOf(rec.internal_type) >= 0) {
            return openIncomeAllocDialog(selected);
        }

        // Check allocatable type
        if (ALLOC_TYPES.indexOf(rec.internal_type) < 0) {
            EW.toast.show('Type "' + rec.internal_type + '" is not allocatable.', 'warning');
            return;
        }
        // Check eligible status
        if (ALLOC_ELIGIBLE.indexOf(rec.status) < 0) {
            EW.toast.show('Status "' + rec.status + '" is not eligible for allocation.', 'warning');
            return;
        }
        // Check not already fully allocated
        if (rec.fund_allocation_status === 'allocated') {
            EW.toast.show('Trade is already fully allocated.', 'info');
            return;
        }

        var enrichmentId = rec.id;

        // Show dialog with loading spinner
        var html = '<div class="ew-overlay" id="ew-alloc-overlay">'
            + '<div class="ew-dialog ew-dialog-wide">'
            +   '<div class="ew-dialog-header"><h3>Trade Allocation</h3>'
            +   '<button class="ew-dialog-close" onclick="EW_closeAllocDialog()">&times;</button></div>'
            +   '<div class="ew-dialog-body" id="ew-alloc-body">'
            +     '<div class="ew-slide-loading"><i class="fas fa-spinner fa-spin"></i> Loading trade data\u2026</div>'
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeAllocDialog()">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-alloc-btn" onclick="EW_doAllocateTrade()" disabled>'
            +       '<i class="fas fa-chart-pie"></i> Allocate'
            +     '</button>'
            +   '</div></div></div>';

        document.body.insertAdjacentHTML('beforeend', html);
        bindOverlayClose('ew-alloc-overlay');

        // Load data in parallel
        Promise.all([
            EW.api.getSecuTransaction(enrichmentId),
            EW.api.getAllocationSummary(enrichmentId),
            EW.api.getCustomers(''),
            EW.api.getAssetHolders(enrichmentId)
        ]).then(function(results) {
            var secuTrx = results[0];
            var summary = results[1];
            var custData = results[2];
            var holdersData = results[3];

            var totalQty = Math.abs(parseFloat(secuTrx.quantity) || 0);
            var alreadyAllocated = parseFloat(summary.allocatedQty) || 0;
            var totalFee = parseFloat(secuTrx.fee) || 0;
            var pricePerUnit = parseFloat(secuTrx.price) || 0;

            // For a SELL, only customers who hold the asset may be allocated to
            // (a long-only fund cannot sell what a customer does not own). Show each
            // holder's available quantity in the label.
            var isSell = (secuTrx.type || '').indexOf('SELL') >= 0;
            var holders = (holdersData && holdersData.holders) || [];
            var customerList = isSell
                ? holders.map(function(h) {
                    return {
                        customerId: h.customerId,
                        displayName: (h.displayName || h.customerId) + ' — holds ' + h.quantity,
                        availableQty: h.quantity
                    };
                })
                : (custData.customers || []);

            // Store state
            EW.state._alloc = {
                enrichmentId: enrichmentId,
                rec: rec,
                secuTrx: secuTrx,
                summary: summary,
                customers: customerList,
                isSell: isSell,
                totalQty: totalQty,
                alreadyAllocatedQty: alreadyAllocated,
                totalFee: totalFee,
                pricePerUnit: pricePerUnit
            };

            var body = document.getElementById('ew-alloc-body');
            if (!body) return; // dialog was closed
            body.innerHTML = renderAllocDialogBody();
        }).catch(function(e) {
            var body = document.getElementById('ew-alloc-body');
            if (body) {
                body.innerHTML = '<div style="color:#dc2626;font-size:.88em"><i class="fas fa-exclamation-circle"></i> '
                    + 'Failed to load trade data: ' + esc(e.message) + '</div>';
            }
        });
    }

    function renderAllocDialogBody() {
        var a = EW.state._alloc;
        var secuTrx = a.secuTrx;
        var summary = a.summary;
        var totalQty = a.totalQty;
        var allocated = a.alreadyAllocatedQty;
        var remaining = totalQty - allocated;
        var pct = totalQty > 0 ? Math.min((allocated / totalQty) * 100, 100) : 0;
        var pctCls = pct === 0 ? 'empty' : pct >= 99.9999 ? 'full' : 'partial';

        // Direction badge
        var dir = (secuTrx.type || '').indexOf('SELL') >= 0 ? 'SELL' : 'BUY';
        var dirBadge = '<span class="dc-' + (dir === 'BUY' ? 'D' : 'C') + '" style="font-size:.78em;padding:2px 8px;border-radius:3px">' + dir + '</span>';

        var h = '';

        // Trade summary card
        h += '<div class="ew-alloc-summary">'
            + '<div class="ew-alloc-summary-hdr"><i class="fas fa-exchange-alt"></i> Trade Summary</div>'
            + '<div class="ew-alloc-summary-grid">'
            + '<div class="ew-alloc-field"><label>Enrichment ID</label><div>' + esc(secuTrx.enrichmentId) + '</div></div>'
            + '<div class="ew-alloc-field"><label>Date</label><div>' + esc(secuTrx.transactionDate || '\u2014') + '</div></div>'
            + '<div class="ew-alloc-field"><label>Direction</label><div>' + dirBadge + '</div></div>'
            + '<div class="ew-alloc-field"><label>Asset</label><div>' + esc(secuTrx.ticker || '\u2014')
            + (secuTrx.assetIsin ? ' <span style="font-size:.78em;color:#94a3b8">(' + esc(secuTrx.assetIsin) + ')</span>' : '') + '</div></div>'
            + '<div class="ew-alloc-field"><label>Currency</label><div>' + esc(secuTrx.currency || '\u2014') + '</div></div>'
            + '<div class="ew-alloc-field"><label>Total Qty</label><div class="mono">' + fmtAmount(totalQty) + '</div></div>'
            + '<div class="ew-alloc-field"><label>Price</label><div class="mono">' + fmtAmount(secuTrx.price) + '</div></div>'
            + '<div class="ew-alloc-field"><label>Amount</label><div class="mono">' + fmtAmount(secuTrx.amount) + '</div></div>'
            + '<div class="ew-alloc-field"><label>Fee</label><div class="mono">' + fmtAmount(secuTrx.fee) + '</div></div>'
            + '</div></div>';

        // Progress bar
        h += '<div class="ew-alloc-progress-row">'
            + '<span>Allocated: ' + fmtAmount(allocated) + ' / ' + fmtAmount(totalQty) + '</span>'
            + '<div class="ew-alloc-progress-bar"><div class="ew-alloc-progress-fill ' + pctCls + '" style="width:' + pct.toFixed(1) + '%"></div></div>'
            + '<span>' + (summary.lotCount || 0) + ' lot' + ((summary.lotCount || 0) !== 1 ? 's' : '') + '</span>'
            + '</div>';

        // Existing lots table
        var lots = summary.lots || [];
        if (lots.length > 0) {
            h += '<div class="ew-split-divider">Existing Lots</div>';
            h += '<table class="ew-alloc-lots-table"><thead><tr>'
                + '<th>Lot ID</th><th>Customer</th><th style="text-align:right">Qty</th><th>Direction</th>'
                + '</tr></thead><tbody>';
            for (var i = 0; i < lots.length; i++) {
                var lot = lots[i];
                h += '<tr>'
                    + '<td>' + esc(lot.lotId) + '</td>'
                    + '<td>' + esc(lot.customerName || lot.customerId) + '</td>'
                    + '<td style="text-align:right;font-family:monospace">' + fmtAmount(lot.quantity) + '</td>'
                    + '<td>' + esc(lot.direction || '\u2014') + '</td>'
                    + '</tr>';
            }
            h += '</tbody></table>';
        }

        // New allocation form
        if (remaining > 0.000001) {
            h += '<div class="ew-split-divider">New Allocation</div>';

            // Customer dropdown
            var customers = a.customers;
            if (a.isSell && customers.length === 0) {
                h += '<div style="color:#b45309;font-size:.85em;padding:6px 0">'
                    + '<i class="fas fa-info-circle"></i> No customer holds this asset, so this sale '
                    + 'cannot be allocated. Allocate the matching purchase(s) first.</div>';
            }
            var custOpts = '<option value="">Select customer\u2026</option>';
            for (var c = 0; c < customers.length; c++) {
                custOpts += '<option value="' + esc(customers[c].customerId) + '">'
                    + esc(customers[c].displayName || customers[c].customerId) + '</option>';
            }
            h += '<div class="ew-f-row">'
                + '<div class="ew-f-field"><label>Customer</label>'
                + '<select class="ew-edit-select" id="ew-alloc-customer" onchange="EW_updateAllocPreview()">' + custOpts + '</select></div>'
                + '<div class="ew-f-field"><label>Quantity</label>'
                + '<div style="display:flex;gap:6px;align-items:center">'
                + '<input type="number" step="any" class="ew-edit-input" id="ew-alloc-qty" placeholder="0" oninput="EW_updateAllocPreview()" />'
                + '<button class="ew-alloc-fill-btn" onclick="document.getElementById(\'ew-alloc-qty\').value=' + remaining + ';EW_updateAllocPreview()">'
                + '<i class="fas fa-fill-drip"></i> Fill remaining</button>'
                + '</div></div>'
                + '</div>';

            // Preview box
            h += '<div class="ew-alloc-preview" id="ew-alloc-preview" style="display:none">'
                + '<div class="ew-alloc-preview-hdr">Allocation Preview</div>'
                + '<div class="ew-alloc-preview-body" id="ew-alloc-preview-body"></div>'
                + '</div>';
        } else {
            h += '<div style="margin-top:12px;padding:10px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;font-size:.88em;color:#065f46;font-weight:600">'
                + '<i class="fas fa-check-circle"></i> Trade is fully allocated.</div>';
        }

        return h;
    }

    window.EW_updateAllocPreview = function() {
        var a = EW.state._alloc;
        if (!a) return;

        var custEl = document.getElementById('ew-alloc-customer');
        var qtyEl = document.getElementById('ew-alloc-qty');
        var previewEl = document.getElementById('ew-alloc-preview');
        var previewBody = document.getElementById('ew-alloc-preview-body');
        var btn = document.getElementById('ew-alloc-btn');

        if (!custEl || !qtyEl || !previewEl || !previewBody) return;

        var customerId = custEl.value;
        var qty = parseFloat(qtyEl.value) || 0;

        if (!customerId || qty <= 0) {
            previewEl.style.display = 'none';
            if (btn) btn.disabled = true;
            return;
        }

        var remaining = a.totalQty - a.alreadyAllocatedQty;
        var overAllocated = qty > remaining + 0.000001;
        var amount = qty * a.pricePerUnit;
        var feeShare = a.totalQty > 0 ? (qty / a.totalQty) * a.totalFee : 0;
        var totalCost = amount + feeShare;
        var remainingAfter = remaining - qty;

        var bodyHtml = '<div class="ew-alloc-preview-row"><span>Amount</span><span>' + fmtAmount(amount) + '</span></div>'
            + '<div class="ew-alloc-preview-row"><span>Fee share</span><span>' + fmtAmount(feeShare) + '</span></div>'
            + '<div class="ew-alloc-preview-row total"><span>Total cost</span><span>' + fmtAmount(totalCost) + '</span></div>'
            + '<div class="ew-alloc-preview-row' + (overAllocated ? ' over' : '') + '"><span>Remaining after</span><span>'
            + fmtAmount(remainingAfter) + '</span></div>';

        if (overAllocated) {
            bodyHtml += '<div style="color:#dc2626;font-size:.82em;margin-top:6px">'
                + '<i class="fas fa-exclamation-triangle"></i> Over-allocation: quantity exceeds remaining.</div>';
        }

        previewBody.innerHTML = bodyHtml;
        previewEl.style.display = 'block';

        if (btn) btn.disabled = overAllocated;
    };

    /** Show inline toast inside the allocation dialog body. */
    function showAllocInlineToast(msg, type) {
        var body = document.getElementById('ew-alloc-body');
        if (!body) return;
        var cls = type === 'success' ? 'ew-toast-success' : type === 'error' ? 'ew-toast-error' : 'ew-toast-info';
        var icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
        var toastHtml = '<div class="ew-alloc-inline-toast ' + cls + '">'
            + '<i class="fas ' + icon + '"></i> ' + esc(msg)
            + '</div>';
        body.insertAdjacentHTML('afterbegin', toastHtml);
        // Auto-fade after 3 seconds
        var toast = body.querySelector('.ew-alloc-inline-toast');
        if (toast) {
            setTimeout(function() {
                toast.style.opacity = '0';
                setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
            }, 3000);
        }
    }

    /** Replace footer buttons with "Done" when trade is fully allocated. */
    function updateAllocFooterDone() {
        var overlay = document.getElementById('ew-alloc-overlay');
        if (!overlay) return;
        var footer = overlay.querySelector('.ew-dialog-footer');
        if (footer) {
            footer.innerHTML = '<button class="ew-btn-save" onclick="EW_closeAllocDialog()">'
                + '<i class="fas fa-check"></i> Done</button>';
        }
    }

    window.EW_closeAllocDialog = function() {
        var overlay = document.getElementById('ew-alloc-overlay');
        if (overlay) overlay.remove();
        EW.state._alloc = null;
        EW.state.selectedIds = [];
        EW.table.load();  // Refresh table to reflect allocations
    };

    window.EW_doAllocateTrade = function() {
        var a = EW.state._alloc;
        if (!a) return;

        var custEl = document.getElementById('ew-alloc-customer');
        var qtyEl = document.getElementById('ew-alloc-qty');
        if (!custEl || !qtyEl) return;

        var customerId = custEl.value;
        var qty = parseFloat(qtyEl.value);
        if (!customerId) { EW.toast.show('Select a customer.', 'warning'); return; }
        if (isNaN(qty) || qty <= 0) { EW.toast.show('Enter a valid quantity.', 'warning'); return; }

        var btn = document.getElementById('ew-alloc-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Allocating\u2026';
        }

        EW.api.allocateTrade(a.enrichmentId, customerId, qty)
            .then(function(data) {
                var msg = 'Allocated ' + fmtAmount(qty) + ' units';
                if (data.allocationStatus === 'allocated') msg += ' \u2014 trade fully allocated';

                // Invalidate allocation cache so detail panel re-fetches
                if (EW.state._allocCache) delete EW.state._allocCache[a.enrichmentId];

                // Update local state
                a.alreadyAllocatedQty += qty;

                // Show inline success toast (inside dialog)
                showAllocInlineToast(msg, 'success');

                // Re-fetch allocation summary to get updated lots list
                EW.api.getAllocationSummary(a.enrichmentId).then(function(summary) {
                    a.summary = summary;
                    // Re-render dialog body (preserves overlay + header + footer)
                    var body = document.getElementById('ew-alloc-body');
                    if (body) body.innerHTML = renderAllocDialogBody();

                    // If fully allocated, update footer buttons; otherwise reset Allocate button
                    if (data.allocationStatus === 'allocated') {
                        updateAllocFooterDone();
                    } else {
                        var btn2 = document.getElementById('ew-alloc-btn');
                        if (btn2) {
                            btn2.disabled = true;
                            btn2.innerHTML = '<i class="fas fa-chart-pie"></i> Allocate';
                        }
                    }
                }).catch(function(e) {
                    console.error('[EW] Failed to refresh allocation dialog:', e);
                    var btn2 = document.getElementById('ew-alloc-btn');
                    if (btn2) {
                        btn2.disabled = false;
                        btn2.innerHTML = '<i class="fas fa-chart-pie"></i> Allocate';
                    }
                });
            })
            .catch(function(e) {
                showAllocInlineToast('Allocation failed: ' + e.message, 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-chart-pie"></i> Allocate';
                }
            });
    };

    // ── Income Allocation dialog ────────────────────────────────────────────

    function openIncomeAllocDialog(selected) {
        if (selected.length !== 1) { EW.toast.show('Select exactly 1 record.', 'warning'); return; }
        var rec = EW.state.records && EW.state.records[selected[0].id];
        if (!rec) { EW.toast.show('Record not in cache.', 'error'); return; }

        // Check eligible status
        if (ALLOC_ELIGIBLE.indexOf(rec.status) < 0) {
            EW.toast.show('Status "' + rec.status + '" not eligible for allocation.', 'warning');
            return;
        }
        // Check not already allocated
        if (rec.fund_allocation_status === 'allocated') {
            EW.toast.show('Income is already fully allocated.', 'info');
            return;
        }
        // Check asset is resolved
        if (!rec.resolved_asset_id) {
            EW.toast.show('No asset linked. Resolve the asset before allocating income.', 'warning');
            return;
        }

        // Store state with date defaults
        var defaultEnd = rec.transaction_date || '';
        var defaultStart = '';
        if (defaultEnd) {
            var d = new Date(defaultEnd);
            d.setDate(d.getDate() - 90);
            defaultStart = d.toISOString().substring(0, 10);
        }
        EW.state._incomeAlloc = {
            enrichmentId: rec.id,
            rec: rec,
            periodStart: defaultStart,
            periodEnd: defaultEnd,
            preview: null,
            phase: 'input'
        };

        // Render dialog shell
        var html = '<div class="ew-overlay" id="ew-income-alloc-overlay">'
            + '<div class="ew-dialog ew-dialog-wide">'
            +   '<div class="ew-dialog-header"><h3>Income Allocation</h3>'
            +   '<button class="ew-dialog-close" onclick="EW_closeIncomeAllocDialog()">&times;</button></div>'
            +   '<div class="ew-dialog-body" id="ew-income-alloc-body">'
            +     renderIncomeAllocBody()
            +   '</div>'
            +   '<div class="ew-dialog-footer">'
            +     '<button class="ew-btn-cancel" onclick="EW_closeIncomeAllocDialog()">Cancel</button>'
            +     '<button class="ew-btn-save" id="ew-income-alloc-btn" onclick="EW_doAllocateIncome()">'
            +       '<i class="fas fa-coins"></i> Allocate Income'
            +     '</button>'
            +   '</div></div></div>';

        document.body.insertAdjacentHTML('beforeend', html);
        bindOverlayClose('ew-income-alloc-overlay');

        // Listen for date changes → reset to input phase if in confirm phase
        var startEl = document.getElementById('ew-ia-start');
        var endEl = document.getElementById('ew-ia-end');
        var resetToInput = function() {
            var ia = EW.state._incomeAlloc;
            if (ia && ia.phase === 'confirm') {
                ia.phase = 'input';
                ia.preview = null;
                var container = document.getElementById('ew-ia-preview-container');
                if (container) container.innerHTML = '';
                var btn = document.getElementById('ew-income-alloc-btn');
                if (btn) btn.innerHTML = '<i class="fas fa-coins"></i> Allocate Income';
            }
        };
        if (startEl) startEl.addEventListener('change', resetToInput);
        if (endEl) endEl.addEventListener('change', resetToInput);
    }

    function renderIncomeAllocBody() {
        var ia = EW.state._incomeAlloc;
        var rec = ia.rec;
        var h = '';

        // Income summary card
        h += '<div class="ew-alloc-summary">'
            + '<div class="ew-alloc-summary-hdr"><i class="fas fa-hand-holding-usd"></i> Income Summary</div>'
            + '<div class="ew-alloc-summary-grid">'
            + '<div class="ew-alloc-field"><label>Enrichment ID</label><div>' + esc(rec.id) + '</div></div>'
            + '<div class="ew-alloc-field"><label>Type</label><div>' + esc(rec.internal_type) + '</div></div>'
            + '<div class="ew-alloc-field"><label>Asset</label><div>' + esc(rec.resolved_asset_id || '\u2014')
            +   (rec.asset_isin ? ' <span style="font-size:.78em;color:#94a3b8">(' + esc(rec.asset_isin) + ')</span>' : '')
            + '</div></div>'
            + '<div class="ew-alloc-field"><label>Amount</label><div class="mono">' + fmtAmount(rec.total_amount) + ' ' + esc(rec.validated_currency || rec.original_currency || '') + '</div></div>'
            + '<div class="ew-alloc-field"><label>Date</label><div>' + esc(rec.transaction_date || '\u2014') + '</div></div>'
            + '<div class="ew-alloc-field"><label>FX Rate</label><div class="mono">' + (rec.fx_rate_to_eur || '\u2014') + '</div></div>'
            + '</div></div>';

        // Accrual period inputs
        h += '<div class="ew-split-divider">Accrual Period</div>';
        h += '<div class="ew-f-row">'
            + '<div class="ew-f-field"><label>Start Date</label>'
            + '<input type="date" class="ew-edit-input" id="ew-ia-start" value="' + esc(ia.periodStart) + '" /></div>'
            + '<div class="ew-f-field"><label>End Date</label>'
            + '<input type="date" class="ew-edit-input" id="ew-ia-end" value="' + esc(ia.periodEnd) + '" /></div>'
            + '</div>';
        h += '<div style="font-size:.78em;color:#94a3b8;margin-top:2px">'
            + '<i class="fas fa-info-circle"></i> '
            + 'Typically: ex-dividend date to record date. '
            + 'System reconstructs daily holdings from allocation lots in this period.</div>';

        // Preview placeholder
        h += '<div id="ew-ia-preview-container"></div>';

        return h;
    }

    function renderIncomePreviewTable(preview) {
        var allocs = preview.allocations || [];
        if (allocs.length === 0) {
            return '<div style="color:#dc2626;margin-top:12px;font-size:.88em">'
                + '<i class="fas fa-exclamation-circle"></i> No customers held this asset during the period.</div>';
        }

        var totalShareDays = parseFloat(preview.totalShareDays) || 0;
        var currency = preview.currency || '';
        var periodDays = 0;
        if (preview.accrualPeriodStart && preview.accrualPeriodEnd) {
            var d1 = new Date(preview.accrualPeriodStart), d2 = new Date(preview.accrualPeriodEnd);
            periodDays = Math.round((d2 - d1) / 86400000) + 1;
        }

        var h = '<div class="ew-split-divider">Allocation Preview</div>';
        h += '<table class="ew-alloc-lots-table"><thead><tr>'
            + '<th>Customer</th>'
            + '<th style="text-align:right">Days Held</th>'
            + '<th style="text-align:right">Avg Qty</th>'
            + '<th style="text-align:right">Share-Days</th>'
            + '<th style="text-align:right">Pct</th>'
            + '<th style="text-align:right">Amount (' + esc(currency) + ')</th>'
            + '<th style="text-align:right">EUR</th>'
            + '</tr></thead><tbody>';

        var sumAmt = 0, sumEur = 0;
        for (var i = 0; i < allocs.length; i++) {
            var a = allocs[i];
            var pct = parseFloat(a.allocationPct) || 0;
            var amt = parseFloat(a.allocatedAmount) || 0;
            var eur = parseFloat(a.allocatedAmountEur) || 0;
            sumAmt += amt;
            sumEur += eur;

            h += '<tr>'
                + '<td>' + esc(a.customerName || a.customerId) + '</td>'
                + '<td style="text-align:right">' + (a.holdingDays || '\u2014') + '</td>'
                + '<td style="text-align:right;font-family:monospace">' + fmtAmount(a.avgQtyHeld) + '</td>'
                + '<td style="text-align:right;font-family:monospace">' + fmtAmount(a.shareDays) + '</td>'
                + '<td style="text-align:right">' + (pct * 100).toFixed(2) + '%</td>'
                + '<td style="text-align:right;font-family:monospace">' + fmtAmount(amt) + '</td>'
                + '<td style="text-align:right;font-family:monospace">' + fmtAmount(eur) + '</td>'
                + '</tr>';
        }

        h += '<tr class="ew-alloc-lots-total">'
            + '<td><strong>TOTAL</strong></td>'
            + '<td></td><td></td>'
            + '<td style="text-align:right;font-family:monospace"><strong>' + fmtAmount(totalShareDays) + '</strong></td>'
            + '<td style="text-align:right"><strong>100.00%</strong></td>'
            + '<td style="text-align:right;font-family:monospace"><strong>' + fmtAmount(sumAmt) + '</strong></td>'
            + '<td style="text-align:right;font-family:monospace"><strong>' + fmtAmount(sumEur) + '</strong></td>'
            + '</tr>';

        h += '</tbody></table>';

        h += '<div style="font-size:.78em;color:#64748b;margin-top:6px">'
            + 'Total share-days: ' + fmtAmount(totalShareDays)
            + ' \u00B7 ' + allocs.length + ' customer' + (allocs.length !== 1 ? 's' : '')
            + ' \u00B7 ' + periodDays + ' day period'
            + '</div>';

        return h;
    }

    window.EW_doAllocateIncome = function() {
        var ia = EW.state._incomeAlloc;
        if (!ia) return;

        var btn = document.getElementById('ew-income-alloc-btn');

        // ── Confirm phase: preview exists, commit the allocation ──
        if (ia.phase === 'confirm' && ia.preview) {
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Allocating\u2026'; }
            ia.phase = 'allocating';

            EW.api.allocateIncome(ia.enrichmentId, ia.periodStart, ia.periodEnd)
                .then(function(result) {
                    var count = (result.allocations || []).length;
                    EW.toast.show('Income allocated to ' + count + ' customer' + (count !== 1 ? 's' : '') + '.', 'success');
                    if (EW.state._allocCache) delete EW.state._allocCache[ia.enrichmentId];
                    var eid = ia.enrichmentId;
                    EW_closeIncomeAllocDialog();
                    EW.table.load();
                    setTimeout(function() { EW.detail.open(eid); }, 400);
                })
                .catch(function(e) {
                    EW.toast.show('Allocation failed: ' + e.message, 'error');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirm & Allocate'; }
                    ia.phase = 'confirm';
                });
            return;
        }

        // ── Input phase: validate dates, call preview API ──
        var startEl = document.getElementById('ew-ia-start');
        var endEl = document.getElementById('ew-ia-end');
        var start = startEl ? startEl.value : '';
        var end = endEl ? endEl.value : '';

        if (!start) { EW.toast.show('Enter the accrual period start date.', 'warning'); return; }
        if (!end) { EW.toast.show('Enter the accrual period end date.', 'warning'); return; }
        if (end < start) { EW.toast.show('End date must be after start date.', 'warning'); return; }

        // Period > 366 days warning (non-blocking)
        var daysDiff = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
        if (daysDiff > 366) {
            EW.toast.show('Accrual period is ' + daysDiff + ' days \u2014 verify this is correct.', 'warning');
        }

        ia.periodStart = start;
        ia.periodEnd = end;
        ia.phase = 'loading';

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Computing\u2026'; }

        var container = document.getElementById('ew-ia-preview-container');
        if (container) {
            container.innerHTML = '<div class="ew-slide-loading" style="margin:12px 0">'
                + '<i class="fas fa-spinner fa-spin"></i> Computing share-days allocation\u2026</div>';
        }

        EW.api.previewIncomeAllocation(ia.enrichmentId, start, end)
            .then(function(preview) {
                ia.preview = preview;
                var container = document.getElementById('ew-ia-preview-container');
                if (container) container.innerHTML = renderIncomePreviewTable(preview);

                if (preview.allocations && preview.allocations.length > 0) {
                    ia.phase = 'confirm';
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirm & Allocate'; }
                } else {
                    ia.phase = 'input';
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-coins"></i> Allocate Income'; }
                }
            })
            .catch(function(e) {
                var container = document.getElementById('ew-ia-preview-container');
                if (container) {
                    container.innerHTML = '<div style="color:#dc2626;font-size:.88em;margin:12px 0">'
                        + '<i class="fas fa-exclamation-circle"></i> ' + esc(e.message) + '</div>';
                }
                ia.phase = 'input';
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-coins"></i> Allocate Income'; }
            });
    };

    window.EW_closeIncomeAllocDialog = function() {
        var overlay = document.getElementById('ew-income-alloc-overlay');
        if (overlay) overlay.remove();
        EW.state._incomeAlloc = null;
    };

    // ── Shared overlay helpers ──────────────────────────────────────────────

    function bindOverlayClose(overlayId) {
        var overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === this) EW_closeOverlay(overlayId);
            });
        }
    }

    window.EW_closeOverlay = function(overlayId) {
        var overlay = document.getElementById(overlayId);
        if (overlay) overlay.remove();
    };

    // ── Init ────────────────────────────────────────────────────────────────

    EW.actions.init = function() {
        // Toolbar rendered by ew-main.js or ew-nav.js
    };

})(window.EW || (window.EW = {}));
