/* KQR — render a projector-sized QR code from typed text/URL.
   Uses the vendored qrcode-generator library (global `qrcode`). */

(function () {
    'use strict';

    const HISTORY_KEY = 'kqr.history';
    const HISTORY_MAX = 10;
    const QUIET_ZONE = 4; // modules of white border required by the QR spec

    const els = {
        input: document.getElementById('dataInput'),
        canvas: document.getElementById('qrCanvas'),
        frame: document.getElementById('qrFrame'),
        empty: document.getElementById('qrEmpty'),
        caption: document.getElementById('qrCaption'),
        charCount: document.getElementById('charCount'),
        paste: document.getElementById('pasteBtn'),
        clear: document.getElementById('clearBtn'),
        download: document.getElementById('downloadBtn'),
        chips: document.getElementById('historyChips'),
        historyEmpty: document.getElementById('historyEmpty'),
        clearHistory: document.getElementById('clearHistoryBtn'),
        status: document.getElementById('statusBar'),
    };

    let debounceId = null;
    let historySaveId = null;
    let current = '';

    function loadHistory() {
        try {
            const raw = JSON.parse(localStorage.getItem(HISTORY_KEY));
            return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string') : [];
        } catch {
            return [];
        }
    }

    function saveToHistory(text) {
        const history = [text, ...loadHistory().filter((s) => s !== text)].slice(0, HISTORY_MAX);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        renderHistory();
    }

    function renderHistory() {
        const history = loadHistory();
        els.chips.replaceChildren();
        if (history.length === 0) {
            els.chips.appendChild(els.historyEmpty);
            return;
        }
        for (const text of history) {
            const chip = document.createElement('button');
            chip.className = 'chip';
            chip.type = 'button';
            chip.textContent = text;
            chip.title = text;
            chip.addEventListener('click', () => {
                els.input.value = text;
                render(text);
            });
            els.chips.appendChild(chip);
        }
    }

    function render(text) {
        current = text;
        els.charCount.textContent = String(text.length);

        if (!text) {
            els.frame.hidden = true;
            els.caption.hidden = true;
            els.empty.hidden = false;
            els.download.disabled = true;
            setStatus('');
            return;
        }

        let qr;
        try {
            qr = qrcode(0, 'M'); // type 0 = pick smallest version that fits
            qr.addData(text);
            qr.make();
        } catch {
            els.frame.hidden = true;
            els.caption.hidden = true;
            els.empty.hidden = false;
            els.download.disabled = true;
            setStatus('Too long to encode as a QR code — shorten the text.');
            return;
        }

        const count = qr.getModuleCount();
        // Fixed 8px per module keeps the bitmap crisp at any display size
        // (CSS scales the canvas; image-rendering: pixelated avoids blur).
        const scale = 8;
        const size = (count + QUIET_ZONE * 2) * scale;
        els.canvas.width = size;
        els.canvas.height = size;

        const ctx = els.canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000';
        for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
                if (qr.isDark(r, c)) {
                    ctx.fillRect((c + QUIET_ZONE) * scale, (r + QUIET_ZONE) * scale, scale, scale);
                }
            }
        }

        els.empty.hidden = true;
        els.frame.hidden = false;
        els.caption.hidden = false;
        els.caption.textContent = text;
        els.download.disabled = false;
        setStatus(`${count}×${count} modules · scan with any camera app`);

        // Save after the user pauses typing so half-typed URLs don't pollute history.
        clearTimeout(historySaveId);
        historySaveId = setTimeout(() => {
            if (current === text) saveToHistory(text);
        }, 2000);
    }

    function setStatus(msg) {
        els.status.textContent = msg;
    }

    els.input.addEventListener('input', () => {
        clearTimeout(debounceId);
        debounceId = setTimeout(() => render(els.input.value.trim()), 150);
    });

    els.paste.addEventListener('click', async () => {
        try {
            const text = (await navigator.clipboard.readText()).trim();
            if (text) {
                els.input.value = text;
                render(text);
            }
        } catch {
            setStatus('Clipboard unavailable — paste into the box with Ctrl+V instead.');
        }
    });

    els.clear.addEventListener('click', () => {
        els.input.value = '';
        render('');
        els.input.focus();
    });

    els.download.addEventListener('click', () => {
        els.canvas.toBlob((blob) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'kqr-code.png';
            a.click();
            URL.revokeObjectURL(a.href);
        }, 'image/png');
    });

    els.clearHistory.addEventListener('click', () => {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    });

    renderHistory();
    els.input.focus();
})();
