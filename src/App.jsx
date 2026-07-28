import {useState, useEffect} from 'react';
import './App.css';

function App(){
  const [history, setHistory] = useState([]);

  //Storage compiler: This func read the array from computer disk
  const loadHistory = () => {
    if(chrome.storage && chrome.storage.local){
      chrome.storage.local.get({webHistory:[]}, (result) => {
        setHistory(result.webHistory);
      });
    }
  };

  //Runs code the exact millisecond the sidebar mounts on screen
  useEffect(() => {
    //Fetch our intial list of saved pages from Chrome's local storage
    loadHistory();
    
    //Extension Network Interceptor(Listens to background.js)
    //Listen strictly for the database success flag to refresh the screen
    const handleExtensionMessages = (message) =>{

      //Trigger A: If background script finishes an AI index write, refresh the UI screen immediately!
      if(message.action === "DATABASE_WRITE_COMPLETE"){
        console.log("React Gateway: Database update confirmed. Redrawing history feed...")
        loadHistory();
      }
    };

    chrome.runtime.onMessage.addListener(handleExtensionMessages);

    return()=>{
      chrome.runtime.onMessage.removeListener(handleExtensionMessages);
    };
  },[]); //the empty array ensures this effect runs only once when the component mounts

  //layout of the sidebar
  return(
    <div className = "sidebar-container">
      <header className = "sidebar-header">
        <h1>🧠Local AI Memory</h1>
        <p>Your Private Browsing Memory</p>
      </header>

      <main className = "sidebar-content">
        <h2>Saved Pages ({history.length})</h2>

        {/* If there are no saved pages, show a friendly message */}
        {history.length === 0 ? (
          <p className="empty-state">
            No saved pages yet. Start browsing to save pages!
          </p>
        ):(
          /*Loop rendering: For each saved page in the history array, create a card with its details*/
          <div className="history-list">
            {history.map((page, index) => (
              <div key={index} className="history-card">
                {/* Clikcking this link opens the saved page in a new tab */}
                <a href ={page.url} target="_blank" rel="noopener" className="card-title">
                  {page.title || "Untitled Page"}
                </a>
                <p className="card-url">{page.url.substring(0,40)}...</p>
                <span className = "card-date">
                  🕒{new Date(page.savedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
