(function() {
    const g = typeof self !== 'undefined' ? self : globalThis;
    if (typeof g.window === 'undefined') {
        Object.defineProperty(g, 'window', { value: g });
    }
    if (typeof g.global === 'undefined') {
        Object.defineProperty(g, 'global', { value: g });
    }
    g.history = g.history || {};
    if (typeof g.crypto === 'undefined' && g.msCrypto) {
        g.crypto = g.msCrypto;
    }
})();