const dragable = true;
const savedPos = localStorage.getItem('chatTreePos');
function getConversationIdHash() {
    const path = window.location.pathname;
    const match = path.match(/\/c\/([a-f0-9-]{36})/);
    return match ? match[1] : null;
}


let conversationId = getConversationIdHash();
let storedTree = loadTree();
if (!storedTree.turns || storedTree.turns.length === 0) {
    console.warn('🔍 No stored tree found — running auto-scan fallback.');
    detectEditedTurns(); // or your existing scanning function
}

console.log("%c  --> conversationId: ","color:#f0f;", conversationId);
console.log("%c  --> storedTree: ","color:#f0f;", storedTree);
function loadTree() {
    const data = localStorage.getItem(`chatTree_${conversationId}`);
    return data ? JSON.parse(data) : { turns: [] };
}


function saveTree(turns, editedIdSet) {
    const existing = loadTree();
    const existingMap = new Map(existing.turns?.map(t => [t.testId, t]));

    const turnsData = turns.map(turn => {
        const testId = turn.getAttribute('data-testid');
        const userMessages = Array.from(turn.querySelectorAll('[data-message-author-role="user"]'))
            .map(m => m.innerText.trim())
            .filter(Boolean);

        const old = existingMap.get(testId) || {};
        return {
            testId,
            versions: userMessages,
            isEdited: editedIdSet.has(testId),
            forkOpen: old.forkOpen ?? true,
            forkSummary: old.forkSummary ?? undefined,
        };
    });

    const treeObject = {
        updated: new Date().toISOString(),
        turns: turnsData
    };

    localStorage.setItem(`chatTree_${conversationId}`, JSON.stringify(treeObject));
}






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
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        console.warn('⚠️ document.body not available yet');
    }
    repeater();
    const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
    globalTurns = turns;

    // 🧠 Build from stored tree immediately if available
    const storedTree = loadTree();
    const treeTurns = storedTree?.turns || [];

    if (treeTurns.length) {
        const editedIdSet = new Set(
            treeTurns.filter(item => item.isEdited).map(item => item.testId)
        );
        buildTree(turns, editedIdSet, treeTurns);
    }

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

    saveTree(globalTurns, globalEditedIdSet);  // ✅ save after detection
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
        header.textContent = '📜';
        header.classList.add('collapsed');

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'chat-tree-toggle';
        toggleBtn.textContent = '+';
        header.appendChild(toggleBtn);



        // 🔃 Refresh Button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 Refresh';
        refreshBtn.onclick = () => {
            root.remove();
            getNodes();
        };
        header.appendChild(refreshBtn);

        // 🧠 Scan Button
        const scanBtn = document.createElement('button');
        scanBtn.textContent = '🧠 Scan';
        scanBtn.style.marginLeft = '8px';
        scanBtn.onclick = scanForEditedTurns;
        header.appendChild(scanBtn);


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
        content.style.display = 'block';

        toggleBtn.addEventListener('click', () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? '—' : '+';
            if (!isHidden) {
                root.style.width = '320px';
                root.style.height = '20px';
                root.style.overflow = 'hidden';
            } else {
                root.style.width = '320px';
                root.style.height = '';
                root.style.overflow = 'visible';
            }
            sessionStorage.setItem('chatTreeCollapsed', (!isHidden).toString());
        });


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
                        fork.open = forkState === null ? true : forkState === 'true';

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

function buildTree(turns, editedIdSet, storedTurns = []) {
    const content = document.getElementById('chat-tree-content');
    if (!content) return;

    const oldList = content.querySelector('ul');
    if (oldList) oldList.remove();

    const list = document.createElement('ul');
    let userTurnCount = 0;

    storedTurns.forEach((itemData, i) => {
        const { testId, versions = [], isEdited, forkOpen, forkSummary } = itemData;
        const turn = turns.find(t => t.getAttribute('data-testid') === testId);
        const userMessage = versions[versions.length - 1]; // current version

        if (!turn || !userMessage) return;

        const item = document.createElement('li');
        item.className = 'chat-tree-item';
        item.textContent = `${++userTurnCount}: ${userMessage.slice(0, 80).replace(/\n/g, ' ')}`;
        item.dataset.turnIndex = i;

        item.onclick = () => {
            turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            localStorage.setItem(`chatTreeLastScrollIndex_${conversationId}`, i);
        };

        if (isEdited) {
            item.classList.add('chat-tree-edited');
            item.title = '✏️ Edited message';
            item.textContent += ' ✏️';

            const fork = document.createElement('details');
            fork.className = 'chat-tree-fork';
            fork.open = typeof forkOpen === 'boolean' ? forkOpen : true;


            fork.addEventListener('toggle', () => {
                itemData.forkOpen = fork.open;
                const fullTree = loadTree();
                const treeMap = new Map(fullTree.turns.map(t => [t.testId, t]));
                treeMap.set(testId, itemData);
                fullTree.turns = Array.from(treeMap.values());
                localStorage.setItem(`chatTree_${conversationId}`, JSON.stringify(fullTree));
            });

            const forkLabel = document.createElement('summary');
            forkLabel.textContent = forkSummary || `✏️ Fork ${userTurnCount}`;
            fork.appendChild(forkLabel);
            fork.appendChild(item);

            // ➕ Add sublist of versions (excluding the final one shown in main item)
            const versionList = document.createElement('ul');
            versionList.className = 'chat-tree-fork-versions';

            versions.slice(0, -1).forEach((version, idx) => {
                const versionItem = document.createElement('li');
                versionItem.textContent = `↳ Version ${idx + 1}: ${version.slice(0, 60).replace(/\n/g, ' ')}`;
                versionItem.className = 'chat-tree-version-item';
                versionItem.onclick = () => {
                    turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    localStorage.setItem(`chatTreeLastScrollIndex_${conversationId}`, i);
                };
                versionList.appendChild(versionItem);
            });

            fork.appendChild(versionList);
            list.appendChild(fork);
        } else {
            list.appendChild(item);
        }
    });

    content.appendChild(list);
}

/* --------------------------------------------------------------------
 *  Chat-tree rebuild observer
 *  – place this near the bottom of your main script (after buildTree)
 * -------------------------------------------------------------------*/

/* make conversationId writable so we can refresh it on navigation */
conversationId = getConversationIdHash();

/* constants & debouncer ------------------------------------------------ */
const CHAT_TREE_ID = 'chat-tree-panel';

let rebuildQueued = false;

function queueBuild() {
    if (rebuildQueued) return;
    rebuildQueued = true;

    requestAnimationFrame(() => {
        rebuildQueued = false;

        // 🔁 ➊ Refresh conversation ID if URL changed
        conversationId = getConversationIdHash();

        // 🔄 ➋ Load full stored tree object
        const storedTree = loadTree();
        const storedTurns = storedTree.turns || [];

        // 🧠 Build edited ID set from stored data
        const editedIdSet = new Set(
            storedTurns.filter(item => item.isEdited).map(item => item.testId)
        );

        // 🧱 ➌ Re-collect live DOM turns
        const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
        globalTurns = turns;

        // 🌳 ➍ Build tree from stored data + DOM
        buildTree(turns, editedIdSet, storedTurns);
    });
}

/* one global observer --------------------------------------------------- */
const observer = new MutationObserver((records) => {
    // Ignore mutations if everything happened inside our panel
    const onlyInsidePanel = records.every(r =>
        r.target.closest('#' + CHAT_TREE_ID)
    );
    if (onlyInsidePanel) return;

    // Something changed elsewhere – rebuild the tree
    queueBuild();
});

/* Start watching once the DOM is ready */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });
} else {
    observer.observe(document.body, { childList: true, subtree: true });
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