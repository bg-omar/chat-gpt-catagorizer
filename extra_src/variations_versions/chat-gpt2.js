(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [resource, config] = args;

    // Check if headers is a Headers instance or a plain object
    if (config && config.headers) {
      let token = null;

      if (config.headers instanceof Headers) {
        // For Headers object
        if (config.headers.has('Authorization')) {
          const authHeader = config.headers.get('Authorization');
          if (authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
          }
        }
      } else if (typeof config.headers === 'object') {
        // For plain object
        const authHeader = config.headers['Authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }

      if (token) {
        console.log("Captured Bearer token from request:", token);
        sessionStorage.setItem('authToken', token);
      }
    }

    const response = await originalFetch(...args);
    return response;
  };
})();

// Initialize by waiting for token
sessionStorage.setItem('apiOffset', 0);
document.addEventListener('DOMContentLoaded', async () => {
  apiOffset = parseInt(sessionStorage.getItem('apiOffset'), 10) || 0;

  const storedConversations = JSON.parse(sessionStorage.getItem('conversations')) || [];
  if (storedConversations.length > 0) {
    updateUIWithConversations(storedConversations);
  }

  // addCustomCSS(); Uncomment if needed
  initializeMutationObserver();
  initializeButtonClickListeners();

  // Wait for token before fetching conversations
  await waitForToken();
  fetchConversations().then(repeater());

});

const apiLimit = 28; // Matches API's default
const apiOrder = 'updated';
let isScriptLoading = false;
let shouldFetchMore = true; // Initially, allow fetching
let catagorizedItems = [];


// Function to wait until the token is available
async function waitForToken() {
  const maxRetries = 20;
  let retries = 0;
  while (!sessionStorage.getItem('authToken') && retries < maxRetries) {
    console.log(`Waiting for Bearer token... Attempt ${retries + 1}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    retries++;
  }

  if (!sessionStorage.getItem('authToken')) {
    console.error("Bearer token not found after multiple retries.");
    throw new Error("Bearer token not found");
  }
}

async function fetchConversations() {
  console.log('Starting fetchConversations, isScriptLoading: ', isScriptLoading, 'shouldFetchMore: ', shouldFetchMore);
  if (isScriptLoading) return; // Prevent duplicate calls when already loading

  isScriptLoading = true;

  try {
    let updatedConversations = [];

    if (shouldFetchMore) {
      apiOffset = parseInt(sessionStorage.getItem('apiOffset'), 10) || 0;
      console.log('apiOffset : ', apiOffset);

      // Retrieve the token from local storage
      const token = sessionStorage.getItem('authToken');
      if (!token) {
        throw new Error('Bearer token not found');
      }

      // Add Authorization header and make the API call
      const response = await fetch(`/backend-api/conversations?offset=${apiOffset}&limit=${apiLimit}&order=${apiOrder}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      // Retrieve existing conversations from local storage


      // Update offset and determine whether to continue fetching
      apiOffset += apiLimit;

      sessionStorage.setItem('apiOffset', apiOffset);

      updateUIWithConversations(data.items);
      let existingConversations = managesessionStorage('get');

      // Merge and clean new data
      updatedConversations = mergeAndCleanConversations(existingConversations, data.items);

      // Save merged conversations back to local storage
      managesessionStorage('set', updatedConversations);
      if (apiOffset >= data.total) {
        shouldFetchMore = false;
        console.log("All conversations have been fetched.");
      }
    }

    // Update the UI
    checkAndReplaceText(); // Categorize new items
    sortLists(); // Sort new items after they have been categorized

  } catch (error) {
    console.error("Error fetching conversations:", error);
  } finally {
    isScriptLoading = false; // Ensure it's reset regardless of success or failure
  }
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

function updateUIWithConversations(conversations) {
  const container = document.querySelector('.relative.mt-5.first\\:mt-0.last\\:mb-5'); // Assuming a container exists
  if (!container) {
    console.error('Container not found for conversations.');
    return;
  }


  // Ensure there's an <ol> element in the container.
  let olElement = container.querySelector('ol:nth-of-type(2)');
  if (!olElement) {
    // Create <ol> if it doesn't exist
    olElement = document.createElement('ol');
    container.appendChild(olElement);
  }

  // Clear existing content to prevent duplicates before adding new items
  olElement.innerHTML = '';

  if (conversations && conversations.length > 0) {
    conversations.forEach((conversation) => {
      const div = document.createElement('div');
      div.className = 'conversation';
      div.textContent = conversation.title; // Replace with appropriate field
      olElement.appendChild(div);
    });
  }
}


function updateUIWithStorageConversations(conversations) {
  const container = document.querySelector('.relative.mt-5.first\\:mt-0.last\\:mb-5');

  if (!container) {
    console.error('Container not found for conversations.');
    return;
  }



  // Ensure there's an <ol> element in the container.
  let olElement = container.querySelector('ol:nth-of-type(2)');
  if (!olElement) {
    // Create <ol> if it doesn't exist
    olElement = document.createElement('ol');
    container.appendChild(olElement);
  }

  // Clear existing content to prevent duplicates before adding new items
  olElement.innerHTML = '';

  // Iterate through conversations to create and append <li> elements
  if (conversations && conversations.length > 0) {
    conversations.forEach((conversation) => {
      const li = document.createElement('li');
      li.className = "relative z-[15]";
      li.setAttribute("data-testid", `history-item-${conversation.id}`);

      // Create inner structure based on the given template
      li.innerHTML = `
        <div class="no-draggable group relative rounded-lg active:opacity-90 bg-token-sidebar-surface-secondary">
          <a class="flex items-center gap-2 p-2" data-discover="true" href="/c/${conversation.id}">
            <div class="relative grow overflow-hidden whitespace-nowrap" dir="auto" title="${conversation.title}">
              ${conversation.renderedTitle}
              <div class="absolute bottom-0 top-0 to-transparent ltr:right-0 ltr:bg-gradient-to-l rtl:left-0 rtl:bg-gradient-to-r from-token-sidebar-surface-secondary w-10 from-60%"></div>
            </div>
          </a>
          <div class="absolute bottom-0 top-0 items-center gap-1.5 pr-2 ltr:right-0 rtl:left-0 flex">
            <span class="" data-state="closed">
              <button class="flex items-center justify-center text-token-text-secondary transition hover:text-token-text-primary radix-state-open:text-token-text-secondary" data-testid="history-item-${conversation.id}-options" type="button" id="radix-:r23:" aria-haspopup="menu" aria-expanded="false" data-state="closed">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-md">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12ZM10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12ZM17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12Z" fill="currentColor"></path>
                </svg>
              </button>
            </span>
          </div>
        </div>
      `;

      olElement.appendChild(li);
    });
  }
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

window.addEventListener('scroll', debounce(() => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 10) {
    fetchConversations();
  }
}, 200));



function initializeMutationObserver() {
  const targetNode = document.querySelector('.relative.grow.overflow-hidden.whitespace-nowrap');
  if (!targetNode) return;

  const config = { childList: true, subtree: true, characterData: true };

  const callback = (mutationsList) => {
    let isObserving = true;

    for (let mutation of mutationsList) {
      if (
        (mutation.type === 'childList' || mutation.type === 'characterData') &&
        isObserving
      ) {
        isObserving = false;
        try {
          if (document.body.contains(mutation.target)) {
            checkAndReplaceText();
            sortLists(); // Added sortLists to recategorize after mutation
          }
        } catch (e) {
          console.error('Error in mutation callback:', e);
        } finally {
          isObserving = true;
        }
      }
    }
  };

  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
}

function repeater() {
  const firstInterval = setInterval(() => {
    try {
      checkAndReplaceText();
    } catch (e) {
      console.error('Error in checkAndReplaceText interval:', e);
    }
  }, 1000);

  const firstSort = setInterval(() => {
    try {
      sortLists();
      fetchConversations();
    } catch (e) {
      console.error('Error in sortLists interval:', e);
    }
  }, 4500);

  setTimeout(() => {
    clearInterval(firstInterval);
    clearInterval(firstSort);

    setInterval(() => {
      try {
        checkAndReplaceText();
      } catch (e) {
        console.error(
          'Error in checkAndReplaceText interval after timeout:',
          e
        );
      }
    }, 30000);

    setInterval(() => {
      try {
        sortLists();
        fetchConversations();
      } catch (e) {
        console.error('Error in sortLists interval after timeout:', e);
      }
    }, 30000);
  }, 20000);
}

// Setup api calls done //

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
  try {
    wordColors = JSON.parse(sessionStorage.getItem('wordColors')) || {};
  } catch (e) {
    console.error('Error parsing wordColors from sessionStorage:', e);
    wordColors = {};
  }

  divElements.forEach((divElement) => {
    if (divElement.querySelector('span')) return;

    let textContent = divElement.textContent;
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
  const processedItems = new Set();
  let wordColors = {};

  try {
    wordColors = JSON.parse(sessionStorage.getItem('wordColors')) || {};
  } catch (e) {
    console.error('Error parsing wordColors from sessionStorage:', e);
  }

  olListsToCategorize.forEach((ol) => {
    const listItems = ol.querySelectorAll('li');
    listItems.forEach((item) => {

      if (processedItems.has(item)) return;

      const category = item.getAttribute('data-category');
      const dateStr = item.getAttribute('data-date');
      const date = dateStr ? new Date(dateStr) : null;

      if (category) {
        if (!categories[category]) categories[category] = [];
        categories[category].push({ item, date });
      } else {
        uncategorizedItems.push({ item, date });
      }

      processedItems.add(item);
    });
  });

  // Sort items within categories by date (ascending order)
  for (const category in categories) {
    categories[category].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date - b.date;
    });
  }

  // Sort uncategorized items by date
  uncategorizedItems.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date - b.date;
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
      const earliestDate = categories[category][0].date;
      sortedCategories.push({
        category,
        items: categories[category].map((itemObj) => itemObj.item),
        earliestDate,
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

  console.log("Sorted categories by earliest date:", sortedCategories);


// Create categorized lists based on sorted categories and append them in order
  sortedCategories.forEach(({ category, items }) => {
    const newOlContainer = createCategoryContainer(
        category,
        items,
        wordColors[category]
    );
    fragment.appendChild(newOlContainer);
  });

// Now append the fragment to the DOM
  if (listContainer) {
    listContainer.innerHTML = ''; // Clear existing content
    listContainer.appendChild(fragment); // Append sorted categories
  }

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

// Function to prioritize today categories
function prioritizeTodayCategories(categories) {
  const todayCategories = ['Æther', 'Æ', 'ω']; // Define specific categories that should be prioritized
  const sortedCategories = {};

  // First, add all "today" categories in the defined order
  todayCategories.forEach((category) => {
    if (categories[category]) {
      sortedCategories[category] = categories[category];
      delete categories[category];
    }
  });

  // Then, add the remaining categories in their original order
  for (const category in categories) {
    sortedCategories[category] = categories[category];
  }

  return sortedCategories;
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
}

function reinitializeDropdowns() {
  document.querySelectorAll('[data-radix-menu-content]').forEach((dropdown) => {
    // Custom initialization or reattachment logic as needed by the dropdown library
  });
}

function addCustomCSS() {
  // Create a <style> element
  const style = document.createElement('style');
  style.type = 'text/css';

  // Define your CSS code as a string ---> Same scss as found in the separate main.scss
  const css = `

    `;

  // Add the CSS code to the <style> element
  if (style.styleSheet) {
    // This is for IE support (IE < 9)
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }

  // Append the <style> element to the document <head>
  document.head.appendChild(style);
}
