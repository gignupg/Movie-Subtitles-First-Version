let monitoring = false;
let pausing = false;
let forwardRewind = false;
let menuOpen = false;
let ctrlPressed = false;
let skipMusicHover = false;
let controllerPos = null;
let subtitlesHidden = false;
let shortcuts = null;
let shadow = null;
let thisVideo = null;
let videoIconCount = 0;
let speedChangeCount = 0;
let blacklist = null;
let thisSite = null;
const red = "#C62828";
const orange = "#f0653b";
const defaultSubtitles = "To load subtitles click on the icon in the top left corner!";

const defaultShortcuts = {
    previous: "\u2190",
    next: "\u2192",
    rewind: "a",
    forward: "s",
    subtitles: "c",
    relocate: "r",
    slower: "",
    faster: "",
    rewindTwo: "",
    forwardTwo: ""
};

// This is the position of the subtitle array that is currently being displayed
let pos = 0;

// The subtitle array before putting our subtitles in there
let subs = [{ text: defaultSubtitles }];

// Subtitle calibration/Synchronization
let offset = 0;
let direction = "earlier";

function buttonClicked(e) {
    const action = e.currentTarget.myParam;

    // Enables us to jump between sentences. Either to the next or to the previous sentence
    if (subs.length > 1) {
        const time = video.currentTime;
        const firstPos = pos === 0;
        const lastPos = pos === subs.length - 1;
        const rangeNotValid = (firstPos && action < 0) || (lastPos && action > 0);

        // Jump back to the start of the same sentence if the sentence has been played longer than one second.
        if (action < 0 && time > subs[pos].start + 1) {
            video.currentTime = subs[pos].start;

            // Jump to the previous or next spot in the video as long as we stay in the correct range (we don't leave the subs array)
        } else if (!rangeNotValid) {
            video.currentTime = subs[pos + action].start;
        }
    }
}

function subtitleCalibrator(calibration, video, shadow) {
    if (subs.length > 1) {
        let offset = 0;

        if (calibration.direction === "earlier") {
            offset = calibration.offset * -1;
        } else {
            offset = calibration.offset;
        }

        // Calculate the new start and end times for the whole subtitle array
        const calibratedSubs = [];
        subs.forEach(elem => {
            if (elem.music) {
                calibratedSubs.push({
                    start: elem.start + offset,
                    end: elem.end + offset,
                    text: elem.text,
                    music: {
                        text: elem.music.text,
                        start: elem.music.start + offset,
                        end: elem.music.end + offset
                    }
                });
            } else {
                calibratedSubs.push({ start: elem.start + offset, end: elem.end + offset, text: elem.text });
            }
        });

        subs = calibratedSubs;

        // If the video is paused, play it for just a millisecond, so the subtitles will display correctly
        if (video.paused) {
            video.play();
            video.pause();
        }

        // Display success message
        shadow.querySelector("#synced").classList.remove("hide");

        // Hide success message after 2 seconds
        setTimeout(() => {
            shadow.querySelector("#synced").classList.add("hide");
        }, 3000);

    } else {
        // Display error message
        shadow.querySelector("#not-synced").classList.remove("hide");

        // Hide error message after 2 seconds
        setTimeout(() => {
            shadow.querySelector("#not-synced").classList.add("hide");
        }, 6000);
    }

    handleMenuClose(video, shadow);
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

var regStrip = /^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm;

var tc = {
    settings: {
        lastSpeed: 1.0, // default 1x
        enabled: true, // default enabled
        speeds: {}, // empty object to hold speed for each source
        displayKeyCode: 86, // default: V
        rememberSpeed: false, // default: false
        forceLastSavedSpeed: false, //default: false
        audioBoolean: false, // default: false
        startHidden: false, // default: false
        controllerOpacity: 0.5, // default: 0.5
        fontSize: 28,
        keyBindings: [],
        defaultLogLevel: 4,
        logLevel: 3
    },

    // Holds a reference to all of the AUDIO/VIDEO DOM elements we've attached to
    mediaElements: []
};

/* Log levels (depends on caller specifying the correct level)
  1 - none
  2 - error
  3 - warning
  4 - info
  5 - debug
  6 - debug high verbosity + stack trace on each message
*/
function log(message, level) {
    verbosity = tc.settings.logLevel;
    if (typeof level === "undefined") {
        level = tc.settings.defaultLogLevel;
    }
    if (verbosity >= level) {
        if (level === 2) {
            console.log("ERROR:" + message);
        } else if (level === 3) {
            console.log("WARNING:" + message);
        } else if (level === 4) {
            console.log("INFO:" + message);
        } else if (level === 5) {
            console.log("DEBUG:" + message);
        } else if (level === 6) {
            console.log("DEBUG (VERBOSE):" + message);
            console.trace();
        }
    }
}

// Initializing Video Controller
chrome.storage.sync.get(null, function (storage) {
    // Initializing shortcuts
    if (storage.shortcuts === undefined) {
        shortcuts = defaultShortcuts;
    } else {
        shortcuts = storage.shortcuts;
    }

    blacklist = storage.blacklist || {};

    tc.settings.keyBindings = storage.keyBindings; // Array
    if (storage.keyBindings.length == 0) {
        // if first initialization of 0.5.3
        // UPDATE
        tc.settings.keyBindings.push({
            action: "slower",
            key: Number(storage.slowerKeyCode) || 83,
            value: Number(storage.speedStep) || 0.1,
            force: false,
            predefined: true
        }); // default S
        tc.settings.keyBindings.push({
            action: "faster",
            key: Number(storage.fasterKeyCode) || 68,
            value: Number(storage.speedStep) || 0.1,
            force: false,
            predefined: true
        }); // default: D
        tc.settings.keyBindings.push({
            action: "rewind",
            key: Number(storage.rewindKeyCode) || 90,
            value: Number(storage.rewindTime) || 10,
            force: false,
            predefined: true
        }); // default: Z
        tc.settings.keyBindings.push({
            action: "advance",
            key: Number(storage.advanceKeyCode) || 88,
            value: Number(storage.advanceTime) || 10,
            force: false,
            predefined: true
        }); // default: X
        tc.settings.keyBindings.push({
            action: "reset",
            key: Number(storage.resetKeyCode) || 82,
            value: 1.0,
            force: false,
            predefined: true
        }); // default: R
        tc.settings.keyBindings.push({
            action: "fast",
            key: Number(storage.fastKeyCode) || 71,
            value: Number(storage.fastSpeed) || 1.8,
            force: false,
            predefined: true
        }); // default: G
        tc.settings.version = "0.5.3";

        chrome.storage.sync.set({
            keyBindings: tc.settings.keyBindings,
            version: tc.settings.version,
            displayKeyCode: tc.settings.displayKeyCode,
            rememberSpeed: tc.settings.rememberSpeed,
            forceLastSavedSpeed: tc.settings.forceLastSavedSpeed,
            audioBoolean: tc.settings.audioBoolean,
            startHidden: tc.settings.startHidden,
            enabled: tc.settings.enabled,
            controllerOpacity: tc.settings.controllerOpacity,
            fontSize: tc.settings.fontSize
        });
    }
    tc.settings.lastSpeed = Number(storage.lastSpeed);
    tc.settings.displayKeyCode = Number(storage.displayKeyCode);
    tc.settings.rememberSpeed = Boolean(storage.rememberSpeed);
    tc.settings.forceLastSavedSpeed = Boolean(storage.forceLastSavedSpeed);
    tc.settings.audioBoolean = Boolean(storage.audioBoolean);
    tc.settings.enabled = Boolean(storage.enabled);
    tc.settings.startHidden = Boolean(storage.startHidden);
    tc.settings.controllerOpacity = Number(storage.controllerOpacity);
    tc.settings.fontSize = Number(storage.fontSize);
    // ensure that there is a "display" binding (for upgrades from versions that had it as a separate binding)
    if (
        tc.settings.keyBindings.filter((x) => x.action == "display").length == 0
    ) {
        tc.settings.keyBindings.push({
            action: "display",
            key: Number(storage.displayKeyCode) || 86,
            value: 0,
            force: false,
            predefined: true
        }); // default V
    }

    // Update thisSite
    chrome.runtime.sendMessage("getUrl", function (response) {
        thisSite = response.url;
        initializeWhenReady(document);
    });
});

function getKeyBindings(action, what = "value") {
    try {
        return tc.settings.keyBindings.find((item) => item.action === action)[what];
    } catch (e) {
        return false;
    }
}

function setKeyBindings(action, value) {
    tc.settings.keyBindings.find((item) => item.action === action)[
        "value"
    ] = value;
}

function defineVideoController() {
    // Data structures
    // ---------------
    // videoController (JS object) instances:
    //   video = AUDIO/VIDEO DOM element
    //   parent = A/V DOM element's parentElement OR
    //            (A/V elements discovered from the Mutation Observer)
    //            A/V element's parentNode OR the node whose children changed.
    //   div = Controller's DOM element (which happens to be a DIV)
    //   speedIndicator = DOM element in the Controller of the speed indicator

    // added to AUDIO / VIDEO DOM elements
    //    vsc = reference to the videoController
    tc.videoController = function (target, parent) {
        if (target.vsc) {
            return target.vsc;
        }

        tc.mediaElements.push(target);

        this.video = target;
        this.parent = target.parentElement || parent;
        storedSpeed = tc.settings.speeds[target.currentSrc];
        if (!tc.settings.rememberSpeed) {
            if (!storedSpeed) {
                log(
                    "Overwriting stored speed to 1.0 due to rememberSpeed being disabled",
                    5
                );
                storedSpeed = 1.0;
            }
            setKeyBindings("reset", getKeyBindings("fast")); // resetSpeed = fastSpeed
        } else {
            log("Recalling stored speed due to rememberSpeed being enabled", 5);
            storedSpeed = tc.settings.lastSpeed;
        }

        log("Explicitly setting playbackRate to: " + storedSpeed, 5);
        target.playbackRate = storedSpeed;

        this.div = this.initializeControls();

        var mediaEventAction = function (event) {
            storedSpeed = tc.settings.speeds[event.target.currentSrc];
            if (!tc.settings.rememberSpeed) {
                if (!storedSpeed) {
                    log("Overwriting stored speed to 1.0 (rememberSpeed not enabled)", 4);
                    storedSpeed = 1.0;
                }
                // resetSpeed isn't really a reset, it's a toggle
                log("Setting reset keybinding to fast", 5);
                setKeyBindings("reset", getKeyBindings("fast")); // resetSpeed = fastSpeed
            } else {
                log(
                    "Storing lastSpeed into tc.settings.speeds (rememberSpeed enabled)",
                    5
                );
                storedSpeed = tc.settings.lastSpeed;
            }
        };

        target.addEventListener(
            "play",
            (this.handlePlay = mediaEventAction.bind(this))
        );

        target.addEventListener(
            "seeked",
            (this.handleSeek = mediaEventAction.bind(this))
        );

        var observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (
                    mutation.type === "attributes" &&
                    (mutation.attributeName === "src" ||
                        mutation.attributeName === "currentSrc")
                ) {
                    log("mutation of A/V element", 5);
                    var controller = this.div;
                    if (!mutation.target.src && !mutation.target.currentSrc) {
                        controller.classList.add("vsc-nosource");
                    } else {
                        controller.classList.remove("vsc-nosource");
                    }
                }
            });
        });
        observer.observe(target, {
            attributeFilter: ["src", "currentSrc"]
        });
    };

    tc.videoController.prototype.remove = function () {
        this.div.remove();
        this.video.removeEventListener("play", this.handlePlay);
        this.video.removeEventListener("seek", this.handleSeek);
        delete this.video.vsc;
        let idx = tc.mediaElements.indexOf(this.video);
        if (idx != -1) {
            tc.mediaElements.splice(idx, 1);
        }
    };

    tc.videoController.prototype.initializeControls = function () {
        const document = this.video.ownerDocument;

        const wrapper = document.createElement("div");
        wrapper.classList.add("vsc-controller");

        if (!this.video.currentSrc) {
            wrapper.classList.add("vsc-nosource");
            monitoring = false;
        }

        // Updating the controller position is important for the dragging function
        controllerPos = subtitleLocation(thisSite, this.video).pos;

        shadow = wrapper.attachShadow({ mode: "open" });

        const shadowTemplate = `
        <style>
          @import "${chrome.runtime.getURL("shadow.css")}";
        </style>
        
        <div id="video-icon">
            <img src="${chrome.runtime.getURL("icons/movie-subtitles-28.png")}" alt="Logo" class="logo" id="video-img"/>
        </div>
        <div id="speed-indicator" class="hide sync-msg"></div>
        <div id="settings-wrapper" class="hide">
            <div id="settings-header">
                <div id="settings-close" class="settings-item">&times;</div>
                <div id="settings-title" class="settings-item">Subtitle Options</div>
                <div class="settings-item">
                    <img src="${chrome.runtime.getURL("icons/movie-subtitles-28.png")}" alt="Logo" class="logo" id="settings-icon"/>
                </div>
            </div>
            <div id="settings-spacer"></div>
            <div id="settings-body">
                <div id="settings-menu">
                    <div class="menu-item selected-menu-item">Subtitles</div>
                    <div class="menu-item">Display</div>
                    <div class="menu-item">Synchronization</div>
                </div>
                <div id="subtitle-content" class="section">
                    <div id="centered-box">
                        <div class="settings-button subtitle-search-button">Subtitle Search</div>
                        <label for="chooseFile" class="fileLabel settings-button subtitle-upload-button tooltip">
                            Load Subtitles from PC
                            <span class="tooltiptext">Make sure the file format is .srt</span>
                        </label>
                        <input id="chooseFile" type="file" accept=".srt"></input>
                    </div>
                </div>
                <div id="display-content" class="section hide">
                    <div class="display-box">
                        <label class="display-label" for="display-range-1">Subtitle Size:</label>
                        <input class="slider" id="display-range-1" type="range" min="2" max="54" value="${tc.settings.fontSize}">
                    </div>
                    <div class="display-box" style="margin-top: -10px">
                        <label class="display-label" for="display-range-2">Background:</label>
                        <input class="slider" id="display-range-2" type="range" min="0" max="1" step="0.05" value="${tc.settings.controllerOpacity}">
                    </div>
                </div>
                <div id="sync-content" class="section hide">
                    <div id="sync-box">
                        <div style="font-size: 17px;">
                            Display subtitles 
                            <input
                            type="number"
                            class="sync-input"
                            id="sync-seconds"
                            min="0"
                            step="0.1"
                            value="0"
                            />
                            seconds 
                            <select id="offset-direction">
                                <option class="option-earlier" value="earlier" selected="selected">earlier</option>
                                <option class="option-later" value="later">later</option>
                            </select>
                        </div>
                        <input class="slider" id="sync-range" type="range" min="-10" max="10" step="0.1">
                        <div id="subtitle-sync-button" class="settings-button">Sync Now</div>
                    </div>
                </div>
            </div>
            <div id="bottom-space"></div>
        </div>
        <div id="controller" class="hide">
            <div id="subtitle-div" style="background-color: rgba(0, 0, 0, ${tc.settings.controllerOpacity});">
                <button id="prev-button" class="subtitle-button">«</button>
                <div id="subtitles">${subs[0].text}</div>
                <button id="next-button" class="subtitle-button">»</button>
            </div>
            <div class="line-break"></div>
            <div id="below-subtitles">
                <div id="skip-music" class="hide sync-msg"></div>
                <div id="synced" class="hide sync-msg">Subtitles successfully synced!</div>
                <div id="not-synced" class="hide sync-msg">Error: no subtitles selected!</div>
                <div id="loaded" class="hide sync-msg">Subtitles successfully loaded!</div>
            </div>
        </div>
      `;
        shadow.innerHTML = shadowTemplate;
        shadow.querySelector("#subtitle-div").addEventListener(
            "mousedown",
            (e) => {
                if (!ctrlPressed) {
                    runAction("drag", false, e);
                    e.stopPropagation();
                }
            },
            true
        );

        // Hiding the subtitle controller on youtube when loading another video without refreshing the page.
        // This is definitely not a perfect solution but it's the best I could come up with today. 
        document.body.addEventListener("click", function () {
            if (!tc.settings.enabled || blacklist[thisSite]) {
                setTimeout(() => {
                    wrapper.classList.add("vsc-nosource");
                }, 1000);
            }

            disableHighlighting(shadow);
        });

        chrome.runtime.onMessage.addListener(messageReceived);

        thisVideo = this.video;

        function messageReceived(msg) {
            if (msg.settings) {
                shadow.getElementById("video-icon").click();
                const menuItem = shadow.querySelectorAll(".menu-item");

                if (msg.settings === "subtitles") {
                    menuItem[0].click();

                } else if (msg.settings === "display") {
                    menuItem[1].click();

                } else {
                    menuItem[2].click();
                }

            } else if (msg.hide) {
                tc.settings.enabled = false;
                blacklist = msg.blacklist;
                wrapper.classList.add("vsc-nosource");

            } else if (msg.show) {
                tc.settings.enabled = true;
                blacklist = msg.blacklist;
                wrapper.classList.remove("vsc-nosource");

            } else if (msg.shortcuts) {
                shortcuts = msg.shortcuts;
            }
        }

        // Place the subtitles at the correct position in the video;
        subtitlePlacer();

        shadow.getElementById("skip-music").addEventListener("mouseenter", () => {
            skipMusicHover = true;
            shadow.getElementById("skip-music").innerHTML = "Skip the music!";
        });

        shadow.getElementById("skip-music").addEventListener("mouseleave", () => {
            skipMusicHover = false;

            if (subs[pos].music) {
                shadow.getElementById("skip-music").innerHTML = subs[pos].music.text;
            }
        });

        if (!monitoring) {
            monitoring = true;
            thisVideo.ontimeupdate = () => {
                if (subs && subs.length > 1) {
                    const time = thisVideo.currentTime.toFixed(3);

                    // See if it's the next or previous position.
                    if (subs[pos] && subs[pos + 1] && time >= subs[pos].start && time < subs[pos + 1].start) {
                        // Don't do anything. "pos" is correct

                    } else if (subs[pos + 1] && subs[pos + 2] && time >= subs[pos + 1].start && time < subs[pos + 2].start) {
                        pos++;

                    } else if (subs[pos - 1] && time >= subs[pos - 1].start && time < subs[pos].start) {
                        pos--;

                    } else {
                        // Look through the whole array to find the correct position
                        const newPos = subs.findIndex(el => el.start > time);

                        // If a match was found update "pos"
                        if (newPos > 0) {
                            pos = newPos - 1;

                        } else {
                            if (time < 200) {
                                pos = 0;

                            } else {
                                pos = subs.length - 1;
                            }
                        }
                    }

                    shadow.getElementById("subtitles").innerHTML = subs[pos].text;

                    // Display "Skip music" button if there is music
                    isMusic(shadow);
                }
            };
        }

        shadow.getElementById("prev-button").addEventListener("click", () => {
            forwardRewind = true;

            if (thisVideo.currentTime > subs[pos].start + 1) {
                thisVideo.currentTime = subs[pos].start;

            } else if (pos !== 0) {
                thisVideo.currentTime = subs[pos - 1].start;
            }

            disableHighlighting(shadow);
        });

        shadow.getElementById("next-button").addEventListener("click", () => {
            forwardRewind = true;

            if (pos !== subs.length - 1) {
                thisVideo.currentTime = subs[pos + 1].start;
            }

            disableHighlighting(shadow);
        });

        // Skip the music
        shadow.getElementById("skip-music").addEventListener("click", () => {
            thisVideo.currentTime = subs[pos].music.end;
        });

        shadow.getElementById("subtitle-sync-button").addEventListener("click", () => {
            const calibration = {};
            calibration.offset = Number(shadow.getElementById("sync-seconds").value);
            calibration.direction = shadow.getElementById("offset-direction").value;

            if (calibration.offset) {
                subtitleCalibrator(calibration, thisVideo, shadow);
            }
        });

        shadow.getElementById("settings-close").addEventListener("click", () => {
            handleMenuClose(thisVideo, shadow);
        });

        shadow.getElementById("video-icon").addEventListener("click", () => {
            menuOpen = true;
            // Blur the background when the settings are opened
            thisVideo.style.filter = "blur(10px)";
            // Hide video icon!
            shadow.getElementById("video-icon").classList.add("hide");
            // Show the menu
            shadow.getElementById("settings-wrapper").classList.remove("hide");
        });

        shadow.querySelectorAll(".menu-item").forEach((elem, ix) => {
            elem.addEventListener("click", () => {
                // Change the background color of the clicked menu item
                elem.classList.add("selected-menu-item");
                // Reset the background color for the other ones
                shadow.querySelectorAll(".menu-item").forEach((innerElem, innerIx) => {
                    if (innerIx !== ix) {
                        innerElem.classList.remove("selected-menu-item");
                    }
                });

                // Enabling/disabling menu sections
                shadow.querySelectorAll(".section").forEach((sectionElem, sectionIx) => {
                    if (sectionIx === ix) {
                        // Show the menu section that was clicked
                        sectionElem.classList.remove("hide");

                    } else {
                        // Hide the sections
                        sectionElem.classList.add("hide");
                    }
                });

            });
        });

        // Prevent some youtube shortcuts while interacting with the extension.
        shadow.addEventListener("keydown", (e) => {
            if (tc.settings.enabled) {
                // If a number was pressed while the settings menu is open, stop it from skipping to 10%, 20%, 30% and so on...
                if (e.keyCode >= 48 && e.keyCode <= 57) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                // If space was pressed play/stop the video!
                if (e.keyCode == 32) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (thisVideo.paused) {
                        thisVideo.play();
                    } else {
                        thisVideo.pause();
                    }
                }
            }
        });

        window.addEventListener("keyup", (e) => {
            // If ctrl was released disable text/subtitle highlighting
            // Ctrl works better than alt because switching windows with Alt + Tab enables text highlighting as a side effect
            // whereas using Ctrl + 1 or Ctrl + 2 for switching tabs doesn't cause any problems
            if (e.key === "Control") {
                disableHighlighting(shadow);
            }
        });

        window.addEventListener("resize", subtitlePlacer);

        function subtitlePlacer() {
            // Hiding the video icon and subtitles temporarily so the user doesn't see the resizing of
            // the video icon and the replacement of the subtitles, to provide a smoother user experience.
            shadow.getElementById("video-icon").classList.add("hide");
            shadow.getElementById("controller").classList.add("hide");

            setTimeout(() => {
                // Position the subtitles correctly
                const subLocation = subtitleLocation(thisSite, thisVideo);
                shadow.getElementById("controller").style[subLocation.pos] = subLocation.offset;

                if (!subtitlesHidden) {
                    shadow.getElementById("controller").classList.remove("hide");
                }

                if (thisVideo.clientWidth >= 1200) {
                    // fullscreen, show big icon
                    shadow.getElementById("video-img").src = chrome.runtime.getURL("icons/movie-subtitles-38.png");

                } else {
                    // small screen, show small icon
                    shadow.getElementById("video-img").src = chrome.runtime.getURL("icons/movie-subtitles-28.png");
                }
                shadow.getElementById("video-icon").classList.remove("hide");

            }, 500);
        }

        // Hide video icon if necessary!
        this.video.addEventListener("play", function () {
            videoIconCount++;
            const thisCount = videoIconCount;

            setTimeout(() => {
                hideVideoIcon(shadow, thisVideo, thisCount);
            }, 2900);
        });

        // Show video icon
        this.video.addEventListener("pause", function () {
            if (!menuOpen) {
                shadow.querySelector("#video-icon").classList.remove("hide");
            }
        });

        // Show video icon
        document.addEventListener("mousemove", function () {
            if (!thisVideo.paused) {
                if (!menuOpen) {
                    shadow.querySelector("#video-icon").classList.remove("hide");
                }

                videoIconCount++;
                const thisCount = videoIconCount;

                setTimeout(() => {
                    hideVideoIcon(shadow, thisVideo, thisCount);
                }, 2900);
            }
        });

        shadow.querySelector("#display-range-1").addEventListener("input", (e) => {
            const newSize = e.target.value;
            shadow.querySelector("#display-range-1").value = newSize;
            shadow.querySelector("#subtitles").style.fontSize = newSize + "px";
            shadow.querySelectorAll(".subtitle-button").forEach(elem => elem.style.fontSize = newSize + "px");
            tc.settings.fontSize = newSize;
            chrome.storage.sync.set({ fontSize: newSize });
        });

        shadow.querySelector("#display-range-2").addEventListener("input", (e) => {
            const newOpacity = e.target.value;
            shadow.querySelector("#display-range-2").value = newOpacity;
            shadow.querySelector("#subtitle-div").style.backgroundColor = `rgba(0, 0, 0, ${newOpacity})`;
            tc.settings.controllerOpacity = newOpacity;
            chrome.storage.sync.set({ controllerOpacity: newOpacity });
        });

        shadow.querySelector("#sync-range").addEventListener("input", (e) => {
            // update #sync-seconds
            const newVal = Math.abs(e.target.value);
            shadow.getElementById("sync-seconds").value = newVal;

            const direction = e.target.value <= 0 ? "earlier" : "later";
            const mySelect = shadow.getElementById('offset-direction');

            for (let i, j = 0; i = mySelect.options[j]; j++) {
                if (i.value === direction) {
                    mySelect.selectedIndex = j;
                    const color = direction === "earlier" ? orange : red;
                    const syncVal = Number(shadow.getElementById("sync-seconds").value);
                    const buttonStyle = shadow.getElementById("subtitle-sync-button").style;

                    shadow.getElementById("offset-direction").style.color = color;

                    // Setting the color of the submit button
                    if (syncVal) {
                        buttonStyle.backgroundColor = color;
                        buttonStyle.cursor = "pointer";

                    } else {
                        buttonStyle.backgroundColor = "rgba(0, 0, 0, 0.2)";
                        buttonStyle.cursor = "default";
                    }

                    break;
                }
            }
        });

        shadow.getElementById("sync-seconds").addEventListener("input", (e) => {
            const newVal = Math.abs(e.target.value);
            const direction = shadow.getElementById("offset-direction").value;
            const earlier = direction === "earlier" ? true : false;
            const buttonStyle = shadow.getElementById("subtitle-sync-button").style;

            shadow.getElementById("sync-seconds").value = newVal;

            if (earlier) {
                shadow.querySelector("#sync-range").value = -newVal;

                if (newVal) {
                    buttonStyle.backgroundColor = orange;
                    buttonStyle.cursor = "pointer";
                } else {
                    buttonStyle.backgroundColor = "rgba(0,0,0,0.2)";
                    buttonStyle.cursor = "default";
                }

            } else {
                shadow.querySelector("#sync-range").value = newVal;

                if (newVal) {
                    buttonStyle.backgroundColor = red;
                    buttonStyle.cursor = "pointer";
                } else {
                    buttonStyle.backgroundColor = "rgba(0,0,0,0.2)";
                    buttonStyle.cursor = "default";
                }
            }
        });

        shadow.querySelector("#offset-direction").addEventListener("change", (e) => {
            const direction = e.target.value;
            shadow.getElementById("sync-range").value = -shadow.getElementById("sync-range").value;
            shadow.getElementById("offset-direction").style.color = direction === "earlier" ? orange : red;
            shadow.getElementById("subtitle-sync-button").style.backgroundColor = direction === "earlier" ? orange : red;
        });

        shadow.querySelector("#settings-icon").addEventListener("click", () => {
            shadow.querySelector("#subtitle-settings").classList.remove("hide");
        });

        // Settings the fontSize and opacity
        shadow.querySelector("#subtitles").style.fontSize = tc.settings.fontSize + "px";
        shadow.querySelectorAll(".subtitle-button").forEach(elem => elem.style.fontSize = tc.settings.fontSize + "px");
        shadow.querySelector("#subtitle-div").style.backgroundColor = `rgba(0, 0, 0, ${tc.settings.controllerOpacity})`;

        // Pausing the video when hovering on the subtitles
        shadow.querySelector("#subtitle-div").addEventListener("mouseenter", () => {
            if (!this.video.paused) {
                this.video.pause();
                pausing = true;
            }
        });

        // Resuming the video when leaving the subtitles with the mouse but only if previous or next hasn't been pressed
        shadow.querySelector("#subtitle-div").addEventListener("mouseleave", () => {
            if (pausing && !forwardRewind) {
                this.video.play();
                pausing = false;
            }
        });

        // Resuming the video when leaving the subtitle controller with the mouse but only if previous or next has been pressed
        shadow.querySelector("#controller").addEventListener("mouseleave", () => {
            if (pausing && forwardRewind) {
                this.video.play();
                pausing = false;
                forwardRewind = false;
            }
        });

        shadow.getElementById("chooseFile").addEventListener("click", () => {
            handleMenuClose(thisVideo, shadow);
        });

        // Creating our subtitle array once an srt file is being uploaded
        shadow.getElementById("chooseFile").addEventListener("change", (e) => {
            const file = e.target.files[0];
            const reader = new FileReader;
            reader.onload = () => {
                const srtFile = reader.result.split("\n");
                const newSubs = [{ text: "" }];
                const musicRegEx = new RegExp('♪');
                let count = 0;
                let type = null;

                for (let i = 0; i < srtFile.length; i++) {

                    const line = srtFile[i].trim();

                    if (type === "time") {
                        type = "text";
                        const split = line.split(/ --> /);
                        const start = timeInSeconds(split[0]);
                        const end = timeInSeconds(split[1]);

                        // Updating the object
                        newSubs[count].start = Number(start);
                        newSubs[count].end = Number(end);

                    } else if (type === "text") {
                        if (srtFile[i + 1] && !srtFile[i + 1].trim()) type = null;

                        newSubs[count].text += line + " ";

                        const music = musicRegEx.test(newSubs[count].text);

                        // If it's music
                        if (music) {
                            newSubs[count].music = {};
                        }

                    } else if (!line) {
                        count++;

                    } else if (!isNaN(line)) {
                        type = "time";
                        newSubs.push({ text: "" });
                    }
                }

                if (!newSubs[newSubs.length - 1].text) newSubs.pop();

                // Adding "Skip Start" manually
                if (newSubs[0].start > 5) {
                    newSubs.unshift({ text: "Silence (" + Math.round(newSubs[0].start) + " seconds)", start: 0, end: newSubs[0].start });
                }

                // Adding "(end)" manually
                const lastNode = newSubs[newSubs.length - 1];
                lastNode.text = lastNode.text + "(end)";

                // Adding "Skip silence" to our subtitle array (newSubs) and updating the music property
                for (let i = 1; i < newSubs.length; i++) {
                    // Adding silence
                    const silence = newSubs[i].start - newSubs[i - 1].end;
                    if (silence > 5) {
                        newSubs.splice(i, 0, {
                            text: "Silence (" + Math.round(silence) + " seconds)",
                            start: newSubs[i - 1].end,
                            end: newSubs[i].start
                        });
                    }

                    // Adding music
                    if (newSubs[i].music) {
                        const music = newSubs[i].music;
                        music.start = newSubs[i].start;

                        // Find the end
                        for (let j = i; j < newSubs.length; j++) {
                            if (!newSubs[j].music) {
                                music.end = newSubs[j].start;
                                break;
                            }
                        }

                        // If no end was found we must be at the end of the subtitle array
                        if (!music.end) {
                            music.end = newSubs[newSubs.length - 1].end;
                        }

                        music.text = "Music (" + (music.end - music.start).toFixed() + " seconds)";
                    }
                }

                // Updating our active subtitle array (subs)
                subs = newSubs;

                // Display success message
                shadow.querySelector("#loaded").classList.remove("hide");
                // Hide success message after 2 seconds
                setTimeout(() => {
                    shadow.querySelector("#loaded").classList.add("hide");
                }, 3000);

                // If the video is paused, play it for just a millisecond, so the subtitles will display correctly
                if (this.video.paused) {
                    this.video.play();
                    this.video.pause();
                }
            };

            reader.readAsText(file, 'ISO-8859-1');
        });

        shadow.querySelectorAll("button").forEach(function (button) {
            button.addEventListener(
                "click",
                (e) => {
                    runAction(
                        e.target.dataset["action"],
                        getKeyBindings(e.target.dataset["action"]),
                        e
                    );
                    e.stopPropagation();
                },
                true
            );
        });

        shadow
            .querySelector("#controller")
            .addEventListener("click", (e) => e.stopPropagation(), false);
        shadow
            .querySelector("#controller")
            .addEventListener("mousedown", (e) => {
                e.stopPropagation();
            }, false);

        this.speedIndicator = shadow.getElementById("subtitles");
        var fragment = document.createDocumentFragment();
        fragment.appendChild(wrapper);

        switch (true) {
            case location.hostname == "www.amazon.com":
            case location.hostname == "www.reddit.com":
            case /hbogo\./.test(location.hostname):
                // insert before parent to bypass overlay
                this.parent.parentElement.insertBefore(fragment, this.parent);
                break;
            case location.hostname == "www.facebook.com":
                // this is a monstrosity but new FB design does not have *any*
                // semantic handles for us to traverse the tree, and deep nesting
                // that we need to bubble up from to get controller to stack correctly
                let p = this.parent.parentElement.parentElement.parentElement
                    .parentElement.parentElement.parentElement.parentElement;
                p.insertBefore(fragment, p.firstChild);
                break;
            case location.hostname == "tv.apple.com":
                // insert after parent for correct stacking context
                this.parent.getRootNode().querySelector(".scrim").prepend(fragment);
            default:
                // Note: when triggered via a MutationRecord, it's possible that the
                // target is not the immediate parent. This appends the controller as
                // the first element of the target, which may not be the parent.
                this.parent.insertBefore(fragment, this.parent.firstChild);
        }
        return wrapper;
    };
}

function escapeStringRegExp(str) {
    matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
    return str.replace(matchOperatorsRe, "\\$&");
}

var coolDown = false;

function refreshCoolDown() {
    log("Begin refreshCoolDown", 5);
    if (coolDown) {
        clearTimeout(coolDown);
    }
    coolDown = setTimeout(function () {
        coolDown = false;
    }, 1000);
    log("End refreshCoolDown", 5);
}

function initializeWhenReady(document) {
    window.onload = () => {
        initializeNow(window.document);
    };

    if (document) {
        if (document.readyState === "complete") {
            initializeNow(document);
        } else {
            document.onreadystatechange = () => {
                if (document.readyState === "complete") {
                    initializeNow(document);
                }
            };
        }
    }
    log("End initializeWhenReady", 5);
}

function inIframe() {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

function getShadow(parent) {
    let result = [];

    function getChild(parent) {
        if (parent.firstElementChild) {
            var child = parent.firstElementChild;
            do {
                result.push(child);
                getChild(child);
                if (child.shadowRoot) {
                    result.push(getShadow(child.shadowRoot));
                }
                child = child.nextElementSibling;
            } while (child);
        }
    }
    getChild(parent);
    return result.flat(Infinity);
}

function initializeNow(document) {
    if (!tc.settings.enabled || blacklist[thisSite]) {
        return;
    }
    // enforce init-once due to redundant callers
    if (!document.body || document.body.classList.contains("movie-subtitles-initialized")) {
        return;
    }
    document.body.classList.add("movie-subtitles-initialized");

    if (document === window.document) {
        defineVideoController();
    } else {
        var link = document.createElement("link");
        link.href = chrome.runtime.getURL("inject.css");
        link.type = "text/css";
        link.rel = "stylesheet";
        document.head.appendChild(link);
    }
    var docs = Array(document);
    try {
        if (inIframe()) docs.push(window.top.document);
    } catch (e) { }

    docs.forEach(function (doc) {
        doc.addEventListener(
            "keydown",
            function (event) {
                var keyCode = event.keyCode;

                // Shortcuts and Text Highlighting
                if (tc.settings.enabled) {
                    const key = event.key;
                    // If ctrl was pressed enable text/subtitle highlighting
                    // Ctrl works better than alt because switching windows with Alt + Tab enables text highlighting as a side effect
                    // whereas using Ctrl + 1 or Ctrl + 2 for switching tabs doesn't cause any problems
                    if (key === "Control") {
                        const subtitleStyle = shadow.getElementById("subtitles").style;

                        // Lock the subtitle position!
                        ctrlPressed = true;

                        shadow.getElementById("subtitles").classList.add("text-cursor");

                        // Make the subtitles highlightable
                        // Simply ading a class works with the cursor property, however it does not work with the userSelect property
                        subtitleStyle.webkitUserSelect = "text";
                    }
                }

                // Ignore if following modifier is active.
                if (!event.getModifierState ||
                    event.getModifierState("Alt") ||
                    event.getModifierState("Control") ||
                    event.getModifierState("Fn") ||
                    event.getModifierState("Meta") ||
                    event.getModifierState("Hyper") ||
                    event.getModifierState("OS")
                ) {
                    return;
                }

                // Ignore keydown event if typing in an input box
                if (
                    event.target.nodeName === "INPUT" ||
                    event.target.nodeName === "TEXTAREA" ||
                    event.target.isContentEditable
                ) {
                    console.log("Ignore event if typing in an input box");
                    return false;
                }

                // Ignore keydown event if typing in a page without vsc
                if (!tc.mediaElements.length) {
                    console.log("Ignore event if typing in a page without vsc");
                    return false;
                }

                // Movie Subtitles Shortcuts
                if (tc.settings.enabled) {
                    const arrowKey = {
                        ArrowLeft: "\u2190",
                        ArrowUp: "\u2191",
                        ArrowRight: "\u2192",
                        ArrowDown: "\u2193"
                    };
                    const key = arrowKey[event.key] || event.key.toLowerCase();

                    if (key === shortcuts.previous) {
                        shadow.getElementById("prev-button").click();
                        event.preventDefault();
                        event.stopPropagation();

                    } else if (key === shortcuts.next) {
                        shadow.getElementById("next-button").click();
                        event.preventDefault();
                        event.stopPropagation();

                    } else if (key === shortcuts.rewind) {
                        thisVideo.currentTime = thisVideo.currentTime - 5;
                        event.preventDefault();
                        event.stopPropagation();

                    } else if (key === shortcuts.forward) {
                        thisVideo.currentTime = thisVideo.currentTime + 5;
                        event.preventDefault();
                        event.stopPropagation();

                    } else if (key === shortcuts.subtitles) {
                        hideOrShowSubtitles();
                        event.preventDefault();
                        event.stopPropagation();

                    } else if (key === shortcuts.relocate) {
                        shadow.getElementById("controller").style[controllerPos] = "100px";
                        event.preventDefault();
                        event.stopPropagation();

                    } else if (key === shortcuts.slower) {
                        const newSpeed = setNewPlaybackRate(thisVideo, -0.25);
                        displayNewSpeedBriefly(shadow, newSpeed);
                        event.preventDefault();
                        event.stopPropagation();

                    } else if (key === shortcuts.faster) {
                        const newSpeed = setNewPlaybackRate(thisVideo, 0.25);
                        displayNewSpeedBriefly(shadow, newSpeed);
                        event.preventDefault();
                        event.stopPropagation();

                    } else if (key === shortcuts.rewindTwo) {
                        thisVideo.currentTime = thisVideo.currentTime - 2.5;
                        event.preventDefault();
                        event.stopPropagation();

                    } else if (key === shortcuts.forwardTwo) {
                        thisVideo.currentTime = thisVideo.currentTime + 2.5;
                        event.preventDefault();
                        event.stopPropagation();

                    }
                }

                var item = tc.settings.keyBindings.find((item) => item.key === keyCode);
                if (item) {
                    console.log("running action");
                    runAction(item.action, item.value);
                    if (item.force === "true") {
                        console.log("forcing");
                        // disable websites key bindings
                        event.preventDefault();
                        event.stopPropagation();
                    }
                }
                return false;
            },
            true
        );
    });

    function checkForVideo(node, parent, added) {
        // Only proceed with supposed removal if node is missing from DOM
        if (!added && document.body.contains(node)) {
            return;
        }
        if (
            node.nodeName === "VIDEO" ||
            (node.nodeName === "AUDIO" && tc.settings.audioBoolean)
        ) {
            if (added) {
                node.vsc = new tc.videoController(node, parent);
            } else {
                if (node.vsc) {
                    node.vsc.remove();
                }
            }
        } else if (node.children != undefined) {
            for (var i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                checkForVideo(child, child.parentNode || parent, added);
            }
        }
    }

    var observer = new MutationObserver(function (mutations) {
        // Process the DOM nodes lazily
        requestIdleCallback(
            (_) => {
                mutations.forEach(function (mutation) {
                    switch (mutation.type) {
                        case "childList":
                            mutation.addedNodes.forEach(function (node) {
                                if (typeof node === "function") return;
                                checkForVideo(node, node.parentNode || mutation.target, true);
                            });
                            mutation.removedNodes.forEach(function (node) {
                                if (typeof node === "function") return;
                                checkForVideo(node, node.parentNode || mutation.target, false);
                            });
                            break;
                        case "attributes":
                            if (
                                mutation.target.attributes["aria-hidden"] &&
                                mutation.target.attributes["aria-hidden"].value == "false"
                            ) {
                                var flattenedNodes = getShadow(document.body);
                                var node = flattenedNodes.filter(
                                    (x) => x.tagName == "VIDEO"
                                )[0];
                                if (node) {
                                    if (node.vsc)
                                        node.vsc.remove();
                                    checkForVideo(node, node.parentNode || mutation.target, true);
                                }
                            }
                            break;
                    }
                });
            }, { timeout: 1000 }
        );
    });
    observer.observe(document, {
        attributeFilter: ["aria-hidden"],
        childList: true,
        subtree: true
    });

    if (tc.settings.audioBoolean) {
        var mediaTags = document.querySelectorAll("video,audio");
    } else {
        var mediaTags = document.querySelectorAll("video");
    }

    mediaTags.forEach(function (video) {
        video.vsc = new tc.videoController(video);
    });

    var frameTags = document.getElementsByTagName("iframe");
    Array.prototype.forEach.call(frameTags, function (frame) {
        // Ignore frames we don't have permission to access (different origin).
        try {
            var childDocument = frame.contentDocument;
        } catch (e) {
            return;
        }
        initializeWhenReady(childDocument);
    });
    log("End initializeNow", 5);
}

function runAction(action, value, e) {
    log("runAction Begin", 5);

    var mediaTags = tc.mediaElements;

    // Get the controller that was used if called from a button press event e
    if (e) {
        var targetController = e.target.getRootNode().host;
    }

    mediaTags.forEach(function (v) {
        var controller = v.vsc.div;

        // Don't change video speed if the video has a different controller
        if (e && !(targetController == controller)) {
            return;
        }

        showController(controller);

        if (!v.classList.contains("vsc-cancelled")) {
            if (action === "display") {
                log("Showing controller", 5);
                controller.classList.add("vsc-manual");
                controller.classList.toggle("vsc-hidden");
            } else if (action === "blink") {
                log("Showing controller momentarily", 5);
                // if vsc is hidden, show it briefly to give the use visual feedback that the action is excuted.
                if (
                    controller.classList.contains("vsc-hidden") ||
                    controller.blinkTimeOut !== undefined
                ) {
                    clearTimeout(controller.blinkTimeOut);
                    controller.classList.remove("vsc-hidden");
                    controller.blinkTimeOut = setTimeout(
                        () => {
                            controller.classList.add("vsc-hidden");
                            controller.blinkTimeOut = undefined;
                        },
                        value ? value : 1000
                    );
                }
            } else if (action === "drag") {
                handleDrag(v, e);
            } else if (action === "pause") {
                pause(v);
            } else if (action === "muted") {
                muted(v);
            } else if (action === "mark") {
                setMark(v);
            } else if (action === "jump") {
                jumpToMark(v);
            }
        }
    });
    log("runAction End", 5);
}

function pause(v) {
    if (v.paused) {
        log("Resuming video", 5);
        v.play();
    } else {
        log("Pausing video", 5);
        v.pause();
    }
}

function muted(v) {
    v.muted = v.muted !== true;
}

function setMark(v) {
    log("Adding marker", 5);
    v.vsc.mark = v.currentTime;
}

function jumpToMark(v) {
    log("Recalling marker", 5);
    if (v.vsc.mark && typeof v.vsc.mark === "number") {
        v.currentTime = v.vsc.mark;
    }
}

function handleDrag(video, e) {
    const controller = video.vsc.div;
    const shadowController = controller.shadowRoot.querySelector("#controller");

    // Find nearest parent of same size as video parent.
    var parentElement = controller.parentElement;
    while (
        parentElement.parentNode &&
        parentElement.parentNode.offsetHeight === parentElement.offsetHeight &&
        parentElement.parentNode.offsetWidth === parentElement.offsetWidth
    ) {
        parentElement = parentElement.parentNode;
    }

    video.classList.add("vcs-dragging");
    shadowController.classList.add("dragging");

    const initialMouseY = e.clientY;
    const initialControllerY = parseInt(shadowController.style[controllerPos]);

    const startDragging = (e) => {
        const dy = e.clientY - initialMouseY;
        shadowController.style[controllerPos] = controllerPos === "bottom"
            ? (initialControllerY - dy) + "px"
            : (initialControllerY + dy) + "px";
    };

    const stopDragging = () => {
        parentElement.removeEventListener("mousemove", startDragging);
        parentElement.removeEventListener("mouseup", stopDragging);
        parentElement.removeEventListener("mouseleave", stopDragging);

        shadowController.classList.remove("dragging");
        video.classList.remove("vcs-dragging");
    };

    parentElement.addEventListener("mouseup", stopDragging);
    parentElement.addEventListener("mouseleave", stopDragging);
    parentElement.addEventListener("mousemove", startDragging);
}

var timer = null;

function showController(controller) {
    log("Showing controller", 4);
    controller.classList.add("vcs-show");

    if (timer) clearTimeout(timer);

    timer = setTimeout(function () {
        controller.classList.remove("vcs-show");
        timer = false;
        log("Hiding controller", 5);
    }, 2000);
}

chrome.runtime.onMessage.addListener(processMessage);

function processMessage(msg, sender, sendResponse) {
    if (msg.show) {
        const initialized = document.body.classList.contains("movie-subtitles-initialized");
        if (!initialized) {
            tc.settings.enabled = true;
            blacklist = msg.blacklist;
            initializeNow(window.document);
        }

    } else if (msg.videoRequest) {
        if (monitoring) {
            sendResponse({ videoDetected: true });
        } else {
            sendResponse({ videoDetected: false });
        }
    }
}

function hideVideoIcon(shadow, video, count) {
    const subtitlesLoaded = shadow.querySelector("#subtitles").innerHTML !== defaultSubtitles;

    // On youtube the progress bar and play buttons disappear after 2.9 seconds it seems
    // This way, at least on youtube, the video icon will disappear at the same time
    if (!video.paused && subtitlesLoaded && count === videoIconCount) {
        shadow.querySelector("#video-icon").classList.add("hide");
    }
}

function handleMenuClose(video, shadow) {
    shadow.getElementById("settings-wrapper").classList.add("hide");
    menuOpen = false;
    video.style.filter = null;
    shadow.getElementById("video-icon").classList.remove("hide");
}

function isMusic(shadow) {
    const music = subs[pos].music;
    const next = subs[pos + 1].music || null;

    if (music && next) {
        shadow.getElementById("skip-music").innerHTML = skipMusicHover ? "Skip the music!" : music.text;
        shadow.getElementById("skip-music").classList.remove("hide");
    } else {
        shadow.getElementById("skip-music").classList.add("hide");
        skipMusicHover = false;
    }
}

function disableHighlighting(shadow) {
    const subtitleStyle = shadow.getElementById("subtitles").style;

    // Unlock the position so the subtitles can be dragged again
    ctrlPressed = false;

    shadow.getElementById("subtitles").classList.remove("text-cursor");

    // Make the subtitles not highlightable
    subtitleStyle.webkitUserSelect = "none";
    subtitleStyle.mozUserSelect = "none";
    subtitleStyle.msUserSelect = "none";
}

function subtitleLocation(url, video) {
    switch (url) {
        case "www.youtube.com":
            return { pos: "top", offset: (video.clientHeight * 0.7) + "px" };
        default:
            return { pos: "bottom", offset: "100px" };
    }
}

function setNewPlaybackRate(video, speed) {
    const newSpeed = (video.playbackRate + speed).toFixed(2);
    if (newSpeed < 0) {
        video.playbackRate = 0;

    } else if (newSpeed > 6) {
        video.playbackRate = 6;

    } else {
        video.playbackRate = newSpeed;
    }

    return video.playbackRate;
}

function displayNewSpeedBriefly(shadow, speed) {
    speedChangeCount++;
    const thisCount = speedChangeCount;
    // Display new speed
    shadow.getElementById("speed-indicator").innerHTML = speed.toFixed(2);
    shadow.getElementById("speed-indicator").classList.remove("hide");

    setTimeout(() => {
        if (thisCount === speedChangeCount) {
            shadow.getElementById("speed-indicator").classList.add("hide");
        }
    }, 2000);
}

function hideOrShowSubtitles() {
    if (subtitlesHidden) {
        subtitlesHidden = false;
        shadow.getElementById("controller").classList.remove("hide");

    } else {
        subtitlesHidden = true;
        shadow.getElementById("controller").classList.add("hide");
    }
}