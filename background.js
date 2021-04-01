let extensionOn = true;
let blacklist = defaultBlacklist;

// Necessary because if nothing is listening to the connect event from the content script
// it will immediately disconnect. So we're preventing an immediate disconnect event being fired.
chrome.runtime.onConnect.addListener(() => {
    console.log("something connected");
});

chrome.storage.sync.get(null, (storage) => {
    if (storage.enabled !== undefined) extensionOn = storage.enabled;

    const suffix = `${extensionOn ? "" : "_disabled"}.png`;
    chrome.browserAction.setIcon({
        path: {
            "19": "icons/movie-subtitles-19" + suffix,
            "38": "icons/movie-subtitles-38" + suffix,
            "48": "icons/movie-subtitles-48" + suffix
        }
    });
});

// On tab switch let the content script know
chrome.tabs.onActivated.addListener(function () {
    chrome.storage.sync.get(null, (storage) => {
        if (storage.enabled !== undefined) extensionOn = storage.enabled;
        if (storage.blacklist !== undefined) blacklist = storage.blacklist;

        chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
            let thisSite = tab[0].url.replace(/^.*\/\//, "").replace(/\/.*/, "");
            if (!/^www/.test(thisSite)) thisSite = "www." + thisSite;

            if (extensionOn && !blacklist[thisSite]) {
                // Reloading the shadow dom
                chrome.tabs.sendMessage(tab[0].id, { show: true, blacklist: blacklist });
            } else {
                // Unloading the shadow dom!
                chrome.tabs.sendMessage(tab[0].id, { hide: true, blacklist: blacklist });
            }
        });
    });
});

// Incomming messages
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.getUrl) {
            let thisSite = sender.tab.url.replace(/^.*\/\//, "").replace(/\/.*/, "");
            if (!/^www/.test(thisSite)) thisSite = "www." + thisSite;

            sendResponse({ url: thisSite });

        } else if (request.fileName) {
            const fileName = request.fileName;
            const title = sender.tab.title;
            const url = sender.tab.url;

            console.log('fileName:', fileName);
            console.log('title:', title);
            console.log('url:', url);

            console.log(findCommon(fileName, title));
            console.log(findCommon(fileName, url));
            console.log(findCommon(title, url));
        }
    }
);

const findCommon = (str1 = '', str2 = '') => {
    const s1 = [...str1];
    const s2 = [...str2];
    const arr = Array(s2.length + 1).fill(null).map(() => {
        return Array(s1.length + 1).fill(null);
    });
    for (let j = 0; j <= s1.length; j += 1) {
        arr[0][j] = 0;
    }
    for (let i = 0; i <= s2.length; i += 1) {
        arr[i][0] = 0;
    }
    let len = 0;
    let col = 0;
    let row = 0;
    for (let i = 1; i <= s2.length; i += 1) {
        for (let j = 1; j <= s1.length; j += 1) {
            if (s1[j - 1] === s2[i - 1]) {
                arr[i][j] = arr[i - 1][j - 1] + 1;
            }
            else {
                arr[i][j] = 0;
            }
            if (arr[i][j] > len) {
                len = arr[i][j];
                col = j;
                row = i;
            }
        }
    }
    if (len === 0) {
        return '';
    }
    let res = '';
    while (arr[row][col] > 0) {
        res = s1[col - 1] + res;
        row -= 1;
        col -= 1;
    }
    return res;
};