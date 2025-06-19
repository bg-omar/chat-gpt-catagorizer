(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [resource, config] = args;

    if (config?.headers) {
      let token = null;

      if (config.headers instanceof Headers) {
        const authHeader = config.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      } else if (typeof config.headers === 'object') {
        const authHeader = config.headers['Authorization'];
        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }

      if (token) {
        sessionStorage.setItem('authToken', token);
      }
    }

    return originalFetch(...args);
  };
})();

sessionStorage.setItem('apiOffset', 0);
let apiLimit = 56;
let apiOrder = 'updated';
let isScriptLoading = false;
let shouldFetchMore = true;

function createListItem(conversation, index) {
  const li = document.createElement('li');
  li.className = "relative";
  li.setAttribute("data-testid", `history-item-${index}`);
  li.setAttribute("data-date", conversation.update_time);
  li.setAttribute("data-id", conversation.id);

  li.innerHTML = `
    <div draggable="true" class="no-draggable group rounded-lg active:opacity-90 bg-[var(--item-background-color)] h-9 text-sm relative" style="--item-background-color: var(--sidebar-surface-primary);">
      <a class="flex items-center gap-2 p-2" data-discover="true" href="/c/${conversation.id}">
        <div class="relative grow overflow-hidden whitespace-nowrap" dir="auto" title="${conversation.title}">
          ${conversation.title}
        </div>
      </a>
      <div class="absolute bottom-0 top-0 items-center gap-1.5 pr-2 ltr:right-0 rtl:left-0 flex can-hover:group-hover:flex">
        <span data-state="closed">
          <button class="flex items-center justify-center text-token-text-secondary transition hover:text-token-text-primary radix-state-open:text-token-text-secondary" data-testid="history-item-${index}-options" type="button">
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

document.addEventListener('DOMContentLoaded', () => {
  repeater();
  initializeMutationObserver();
  initializeButtonClickListeners();
});

document.addEventListener('DOMContentLoaded', () => {
  // Attach click event listeners to dropdown buttons
  document.querySelectorAll('[data-testid$="-options"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const dropdown = button.closest('li').querySelector('.dropdown-menu');
      if (dropdown) {
        // Toggle dropdown visibility
        dropdown.style.display =
            dropdown.style.display === 'block' ? 'none' : 'block';
      }
    });
  });

  // Close dropdowns when clicking outside
  document.body.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach((menu) => {
      menu.style.display = 'none';
    });
  });
});

function repeater() {
  const firstSort = setInterval(async () => {
    try {
      if (shouldFetchMore) {
        await checkAndReplaceText();
        await sortLists();
        await validateListItems();
        await fetchConversations();
      } else {
        await addTitleBanner();
        await checkAndReplaceText();
        await sortLists();
        await validateListItems();
      }
    } catch (e) {
      console.error('Error in sortLists interval:', e);
    }
  }, 5000);

  setTimeout(() => {
    clearInterval(firstSort);

    setInterval(async () => {
      try {
        await addTitleBanner();
        await checkAndReplaceText();
        await sortLists();
        await validateListItems();
      } catch (e) {
        console.error('Error in checkAndReplaceText interval after timeout:', e);
      }
    }, 90000);
  }, 30000);
}

async function fetchConversations() {
  if (isScriptLoading) return;
  isScriptLoading = true;

  try {
    if (shouldFetchMore) {
      apiOffset = parseInt(sessionStorage.getItem('apiOffset'), 10) || 0;
      console.log('apiOffset : ', apiOffset);

      const token = sessionStorage.getItem('authToken'); // Retrieve the token from local storage
      if (!token) throw new Error('Bearer token not found');

      const response = await fetch(
          `/backend-api/conversations?offset=${apiOffset}&limit=${apiLimit}&order=${apiOrder}`,
          { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      apiOffset += apiLimit;

      sessionStorage.setItem('apiOffset', apiOffset);

      // Update the session storage directly with the merged conversations
      const conversations = mergeAndCleanConversations(
          managesessionStorage('get'),
          data.items.map((item) => ({
            ...item,
            update_time: item.update_time ? new Date(item.update_time) : null,
          }))
      );
      managesessionStorage('set', conversations);

      if (apiOffset >= data.total) {
        shouldFetchMore = false;
        console.log('All conversations have been fetched.');
      }
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
  } finally {
    isScriptLoading = false; // Ensure it's reset regardless of success or failure
  }
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
  let  catagoryColors = {};
  let conversations;
  try {
     catagoryColors = JSON.parse(sessionStorage.getItem(' catagoryColors')) || {};
    conversations = managesessionStorage('get') || {};
  } catch (e) {
    console.error('Error parsing  catagoryColors from sessionStorage:', e);
     catagoryColors = {};
  }

  divElements.forEach((divElement) => {
    if (divElement.querySelector('span')) return;

    let textContent = divElement.textContent;
    let date;
    let id;
    //console.log(textContent);
    conversations.forEach((item) => {
      if (item.title == textContent) {
        date = item.update_time;
        id = item.id;
      }
    });
    //console.log("date: ", date);
    const regex = /\[(.*?)\]/g;

    const newText = textContent.replace(regex, (match, word) => {
      if (! catagoryColors[word]) {
         catagoryColors[word] = colors[colorIndex % colors.length];
        colorIndex++;
      }
      return `<span class="highlighted" style="color: ${ catagoryColors[word]}; border: 1px dotted ${ catagoryColors[word]}">${word}</span>`;
    });

    const match = regex.exec(textContent);
    if (match && match[1]) {
      divElement.closest('li')?.setAttribute('data-category', match[1].trim());
      divElement.closest('li')?.setAttribute('data-date', date);
      divElement.closest('li')?.setAttribute('data-id', id);
    }

    divElement.innerHTML = newText;
  });

  // Save updated color assignments to sessionStorage
  try {
    sessionStorage.setItem(' catagoryColors', JSON.stringify( catagoryColors));
  } catch (e) {
    console.error('Error saving  catagoryColors to sessionStorage:', e);
  }
}

function collectSingleItems(categories, singleItems, fragment) {
  // Separate out single-item categories
  const sortedCategories = [];
  for (const category in categories) {
    if (categories[category].length === 1) {
      singleItems.push(...categories[category]);
    } else {
      // Store categories along with the earliest date in their items
      const earliestDate = categories[category]
          .filter((item) => item.date instanceof Date && !isNaN(item.date))
          .reduce(
              (earliest, current) =>
                  !earliest || current.date < earliest ? current.date : earliest,
              null
          );

      console.log('Earliest Date for category:', category, earliestDate);

      const mostRecentDate = categories[category]
          .filter((item) => item.date instanceof Date && !isNaN(item.date))
          .reduce(
              (mostRecent, current) =>
                  !mostRecent || current.date > mostRecent
                      ? current.date
                      : mostRecent,
              null
          );

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
  let  catagoryColors = {};
  let conversations;

  try {
     catagoryColors = JSON.parse(sessionStorage.getItem(' catagoryColors')) || {};
    getConversations = managesessionStorage('get') || {};
    conversations = Array.from(getConversations);
  } catch (e) {
    console.error('Error parsing  catagoryColors from sessionStorage:', e);
  }

  let totalitems = 0;
  //console.log("olListsToCategorize: ", olListsToCategorize);
  olListsToCategorize.forEach((ol) => {
    ol.setAttribute('style', 'display: block;');
    //console.log("ol: ", ol);
    const listItems = ol.querySelectorAll('li');
    listItems.forEach((item) => {
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
      if (dateStr !== undefined)
        conversations = removeObjectWithId(conversations, dataId);
      //console.log("conversations: ", conversations.length, dataId);
      const fallbackDate = new Date(0); // Epoch time for missing dates
      const date = dateStr ? new Date(dateStr) : fallbackDate;

      if (category) {
        if (!categories[category]) categories[category] = [];
        categories[category].push({ item, date });
      } else {
        uncategorizedItems.push({ item, date });
      }
      //console.log("item: ", item);
      processedItems.add(item);
    });
  });
  console.log('olListsToCategorize: ', olListsToCategorize);

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
  console.log("orphan item: ", orphans);
  console.log("uncategorizedItems: ", uncategorizedItems);
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
    const dateA = a.earliestDate || new Date(0); // Fallback to earliest possible date if undefined
    const dateB = b.earliestDate || new Date(0);
    return dateB - dateA; // For descending order, use `dateB - dateA`
  });

  console.log('Sorted categories by earliest date:', sortedCategories);

  // Clear and sort the fragment

  // Create categorized lists based on sorted categories and append them in order
  sortedCategories.forEach(({ category, items }) => {
    const newOlContainer = createCategoryContainer(
        category,
        items,
         catagoryColors[category]
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

function addTitleBanner() {
  const currentItemId = new URL(window.location.href).pathname.split("/c/")[1];
  if (!currentItemId) return;

  const conversations = managesessionStorage("get") || [];
  const currentConversation = conversations.find(
      (item) => item.id === currentItemId
  );

  if (!currentConversation) return;

  let banner = document.getElementById("title-banner");

  let categoryColors = {};
  try {
    categoryColors = JSON.parse(sessionStorage.getItem("categoryColors")) || {};
  } catch (e) {
    console.error("Error parsing categoryColors from sessionStorage:", e);
    categoryColors = {};
  }

  const regex = /\b(\w+)\b/g;
  let coloredTitle = currentConversation.title.replace(regex, (match) => {
    if (categoryColors[match]) {
      return `<span style="color: ${categoryColors[match]}; border: 1px dotted ${categoryColors[match]}">${match}</span>`;
    }
    return match;
  });

  if (banner) {
    banner.innerHTML = coloredTitle;
  } else {
    banner = document.createElement("div");
    banner.id = "title-banner";
    banner.style.cssText = `
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
  const targetNode = document.querySelector('.relative.grow.overflow-hidden.whitespace-nowrap');

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
          // Check and replace text and sort after DOM changes
          reinitializeHoverStates();
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

  const observer = new MutationObserver(() => {
    reinitializeHoverStates();
    initializeButtonClickListeners();
  });

  observer.observe(document.querySelector('ol'), {
    childList: true,
    subtree: true,
  });

  if (targetNode) {
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
  }
}

function renameChatHandler(mutation) {
  const updatedTitleElement = mutation.target.closest(
      '.relative.grow.overflow-hidden.whitespace-nowrap'
  );
  if (!updatedTitleElement) return;

  const updatedTitle = updatedTitleElement.textContent.trim();
  const chatId = updatedTitleElement.closest('li')?.getAttribute('data-id');

  if (!chatId || !updatedTitle) return;

  // Update the conversation title in sessionStorage
  const conversations = managesessionStorage('get') || [];
  const chat = conversations.find((item) => item.id === chatId);

  if (chat) {
    chat.title = updatedTitle;
    managesessionStorage('set', conversations);

    console.log(`Chat title updated for ID: ${chatId} -> ${updatedTitle}`);
  } else {
    console.warn(`Chat ID not found in sessionStorage: ${chatId}`);
  }

  // Update the title banner if the renamed chat is active
  const currentChatId = new URL(window.location.href).pathname.split('/c/')[1];
  if (currentChatId === chatId) {
    addTitleBanner(); // Re-render the banner with the updated title
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

  // Attach click event listeners to dropdown buttons
  document.querySelectorAll('[data-testid$="-options"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const dropdown = button.closest('li').querySelector('.dropdown-menu');
      if (dropdown) {
        // Toggle dropdown visibility
        dropdown.style.display =
            dropdown.style.display === 'block' ? 'none' : 'block';
      }
    });
  });

  // Close dropdowns when clicking outside
  document.body.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach((menu) => {
      menu.style.display = 'none';
    });
  });
}

function handleButtonClick(button) {
  const buttonId = button.id || "No ID";
  console.log(`Button with ID ${buttonId} was clicked!`);

  if (buttonId === "No ID") {
    console.warn("Button clicked without an ID. Ensure all buttons are assigned unique IDs.");
  }
}

function reinitializeDropdowns() {
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

  document.body.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach((menu) => {
      menu.style.display = 'none';
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

function reinitializeHoverStates() {
  const listItems = document.querySelectorAll('.can-hover');
  listItems.forEach((item) => {
    item.addEventListener('mouseenter', () => {
      item.classList.add('hovered');
    });

    item.addEventListener('mouseleave', () => {
      item.classList.remove('hovered');
    });
  });
}