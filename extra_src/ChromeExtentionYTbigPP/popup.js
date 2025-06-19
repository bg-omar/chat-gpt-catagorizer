document.addEventListener("DOMContentLoaded", () => {

    const mainButton = document.getElementById("btn");


    if (!mainButton) {
        console.error("Button with id 'btn' not found.");
    } else {
        initializeMainButton(mainButton);
    }
});



// Main button functionality
function initializeMainButton(button) {
    button.addEventListener("click", () => {
        console.log("Main button clicked!");

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (!currentTab || !currentTab.url) {
                console.error("No active tab or URL found.");
                return;
            }

            const ogUrl = currentTab.url;

            // Handle YouTube URLs
            if (ogUrl.includes("youtube.com")) {
                const ppUrl = ogUrl.replace("youtube.com", "youtubepp.com");
                console.log("Opening modified URL in background tab:", ppUrl);

                // Open in background
                chrome.tabs.create({ url: ppUrl, active: false });
            } else {
                // Rotate non-YouTube page
                chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    func: () => {
                        // Get the current rotation style
                        const currentTransform = document.body.style.transform;
                        // Toggle between rotated and normal states
                        if (currentTransform === "rotate(180deg)") {
                            document.body.style.transform = "rotate(0deg)";
                        } else {
                            document.body.style.transform = "rotate(180deg)";
                        }
                    },
                });
                console.log("Rotated the current page as the URL is not YouTube.");
            }
        });
    });
}
