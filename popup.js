let extensionOn = false;
let videoDetected = false;

// Connecting the popup so the background script can get notified when the popup closes 
chrome.runtime.connect({ name: "subtitle popup" });

chrome.storage.sync.get({ enabled: true }, storage => {
    extensionOn = storage.enabled;
    toggleEnabledUI(extensionOn);
});

document.addEventListener('DOMContentLoaded', function() {
    // Push subtitles to the left
    messageContentScript({ pushSubtitles: true });

    // Initializing tooltips for Materialize
    const toolElem = document.querySelectorAll('.tooltipped');
    const selectElem = document.querySelectorAll('select');

    M.Tooltip.init(toolElem, { enterDelay: 500 });
    M.FormSelect.init(selectElem, {});

    checkForVideo();
});

window.addEventListener("unload", function() {
    messageContentScript({ popupClosing: true });
}, true);

document.querySelector("#input-range").addEventListener("change", function() {
    const newValue = document.querySelector("#input-range").value;
    document.querySelector("#sync-input").value = newValue;
});

document.getElementsByTagName("html")[0].addEventListener("mouseenter", function() {
    messageContentScript({ pushSubtitles: true });
});

document.getElementsByTagName("html")[0].addEventListener("mouseleave", function() {
    messageContentScript({ popupClosing: true });
});

document.querySelector(".power-button").addEventListener("click", toggleEnabled);

document.querySelector("#refresh-popup-icon").addEventListener("click", refreshPopup);

document.querySelector("#subtitle-import").addEventListener("click", function() {
    messageContentScript({ import: "file" });
});

document.querySelector("#shortcuts").addEventListener("click", function() {
    window.open(chrome.runtime.getURL("options.html"));
});

document.querySelector("#size-minus").addEventListener("click", function() {
    messageContentScript({ size: "minus" });
});

document.querySelector("#size-plus").addEventListener("click", function() {
    messageContentScript({ size: "plus" });
});

document.querySelector("#opacity-minus").addEventListener("click", function() {
    messageContentScript({ opacity: "minus" });
});

document.querySelector("#opacity-plus").addEventListener("click", function() {
    messageContentScript({ opacity: "plus" });
});

// Disable one of the input fields as soon as a value is entered in the other
document.querySelector("#sync-earlier").addEventListener("change", () => {
    const input = document.querySelector("#sync-earlier").value;
    disableInputField(input, "#sync-later");
});

document.querySelector("#sync-later").addEventListener("change", () => {
    const input = document.querySelector("#sync-later").value;
    disableInputField(input, "#sync-earlier");
});

// Syncing the subtitles if the input is valid
document.querySelector("#sync-now").addEventListener("click", function() {
    const earlier = document.querySelector("#sync-earlier").value.trim();
    const later = document.querySelector("#sync-later").value.trim();

    const input = earlier || later;

    if (!input) {
        displayErrorMessage("Input empty. To display the subtitles earlier/later, please enter a value!");

    } else if (isNaN(input)) {
        displayErrorMessage("Input invalid. Please, only use numbers!");

    } else if (input < 0) {
        displayErrorMessage("Input invalid. Please, only use positive numbers!");

    } else {
        // Passing in the input value and the name of the input variable. In other words the offset and the direction
        calibrationHandler(input, earlier ? "earlier" : "later");
    }
});

document.querySelector("#reset-sync").addEventListener("click", function() {
    console.log("Resetting is not yet supported ;(");
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
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { videoRequest: true }, function(response) {
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
    chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
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
    chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
        chrome.tabs.sendMessage(tab[0].id, message);
    });
}

function displayErrorMessage(msg) {
    const errorElem = document.querySelector("#error-message");

    errorElem.innerHTML = msg;
    errorElem.classList.remove("hide");
}

function disableInputField(input, id) {
    if (input) {
        document.querySelector(id).disabled = true;

    } else {
        document.querySelector(id).disabled = false;
    }
}