document.getElementById("loader").onclick = function () {
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.status == 200 && xmlhttp.readyState == 4) {
            const srtFile = xmlhttp.responseText.split("\n");
            const subs = [{ text: "" }];
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
                    subs[count].start = Number(start);
                    subs[count].end = Number(end);

                } else if (type === "text") {
                    if (!srtFile[i + 1].trim()) type = null;

                    subs[count].text += line + " ";

                } else if (!line) {
                    count++;

                } else if (!isNaN(line)) {
                    type = "time";
                    subs.push({ text: "" });
                }
            }

            if (!subs[subs.length - 1].text) subs.pop();

            // Adding "Skip Start" manually
            if (subs[0].start > 5) {
                subs.unshift({ text: "Skip silence (" + Math.round(subs[0].start) + " seconds)", start: 0, end: subs[0].start });
            }

            // Adding "Skip silence" to our subtitle array (subs)
            for (let i = 1; i < subs.length; i++) {
                const silence = subs[i].start - subs[i - 1].end;
                if (silence > 5) {
                    subs.splice(i, 0, {
                        text: "Silence (" + Math.round(silence) + " seconds)",
                        start: subs[i - 1].end,
                        end: subs[i].start
                    });
                }
            }

            console.log("hola desde subtitleLoader.js", subs)

            // Sending our subtitle array to the content script
            chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
                // const message = { subtitles: subs };
                const message = { subtitles: subs};
                chrome.tabs.sendMessage(tab[0].id, message);
            });
        }
    };
    xmlhttp.open("GET", "/seul-sur-mars.srt", true);
    xmlhttp.overrideMimeType('text/xml; charset=iso-8859-1');
    xmlhttp.send();
};

function timeInSeconds(time) {
    const split = time.split(/:|,/);

    const s1 = Number(split[0] * 60 * 60);   // hours
    const s2 = Number(split[1] * 60);        // minutes
    const s3 = Number(split[2]);             // seconds
    const s4 = split[3];             // milliseconds

    const seconds = s1 + s2 + s3;
    return seconds + "." + s4;
}