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
let blacklist = {};
let thisSite = null;
let lastTimeExtClicked = {};
let recentlyForcedPlayback = null;
let opacity = 0.5;
let fontSize = 28;
const red = "#C62828";
const orange = "#f0653b";
const defaultSubtitles = "To load subtitles click on the icon in the top left corner!";

const backgroundPort = chrome.runtime.connect();
backgroundPort.onDisconnect.addListener(() => {
    // Immediately hiding the extension when disabled via the 
    // extension page so that the user doesn't have to refresh the page. 
    extensionOn = false;
    wrapper.classList.add("vsc-nosource");
});

let shortcuts = {
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
    if (storage.shortcuts !== undefined) extensionOn = storage.enabled;
    if (storage.shortcuts !== undefined) shortcuts = storage.shortcuts;
    if (storage.opacity !== undefined) opacity = storage.opacity;
    if (storage.fontSize !== undefined) fontSize = storage.fontSize;
    if (storage.blacklist !== undefined) blacklist = storage.blacklist;

    // Update thisSite
    chrome.runtime.sendMessage("getUrl", function (response) {
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
                        <input class="slider" id="display-range-1" type="range" min="2" max="54" value="${fontSize}">
                    </div>
                    <div class="display-box" style="margin-top: -10px">
                        <label class="display-label" for="display-range-2">Background:</label>
                        <input class="slider" id="display-range-2" type="range" min="0" max="1" step="0.05" value="${opacity}">
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
            <div id="subtitle-div" style="background-color: rgba(0, 0, 0, ${opacity});">
                <button id="prev-button" class="subtitle-button">«</button>
                <div id="subtitles">${subs[0].text}</div>
                <button id="next-button" class="subtitle-button">»</button>
            </div>
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
            if (!extensionOn || blacklist[thisSite]) {
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
            }

            disableHighlighting(shadow);
        });

        chrome.runtime.onMessage.addListener(messageReceived);

        thisVideo = this.video;

        function messageReceived(msg) {
            if (msg.hide) {
                extensionOn = false;
                blacklist = msg.blacklist;
                wrapper.classList.add("vsc-nosource");

            } else if (msg.show) {
                extensionOn = true;
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
                    if (thisVideo.clientWidth >= 1200) {
                        // fullscreen, show big icon
                        shadow.getElementById("video-img").src = chrome.runtime.getURL("icons/movie-subtitles-38.png");

                    } else {
                        // small screen, show small icon
                        shadow.getElementById("video-img").src = chrome.runtime.getURL("icons/movie-subtitles-28.png");
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
            fontSize = newSize;
            chrome.storage.sync.set({ fontSize: newSize });
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
        shadow.querySelector("#subtitles").style.fontSize = fontSize + "px";
        shadow.querySelectorAll(".subtitle-button").forEach(elem => elem.style.fontSize = fontSize + "px");
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
            const reader = new FileReader;
            detectEncoding(file, reader, "UTF-8");
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
    if (!extensionOn || blacklist[thisSite]) {
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

function detectEncoding(file, reader, encoding) {
    reader.onload = () => {
        const srtFile = reader.result;

        if (encoding === "UTF-8") {  // Any language
            console.log("utf");


            function text2Binary(string) {
                return string.split('').map(function (char) {
                    return char.charCodeAt(0).toString(2);
                }).join(' ');
            }

            console.log(text2Binary(srtFile));

            // const encodingCorrect = !/�/i.test(srtFile);

            // if (encodingCorrect) {
            //     processSubtitles(srtFile.split("\n"));
            // } else {
            //     detectEncoding(file, reader, "ISO-8859-1");
            // }

        } else {  // Latin languages
            const languageCount = {
                russian: 0,
                polish: 0,
                arabic: 0,
                chineseSimple: 0,
                chineseTrad: 0,
                japanese: 0
            };

            const srtSplit = srtFile.split("\n");

            srtSplit.forEach(phrase => {
                if (/÷òî/.test(phrase)) {
                    languageCount.russian++;
                }
                if (/siê/.test(phrase)) {
                    languageCount.polish++;
                }
                if (/åÐÇ/.test(phrase) || /åÇÑí/.test(phrase)) {
                    languageCount.arabic++;
                }
                if (/ÔÚ/.test(phrase)) {
                    languageCount.chineseSimple++;
                }
                if (/¦b/.test(phrase)) {
                    languageCount.chineseTrad++;
                }
                if (/‚»/.test(phrase)) {
                    languageCount.japanese++;
                }

            });

            console.log("languageCount", languageCount);
            processSubtitles(srtFile.split("\n"));
        }



        // else if (encoding === "ISO-8859-1") {  // Latin
        //     console.log("iso");
        //     const encodingCorrect = !/(å|\w³\w)/i.test(srtFile);    // å = Russian = cp1251 || \w³\w = Polish = cp1250

        //     if (encodingCorrect) {
        //         processSubtitles(srtFile.split("\n"));
        //     } else {
        //         detectEncoding(file, reader, "CP1251");
        //     }

        // } else if (encoding === "CP1251") {  // Cyrillic
        //     console.log("1251");
        //     let encodingCorrect = !/Ї/i.test(srtFile);    // Ї = Polish = cp1250

        //     if (encodingCorrect) {
        //         processSubtitles(srtFile.split("\n"));
        //     } else {
        //         detectEncoding(file, reader, "CP1250");
        //     }

        // } else if (encoding === "CP1250") {  // Polish
        //     console.log("1250");
        //     const encodingCorrect = !/ß/i.test(srtFile);    // ß = Arabic = cp1256

        //     if (encodingCorrect) {
        //         processSubtitles(srtFile.split("\n"));
        //     } else {
        //         detectEncoding(file, reader, "CP1256");
        //     }

        // } else if (encoding === "CP1256") {  // Arabic
        //     console.log("1256");
        //     const encodingCorrect = !/ß/i.test(srtFile);    // ß = Arabic = cp1256

        //     if (encodingCorrect) {
        //         processSubtitles(srtFile.split("\n"));
        //     } else {
        //         detectEncoding(file, reader, "GB18030");
        //     }

        // } else if (encoding === "GB18030") {  // Chinese
        //     console.log("GB18030");
        //     processSubtitles(srtFile.split("\n"));

        // } else {
        //     console.log("Sorry, the language of this subtitle file is not yet supported");
        // }


    };

    reader.readAsText(file, encoding);
}

function processSubtitles(srtFile) {
    const newSubs = [{ text: "" }];
    const emptyLines = [];
    const musicRegEx = new RegExp('♪');
    let count = 0;
    let type = null;
    let previousTextWithoutHtml = { text: null, count: -1 };
    let prevLine = null;

    for (let i = 0; i < srtFile.length; i++) {
        const line = srtFile[i].trim().replace(/\n/g, "");

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
            if (i + 1 < srtFile.length) {
                const nextLineEmpty = !srtFile[i + 1].trim();
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