chrome.tabs.onActivated.addListener(function () {
    chrome.storage.sync.get("enabled", storage => {
        extensionOn = storage.enabled;
        if (extensionOn) {
            // Reloading the shadow dom
            messageContentScript({ show: true });
        } else {
            // Unloading the shadow dom!
            messageContentScript({ hide: true });
        }
    });
});

function messageContentScript(message) {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
        chrome.tabs.sendMessage(tab[0].id, message);
    });
}