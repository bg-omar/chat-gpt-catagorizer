let isScriptEnabled = JSON.parse(sessionStorage.getItem('isScriptEnabled')) || true; // Default state
let isScrollEnabled = JSON.parse(sessionStorage.getItem('isScrollEnabled')) || true; // Default state
let isSortListsEnabled = false;
sessionStorage.setItem('isSortListsEnabled', JSON.stringify(false)) ; 

let dataTotal  = JSON.parse(sessionStorage.getItem('dataTotal')) || 0;
let shouldFetchMore = true; // Initially, allow fetching
let apiOffset = 0;

(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [resource, config] = args;

    const response = await originalFetch(...args);

    // Intercept the API calls for conversations
    if (typeof resource === "string" && resource.includes("/backend-api/conversations")) {
      const clonedResponse = response.clone(); // Clone the response to read it without consuming it
      const data = await clonedResponse.json();
  
      sessionStorage.setItem('dataTotal', JSON.stringify(data.total)) ; // Default state
      // Store the API data in localStorage
      const existingData = JSON.parse(sessionStorage.getItem("conversations")) || [];
      const newConversations = data.items.map((item) => ({
        ...item,
        update_time: item.update_time ? new Date(item.update_time) : null,
      }));

      const mergedConversations = mergeAndCleanConversations(existingData, newConversations);
      sessionStorage.setItem("conversations", JSON.stringify(mergedConversations));
      sessionStorage.setItem("apiOffset", JSON.stringify(apiOffset));
      // Save the offset to avoid re-fetching the same data
      apiOffset = data.offset + data.limit;
    }

    return response;
  };
})();

document.addEventListener('DOMContentLoaded', () => {
    setStates();
    repeater();
    initializeMutationObserver();
    initializeButtonClickListeners();
});
let isPaused = false; // New variable for pause state
let pauseTimeout = null; // To track the timeout for the pause

// Attach the pause toggle and other buttons to the DOM
document.addEventListener('DOMContentLoaded', () => {
  // Create container for the buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  // Create the "Pause Repeater" button
  const pauseButton = document.createElement('button');
  pauseButton.textContent = 'Pause Repeater';
  pauseButton.style.cssText = getButtonStyles();
  pauseButton.addEventListener('click', togglePause);

  // Create the "Toggle Script Enabled" button
  const scriptButton = document.createElement('button');
  scriptButton.textContent = 'Toggle Script Enabled';
  scriptButton.style.cssText = getButtonStyles();
  scriptButton.addEventListener('click', () => {
    isScriptEnabled = !isScriptEnabled;
    sessionStorage.setItem('isScriptEnabled', JSON.stringify(isScriptEnabled));
    console.log('Script Enabled:', isScriptEnabled);
  });

  // Create the "Toggle Scroll Enabled" button
  const scrollButton = document.createElement('button');
  scrollButton.textContent = 'Toggle Scroll Enabled';
  scrollButton.style.cssText = getButtonStyles();
  scrollButton.addEventListener('click', () => {
    isScrollEnabled = !isScrollEnabled;
    sessionStorage.setItem('isScrollEnabled', JSON.stringify(isScrollEnabled));
    console.log('Scroll Enabled:', isScrollEnabled);
  });

  // Create the "Toggle Sort Lists Enabled" button
  const sortListsButton = document.createElement('button');
  sortListsButton.textContent = 'Toggle Sort Lists Enabled';
  sortListsButton.style.cssText = getButtonStyles();
  sortListsButton.addEventListener('click', () => {
    isSortListsEnabled = !isSortListsEnabled;
    sessionStorage.setItem('isSortListsEnabled', JSON.stringify(isSortListsEnabled));
    console.log('Sort Lists Enabled:', isSortListsEnabled);
  });

  // Append buttons to the container
  buttonContainer.appendChild(pauseButton);
  buttonContainer.appendChild(scriptButton);
  buttonContainer.appendChild(scrollButton);
  buttonContainer.appendChild(sortListsButton);

  // Add the container to the document body
  document.body.appendChild(buttonContainer);
});

// Function to get button styles
function getButtonStyles() {
  return `
    padding: 10px 20px;
    background-color: #202;
    color: #fff;
    border: 1px solid #ccc;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
  `;
}

// Function to toggle pause state
function togglePause() {
  if (isPaused) return; // Prevent repeated activations

  isPaused = true;
  console.log('Repeater paused');

  // Set timeout to resume after 30 seconds
  pauseTimeout = setTimeout(() => {
    isPaused = false;
    console.log('Repeater resumed');
  }, 30000);
}


// Attach the pause toggle to a button
document.addEventListener('DOMContentLoaded', () => {
  const pauseButton = document.createElement('button');
  pauseButton.textContent = 'Pause Repeater';
  pauseButton.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    padding: 10px 20px;
    background-color: #202;
    color: #fff;
    border: 1px solid #ccc;
    border-radius: 5px;
    cursor: pointer;
  `;
  pauseButton.addEventListener('click', togglePause);
  document.body.appendChild(pauseButton);
});

function repeater() {
  const firstSort = setInterval(async () => {
    if (isPaused) return; // Skip execution if paused
    try {
      await getStates();
      if (isScrollEnabled) {
        await triggerScrollAndEvent();
      }
      if (isScriptEnabled) {
        await addTitleBanner();
        await checkAndReplaceText();
      }
      if (isSortListsEnabled) {
        await sortLists();
        await validateListItems();
      }
      await setStates();
    } catch (e) {
      console.error('Error in sortLists interval:', e);
    }
  }, 5000);

  if (apiOffset > dataTotal) {
    clearInterval(firstSort);
    setInterval(async () => {
      if (isPaused) return; // Skip execution if paused
      try {
        await getStates();
        if (isScrollEnabled) {
          await triggerScrollAndEvent();
        }
        if (isScrollEnabled) {
          await addTitleBanner();
          await checkAndReplaceText();
        }
        if (isSortListsEnabled) {
          await sortLists();
          await validateListItems();
        }
        await setStates();
      } catch (e) {
        console.error(
          'Error in checkAndReplaceText interval after timeout:',
          e
        );
      }
    }, 90000);
  }
}


function getStates() {
     isScriptEnabled = JSON.parse(sessionStorage.getItem('isScriptEnabled')); 
     isScrollEnabled = JSON.parse(sessionStorage.getItem('isScrollEnabled')); 
     isSortListsEnabled = JSON.parse(sessionStorage.getItem('isSortListsEnabled')) ; 
     apiOffset = JSON.parse(sessionStorage.getItem('apiOffset')); 
     dataTotal = JSON.parse(sessionStorage.getItem('dataTotal'));
}

function setStates() {
    sessionStorage.setItem('isScriptEnabled', JSON.stringify(isScriptEnabled));
    sessionStorage.setItem('isScrollEnabled', JSON.stringify(isScrollEnabled));
    sessionStorage.setItem('isSortListsEnabled', JSON.stringify(isSortListsEnabled));
}

function triggerScrollAndEvent() {
  // Find the scrolling container
  const scrollContainer = document.querySelector(
      '.flex-col.flex-1.transition-opacity.duration-500.relative.-mr-2.pr-2.overflow-y-auto'
  );

  if (!scrollContainer) {
    console.error('Scrolling container not found.');
    return;
  }

  if (apiOffset < (JSON.parse(sessionStorage.getItem('dataTotal')))) {
    // Check if the container can scroll further
    if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight) {
      // If at the bottom, scroll back to the top
      scrollContainer.scrollTop = 0;
      // Dispatch the scroll event to trigger the website's fetching logic
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      console.log(scrollContainer.scrollTop, scrollContainer.scrollHeight)
    }
    // Otherwise, scroll down by a fixed amount
    scrollContainer.scrollTop += 300; // Scroll down by 300px (adjust as needed)
    // Dispatch the scroll event to trigger the website's fetching logic
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    console.log(scrollContainer.scrollTop, scrollContainer.scrollHeight)
  } else {
    isScrollEnabled = false;
    isSortListsEnabled = true;
  }
}

function waitForContainerToLoad(callback, maxRetries = 50, retryCount = 0) {
  const container = document.querySelector('.relative.mt-5.first\\:mt-0.last\\:mb-5');
  if (container) {
    console.log('Container loaded.');
    callback();
  } else if (retryCount < maxRetries) {
    console.log('Waiting for container...');
    setTimeout(() => waitForContainerToLoad(callback, maxRetries, retryCount + 1), 100);
  } else {
    console.error('Max retries reached. Container not found.');
  }
}

function createListItem(conversation, index) {
  const li = document.createElement('li');
  li.className = "relative";
  li.setAttribute("data-testid", `history-item-${index}`);
  li.setAttribute("data-date", conversation.update_time);
  li.setAttribute("data-id", conversation.id);

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

function checkAndReplaceText() {

  const divElements = document.querySelectorAll(
      '.relative.grow.overflow-hidden.whitespace-nowrap'
  );
  if (divElements.length === 0) return;

  const colors = [
    '#f0f', '#FF7E00', '#64edd3', '#0f0', '#3cc', '#ff0', '#f00', '#0ff',
    '#336699', 'gray', 'silver', '#CC99FF', '#6633FF', '#66FF99', '#FF6633',
    '#66CCCC', '#33CC33', 'red', 'purple', 'green', 'lime', 'olive', 'yellow',
    'blue', 'teal', 'aqua', '#FFC0CB', '#8A2BE2', '#5F9EA0', '#7FFF00',
    '#DC143C', '#00FFFF', '#FFD700', '#ADFF2F', '#4B0082', '#FF4500',
    '#DA70D6', '#EE82EE', '#20B2AA', '#BA55D3', '#4682B4', '#D2691E',
    '#40E0D0', '#6A5ACD', '#B22222', '#808000', '#708090', '#8B4513',
    '#FF1493', '#00FA9A', '#B0C4DE', '#F5DEB3', '#00CED1'
  ];
  let colorIndex = 0;
  let wordColors = {};
  let conversations;
  try {
    wordColors = JSON.parse(sessionStorage.getItem('wordColors')) || {};
    conversations = managesessionStorage('get') || {};
  } catch (e) {
    console.error('Error parsing wordColors from sessionStorage:', e);
    wordColors = {};
  }

  divElements.forEach((divElement) => {
    let textContent = divElement.textContent;
    conversations.forEach((item) => {
      if (item.title === textContent) {
        console.log("update_time: ", item.update_time.trim(), "id: ", item.id.trim());
        divElement.closest('li')?.setAttribute('data-date', item.update_time.trim());
        divElement.closest('li')?.setAttribute('data-id', item.id.trim());
      }
    });

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

function collectSingleItems(categories, singleItems, fragment) {
    if(!isSortListsEnabled) return;
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

      console.log('Most Recent Date for category:', category, mostRecentDate);
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

function sortLists() {
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
    let conversations;

    try {
      wordColors = JSON.parse(sessionStorage.getItem('wordColors')) || {};
      getConversations = managesessionStorage('get') || {};
      conversations = Array.from(getConversations);
    } catch (e) {
      console.error('Error parsing wordColors from sessionStorage:', e);
    }

    let totalitems = 0;
    // console.log("olListsToCategorize: ", olListsToCategorize);
    olListsToCategorize.forEach((ol) => {
      ol.setAttribute('style', 'display: block;');
      // console.log("ol: ", ol);
      const listItems = ol.querySelectorAll('li');
      listItems.forEach((item) => {
        totalitems++;
        if (processedItems.has(item)) return;
        // console.log("%c 5 --> Line: 312||javascript.js\n item: ", "color:#0ff;", item);
        const category = item.getAttribute('data-category');
        let dateStr = item.getAttribute('data-date');
        const dataId = item.getAttribute('data-id');
        // console.log("%c 5 --> Line: 316||javascript.js\n item: ", "color:#0ff;", item);
        let date2;
        getConversations.forEach((item) => {
          if (dataId === item.id) {
            date2 = new Date(item.update_time);
          }
        });
        if (dateStr !== undefined) {
          conversations = removeObjectWithId(conversations, dataId);
          // console.log("conversation removed: ", conversations.length, dataId);
        }
        // console.log("%c 5 --> Line: 327||javascript.js\n item: ", "color:#0ff;", item);
        const fallbackDate = (date2 !== undefined) ? date2 : new Date(0); // Epoch time for missing dates
        const date = (date2 !== undefined)
            ? date2
            : dateStr
                ? new Date(dateStr)
                : fallbackDate;
        // console.log("%c 5 --> Line: 334||javascript.js\n item: ", "color:#0ff;", item);
        if (category) {
          if (!categories[category]) categories[category] = [];
          categories[category].push({item, date});
        } else {
          uncategorizedItems.push({item, date});
        }
        // console.log("processedItems added: ", item);
        processedItems.add(item);
      });
    });
    // console.log('olListsToCategorize: ', olListsToCategorize);

    // Ensure there's an <ol> element in the container.
    if (!olListsToCategorize[0]) {
      // Create <ol> if it doesn't exist
      olElement = document.createElement('ol');
      olListsToCategorize.appendChild(olElement);
    }
    let olElement = olListsToCategorize[0];

    let orphans = 0;
    if (conversations && conversations.length > 0) {
      processOrphans(conversations, olElement);
    }
    // console.log("orphan item: ", orphans);
    // console.log("uncategorizedItems: ", uncategorizedItems);
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
    const sortedCategories = collectSingleItems(categories, singleItems, fragment);

    // Sort categories by the earliest date among their items (ascending order)
    sortedCategories.sort((a, b) => {
      const dateA = a.mostRecentDate || new Date(0); // Fallback to earliest possible date if undefined
      const dateB = b.mostRecentDate || new Date(0);
      return dateB - dateA; // For descending order, use `dateB - dateA`
    });

    console.log('Sorted categories by earliest date:', sortedCategories);

    // Clear and sort the fragment

    // Create categorized lists based on sorted categories and append them in order
    sortedCategories.forEach(({category, items}) => {
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

function addTitleBanner() {
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

  // Check if the banner already exists
  let banner = document.getElementById("title-banner");

  // Retrieve colors from sessionStorage
  let wordColors = {};
  try {
    wordColors = JSON.parse(sessionStorage.getItem("wordColors")) || {};
  } catch (e) {
    console.error("Error parsing wordColors from sessionStorage:", e);
    wordColors = {};
  }

  // Apply coloring logic to the title
  const regex = /\b(\w+)\b/g; // Match words
  let coloredTitle = currentConversation.title.replace(regex, (match) => {
    if (wordColors[match]) {
      return `<span style="color: ${wordColors[match]}; border: 1px dotted ${wordColors[match]}">${match}</span>`;
    }
    return match; // Leave words without a matching color unstyled
  });

  // If banner exists, update its content; otherwise, create a new one
  if (banner) {
    banner.innerHTML = coloredTitle;
  } else {
    banner = document.createElement("div");
    banner.id = "title-banner";
    banner.style.cssText = `
      position: fixed;
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      width: 100%;
      padding: 0 20px;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 0 20px 0 rgba(14, 0, 18, 0.6);
      border: 1px dotted;
      background-color: #202;
      white-space: nowrap;
    `;
    banner.innerHTML = coloredTitle;

    // Add the banner to the document
    document.body.prepend(banner);
  }
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
      : (isCollapsed = JSON.parse(
          localStorage.getItem(`categoryState_${category}`)
      ));
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
  const targetNode = document.querySelector(
      '.relative.grow.overflow-hidden.whitespace-nowrap'
  );

  const config = {childList: true, subtree: true, characterData: true};

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
          // Check and replace text and sort after DOM changes
          //reinitializeHoverStates();
          checkAndReplaceText();
          sortLists();
          //validateListItems();

          // Handle chat renames
          //renameChatHandler(mutation);
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




function reinitializeDropdowns() {
  document.querySelectorAll('[data-radix-menu-content]').forEach((dropdown) => {
    // Custom initialization or reattachment logic as needed by the dropdown library
  });
  document.querySelectorAll('[data-testid$="-options"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const dropdown = button.closest('li').querySelector('.dropdown-menu');
      if (dropdown) {
        dropdown.style.display =
            dropdown.style.display === 'block' ? 'none' : 'block';
      }
    });
  });
}

// Helper function to manage local storage
function managesessionStorage(action, conversations = []) {
  const storageKey = 'conversations';
  if (action === 'get') {
    return JSON.parse(sessionStorage.getItem(storageKey)) || [];
  } else if (action === 'set') {
    sessionStorage.setItem(storageKey, JSON.stringify(conversations));
  }
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
      console.error(`List item with ID ${item.getAttribute('data-id')} is missing a button.`);
    }
  });
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

function handleButtonClick(button) {
  const buttonId = button.id || "No ID";
  console.log(`Button with ID ${buttonId} was clicked!`);
  

  if (buttonId === "No ID") {
    console.warn("Button clicked without an ID. Ensure all buttons are assigned unique IDs.");
  }
}
