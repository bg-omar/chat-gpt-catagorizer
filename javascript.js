(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [resource, config] = args;

    if (config && config.headers) {
      // Check if headers is a Headers instance or a plain object
      let token = null;
      if (config.headers instanceof Headers) {
        if (config.headers.has('Authorization')) {
          // For Headers object
          const authHeader = config.headers.get('Authorization');
          if (authHeader.startsWith('Bearer '))
            token = authHeader.split(' ')[1];
        }
      } else if (typeof config.headers === 'object') {
        const authHeader = config.headers['Authorization']; // For plain object
        if (authHeader && authHeader.startsWith('Bearer '))
          token = authHeader.split(' ')[1];
      }
      if (token) {
        //console.log("Captured Bearer token from request:", token);
        sessionStorage.setItem('authToken', token);
      }
    }

    const response = await originalFetch(...args);
    return response;
  };
})();

sessionStorage.setItem('apiOffset', 0);
let apiLimit = 56; // Matches API's default
let apiOrder = 'updated';
let isScriptLoading = false;
let shouldFetchMore = true; // Initially, allow fetching

document.addEventListener('DOMContentLoaded', () => {
  addTitleBanner() ;
  repeater();
  initializeMutationObserver();
  initializeButtonClickListeners();
});

function repeater() {
  const firstSort = setInterval(async () => {
    try {
      if (shouldFetchMore) {
        await fetchConversations();
      } else {
        await checkAndReplaceText();
        await sortLists();
      }
    } catch (e) {
      console.error('Error in sortLists interval:', e);
    }
  }, 5000);

  setTimeout(() => {
    clearInterval(firstSort);

    setInterval(async () => {
      try {
        await checkAndReplaceText();
        await sortLists();
      } catch (e) {
        console.error(
            'Error in checkAndReplaceText interval after timeout:',
            e
        );
      }
    }, 90000);
  }, 30000);
}

async function fetchConversations() {
  //console.log('Starting fetchConversations, isScriptLoading: ', isScriptLoading, 'shouldFetchMore: ', shouldFetchMore);
  if (isScriptLoading) return;
  isScriptLoading = true;

  try {
    let updatedConversations = [];

    if (shouldFetchMore) {
      apiOffset = parseInt(sessionStorage.getItem('apiOffset'), 10) || 0;
      console.log('apiOffset : ', apiOffset);

      const token = sessionStorage.getItem('authToken'); // Retrieve the token from local storage
      if (!token) throw new Error('Bearer token not found');

      const response = await fetch(
          `/backend-api/conversations?offset=${apiOffset}&limit=${apiLimit}&order=${apiOrder}`,
          { headers: { Authorization: `Bearer ${token}` } }
      ); // Add Authorization header and make the API call

      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      apiOffset += apiLimit;

      sessionStorage.setItem('apiOffset', apiOffset);
      const updatedConversations = mergeAndCleanConversations(
          managesessionStorage('get'),
          data.items.map((item) => ({
            ...item,
            update_time: item.update_time ? new Date(item.update_time) : null,
          }))
      );
      managesessionStorage('set', updatedConversations);

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
    '#f0f',
    '#FF7E00',
    '#64edd3',
    '#0f0',
    '#3cc',
    '#ff0',
    '#f00',
    '#0ff',
    '#336699',
    'gray',
    'silver',
    '#CC99FF',
    '#6633FF',
    '#66FF99',
    '#FF6633',
    '#66CCCC',
    '#33CC33',
    'red',
    'purple',
    'green',
    'lime',
    'olive',
    'yellow',
    'blue',
    'teal',
    'aqua',
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
      if (!wordColors[word]) {
        wordColors[word] = colors[colorIndex % colors.length];
        colorIndex++;
      }
      return `<span class="highlighted" style="color: ${wordColors[word]}; border: 1px dotted ${wordColors[word]}">${word}</span>`;
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
    sessionStorage.setItem('wordColors', JSON.stringify(wordColors));
  } catch (e) {
    console.error('Error saving wordColors to sessionStorage:', e);
  }
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
    conversations.forEach((conversation) => {
      const dateStr = conversation.update_time;
      const fallbackDate = new Date(0); // Epoch time for missing dates
      const date = dateStr ? new Date(dateStr) : fallbackDate;
      orphans++;
      const li = document.createElement('li');
      li.className = 'relative';
      li.setAttribute('data-testid', `history-item-${orphans}`);
      //li.setAttribute("data-category", `Uncategorized`);
      li.setAttribute('data-date', date);
      li.setAttribute('data-id', `${conversation.id}`);

      li.innerHTML = `
        <div class="no-draggable group relative rounded-lg active:opacity-90 bg-token-sidebar-surface-secondary">
          <a class="flex items-center gap-2 p-2" data-discover="true" href="/c/${conversation.id}">
            <div class="relative grow overflow-hidden whitespace-nowrap" dir="auto" title="${conversation.title}">
              ${conversation.title}
            </div>
          </a>
        </div>
      `;

      //console.log("li: ", li);
      olElement.appendChild(li);
      processedItems.add(li);
    });
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

  // Create the title banner
  const banner = document.createElement("div");
  banner.id = "title-banner";
  banner.style.cssText = `
    
  `;
  banner.textContent = currentConversation.title;

  // Add the banner to the document
  document.body.prepend(banner);
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
  console.log(`Button with ID ${button.id} was clicked!`);
  // Additional functionality can be added here
}

function reinitializeDropdowns() {
  document.querySelectorAll('[data-radix-menu-content]').forEach((dropdown) => {
    // Custom initialization or reattachment logic as needed by the dropdown library
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
