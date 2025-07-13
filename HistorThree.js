(() => {
    const dragable = true;
    const savedPos = localStorage.getItem('chatTreePos');
    function getConversationIdHash() {
        const path = window.location.pathname;
        const match = path.match(/\/c\/([a-f0-9-]{36})/);
        return match ? match[1] : null;
    }

    let conversationId = getConversationIdHash();
    let currentForkTestId = localStorage.getItem(`chatTreeCurrentTestId_${conversationId}`) || null;

    let storedTree = loadTree();
    const needsScan = !storedTree.turns || storedTree.turns.length === 0 ||
        storedTree.turns.some(t => !t.versions || t.versions.length === 0);

    if (needsScan) {
        console.warn('🔍 No (or incomplete) stored tree found — running auto-scan fallback.');
        // Scan the DOM for edited turns and rebuild tree
        scanForEditedTurns(); // or await if async
    }


    let globalTurns = [];
    let globalEditedIdSet = new Set();


    // ------ Fork name generator ------
    function generateForkName(userTurnCount, versionIdx = null) {
        // versionIdx is for future: if supporting deep sub-forks
        return versionIdx == null ? `Fork ${userTurnCount}` : `Fork ${userTurnCount}.${versionIdx+1}`;
    }

    // ------ Data model migration ------
    function migrateTurns(turns) {
        // Add forkName if missing (for backward compatibility)
        let userTurnCount = 0;
        return turns.map((turn) => {
            if (turn.isEdited && !turn.forkName) {
                userTurnCount++;
                return { ...turn, forkName: generateForkName(userTurnCount - 0) };
            }
            if (turn.isEdited) userTurnCount++;
            return turn;
        });
    }
    console.log("%c  --> conversationId: ","color:#f0f;", conversationId);
    console.log("%c  --> storedTree: ","color:#f0f;", storedTree);
    function loadTree() {
        const data = localStorage.getItem(`chatTree_${conversationId}`);
        if (!data) return { turns: [] };
        let tree = JSON.parse(data);
        // Migrate to add forkName if needed
        tree.turns = migrateTurns(tree.turns || []);
        return tree;
    }



    function saveTree(turns, editedIdSet) {
        const existing = loadTree();
        const existingMap = new Map(existing.turns?.map(t => [t.testId, t]));
        let userTurnCount = 0;
        const turnsData = turns.map((turn, idx) => {
            const testId = turn.getAttribute('data-testid');
            const userMessages = Array.from(turn.querySelectorAll('[data-message-author-role="user"]'))
                .map(m => m.innerText.trim())
                .filter(Boolean);
            const old = existingMap.get(testId) || {};
            let isEdited = editedIdSet.has(testId);
            let forkName = old.forkName;
            if (isEdited && !forkName) {
                userTurnCount++;
                forkName = generateForkName(userTurnCount);
            }
            if (isEdited) userTurnCount++;
            return {
                testId,
                versions: userMessages,
                isEdited,
                forkOpen: old.forkOpen ?? true,
                forkSummary: old.forkSummary ?? undefined,
                forkName: forkName,
            };
        });

        const treeObject = {
            updated: new Date().toISOString(),
            turns: turnsData,
        };
        localStorage.setItem(`chatTree_${conversationId}`, JSON.stringify(treeObject));
        console.log('[chat-tree] Saved tree:', treeObject);
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



// Utility: Check if a value exists in array (by value, not reference)
    function arrHasValue(arr, val) {
        return Array.isArray(arr) && arr.some(v => v === val);
    }

    async function scanForEditedTurns() {
        globalEditedIdSet.clear();

        // Load existing turns to preserve all prior forks
        const existing = loadTree();
        const existingMap = new Map((existing.turns || []).map(t => [t.testId, t]));

        let newTurnsData = [];

        for (const turn of globalTurns) {
            const testId = turn.getAttribute('data-testid');
            if (!testId) continue;

            // Mark as edited if there is a "previous response" button
            const prevButton = turn.querySelector('button[aria-label="Previous response"]');
            let isEdited = !!prevButton;
            if (isEdited) globalEditedIdSet.add(testId);

            // Collect ALL user messages (DOM order is most recent last)
            const userMessages = Array.from(turn.querySelectorAll('[data-message-author-role="user"]'))
                .map(m => m.innerText.trim())
                .filter(Boolean);

            // Combine with prior versions (if any)
            let allVersions = [];
            const prev = existingMap.get(testId);
            if (prev && Array.isArray(prev.versions)) {
                allVersions = [...prev.versions];
            }
            // Append new messages if not already present
            userMessages.forEach(msg => {
                if (!arrHasValue(allVersions, msg)) allVersions.push(msg);
            });

            // Only keep non-empty versions
            allVersions = allVersions.filter(Boolean);

            // Preserve previous metadata if exists
            let forkName = prev?.forkName;
            let forkOpen = prev?.forkOpen ?? true;
            let forkSummary = prev?.forkSummary ?? undefined;

            // Create the updated turn object
            newTurnsData.push({
                testId,
                versions: allVersions,
                isEdited,
                forkOpen,
                forkSummary,
                forkName
            });
        }

        // Save the new tree
        const treeObject = {
            updated: new Date().toISOString(),
            turns: newTurnsData,
        };
        localStorage.setItem(`chatTree_${conversationId}`, JSON.stringify(treeObject));
        console.log('[chat-tree] Saved tree (with ALL forks):', treeObject);

        // Rebuild UI (using your existing buildTree)
        buildTree(globalTurns, globalEditedIdSet, newTurnsData);
    }




    function getNodes() {
        setTimeout(() => {
            // ---- Set browser tab title to begin with conversation name ----
            const conversationNameElem = document.querySelector('h1, [data-testid="conversation-title"]');
            let convName = '';
            if (conversationNameElem) {
                convName = conversationNameElem.innerText.trim();
            } else {
                const firstUserMsg = document.querySelector('[data-message-author-role="user"]');
                if (firstUserMsg) {
                    convName = firstUserMsg.innerText.trim().slice(0, 30) + '...';
                } else if (conversationId) {
                    convName = 'Chat ' + conversationId.slice(0, 8);
                } else {
                    convName = 'Chat';
                }
            }
            if (!document.title.startsWith(convName)) {
                document.title = convName + ' – ' + document.title.replace(/^.*? – /, '');
            }

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
                    root.style.width = '520px';
                    root.style.height = '40px';
                    root.style.overflow = 'hidden';
                } else {
                    root.style.width = '520px';
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
                            localStorage.setItem(`chatTreeLastScrollIndex_${conversationId}`, i);
                            // For breadcrumbs
                            localStorage.setItem(`chatTreeLastScrollTestId_${conversationId}`, testId);
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
                if (!collapsed) {
                    content.style.display = 'none';
                    header.style.width = '20px';
                    header.style.height = '40px';
                    header.style.overflow = 'hidden';
                    toggleBtn.textContent = '+';
                }

                const treeTurns = loadTree().turns || [];
                // const breadcrumbs = renderBreadcrumbs(treeTurns, currentForkTestId || (treeTurns[treeTurns.length-1]?.testId));
                // if (breadcrumbs) {
                //     breadcrumbs.style.display = 'inline-block';
                //     breadcrumbs.style.marginLeft = '1em';
                //     breadcrumbs.style.fontSize = '0.93em';
                //     header.appendChild(breadcrumbs);
                // }


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

// ---------------- UI / Tree Rendering -----------------
    function buildTree(turns, editedIdSet, storedTurns = []) {
        const content = document.getElementById('chat-tree-content');
        if (!content) return;
        const oldList = content.querySelector('ul');
        if (oldList) oldList.remove();
        const list = document.createElement('ul');
        let userTurnCount = 0;

        // Determine current testId for highlighting path and breadcrumbs
        let highlightIdx = -1;
        if (currentForkTestId) {
            highlightIdx = storedTurns.findIndex(t => t.testId === currentForkTestId);
        }

        // Track ancestor testIds up to highlightIdx for current path highlight
        const pathSet = new Set();
        if (highlightIdx !== -1) {
            for (let i = 0; i <= highlightIdx; i++) {
                pathSet.add(storedTurns[i].testId);
            }
        }

        storedTurns.forEach((itemData, i) => {
            const { testId, versions = [], isEdited, forkOpen, forkSummary, forkName } = itemData;
            const turn = turns.find(t => t.getAttribute('data-testid') === testId);
            const userMessage = versions[versions.length - 1]; // current version
            if (!turn || !userMessage) return;

            const item = document.createElement('li');
            item.className = 'chat-tree-item';
            if (pathSet.has(testId)) {
                item.classList.add('chat-tree-current-path');
                item.style.background = '#e0ffe0';
                item.style.borderLeft = '3px solid #090';
            }
            item.textContent = `${++userTurnCount}: ${userMessage.slice(0, 80).replace(/\n/g, ' ')}`;
            item.dataset.turnIndex = i;
            item.onclick = () => {
                turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                localStorage.setItem(`chatTreeLastScrollIndex_${conversationId}`, i);
                // For breadcrumbs and path highlight
                currentForkTestId = testId;
                localStorage.setItem(`chatTreeCurrentTestId_${conversationId}`, testId);
                queueBuild(); // Re-render for highlight/breadcrumb update
            };

            if (isEdited) {
                item.classList.add('chat-tree-edited');
                item.title = '✏️ Edited message';
                item.textContent += ' ✏️';

                // Fork UI
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

                // --- Fork Name (with inline editing) ---
                const forkLabel = document.createElement('summary');
                forkLabel.style.display = 'flex';
                forkLabel.style.alignItems = 'center';
                // Display the fork name with input for editing
                const forkNameSpan = document.createElement('span');
                forkNameSpan.textContent = forkName || generateForkName(userTurnCount);
                forkNameSpan.style.fontWeight = 'bold';
                forkNameSpan.style.marginRight = '0.5em';

                // 🖊️ (Bonus) Edit icon
                const editBtn = document.createElement('button');
                editBtn.textContent = '🖊️';
                editBtn.title = 'Edit fork name';
                editBtn.style.marginLeft = '2px';
                editBtn.style.background = 'none';
                editBtn.style.border = 'none';
                editBtn.style.cursor = 'pointer';
                editBtn.style.fontSize = '1em';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Replace span with input
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = forkNameSpan.textContent;
                    input.style.width = '7em';
                    // Add nice dark theme
                    input.style.background = '#222';
                    input.style.color = '#fff';
                    input.style.border = '1px solid #555';
                    input.style.padding = '2px 4px';
                    input.style.borderRadius = '4px';
                    input.style.fontSize = '1em';
                    forkLabel.replaceChild(input, forkNameSpan);
                    input.focus();

                    input.onblur = input.onkeydown = (ev) => {
                        if (ev.type === 'keydown' && ev.key !== 'Enter') return;
                        forkNameSpan.textContent = input.value.trim() || forkNameSpan.textContent;
                        forkLabel.replaceChild(forkNameSpan, input);
                        itemData.forkName = forkNameSpan.textContent;
                        // Save immediately on name change
                        const fullTree = loadTree();
                        const treeMap = new Map(fullTree.turns.map(t => [t.testId, t]));
                        treeMap.set(testId, itemData);
                        fullTree.turns = Array.from(treeMap.values());
                        localStorage.setItem(`chatTree_${conversationId}`, JSON.stringify(fullTree));
                        queueBuild();
                        console.log(`[chat-tree] Fork name updated:`, forkNameSpan.textContent);
                    };
                };
                forkLabel.appendChild(forkNameSpan);
                forkLabel.appendChild(editBtn);

                fork.appendChild(forkLabel);
                fork.appendChild(item);

                // ➕ Add sublist of versions (excluding the final one shown in main item)
                const versionList = document.createElement('ul');
                versionList.className = 'chat-tree-fork-versions';

                versions.slice(0, -1).forEach((version, idx) => {
                    const versionItem = document.createElement('li');
                    versionItem.textContent = `↳ Version ${idx + 1}: ${version.slice(0, 60).replace(/\n/g, ' ')}`;
                    versionItem.className = 'chat-tree-version-item';
                    // version navigation
                    versionItem.onclick = (e) => {
                        e.stopPropagation();
                        turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        currentForkTestId = testId;
                        localStorage.setItem(`chatTreeCurrentTestId_${conversationId}`, testId);
                        queueBuild();
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
        // Save after every build!
        saveTree(turns, editedIdSet);
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
        saveTree(turns, editedIdSet);
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

    function renderBreadcrumbs(storedTurns, currentTestId) {
        const idx = storedTurns.findIndex(t => t.testId === currentTestId);
        if (idx === -1) return null;
        const path = [];
        for (let i = 0; i <= idx; i++) {
            const turn = storedTurns[i];
            if (!turn) continue;
            let label = `Turn ${i+1}`;
            if (turn.isEdited && turn.forkName) {
                label += ` (${turn.forkName})`;
            } else if (turn.isEdited) {
                label += ` (edit)`;
            }
            path.push({ label, testId: turn.testId });
        }
        // Build DOM fragment
        const container = document.createElement('span');
        container.className = 'chat-tree-breadcrumbs';
        path.forEach((seg, i) => {
            const crumb = document.createElement('a');
            crumb.textContent = seg.label;
            crumb.style.cursor = 'pointer';
            crumb.style.marginRight = '0.25em';
            crumb.onclick = () => {
                const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
                const turn = turns.find(t => t.getAttribute('data-testid') === seg.testId);
                if (turn) turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                currentForkTestId = seg.testId;
                localStorage.setItem(`chatTreeCurrentTestId_${conversationId}`, seg.testId);
                queueBuild();
            };
            container.appendChild(crumb);
            if (i < path.length - 1) {
                const sep = document.createElement('span');
                sep.textContent = '→';
                sep.style.margin = '0 0.25em';
                container.appendChild(sep);
            }
        });
        // Also update tab title
        document.title = path.map(seg => seg.label).join(' → ') + ' | ChatGPT';
        return container;
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
        // 👇 Skip drag if clicking inside input, textarea, button, etc.
        if (
            event.target.closest('input,textarea,button,select,[contenteditable]')
        ) {
            // Let the click focus the input, don't start dragging
            return;
        }
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
})();
