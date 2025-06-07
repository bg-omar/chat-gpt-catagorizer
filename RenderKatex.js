let renderLatexEnabled = JSON.parse(sessionStorage.getItem('renderLatexEnabled')) || false; // start with rendering OFF
let isScriptEnabled = JSON.parse(sessionStorage.getItem('isScriptEnabled')) || true; // Default script state

const renderButton = document.createElement('button');

document.addEventListener('DOMContentLoaded', () => {
    initializeButtons();
    repeater();
});

function repeater() {
    setInterval(async () => {
        if (!isScriptEnabled || !renderLatexEnabled) return; // Skip execution if paused or rendering disabled
        try {
            renderLaTeX();
        } catch (e) {
            console.error('Error in latex interval:', e);
        }
    }, 500); // increased interval for performance
}

function renderLaTeX() {
    const blockRegex = /\\\[\s*(.*?)\s*\\\]/g;
    const inlineRegex = /\\\(\s*(.*?)\s*\\\)/g;
    const doubleDollarRegex = /\$\$\s*(.*?)\s*\$\$/g;
    const dollarRegex = /\$\s*(.*?)\s*\$/g;

    const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = textNodes.nextNode())) {
        const parent = node.parentNode;
        if (parent.tagName === "SPAN" && parent.classList.contains("katex")) continue;

        let text = node.nodeValue;
        let updatedText = text;

        updatedText = updatedText.replace(blockRegex, (_, latex) => {
            const div = document.createElement("div");
            try {
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
                katex.render(latex, span, { displayMode: false });
                return span.outerHTML;
            } catch (error) {
                console.error("KaTeX Double Dollar Render Error:", error, latex);
                return `Error: ${latex}`;
            }
        });

        updatedText = updatedText.replace(dollarRegex, (_, latex) => {
            const span = document.createElement("span");
            try {
                katex.render(latex, span, { displayMode: false });
                return span.outerHTML;
            } catch (error) {
                console.error("KaTeX Dollar Render Error:", error, latex);
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

function initializeButtons() {
    renderButton.style.cssText = getButtonStyles();
    renderButton.textContent = `LaTeX: ${renderLatexEnabled ? 'on' : 'off'}`;
    renderButton.addEventListener('click', () => {
        renderLatexEnabled = !renderLatexEnabled;
        sessionStorage.setItem('renderLatexEnabled', JSON.stringify(renderLatexEnabled));
        renderButton.textContent = `LaTeX: ${renderLatexEnabled ? 'on' : 'off'}`;
        console.log('Render LaTeX:', renderLatexEnabled);
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: fixed;
        bottom: 50%;
        right: 40px;
        display: grid;
        gap: 10px;
        z-index: 5000;
    `;

    buttonContainer.appendChild(renderButton);

    setTimeout(() => {
        document.body.appendChild(buttonContainer);
    }, 2000);
}

function getButtonStyles() {
    return `
    padding: 10px;
    background-color: #22002244;
    color: #ffffff66;
    border: 1px solid #cccccc66;
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