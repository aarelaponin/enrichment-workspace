/**
 * ew-toast.js — toast notification system (placeholder for Phase R).
 */
(function(EW) {
    'use strict';

    /**
     * Show a toast notification. Currently logs to console; full UI in Phase 5.
     * @param {string} message
     * @param {string} type - 'success' | 'error' | 'warning' | 'info'
     */
    EW.toast.show = function(message, type) {
        var prefix = type ? '[' + type.toUpperCase() + '] ' : '';
        if (type === 'error') {
            console.error(prefix + message);
        } else {
            console.log(prefix + message);
        }
    };

})(window.EW || (window.EW = {}));
