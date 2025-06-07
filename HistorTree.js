const dragable = false;

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

        // Create outer panel
        const root = document.createElement('div');
        root.id = 'chat-tree-panel';

        // Header (drag + collapse)
        const header = document.createElement('div');
        header.id = 'chat-tree-header';
        header.textContent = '📜 Chat Tree View';

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'chat-tree-toggle';
        toggleBtn.textContent = '+';

        header.appendChild(toggleBtn);
        root.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.id = 'chat-tree-content';
        content.style.display = 'none';

        header.addEventListener('click', () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? '—' : '+';
            localStorage.setItem('chatTreeCollapsed', (!isHidden).toString());
        });

        // Refresh
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 Refresh Tree';
        refreshBtn.onclick = () => {
            root.remove();
            getNodes();
        };
        content.appendChild(refreshBtn);


        const scanBtn = document.createElement('button');
        scanBtn.textContent = '🧠 Scan Conversation';
        scanBtn.style.marginLeft = '8px';
        scanBtn.onclick = scanForEditedTurns;
        content.appendChild(scanBtn);

        // ✅ Grab turns first
        const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
        const editedIdSet = new Set();

        // ✅ Simulate hover and detect edits
        turns.forEach(turn => {
            const hover = new MouseEvent('mouseover', { bubbles: true });
            turn.dispatchEvent(hover);
        });

        // ✅ Wait a bit to let UI react to hover injection
        setTimeout(() => {
            turns.forEach(turn => {
                const prevButton = turn.querySelector('button[aria-label="Previous response"]');
                const testId = turn.getAttribute('data-testid');
                if (prevButton && testId) {
                    editedIdSet.add(testId);
                    console.log("✏️ Found edited turn:", testId);
                }
            });

            // Now render UI as you already wrote...
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
            root.appendChild(content);
            document.body.appendChild(root);

            if (dragable) makeDraggable(root);
        }, 300); // ⏳ Enough delay to reveal edit buttons
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
    element.style.cssText += `
    position: fixed !important;
    top: 20px;
    right: 20px;
    z-index: 2000;
    cursor: move;
    width: 300px;
		max-height: 70vh;
    overflow: visible;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  `;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;




    // Add event listeners for dragging
    element.addEventListener('mousedown', (event) => {
        isDragging = true;
        offsetX = event.clientX - element.getBoundingClientRect().left;
        offsetY = event.clientY - element.getBoundingClientRect().top;
        document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    });

    document.addEventListener('mousemove', (event) => {
        if (isDragging) {
            element.style.left = `${event.clientX - offsetX}px`;
            element.style.top = `${event.clientY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = ''; // Re-enable text selection
    });
}