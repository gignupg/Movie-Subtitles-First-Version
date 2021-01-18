let extensionOn = null;

chrome.storage.sync.get("enabled", storage => {
    extensionOn = storage.enabled;
    updatePopup(extensionOn);
});

document.querySelector(".power-button").addEventListener("click", toggleExtensionOnOff);

document.querySelector("#shortcuts").addEventListener("click", function () {
    window.open(chrome.runtime.getURL("options.html"));
});

function toggleExtensionOnOff() {
    extensionOn = !extensionOn;
    updatePopup(extensionOn);
    chrome.storage.sync.set({ enabled: extensionOn });
}

function updatePopup(enabled) {
    const suffix = `${enabled ? "" : "_disabled"}.png`;
    chrome.browserAction.setIcon({
        path: {
            "19": "icons/movie-subtitles-19" + suffix,
            "38": "icons/movie-subtitles-38" + suffix,
            "48": "icons/movie-subtitles-48" + suffix
        }
    });

    document.querySelector(".logo").src = "icons/movie-subtitles-48" + suffix;

    if (enabled) {
        // Display the popup settings
        document.querySelector("#settings").classList.remove("hide");

        // Changing the hover color of the power button
        document.querySelector(".power-button").classList.remove("turn-on");
        document.querySelector(".power-button").classList.add("turn-off");

        // Reloading the shadow dom
        messageContentScript({ show: true });

    } else {
        // Hide the popup settings
        document.querySelector("#settings").classList.add("hide");

        // Changing the hover color of the power button
        document.querySelector(".power-button").classList.remove("turn-off");
        document.querySelector(".power-button").classList.add("turn-on");

        // Unloading the shadow dom!
        messageContentScript({ hide: true });
    }
}

function messageContentScript(message) {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
        chrome.tabs.sendMessage(tab[0].id, message);
    });
}