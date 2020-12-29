chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === "subtitle popup") {
        port.onDisconnect.addListener(function() {
            chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
                chrome.tabs.sendMessage(tab[0].id, { popupClosing: true });
            });
        });
    }
});