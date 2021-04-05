(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const languageEncoding = require('detect-file-encoding-and-language');

const screenSize = getScreenSize();
const red = "#C62828";
const orange = "#f0653b";
const defaultSubtitles = "To load subtitles click on the icon in the top left corner!";
const subtitleFontSizes = {
    small: { min: 1, value: 20, max: 39 },
    medium: { min: 2, value: 28, max: 54 },
    large: { min: 3, value: 38, max: 73 },
    XL: { min: 10, value: 60, max: 110 }
};
const fontSize = {
    val: subtitleFontSizes[screenSize].value,
    min: subtitleFontSizes[screenSize].min,
    max: subtitleFontSizes[screenSize].max
};
const iconThreshold = {
    small: 768,
    medium: 1024,
    large: 1440,
    XL: 1920
};
const videoIcon = {
    small: {
        smallIcon: chrome.runtime.getURL("icons/movie-subtitles-24.png"),
        bigIcon: chrome.runtime.getURL("icons/movie-subtitles-28.png")
    },
    medium: {
        smallIcon: chrome.runtime.getURL("icons/movie-subtitles-28.png"),
        bigIcon: chrome.runtime.getURL("icons/movie-subtitles-38.png")
    },
    large: {
        smallIcon: chrome.runtime.getURL("icons/movie-subtitles-48.png"),
        bigIcon: chrome.runtime.getURL("icons/movie-subtitles-64.png")
    },
    XL: {
        smallIcon: chrome.runtime.getURL("icons/movie-subtitles-64.png"),
        bigIcon: chrome.runtime.getURL("icons/movie-subtitles-96.png")
    }
};
const menuIcon = {
    small: chrome.runtime.getURL("icons/movie-subtitles-24.png"),
    medium: chrome.runtime.getURL("icons/movie-subtitles-28.png"),
    large: chrome.runtime.getURL("icons/movie-subtitles-48.png"),
    XL: chrome.runtime.getURL("icons/movie-subtitles-64.png")
};
let extensionOn = true;
let exactUrl = window.location.href;
let wrapper = null;
let monitoring = false;
let pausing = false;
let forwardRewind = false;
let menuOpen = false;
let ctrlPressed = false;
let skipMusicHover = false;
let controllerPos = null;
let subtitlesHidden = false;
let shadow = null;
let thisVideo = null;
let videoIconCount = 0;
let speedChangeCount = 0;
let thisSite = null;
let lastTimeExtClicked = {};
let recentlyForcedPlayback = null;
let opacity = 0.5;

const backgroundPort = chrome.runtime.connect();
backgroundPort.onDisconnect.addListener(() => {
    // Immediately hiding the extension when disabled via the 
    // extension page so that the user doesn't have to refresh the page. 
    extensionOn = false;
    wrapper.classList.add("vsc-nosource");
});

let shortcuts = defaultShortcuts;

// This is the position of the subtitle array that is currently being displayed
let pos = 0;

// The subtitle array before putting our subtitles in there
let subs = [{ text: defaultSubtitles }];

// Subtitle calibration/Synchronization
let offset = 0;
let direction = "earlier";

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

var tc = {
    // Holds a reference to all of the AUDIO/VIDEO DOM elements we've attached to
    mediaElements: []
};

// Initializing Video Controller
chrome.storage.sync.get(null, function (storage) {
    if (storage.enabled !== undefined) extensionOn = storage.enabled;
    if (storage.shortcuts !== undefined) shortcuts = storage.shortcuts;
    if (storage.opacity !== undefined) opacity = storage.opacity;
    if (storage.fontSize !== undefined && storage.fontSize[screenSize] !== undefined) fontSize.val = storage.fontSize[screenSize];

    // Update thisSite
    chrome.runtime.sendMessage({ getUrl: true }, function (response) {
        thisSite = response.url;
        initializeWhenReady(document);
    });
});

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

        this.div = this.initializeControls();

        var observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (
                    mutation.type === "attributes" &&
                    (mutation.attributeName === "src" ||
                        mutation.attributeName === "currentSrc")
                ) {
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

        wrapper = document.createElement("div");
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
                <div id="settings-close" class="settings-header-item">&times;</div>
                <div id="settings-title" class="settings-header-item">Subtitle Options</div>
                <div class="settings-header-item">
                    <img src="${menuIcon[screenSize]}" alt="Logo" class="logo" id="settings-icon"/>
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
                        <div class="settings-button subtitle-search-button">Select Subtitles</div>
                        <label for="chooseFile" class="fileLabel settings-button subtitle-upload-button tooltip">
                            Load Subtitles from PC
                            <span class="tooltiptext">Make sure the file ending is either .srt, .txt or .sub!</span>
                        </label>
                        <input id="chooseFile" type="file" accept=".srt, .txt, .sub"></input>
                    </div>
                </div>
                <div id="display-content" class="section hide">
                    <div class="display-box">
                        <label class="display-label" for="display-range-1">Subtitle Size:</label>
                        <input class="slider" id="display-range-1" type="range" min="${fontSize.min}" max="${fontSize.max}" value="${fontSize.val}">
                    </div>
                    <div class="display-box" style="margin-top: -10px">
                        <label class="display-label" for="display-range-2">Background:</label>
                        <input class="slider" id="display-range-2" type="range" min="0" max="1" step="0.05" value="${opacity}">
                    </div>
                </div>
                <div id="sync-content" class="section hide">
                    <div id="sync-box">
                        <div class="sync-style">
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
            <div id="subtitle-div"><!-- We need these comments to prevent whitespace between the divs
            --><button id="prev-button" class="subtitle-button">«</button><!--
            --><div id="subtitles">${subs[0].text}</div><!--
            --><button id="next-button" class="subtitle-button">»</button><!--
            --></div>
            <div class="line-break"></div>
            <div id="below-subtitles">
                <div id="skip-music" class="hide sync-msg"></div>
                <div id="synced" class="hide sync-msg">Subtitles successfully synced!</div>
                <div id="not-synced" class="hide sync-msg">Error: No subtitles selected!</div>
                <div id="loaded" class="hide sync-msg">Subtitles successfully loaded!</div>
            </div>
        </div>
      `;
        shadow.innerHTML = shadowTemplate;
        shadow.querySelector("#subtitle-div").addEventListener(
            "mousedown",
            (e) => {
                if (!ctrlPressed) {
                    initiateDrag(e);
                    e.stopPropagation();
                }
            },
            true
        );

        // Hiding the subtitle controller on youtube when loading another video without refreshing the page.
        // This is definitely not a perfect solution but it's the best I could come up with today. 
        document.body.addEventListener("click", function () {
            if (!extensionOn) {
                setTimeout(() => {
                    wrapper.classList.add("vsc-nosource");
                }, 1000);
            }

            // If the url changed, it means another video was loaded. 
            const newUrl = window.location.href;
            if (newUrl !== exactUrl) {
                exactUrl = newUrl;
                // Reset the subtitles
                subs = [{ text: defaultSubtitles }];
                shadow.querySelector("#subtitles").innerHTML = subs[0].text;
                shadow.querySelector("#chooseFile").value = "";

                // Make sure the subtitles are being placed correctly! Definitely don't omit this step on Youtube!
                subtitlePlacer();
            }

            disableHighlighting(shadow);
        });

        chrome.runtime.onMessage.addListener(messageReceived);

        thisVideo = this.video;

        function messageReceived(msg) {
            if (msg.hide) {
                extensionOn = false;
                wrapper.classList.add("vsc-nosource");

            } else if (msg.show) {
                extensionOn = true;
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

            lastTimeExtClicked = Date.now();

            if (thisVideo.currentTime > subs[pos].start + 1) {
                thisVideo.currentTime = subs[pos].start;

            } else if (pos !== 0) {
                thisVideo.currentTime = subs[pos - 1].start;
            }

            disableHighlighting(shadow);
        });

        shadow.getElementById("next-button").addEventListener("click", () => {
            forwardRewind = true;

            lastTimeExtClicked = Date.now();

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

        shadow.getElementById("settings-wrapper").addEventListener("click", () => {
            lastTimeExtClicked = Date.now();
        });

        shadow.getElementById("controller").addEventListener("click", () => {
            lastTimeExtClicked = Date.now();
        });

        shadow.getElementById("video-icon").addEventListener("click", () => {
            lastTimeExtClicked = Date.now();

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
            if (extensionOn) {
                // If a number was pressed while the input field of the settings menu is focused, stop it from skipping to 10%, 20%, 30% and so on...
                if (e.keyCode >= 48 && e.keyCode <= 57) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                // If space was pressed play/stop the video!
                if (e.keyCode == 32) {
                    if (thisVideo.paused) {
                        thisVideo.play();
                    } else {
                        thisVideo.pause();
                    }

                    e.preventDefault();
                    e.stopPropagation();
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
                // Reposition the subtitles correctly
                const subLocation = subtitleLocation(thisSite, thisVideo);
                shadow.getElementById("controller").style[subLocation.pos] = subLocation.offset;

                if (!subtitlesHidden) {
                    shadow.getElementById("controller").classList.remove("hide");
                }

                if (!menuOpen) {
                    if (thisVideo.clientWidth > iconThreshold[screenSize]) {
                        // fullscreen, show big icon
                        shadow.getElementById("video-img").src = videoIcon[screenSize].bigIcon;

                    } else {
                        // small screen, show small icon
                        shadow.getElementById("video-img").src = videoIcon[screenSize].smallIcon;
                    }
                    shadow.getElementById("video-icon").classList.remove("hide");
                }
            }, 500);
        }

        // Hide video icon if necessary!
        this.video.addEventListener("play", function () {
            videoIconCount++;
            const thisCount = videoIconCount;

            // In the rare case that the website uses capturing instead of bubbling this will prevent unexpected behaviour
            if (Math.abs(lastTimeExtClicked - Date.now()) <= 50 && !recentlyForcedPlayback) {
                recentlyForcedPlayback = true;
                thisVideo.pause();
                setTimeout(() => {
                    recentlyForcedPlayback = false;
                }, 51);
            }

            setTimeout(() => {
                hideVideoIcon(shadow, thisVideo, thisCount);
            }, 2900);
        });

        // Show video icon
        this.video.addEventListener("pause", function () {
            // In the rare case that the website uses capturing instead of bubbling this will prevent unexpected behaviour
            if (Math.abs(lastTimeExtClicked - Date.now()) <= 50 && !recentlyForcedPlayback) {
                recentlyForcedPlayback = true;

                thisVideo.play();

                setTimeout(() => {
                    recentlyForcedPlayback = false;
                }, 51);
            }

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
            fontSize.val = newSize;
            chrome.storage.sync.set({
                fontSize: {
                    [screenSize]: newSize
                }
            });
        });

        shadow.querySelector("#display-range-2").addEventListener("input", (e) => {
            const newOpacity = e.target.value;
            shadow.querySelector("#display-range-2").value = newOpacity;
            shadow.querySelector("#subtitle-div").style.backgroundColor = `rgba(0, 0, 0, ${newOpacity})`;
            opacity = newOpacity;
            chrome.storage.sync.set({ opacity: newOpacity });
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
        shadow.querySelector("#subtitles").style.fontSize = fontSize.val + "px";
        shadow.querySelectorAll(".subtitle-button").forEach(elem => elem.style.fontSize = fontSize.val + "px");
        shadow.querySelector("#subtitle-div").style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;

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

            languageEncoding(file).then(fileInfo => {
                const reader = new FileReader();

                reader.onload = function (evt) {
                    const content = evt.target.result;
                    processSubtitles(content.split("\n"));
                };
                reader.readAsText(file, fileInfo.encoding);

            }).catch(err => {
                console.log("Error caught:", err);
            });
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
    if (!extensionOn) {
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
                // Shortcuts and Text Highlighting
                if (extensionOn) {
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

                    } else if (key === "Escape" && menuOpen) {
                        handleMenuClose(thisVideo, shadow);
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
                    return false;
                }

                // Ignore keydown event if typing in a page without vsc
                if (!tc.mediaElements.length) {
                    return false;
                }

                // Movie Subtitles Shortcuts
                if (extensionOn) {
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
        if (node.nodeName === "VIDEO") {
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

    var mediaTags = document.querySelectorAll("video");

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
}

function initiateDrag(e) {
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
            handleDrag(v, e);
        }
    });
}

function pause(v) {
    if (v.paused) {
        v.play();
    } else {
        v.pause();
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
    controller.classList.add("vcs-show");

    if (timer) clearTimeout(timer);

    timer = setTimeout(function () {
        controller.classList.remove("vcs-show");
        timer = false;
    }, 2000);
}

chrome.runtime.onMessage.addListener(processMessage);

function processMessage(msg, sender, sendResponse) {
    if (msg.contentRunning) {
        sendResponse(true);

    } else if (msg.show) {
        const initialized = document.body.classList.contains("movie-subtitles-initialized");
        if (!initialized) {
            extensionOn = true;
            initializeNow(document);
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

function processSubtitles(content) {
    const newSubs = [];
    const emptyLines = [];
    const musicRegEx = new RegExp('♪');
    let count = 0;
    let type = null;
    let previousTextWithoutHtml = { text: null, count: -1 };
    let prevLine = null;
    let curlyBraces = 0;

    // Determine the subtitle format to choose the appropriate method for reading them!
    for (let i = 50; i < 60; i++) {
        const line = content[i].trim();
        if (/{.*}{.*}/.test(line)) {
            curlyBraces++;
        }
    }

    // Use Method 1 to read the subtitles
    if (curlyBraces >= 7) {
        for (let i = 0; i < content.length; i++) {
            const line = content[i].trim().replace(/\n/g, "");
            const split = line.split(/[{}|]/g).filter(e => e);

            // Only lines that contain text! Empty lines will be skipped...
            if (split.length > 2) {
                const start = split[0];
                const end = split[1];
                const formatting = split.some(elem => /y:/.test(elem));
                const music = split.some(elem => musicRegEx.test(elem));
                const text = split.reduce((acc, val) => /[{}\d\|(y:)]/g.test(val) ? acc : acc + " " + val, "").trim();

                if (text && start && end) {
                    const node = {};

                    // Make sure it's a number!
                    node.start = Number((Number(start) / (24000 / 1001)).toFixed(3));  // 24000 / 1001 = 23.976 frame/s
                    node.end = Number((Number(end) / (24000 / 1001)).toFixed(3));  // // 24000 / 1001 = 23.976 frame/s

                    if (formatting) {
                        const format = split.reduce((acc, val) => /y:/.test(val) ? val.replace(/y:/, "") : acc, "");
                        node.text = `<${format}>${text}</${format}>`;
                    } else {
                        node.text = text;
                    }

                    if (music) node.music = {};

                    newSubs.push(node);
                }
            }
        }

        // Use Method 2 to read the subtitles
    } else {
        newSubs.push({ text: "" });
        for (let i = 0; i < content.length; i++) {
            const line = content[i].trim().replace(/\n/g, "");

            if (type === "time") {
                if (count >= newSubs.length) break;

                type = "text";
                const split = line.split(/ --> /);
                const start = timeInSeconds(split[0]);
                const end = timeInSeconds(split[1]);

                // Updating the object
                newSubs[count].start = Number(start);
                newSubs[count].end = Number(end);

            } else if (type === "text") {
                // If the next line is empty, set the type for the next i to null!
                if (i + 1 < content.length) {
                    const nextLineEmpty = !content[i + 1].trim();
                    if (nextLineEmpty) {
                        type = null;
                    }
                }

                // Removing html tags, because they do not count as text. 
                const textWithoutHtml = line.replace(/\<\/*.*?\>/g, "");
                // If this line doesn't contain word characters and the next line contains no text at all push "count" into the empty array so it can be removed later on
                if (!textWithoutHtml && type === null) {
                    // If the current node has one line
                    if (previousTextWithoutHtml.count !== count) {
                        emptyLines.push(count);

                        // If the current node has two lines or more
                    } else if (!previousTextWithoutHtml.text) {
                        // If the previous line has the same count and doesn't contain word characters either
                        emptyLines.push(count);
                    }
                }
                previousTextWithoutHtml = { text: textWithoutHtml, count: count };

                newSubs[count].text += line + " ";

                const music = musicRegEx.test(newSubs[count].text);

                // If it's music
                if (music) {
                    newSubs[count].music = {};
                }

            } else if (!line) {
                if (i > 0 && !prevLine) {
                    // Don't increase the count! It's just an empty line...

                } else {
                    count++;
                }

            } else if (!isNaN(line)) {
                type = "time";
                newSubs.push({ text: "" });
            }

            prevLine = line;
        }
    }

    // Delete all empty lines! We only want to keep lines that contain word characters!
    for (let b = emptyLines.length - 1; b >= 0; b--) {
        newSubs.splice([emptyLines[b]], 1);
    }

    // Delete the last node in the subtitle array if it has no text
    if (!newSubs[newSubs.length - 1].text.trim()) newSubs.pop();

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

    // Hide success message after a few seconds
    setTimeout(() => {
        shadow.querySelector("#loaded").classList.add("hide");
    }, 3000);

    // If the video is paused, play it for just a millisecond, so the subtitles will display correctly
    if (thisVideo.paused) {
        thisVideo.play();
        thisVideo.pause();
    }
}

function getScreenSize() {
    const width = screen.width;

    if (width <= 1024) {
        return "small";

    } else if (width <= 1366) {
        return "medium";

    } else if (width <= 1920) {
        return "large";

    } else {
        return "XL";
    }
}
},{"detect-file-encoding-and-language":2}],2:[function(require,module,exports){
(function (global){(function (){
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).languageEncoding=e()}}((function(){return function e(n,i,o){function u(a,g){if(!i[a]){if(!n[a]){var c="function"==typeof require&&require;if(!g&&c)return c(a,!0);if(t)return t(a,!0);var s=new Error("Cannot find module '"+a+"'");throw s.code="MODULE_NOT_FOUND",s}var r=i[a]={exports:{}};n[a][0].call(r.exports,(function(e){return u(n[a][1][e]||e)}),r,r.exports,e,n,i,o)}return i[a].exports}for(var t="function"==typeof require&&require,a=0;a<o.length;a++)u(o[a]);return u}({1:[function(e,n,i){n.exports=e=>{for(let n=0;n<e.length;n++)if("�"===e[n])return!1;return!0}},{}],2:[function(e,n,i){const o=e("./processing-content/countAllMatches.js"),u=e("./processing-content/calculateConfidenceScore.js");n.exports=n=>{const i={},t=e("../language-config/languageObject.js");n.languageArr=o(n,t),i.language=n.languageArr.reduce(((e,n)=>e.count>n.count?e:n)).name,n.pos=n.languageArr.findIndex((e=>e.name===i.language)),i.encoding=n.utf8?"UTF-8":n.languageArr[n.pos].encoding;const a=u(n,i);return n.testFilePath?a:(i.confidence=a,n.languageArr[n.pos].count||(i.language=null,i.encoding=n.utf8?"UTF-8":null,i.confidence=n.utf8?1:null),i)}},{"../language-config/languageObject.js":6,"./processing-content/calculateConfidenceScore.js":3,"./processing-content/countAllMatches.js":4}],3:[function(e,n,i){n.exports=(e,n)=>{const i=new RegExp(/\d|\n|\s|\-|\.|\,|\:|\;|\?|\!|\<|\>|\[|\]|\{|\}|\&|\=|\|/,"g"),o=e.content.replace(i,"").length,u=e.languageArr,t=e.pos,a=e.testFilePath,g=u.reduce(((e,i)=>e.name===n.language?i:i.name===n.language||e.count>=i.count?e:i)),c=u[t].count/(g.count+u[t].count),s=u[t].count/o;let r=null,h=null;let l;if(e.utf8?(r=u[t].utfFrequency?.8*u[t].utfFrequency.low:null,h=u[t].utfFrequency?(u[t].utfFrequency.low+u[t].utfFrequency.high)/2:null):(r=u[t].isoFrequency?.8*u[t].isoFrequency.low:null,h=u[t].isoFrequency?(u[t].isoFrequency.low+u[t].isoFrequency.high)/2:null),r&&h)if(s>=h)l=1;else if(s>r){l=Number((c+(1-c)*((s-r)/(h-r))).toFixed(2))}else l=Number((c*(s/r)).toFixed(2));else l=null;return a?{name:a.substr(a.lastIndexOf("/")+1),path:a,language:n.language,utf8:e.utf8,confidence:l,ratio:Number(c.toFixed(2)),count:u[t].count,totalCharacters:o,characterWordRatio:s.toFixed(6),secondLanguage:{name:g.name,count:g.count}}:l}},{}],4:[function(e,n,i){n.exports=(e,n)=>{const i=[];n.forEach((e=>{const n={};Object.keys(e).forEach((i=>{"count"!==i?n[i]=e[i]:n.count=0})),i.push(n)}));const o=e.utf8?"utfRegex":"isoRegex";return i.forEach((n=>{if(n[o]){const i=e.content.match(n[o]);i&&(n.count=i.length)}})),i}},{}],5:[function(e,n,i){const o=e("./components/checkUTF.js"),u=e("./components/processContent.js");n.exports=(e,n)=>new Promise(((n,i)=>{const t={},a=new FileReader;a.onerror=e=>{i(e)},a.onload=()=>{const i=a.result;if(t.utf8=o(i),t.utf8)t.content=i,n(u(t));else{const i=new FileReader;i.onload=()=>{t.content=i.result,n(u(t))},i.readAsText(e,"ISO-8859-1")}},a.readAsText(e,"UTF-8")}))},{"./components/checkUTF.js":1,"./components/processContent.js":2}],6:[function(e,n,i){const o="gi",u={czech:new RegExp(/jsem|jsi/,o),hungarian:new RegExp(/\snem\s/,o),slovak:new RegExp(/poriadku|myslím|\ssme\s/,o),slovenian:new RegExp(/\skaj\s|lahko|zdaj/,o),albanian:new RegExp(/nuk/,o),english:new RegExp(/ the /,o),french:new RegExp(/c'est/,o),portuguese:new RegExp(/ não /,o),spanish:new RegExp(/estaba|\smuy\s|siempre|ahora/,o),german:new RegExp(/\sdas\s/,o),italian:new RegExp(/\sche\s/,o),danish:new RegExp(/hvad|noget/,o),norwegian:new RegExp(/deg/,o),swedish:new RegExp(/ jag /,o),dutch:new RegExp(/ het /,o),finnish:new RegExp(/hän/,o),"serbo-croatian":new RegExp(/ sam | kako /,o),estonian:new RegExp(/\sseda\s|\spole\s|midagi/,o),icelandic:new RegExp(/Það/,o),"malay-indonesian":new RegExp(/tidak/,o),turkish:new RegExp(/ bir /,o),lithuanian:new RegExp(/taip|\stai\s/,o),bengali:new RegExp(/এটা/,o),hindi:new RegExp(/हैं/,o),urdu:new RegExp(/ایک/,o),vietnamese:new RegExp(/ không /,o)},t={polish:{low:.004355,high:.005102},czech:{low:.004433,high:.007324},hungarian:{low:.004994,high:.005183},romanian:{low:.003319,high:.00419},slovak:{low:.001736,high:.002557},slovenian:{low:.004111,high:.004959},albanian:{low:.003773,high:.007313},ukrainian:{low:.002933,high:.005389},english:{low:.004679,high:.00758},french:{low:.003016,high:.004825},portuguese:{low:.003406,high:.005032},spanish:{low:.002348,high:.002881},german:{low:.004044,high:.004391},italian:{low:.003889,high:.005175},danish:{low:.00363,high:.004189},norwegian:{low:.00241,high:.003918},swedish:{low:.004916,high:.007221},dutch:{low:.003501,high:.00415},finnish:{low:.003308,high:.005135},"serbo-croatian":{low:.002568,high:.005182},estonian:{low:.002892,high:.003963},icelandic:{low:.004366,high:.004366},"malay-indonesian":{low:.002825,high:.003932},greek:{low:.00344,high:.004862},turkish:{low:.002915,high:.004588},hebrew:{low:.003663,high:.004666},lithuanian:{low:.003277,high:.003768},bengali:{low:.003155,high:.005236},hindi:{low:.004159,high:.006478},urdu:{low:.004118,high:.005851},vietnamese:{low:.003387,high:.005191}};n.exports=[{name:"polish",count:0,utfRegex:new RegExp(/się/,o),isoRegex:new RegExp(/siê/,o),encoding:"CP1250",utfFrequency:t.polish,isoFrequency:t.polish},{name:"czech",count:0,utfRegex:u.czech,isoRegex:u.czech,encoding:"CP1250",utfFrequency:t.czech,isoFrequency:t.czech},{name:"hungarian",count:0,utfRegex:u.hungarian,isoRegex:u.hungarian,encoding:"CP1250",utfFrequency:t.hungarian,isoFrequency:t.hungarian},{name:"romanian",count:0,utfRegex:new RegExp(/sunt|eşti/,o),isoRegex:new RegExp(/sunt|eºti/,o),encoding:"CP1250",utfFrequency:t.romanian,isoFrequency:t.romanian},{name:"slovak",count:0,utfRegex:u.slovak,isoRegex:u.slovak,encoding:"CP1250",utfFrequency:t.slovak,isoFrequency:t.slovak},{name:"slovenian",count:0,utfRegex:u.slovenian,isoRegex:u.slovenian,encoding:"CP1250",utfFrequency:t.slovenian,isoFrequency:t.slovenian},{name:"albanian",count:0,utfRegex:u.albanian,isoRegex:u.albanian,encoding:"CP1250",utfFrequency:t.albanian,isoFrequency:t.albanian},{name:"russian",count:0,utfRegex:new RegExp(/что/,o),isoRegex:new RegExp(/÷òî/,o),encoding:"CP1251",utfFrequency:{low:.004965,high:.005341},isoFrequency:{low:.003884,high:.003986}},{name:"ukrainian",count:0,utfRegex:new RegExp(/він|але/,o),isoRegex:new RegExp(/â³í|àëå/,o),encoding:"CP1251",utfFrequency:t.ukrainian,isoFrequency:t.ukrainian},{name:"bulgarian",count:0,utfRegex:new RegExp(/това|какво/,o),isoRegex:new RegExp(/òîâà|äîáðå|êaêâo/,o),encoding:"CP1251",utfFrequency:{low:.005225,high:.005628},isoFrequency:{low:.002767,high:.004951}},{name:"english",count:0,utfRegex:u.english,isoRegex:u.english,encoding:"CP1252",utfFrequency:t.english,isoFrequency:t.english},{name:"french",count:0,utfRegex:u.french,isoRegex:u.french,encoding:"CP1252",utfFrequency:t.french,isoFrequency:t.french},{name:"portuguese",count:0,utfRegex:u.portuguese,isoRegex:u.portuguese,encoding:"CP1252",utfFrequency:t.portuguese,isoFrequency:t.portuguese},{name:"spanish",count:0,utfRegex:u.spanish,isoRegex:u.spanish,encoding:"CP1252",utfFrequency:t.spanish,isoFrequency:t.spanish},{name:"german",count:0,utfRegex:u.german,isoRegex:u.german,encoding:"CP1252",utfFrequency:t.german,isoFrequency:t.german},{name:"italian",count:0,utfRegex:u.italian,isoRegex:u.italian,encoding:"CP1252",utfFrequency:t.italian,isoFrequency:t.italian},{name:"danish",count:0,utfRegex:u.danish,isoRegex:u.danish,encoding:"CP1252",utfFrequency:t.danish,isoFrequency:t.danish},{name:"norwegian",count:0,utfRegex:u.norwegian,isoRegex:u.norwegian,encoding:"CP1252",utfFrequency:t.norwegian,isoFrequency:t.norwegian},{name:"swedish",count:0,utfRegex:u.swedish,isoRegex:u.swedish,encoding:"CP1252",utfFrequency:t.swedish,isoFrequency:t.swedish},{name:"dutch",count:0,utfRegex:u.dutch,isoRegex:u.dutch,encoding:"CP1252",utfFrequency:t.dutch,isoFrequency:t.dutch},{name:"finnish",count:0,utfRegex:u.finnish,isoRegex:u.finnish,encoding:"CP1252",utfFrequency:t.finnish,isoFrequency:t.finnish},{name:"serbo-croatian",count:0,utfRegex:u["serbo-croatian"],isoRegex:u["serbo-croatian"],encoding:"CP1252",utfFrequency:t["serbo-croatian"],isoFrequency:t["serbo-croatian"]},{name:"estonian",count:0,utfRegex:u.estonian,isoRegex:u.estonian,encoding:"CP1252",utfFrequency:t.estonian,isoFrequency:t.estonian},{name:"icelandic",count:0,utfRegex:u.icelandic,isoRegex:u.icelandic,encoding:"CP1252",utfFrequency:t.icelandic,isoFrequency:t.icelandic},{name:"malay-indonesian",count:0,utfRegex:u["malay-indonesian"],isoRegex:u["malay-indonesian"],encoding:"CP1252",utfFrequency:t["malay-indonesian"],isoFrequency:t["malay-indonesian"]},{name:"greek",count:0,utfRegex:new RegExp(/είναι/,o),isoRegex:new RegExp(/åßíáé/,o),encoding:"CP1253",utfFrequency:t.greek,isoFrequency:t.greek},{name:"turkish",count:0,utfRegex:u.turkish,isoRegex:u.turkish,encoding:"CP1254",utfFrequency:t.turkish,isoFrequency:t.turkish},{name:"hebrew",count:0,utfRegex:new RegExp(/אתה/,o),isoRegex:new RegExp(/àúä/,o),encoding:"CP1255",utfFrequency:t.hebrew,isoFrequency:t.hebrew},{name:"arabic",count:0,utfRegex:new RegExp(/هذا/,o),isoRegex:new RegExp(/åðç/,o),encoding:"CP1256",utfFrequency:{low:.003522,high:.004348},isoFrequency:{low:.003773,high:.005559}},{name:"farsi-persian",count:0,utfRegex:new RegExp(/اون/,o),isoRegex:new RegExp(/çíä/,o),encoding:"CP1256",utfFrequency:{low:.002761,high:.004856},isoFrequency:{low:.00301,high:.006646}},{name:"lithuanian",count:0,utfRegex:u.lithuanian,isoRegex:u.lithuanian,encoding:"CP1257",utfFrequency:t.lithuanian,isoFrequency:t.lithuanian},{name:"chinese-simplified",count:0,utfRegex:new RegExp(/么/,o),isoRegex:new RegExp(/´ó|¶¯|Å®/,o),encoding:"GB18030",utfFrequency:{low:.009567,high:.011502},isoFrequency:{low:.003137,high:.005009}},{name:"chinese-traditional",count:0,utfRegex:new RegExp(/們/,o),isoRegex:new RegExp(/¦b/,o),encoding:"BIG5",utfFrequency:{low:.012484,high:.014964},isoFrequency:{low:.005063,high:.005822}},{name:"japanese",count:0,utfRegex:new RegExp(/ど/,o),isoRegex:new RegExp(/‚»/,o),encoding:"Shift-JIS",utfFrequency:{low:.004257,high:.006585},isoFrequency:{low:.004286,high:.004653}},{name:"korean",count:0,utfRegex:new RegExp(/도/,o),isoRegex:new RegExp(/àö¾î|å¾ß|¡¼­/,o),encoding:"EUC-KR",utfFrequency:{low:.01091,high:.01367},isoFrequency:{low:.004118,high:.004961}},{name:"thai",count:0,utfRegex:new RegExp(/แฮร์รี่|พอตเตอร์/,o),isoRegex:new RegExp(/áîãìãõè|¾íµàµíãì­/,o),encoding:"TIS-620",utfFrequency:{low:.003194,high:.003468},isoFrequency:{low:.002091,high:.002303}},{name:"bengali",count:0,utfRegex:u.bengali,isoRegex:u.bengali,utfFrequency:t.bengali,isoFrequency:t.bengali},{name:"hindi",count:0,utfRegex:u.hindi,isoRegex:u.hindi,utfFrequency:t.hindi,isoFrequency:t.hindi},{name:"urdu",count:0,utfRegex:u.urdu,isoRegex:u.urdu,utfFrequency:t.urdu,isoFrequency:t.urdu},{name:"vietnamese",count:0,utfRegex:u.vietnamese,isoRegex:u.vietnamese,utfFrequency:t.vietnamese,isoFrequency:t.vietnamese}]},{}]},{},[5])(5)}));
}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1]);
