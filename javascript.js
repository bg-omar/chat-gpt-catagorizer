let apiLimit = 28; // Matches API's default
let apiOrder = 'updated';
let apiOffset = 0;
let isScriptLoading = false;
let isFetchingMissingData = false;
let shouldFetchMore = true;  // Initially, allow fetching
let isPaused = false;  // Global pause flag
let fetchedConversations = [];
let updatedConversations = [];
let interceptorEnabled = false  // Add this global flag
let hasTokenBeenCaptured = false;
sessionStorage.setItem('apiOffset', apiOffset);

(function () {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [resource, config] = args;
    if (config && config.headers) {
      let token = null;

      // Extract Bearer token from headers
      if (config.headers instanceof Headers && config.headers.has('Authorization')) {
        const authHeader = config.headers.get('Authorization');
        if (authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
      } else if (typeof config.headers === 'object' && config.headers['Authorization']) {
        const authHeader = config.headers['Authorization'];
        if (authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
      }

      if (token) {
        sessionStorage.setItem('authToken', token);  // Store token securely
      }
    }
    return originalFetch.apply(this, args);  // Proceed with other fetch calls
  };
})();

function interceptFetch() {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [resource, config] = args;

    // Bypass interceptor if fetching or disabled
    if (!interceptorEnabled || isFetchingMissingData) {
      return originalFetch.apply(this, args);
    }

    if (typeof resource === "string" && resource.includes("/backend-api/conversations")) {
      console.log(`Intercepting API call: ${resource}`);

      const response = await originalFetch(...args);
      const data = await response.clone().json();  // Clone response for processing
      await originalFetch.apply(this, args);
      console.log("Captured API Data:", data);
      fetchedConversations.push(...data.items);

      // Disable interceptor if all data is fetched
      if (data.offset + data.items.length >= data.total - data.offset) {
        console.log("All data fetched. Disabling interceptor.");
        interceptorEnabled = false;
      }

      // Start fetching missing conversations
      isFetchingMissingData = true;
      await fetchMissingConversations(data);
      isFetchingMissingData = false;
    }

    return originalFetch.apply(this, args);  // Proceed with other fetch calls
  };
}

async function fetchMissingConversations(initialData) {
  sessionStorage.setItem('apiOffset', (initialData.offset + initialData.limit));
  const totalData = initialData.total;
  const token = sessionStorage.getItem("authToken");

  if (!token) {
    console.error("Bearer token not found.");
    return;
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  while (apiOffset < (totalData + apiLimit) && interceptorEnabled) {
    try {
      if (shouldFetchMore) {
        console.log("Fetching at apiOffset:", apiOffset);
        apiOffset = parseInt(sessionStorage.getItem('apiOffset'), 10) || 0;
        const response = await fetch(
            `/backend-api/conversations?offset=${apiOffset}&limit=${apiLimit}&order=${apiOrder}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error("Failed to fetch conversations");

        const data = await response.json();
        console.log("Fetched API Data:", data);

        if (data.items.length === 0) {
          console.log("No more conversations to fetch.");
          break;
        }

        apiOffset += apiLimit;
        fetchedConversations.push(...data.items)
        sessionStorage.setItem('apiOffset', apiOffset);
        console.log("All fetchedConversations: ", fetchedConversations);


        // After fetching new conversations
        const fetchedData = JSON.parse(sessionStorage.getItem("fetchedData")) || [];
        const updatedData = [...fetchedData, ...data.items].filter(
            (item, index, array) =>
                array.findIndex((i) => i.id === item.id) === index
        );
        sessionStorage.setItem("fetchedData", JSON.stringify(updatedData));

        console.log("Fetched Conversations Updated:", updatedData.length);

        // Reset flags when fetching completes
        if (apiOffset >= (totalData + apiLimit)) {
          console.log("Fetching completed. Resetting flags.");
          interceptorEnabled = false;
          isFetchingMissingData = false;
          shouldFetchMore = false;  // Prevents unnecessary calls
          startRepeater();
        }  else {
          await delay(2000);  // Slow down the loop
        }
      }
    } catch (error) {
      console.error("Error fetching additional conversations:", error);
      break;
    }
  }
  updatedConversations = fetchedConversations.items.map(item => ({
    ...item,
    update_time: item.update_time ? new Date(item.update_time) : null,
  }));
  managesessionStorage('set', updatedConversations);
  startRepeater(); // Toggle the repeater
}


document.addEventListener('DOMContentLoaded', async () => {
  await interceptFetch();
  repeater();
  addSidebarToggleListeners();
  initializeMutationObserver();
  initializeButtonClickListeners();
});


function repeater() {
  console.log(`repeater is starting!`);
  if (isPaused) return;  // Prevent restarting if paused
  setInterval(async () => {
    console.log(`Interval 2 is starting!`);
    console.log("%c 3 --> Line: 160||javascript.js\n isPaused: ","color:#ff0;", isPaused);
    console.log("%c 4 --> Line: 161||javascript.js\n shouldFetchMore: ","color:#f00;", shouldFetchMore);
    if (!isPaused && !shouldFetchMore) {

      try {
        await checkAndReplaceText();
        await sortLists();
      } catch (e) {
        console.error("Error in checkAndReplaceText interval after timeout:", e);
      }
    }
  }, 10000);
}


function checkAndReplaceText()  {
  console.log(`checkAndReplaceText is starting!`);
  const divElements = document.querySelectorAll('.relative.grow.overflow-hidden.whitespace-nowrap');
  if (divElements.length === 0) return;

  const processedIds = new Set(); // Track processed elements
  const colors = [
    '#f0f', '#FF7E00', '#64edd3', '#0f0', '#3cc', '#ff0', '#f00', '#0ff', '#336699',
    'gray', 'silver', '#CC99FF', '#6633FF', '#66FF99', '#FF6633', '#66CCCC', '#33CC33',
    'red', 'purple', 'green', 'lime', 'olive', 'yellow', 'blue', 'teal', 'aqua',
  ];
  let colorIndex = 0;
  let wordColors = {};
  let conversations;
  try {
    wordColors = JSON.parse(sessionStorage.getItem('wordColors')) || {};
    conversations = managesessionStorage('get') || {};
  } catch (e) {
    console.error("Error parsing wordColors from sessionStorage:", e);
    wordColors = {};
  }

  divElements.forEach((divElement) => {
    if (divElement.querySelector('span')) return;

    let textContent = divElement.textContent;
    let date;
    let id;
    //console.log(textContent);
    conversations.forEach((item)  => {
      if (item.title == textContent){
        date = item.update_time
        id = item.id
      }});
    //console.log("date: ", date);
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
      divElement.closest('li')?.setAttribute('data-date',date);
      divElement.closest('li')?.setAttribute('data-id', id);
    }

    divElement.innerHTML = newText;
  });

  // Save updated color assignments to sessionStorage
  try {
    sessionStorage.setItem('wordColors', JSON.stringify(wordColors));
  } catch (e) {
    console.error("Error saving wordColors to sessionStorage:", e);
  }
}

function olListsCategorization(olListsToCategorize, totalitems, processedItems, conversations, categories, uncategorizedItems) {
  let processedItems1 = new Set();
  olListsToCategorize.forEach((ol) => {
    ol.setAttribute('style', 'display: block;');
    console.log("ol: ", ol);
    const listItems = ol.querySelectorAll('li');
    listItems.forEach((item) => {
      totalitems++
      if (processedItems.has(item)) return;

      const category = item.getAttribute('data-category');
      let dateStr = item.getAttribute('data-date');
      const dataId = item.getAttribute('data-id');


      let date2;
      getConversations.forEach((item2) => {
        if (dataId === item2.id) {
          console.log("%c 1 --> Line: 226||javascript.js\n dataId === item.id: ","color:#f0f;", dataId === item2.id);
          date2 = dateStr ? new Date(dateStr) : new Date(item2.update_time);
          console.log("%c 1 --> Line: 229||javascript.js\n date2: ","color:#f0f;", date2);
          item.setAttribute("data-date", date2);
        }
      })
      conversations = removeObjectWithId(conversations, dataId);
      if (category) {
        if (!categories[category]) categories[category] = [];
        categories[category].push({item, date2});
      } else {
        uncategorizedItems.push({item, date2});
      }
      console.log("item: ", item);
      processedItems.add(item);
      processedItems1.add(item);

    });
    console.log("%c 2 --> Line: 242||javascript.js\n processedItems1: ","color:#0f0;", processedItems1);
  });
  sessionStorage.setItem("processedItems1", processedItems1);
  return conversations;
}

function processOrphans(conversations, olElement, processedItems, uncategorizedItems) {
  let processedItems2 = new Set();
  let orphans = 0;
  if (conversations && conversations.length > 0) {
    conversations.forEach((conversation) => {
      const dateStr = conversation.update_time;
      const fallbackDate = new Date(0); // Epoch time for missing dates
      const date = dateStr ? new Date(dateStr) : fallbackDate;
      orphans++
      const li = document.createElement('li');
      li.className = "relative";
      li.setAttribute("data-testid", `history-item-${orphans}`);
      //li.setAttribute("data-category", `Uncategorized`);
      li.setAttribute("data-date", date);
      li.setAttribute("data-id", `${conversation.id}`);

      li.innerHTML = `
        <div class="no-draggable group relative rounded-lg active:opacity-90 bg-token-sidebar-surface-secondary">
          <a class="flex items-center gap-2 p-2" data-discover="true" href="/c/${conversation.id}">
            <div class="relative grow overflow-hidden whitespace-nowrap" dir="auto" title="${conversation.title}">
              ${conversation.title}
            </div>
          </a>
        </div>
      `;

      console.log("li: ", li);
      olElement.appendChild(li);
      processedItems.add(li);
      processedItems2.add(li);
    });
    console.log("%c 2 --> Line: 242||javascript.js\n processedItems2: ","color:#0f0;", processedItems2);
  }
  sessionStorage.setItem("processedOrphans", processedItems2);
  console.log("orphan item: ", orphans, "uncategorizedItems: ", uncategorizedItems, "processedItems: ", processedItems);
}



function sortingItems(categories) {
  // Sort items within categories by date (ascending order)
  for (const category in categories) {
    categories[category].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date - a.date;
    });
  }
}

function uncatagorizedCatagory(uncategorizedItems) {
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
  return uniqueUncategorizedItems;
}

function sortLists()  {
  console.log(`sortLists is starting!`);
  const categories = {};
  const uncategorizedItems = [];
  const singleItems = []; // To collect single item categories
  const listContainer = document.querySelector('.flex.flex-col.gap-2.pb-2');
  if (!listContainer) return;

  const originalOlLists = listContainer.querySelectorAll('ol');
  const olListsToCategorize = Array.from(originalOlLists);

  // Clear processedItems set to reflect the latest DOM structure
  let processedItems = new Set();
  let wordColors = {};
  let sessionConversations;
  try {
    wordColors = JSON.parse(sessionStorage.getItem('wordColors')) || {};
    getConversations = managesessionStorage('get') || {};
    sessionConversations = Array.from(getConversations);
  } catch (e) {
    console.error('Error parsing wordColors from sessionStorage:', e);
  }

  let totalitems = 0;

  sessionConversations = olListsCategorization(olListsToCategorize, totalitems, processedItems, sessionConversations, categories, uncategorizedItems);


  if (!olListsToCategorize[0]) {  // Create <ol> if it doesn't exist
    olElement = document.createElement('ol');
    olListsToCategorize.appendChild(olElement);
  }
  let olElement = olListsToCategorize[0];

  processOrphans(sessionConversations, olElement, processedItems, uncategorizedItems);
  sessionStorage.setItem("processedItemsAll", processedItems);
  sortingItems(categories);
  const uniqueUncategorizedItems = uncatagorizedCatagory(uncategorizedItems);

  // Create a document fragment to hold new categorized <ol> elements
  const fragment = document.createDocumentFragment();

  // Create "Uncategorized" section first
  if (uniqueUncategorizedItems.length > 0) {
    const uncategorizedOlContainer = createCategoryContainer('Uncategorized',
        uniqueUncategorizedItems.map((itemObj) => itemObj.item)
    );
    fragment.appendChild(uncategorizedOlContainer);
  }

  // Separate out single-item categories
  const sortedCategories = [];
  for (const category in categories) {
    if (categories[category].length === 1) {
      singleItems.push(...categories[category]);
    } else {
      // Store categories along with the earliest date in their items
      const earliestDate = categories[category]
          .filter(item => item.date instanceof Date && !isNaN(item.date))
          .reduce((earliest, current) => (!earliest || current.date < earliest ? current.date : earliest), null);

      console.log("Earliest Date for category:", category, earliestDate);

      const mostRecentDate = categories[category]
          .filter(item => item.date instanceof Date && !isNaN(item.date))
          .reduce((mostRecent, current) => (!mostRecent || current.date > mostRecent ? current.date : mostRecent), null);

      sortedCategories.push({
        category,
        items: categories[category].map((itemObj) => itemObj.item),
        earliestDate: mostRecentDate, // Now reflects the most recent date
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

// Sort categories by the earliest date among their items (ascending order)
  sortedCategories.sort((a, b) => {
    const dateA = a.earliestDate || new Date(0); // Fallback to earliest possible date if undefined
    const dateB = b.earliestDate || new Date(0);
    return dateB - dateA; // For descending order, use `dateB - dateA`
  });

  //console.log("Sorted categories by earliest date:", sortedCategories);

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
  initializeButtonClickListeners();
  reinitializeDropdowns();
}


function removeDuplicateItems(categoryItems) {
  const seenIds = new Set();
  return categoryItems.filter((itemObj) => {
    const itemId = itemObj.item.getAttribute("data-id");
    if (!itemId || seenIds.has(itemId)) return false;
    seenIds.add(itemId);
    return true;
  });
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

  // Add collapsibility to the category header
  const collapseIcon = document.createElement('span');
  let isCollapsed = true;
  JSON.parse(localStorage.getItem(`categoryState_${category}`)) === undefined
      ? localStorage.setItem(`categoryState_${category}`, JSON.stringify(true))
      : isCollapsed = JSON.parse(localStorage.getItem(`categoryState_${category}`));
  collapseIcon.textContent = isCollapsed ? '[+]' : '[-]';
  collapseIcon.style.marginRight = '10px';
  collapseIcon.style.cursor = 'pointer';

  categoryHeader.prepend(collapseIcon);
  categoryHeader.style.cursor = 'pointer';
  newOlContainer.appendChild(categoryHeader);
  const newOl = document.createElement('ol');
  newOl.style.display = isCollapsed ? 'none' : 'block';
  items.forEach((item) => {
    if (document.body.contains(item)) {
      // Check if item is still in DOM
      newOl.appendChild(item);
    }
  });

  // Toggle collapse/expand on click
  categoryHeader.addEventListener('click', () => {
    if (newOl.style.display === 'none') {
      newOl.style.display = 'block';
      collapseIcon.textContent = '[-]';
      localStorage.setItem(`categoryState_${category}`, JSON.stringify(false));
    } else {
      newOl.style.display = 'none';
      collapseIcon.textContent = '[+]';
      localStorage.setItem(`categoryState_${category}`, JSON.stringify(true));
    }
  });
  newOlContainer.appendChild(newOl);
  return newOlContainer;
}

function initializeMutationObserver() {
  const targetNode = document.querySelector('.relative.grow.overflow-hidden.whitespace-nowrap');
  const config = { childList: true, subtree: true, characterData: true };

  const callback = (mutationsList) => {
    // Use a flag to prevent recursive triggering of the observer
    let isObserving = true;

    for (let mutation of mutationsList) {
      if ((mutation.type === 'childList' || mutation.type === 'characterData') && isObserving) {
        isObserving = false;
        try {
          checkAndReplaceText();
        } catch (e) {
          console.error("Error in mutation callback:", e);
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

function initializeButtonClickListeners() {
  const listContainer = document.querySelector('.flex.flex-col.gap-2.pb-2');
  if (!listContainer) return;

  listContainer.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) {
      handleButtonClick(button);
    }
  });
}

// Helper function to manage local storage
function managesessionStorage(action, conversations = []) {
  const storageKey = 'conversations';
  if (action === 'get') {
    return JSON.parse(sessionStorage.getItem(storageKey)) || [];
  } else if (action === 'set') {
    sessionStorage.setItem(storageKey, JSON.stringify(conversations));
    localStorage.setItem(storageKey, JSON.stringify(conversations));
  }
}

function removeObjectWithId(arr, id) {
  const arrCopy = Array.from(arr);
  const objWithIdIndex = arrCopy.findIndex((obj) => obj.id === id);
  arrCopy.splice(objWithIdIndex, 1);
  return arrCopy;
}

function removeItemOnce(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

function removeItemAll(arr, value) {
  var i = 0;
  while (i < arr.length) {
    if (arr[i] === value) {
      arr.splice(i, 1);
    } else {
      ++i;
    }
  }
  return arr;
}

// Helper function to merge and clean conversations (removes duplicates)
function mergeAndCleanConversations(existingConversations, newConversations) {
  const combinedConversations = [...existingConversations, ...newConversations];
  return removeDuplicates(combinedConversations);
}

// Helper function to remove duplicates based on the conversation ID
function removeDuplicates(conversations) {
  const uniqueConversations = [];
  const seenIds = new Set();

  conversations.forEach((conversation) => {
    if (!seenIds.has(conversation.id)) {
      seenIds.add(conversation.id);
      uniqueConversations.push(conversation);
    }
  });

  return uniqueConversations;
}

function addTitleBanner() {
  const existingBanner = document.querySelector("#title-banner");
  if (existingBanner) existingBanner.remove();
  // Extract the item ID from the URL
  const currentItemId = new URL(window.location.href).pathname.split("/c/")[1];
  if (!currentItemId) return;

  // Fetch stored conversations
  const conversations = managesessionStorage("get") || [];
  const currentConversation = conversations.find(
      (item) => item.id === currentItemId
  );

  // If no matching conversation is found, skip
  if (!currentConversation) return;

  // Create the title banner
  const banner = document.createElement("div");
  banner.id = "title-banner";
  banner.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 0;
    height: 50px;
    color: white;

    margin: 0 25%;
    font-size: 1.125rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    text-shadow: 3px 3px #303;
  `;
  banner.textContent = currentConversation.title;

  // Add the banner to the document
  document.body.prepend(banner);
}

function handleButtonClick(button) {
  console.log(`Button with ID ${button.id} was clicked!`);

  // Pause logic
  if (!isPaused) {
    isPaused = true;
    toggleRepeater(); // Toggle the repeater
    console.log("Script paused.");

    // Resume after a delay
    setTimeout(() => {
      isPaused = false;
      startRepeater();  // Restart the repeater
      console.log("Script resumed.");
    }, 60000); // Adjust delay as needed (in milliseconds)
  }
}

function reinitializeDropdowns() {
  document.querySelectorAll('[data-radix-menu-content]').forEach(dropdown => {
    // Custom initialization or reattachment logic as needed by the dropdown library
  });
}


function addSidebarToggleListeners() {
  const closeButton = document.querySelector('[data-testid="close-sidebar-button"]');


  // Attach event listeners if buttons are found
  if (closeButton) {
    closeButton.addEventListener('click', handleSidebarToggle);
  }

}

// Handle the sidebar toggle event
function handleSidebarToggle(event) {
  const button = event.target.closest('button');

  // Check if the sidebar is closing or opening
  if (button?.dataset?.testid === "close-sidebar-button") {
    console.log("Sidebar closing. Pausing the script...");
    stopRepeater();  // Pause the repeater
  } else if (button?.getAttribute("aria-label") === "Open sidebar") {
    console.log("Sidebar opening. Resuming the script...");
    startRepeater();  // Restart the repeater
  }

  document.body.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    const targetDiv = event.target.closest('.flex.items-center.gap-0.overflow-hidden');

    if (button) {
      console.log(`Button clicked: ${button.outerHTML}`);
      handleButtonClick(button); // Call existing button logic
    }

    if (targetDiv) {
      console.log(`Target Div clicked: ${targetDiv.outerHTML}`);
      toggleRepeater(); // Pause/resume on div clicks
    }
  });
}

function toggleRepeater() {
  if (isPaused) {
    startRepeater(); // Resume if paused
  } else {
    stopRepeater();  // Pause if running
  }
}

// Function to start the repeater
function startRepeater() {
  shouldFetchMore = false;  // Prevents unnecessary calls
  if (isPaused) {
    isPaused = false;
    repeater();  // Call the repeater function to restart
    console.log("Repeater resumed.");
  }
}

// Function to stop the repeater
function stopRepeater() {
  isPaused = true;
  console.log("Repeater paused.");
}