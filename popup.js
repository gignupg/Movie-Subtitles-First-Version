// Initializing some Materialize features
document.addEventListener("DOMContentLoaded", function () {
  M.Tooltip.init(document.querySelectorAll(".tooltipped"), { enterDelay: 500 });
  M.FormSelect.init(document.querySelectorAll("select"), {});
});

let extensionOn = false;
let shortcuts = null;
let videoDetected = false;
let syncObj = { value: 0, direction: "earlier" };

// Load and display the correct shortcuts
chrome.storage.sync.get(null, function (storage) {
  if (storage.shortcuts === undefined) {
    shortcuts = chrome.extension.getBackgroundPage().defaultShortcuts;
  } else {
    shortcuts = storage.shortcuts;
  }

  updatePopup();
});

// Check whether a video has been detected and update the synchronization values
chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
  chrome.tabs.sendMessage(tab[0].id, { status: true }, function (response) {
    if (response) {
      extensionOn = true;
      videoDetected = true;
      syncObj = response;
      updatePopup();
    }
  });
});

// Listen for incoming messages
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.videoDetected) {
    extensionOn = true;
    videoDetected = true;
    updatePopup();
  }
});

$(".power-button").addEventListener("click", toggleExtensionOnOff);

$("#subtitle-import").addEventListener("click", () =>
  messageContentScript({ import: true })
);

$("#size-minus").addEventListener("click", () =>
  messageContentScript({ sizeMinus: true })
);

$("#size-plus").addEventListener("click", () =>
  messageContentScript({ sizePlus: true })
);

$("#opacity-minus").addEventListener("click", () =>
  messageContentScript({ opacityMinus: true })
);

$("#opacity-plus").addEventListener("click", () =>
  messageContentScript({ opacityPlus: true })
);

$("#sync-direction").addEventListener("change", (e) => {
  messageContentScript({ direction: e.target.value });
});

// Updating the input value when the range slider is moved
$("#input-range").addEventListener("change", function () {
  const newValue = $("#input-range").value;
  $("#sync-input").value = newValue;
  messageContentScript({
    syncRange: {
      newVal: Number(newValue),
      direction: $("#sync-direction").value
    }
  });
});

$("#sync-input").addEventListener("input", function () {
  const newValue = $("#sync-input").value;
  $("#input-range").value = newValue;
  messageContentScript({
    syncRange: {
      newVal: Number(newValue),
      direction: $("#sync-direction").value
    }
  });
});

$("#sync-now").addEventListener("click", () => {
  messageContentScript({ syncNow: true });
});

$("#shortcuts").addEventListener("click", openShortcutMenu);

$("#feedback-link").addEventListener("click", () => {
  chrome.tabs.create({
    active: true,
    url: "https://github.com/gignupg/Movie-Subtitles/issues"
  });
});

function toggleExtensionOnOff() {
  extensionOn = !extensionOn;
  updatePopup();
  updateSubtitleDisplay();
}

function updatePopup() {
  const suffix = `${extensionOn ? "" : "_disabled"}.png`;
  chrome.browserAction.setIcon({
    path: {
      19: "icons/movie-subtitles-19" + suffix,
      38: "icons/movie-subtitles-38" + suffix,
      48: "icons/movie-subtitles-48" + suffix
    }
  });

  $(".logo").src = "icons/movie-subtitles-48" + suffix;

  if (extensionOn) {
    // Display the popup settings
    $("#settings").classList.remove("hide");

    // Changing the hover color of the power button
    $(".power-button").classList.remove("turn-on");
    $(".power-button").classList.add("turn-off");

    if (videoDetected) {
      // Display all settings
      $("#subtitle-section").classList.remove("hide");

      // Update the synchronization values
      $("#input-range").value = syncObj.value;
      $("#sync-input").value = syncObj.value;
      if (syncObj.direction === "later") {
        $("#sync-direction")[0].selected = false;
        $("#sync-direction")[1].selected = true;
        M.FormSelect.init(document.querySelectorAll("select"), {});
      }
    }
  } else {
    // Hide the popup settings
    $("#settings").classList.add("hide");

    // Changing the hover color of the power button
    $(".power-button").classList.remove("turn-off");
    $(".power-button").classList.add("turn-on");
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
  $(".shortcut", true).forEach((elem) => {
    elem.addEventListener("click", () => {
      elem.querySelector("input").focus();
    });
  });
}

function updateShortcutPlaceholders() {
  // Set the placeholder text for the shortcuts
  $(".shortcut input", true).forEach((elem) => {
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
    const modifierKeys = [
      "Alt",
      "Control",
      "Shift",
      "Hyper",
      "Tab",
      "Enter",
      "Insert",
      "AltGraph",
      "ContextMenu",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12"
    ];

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
        if (
          element.placeholder === elem.value.trim() &&
          element.name !== elem.name
        ) {
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

function updateSubtitleDisplay() {
  chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
    if (extensionOn) {
      // Reloading the shadow dom
      chrome.tabs.sendMessage(tab[0].id, { show: true });
    } else {
      // Unloading the shadow dom!
      chrome.tabs.sendMessage(tab[0].id, { hide: true });
    }
  });
}
