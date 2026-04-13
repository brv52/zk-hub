import { Buffer } from "buffer";

let runtimePatched = false;

export function applyRuntimeCompat() {
    if (runtimePatched || typeof window === "undefined") {
        return;
    }

    runtimePatched = true;

    window.global = window.global || window;
    window.Buffer = window.Buffer || Buffer;

    // The prover stack expects Node-like Buffer flags/methods on typed arrays.
    if (!Uint8Array.prototype._isBuffer) {
        Object.defineProperty(Uint8Array.prototype, "_isBuffer", {
            value: true,
            configurable: true,
        });
    }

    if (typeof Uint8Array.prototype.copy !== "function") {
        Object.defineProperty(Uint8Array.prototype, "copy", {
            value: function (target, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
                const source = this.subarray(sourceStart, sourceEnd);
                target.set(source, targetStart);
                return source.length;
            },
            configurable: true,
            writable: true,
        });
    }
}
