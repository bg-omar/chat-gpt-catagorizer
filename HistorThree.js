const dragable = true;
const savedPos = localStorage.getItem('chatTreePos');


document.addEventListener('dragstart', (e) => {
        if (e.target.closest('#chat-tree-panel')) {
            e.preventDefault();
            console.warn('🛑 Drag clone blocked:', e.target);
        }
    },
    true // Capture phase
);

document.addEventListener('dragstart', (e) => {
    console.warn('🚨 Ghost drag detected from:', e.target);
}, true);


document.addEventListener('DOMContentLoaded', () => {
    repeater();
});



function repeater() {
    const interval = setInterval(async () => {
        const chatReady = document.querySelector('[data-testid^="conversation-turn-"]');
        const alreadyInjected = document.getElementById('chat-tree-panel');
        if (chatReady && !alreadyInjected) {
            clearInterval(interval); // ✅ Stop checking once ready
            try {
                getNodes(); // ✅ Run tree builder once
            } catch (e) {
                console.error('Error in chat tree injection:', e);
            }
        }
    }, 200); // ⏱️ Adjust as needed

    // Reload tree when navigating to a new conversation
    const observer = new MutationObserver(() => {
        const alreadyInjected = document.getElementById('chat-tree-panel');
        const chatReady = document.querySelector('[data-testid^="conversation-turn-"]');
        if (chatReady && !alreadyInjected) {
            getNodes();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

}

let globalTurns = [];
let globalEditedIdSet = new Set();

async function scanForEditedTurns() {
    globalEditedIdSet.clear();

    for (const turn of globalTurns) {
        const testId = turn.getAttribute('data-testid');
        if (!testId) continue;

        turn.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 120));

        const prevButton = turn.querySelector('button[aria-label="Previous response"]');
        if (prevButton) {
            globalEditedIdSet.add(testId);
            console.log("✏️ Detected edited:", testId);
        }
    }

    // Rebuild UI now that we know which are edited
    buildTree(globalTurns, globalEditedIdSet);
}


async function detectEditedTurns(turns) {
    const editedIdSet = new Set();

    for (const turn of turns) {
        const testId = turn.getAttribute('data-testid');
        if (!testId) continue;

        turn.scrollIntoView({ behavior: 'instant', block: 'center' });

        await new Promise(resolve => setTimeout(resolve, 150)); // give it a moment

        const prevButton = turn.querySelector('button[aria-label="Previous response"]');
        if (prevButton) {
            editedIdSet.add(testId);
            console.log('✏️ Detected edited:', testId);
        }
    }

    return editedIdSet;
}


function getNodes() {
    setTimeout(() => {
        const existing = document.getElementById('chat-tree-panel');
        if (existing) existing.remove();

        // 📜 Create root panel
        const root = document.createElement('div');
        root.id = 'chat-tree-panel';
        root.setAttribute('draggable', 'false');




        // 🔒 Header
        const header = document.createElement('div');
        header.id = 'chat-tree-header';
        header.classList.add('collapsed');
        header.textContent = '📜 Chat Tree View';

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'chat-tree-toggle';
        toggleBtn.textContent = '+';
        header.appendChild(toggleBtn);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'chat-tree-close';
        closeBtn.textContent = '✖';
        closeBtn.title = 'Close panel';
        closeBtn.onclick = () => {
            root.remove();
            // localStorage.removeItem('chatTreeCollapsed');
            // localStorage.removeItem('chatTreePos');
        };
        header.appendChild(closeBtn);

        root.appendChild(header);

        // 🔄 Content container
        const content = document.createElement('div');
        content.id = 'chat-tree-content';
        content.style.display = 'none';

        header.addEventListener('click', () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? '—' : '+';
            if (!isHidden) {
                root.style.width = '20px';
                root.style.height = '20px';
                root.style.overflow = 'hidden';
            } else {
                root.style.width = '320px';
                root.style.height = '';
                root.style.overflow = 'visible';
            }
            sessionStorage.setItem('chatTreeCollapsed', (!isHidden).toString());
        });

        // 🔃 Refresh Button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 Refresh Tree';
        refreshBtn.onclick = () => {
            root.remove();
            getNodes();
        };
        content.appendChild(refreshBtn);

        // 🧠 Scan Button
        const scanBtn = document.createElement('button');
        scanBtn.textContent = '🧠 Scan Conversation';
        scanBtn.style.marginLeft = '8px';
        scanBtn.onclick = scanForEditedTurns;
        content.appendChild(scanBtn);

        // 🌱 Collect conversation turns
        const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
        const editedIdSet = new Set();

        // Trigger hover so edit buttons appear
        turns.forEach(turn => {
            const hover = new MouseEvent('mouseover', { bubbles: true });
            turn.dispatchEvent(hover);
        });

        setTimeout(() => {
            turns.forEach(turn => {
                const testId = turn.getAttribute('data-testid');
                const prevButton = turn.querySelector('button[aria-label="Previous response"]');
                if (prevButton && testId) {
                    editedIdSet.add(testId);
                }
            });

            const list = document.createElement('ul');
            let userTurnCount = 0;

            turns.forEach((turn, i) => {
                const user = turn.querySelector('[data-message-author-role="user"]');
                const isEdited = editedIdSet.has(turn.getAttribute('data-testid'));
                const summaryText = user?.innerText?.trim()?.slice(0, 80).replace(/\n/g, ' ') || null;

                if (user && summaryText) {
                    const item = document.createElement('li');
                    item.className = 'chat-tree-item';
                    item.textContent = `${++userTurnCount}: ${summaryText}`;
                    item.dataset.turnIndex = i;

                    if (isEdited) {
                        item.classList.add('chat-tree-edited');
                        item.title = '✏️ Edited message';
                        item.textContent += ' ✏️';
                    }

                    item.onclick = () => {
                        turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        localStorage.setItem('chatTreeLastScrollIndex', i);
                    };

                    if (isEdited) {
                        const fork = document.createElement('details');
                        fork.className = 'chat-tree-fork';
                        const forkKey = `chatTreeFork-open-${userTurnCount}`;
                        const forkState = localStorage.getItem(forkKey);
                        fork.open = forkState !== 'false';
                        fork.addEventListener('toggle', () => {
                            localStorage.setItem(forkKey, fork.open.toString());
                        });

                        const forkLabel = document.createElement('summary');
                        forkLabel.textContent = `✏️ Fork ${userTurnCount}`;
                        fork.appendChild(forkLabel);
                        fork.appendChild(item);
                        list.appendChild(fork);
                    } else {
                        list.appendChild(item);
                    }
                } else {
                    const empty = document.createElement('li');
                    empty.className = 'chat-tree-empty';
                    empty.innerHTML = `<hr title="(No user message)">`;
                    list.appendChild(empty);
                }
            });

            content.appendChild(list);

            const collapsed = sessionStorage.getItem('chatTreeCollapsed') === 'true';
            if (collapsed) {
                content.style.display = 'none';
                header.style.width = '20px';
                header.style.height = '20px';
                header.style.overflow = 'hidden';
                toggleBtn.textContent = '+';
            }


            root.appendChild(content);
            // 🔐 Lock all children before DOM insertion
            root.querySelectorAll('*').forEach(el => el.setAttribute('draggable', 'false'));

            root.querySelectorAll('button, summary').forEach(el => {
                el.setAttribute('draggable', 'false');
                el.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // 🔒 this blocks the drag caching entirely
                    if (e.button === 0) e.stopPropagation();
                });
            });

            // ⬇️ Inject OFFSCREEN (still inert)
            document.body.appendChild(root);

            // 🧠 Optional: Drag init
            if (dragable) makeDraggable(root);



        }, 300); // Wait for hover UI
    }, 1000);
}


function buildTree(turns, editedIdSet) {
    const content = document.getElementById('chat-tree-content');
    if (!content) return;

    // Remove previous list
    const oldList = content.querySelector('ul');
    if (oldList) oldList.remove();

    const list = document.createElement('ul');
    let userTurnCount = 0;

    turns.forEach((turn, i) => {
        const testId = turn.getAttribute('data-testid');
        const user = turn.querySelector('[data-message-author-role="user"]');
        const isEdited = editedIdSet.has(testId);
        const summaryText = user?.innerText?.trim()?.slice(0, 80).replace(/\n/g, ' ') || null;

        if (user && summaryText) {
            const item = document.createElement('li');
            item.className = 'chat-tree-item';
            item.textContent = `${++userTurnCount}: ${summaryText}`;
            item.dataset.turnIndex = i;

            if (isEdited) {
                item.classList.add('chat-tree-edited');
                item.title = '✏️ Edited message';
                item.textContent += ' ✏️';
            }

            item.onclick = () => {
                turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                localStorage.setItem('chatTreeLastScrollIndex', i);
            };

            if (isEdited) {
                const fork = document.createElement('details');
                fork.className = 'chat-tree-fork';
                const forkKey = `chatTreeFork-open-${userTurnCount}`;
                const forkState = localStorage.getItem(forkKey);
                fork.open = forkState !== 'false';

                fork.addEventListener('toggle', () => {
                    localStorage.setItem(forkKey, fork.open.toString());
                });

                const forkLabel = document.createElement('summary');
                forkLabel.textContent = `✏️ Fork ${userTurnCount}`;
                fork.appendChild(forkLabel);
                fork.appendChild(item);
                list.appendChild(fork);
            } else {
                list.appendChild(item);
            }
        } else {
            const empty = document.createElement('li');
            empty.className = 'chat-tree-empty';
            empty.innerHTML = `<hr title="(No user message)">`;
            list.appendChild(empty);
        }
    });

    content.appendChild(list);
}

function makeDraggable(element) {
    element.setAttribute('draggable', 'false'); // 👈 prevent ghost image
    element.querySelectorAll('*').forEach(child => {
        child.setAttribute('draggable', 'false');
    });
    element.style.cssText += `
      position: fixed !important;
      top: 20px;
      left: 20px;
      z-index: 2000;
      width: 30px;
      max-height: 70vh;
      overflow: visible;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    `;


    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;


    if (savedPos) {
        const { left, top } = JSON.parse(savedPos);
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
    }


    element.style.cursor = 'grab';

    element.addEventListener('mousedown', (event) => {
        event.preventDefault();
        isDragging = true;
        element.style.cursor = 'grabbing';
        offsetX = event.clientX - element.getBoundingClientRect().left;
        offsetY = event.clientY - element.getBoundingClientRect().top;
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
            element.style.cursor = 'grab';

        }
    });


    document.addEventListener('mousemove', (event) => {
        if (isDragging) {
            event.preventDefault(); // 🚫 prevents accidental text selection or scroll
            element.style.left = `${event.clientX - offsetX}px`;
            element.style.top = `${event.clientY - offsetY}px`;
            // 🧠 Save position

            localStorage.setItem('chatTreePos', JSON.stringify({ left: event.clientX - offsetX, top: event.clientY - offsetY }));
        }
    });


}