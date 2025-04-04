let active = false;
// Function to render LaTeX equations using KaTeX
function renderLaTeX() {
    // Regular expressions for detecting LaTeX patterns
    const blockRegex = /\\\[\s*(.*?)\s*\\\]/gs; // Matches \[ ... \]
    const inlineRegex = /\\\(\s*(.*?)\s*\\\)/g; // Matches \( ... \)
    const doubleDollarRegex = /\$\$\s*(.*?)\s*\$\$/g; // Matches $$ ... $$

    // Get all text nodes on the page
    const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = textNodes.nextNode())) {
        const parent = node.parentNode;

        // Skip if the parent node is already rendered KaTeX output
        if (parent.tagName === "SPAN" && parent.classList.contains("katex")) continue;

        let text = node.nodeValue;

        // Replace block LaTeX equations
        const blockMatches = [...text.matchAll(blockRegex)];
        if (blockMatches.length > 0) {
            blockMatches.forEach((match) => {
                const span = document.createElement("span");
                try {
                    katex.render(match[1], span, { displayMode: true });
                } catch (error) {
                    console.error("KaTeX Block Render Error:", error, match[1]);
                    span.innerText = `Error: ${match[1]}`;
                }
                text = text.replace(match[0], span.outerHTML);
            });
        }

        // Replace inline LaTeX equations
        const inlineMatches = [...text.matchAll(inlineRegex)];
        if (inlineMatches.length > 0) {
            inlineMatches.forEach((match) => {
                const span = document.createElement("span");
                try {
                    katex.render(match[1], span, { displayMode: false });
                } catch (error) {
                    console.error("KaTeX Inline Render Error:", error, match[1]);
                    span.innerText = `Error: ${match[1]}`;
                }
                text = text.replace(match[0], span.outerHTML);
            });
        }


        // Replace $$ ... $$ as inline equations
        const doubleDollarMatches = [...text.matchAll(doubleDollarRegex)];
        if (doubleDollarMatches.length > 0) {
            doubleDollarMatches.forEach((match) => {
                const span = document.createElement("span");
                try {
                    katex.render(match[1], span, { displayMode: false });
                } catch (error) {
                    console.error("KaTeX doubleDollarMatches Render Error:", error, match[1]);
                    span.innerText = `Error: ${match[1]}`;
                }
                text = text.replace(match[0], span.outerHTML);
            });
        }

        // Replace the text node with rendered content
        if (text !== node.nodeValue) {
            const wrapper = document.createElement("span");
            wrapper.innerHTML = text;
            parent.replaceChild(wrapper, node);
        }
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "renderLaTeX") {
        console.log("Rendering LaTeX equations...");
        renderLaTeX();
        active = !active;
    }
    setTimeout(() => {
        if (active) {
            renderLaTeX();
            observeDOMChanges();
        }
    }, 1000);
});



// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    observeDOMChanges();
});

// Observe for DOM changes and render LaTeX dynamically
function observeDOMChanges() {
    const observer = new MutationObserver(() => renderLaTeX());
    observer.observe(document.body, { childList: true, subtree: true });
}

