let extensionOn = true;
let shortcuts = null;

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

chrome.storage.sync.get(null, (storage) => {
    if (storage.enabled !== undefined) {
        extensionOn = storage.enabled;
    }

    if (storage.shortcuts === undefined) {
        shortcuts = defaultShortcuts;
    } else {
        shortcuts = storage.shortcuts;
    }

    updatePopup();
});

$(".power-button").addEventListener("click", toggleExtensionOnOff);

$("#shortcuts").addEventListener("click", openShortcutMenu);

function toggleExtensionOnOff() {
    extensionOn = !extensionOn;
    updatePopup();
    chrome.storage.sync.set({ enabled: extensionOn });
}

function updatePopup() {
    const suffix = `${extensionOn ? "" : "_disabled"}.png`;
    chrome.browserAction.setIcon({
        path: {
            "19": "icons/movie-subtitles-19" + suffix,
            "38": "icons/movie-subtitles-38" + suffix,
            "48": "icons/movie-subtitles-48" + suffix
        }
    });

    $(".logo").src = "icons/movie-subtitles-48" + suffix;

    if (extensionOn) {
        // Display the popup settings
        $("#settings").classList.remove("hide");

        // Changing the hover color of the power button
        $(".power-button").classList.remove("turn-on");
        $(".power-button").classList.add("turn-off");

        // Reloading the shadow dom
        messageContentScript({ show: true });

    } else {
        // Hide the popup settings
        $("#settings").classList.add("hide");

        // Changing the hover color of the power button
        $(".power-button").classList.remove("turn-off");
        $(".power-button").classList.add("turn-on");

        // Unloading the shadow dom!
        messageContentScript({ hide: true });
    }
}

function messageContentScript(message) {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
        chrome.tabs.sendMessage(tab[0].id, message);
    });
}

function openShortcutMenu() {
    hideMainShowShortcuts();
    updateShortcutPlaceholders();
    addShortcutEventListeners();
    handlingShortcutUserInput();
}

function hideShortcutsShowMain() {
    // Before closing, ask the user if they want to save or discard the changes


    // Display the main menu
    $("#icons").classList.remove("hide");
    $("#settings").classList.remove("hide");

    // Modify the title
    $(".heading").innerHTML = "Movie Subtitles";

    // Hide the shortcut menu
    $("#shortcut-settings").classList.add("hide");
}

function hideMainShowShortcuts() {
    // Hide the main menu
    $("#icons").classList.add("hide");
    $("#settings").classList.add("hide");
    // Modify the title
    $(".heading").innerHTML = "Shortcuts";
    // Show the shortcut menu
    $("#shortcut-settings").classList.remove("hide");
}

function addShortcutEventListeners() {
    // Back to main menu button/arrow
    $("#shortcut-back").addEventListener("click", hideShortcutsShowMain);

    // Activate/focus the shortcut input field when clicking anywhere on a class="shortcut" element
    $(".shortcut", true).forEach(elem => {
        elem.addEventListener("click", () => {
            elem.querySelector("input").focus();
        });
    });
}

function updateShortcutPlaceholders() {
    // Set the placeholder text for the shortcuts
    $(".shortcut input", true).forEach(elem => {
        const key = shortcuts[elem.name];
        const arrow = ["\u2190", "\u2191", "\u2192", "\u2193"];

        elem.placeholder = key;

        if (arrow.includes(key)) {
            // Adjust the size!
            elem.classList.add("arrow");

        } else {
            // Adjust the size!
            elem.classList.remove("arrow");
        }
    });
}

function handlingShortcutUserInput() {
    $("input", true).forEach((elem) => {
        const modifierKeys = ["Alt", "Control", "Shift", "Hyper", "Tab", "Enter", "Insert", "AltGraph", "ContextMenu", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"];

        elem.addEventListener("keydown", (e) => {
            if (modifierKeys.includes(e.key) || e.key === " ") {
                return;
            }

            elem.value = "";
        });

        elem.addEventListener("keyup", (e) => {
            if (modifierKeys.includes(e.key) || e.key === " ") {
                return;
            }

            const input = e.target.value.trim();

            // First see if it's an arrow key
            const arrowKey = /^Arrow/.test(e.key);
            if (arrowKey) {
                const arrowMap = {
                    L: "\u2190",
                    U: "\u2191",
                    R: "\u2192",
                    D: "\u2193"
                };

                elem.value = arrowMap[e.key[5]];

                // Adjust the size!
                elem.classList.add("arrow");

            } else if (input) {
                elem.value = input.toLowerCase();

                // Adjust the size!
                elem.classList.remove("arrow");
            }

            // Deleting doubles when the user chooses a shortcut they are already using for something else
            $("input", true).forEach((element) => {
                if (element.placeholder === elem.value.trim() && element.name !== elem.name) {
                    shortcuts[element.name] = "";
                    element.placeholder = "";
                }
            });

            // Save the new shortcut
            shortcuts[elem.name] = elem.value.trim();
            chrome.storage.sync.set({ shortcuts: shortcuts });
            messageContentScript({ shortcuts: shortcuts });
        });

        elem.addEventListener("focus", () => {
            elem.value = elem.placeholder;
        });

        // Unfocus (when an element loses focus)
        elem.addEventListener("blur", () => {
            elem.placeholder = elem.value;
            elem.value = "";
        });
    });
}

function $(selector, multiple = false) {
    if (multiple) {
        return document.querySelectorAll(selector);
    }

    return document.querySelector(selector);
}