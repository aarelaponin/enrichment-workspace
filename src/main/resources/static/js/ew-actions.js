/**
 * ew-actions.js — toolbar button handlers and selection management.
 *
 * All action buttons are stubs in Phase 2 — they log + toast "Not yet implemented".
 * Actual logic wired in Phase 5 (confirm, split/merge, reprocess, delete).
 */
(function(EW) {
    'use strict';

    EW.actions = {};

    // ── Toolbar definitions per tab ─────────────────────────────────────────

    var TOOLBAR_WORKSPACE = [
        { id: 'confirmForPosting', label: 'Confirm for Posting', icon: 'fas fa-paper-plane',
            enabled: function(sel) { return sel.some(function(s) { return s.status === 'ready'; }); } },
        { id: 'markReady', label: 'Mark as Ready', icon: 'fas fa-check',
            enabled: function(sel) { return sel.some(function(s) { return ['enriched','adjusted','in_review','paired'].indexOf(s.status) >= 0; }); } },
        { type: 'separator' },
        { id: 'splitRecord', label: 'Split', icon: 'fas fa-code-branch',
            enabled: function(sel) { return sel.length === 1 && ['enriched','adjusted','in_review','ready'].indexOf(sel[0].status) >= 0; } },
        { id: 'mergeRecords', label: 'Merge', icon: 'fas fa-compress',
            enabled: function(sel) { return sel.length >= 2 && sel.every(function(s) { return ['enriched','adjusted','in_review'].indexOf(s.status) >= 0; }); } },
        { type: 'separator' },
        { id: 'reprocess', label: 'Reprocess', icon: 'fas fa-redo',
            enabled: function(sel) { return sel.some(function(s) { return ['error','manual_review'].indexOf(s.status) >= 0; }); } },
        { id: 'deleteRecord', label: 'Delete', icon: 'fas fa-trash',
            enabled: function(sel) { return sel.some(function(s) { return ['new','error','manual_review'].indexOf(s.status) >= 0; }); } },
        { type: 'spacer' },
        { id: 'newManual', label: 'New Manual Entry', icon: 'fas fa-plus',
            enabled: function() { return true; } }
    ];

    var TOOLBAR_READY = [
        { id: 'confirmForPosting', label: 'Confirm for Posting', icon: 'fas fa-paper-plane',
            enabled: function(sel) { return sel.length > 0; } },
        { id: 'returnToWorkspace', label: 'Return to Workspace', icon: 'fas fa-undo',
            enabled: function(sel) { return sel.length > 0; } }
    ];

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

    // ── Toolbar rendering ───────────────────────────────────────────────────

    /** Render toolbar buttons for the current tab. */
    EW.actions.renderToolbar = function() {
        var container = document.getElementById('ew-toolbar');
        if (!container) return;

        var tab = EW.tabs.current();
        var buttons = TOOLBARS[tab.id];

        if (!buttons || !tab.hasToolbar) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'flex';

        var html = '';
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.type === 'separator') {
                html += '<span class="ew-toolbar-sep"></span>';
            } else if (btn.type === 'spacer') {
                html += '<span class="ew-toolbar-spacer"></span>';
            } else {
                html += '<button class="ew-toolbar-btn" id="ew-action-' + btn.id + '" data-action="' + btn.id + '" disabled>'
                    + '<i class="' + btn.icon + '"></i> ' + btn.label
                    + '</button>';
            }
        }
        html += '<span class="ew-selection-pill" id="ew-selection-count" style="display:none"></span>';
        container.innerHTML = html;

        // Bind click handlers
        var actionBtns = container.querySelectorAll('.ew-toolbar-btn');
        for (var j = 0; j < actionBtns.length; j++) {
            actionBtns[j].addEventListener('click', function() {
                var action = this.getAttribute('data-action');
                EW.actions.execute(action);
            });
        }

        EW.actions.updateToolbar();
    };

    /** Enable/disable toolbar buttons based on current selection. */
    EW.actions.updateToolbar = function() {
        var tab = EW.tabs.current();
        var buttons = TOOLBARS[tab.id];
        if (!buttons) return;

        var selected = EW.actions.getSelectedRecords();

        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (!btn.id) continue;
            var el = document.getElementById('ew-action-' + btn.id);
            if (el) {
                el.disabled = !btn.enabled(selected);
            }
        }
    };

    // ── Action execution (stubs) ────────────────────────────────────────────

    EW.actions.execute = function(actionId) {
        var selected = EW.actions.getSelectedRecords();
        console.log('[EW] Action:', actionId, 'Selected:', selected);
        EW.toast.show('"' + actionId + '" is not yet implemented.', 'info');
    };

    // ── Init ────────────────────────────────────────────────────────────────

    EW.actions.init = function() {
        EW.actions.renderToolbar();
    };

})(window.EW || (window.EW = {}));
