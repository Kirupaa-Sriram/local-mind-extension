import { pipeline, env } from '@xenova/transformers';

// This is a plain (non-sandboxed) extension page — chrome-extension:// origin.
// MV3's *default* CSP for extension pages already permits 'wasm-unsafe-eval',
// which is all onnxruntime-web actually needs, so there's no CSP reason left
// to nest a sandboxed iframe inside here. A sandboxed page gets an opaque,
// storage-less origin by design (no Cache Storage, no IndexedDB) — which is
// exactly what broke env.useBrowserCache. Running inference directly in this
// normal page instead gives it a real origin with full storage access.
env.allowLocalModels = false;
env.useBrowserCache = true;

// Multi-threaded WASM (onnxruntime-web's default when available) needs
// SharedArrayBuffer, which requires the page to be cross-origin isolated —
// that needs COOP/COEP response headers, which extension pages don't get.
// Without forcing this off, it still *tries* multithreading first: spawning
// a Worker from a blob: URL, which our CSP correctly blocks (script-src
// has no blob: source), then falls back to single-threaded after failing
// loudly. Setting this up front skips the doomed attempt entirely — same
// end result, none of the console noise.
env.backends.onnx.wasm.numThreads = 1;

let pipelineReadyPromise = null;

function getPipeline() {
  if (!pipelineReadyPromise) {
    console.log('AI Sandbox: instantiating Transformers.js pipeline...');
    pipelineReadyPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
      .then((p) => {
        console.log('AI Sandbox: model is warm, resident in RAM');
        return p;
      });
  }
  return pipelineReadyPromise;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'ROUTING_REQUEST_TO_SANDBOX') {
    (async () => {
      try {
        const generateEmbedding = await getPipeline();
        const output = await generateEmbedding(message.text, {
          pooling: 'mean',
          normalize: true,
        });
        chrome.runtime.sendMessage({
          action: 'SANDBOX_RESPONSE_RELAY',
          payload: {
            action: 'EMBEDDING_SUCCESS',
            id: message.id,
            embedding: Array.from(output.data),
          },
        });
      } catch (error) {
        chrome.runtime.sendMessage({
          action: 'SANDBOX_RESPONSE_RELAY',
          payload: {
            action: 'EMBEDDING_FAILURE',
            id: message.id,
            error: error.message,
          },
        });
      }
    })();
    return;
  }

  // Service worker restarts can wipe its readiness flag even though this
  // page is still alive and warm — re-confirm on request.
  if (message.action === 'CHECK_SANDBOX_READY') {
    chrome.runtime.sendMessage({ action: 'OFFSCREEN_SANDBOX_READY' });
  }
});

// Announce readiness immediately: the listener above is bound synchronously
// the instant this script runs, so we can safely accept jobs right away.
// The model itself still warms lazily on the first job via getPipeline().
chrome.runtime.sendMessage({ action: 'OFFSCREEN_SANDBOX_READY' });
console.log('AI Sandbox: listener bound, ready to accept embedding jobs.');