// Initial setup
const offset = document.getElementById("calibration-offset");
const direction = document.getElementById("calibration-direction");


// Submitting new values
document.getElementById("calibration-confirmation").onclick = function () {
    calibrationHandler(offset.value, direction.value);
};

// Resetting all values 
document.getElementById("calibration-reset").onclick = function () {
    calibrationHandler(0, "earlier");
};

function calibrationHandler(offset, direction) {
    // Sending our subtitle array to the content script
    chrome.tabs.query({ currentWindow: true, active: true }, function (tab) {
        const message = {
            calibration: {
                offset: Number(offset) || 0,
                direction
            }
        };
        chrome.tabs.sendMessage(tab[0].id, message);
    });
}