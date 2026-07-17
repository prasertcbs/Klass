/* PWA wiring shared by all Klass pages: service worker + optional install button. */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (err) {
            console.warn('Service worker registration failed:', err);
        });
    });
}

(function () {
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('installBtn');
        if (btn) btn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', function () {
        deferredPrompt = null;
        const btn = document.getElementById('installBtn');
        if (btn) btn.classList.add('hidden');
    });

    document.addEventListener('DOMContentLoaded', function () {
        const btn = document.getElementById('installBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.finally(function () {
                deferredPrompt = null;
                btn.classList.add('hidden');
            });
        });
    });
})();
