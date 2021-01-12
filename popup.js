let extensionOn = false;
let videoDetected = false;

chrome.storage.sync.get({ enabled: true }, storage => {
    extensionOn = storage.enabled;
    toggleEnabledUI(extensionOn);
});

document.addEventListener('DOMContentLoaded', function () {
    // Initializing tooltips for Materialize
    const toolElem = document.querySelectorAll('.tooltipped');

    M.Tooltip.init(toolElem, { enterDelay: 500 });

    checkForVideo();
});

document.querySelector("#subtitle-settings").addEventListener("click", () => {
    messageContentScript({ settings: "subtitles" });
    window.close();
});

document.querySelector("#display-settings").addEventListener("click", () => {
    messageContentScript({ settings: "display" });
    window.close();
});

document.querySelector("#sync-settings").addEventListener("click", () => {
    messageContentScript({ settings: "sync" });
    window.close();
});

document.querySelector(".power-button").addEventListener("click", toggleEnabled);

document.querySelector("#refresh-popup-icon").addEventListener("click", refreshPopup);

document.querySelector("#shortcuts").addEventListener("click", function () {
    window.open(chrome.runtime.getURL("options.html"));
});

function toggleEnabled() {
    console.log("toggleEnabled function called");
    extensionOn = !extensionOn;
    chrome.storage.sync.set({ enabled: extensionOn }, () => {
        toggleEnabledUI(extensionOn);
    });
}

function toggleEnabledUI(enabled) {
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
        // Showing the menu with all its options and settings
        document.querySelector("#settings").classList.remove("hide");

        // If the video was detected hide the refresh-popup icon!
        if (videoDetected) {
            document.querySelector("#video-detected").classList.add("hide");

        } else {
            document.querySelector("#video-detected").classList.remove("hide");
        }

        // Changing the hover color of the power button
        document.querySelector(".power-button").classList.remove("turn-on");
        document.querySelector(".power-button").classList.add("turn-off");

        // Reloading the shadow dom!
        messageContentScript({ show: true });

        checkForVideo();

    } else {
        // Hiding the menu with all its options and settings
        document.querySelector("#settings").classList.add("hide");
        document.querySelector("#video-detected").classList.add("hide");

        // Changing the hover color of the power button
        document.querySelector(".power-button").classList.remove("turn-off");
        document.querySelector(".power-button").classList.add("turn-on");

        // Unloading the shadow dom!
        messageContentScript({ hide: true });
    }
}

function timeInSeconds(time) {
    const split = time.split(/:|,/);

    const s1 = Number(split[0] * 60 * 60); // hours
    const s2 = Number(split[1] * 60); // minutes
    const s3 = Number(split[2]); // seconds
    const s4 = split[3]; // milliseconds

    const seconds = s1 + s2 + s3;
    return seconds + "." + s4;
}

function checkForVideo() {
    // Display the general-section no matter what
    document.querySelector("#general-section").classList.remove("hide");

    // Video detected?
    // If so, display all subtitle related options
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { videoRequest: true }, function (response) {
            if (response && response.videoDetected) {
                videoDetected = true;
                document.querySelector("#subtitle-section").classList.remove("hide");
                document.querySelector("#video-detected").classList.add("hide");
            }
        });
    });
}

function calibrationHandler(offset, direction) {
    // Sending our subtitle array to the content script
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
        const message = {
            calibration: {
                offset: Number(offset) || 0,
                direction
            }
        };
        chrome.tabs.sendMessage(tab[0].id, message);
    });
}

function refreshPopup() {
    // Make the refresh icon spin for half a second
    document.querySelector("#refresh-popup-icon").classList.add("fa-spin");

    // Hide the general section while refreshing
    document.querySelector("#general-section").classList.add("hide");

    setTimeout(() => {
        document.querySelector("#refresh-popup-icon").classList.remove("fa-spin");
        checkForVideo();
    }, 1000);

}

function messageContentScript(message) {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
        chrome.tabs.sendMessage(tab[0].id, message);
    });
}

function displayErrorMessage(msg) {
    const errorElem = document.querySelector("#error-message");

    errorElem.innerHTML = msg;
    errorElem.classList.remove("hide");
}