(() => {
  // All your latex button script logic here

  let enableEquationEnv = false;
  let enableBlockBrackets = false;
  let enableInlineParens = false;
  let enableDoubleDollar = false;
  let enableSingleDollar = false; // optional, if added


  let isLatexScriptEnabled = JSON.parse(sessionStorage.getItem('isLatexScriptEnabled')) || false; // Default state

  const derenderButton = document.createElement('button');
  const scriptButton = document.createElement('button');

// const style = document.createElement('style');
// style.textContent = `
//   .katex {
//     font-size: 1.2em;
//     line-height: 1.5;
//   }
//
//   .katex-display {
//     margin: 1em 0;
//     text-align: center;
//   }
// `;
// document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', () => {
    initializeButtons();
    repeater();
  });


  function repeater() {
    const latexInterval = setInterval(async () => {
      if (!isLatexScriptEnabled) return; // Skip execution if paused
      try {
        await getStates();
        await renderLaTeX();
        await setStates();
      } catch (e) {
        console.error('Error in latex interval:', e);
      }
    }, 100);
  }

  function getStates() {
    isLatexScriptEnabled = JSON.parse(sessionStorage.getItem('isLatexScriptEnabled'));
  }

  function setStates() {
    isLatexScriptEnabled = (enableEquationEnv || enableBlockBrackets || enableInlineParens || enableDoubleDollar || enableSingleDollar);
    sessionStorage.setItem('isLatexScriptEnabled', JSON.stringify(isLatexScriptEnabled));
  }

// Function to render LaTeX equations using KaTeX
  async function renderLaTeX() {
    const textNodes = [];
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (!node.parentNode.closest('button, .katex')) {
              return NodeFilter.FILTER_ACCEPT;
            } else {
              return NodeFilter.FILTER_REJECT;
            }
          }
        },
        false
    );

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach(node => {
      let text = node.nodeValue;
      let updatedText = text;

      if (enableEquationEnv) {
        updatedText = updatedText.replace(/\\begin\{equation(\*?)\}([\s\S]*?)\\end\{equation\1\}/g, (match, star, latex) => {
          return renderToHTML(`\\begin{equation${star}}${latex}\\end{equation${star}}`, latex, true);
        });
      }
      if (enableBlockBrackets) {
        updatedText = updatedText.replace(/\\\[\s*(.*?)\s*\\\]/g, (match, latex) => {
          return renderToHTML(`\\[${latex}\\]`, latex, true);
        });
      }
      if (enableInlineParens) {
        updatedText = updatedText.replace(/\\\(\s*(.*?)\s*\\\)/g, (match, latex) => {
          return renderToHTML(`\\(${latex}\\)`, latex, false);
        });
      }
      if (enableDoubleDollar) {
        updatedText = updatedText.replace(/\$\$\s*(.*?)\s*\$\$/g, (match, latex) => {
          return renderToHTML(`$$${latex}$$`, latex, true);
        });
      }
      if (enableSingleDollar) {
        updatedText = updatedText.replace(/(^|[^\$])\$(.+?)\$([^\$]|$)/g, (match, prefix, latex, suffix) => {
          return prefix + renderToHTML(`$${latex}$`, latex, false) + suffix;
        });
      }

      if (updatedText !== text) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = updatedText;
        node.parentNode.replaceChild(wrapper, node);
      }
    });
  }

  function renderToHTML(originalLatex, latex, displayMode = false) {
    const elem = displayMode ? document.createElement('div') : document.createElement('span');
    elem.setAttribute('data-original', originalLatex);
    try {
      katex.render(latex, elem, { displayMode });
      return elem.outerHTML;
    } catch (error) {
      console.error("KaTeX Render Error:", error, latex);
      return originalLatex;
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

  function initializeButtons() {
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
    scriptButton.textContent = `De-render`;
    scriptButton.addEventListener('click', () =>  derenderLaTeX());

    // Append buttons to the container
    buttonContainer.appendChild(scriptButton);

    const toggleRefs = [
      {
        label: '{Eq}',
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

  function createToggleButton(label, ref, callback) {
    const btn = document.createElement('button');
    btn.style.cssText = getButtonStyles(ref.value);
    btn.textContent = label;

    btn.addEventListener('click', () => {
      ref.value = !ref.value;
      btn.style.cssText = getButtonStyles(ref.value);
      if (callback) callback();
    });

    return btn;
  }


// Function to toggle state and update the button text
  function toggleState(stateKey, button) {
    const currentState = JSON.parse(sessionStorage.getItem(stateKey));
    const newState = !currentState;

    if (stateKey === 'isLatexScriptEnabled') {
      button.textContent = `LaTeX: ${newState ? 'on' : 'off'}`;
    } else {
      // Default behavior for other buttons
      button.textContent = `${stateKey.replace('is', '').replace(/([A-Z])/g, ' $1')}: ${newState}`;
    }
    sessionStorage.setItem(stateKey, JSON.stringify(newState));
    console.log(`${stateKey}:`, newState);
  }

// Function to get button styles
  function getButtonStyles(isActive = false) {
    return `
    padding: 2px;
    color: ${isActive ? '#ffffffaa' : '#aaaaaaaa'};
    background-color: ${isActive ? '#551155aa' : '#22002222'};
    border: 1px solid #cccccc66;
    justify-self: stretch;
    text-align: center;
    border-radius: 5px;
    cursor: pointer;
    font-size: 8px;
  `;
  }

})();