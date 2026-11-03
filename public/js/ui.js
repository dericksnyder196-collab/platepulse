/* public/js/ui.js
 * Small shared interface helpers. Text is always inserted with textContent.
 */
(function () {
    const REGION_ID = 'toastRegion';

    // The live region must exist before a message is added, so screen readers announce it.
    function getRegion() {
        let region = document.getElementById(REGION_ID);
        if (!region) {
            region = document.createElement('div');
            region.id = REGION_ID;
            region.className = 'toast-region';
            region.setAttribute('role', 'status');
            region.setAttribute('aria-live', 'polite');
            document.body.append(region);
        }
        return region;
    }

    function toast(message, { duration = 5000 } = {}) {
        const item = document.createElement('div');
        item.className = 'toast';
        item.textContent = message;
        getRegion().append(item);
        window.setTimeout(() => item.remove(), duration);
    }

    getRegion();
    window.PlatePulseUI = { toast };
})();
