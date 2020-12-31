let monitoring = false;
let pausing = false;

// This is the position of the subtitle array that is currently being displayed
let pos = 0;

// The subtitle array before putting our subtitles in there
let subs = [{ text: "No subtitles selected." }];

// Subtitle calibration/Synchronization
let offset = 0;
let direction = "earlier";

function buttonClicked(e) {
    const action = e.currentTarget.myParam;

    // Enables us to jump between sentences. Either to the next or to the previous sentence
    if (subs) {
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

function subtitleCalibrator(calibration, video) {
    let offset = 0;

    if (calibration.direction === "earlier") {
        offset = calibration.offset * -1;
    } else {
        offset = calibration.offset;
    }

    // Calculate the new start and end times for the whole subtitle array
    calibratedSubs = [];

    subs.forEach(elem => {
        calibratedSubs.push({ start: elem.start + offset, end: elem.end + offset, text: elem.text });
    });

    subs = calibratedSubs;

    // If the video is paused, play it for just a millisecond, so the subtitles will display correctly
    if (video.paused) {
        video.play();
        video.pause();
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
        fontSize: "28px",
        keyBindings: [],
        blacklist: `\
      www.instagram.com
      twitter.com
      vine.co
      imgur.com
      teams.microsoft.com
    `.replace(regStrip, ""),
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

chrome.storage.sync.get(tc.settings, function(storage) {
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
            fontSize: tc.settings.fontSize,
            blacklist: tc.settings.blacklist.replace(regStrip, "")
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
    tc.settings.fontSize = String(storage.fontSize);
    tc.settings.blacklist = String(storage.blacklist);

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

    initializeWhenReady(document);
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
    tc.videoController = function(target, parent) {
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

        var mediaEventAction = function(event) {
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
            // TODO: Check if explicitly setting the playback rate to 1.0 is
            // necessary when rememberSpeed is disabled (this may accidentally
            // override a website's intentional initial speed setting interfering
            // with the site's default behavior)
            log("Explicitly setting playbackRate to: " + storedSpeed, 4);
            setSpeed(event.target, storedSpeed);
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

    tc.videoController.prototype.remove = function() {
        this.div.remove();
        this.video.removeEventListener("play", this.handlePlay);
        this.video.removeEventListener("seek", this.handleSeek);
        delete this.video.vsc;
        let idx = tc.mediaElements.indexOf(this.video);
        if (idx != -1) {
            tc.mediaElements.splice(idx, 1);
        }
    };

    tc.videoController.prototype.initializeControls = function() {
        log("initializeControls Begin", 5);
        var document = this.video.ownerDocument;
        var speed = this.video.playbackRate.toFixed(2),
            // top = Math.max(this.video.offsetTop, 0) + "px",
            top = "300px",
            left = Math.max(this.video.offsetLeft, 0) + "px";

        log("Speed variable set to: " + speed, 5);

        var wrapper = document.createElement("div");
        wrapper.classList.add("vsc-controller");

        if (!this.video.currentSrc) {
            wrapper.classList.add("vsc-nosource");
        }

        if (tc.settings.startHidden) {
            wrapper.classList.add("vsc-hidden");
        }

        var shadow = wrapper.attachShadow({ mode: "open" });
        var shadowTemplate = `
        <style>
          @import "${chrome.runtime.getURL("shadow.css")}";
        </style>

        <div id="controller" class="subtitles-centered" style="opacity:${tc.settings.controllerOpacity}">
          <div id="background-div">
            <button data-action="rewind" class="rw prev-next-button">«</button></button>
            <div data-action="drag" class="draggable" id="subtitles">No subtitles selected</div>
            <button data-action="advance" class="rw prev-next-button">»</button> 
            <div id="controls">
              <span style="font-size: 14px;">Size:</span>
              <button data-action="smaller" id="size-minus">&minus;</button>
              <button data-action="bigger" id="size-plus">&plus;</button>
              <span style="margin-left: 30px; font-size: 14px;">Background:</span>
              <button data-action="lighter" id="opacity-minus">&minus;</button>
              <button data-action="darker" id="opacity-plus">&plus;</button>
              <span style="margin-left: 30px;">
                <label for="chooseFile" class="fileLabel">Select Subtitles</label>
                <input id="chooseFile" type="file" accept=".srt"></input>
              </span>
            </div>
          </div>
        </div>
      `;
        shadow.innerHTML = shadowTemplate;
        shadow.querySelector(".draggable").addEventListener(
            "mousedown",
            (e) => {
                runAction(e.target.dataset["action"], false, e);
                e.stopPropagation();
            },
            true
        );

        // Hiding the subtitle controller on youtube when loading another video without refreshing the page.
        // This is definitely not a perfect solution but it's the best I could come up with today. 
        document.body.addEventListener("click", function() {
            if (!tc.settings.enabled) {
                setTimeout(() => {
                    wrapper.classList.add("vsc-nosource");
                }, 1000);
            }
        });

        chrome.runtime.onMessage.addListener(messageReceived);

        function messageReceived(msg) {
            if (msg.pushSubtitles) {
                shadow.getElementById("controller").classList.remove("subtitles-centered");

            } else if (msg.popupClosing) {
                shadow.getElementById("controller").classList.add("subtitles-centered");

            } else if (msg.subtitles) {
                subs = msg.subtitles;

            } else if (msg.calibration) {
                subtitleCalibrator(msg.calibration, this.video);

            } else if (msg.import) {
                shadow.getElementById("chooseFile").click();

            } else if (msg.hide) {
                tc.settings.enabled = false;
                wrapper.classList.add("vsc-nosource");

            } else if (msg.show && tc.settings.enabled) {
                wrapper.classList.remove("vsc-nosource");

            } else if (msg.size) {
                if (msg.size === "minus") {
                    shadow.querySelector("#size-minus").click();

                } else {
                    shadow.querySelector("#size-plus").click();
                }
            } else if (msg.opacity) {
                if (msg.opacity === "minus") {
                    shadow.querySelector("#opacity-minus").click();

                } else {
                    shadow.querySelector("#opacity-plus").click();
                }
            }
        }

        this.video.addEventListener("play", function() {
            shadow.getElementById("controller").classList.add("subtitles-centered");
        });

        this.video.addEventListener("pause", function() {
            shadow.getElementById("controller").classList.add("subtitles-centered");
        });

        shadow.querySelector("#subtitles").style.fontSize = tc.settings.fontSize;

        shadow.querySelectorAll(".prev-next-button").forEach(elem => elem.style.fontSize = tc.settings.fontSize);

        const resizer = new ResizeObserver(handleResize);
        resizer.observe(this.video);

        function handleResize() {
            shadow.querySelector("#controller").style.top = "300px";
        }

        shadow.querySelector("#controller").addEventListener("mouseenter", () => {
            if (!this.video.paused) {
                this.video.pause();
                pausing = true;
            }
        });

        shadow.querySelector("#controller").addEventListener("mouseleave", () => {
            if (pausing) {
                this.video.play();
                pausing = false;
            }
        });

        shadow.getElementById("chooseFile").addEventListener("change", (e) => {
            const file = e.target.files[0];
            const reader = new FileReader;
            reader.onload = () => {
                const srtFile = reader.result.split("\n");
                const newSubs = [{ text: "" }];
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
                        if (!srtFile[i + 1].trim()) type = null;

                        newSubs[count].text += line + " ";

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

                // Adding "Skip silence" to our subtitle array (newSubs)
                for (let i = 1; i < newSubs.length; i++) {
                    const silence = newSubs[i].start - newSubs[i - 1].end;
                    if (silence > 5) {
                        newSubs.splice(i, 0, {
                            text: "Silence (" + Math.round(silence) + " seconds)",
                            start: newSubs[i - 1].end,
                            end: newSubs[i].start
                        });
                    }
                }

                // Updating our active subtitle array (subs)
                subs = newSubs;

                // If the video is paused, play it for just a millisecond, so the subtitles will display correctly
                if (this.video.paused) {
                    this.video.play();
                    this.video.pause();
                }
            };

            reader.readAsText(file, 'ISO-8859-1');
        });

        shadow.querySelectorAll("button").forEach(function(button) {
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
            .addEventListener("mousedown", (e) => e.stopPropagation(), false);

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

function isBlacklisted() {
    blacklisted = false;
    tc.settings.blacklist.split("\n").forEach((match) => {
        match = match.replace(regStrip, "");
        if (match.length == 0) {
            return;
        }

        if (match.startsWith("/")) {
            try {
                var regexp = new RegExp(match);
            } catch (err) {
                return;
            }
        } else {
            var regexp = new RegExp(escapeStringRegExp(match));
        }

        if (regexp.test(location.href)) {
            blacklisted = true;
            return;
        }
    });
    return blacklisted;
}

var coolDown = false;

function refreshCoolDown() {
    log("Begin refreshCoolDown", 5);
    if (coolDown) {
        clearTimeout(coolDown);
    }
    coolDown = setTimeout(function() {
        coolDown = false;
    }, 1000);
    log("End refreshCoolDown", 5);
}

function setupListener() {
    /**
     * This function is run whenever a video speed rate change occurs.
     * It is used to update the speed that shows up in the display as well as save
     * that latest speed into the local storage.
     *
     * @param {*} video The video element to update the speed indicators for.
     */
    function updateSpeedFromEvent(video) {
        // It's possible to get a rate change on a VIDEO/AUDIO that doesn't have
        // a video controller attached to it.  If we do, ignore it.
        if (!video.vsc) return;

        var speedIndicator = video.vsc.speedIndicator;
        var src = video.currentSrc;
        var speed = Number(video.playbackRate.toFixed(2));

        log("Playback rate changed to " + speed, 4);

        log("Updating controller with new speed", 5);
        speedIndicator.textContent = speed.toFixed(2);
        tc.settings.speeds[src] = speed;
        log("Storing lastSpeed in settings for the rememberSpeed feature", 5);
        tc.settings.lastSpeed = speed;
        log("Syncing chrome settings for lastSpeed", 5);
        chrome.storage.sync.set({ lastSpeed: speed }, function() {
            log("Speed setting saved: " + speed, 5);
        });
        // show the controller for 1000ms if it's hidden.
        runAction("blink", null, null);
    }

    document.addEventListener(
        "ratechange",
        function(event) {
            if (coolDown) {
                log("Speed event propagation blocked", 4);
                event.stopImmediatePropagation();
            }
            var video = event.target;

            /**
             * If the last speed is forced, only update the speed based on events created by
             * video speed instead of all video speed change events.
             */
            if (tc.settings.forceLastSavedSpeed) {
                if (event.detail && event.detail.origin === "videoSpeed") {
                    video.playbackRate = event.detail.speed;
                    updateSpeedFromEvent(video);
                } else {
                    video.playbackRate = tc.settings.lastSpeed;
                }
            } else {
                updateSpeedFromEvent(video);
            }
        },
        true
    );
}

function initializeWhenReady(document) {
    log("Begin initializeWhenReady", 5);
    if (isBlacklisted()) {
        return;
    }
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
    log("Begin initializeNow", 5);
    if (!tc.settings.enabled) return;
    // enforce init-once due to redundant callers
    if (!document.body || document.body.classList.contains("vsc-initialized")) {
        return;
    }
    try {
        setupListener();
    } catch {
        // no operation
    }
    document.body.classList.add("vsc-initialized");
    log("initializeNow: vsc-initialized added to document body", 5);

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
    } catch (e) {}

    docs.forEach(function(doc) {
        doc.addEventListener(
            "keydown",
            function(event) {
                var keyCode = event.keyCode;
                log("Processing keydown event: " + keyCode, 6);

                // Ignore if following modifier is active.
                if (!event.getModifierState ||
                    event.getModifierState("Alt") ||
                    event.getModifierState("Control") ||
                    event.getModifierState("Fn") ||
                    event.getModifierState("Meta") ||
                    event.getModifierState("Hyper") ||
                    event.getModifierState("OS")
                ) {
                    log("Keydown event ignored due to active modifier: " + keyCode, 5);
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

                var item = tc.settings.keyBindings.find((item) => item.key === keyCode);
                if (item) {
                    runAction(item.action, item.value);
                    if (item.force === "true") {
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

    var observer = new MutationObserver(function(mutations) {
        // Process the DOM nodes lazily
        requestIdleCallback(
            (_) => {
                mutations.forEach(function(mutation) {
                    switch (mutation.type) {
                        case "childList":
                            mutation.addedNodes.forEach(function(node) {
                                if (typeof node === "function") return;
                                checkForVideo(node, node.parentNode || mutation.target, true);
                            });
                            mutation.removedNodes.forEach(function(node) {
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

    mediaTags.forEach(function(video) {
        video.vsc = new tc.videoController(video);
    });

    var frameTags = document.getElementsByTagName("iframe");
    Array.prototype.forEach.call(frameTags, function(frame) {
        // Ignore frames we don't have permission to access (different origin).
        try {
            var childDocument = frame.contentDocument;
        } catch (e) {
            return;
        }
        initializeWhenReady(childDocument);
    });
    log("End initializeNow", 5);

    if (!monitoring) {
        monitoring = true;
        monitorPlaybackTime();
    }
}

function setSpeed(video, speed) {
    log("setSpeed started: " + speed, 5);
    var speedvalue = speed.toFixed(2);
    if (tc.settings.forceLastSavedSpeed) {
        video.dispatchEvent(
            new CustomEvent("ratechange", {
                detail: { origin: "videoSpeed", speed: speedvalue }
            })
        );
    } else {
        video.playbackRate = Number(speedvalue);
    }
    var speedIndicator = video.vsc.speedIndicator;
    speedIndicator.textContent = subs[pos].text;
    tc.settings.lastSpeed = speed;
    refreshCoolDown();
    log("setSpeed finished: " + speed, 5);
}

function monitorPlaybackTime() {
    tc.mediaElements.forEach(v => {
        v.ontimeupdate = () => {
            if (subs && subs.length > 1) {
                const time = v.currentTime.toFixed(3);
                const newPos = subs.findIndex(el => el.start <= time && el.end > time);

                // If a match was found update "pos"
                if (newPos !== -1) {
                    pos = newPos;
                    v.vsc.speedIndicator.textContent = subs[pos].text;
                }
            }
        };
    });
}

function runAction(action, value, e) {
    log("runAction Begin", 5);

    var mediaTags = tc.mediaElements;

    // Get the controller that was used if called from a button press event e
    if (e) {
        var targetController = e.target.getRootNode().host;
    }

    mediaTags.forEach(function(v) {
        var controller = v.vsc.div;

        // Don't change video speed if the video has a different controller
        if (e && !(targetController == controller)) {
            return;
        }

        showController(controller);

        if (!v.classList.contains("vsc-cancelled")) {
            if (action === "rewind") {
                log("Rewind", 5);

                if (v.currentTime > subs[pos].start + 1) {
                    v.currentTime = subs[pos].start;

                } else if (pos !== 0) {
                    v.currentTime = subs[pos - 1].start;
                }

            } else if (action === "advance") {
                log("Fast forward", 5);

                if (pos !== subs.length - 1) {
                    v.currentTime = subs[pos + 1].start;
                }

            } else if (action === "lighter") {
                const style = controller.shadowRoot.querySelector("#controller").style;
                const newOpacity = (Number(style.opacity) - 0.1).toFixed(1);

                if (newOpacity >= 0.1) {
                    style.opacity = newOpacity;
                    chrome.storage.sync.set({ controllerOpacity: newOpacity });
                }

            } else if (action === "darker") {
                const style = controller.shadowRoot.querySelector("#controller").style;
                const newOpacity = (Number(style.opacity) + 0.1).toFixed(1);

                if (newOpacity <= 1) {
                    style.opacity = newOpacity;
                    chrome.storage.sync.set({ controllerOpacity: newOpacity });
                }

            } else if (action === "smaller") {
                const subtitleStyle = controller.shadowRoot.querySelector("#subtitles").style;
                const prevNextArr = controller.shadowRoot.querySelectorAll(".prev-next-button");
                const oldSize = Number(subtitleStyle.fontSize.replace(/px/, ""));
                const newSize = (oldSize - 2) + "px";

                if (oldSize > 14) {
                    subtitleStyle.fontSize = newSize;
                    prevNextArr.forEach(elem => elem.style.fontSize = newSize);
                    chrome.storage.sync.set({ fontSize: newSize });
                }

            } else if (action === "bigger") {
                const subtitleStyle = controller.shadowRoot.querySelector("#subtitles").style;
                const prevNextArr = controller.shadowRoot.querySelectorAll(".prev-next-button");
                const oldSize = Number(subtitleStyle.fontSize.replace(/px/, ""));
                const newSize = (oldSize + 2) + "px";

                if (oldSize < 88) {
                    subtitleStyle.fontSize = newSize;
                    prevNextArr.forEach(elem => elem.style.fontSize = newSize);
                    chrome.storage.sync.set({ fontSize: newSize });
                }

            } else if (action === "reset") {
                log("Reset speed", 5);
                resetSpeed(v, 1.0);
            } else if (action === "display") {
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
            } else if (action === "fast") {
                resetSpeed(v, value);
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

function resetSpeed(v, target) {
    if (v.playbackRate === target) {
        if (v.playbackRate === getKeyBindings("reset")) {
            if (target !== 1.0) {
                log("Resetting playback speed to 1.0", 4);
                setSpeed(v, 1.0);
            } else {
                log('Toggling playback speed to "fast" speed', 4);
                setSpeed(v, getKeyBindings("fast"));
            }
        } else {
            log('Toggling playback speed to "reset" speed', 4);
            setSpeed(v, getKeyBindings("reset"));
        }
    } else {
        log('Toggling playback speed to "reset" speed', 4);
        setKeyBindings("reset", v.playbackRate);
        setSpeed(v, target);
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

    const initialMouseXY = [e.clientX, e.clientY];
    const initialControllerXY = [
        parseInt(shadowController.style.left),
        parseInt(shadowController.style.top)
    ];

    const startDragging = (e) => {
        let style = shadowController.style;
        // let dx = e.clientX - initialMouseXY[0];
        let dy = e.clientY - initialMouseXY[1];
        // style.left = initialControllerXY[0] + dx + "px";
        style.top = initialControllerXY[1] + dy + "px";
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

    timer = setTimeout(function() {
        controller.classList.remove("vcs-show");
        timer = false;
        log("Hiding controller", 5);
    }, 2000);
}

chrome.runtime.onMessage.addListener(reactivateShadowDom);

function reactivateShadowDom(msg, sender, sendResponse) {
    if (msg.show && !tc.settings.enabled) {
        tc.settings.enabled = true;
        initializeNow(window.document);

    } else if (msg.videoRequest) {
        if (monitoring) {
            sendResponse({ videoDetected: true });
        }
    }
}