# Local Mind: AI Browsing Memory

> A privacy-first Chrome extension that turns your browsing history into a searchable, contextual memory using on-device AI embeddings.

Local Mind helps you rediscover information you've read before. Instead of relying on exact keywords, search naturally:

> "That article about vector databases"
> "The movie trilogy I looked up"

and find relevant pages based on meaning, not just matching words.

## Preview

Example:

```
[Extension side panel screenshot]

[Semantic search example]

[Saved browsing memory example]
```

---

## Why Local Mind?

Browser history is designed for remembering **where** you visited, not **what you learned**.

Traditional history search depends on:

* Page titles
* URLs
* Exact keywords

This makes it difficult to find something you remember reading but cannot describe precisely.

Local Mind creates a private semantic memory of your browsing activity, allowing you to search your past browsing experience by meaning.

---

## Features

### 🧠 Semantic Search

Search your browsing memory using natural language instead of exact keywords.

Example:

```
"articles about vector databases"
```

can find pages containing relevant concepts even if those exact words were never searched.

---

### 🔒 Privacy-First Local AI

Your browsing data stays on your device.

* No account required
* No analytics
* No telemetry
* No cloud processing of browsing history
* AI inference runs locally

---

### ⚡ Automatic Memory Creation

Local Mind automatically captures meaningful browsing activity without requiring manual bookmarks.

Pages are saved only after meaningful interaction, helping avoid storing every accidental click.

---

### 🚫 Smart Exclusions

Sensitive or unnecessary pages can be excluded:

* Search engine result pages
* Webmail
* Other configurable domains

Users remain in control of what gets stored.

---

### 🗑️ User Control

Manage your browsing memory anytime:

* Delete individual saved pages
* Clear all stored memories
* Configure excluded websites

---

# How It Works

Local Mind uses a local AI pipeline to convert browsing content into searchable vector representations.

```
Browser Page
      |
      ↓
Content Script
(extracts readable text)
      |
      ↓
Background Service Worker
(manages extension workflow)
      |
      ↓
Offscreen Document
(runs local AI inference)
      |
      ↓
Transformers.js
(generates embeddings)
      |
      ↓
chrome.storage.local
(stores browsing memory)
      |
      ↓
Side Panel
(search and retrieval experience)
```

### Why an Offscreen Document?

Chrome Manifest V3 service workers are not designed for long-running, memory-intensive AI workloads.

Local Mind uses Chrome's Offscreen API to run the embedding pipeline separately while keeping processing local to the device.

---

# Privacy Architecture

Local Mind follows a local-first design:

```
Web Content
     |
     ↓
Local Text Processing
     |
     ↓
Local Embedding Generation
     |
     ↓
Local Vector Storage
     |
     ↓
Semantic Search
```

No browsing history is uploaded to external servers.

The AI model files are downloaded once during initial setup and cached locally. Future embedding generation happens directly on the device.

---

# Tech Stack

| Layer              | Technology                                |
| ------------------ | ----------------------------------------- |
| UI                 | React + Vite                              |
| Extension Platform | Chrome Extension Manifest V3              |
| AI Inference       | Transformers.js                           |
| Embedding Model    | Xenova/all-MiniLM-L6-v2                   |
| Storage            | chrome.storage.local                      |
| Search             | Vector similarity using cosine similarity |

---

# Project Structure

```
src/
 ├── background/
 │    └── background.js        # Extension lifecycle and storage handling
 │
 ├── content/
 │    └── scraper.js           # Webpage content extraction
 │
 ├── utils/
 │    └── vectorSearch.js      # Semantic similarity search
 │
 ├── offscreen.js              # Local AI embedding generation
 │
 └── SidePanel.jsx             # Search interface

public/
 └── manifest.json             # Chrome extension configuration
```

---

# Installation

## Requirements

* Node.js
* npm
* Google Chrome (Manifest V3 support)

## Build

```bash
git clone https://github.com/<your-username>/local-mind.git

cd local-mind

npm install

npm run build
```

## Load Extension

1. Open:

```
chrome://extensions
```

2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the generated `dist` folder

---

# Known Limitations

* Browsing memory is created after meaningful interaction rather than every visited page.
* Similarity scores indicate ranking relevance, not absolute confidence.
* Domain exclusions require explicit configuration.

---

# Future Improvements

Potential improvements include:

* Better incremental browsing time tracking
* Improved embedding models
* Advanced memory organization
* More granular privacy controls

---

# License

License information will be added separately.