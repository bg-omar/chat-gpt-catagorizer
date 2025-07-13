const style = document.createElement('style');
style.textContent = `
    /* Minimalistic Chat History Tree View */
    #chat-tree-panel {    
        transition: none !important;
        width: 320px;
        background: #17171788;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-shadow: 2px 2px 10px rgba(0,0,0,0.1);
        font-size: 12px;
        color: #F0F;
    }
    
    #chat-tree-header {
        background: #aa55aa88;
        padding: 6px 10px;
        font-weight: bold;
        color: #f4f;
        cursor: move;
        user-select: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    #chat-tree-toggle {
        font-weight: bold;
        border: none;
        background: none;
        color: #0f0;
        font-size: 16px;
        cursor: pointer;
    }
    #chat-tree-content {
        padding: 10px;
        max-height: 70vh;
        overflow-y: auto;
        color: #f4f;
    }
    .chat-tree-item {
        cursor: pointer;
        margin-bottom: 4px;
    }
    .chat-tree-edited {
        background-color: #606;
    }
    .chat-tree-empty {
        list-style: none;
    }
    .chat-tree-empty hr {
        border-top: 1px dashed #bbb;
        margin: 4px 0;
    }
    .chat-tree-fork details {
        margin-bottom: 6px;
    }
    
`;
document.head.appendChild(style);


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