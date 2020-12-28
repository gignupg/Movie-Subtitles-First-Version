let extensionOn = false;
let videoDetected = false;

chrome.storage.sync.get({ enabled: true }, storage => {
    extensionOn = storage.enabled;
    toggleEnabledUI(extensionOn);
});

document.addEventListener('DOMContentLoaded', function() {
    // Initializing tooltips for Materialize
    var elems = document.querySelectorAll('.tooltipped');
    M.Tooltip.init(elems, { enterDelay: 500 });

    checkForVideo();
});

document.querySelector(".power-button").addEventListener("click", toggleEnabled);

document.querySelector("#refresh-popup-icon").addEventListener("click", checkForVideo);

document.querySelector("#subtitle-import").addEventListener("click", function() {
    chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
        const message = { import: "file" };
        chrome.tabs.sendMessage(tab[0].id, message);
    });
});

document.querySelector("#shortcuts").addEventListener("click", function() {
    window.open(chrome.runtime.getURL("options.html"));
});

document.querySelector("#size-minus").addEventListener("click", function() {
    chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
        const message = { size: "minus" };
        chrome.tabs.sendMessage(tab[0].id, message);
    });
});

document.querySelector("#size-plus").addEventListener("click", function() {
    chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
        const message = { size: "plus" };
        chrome.tabs.sendMessage(tab[0].id, message);
    });
});

document.querySelector("#opacity-minus").addEventListener("click", function() {
    chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
        const message = { opacity: "minus" };
        chrome.tabs.sendMessage(tab[0].id, message);
    });
});

document.querySelector("#opacity-plus").addEventListener("click", function() {
    chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
        const message = { opacity: "plus" };
        chrome.tabs.sendMessage(tab[0].id, message);
    });
});

document.querySelector("#sync-now").addEventListener("click", function() {
    console.log("syncing now...");
    const earlier = document.querySelector("#sync-earlier").value.trim();
    const later = document.querySelector("#sync-later").value.trim();

    if (!earlier && !later) {
        // Show a temporary message, that 
        console.log("No input provided. Please specify how many seconds earlier or later you want to display your subtitles!");

    } else if (earlier && later) {
        // Display an error message!
        console.log("Subtitles can only be displayed earlier or later not both at the same time!");

    } else if (earlier) {
        calibrationHandler(earlier, "earlier");

    } else if (later) {
        calibrationHandler(later, "later");
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
        chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
            const message = { show: true };
            // const message = { reload: true };
            chrome.tabs.sendMessage(tab[0].id, message);
        });

    } else {
        // Hiding the menu with all its options and settings
        document.querySelector("#settings").classList.add("hide");
        document.querySelector("#video-detected").classList.add("hide");

        // Changing the hover color of the power button
        document.querySelector(".power-button").classList.remove("turn-off");
        document.querySelector(".power-button").classList.add("turn-on");

        // Unloading the shadow dom!
        chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
            const message = { hide: true };
            // const message = { unload: true };
            chrome.tabs.sendMessage(tab[0].id, message);
        });
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