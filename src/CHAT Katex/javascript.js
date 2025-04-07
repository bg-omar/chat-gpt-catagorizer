let renderLatexEnabled = JSON.parse(sessionStorage.getItem('renderLatexEnabled')) || true; // Default state
let isScriptEnabled = JSON.parse(sessionStorage.getItem('isScriptEnabled')) || true; // Default state

const derenderButton = document.createElement('button');
const scriptButton = document.createElement('button');



document.addEventListener('DOMContentLoaded', () => {
    initializeButtons();
    repeater();
});

function repeater() {
    const latexInterval = setInterval(async () => {
        if (!isScriptEnabled) return; // Skip execution if paused
        try {
            await getStates();
            await toggleLaTeXRendering();
            await setStates();
        } catch (e) {
            console.error('Error in latex interval:', e);
        }
    }, 100);
}

function getStates() {
    isScriptEnabled = JSON.parse(sessionStorage.getItem('isScriptEnabled'));
    renderLatexEnabled = JSON.parse(sessionStorage.getItem('renderLatexEnabled')); // Default state
}

function setStates() {
    sessionStorage.setItem('isScriptEnabled', JSON.stringify(isScriptEnabled));
    sessionStorage.setItem('renderLatexEnabled', JSON.stringify(renderLatexEnabled));
}

// Function to render LaTeX equations using KaTeX
function renderLaTeX() {
    const blockRegex = /\\\[\s*(.*?)\s*\\\]/g; // Matches \[ ... \]
    const inlineRegex = /\\\(\s*(.*?)\s*\\\)/g; // Matches \( ... \]
    const doubleDollarRegex = /\$\$\s*(.*?)\s*\$\$/g; // Matches $$ ... $$

    const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = textNodes.nextNode())) {
        const parent = node.parentNode;

        // Skip if already rendered by KaTeX
        if (parent.tagName === "SPAN" && parent.classList.contains("katex")) continue;

        let text = node.nodeValue;
        let updatedText = text;

        // Replace LaTeX expressions
        updatedText = updatedText.replace(blockRegex, (_, latex) => {
            const div = document.createElement("div");
            try {
                div.setAttribute("data-original", `\\[${latex}\\]`); // Store original LaTeX
                katex.render(latex, div, { displayMode: true });
                return div.outerHTML;
            } catch (error) {
                console.error("KaTeX Block Render Error:", error, latex);
                return `Error: ${latex}`;
            }
        });

        updatedText = updatedText.replace(inlineRegex, (_, latex) => {
            const span = document.createElement("span");
            try {
                span.setAttribute("data-original", `\\(${latex}\\)`); // Store original LaTeX
                katex.render(latex, span, { displayMode: false });
                return span.outerHTML;
            } catch (error) {
                console.error("KaTeX Inline Render Error:", error, latex);
                return `Error: ${latex}`;
            }
        });

        updatedText = updatedText.replace(doubleDollarRegex, (_, latex) => {
            const span = document.createElement("span");
            try {
                span.setAttribute("data-original", `$$${latex}$$`); // Store original LaTeX
                katex.render(latex, span, { displayMode: false });
                return span.outerHTML;
            } catch (error) {
                console.error("KaTeX Double Dollar Render Error:", error, latex);
                return `Error: ${latex}`;
            }
        });

        if (updatedText !== text) {
            const wrapper = document.createElement("span");
            wrapper.innerHTML = updatedText;
            parent.replaceChild(wrapper, node);
        }
    }
}

function derenderLaTeX() {
    // Find all rendered KaTeX elements
    const renderedElements = document.querySelectorAll('[data-original]');

    renderedElements.forEach((element) => {
        const originalContent = element.getAttribute('data-original');
        if (originalContent) {
            // Replace the rendered KaTeX element with the original LaTeX
            const textNode = document.createTextNode(originalContent);
            element.replaceWith(textNode);
        }
    });

    console.log('De-rendered all LaTeX elements.');
}
function toggleLaTeXRendering() {
    if (renderLatexEnabled) {
        renderLaTeX();
    } else {
        derenderLaTeX();
    }
}

function initializeButtons() {
    derenderButton.style.cssText = getButtonStyles();
    derenderButton.textContent = `${renderLatexEnabled ? 'rendered' : 'de-rendered'}`;
    derenderButton.addEventListener('click', () => toggleState('renderLatexEnabled', derenderButton));

    // Create container for the buttonsD
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
    position: fixed;
    bottom: 75%;
    right: 40px;
    display: grid;
    gap: 10px;
  `;



    scriptButton.style.cssText = getButtonStyles();
    scriptButton.textContent = `LaTeX: ${isScriptEnabled ? 'on' : 'off'}`;
    scriptButton.addEventListener('click', () => toggleState('isScriptEnabled', scriptButton));


    // Append buttons to the container
    buttonContainer.appendChild(derenderButton);
    buttonContainer.appendChild(scriptButton);

    // Add the container to the document body
    document.body.appendChild(buttonContainer);
}


// Function to toggle state and update the button text
function toggleState(stateKey, button) {
    const currentState = JSON.parse(sessionStorage.getItem(stateKey));
    const newState = !currentState;

    if (stateKey === 'renderLatexEnabled') {
        button.textContent = `${newState ? 'rendered' : 'de-rendered'}`;
    } else if (stateKey === 'isScriptEnabled') {
        button.textContent = `LaTeX: ${newState ? 'on' : 'off'}`;
    } else {
        // Default behavior for other buttons
        button.textContent = `${stateKey.replace('is', '').replace(/([A-Z])/g, ' $1')}: ${newState}`;
    }
    sessionStorage.setItem(stateKey, JSON.stringify(newState));
    console.log(`${stateKey}:`, newState);
}

// Function to get button styles
function getButtonStyles() {
    return `
    padding: 10px 10px;
    background-color: #22002244;
    color: #ffffff66;
    border: 1px solid #cccccc66;
    justify-self: stretch;
    text-align: center;
    border-radius: 5px;
    cursor: pointer;
    font-size: 10px;
    :hover {
        color: #fff;
        background-color: #202;
        border: 1px solid #ccc;
    }
  `;
}

