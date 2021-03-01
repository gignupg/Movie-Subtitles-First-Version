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



// On tab switch let the content script know
chrome.tabs.onActivated.addListener(function () {
    chrome.storage.sync.get(null, (storage) => {
        if (storage.enabled !== undefined) extensionOn = storage.enabled;
        if (storage.blacklist !== undefined) blacklist = storage.blacklist;

        chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
            let thisSite = tab[0].url.replace(/^.*\/\//, "").replace(/\/.*/, "");
            if (!/^www/.test(thisSite)) thisSite = "www." + thisSite;

            if (extensionOn && !blacklist[thisSite]) {
                // Reloading the shadow dom
                chrome.tabs.sendMessage(tab[0].id, { show: true, blacklist: blacklist });
            } else {
                // Unloading the shadow dom!
                chrome.tabs.sendMessage(tab[0].id, { hide: true, blacklist: blacklist });
            }
        });
    });
});

// Incomming messages
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request === "getUrl") {
            let thisSite = sender.tab.url.replace(/^.*\/\//, "").replace(/\/.*/, "");
            if (!/^www/.test(thisSite)) thisSite = "www." + thisSite;

            sendResponse({ url: thisSite });

        } else if (request === "backgroundRunning") {
            sendResponse(true);
        }
    }
);