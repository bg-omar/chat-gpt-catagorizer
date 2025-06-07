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
        toggleBtn.textContent = '—';
        toggleBtn.onclick = () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? '—' : '+';
        };
        header.appendChild(toggleBtn);
        root.appendChild(header);

        // Content box
        const content = document.createElement('div');
        content.id = 'chat-tree-content';

        // Refresh
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 Refresh Tree';
        refreshBtn.onclick = () => {
            root.remove();
            getNodes();
        };
        content.appendChild(refreshBtn);

        const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
        if (!turns.length) {
            const msg = document.createElement('div');
            msg.textContent = '⚠️ No conversation turns found.';
            content.appendChild(msg);
        }

        const list = document.createElement('ul');
        let userTurnCount = 0;
        let forkSection = null;

        const editedUserSet = new Set();
        document.querySelectorAll('[data-testid="edited-tag"]').forEach(tag => {
            const turn = tag.closest('[data-testid^="conversation-turn-"]');
            if (turn) {
                const user = turn.querySelector('[data-message-author-role="user"]');
                if (user) editedUserSet.add(user);
            }
        });


        turns.forEach((turn, i) => {
            const user = turn.querySelector('[data-message-author-role="user"]');
            const isEdited = editedUserSet.has(user);

            const summaryText = user?.innerText?.trim()?.slice(0, 80).replace(/\n/g, ' ') || null;

            // Start new fork if edited
            if (isEdited) {
                item.classList.add('chat-tree-edited');
                item.title = '✏️ Edited message';
                item.textContent += ' ✏️';

                forkSection = document.createElement('details');
                forkSection.className = 'chat-tree-fork';

                const summary = document.createElement('summary');
                summary.textContent = `✏️ Fork ${userTurnCount + 1}`;
                forkSection.appendChild(summary);
                list.appendChild(forkSection);
            }

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

                if (forkSection) {
                    forkSection.appendChild(item);
                } else {
                    list.appendChild(item);
                }
            } else {
                // Empty user turn
                const empty = document.createElement('li');
                empty.className = 'chat-tree-empty';
                empty.innerHTML = `<hr title="(No user message)">`;
                list.appendChild(empty);
            }
        });

        content.appendChild(list);
        root.appendChild(content);
        document.body.appendChild(root);


        makeDraggable(root); // call this after appending #chat-tree-panel to DOM
    }, 1000);
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