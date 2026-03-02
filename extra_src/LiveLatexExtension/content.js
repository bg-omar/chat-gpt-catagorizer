(() => {
    let states = {
        enableEq: true,
        enableBlock: true,
        enableInline: true,
        enableDoubleDollar: true,
        enableSingleDollar: true,
        isGlobalEnabled: true,
        customMacros: {}
    };

    chrome.storage.local.get(states, (result) => {
        states = result;
        startRepeater();
    });

    chrome.storage.onChanged.addListener((changes) => {
        for (let key in changes) {
            if (key in states) states[key] = changes[key].newValue;
        }

        if ((changes.isGlobalEnabled && changes.isGlobalEnabled.newValue === false) || changes.customMacros) {
            derenderLaTeX();
        }
    });

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === "DERENDER") derenderLaTeX();
    });

    function startRepeater() {
        setInterval(() => {
            if (states.isGlobalEnabled && Object.values(states).some(v => v === true)) {
                renderLaTeX();
            }
        }, 800);
    }

    function renderMode(latex, isDisplay) {
        try {
            const rawLatex = latex
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">");

            return katex.renderToString(rawLatex.trim(), {
                displayMode: isDisplay,
                macros: states.customMacros,
                throwOnError: false
            });
        } catch (error) {
            return `<span style="color:red;">[KaTeX Error: ${error.message}]</span>`;
        }
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function renderLaTeX() {
        if (typeof katex === 'undefined') return;

        const envRegex = /\\begin\{(equation|align|gather|multline|eqnarray)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g;
        const blockRegex = /\\\[([\s\S]*?)\\\]/g;
        const doubleDollarRegex = /\$\$([\s\S]*?)\$\$/g;
        const inlineRegex = /\\\(([\s\S]*?)\\\)/g;
        const singleDollarRegex = /\$((?:[^$]|\\$)+?)\$/g;

        const codeContainers = document.querySelectorAll('code[data-test-id="code-content"], .cm-content');

        codeContainers.forEach(container => {
            if (container.nextElementSibling && container.nextElementSibling.classList.contains('livelatex-overlay')) return;
            if (!container.innerText || container.innerText.trim() === '') return;
            if (!container.innerText.includes('\\') && !container.innerText.includes('$')) return;

            let text = container.innerText;
            let htmlText = escapeHtml(text);

            if (states.enableEq) htmlText = htmlText.replace(envRegex, (match) => renderMode(match, true));
            if (states.enableBlock) htmlText = htmlText.replace(blockRegex, (_, latex) => renderMode(latex, true));
            if (states.enableDoubleDollar) htmlText = htmlText.replace(doubleDollarRegex, (_, latex) => renderMode(latex, true));
            if (states.enableInline) htmlText = htmlText.replace(inlineRegex, (_, latex) => renderMode(latex, false));
            if (states.enableSingleDollar) htmlText = htmlText.replace(singleDollarRegex, (_, latex) => renderMode(latex, false));

            const wrapper = document.createElement('div');
            wrapper.className = 'livelatex-overlay';
            wrapper.innerHTML = htmlText;
            wrapper.style.cssText = `white-space: pre-wrap; font-family: monospace; padding: 16px; background-color: transparent; color: inherit; overflow-x: auto;`;

            container.style.display = 'none';
            container.parentNode.insertBefore(wrapper, container.nextSibling);
        });

        const richContainers = document.querySelectorAll('message-content, .message-content');
        richContainers.forEach(container => {
            const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode: function(node) {
                    const parent = node.parentNode;
                    if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
                    if (parent.closest('.katex') || parent.closest('.livelatex-render-wrapper')) return NodeFilter.FILTER_REJECT;
                    if (node.nodeValue.includes('\\') || node.nodeValue.includes('$')) return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_SKIP;
                }
            });

            let nodesToProcess = [];
            let node;
            while ((node = treeWalker.nextNode())) nodesToProcess.push(node);

            nodesToProcess.forEach(textNode => {
                let text = textNode.nodeValue;
                let updatedText = text;
                const parent = textNode.parentNode;

                if (states.enableEq) {
                    updatedText = updatedText.replace(envRegex, (match) => {
                        const safeOriginal = match.replace(/"/g, '&quot;');
                        return `<span class="livelatex-render-wrapper" data-original="${safeOriginal}">${renderMode(match, true)}</span>`;
                    });
                }
                if (states.enableBlock) {
                    updatedText = updatedText.replace(blockRegex, (_, latex) =>
                        `<span class="livelatex-render-wrapper" data-original="\\[${latex.replace(/"/g, '&quot;')}\\]">${renderMode(latex, true)}</span>`
                    );
                }
                if (states.enableDoubleDollar) {
                    updatedText = updatedText.replace(doubleDollarRegex, (_, latex) =>
                        `<span class="livelatex-render-wrapper" data-original="$$${latex.replace(/"/g, '&quot;')}$$">${renderMode(latex, true)}</span>`
                    );
                }
                if (states.enableInline) {
                    updatedText = updatedText.replace(inlineRegex, (_, latex) =>
                        `<span class="livelatex-render-wrapper" data-original="\\(${latex.replace(/"/g, '&quot;')}\\)">${renderMode(latex, false)}</span>`
                    );
                }
                if (states.enableSingleDollar) {
                    updatedText = updatedText.replace(singleDollarRegex, (match, latex, offset, string) => {
                        const doubleDollarBefore = string.lastIndexOf('$$', offset);
                        const doubleDollarAfter = string.indexOf('$$', offset + match.length);
                        if (doubleDollarBefore !== -1 && doubleDollarAfter !== -1 && doubleDollarBefore < offset && doubleDollarAfter > offset) return match;
                        const before = string.slice(0, offset);
                        const after = string.slice(offset + match.length);
                        if (/[.!?]\s*$/.test(before) || /^\s*[.!?]/.test(after)) return match;

                        return `<span class="livelatex-render-wrapper" data-original="${match.replace(/"/g, '&quot;')}">${renderMode(latex, false)}</span>`;
                    });
                }

                if (updatedText !== text) {
                    const wrapper = document.createElement("span");
                    wrapper.innerHTML = updatedText;
                    parent.replaceChild(wrapper, textNode);
                }
            });
        });
    }

    function derenderLaTeX() {
        document.querySelectorAll('.livelatex-render-wrapper').forEach((element) => {
            const originalContent = element.getAttribute('data-original');
            if (originalContent) {
                element.replaceWith(document.createTextNode(originalContent));
            }
        });

        document.querySelectorAll('.livelatex-overlay').forEach(overlay => {
            const originalContainer = overlay.previousElementSibling;
            if (originalContainer) {
                originalContainer.style.display = '';
            }
            overlay.remove();
        });
    }
})();