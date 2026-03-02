/**
 * ew-main.js — bootstrap and event wiring.
 */
(function(EW) {
    'use strict';

    function init() {
        EW.tabs.init();
        EW.table.renderThead();
        EW.actions.init();
        EW.filters.init();
        EW.table.load();
    }

    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window.EW || (window.EW = {}));
