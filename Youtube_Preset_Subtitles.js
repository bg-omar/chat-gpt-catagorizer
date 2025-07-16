(() => {
    // Calculate the desired offset (in milliseconds)
    const originalCreation = 1733911237362;
    const originalExpiration = 1736503237362;
    const offset = originalExpiration - originalCreation; // This interval will be added to the current time

    // Current creation timestamp (now)
    const creationTimestamp = Date.now();

    // Calculate the expiration timestamp by adding the offset
    const expirationTimestamp = creationTimestamp + offset;

    // Construct the settings object
    const captionSettings = {
        data: "{\"backgroundOpacity\":0,\"charEdgeStyle\":4}",
        expiration: expirationTimestamp,
        creation: creationTimestamp
    };

    // Construct the settings object
    const captionLanguage = {
        data:"en",
        expiration: expirationTimestamp,
        creation: creationTimestamp
    };
    const quality = {
        data: "{\"quality\":2160,\"previousQuality\":1080}",
        expiration: expirationTimestamp,
        creation: creationTimestamp
    }
    const empty = {
        data: "{}",
        expiration: expirationTimestamp,
        creation: creationTimestamp
    }
    const trueBoolean = {
        data: "true",
        expiration: expirationTimestamp,
        creation: creationTimestamp
    }




    document.addEventListener('DOMContentLoaded', () => {
        // Convert to JSON and store in localStorage
        localStorage.setItem("yt-player-caption-display-settings", JSON.stringify(captionSettings));
        localStorage.setItem("yt-player-caption-sticky-language", JSON.stringify(captionLanguage));
        localStorage.setItem("yt-player-quality", JSON.stringify(quality));
        localStorage.setItem("yt-player-performance-cap", JSON.stringify(empty));
        localStorage.setItem("yt-player-performance-cap-active-set", JSON.stringify(empty));
        localStorage.setItem("yt-player-sticky-caption", JSON.stringify(trueBoolean));

    });

})();
