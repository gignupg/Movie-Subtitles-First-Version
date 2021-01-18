let extensionOn = false;
let videoDetected = false;

chrome.storage.sync.get(null, storage => {
    extensionOn = storage.enabled;
    videoDetected = storage.sessionID === storage.videoSession;
    console.log("inside storage, detection: ", videoDetected);
    console.log("storage.sessionID", storage.sessionID);
    console.log("storage.videoSession", storage.videoSession);
    toggleEnabledUI(extensionOn);
});

// Initializing tooltips for Materialize
const toolElem = document.querySelectorAll('.tooltipped');
M.Tooltip.init(toolElem, { enterDelay: 500 });

document.querySelector("#subtitle-settings").addEventListener("click", openSubtitleSettings);
document.querySelector("#display-settings").addEventListener("click", openSubtitleSettings);
document.querySelector("#sync-settings").addEventListener("click", openSubtitleSettings);

document.querySelector(".power-button").addEventListener("click", toggleEnabled);

document.querySelector("#shortcuts").addEventListener("click", function () {
    window.open(chrome.runtime.getURL("options.html"));
});

function toggleEnabled() {
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
        // Show all popup settings
        document.querySelector("#settings").classList.remove("hide");

        // Changing the hover color of the power button
        document.querySelector(".power-button").classList.remove("turn-on");
        document.querySelector(".power-button").classList.add("turn-off");

        console.log("inside toggleEnabledUI, detection", videoDetected);

        // If the video was detected hide the refresh-popup icon!
        if (videoDetected) {
            document.querySelector("#disabled-subtitle-section").classList.add("hide");
            document.querySelector("#subtitle-section").classList.remove("hide");

            // Reloading the shadow dom
            messageContentScript({ show: true });

        } else {
            document.querySelector("#subtitle-section").classList.add("hide");
            document.querySelector("#disabled-subtitle-section").classList.remove("hide");

            checkForVideo();
        }

    } else {
        // Hide all popup settings
        document.querySelector("#settings").classList.add("hide");

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
    // Video detected?
    // If so, display all subtitle related options
    const detectVideo = setInterval(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { videoRequest: true }, function (response) {
                console.log(response);
                if (response && response.videoDetected) {
                    videoDetected = true;
                    toggleEnabledUI(extensionOn);
                    clearInterval(detectVideo);
                }
            });
        });
    }, 1000);
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

function messageContentScript(message) {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
        chrome.tabs.sendMessage(tab[0].id, message);
    });
}

function openSubtitleSettings(e) {
    messageContentScript({ settings: e.target.name });
    window.close();
}