let extensionOn = null;
const settingsNode = document.querySelector("#settings");

console.log(settingsNode);

chrome.storage.sync.get({ enabled: true }, storage => {
  extensionOn = storage.enabled;
  toggleEnabledUI(extensionOn);
});

document.querySelector(".power-button").addEventListener("click", toggleEnabled);

document.querySelector("#subtitle-import").addEventListener("click", function () {
  chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
    const message = { import: "file" };
    chrome.tabs.sendMessage(tab[0].id, message);
  });
});

document.querySelector("#config").addEventListener("click", function () {
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
    settingsNode.classList.remove("hide");

    // Reloading the shadow dom!
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
      const message = { show: true };
      // const message = { reload: true };
      chrome.tabs.sendMessage(tab[0].id, message);
    });

  } else {
    settingsNode.classList.add("hide");

    // Unloading the shadow dom!
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
      const message = { hide: true };
      // const message = { unload: true };
      chrome.tabs.sendMessage(tab[0].id, message);
    });
  }
}

function timeInSeconds(time) {
  const split = time.split(/:|,/);

  const s1 = Number(split[0] * 60 * 60);   // hours
  const s2 = Number(split[1] * 60);        // minutes
  const s3 = Number(split[2]);             // seconds
  const s4 = split[3];             // milliseconds

  const seconds = s1 + s2 + s3;
  return seconds + "." + s4;
}