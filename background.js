// On tab change let the content script know
chrome.tabs.onActivated.addListener(function () {
    chrome.storage.sync.get("enabled", storage => {
        let extensionOn = true;
        if (storage.enabled !== undefined) extensionOn = storage.enabled;

        if (extensionOn) {
            // Reloading the shadow dom
            messageContentScript({ show: true });
        } else {
            // Unloading the shadow dom!
            messageContentScript({ hide: true });
        }
    });
});

// Incomming messages
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request === "getUrl") {
            let thisSite = sender.tab.url.replace(/^.*\/\//, "").replace(/\/.*/, "");
            if (!/^www/.test(thisSite)) thisSite = "www." + thisSite;

            sendResponse({ url: thisSite });
        }
    }
);

function messageContentScript(message) {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
        chrome.tabs.sendMessage(tab[0].id, message);
    });
}