/* PWA wiring shared by all Klass pages: service worker + optional install button. */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (err) {
            console.warn('Service worker registration failed:', err);
        });
    });

    // When an updated service worker takes over (new deploy), reload once so
    // the page immediately runs the new version instead of requiring a second
    // manual reload. Skipped on first-ever install (no previous controller).
    var hadController = !!navigator.serviceWorker.controller;
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController || reloaded) return;
        reloaded = true;
        window.location.reload();
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
