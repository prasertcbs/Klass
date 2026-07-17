/* Shared helpers for Klass apps: list shuffling and CSV export.
   Classic script — load before a page's own script (see assets/theme.js). */

(function () {
    /* Fisher-Yates. Returns a new array; callers needing in-place semantics
       assign the result back over their own list. */
    function shuffle(list) {
        const out = [...list];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    /* Every field is quoted, so names containing commas, quotes, or line breaks
       survive a round-trip into Excel or Sheets. */
    function toCsv(rows) {
        return rows
            .map((row) =>
                row
                    .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
                    .join(',')
            )
            .join('\n');
    }

    /* The BOM makes Excel read the file as UTF-8 rather than mojibake. */
    function downloadCsv(filename, text) {
        const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    window.KlassUtil = { shuffle, toCsv, downloadCsv };
})();
