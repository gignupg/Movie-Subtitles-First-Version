document.addEventListener("DOMContentLoaded", function () {
  document.querySelector("#chooseFile").addEventListener("change", (e) => {
    console.log("Trying to add srt file");
    console.log(e);
    console.log(e.target);
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
      console.log(newSubs);
    };

    reader.readAsText(file, 'ISO-8859-1');
  });

  document.querySelector("#config").addEventListener("click", function () {
    window.open(chrome.runtime.getURL("options.html"));
  });

  document.querySelector("#about").addEventListener("click", function () {
    window.open("https://github.com/igrigorik/videospeed");
  });

  document.querySelector("#feedback").addEventListener("click", function () {
    window.open("https://github.com/igrigorik/videospeed/issues");
  });

  document.querySelector("#enable").addEventListener("click", function () {
    toggleEnabled(true, settingsSavedReloadMessage);
  });

  document.querySelector("#disable").addEventListener("click", function () {
    toggleEnabled(false, settingsSavedReloadMessage);
  });

  chrome.storage.sync.get({ enabled: true }, function (storage) {
    toggleEnabledUI(storage.enabled);
  });

  function toggleEnabled(enabled, callback) {
    chrome.storage.sync.set(
      {
        enabled: enabled
      },
      function () {
        toggleEnabledUI(enabled);
        if (callback) callback(enabled);
      }
    );
  }

  function toggleEnabledUI(enabled) {
    document.querySelector("#enable").classList.toggle("hide", enabled);
    document.querySelector("#disable").classList.toggle("hide", !enabled);

    const suffix = `${enabled ? "" : "_disabled"}.png`;
    chrome.browserAction.setIcon({
      path: {
        "19": "icons/icon19" + suffix,
        "38": "icons/icon38" + suffix,
        "48": "icons/icon48" + suffix
      }
    });
  }

  function settingsSavedReloadMessage(enabled) {
    setStatusMessage(
      `${enabled ? "Enabled" : "Disabled"}. Reload page to see changes`
    );
  }

  function setStatusMessage(str) {
    const status_element = document.querySelector("#status");
    status_element.classList.toggle("hide", false);
    status_element.innerText = str;
  }
});
