// Necessary because if nothing is listening to the connect event from the content script
// it will immediately disconnect. So we're preventing an immediate disconnect event being fired.
chrome.runtime.onConnect.addListener(() => {
    setIcon();
});

// On tab switch let the content script know
chrome.tabs.onActivated.addListener(function () {
    setIcon();
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

function setIcon() {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
        chrome.tabs.sendMessage(tab[0].id, { status: true }, function (response) {
            const extensionOn = response;

            const suffix = `${extensionOn ? "" : "_disabled"}.png`;
            chrome.browserAction.setIcon({
                path: {
                    "19": "icons/movie-subtitles-19" + suffix,
                    "38": "icons/movie-subtitles-38" + suffix,
                    "48": "icons/movie-subtitles-48" + suffix
                }
            });
        });
    });
}