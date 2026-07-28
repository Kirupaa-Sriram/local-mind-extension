console.log("Local Mind Extension: Scraper active on this page.");
// Pulls a focused summary of the page instead of the entire raw body text.
// document.body.innerText includes nav bars, menus, ad labels, cookie
// banners, etc. — on a content-heavy site that junk can dominate the text
// fed to the embedding model, since the model produces one averaged vector
// for its whole input. A page that's mostly "Menu Sign In Watchlist..."
// scores lower on real semantic matches than one that's mostly its own
// meta description and headings.
function extractFocusedText() {
    const metaDescription = document.querySelector('meta[name="description"]')?.content?.trim();
    const ogDescription = document.querySelector('meta[property="og:description"]')?.content?.trim();
 
    // Prefer a real content region if the page marks one up semantically —
    // this alone dodges most nav/sidebar/footer chrome.
    const contentRoot = document.querySelector('article, main, [role="main"]');
    let bodyText = '';
    if (contentRoot) {
        bodyText = contentRoot.innerText;
    } else {
        // No semantic content region — fall back to headings + paragraphs
        // only, rather than the entire body, which still filters out most
        // nav-link and button text (those are rarely wrapped in <p>/<h*>).
        bodyText = Array.from(document.querySelectorAll('h1, h2, h3, p'))
            .map((el) => el.innerText.trim())
            .filter(Boolean)
            .join(' ');
    }
 
    return [metaDescription, ogDescription, bodyText]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}
window.addEventListener("load", () => {
    setTimeout(() => {
        if(!chrome.runtime || !chrome.runtime.id){
            console.warn("Local Mind Extension: Extension updated in background. Aborting old scraper context.");
            return;
        }
        // This visibility check catches what a URL-based rule structurally
        // can't: a page that's technically allowed but isn't actually being
        // looked at right now — e.g. Chrome's own hidden prerender/warmup
        // pages, or a tab the user switched away from before the 10s mark.
        if (document.visibilityState !== 'visible') {
            console.log("Local Mind Extension: Tab not visible, skipping scrape (likely a background/prerendered page).");
            return;
        }
        console.log("Local Mind Extension: 10 seconds achieved! Scraping page content...");
        try{
            const pageTitle = document.title;
            const pageUrl = window.location.href;
            const rawText = document.body.innerText;
            const cleanText = rawText.replace(/\s+/g, ' ').trim();

            console.log(`Local Mind Extension: User stayed > 10s. Scraped: "${pageTitle}"`);

            
            chrome.runtime.sendMessage({
                action: "PAGE_SCRAPED",
                data: {
                    title: pageTitle,
                    url: pageUrl,
                    text: cleanText.substring(0, 5000) // Limit to first 5000 characters
                }
            });
            console.log("Local Mind Extension: Scraped data sent to background service worker.");
        } catch (error) {
            console.error("Local Mind Extension: Error during scraping:", error);
        }
    }, 10000); // 10 seconds
});