/**
 * ew-toast.js — toast notification system.
 *
 * Shows color-coded toast messages at top-right of the viewport.
 * Auto-dismisses after 4s (success/info) or 8s (error/warning).
 */
(function(EW) {
    'use strict';

    var containerId = 'ew-toast-container';

    /** Ensure the container element exists. */
    function ensureContainer() {
        var c = document.getElementById(containerId);
        if (!c) {
            c = document.createElement('div');
            c.id = containerId;
            c.className = 'ew-toast-container';
            document.body.appendChild(c);
        }
        return c;
    }

    /**
     * Show a toast notification.
     * @param {string} message
     * @param {string} type - 'success' | 'error' | 'warning' | 'info'
     */
    EW.toast.show = function(message, type) {
        type = type || 'info';
        var container = ensureContainer();

        var toast = document.createElement('div');
        toast.className = 'ew-toast ew-toast-' + type;
        toast.textContent = message;

        // Close button
        var close = document.createElement('button');
        close.className = 'ew-toast-close';
        close.textContent = '\u00D7';
        close.onclick = function() { dismiss(toast); };
        toast.appendChild(close);

        container.appendChild(toast);

        // Trigger entrance animation
        setTimeout(function() { toast.classList.add('ew-toast-visible'); }, 10);

        // Auto-dismiss
        var delay = (type === 'error' || type === 'warning') ? 8000 : 4000;
        setTimeout(function() { dismiss(toast); }, delay);
    };

    function dismiss(el) {
        if (!el || !el.parentNode) return;
        el.classList.remove('ew-toast-visible');
        el.classList.add('ew-toast-exit');
        setTimeout(function() {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 300);
    }

})(window.EW || (window.EW = {}));
