(function () {
  localStorage.remove('authToken');
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
        localStorage.setItem('authToken', token);
      }
    }

    const response = await originalFetch(...args);
    return response;
  };
})();

// Initialize by waiting for token
localStorage.setItem('apiOffset', 0);
document.addEventListener('DOMContentLoaded', async () => {
  apiOffset = parseInt(localStorage.getItem('apiOffset'), 10) || 0;
  repeater();
  // addCustomCSS(); Uncomment if needed
  initializeMutationObserver();
  initializeButtonClickListeners();

  await waitForToken();
  fetchConversations();
});

const apiLimit = 28; // Matches API's default
const apiOrder = 'updated';
let isScriptLoading = false;
let shouldFetchMore = true; // Initially, allow fetching

async function waitForToken() {
  const maxRetries = 20;
  let retries = 0;
  while (!localStorage.getItem('authToken') && retries < maxRetries) {
    console.log(`Waiting for Bearer token... Attempt ${retries + 1}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    retries++;
  }

  if (!localStorage.getItem('authToken')) {
    console.error("Bearer token not found after multiple retries.");
    throw new Error("Bearer token not found");
  }
}

async function fetchConversations() {
  console.log('Starting fetchConversations, isScriptLoading: ', isScriptLoading);
  if (isScriptLoading || !shouldFetchMore) return; // Prevent duplicate calls or when no more data is available

  isScriptLoading = true;

  try {
    apiOffset = parseInt(localStorage.getItem('apiOffset'), 10) || 0;
    console.log('apiOffset : ', apiOffset);

    // Retrieve the token from local storage
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Bearer token not found');
    }

    // Add Authorization header
    const response = await fetch(`/backend-api/conversations?offset=${apiOffset}&limit=${apiLimit}&order=${apiOrder}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch conversations');
    const data = await response.json();

    // Merge fetched conversations with existing conversations in localStorage
    const existingConversations = JSON.parse(localStorage.getItem('conversations')) || [];
    const updatedConversations = mergeConversations(existingConversations, data.items);
    localStorage.setItem('conversations', JSON.stringify(updatedConversations));

    // Update the UI with the newly updated conversations
    updateUIWithConversations(updatedConversations);
    checkAndReplaceText(); // Categorize new items
    sortLists(); // Sort new items after they have been categorized

    // Update offset and check whether to continue fetching
    apiOffset += apiLimit;
    localStorage.setItem('apiOffset', apiOffset); // Save updated offset to localStorage

    // Stop fetching if there are no more items left to fetch
    if (apiOffset >= data.total) {
      shouldFetchMore = false; // Set flag to stop further fetching
      console.log("All conversations have been fetched.");
    }

  } catch (error) {
    console.error("Error fetching conversations:", error);
  } finally {
    isScriptLoading = false; // Ensure it's reset regardless of success or failure
  }
}

// Helper function to merge new conversations into the existing list
function mergeConversations(existingConversations, newConversations) {
  const existingIds = new Set(existingConversations.map(conv => conv.id));
  const mergedConversations = [...existingConversations];

  newConversations.forEach((conversation) => {
    if (!existingIds.has(conversation.id)) {
      mergedConversations.push(conversation);
    }
  });

  return mergedConversations;
}

function updateUIWithConversations(conversations) {
  const container = document.querySelector('#conversations-container'); // Assuming a container exists
  if (!container) {
    console.error('Container not found for conversations.');
    return;
  }

  container.innerHTML = ''; // Clear existing content before adding new items

  if (conversations && conversations.length > 0) {
    conversations.forEach((conversation) => {
      const div = document.createElement('div');
      div.className = 'conversation';
      div.textContent = conversation.title; // Replace with appropriate field
      container.appendChild(div);
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

// Initialize the UI with existing conversations in localStorage
document.addEventListener('DOMContentLoaded', () => {
  const storedConversations = JSON.parse(localStorage.getItem('conversations')) || [];
  if (storedConversations.length > 0) {
    updateUIWithConversations(storedConversations);
  }
  fetchConversations(); // Start fetching new conversations
});

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
    wordColors = JSON.parse(localStorage.getItem('wordColors')) || {};
  } catch (e) {
    console.error('Error parsing wordColors from localStorage:', e);
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
    if (match && match[1]) {
      divElement.closest('li')?.setAttribute('data-date',date).setAttribute('data-id', id).setAttribute('data-category', match[1].trim());
    }

    divElement.innerHTML = newText;
  });

  try {
    localStorage.setItem('wordColors', JSON.stringify(wordColors));
  } catch (e) {
    console.error('Error saving wordColors to localStorage:', e);
  }
}

function sortLists() {
  const categories = {};
  const uncategorizedItems = [];
  const singleItems = []; // To collect single item categories
  const listContainer = document.querySelector('.flex.flex-col.gap-2.pb-2');
  if (!listContainer) return;
  // Load saved conversations from localStorage


  const storedConversations = JSON.parse(localStorage.getItem('conversations')) || [];
  console.log("storedConversations: ", storedConversations)

  const originalOlLists = listContainer.querySelectorAll('ol');

  const olListsToCategorize = Array.from(originalOlLists).slice(1);

  // Clear processedItems set to reflect the latest DOM structure
  const processedItems = new Set();
  let wordColors = {};

  try {
    wordColors = JSON.parse(localStorage.getItem('wordColors')) || {};
  } catch (e) {
    console.error('Error parsing wordColors from localStorage:', e);
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

  // Sort categories by the earliest date among their items
  sortedCategories.sort((a, b) => {
    if (!a.earliestDate) return 1;
    if (!b.earliestDate) return -1;
    return a.earliestDate - b.earliestDate;
  });

  // Create categorized lists based on sorted categories
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
