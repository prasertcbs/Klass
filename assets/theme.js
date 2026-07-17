/* Shared Tailwind config + light/dark theme handling for all Klass pages.
   Load order: assets/tailwind.js first, then this file (synchronously, in <head>). */

if (typeof tailwind !== 'undefined') tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                brand: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    900: '#312e81',
                },
            },
        },
    },
};

(function () {
    const KEY = 'klass-theme';

    function current() {
        return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
    }

    function apply(theme) {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            const accent = getComputedStyle(document.documentElement)
                .getPropertyValue('--accent').trim() || '#4f46e5';
            meta.setAttribute('content', theme === 'dark' ? '#0f172a' : accent);
        }
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    apply(current());

    window.KlassTheme = {
        toggle() {
            const next = current() === 'dark' ? 'light' : 'dark';
            localStorage.setItem(KEY, next);
            apply(next);
        },
    };

    document.addEventListener('DOMContentLoaded', function () {
        apply(current());
        const btn = document.getElementById('themeToggle');
        if (btn) btn.addEventListener('click', window.KlassTheme.toggle);
    });
})();
