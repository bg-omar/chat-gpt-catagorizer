localStorage.setItem('offset', 0); // Keep nextOffset in sync with localStorage

document.addEventListener('DOMContentLoaded', () => {
    // Retrieve offset from localStorage or default to 0
  offset = parseInt(localStorage.getItem('offset'), 10) || 0;
  nextOffset = offset; // Ensure nextOffset matches the current offset


  repeater();
  initializeMutationObserver();
  initializeButtonClickListeners();
  // Initial load
  fetchConversations().then(preloadNextPage);
});


let offset = 0;
let nextOffset = 0;
const limit = 28; // Matches API's default
const order = 'updated';
let isLoading = false;
let toggleMultiplier = true; // Toggle between behaviors

async function fetchConversations() {
    if (isLoading) return; // Prevent duplicate calls
    isLoading = true;

    try {
        // Calculate the offset for the current call
        const response = await fetch(`/backend-api/conversations?offset=${offset}&limit=${limit}&order=${order}`);
        if (!response.ok) throw new Error('Failed to fetch conversations');
        const data = await response.json();

        if (data){
          updateUIWithConversations(data);
        } // Append fetched data to the UI

            offset += limit; // Increment the offset
      localStorage.setItem('offset', offset); // Save updated offset to localStorage


        isLoading = false;
    } catch (error) {
        console.error("Error fetching conversations:", error);
        isLoading = false;
    }
}

function updateUIWithConversations(conversations) {
    const container = document.querySelector('#conversations-container');
    if (conversations) {
      conversations.forEach((conversation) => {
        const div = document.createElement('div');
        div.className = 'conversation';
        div.textContent = conversation.title; // Replace with appropriate field
        container.appendChild(div);
    });
      
    }
}

// Infinite scrolling logic
window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        fetchConversations().then(preloadNextPage);
    }
});

async function preloadNextPage() {
  try {
    const data = await fetch(`/backend-api/conversations?offset=${nextOffset}&limit=${limit}&order=${order}`).then(res => res.json());
    if (data) {
     updateUIWithConversations(data);
    }
  } catch (error) {
    console.error("Error preloading conversations:", error);
  }
  nextOffset = offset + limit;
  localStorage.setItem('offset', offset); // Keep nextOffset in sync with localStorage
}

function initializeMutationObserver() {
  const targetNode = document.querySelector(
    '.relative.grow.overflow-hidden.whitespace-nowrap'
  );
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
            // Ensure target exists
            checkAndReplaceText();
          }
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
        preloadNextPage();
      } catch (e) {
        console.error('Error in sortLists interval after timeout:', e);
      }
    }, 30000);
  }, 20000);
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
  collapseIcon.textContent = '[+]'; // Default to collapsed state
  collapseIcon.style.marginRight = '10px';
  collapseIcon.style.cursor = 'pointer';

  categoryHeader.prepend(collapseIcon);
  categoryHeader.style.cursor = 'pointer';

  // Toggle collapse/expand on click
  categoryHeader.addEventListener('click', () => {
    if (newOl.style.display === 'none') {
      newOl.style.display = 'block';
      collapseIcon.textContent = '[-]';
    } else {
      newOl.style.display = 'none';
      collapseIcon.textContent = '[+]';
    }
  });

  newOlContainer.appendChild(categoryHeader);

  const newOl = document.createElement('ol');
  newOl.style.display = 'none'; // Default to collapsed
  items.forEach((item) => {
    if (document.body.contains(item)) {
      // Check if item is still in DOM
      newOl.appendChild(item);
    }
  });
  newOlContainer.appendChild(newOl);

  return newOlContainer;
}

// Function to prioritize today categories
function prioritizeTodayCategories(categories) {
  const todayCategories = ['Category1', 'Category2']; // Define specific categories that should be prioritized
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
