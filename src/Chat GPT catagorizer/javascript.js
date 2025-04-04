let renderLatexEnabled = JSON.parse(sessionStorage.getItem('renderLatexEnabled')) || false; // Default state
let isScriptEnabled = JSON.parse(sessionStorage.getItem('isScriptEnabled')) || true; // Default state
let isNavScrollEnabled = JSON.parse(sessionStorage.getItem('isNavScrollEnabled')) || true; // Default state
let isSortListsEnabled = false;
sessionStorage.setItem('isSortListsEnabled', JSON.stringify(false));
let sortListTriggered = false;
sessionStorage.setItem('sortListsTriggered', JSON.stringify(false));
sessionStorage.setItem('cursor', JSON.stringify(0));

let dataTotal = JSON.parse(sessionStorage.getItem('dataTotal')) || 0;
let cursorTotal = 10;
let shouldFetchMore = true; // Initially, allow fetching
let apiOffset = 0;
let isPaused = false;
let pauseTimeout = null;
let pauseTimeLeft = 30; // Countdown in seconds
let latexInterval;
let firstSort;
let latexAvailable = true;
let stateSetting = true;
let projectId = extractProjectId();
let projectCategorized = false;
let navScrollStart = 0;
let navScroll = 0;
let pageIsProject = false;
let projectScroll = 0;
let projectScrollStart = 0;

const offsetAmount = document.createElement('div');
const derenderButton = document.createElement('button');
const pauseButton = document.createElement('button');
const scriptButton = document.createElement('button');
const scrollButton = document.createElement('button');
const sortListsButton = document.createElement('button');
// Function to dynamically load KaTeX CSS and JS


document.addEventListener('DOMContentLoaded', () => {
  initializeButtons();
  setStates();
  repeater();
  monitorProjectChanges();
  initializeMutationObserver();
  initializeButtonClickListeners();
});

// = CONVERSATIONS CAPTURE
(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [resource, config] = args;
    const response = await originalFetch(...args);

    // Intercept the API calls for conversations
    if (typeof resource === 'string' && resource.includes('/backend-api/conversations')) {
      const clonedResponse = response.clone(); // Clone the response to read it without consuming it
      const data = await clonedResponse.json();

      sessionStorage.setItem('dataTotal', JSON.stringify(data.total)); // Default state

      // Store the API data in localStorage
      const existingData =  JSON.parse(sessionStorage.getItem('conversations')) || [];
      const newConversations = data.items.map((item) => ({
        ...item,
        update_time: item.update_time ? new Date(item.update_time) : null,
      }));

      const mergedConversations = mergeAndCleanConversations(
          existingData,
          newConversations
      );

      sessionStorage.setItem('conversations',  JSON.stringify(mergedConversations));

      // Save the offset to avoid re-fetching the same data
      apiOffset = data.offset + data.limit;
      sessionStorage.setItem('apiOffset', JSON.stringify(apiOffset));
    }

    return response;
  };
})();

// = PROJECTS CAPTURE
(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [resource, config] = args;
    const response = await originalFetch(...args);

    // Capture API calls for project conversations
    if (typeof resource === "string" && resource.includes("/backend-api/gizmos/")) {
      const match = resource.match(/g-p-[a-f0-9]+/); // Extract project ID dynamically
      const cursorMatch = resource.match(/cursor=(\d+)/);
      const cursor = cursorMatch ? parseInt(cursorMatch[1], 10) : 0; // Detect cursor

      if (match) {
        pageIsProject = true;
        projectId = match[0]; // Extract project identifier (g-p-XXXXXXXXXX)

        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        // Store total conversations count
        sessionStorage.setItem(`cursor`, JSON.stringify(data.cursor));

        // Get existing conversations
        const existingData = JSON.parse(sessionStorage.getItem(`conversations_${projectId}`)) || [];

        // Process new conversations
        const newConversations = data.items.map((item) => ({
          ...item,
          update_time: item.update_time ? new Date(item.update_time) : null,
        }));

        // Merge & remove duplicates
        const mergedConversations = mergeAndCleanConversations(existingData, newConversations);

        // Store merged conversations under project-specific key
        sessionStorage.setItem(`conversations_${projectId}`, JSON.stringify(mergedConversations));
      }
    }

    return response;
  };
})();

function getStates() {
  try {
    isScriptEnabled = JSON.parse(sessionStorage.getItem('isScriptEnabled'));
    isNavScrollEnabled = JSON.parse(sessionStorage.getItem('isNavScrollEnabled'));
    isSortListsEnabled = JSON.parse(sessionStorage.getItem('isSortListsEnabled'));
    sortListTriggered = JSON.parse(sessionStorage.getItem('sortListsTriggered'));
    renderLatexEnabled = JSON.parse(sessionStorage.getItem('renderLatexEnabled'));
    apiOffset = JSON.parse(sessionStorage.getItem('apiOffset'));
    dataTotal = JSON.parse(sessionStorage.getItem('dataTotal'));
    cursorTotal = JSON.parse(sessionStorage.getItem(`cursor`));

    // Force refresh of conversation data to avoid stale IDs
    let updatedConversations = managesessionStorage('get') || [];
    managesessionStorage('set', updatedConversations);

    offsetAmount.textContent = `${apiOffset} of ${dataTotal}`;

    if (apiOffset >= dataTotal) {
      if (isNavScrollEnabled) {
        isSortListsEnabled = true;
        sessionStorage.setItem('isSortListsEnabled', JSON.stringify(true));
      }
      isNavScrollEnabled = false;
    }
    //console.log('Finished get states');
  } catch (error) {
    console.error('Error in getStates:', error);
  }
}

function setStates() {
  sessionStorage.setItem('isScriptEnabled', JSON.stringify(isScriptEnabled));
  sessionStorage.setItem('isNavScrollEnabled', JSON.stringify(isNavScrollEnabled));
  sessionStorage.setItem('isSortListsEnabled',JSON.stringify(isSortListsEnabled));
  sessionStorage.setItem('renderLatexEnabled',JSON.stringify(renderLatexEnabled));

  // Update the button text to match the state
  sortListsButton.textContent = `Sort: ${isSortListsEnabled}`;
  //console.log('Finished set states');
}

// = REPEATER
function repeater() {
  if (latexAvailable) {
    latexInterval = setInterval(async () => {
      if (!isScriptEnabled) return;
      try {
        await toggleLaTeXRendering();
      } catch (e) {
        console.error('Error in latex interval:', e);
      }
    }, 100);
  }

  setTimeout(() => {
    document.querySelectorAll('div.absolute.bottom-0.top-0.inline-flex').forEach(div => {
      div.classList.remove('invisible');
    });
  }, 500);


  firstSort = setInterval(async () => {
    if (isPaused) return; // Skip execution if paused
    try {
      await getStates();

      if (apiOffset <= dataTotal) {
        await scrollAndEvent(300, 'nav');
        await scrollAndEvent(0, 'nav');
      } else {
        isSortListsEnabled = true;
      }

      if(cursorTotal !== null) {
        await scrollAndEvent(300,'project');
        await scrollAndEvent(0, 'project');
      } else {
        await sortProject();
      }

      if (isScriptEnabled) {
        await checkAndReplaceText();
      }

      // Only sort if sorting is enabled and hasn't been triggered recently
      if (isSortListsEnabled && !sortListTriggered) {
        console.log('Triggering sortLists() due to sessionStorage change.');
        await sortLists();
        await validateListItems();
        sessionStorage.setItem('sortListsTriggered', JSON.stringify(true)); // Prevent repeated execution
      }

      setStates(); // Set states after changes
    } catch (e) {
      console.error('Error in sortLists interval:', e);
    }
  }, 2500); // Reduce interval if needed

  if (apiOffset > dataTotal && cursorTotal === null) {
    clearInterval(firstSort);
    console.log('Start 2nd interval');
    setInterval(async () => {
      if (isPaused) return;
      try {
        await getStates();

        if (apiOffset <= dataTotal) {
          await scrollAndEvent(300, 'nav');
          await scrollAndEvent(0, 'nav');
        } else {
          isSortListsEnabled = true;
        }

        if(cursorTotal !== null) {
          await scrollAndEvent(300,'project');
          await scrollAndEvent(0, 'project');
        } else {
          await sortProject();
        }

        if (isScriptEnabled) {
          await checkAndReplaceText();
        }

        if (isSortListsEnabled && !sortListTriggered) {
          console.log('Triggering sortLists() due to sessionStorage change.');
          await sortLists();
          sessionStorage.setItem('sortListsTriggered', JSON.stringify(true));
        }

        setStates();
      } catch (e) {
        console.error('Error in checkAndReplaceText interval after timeout:', e);
      }
    }, 90000);
  }
}

// = REPLACE TEXT COLOR CATEGORIES
function checkAndReplaceText() {
  // Select both existing elements and the new OL path you want to include
  const divElements = document.querySelectorAll(
      '.relative.grow.overflow-hidden.whitespace-nowrap, ' +
      'body > div.flex.h-full.w-full.flex-col > div > div.relative.flex.h-full.w-full.flex-row.overflow-hidden > div.relative.flex.h-full.max-w-full.flex-1.flex-col.overflow-hidden > main > div > section > div:nth-child(2) > div > div > div > div > div > div > div.mb-14.mt-6 > ol > li > a > div > div > div.flex-grow > div.text-sm.font-medium'
  );

  if (divElements.length === 0) return;

  const colors = [
    '#f0f',    '#FF7E00',    '#64edd3',    '#0f0',    '#3cc',    '#ff0',    '#f00',    '#0ff',    '#336699',    'gray',    'silver',    '#CC99FF',    '#6633FF',    '#66FF99',    '#FF6633',    '#66CCCC',    '#33CC33',    'red',    'purple',    'green',    'lime',    'olive',    'yellow',    'blue',    'teal',    'aqua',    '#FFC0CB',    '#8A2BE2',    '#5F9EA0',    '#7FFF00',    '#DC143C',    '#00FFFF',    '#FFD700',    '#ADFF2F',    '#4B0082',    '#FF4500',    '#DA70D6',    '#EE82EE',    '#20B2AA',    '#BA55D3',    '#4682B4',    '#D2691E',    '#40E0D0',    '#6A5ACD',    '#B22222',    '#808000',    '#708090',    '#8B4513',    '#FF1493',    '#00FA9A',    '#B0C4DE',    '#F5DEB3',    '#00CED1',
  ];

  const projectId = extractProjectId();
  let colorIndex = 0;
  let wordColors = {};
  let conversations;
  let storedProjectConversations;
  let projectConversations;
  try {
    wordColors = JSON.parse(sessionStorage.getItem('wordColors')) || {};
    conversations = managesessionStorage('get') || {};
    storedProjectConversations = JSON.parse(sessionStorage.getItem("conversations_" + projectId)) || {};
    projectConversations = Array.isArray(storedProjectConversations)
        ? storedProjectConversations
        : Array.from(storedProjectConversations);
  } catch (e) {
    console.error('Error parsing wordColors from sessionStorage:', e);
    wordColors = {};
  }

  divElements.forEach((divElement) => {
    let textContent = divElement.textContent;
    conversations.forEach((item) => {
      if (item.title === textContent) {
        divElement.closest('li')?.setAttribute('data-date', item.update_time);
        divElement.closest('li')?.setAttribute('data-id', item.id);
      }
    });


    if (projectId !== null) {
      projectConversations.forEach((item) => {
        if (item.title === textContent) {
          divElement.closest('li')?.setAttribute('data-date', item.update_time);
          divElement.closest('li')?.setAttribute('data-id', item.id);
        }
      });
    }

    if (divElement.querySelector('span')) return;

    const regex = /\[(.*?)\]/g;

    const newText = textContent.replace(regex, (match, word) => {
      if (!wordColors[word]) {
        wordColors[word] = colors[colorIndex % colors.length];
        colorIndex++;
      }
      return `<span class="highlighted" style="color: ${wordColors[word]}; border: 1px dotted ${wordColors[word]}">${word}</span>`;
    });

    const match = regex.exec(textContent);
    if (match && match[1]) {
      divElement.closest('li')?.setAttribute('data-category', match[1].trim());
    }

    divElement.innerHTML = newText;
  });

  // Save updated color assignments to sessionStorage
  try {
    sessionStorage.setItem('wordColors', JSON.stringify(wordColors));
  } catch (e) {
    console.error('Error saving wordColors to sessionStorage:', e);
  }
}

// = SORT LIST ITEMS
function sortLists() {
  const categories = {};
  const uncategorizedItems = [];
  const singleItems = []; // To collect single item categories
  const listContainer = document.querySelector('div.flex.flex-col.gap-2.text-token-text-primary.text-sm');

  if (!listContainer) return;


  console.log('Sorting Started');

  const originalOlLists = listContainer.querySelectorAll('ol');
  const olListsToCategorize = Array.from(originalOlLists);

  // Clear processedItems set to reflect the latest DOM structure
  let processedItems = new Set();
  let wordColors = JSON.parse(sessionStorage.getItem('wordColors')) || {};
  let getConversations = managesessionStorage('get') || {};
  let conversations = Array.isArray(getConversations) ? getConversations : Array.from(getConversations);

  let totalitems = 0;


  olListsToCategorize.forEach((ol) => {
    ol.setAttribute('style', 'display: block;');
    // console.log("ol: ", ol);
    const listItems = ol.querySelectorAll('li');
    listItems.forEach( (item) => {
      totalitems++;
      if (processedItems.has(item)) return;

      const category = item.getAttribute('data-category');
      let dateStr = item.getAttribute('data-date');
      const dataId = item.getAttribute('data-id');

      let date2;
      getConversations.forEach((item) => {
        if (dataId === item.id) {
          date2 = new Date(item.update_time);
        }
      });
      if (dateStr !== undefined) {
        conversations = removeObjectWithId(conversations, dataId);
      }

      const fallbackDate = date2 !== undefined ? date2 : new Date(0); // Epoch time for missing dates
      const date =
          date2 !== undefined
              ? date2
              : dateStr
                  ? new Date(dateStr)
                  : fallbackDate;

      if (category) {
        if (!categories[category]) categories[category] = [];
        categories[category].push({ item, date });
      } else {
        uncategorizedItems.push({ item, date });
      }
      // console.log("processedItems added: ", item);
      processedItems.add(item);
    });
  });

  // Ensure there's an <ol> element in the container.
  let olElement;
  if (!olListsToCategorize[0]) {
    olElement = document.createElement('ol');
    olListsToCategorize.appendChild(olElement);
  } else {
    olElement = olListsToCategorize[0];
  }

  let orphans = 0;
  if (conversations && conversations.length > 0) {
    processOrphans(conversations, olElement);
  }

  // Sort items within categories by date (ascending order)
  for (const category in categories) {
    categories[category].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date - a.date;
    });
  }

  // Deduplicate uncategorizedItems based on their data-id
  const uniqueUncategorizedItems = [];
  const seenIds = new Set();

  uncategorizedItems.forEach((itemObj) => {
    const itemId = itemObj.item.getAttribute('data-id');
    if (!seenIds.has(itemId)) {
      seenIds.add(itemId);
      uniqueUncategorizedItems.push(itemObj);
    }
  });

  // Sort by most recent date
  uniqueUncategorizedItems.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date - a.date; // Most recent first
  });

  // Create a document fragment to hold new categorized <ol> elements
  const fragment = document.createDocumentFragment();

  // Create "Uncategorized" section first
  if (uncategorizedItems.length > 0) {
    const uncategorizedOlContainer = createCategoryContainer(
        'Uncategorized',
        uncategorizedItems.map((itemObj) => itemObj.item)
    );
    fragment.appendChild(uncategorizedOlContainer);
  }
  const sortedCategories = collectSingleItems(
      categories,
      singleItems,
      fragment
  );

  // Sort categories by the earliest date among their items (ascending order)
  sortedCategories.sort((a, b) => {
    const dateA = a.mostRecentDate || new Date(0); // Fallback to earliest possible date if undefined
    const dateB = b.mostRecentDate || new Date(0);
    return dateB - dateA; // For descending order, use `dateB - dateA`
  });

  //console.log('Sorted categories by earliest date:', sortedCategories);

  // Clear and sort the fragment

  // Create categorized lists based on sorted categories and append them in order
  sortedCategories.forEach(({ category, items }) => {
    const newOlContainer = createCategoryContainer(
        category,
        items,
        wordColors[category]
    );
    fragment.appendChild(newOlContainer);
  });

  // Clear all existing <ol> elements from the container, except the first one
  listContainer.querySelectorAll('ol').forEach((ol, index) => {
    if (index > 0) {
      ol.parentElement?.remove();
    }
  });

  listContainer.appendChild(fragment);
  // Reinitialize button listeners and dropdowns after sorting
  reinitializeDropdowns();
  initializeButtonClickListeners();
}

// = SORT PROJECT ITEMS
function sortProject() {
  const projectContainer = document.querySelector("div.mb-14.mt-6");
  if (!projectContainer || cursorTotal !== null || projectCategorized) return;


  const projectId = extractProjectId() || null;
  console.log("🚀 Project Sorting Started");

  const projectCategories = {};
  const uncategorizedProjectItems = [];
  let processedItems = new Set();


  let wordColors = JSON.parse(sessionStorage.getItem("wordColors")) || {};
  let conversations = JSON.parse(sessionStorage.getItem("conversations_" + extractProjectId())) || [];

  const listItems = Array.from(projectContainer.querySelectorAll("ol li"));

  listItems.forEach((item) => {
    if (processedItems.has(item)) return;
    // Trigger a hover event to make sure buttons appear

    const category = item.getAttribute("data-category");
    const dataId = item.getAttribute("data-id");
    let dateStr = item.getAttribute("data-date");
    let date2;

    conversations.forEach((conv) => {
      if (dataId === conv.id) {
        date2 = new Date(conv.update_time);
      }
    });

    const date = date2 || (dateStr ? new Date(dateStr) : new Date(0));
    document.querySelectorAll(".group").forEach((group) => {
      group.classList.add("hover"); // Simulates hover state
    });
    // ✅ Manually find the missing button before cloning
    const originalButton = item.querySelector('button[data-testid$="-options"]');

    // ✅ Clone the item
    const clonedItem = item.cloneNode(true);

    // ✅ If the button is missing, re-add it
    if (!clonedItem.querySelector('button[data-testid$="-options"]')) {
      console.log(`Button missing in cloned item: ${dataId}, injecting manually`);

      // Create the button manually
      const buttonContainer = clonedItem.querySelector("div.absolute.bottom-0.top-0.inline-flex") ||
          document.createElement("div");
      buttonContainer.classList.add("absolute", "bottom-0", "top-0", "inline-flex", "items-center", "gap-1.5", "pr-2", "ltr:right-0", "rtl:left-0");

      const button = document.createElement("button");
      button.className = "flex items-center justify-center text-token-text-secondary transition hover:text-token-text-primary radix-state-open:text-token-text-secondary";
      button.setAttribute("data-testid", `history-item-${dataId}-options`);
      button.setAttribute("id", `radix-${dataId}`);
      button.setAttribute("aria-label", "Open conversation options");
      button.setAttribute("type", "button");

      // Add the SVG icon inside the button
      button.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-md">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12ZM10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12ZM17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12Z" fill="currentColor"></path>
            </svg>
        `;

      buttonContainer.appendChild(button);
      clonedItem.appendChild(buttonContainer);
    }

    if (category) {
      if (!projectCategories[category]) projectCategories[category] = [];
      projectCategories[category].push({ item: item.cloneNode(true, true), date });

    } else {
      uncategorizedProjectItems.push({ item: item.cloneNode(true, true), date });
    }


    console.log("Cloning item:", clonedItem);
    console.log("Original button:", originalButton);
    console.log("Button in cloned item:", clonedItem.querySelector('button[data-testid$="-options"]'));

    processedItems.add(item);
  });

  console.log("🚀 After Sorting - Categorized:", Object.keys(projectCategories).map(cat => ({ category: cat, count: projectCategories[cat].length })));
  console.log("🚀 After Sorting - Uncategorized Count:", uncategorizedProjectItems.length);

  const fragment = document.createDocumentFragment();

  const sortedCategories = Object.entries(projectCategories)
      .filter(([category, items]) => items.length > 0)
      .map(([category, items]) => ({
        category,
        items,
        mostRecentDate: items.length ? items[0].date : new Date(0),
      }))
      .sort((a, b) => b.mostRecentDate - a.mostRecentDate);

  console.log("🚀 Final Sorted Categories:", sortedCategories);

  projectContainer.querySelectorAll("ol").forEach((ol) => ol.remove());

  sortedCategories.forEach(({ category, items }) => {
    const newOlContainer = createCategoryContainer(
        category,
        items.map(({ item }) => item),
        wordColors[category]
    );

    fragment.appendChild(newOlContainer);
  });

  if (uncategorizedProjectItems.length > 0) {
    const uncategorizedOlContainer = createCategoryContainer(
        "Uncategorized",
        uncategorizedProjectItems.map(({ item }) => item)
    );
    fragment.appendChild(uncategorizedOlContainer);
  }

  projectContainer.appendChild(fragment);
  console.log("🚀 Project categories successfully sorted!");

  reinitializeDropdowns();
  initializeButtonClickListeners();
  projectCategorized = true;
}

function createCategoryContainer(category, items, color) {
  const newOlContainer = document.createElement('div');
  newOlContainer.className = 'relative mt-5 first:mt-0 last:mb-5';

  const categoryHeader = document.createElement('h3');
  categoryHeader.className =
      'sticky bg-token-sidebar-surface-primary top-0 z-20 flex h-9 items-center px-2 text-xs font-semibold text-ellipsis overflow-hidden break-all pt-3 pb-2 text-token-text-primary';
  categoryHeader.textContent = `${category}`;

  if (color) {
    categoryHeader.style.color = color;
    categoryHeader.style.border = `1px dotted ${color}`;
  }

  const collapseIcon = document.createElement('span');
  let isCollapsed = JSON.parse(localStorage.getItem(`categoryState_${category}`)) ?? true;
  collapseIcon.textContent = isCollapsed ? '[+]' : '[-]';
  collapseIcon.style.marginRight = '10px';
  collapseIcon.style.cursor = 'pointer';
  categoryHeader.prepend(collapseIcon);
  categoryHeader.style.cursor = 'pointer';
  newOlContainer.appendChild(categoryHeader);

  categoryHeader.addEventListener('click', () => {
    newOl.style.display = newOl.style.display === 'none' ? 'block' : 'none';
    collapseIcon.textContent = newOl.style.display === 'none' ? '[+]' : '[-]';
    localStorage.setItem(`categoryState_${category}`, JSON.stringify(newOl.style.display !== 'none'));
  });
  const newOl = document.createElement('ol');
  newOl.style.display = isCollapsed ? 'none' : 'block';

  // 🚨 **Debugging: Log before appending**
  // console.log(`🟢 Attempting to insert ${items.length} items into ${category}`);

  if (items.length === 0) {
    console.warn(`⚠️ Empty category detected: ${category}`);
  } else {
    items.forEach((item) => {
      // Ensure the .group container exists and has the right classes
      const groupDiv = item.querySelector('.group');
      if (groupDiv) {
        groupDiv.classList.add('group');

        // If options button is missing inside the group, re-add it
        if (!groupDiv.querySelector('button[data-testid$="-options"]')) {
          const dataId = item.getAttribute('data-id');

          const buttonContainer = document.createElement('div');
          buttonContainer.className = 'absolute bottom-0 top-0 items-center gap-1.5 pr-2 ltr:right-0 rtl:left-0 hidden can-hover:group-hover:flex';

          const button = document.createElement('button');
          button.className = 'flex items-center justify-center text-token-text-secondary transition hover:text-token-text-primary radix-state-open:text-token-text-secondary';
          button.setAttribute('data-testid', `history-item-${dataId}-options`);
          button.setAttribute('aria-label', 'Open conversation options');
          button.setAttribute('type', 'button');
          button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-md">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12ZM10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12ZM17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12Z" fill="currentColor"></path>
        </svg>
      `;

          buttonContainer.appendChild(button);
          groupDiv.appendChild(buttonContainer);
        }
      }

      newOl.appendChild(item);
    });

  }
  newOlContainer.appendChild(newOl);
  return newOlContainer;
}

function getRelativeDateCategory(dateStr) {
  if (!dateStr) return 'Older';

  const date = new Date(dateStr);
  if (isNaN(date)) return 'Older';

  const now = new Date();
  const oneDay = 86400000; // 24 * 60 * 60 * 1000

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today - inputDate) / oneDay);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay()); // Sunday
  if (inputDate >= thisWeekStart) return 'This Week';

  if (
      inputDate.getFullYear() === today.getFullYear() &&
      inputDate.getMonth() === today.getMonth()
  ) return 'This Month';

  return 'Older';
}


function toggleLaTeXRendering() {
  if (renderLatexEnabled) {
    renderLaTeX();
  } else {
    const hasLatex = document.querySelector('[data-original]') !== null;
    if (hasLatex) {
      derenderLaTeX();
      latexAvailable = true;
    } else {
      console.log('No LaTeX to de-render.');
      clearInterval(latexInterval); // Stop the interval if there's no LaTeX left
      latexAvailable = false;
    }
  }
}

function scrollAndEvent(amount, container = 'nav') {

  // Find the scrolling container
  let scrollContainer;
  if(container !== 'nav') {
    scrollContainer = document.querySelector(
        '.relative.flex.h-full.max-w-full.flex-1.flex-col.overflow-hidden > main > div > section > div:nth-child(2) > div > div'
    );
  } else {
    scrollContainer = document.querySelector(
        '.flex-col.flex-1.transition-opacity.duration-500.relative.pr-3.overflow-y-auto'
    );
  }

  if (!scrollContainer) {
    // console.error('Scrolling container not found.');
    return;
  }


  if(container === 'nav' && amount === 0){
    navScrollStart = scrollContainer.scrollTop;
    //console.log('navScroll: ', navScroll);

  }
  if(container === 'project' && amount === 0){
    projectScrollStart = scrollContainer.scrollTop;
    //console.log('projectScroll: ', projectScroll);
    if(cursorTotal === null) {
      scrollContainer.scrollTop = 0;
    } else if (apiOffset >= dataTotal) {
      scrollContainer.scrollTop = 0;
    }
  }

//console.log(container, 'amount: ', amount, 'scrollTop: ', scrollContainer.scrollTop, 'scrollHeight: ', scrollContainer.scrollHeight, 'clientHeight', scrollContainer.clientHeight);
  if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight - 200;
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
  }

  if (amount !== 0) {
    if( container === 'project' ){
      if( projectScroll === scrollContainer.scrollTop) {
        projectScroll = scrollContainer.scrollTop + scrollContainer.scrollHeight - amount;
        scrollContainer.scrollTop = projectScroll
      } else {
        scrollContainer.scrollTop = projectScroll + scrollContainer.scrollHeight - amount;
      }
    }
    if ( container === 'nav' ){
      if( navScroll === scrollContainer.scrollTop) {
        navScroll = scrollContainer.scrollTop + scrollContainer.scrollHeight - amount;
        scrollContainer.scrollTop = navScroll
      } else {
        scrollContainer.scrollTop = navScroll + scrollContainer.scrollHeight - amount;
      }
    }
  } else {
    scrollContainer.scrollTop = container === 'project' ? projectScrollStart : navScrollStart;
  }

  // Dispatch the scroll event to trigger the website's fetching logic
  scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

  // Restore the initial scroll position
  //scrollContainer.scrollTop = initialScrollTop;

  if (apiOffset >= dataTotal) {
    isNavScrollEnabled = false;
    isSortListsEnabled = true;
    setStates();
  }
}

function waitForContainerToLoad(callback, maxRetries = 50, retryCount = 0) {
  const container = document.querySelector(
      '.relative.mt-5.first\\:mt-0.last\\:mb-5'
  );
  if (container) {
    console.log('Container loaded.');
    callback();
  } else if (retryCount < maxRetries) {
    console.log('Waiting for container...');
    setTimeout(
        () => waitForContainerToLoad(callback, maxRetries, retryCount + 1),
        100
    );
  } else {
    console.error('Max retries reached. Container not found.');
  }
}

function createListItem(conversation, index) {
  const li = document.createElement('li');
  li.className = 'relative';
  li.setAttribute('data-testid', `history-item-${index}`);
  li.setAttribute('data-date', conversation.update_time);
  li.setAttribute('data-id', conversation.id);

  li.innerHTML = `
    <div draggable="true" class="no-draggable group rounded-lg active:opacity-90 bg-[var(--item-background-color)] h-9 text-sm relative" style="--item-background-color: #171717;">
      <a class="flex items-center gap-2 p-2" data-discover="true" href="/c/${conversation.id}">
        <div class="relative grow overflow-hidden whitespace-nowrap" dir="auto" title="${conversation.title}">
          ${conversation.title}
        </div>
      </a>
      <div class="absolute bottom-0 top-0 items-center gap-1.5 pr-2 ltr:right-0 rtl:left-0 hidden can-hover:group-hover:flex">
        <span data-state="closed">
          <button class="flex items-center justify-center text-token-text-secondary transition hover:text-token-text-primary radix-state-open:text-token-text-secondary" data-testid="history-item-${index}-options" type="button" id="radix-${index}" aria-haspopup="menu" aria-expanded="true" data-state="open" aria-controls="radix-${index}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-md">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12ZM10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12ZM17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12Z" fill="currentColor"></path>
            </svg>
          </button>
        </span>
      </div>
    </div>
  `;

  return li;
}

function processOrphans(conversations, olElement) {
  conversations.forEach((conversation, index) => {
    const li = createListItem(conversation, index);
    olElement.appendChild(li);
  });
}

function collectSingleItems(categories, singleItems, fragment) {
  if (!isSortListsEnabled) return;
  // Separate out single-item categories
  const sortedCategories = [];
  for (const category in categories) {
    if (categories[category].length === 1) {
      singleItems.push(...categories[category]);
    } else {
      const mostRecentDate = categories[category]
          .filter((item) => item.date instanceof Date && !isNaN(item.date))
          .reduce(
              (mostRecent, current) =>
                  !mostRecent || current.date > mostRecent
                      ? current.date
                      : mostRecent,
              null
          );

      //console.log('Most Recent Date for category:', category, mostRecentDate);
      sortedCategories.push({
        category,
        items: categories[category].map((itemObj) => itemObj.item),
        mostRecentDate: mostRecentDate, // Now reflects the most recent date
      });
    }
  }

  // Create a "Single Items" section for all single-item categories
  if (singleItems.length > 0) {
    const singleItemsOlContainer = createCategoryContainer(
        'Single Items',
        singleItems.map((itemObj) => itemObj.item)
    );
    fragment.appendChild(singleItemsOlContainer);
  }
  return sortedCategories;
}

function initializeMutationObserver() {
  const targetNode = document.querySelector(
      '.relative.grow.overflow-hidden.whitespace-nowrap'
  );

  const config = { childList: true, subtree: true, characterData: true };

  const callback = (mutationsList) => {
    // Use a flag to prevent recursive triggering of the observer
    let isObserving = true;

    for (let mutation of mutationsList) {
      if (
          (mutation.type === 'childList' || mutation.type === 'characterData') &&
          isObserving
      ) {
        isObserving = false;
        try {
          checkAndReplaceText();
          sortLists();
          validateListItems();

          // Handle chat renames
          renameChatHandler(mutation);
        } catch (e) {
          console.error('Error in mutation callback:', e);
        } finally {
          isObserving = true;
        }
      }
    }
  };

  if (targetNode) {
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
  }
}

function mergeAndCleanConversations(existingConversations, newConversations) {
  const conversationMap = new Map(existingConversations.map(conv => [conv.id, conv]));

  newConversations.forEach((conv) => {
    if (conversationMap.has(conv.id)) {
      // Update title if it has changed
      const existingConv = conversationMap.get(conv.id);
      if (existingConv.title !== conv.title) {
        console.log(`Updating title for ${conv.id}: "${existingConv.title}" -> "${conv.title}"`);
        existingConv.title = conv.title;
        existingConv.update_time = conv.update_time; // Keep latest timestamp
      }
    } else {
      conversationMap.set(conv.id, conv);
    }
  });

  return Array.from(conversationMap.values());
}

function monitorProjectChanges() {
  const projectsContainer = document.querySelector(
      '.projects-container-selector'
  ); // Update the selector to match your Projects container

  if (!projectsContainer) {
    console.error('Projects container not found.');
    return;
  }

  // Create a MutationObserver
  const observer = new MutationObserver((mutationsList) => {
    mutationsList.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Handle added items
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            console.log('New item added to Projects:', node);
            notifyScriptOfChange(node);
          }
        });
      }

      if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-project-id'
      ) {
        console.log('Project attributes changed:', mutation.target);
        notifyScriptOfChange(mutation.target);
      }
    });
  });

  // Configure the observer to watch for child additions and attribute changes
  observer.observe(projectsContainer, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  console.log('Monitoring project changes...');
}

// Function to notify the script of a change
function notifyScriptOfChange(changedElement) {
  console.log('Change detected:', changedElement);

  // Perform any necessary actions (e.g., update sessionStorage or UI)
  const projectId = changedElement.getAttribute('data-project-id');
  const projectTitle = changedElement.textContent.trim();
  console.log(`Project updated: ${projectId} - ${projectTitle}`);
}

function renameChatHandler(mutation) {
  const updatedTitleElement = mutation.target.closest(
      '.relative.grow.overflow-hidden.whitespace-nowrap'
  );
  if (!updatedTitleElement) return;

  const updatedTitle = updatedTitleElement.textContent.trim();
  const chatId = updatedTitleElement.closest('li')?.getAttribute('data-id');

  if (!chatId || !updatedTitle) return;

  // Ensure session storage is refreshed before updating
  let conversations = managesessionStorage('get') || [];
  conversations = mergeAndCleanConversations(conversations, []);

  const chat = conversations.find((item) => item.id === chatId);
  if (chat) {
    chat.title = updatedTitle;
    managesessionStorage('set', conversations);

    console.log(`Chat title updated for ID: ${chatId} -> ${updatedTitle}`);
  } else {
    console.warn(`Chat ID not found in sessionStorage: ${chatId}`);
  }
}

function reinitializeDropdowns() {
  document.querySelectorAll('button[data-testid$="-options"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();

      // 🔥 Native event (bubbles, can be captured by ChatGPT's real code)
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });

      button.dispatchEvent(clickEvent); // Trigger native dropdown logic
    }, { once: true }); // Only bind once per button
  });
}


function initializeButtons() {
  derenderButton.style.cssText = getButtonStyles();
  derenderButton.textContent = `LaTeX: ${renderLatexEnabled ? 'on' : 'off'}`;
  derenderButton.addEventListener('click', () =>{
        toggleState('renderLatexEnabled', derenderButton);
        latexAvailable = true;
      }
  );

  // Create container for the buttonsD
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    position: fixed;
    bottom: 50%;
    right: 40px;
    display: grid;
    gap: 10px;
  `;

  offsetAmount.style.cssText = getButtonStyles();
  offsetAmount.textContent = `${apiOffset} of ${dataTotal}`;

  pauseButton.style.cssText = getButtonStyles();
  pauseButton.textContent = `Pause (${pauseTimeLeft}s)`;
  pauseButton.addEventListener('click', () => togglePause(pauseButton));

  scriptButton.style.cssText = getButtonStyles();
  scriptButton.textContent = `Script: ${isScriptEnabled}`;
  scriptButton.addEventListener('click', () =>
      toggleState('isScriptEnabled', scriptButton)
  );

  scrollButton.style.cssText = getButtonStyles();
  scrollButton.textContent = `Scroll: ${isNavScrollEnabled}`;
  scrollButton.addEventListener('click', () =>
      toggleState('isNavScrollEnabled', scrollButton)
  );

  sortListsButton.style.cssText = getButtonStyles();
  sortListsButton.textContent = `Sort: ${isSortListsEnabled}`;
  sortListsButton.addEventListener('click', () =>
      toggleState('isSortListsEnabled', sortListsButton)
  );

  // Append buttons to the container
  buttonContainer.appendChild(derenderButton);
  buttonContainer.appendChild(offsetAmount);
  buttonContainer.appendChild(pauseButton);
  buttonContainer.appendChild(scriptButton);
  buttonContainer.appendChild(scrollButton);
  buttonContainer.appendChild(sortListsButton);

  // Add the container to the document body
  document.body.appendChild(buttonContainer);
}

// Function to toggle pause state
function togglePause(pauseButton) {
  if (isPaused) {
    clearInterval(pauseTimeout);
    isPaused = false;
    pauseTimeLeft = 30;
    pauseButton.textContent = `Pause (${pauseTimeLeft}s)`;

    // Ensure stored data is refreshed before resuming
    setTimeout(() => {
      getStates(); // Refresh session storage values
      console.log('Session storage refreshed after pause.');
    }, 500); // Short delay before resuming

    console.log('Repeater unpaused');
  } else {
    isPaused = true;
    pauseButton.disabled = false;
    pauseButton.textContent = `Paused (${pauseTimeLeft}s)`;

    pauseTimeout = setInterval(() => {
      pauseTimeLeft--;
      pauseButton.textContent = `Paused (${pauseTimeLeft}s)`;

      if (pauseTimeLeft <= 0) {
        clearInterval(pauseTimeout);
        isPaused = false;
        pauseTimeLeft = 30;
        pauseButton.textContent = `Repeater (${pauseTimeLeft}s)`;

        setTimeout(() => {
          getStates(); // Ensure latest data is fetched before resuming
          console.log('Session storage refreshed after timeout.');
        }, 500);

        console.log('Repeater resumed');
      }
    }, 1000);
  }
}

// Function to toggle state and update the button text
function toggleState(stateKey, button) {
  const currentState = JSON.parse(sessionStorage.getItem(stateKey));
  const newState = !currentState;

  if (stateKey === 'renderLatexEnabled') {
    button.textContent = `LaTeX: ${newState ? 'on' : 'off'}`;
  } else {
    // Default behavior for other buttons
    button.textContent = `${formatStateKey(stateKey)}: ${newState}`;
  }
  sessionStorage.setItem(stateKey, JSON.stringify(newState));
  console.log(`${stateKey}:`, newState);
}

function formatStateKey(stateKey) {
  return stateKey
      .replace(/([A-Z])/g, ' $1') // Add space before uppercase letters
      .replace(/\bis\b|\bEnabled\b|\bLists?\b/gi, '') // Remove 'is', 'Enabled', 'List' (case-insensitive, supports 'List' & 'Lists')
      .trim(); // Remove any leading/trailing spaces
}

// Function to get button styles
function getButtonStyles() {
  return `
    padding: 10px 10px;
    background-color: #22002244;
    color: #ffffff66;
    border: 1px solid #cccccc66;
    justify-self: stretch;
    text-align: center;
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

// Helper function to manage session storage
function managesessionStorage(action, conversations = []) {
  const storageKey = 'conversations';
  if (action === 'get') {
    return JSON.parse(sessionStorage.getItem(storageKey)) || [];
  } else if (action === 'set') {
    sessionStorage.setItem(storageKey, JSON.stringify(conversations));
  }
}

function removeObjectWithId(arr, id) {
  const arrCopy = Array.from(arr);
  const objWithIdIndex = arrCopy.findIndex((obj) => obj.id === id);
  arrCopy.splice(objWithIdIndex, 1);
  return arrCopy;
}

function validateListItems() {
  const listItems = document.querySelectorAll('li[data-testid]');
  listItems.forEach((item) => {
    const button = item.querySelector('button');
    if (!button) {
      console.error(
          `List item with ID ${item.getAttribute('data-id')} is missing a button.`
      );
    }
  });
}

function initializeButtonClickListeners() {
  const listContainer = document.querySelector('.group\\/sidebar');
  if (!listContainer) return;

  listContainer.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) {
      handleButtonClick(button);
    }
  });
}

function handleButtonClick(button) {
  const buttonId = button.id || button.getAttribute('data-testid') || 'No ID';
  console.log(`Button with ID ${buttonId} was clicked!`);

  // Reset the countdown
  if (isPaused) {
    pauseTimeLeft = 30; // Reset the countdown to 30 seconds
    console.log('Countdown reset to 30 seconds');
  } else {
    togglePause(pauseButton);
  }

  if (buttonId === 'No ID') {
    console.warn(
        'Button clicked without an ID. Ensure all buttons are assigned unique IDs.'
    );
  }
}

// Function to render LaTeX equations using KaTeX
function renderLaTeX() {
  const blockRegex = /\\\[\s*(.*?)\s*\\\]/g; // Matches \[ ... \]
  const inlineRegex = /\\\(\s*(.*?)\s*\\\)/g; // Matches \( ... \]
  const dollarRegex = /\$\s*(.*?)\s*\$/g; // Matches $ ... $
  const doubleDollarRegex = /\$\$\s*(.*?)\s*\$\$/g; // Matches $$ ... $$

  const textNodes = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
  );
  let node;

  while ((node = textNodes.nextNode())) {
    const parent = node.parentNode;

    // Skip if already rendered by KaTeX
    if (parent.tagName === 'SPAN' && parent.classList.contains('katex'))
      continue;

    let text = node.nodeValue;
    let updatedText = text;

    // Replace LaTeX expressions
    updatedText = updatedText.replace(blockRegex, (_, latex) => {
      const div = document.createElement('div');
      try {
        div.setAttribute('data-original', `\\[${latex}\\]`); // Store original LaTeX
        katex.render(latex, div, { displayMode: true });
        return div.outerHTML;
      } catch (error) {
        console.error('KaTeX Block Render Error:', error, latex);
        return `Error: ${latex}`;
      }
    });

    updatedText = updatedText.replace(inlineRegex, (_, latex) => {
      const span = document.createElement('span');
      try {
        span.setAttribute('data-original', `\\(${latex}\\)`); // Store original LaTeX
        katex.render(latex, span, { displayMode: false });
        return span.outerHTML;
      } catch (error) {
        console.error('KaTeX Inline Render Error:', error, latex);
        return `Error: ${latex}`;
      }
    });

    updatedText = updatedText.replace(doubleDollarRegex, (_, latex) => {
      const span = document.createElement('span');
      try {
        span.setAttribute('data-original', `$$${latex}$$`); // Store original LaTeX
        katex.render(latex, span, { displayMode: false });
        return span.outerHTML;
      } catch (error) {
        console.error('KaTeX Double Dollar Render Error:', error, latex);
        return `Error: ${latex}`;
      }
    });

    updatedText = updatedText.replace(dollarRegex, (_, latex) => {
      const span = document.createElement('span');
      try {
        span.setAttribute('data-original', `$${latex}$`); // Store original LaTeX
        katex.render(latex, span, { displayMode: false });
        return span.outerHTML;
      } catch (error) {
        console.error('KaTeX Dollar Render Error:', error, latex);
        return `Error: ${latex}`;
      }
    });

    if (updatedText !== text) {
      const wrapper = document.createElement('span');
      wrapper.innerHTML = updatedText;
      parent.replaceChild(wrapper, node);
    }
  }
}

function derenderLaTeX() {
  // Find all rendered KaTeX elements
  const renderedElements = document.querySelectorAll('[data-original]');

  if (renderedElements.length === 0) {
    console.log('No LaTeX elements to de-render.'); // Avoid unnecessary logging
    return;
  }

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

function extractProjectId() {
  const url = window.location.href; // Get current URL from the address bar
  const match = url.match(/g-p-[a-f0-9]+/);
  return match ? match[0] : null;
}