/**
 * ew-main.js — bootstrap and event wiring.
 */
(function(EW) {
    'use strict';

    function init() {
        // Tag content-level ancestors so CSS can zero their padding.
        // Stop before .hasAnalyzer (Joget minimized sidebar spacer) and body.
        var root = document.getElementById('ew-root');
        if (root) {
            var p = root.parentElement;
            while (p && p !== document.body && p !== document.documentElement) {
                if (p.classList.contains('hasAnalyzer')) break;
                p.classList.add('ew-app-host');
                p = p.parentElement;
            }
        }

        EW.nav.init();
        EW.actions.init();
        EW.filters.init();

        // Render initial view — dashboard always renders (panel shell hosts filters)
        if (EW.dashboard && EW.dashboard.render) {
            EW.dashboard.render();
        }
        EW.actions.renderToolbar();
        if (EW.filters.renderForView) {
            EW.filters.renderForView(EW.state.currentView);
        }
        EW.table.renderThead();
        EW.table.load();
    }

    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window.EW || (window.EW = {}));
