let extensionOn = true;
let blacklist = defaultBlacklist;

// Necessary because if nothing is listening to the connect event from the content script
// it will immediately disconnect. So we're preventing an immediate disconnect event being fired.
chrome.runtime.onConnect.addListener(() => {
    console.log("something connected");
});

chrome.storage.sync.get(null, (storage) => {
    if (storage.enabled !== undefined) extensionOn = storage.enabled;

    const suffix = `${extensionOn ? "" : "_disabled"}.png`;
    chrome.browserAction.setIcon({
        path: {
            "19": "icons/movie-subtitles-19" + suffix,
            "38": "icons/movie-subtitles-38" + suffix,
            "48": "icons/movie-subtitles-48" + suffix
        }
    });
});

// Incomming messages
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.getUrl) {
            let thisSite = sender.tab.url.replace(/^.*\/\//, "").replace(/\/.*/, "");
            if (!/^www/.test(thisSite)) thisSite = "www." + thisSite;

            sendResponse({ url: thisSite });
        }
    }
);