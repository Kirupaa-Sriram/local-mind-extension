import { useState, useEffect, useMemo } from 'react';
import {searchLocalMind} from  './utils/vectorSearch.js';
import './App.css';

function SidePanel() {
    const [history, setHistory] = useState([]);
    const [query, setQuery] = useState('');
    // We store the query VECTOR, not the results themselves. Results are
    // derived below via useMemo — that's what makes them stay live: if a new
    // page gets scraped (or a card gets deleted) while you're viewing search
    // results, `history` updates via chrome.storage.onChanged like it always
    // does, and the derived results automatically re-score against the same
    // query — no re-search, no "clear and refresh" workaround needed.
    const [queryVector, setQueryVector] = useState(null); // null = "no search active"
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [pipelineError, setPipelineError] = useState(null);

    const loadHistory = () =>{
        if(chrome.storage && chrome.storage.local){
            chrome.storage.local.get({webHistory: []}, (result) => {
                setHistory(result.webHistory);
            });
        }
    };

    useEffect(() =>{
        loadHistory();

        // Pick up any pipeline error that happened while the panel was closed.
        chrome.storage.local.get({ lastPipelineError: null }, (result) => {
            setPipelineError(result.lastPipelineError);
        });

        // chrome.storage.onChanged fires directly from the browser at the exact
        // moment webHistory actually changes, with the new value attached — no
        // custom message to send, no ordering to get right, so this can't race
        // ahead of the write the way a manually-sent "I'm done" message could.
        
        const handleStorageChange = (changes, areaName) => {
            if (areaName !== 'local') return;
            if (changes.webHistory) {
                setHistory(changes.webHistory.newValue || []);
            }

            if (changes.lastPipelineError) {
                setPipelineError(changes.lastPipelineError.newValue || null);
            }
        };
 
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    const dismissPipelineError = () => {
        chrome.storage.local.remove('lastPipelineError');
        setPipelineError(null);
    };
    
    const runSearch = async() => {
        const trimmed = query.trim();
        if(!trimmed || isSearching) return;

        setIsSearching(true);
        setSearchError(null);

        try{
            const response = await chrome.runtime.sendMessage({
                action : 'SEARCH_QUERY',
                text : trimmed,
            });

            if (!response || !response.success) {
                throw new Error(response?.error || 'Search failed for an unknown reason.');
            }

            setQueryVector(response.vector);
        } catch(err){
            console.error('Local Mind Extension: search failed', err);
            setSearchError(err.message);
            setQueryVector(null);
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyDown = (e) =>{
        if(e.key === 'Enter'){
            runSearch();
        }
    };

    const clearSearch = () => {
        setQuery('');
        setQueryVector(null);
        setSearchError(null);
    };

    const clearHistory = () => {
        const confirmed = window.confirm(
            'This will permanently delete all saved browsing memory. Continue?'
        );
        if (!confirmed) return;

        chrome.storage.local.clear(() => {
            setHistory([]);
            setQueryVector(null);
        });
    };

    const deleteHistoryItem = (id) => {
     chrome.storage.local.get({ webHistory: [] }, (result) => {
        const updated = result.webHistory.filter((item) => item.id !== id);
        chrome.storage.local.set({ webHistory: updated });
        // No need to manually update state here — chrome.storage.onChanged
        // picks this up and updates `history`, which (via the useMemo below)
        // also removes it from any active search results automatically.
        });
    };
    // Recomputes automatically whenever `history` or `queryVector` changes —
    // this is what keeps search results live against new scrapes/deletions
    // without needing an explicit re-search.
    const results = useMemo(() =>{
        if (!queryVector) return null;
        return searchLocalMind(queryVector, history, 5);
    }, [queryVector, history]);


  // While a search is active, show ranked matches; otherwise show the full
  // saved history in reverse-chronological order.
  const itemsToRender = results !== null ? results : history;
  const isShowingSearchResults = results !== null;

   return (
    <div className="sidebar-container">
      <header className="sidebar-header">
        <h1>🧠 Local AI Memory</h1>
        <p>Your Private Browsing Memory</p>
      </header>

        {pipelineError && (
        <div
          className="pipeline-error-banner"
          style={{
            margin: '0 16px 12px',
            padding: '10px 12px',
            background: '#fdecea',
            border: '1px solid #e05555',
            borderRadius: '6px',
            fontSize: '0.85em',
            color: '#7a2020',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <span>
              ⚠️ Couldn't save "{pipelineError.title || pipelineError.url}" —{' '}
              {pipelineError.message}
            </span>
            <button onClick={dismissPipelineError} style={{ flexShrink: 0 }}>
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="search-container">
        <input
          className="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search your browsing memory..."
          disabled={isSearching}
        />
        <div className="search-actions">
            <button 
                className="search-btn"
                onClick={runSearch} 
                disabled={isSearching || !query.trim()}
            >
                {isSearching ? 'Searching…' : 'Search'}
            </button>

            {isShowingSearchResults && (
                <button 
                    className = "secondary-btn"
                    onClick={clearSearch} 
                    disabled={isSearching}
                >
                    Clear
                </button>
            )}
        </div>
      </div>

      <main className="sidebar-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>
            {isShowingSearchResults
              ? `Results (${itemsToRender.length})`
              : `Saved Pages (${history.length})`}
          </h2>
          {!isShowingSearchResults && history.length > 0 && (
            <button onClick={clearHistory} className="clear-history-btn">
              Clear History
            </button>
          )}
        </div>

        {searchError && (
          <p className="empty-state" style={{ color: '#e05555' }}>
            Search error: {searchError}
          </p>
        )}

        {itemsToRender.length === 0 && !searchError ? (
          <p className="empty-state">
            {isShowingSearchResults
              ? 'No matching pages found.'
              : 'No saved pages yet. Start browsing to save pages!'}
          </p>
        ) : (
          <div className="history-list">
            {itemsToRender.map((page) => (
              <div key={page.id} className="history-card" >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener"
                      className="card-title"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                    {page.title || 'Untitled Page'}
                    </a>
                    <button
                        onClick={() => deleteHistoryItem(page.id)}
                        title="Delete this page from memory"
                        aria-label="Delete this page from memory"
                        style={{
                            flexShrink: 0,
                            width: '20px',
                            height: '20px',
                            lineHeight: '20px',
                            padding: 0,
                            border: 'none',
                            borderRadius: '50%',
                            background: 'transparent',
                            color: '#999',
                            fontSize: '0.8em',
                            cursor: 'pointer',
                        }}
                    >
                    🗑️
                    </button>
                </div>

                {isShowingSearchResults && (
                  <span className="match-badge" style={{ fontWeight: 600 }}>
                    {page.matchPercentage}% match
                  </span>
                )}

                <p className="card-url">{page.url.substring(0, 40)}...</p>

                <span className="card-date">
                  🕒 {new Date(page.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default SidePanel;