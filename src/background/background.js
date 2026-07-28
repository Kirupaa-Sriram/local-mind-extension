console.log("Local Mind Extension: Background Service Worker initialized.");

//Safely manages the creation of invisible AI processing window
let creatingOffscreen;

// FIX: an explicit readiness gate, resolved only when offscreen.js confirms
// (via OFFSCREEN_SANDBOX_READY) that the sandbox iframe's listener is bound.
// This is the actual handshake you asked for — background now WAITS on this
// promise before sending a job, instead of firing immediately after
// createDocument() resolves (which only means the document was created, not
// that its nested iframe has finished loading and initializing).

let offscreenReadyResolve;
let offscreenReadyPromise;


function resetOffscreenReadiness() {
  offscreenReadyPromise = new Promise((resolve) => {
    offscreenReadyResolve = resolve;
  });
}

resetOffscreenReadiness();

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

chrome.runtime.onMessage.addListener((message) =>{
    if(message.action === "OFFSCREEN_SANDBOX_READY"){
        offscreenReadyResolve();
    }
});

const IDLE_CLOSE_ALARM = 'close-offscreen-idle';
const IDLE_MINUTES = 2; // tune to taste — trade RAM for cold-start latency

function scheduleIdleClose() {
  chrome.alarms.create(IDLE_CLOSE_ALARM, { delayInMinutes: IDLE_MINUTES });
}

 
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== IDLE_CLOSE_ALARM) return;
 
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
 
  if (existingContexts.length > 0) {
    await chrome.offscreen.closeDocument();
    console.log('Local Mind Extension: offscreen document closed after idle timeout.');
  }
 
  // Whether or not a document existed, our readiness state is now stale —
  // the next job must go through a fresh handshake against a fresh document.
  resetOffscreenReadiness();
});

// NOTE: path updated to match the new src/offscreen/ location. Files under
// public/ are copied verbatim by Vite (no bundling), which is what broke the
// "@xenova/transformers" import — moving into src/ gets sandbox.js processed
// by Vite/crxjs so bare npm specifiers resolve correctly.
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function setupOffscreenDocument(){
    const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);

    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });
    
    if(existingContexts.length > 0){
        chrome.runtime.sendMessage({
            action:'CHECK_SANDBOX_READY'
        });
        return; //Document already exists and active
    }

    //Prevent race condition if  multiple pages trigger at the exact same time
    if(creatingOffscreen){
        await creatingOffscreen;
        return;
    }

    // Fresh document coming, so this is a fresh readiness cycle.
    resetOffscreenReadiness();

    creatingOffscreen = chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ['DOM_PARSER'],
        justification: 'Execute AI model matrix processing safely'
    });

    await creatingOffscreen;
    creatingOffscreen = null;
}
//helper function to handle sandbox messaging via an offscreen promise
async function generateEmbeddingInSandbox(textToVectorize) {
    await setupOffscreenDocument();

    // THE HANDSHAKE: don't send the job until the sandbox has explicitly told
    // us it's listening. 20s covers a cold model-library parse on a slow
    // machine; if it's still not ready by then, something is actually broken
    // and we want a clear error instead of a permanently hung promise.
    await withTimeout(
        offscreenReadyPromise,
        20000,
        'Sandbox did not report ready in time — check the offscreen document console for errors.'
    );

    return new Promise((resolve, reject) => {

        //Create a unique transaction ID, so we can match our specific request to the vector results when they come back down the pipe
        const transactionId = Math.random().toString(36).substring(7);

        //Set up a native message tracking listener loop
        function handleResponseRelay(message, sender, sendResponse){

            //Security check: Ensure the message is from our sandbox and has the expected action
            if(message.action === "SANDBOX_RESPONSE_RELAY" && message.payload.id === transactionId) {
                //Clean Up: Remove the event listener after receiving the response, so we don't leak memory or handle multiple responses
                chrome.runtime.onMessage.removeListener(handleResponseRelay);
                if(message.payload.action === "EMBEDDING_SUCCESS"){
                    //Resolve the promise with clean array of 384 vectors
                    resolve(message.payload.embedding);
                }else{
                    reject(new Error(message.payload.error));
                }
               
            }
        }

        //Register our response catcher onto the global headless message bus
        chrome.runtime.onMessage.addListener(handleResponseRelay);


        //Dispatch payload broadly into our extension internal runtime ecosystem
        //Our Sandbox page will capture this packet
        chrome.runtime.sendMessage({
            action: "ROUTING_REQUEST_TO_SANDBOX",
            id: transactionId,
            text: textToVectorize
        });

    });
}
// How many characters of scraped text to keep for on-screen display in the
// side panel. The FULL text is still used to generate the embedding (better
// semantic signal) — only what we persist to storage is trimmed, per the
// {id, url, title, textSnippet, embedding, timestamp} schema.
const SNIPPET_LENGTH = 250;

// Each saved item is roughly 5–6KB (mostly the 384-number embedding array
// as JSON). At this cap that's ~2.5–3MB total — trivial given the
// "unlimitedStorage" permission is already granted. This was previously a
// hardcoded slice(0, 100) left over from early development, not a
// deliberate limit — raise or lower freely...
const MAX_HISTORY_ITEMS = 750;

// --- Close-document strategy toggle -------------------------------------
// The idle-close alarm above already handles cleanup — it just waits for a
// quiet period instead of closing instantly, so an active browsing session
// keeps the warm model in RAM between saves.
// Flip this to 'immediate' if you'd rather prioritize minimum RAM usage over
// speed (e.g. testing on a low-memory machine).

const CLOSE_STRATEGY = 'idle'; // 'idle' | 'immediate'
 
function handlePipelineFinished() {
  if (CLOSE_STRATEGY === 'immediate') {
    chrome.offscreen.closeDocument().catch(() => {});
    resetOffscreenReadiness();
  } else {
    scheduleIdleClose();
  }
}

//Listen for incoming messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.action === "PAGE_SCRAPED") {
        const{ title, url, text } = message.data;
        const timestamp = new Date().toISOString();

        console.log(`Local Mind Extension: Requesting clean embedding co-ordinates for: "${title}"`);
       
        generateEmbeddingInSandbox(text).then(vectorEmbedding => {
            //Fetch our exisiting history from  Chrome's local database
                chrome.storage.local.get({webHistory: []}, (result) => {
                let currentHistory = result.webHistory;

                //Filter out any existing entries with the same URL to avoid duplicates
                currentHistory = currentHistory.filter(entry => entry.url !== url);
            
                //Create a new history entry
                const newEntry = {
                    id: crypto.randomUUID(), 
                    title,
                    url,
                    textSnippet: text.slice(0, SNIPPET_LENGTH),
                    embedding: vectorEmbedding, //AI Vector representation of the page content
                    timestamp
                };

                //Add new entry to the front of our history list
                currentHistory.unshift(newEntry);

                //Limit the database size for now to 100 entries
                const updatedHistory = currentHistory.slice(0, MAX_HISTORY_ITEMS);

                //Save the updated history back to Chrome's local storage
                chrome.storage.local.set({webHistory: updatedHistory}, () => {
                    console.log(`Local Mind Extension: Database updated with Vector co-ordinates! Size: ${updatedHistory.length}`);
                
                    chrome.runtime.sendMessage({
                        action: "DATABASE_WRITE_COMPLETE"
                    });
                });
            });
        })
        .catch((err) => {
            console.error("Local Mind Extension: AI vectorization pipeline failed: ", err);
            // Persisted (not just console-logged) so the side panel can show it —
            // this failure happens during silent background scraping, with no
            // active request/response channel to report back to directly.
            chrome.storage.local.set({
                lastPipelineError: {
                    message: err.message || String(err),
                    title,
                    url,
                    timestamp: new Date().toISOString(),
                },
            });
        })
        .finally(handlePipelineFinished);

        return; // no sendResponse used for this route
    }                 

// --- Search Vectorization Bridge ---------------------------------------
// The side panel sends the user's search text here; run it through the
// exact same embedding pipeline used for scraped pages (it's generic —
// nothing offscreen.js-side needed to change) and hand back a query vector
// for the side panel to compare against stored embeddings itself.

if(message.action === "SEARCH_QUERY"){
    generateEmbeddingInSandbox(message.text)
        .then((vector) => {
            sendResponse({
                success : true, vector
            });
        })
        .catch((err) => {
            console.error("Local Mind Extension: search vectorization failed: ", err);
            sendResponse({ success: false, error: err.message });
        })
        .finally(handlePipelineFinished);
    return true; // keep the message channel open for the async sendResponse
}
});