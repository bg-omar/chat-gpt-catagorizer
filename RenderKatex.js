let enableEquationEnv = true;
let enableBlockBrackets = true;
let enableInlineParens = true;
let enableDoubleDollar = true;
let enableSingleDollar = false; // optional, if added


let renderLatexEnabled = JSON.parse(sessionStorage.getItem('renderLatexEnabled')) || true; // Default state
let isScriptEnabled = JSON.parse(sessionStorage.getItem('isScriptEnabled')) || true; // Default state

const derenderButton = document.createElement('button');
const scriptButton = document.createElement('button');

const style = document.createElement('style');
style.textContent = `
  .katex {
    font-size: 1.2em;
    line-height: 1.5;
  }

  .katex-display {
    margin: 1em 0;
    text-align: center;
  }
`;
document.head.appendChild(style);

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
  const blockRegex = /\\\[\s*(.*?)\s*\\\]/g;
  const inlineRegex = /\\\(\s*(.*?)\s*\\\)/g;
  const doubleDollarRegex = /\$\$\s*(.*?)\s*\$\$/g;
  const equationEnvRegex = /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g;

  const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;

  while ((node = textNodes.nextNode())) {
    const parent = node.parentNode;
    if (parent.tagName === "SPAN" && parent.classList.contains("katex")) continue;

    let text = node.nodeValue;
    let updatedText = text;

    if (enableEquationEnv) {
        updatedText = updatedText.replace(equationEnvRegex, (_, latex) => {
          const div = document.createElement("div");
          try {
            div.setAttribute("data-original", `\\begin\{equation\*?\}${latex}\\end\{equation\*?\}`);
            katex.render(latex.trim(), div, { displayMode: true });
            return div.outerHTML;
          } catch (error) {
            console.error("KaTeX Equation Env Error:", error, latex);
            return `Error: ${latex}`;
          }
        });
    }

    if(enableBlockBrackets){
      updatedText = updatedText.replace(blockRegex, (_, latex) => {
        const div = document.createElement("div");
        try {
          div.setAttribute("data-original", `\\[${latex}\\]`);
          katex.render(latex, div, { displayMode: true });
          return div.outerHTML;
        } catch (error) {
          console.error("KaTeX Block Render Error:", error, latex);
          return `Error: ${latex}`;
        }
      });
    }

    if(enableInlineParens){
      updatedText = updatedText.replace(inlineRegex, (_, latex) => {
        const span = document.createElement("span");
        try {
          span.setAttribute("data-original", `\\(${latex}\\)`);
          katex.render(latex, span, { displayMode: false });
          return span.outerHTML;
        } catch (error) {
          console.error("KaTeX Inline Render Error:", error, latex);
          return `Error: ${latex}`;
        }
      });
    }

    if(enableDoubleDollar){
      updatedText = updatedText.replace(doubleDollarRegex, (_, latex) => {
        const span = document.createElement("span");
        try {
          span.setAttribute("data-original", `$$${latex}$$`);
          katex.render(latex, span, { displayMode: true });
          return span.outerHTML;
        } catch (error) {
          console.error("KaTeX Double Dollar Render Error:", error, latex);
          return `Error: ${latex}`;
        }
      });
    }

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
    top: 10%;
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

  function createToggleButton(label, variableRef, callback) {
    const btn = document.createElement('button');
    btn.style.cssText = getButtonStyles();
    btn.textContent = `${label}: ${variableRef.value ? 'on' : 'off'}`;
    btn.addEventListener('click', () => {
      variableRef.value = !variableRef.value;
      btn.textContent = `${label}: ${variableRef.value ? 'on' : 'off'}`;
      if (callback) callback();
    });
    return btn;
  }

  const toggleRefs = [
    {
      label: 'Equation Env',
      ref: {
        get value() { return enableEquationEnv; },
        set value(v) { enableEquationEnv = v; }
      }
    },
    {
      label: '\\[ \\]',
      ref: {
        get value() { return enableBlockBrackets; },
        set value(v) { enableBlockBrackets = v; }
      }
    },
    {
      label: '\\( \\)',
      ref: {
        get value() { return enableInlineParens; },
        set value(v) { enableInlineParens = v; }
      }
    },
    {
      label: '$$ $$',
      ref: {
        get value() { return enableDoubleDollar; },
        set value(v) { enableDoubleDollar = v; }
      }
    },
    {
      label: '$ inline',
      ref: {
        get value() { return enableSingleDollar; },
        set value(v) { enableSingleDollar = v; }
      }
    }
  ];

  toggleRefs.forEach(({ label, ref }) => {
    const btn = createToggleButton(label, ref, () => {
      renderLaTeX();
    });
    buttonContainer.appendChild(btn);
  });


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
    padding: 2px;
    background-color: #22002244;
    color: #ffffffaa;
    border: 1px solid #cccccc66;
    justify-self: stretch;
    text-align: center;
    border-radius: 5px;
    cursor: pointer;
    font-size: 10px;
  `;
}

