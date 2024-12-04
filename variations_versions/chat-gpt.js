localStorage.setItem('offset', 0); // Keep nextOffset in sync with localStorage

function waitForContainerToLoad(callback, maxRetries = 50, retryCount = 0) {
  const container = document.querySelector('#conversations-container');
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

document.addEventListener('DOMContentLoaded', () => {

  // Initial load
  offset = parseInt(localStorage.getItem('offset'), 10) || 0;
  repeater();
  addCustomCSS();
  initializeMutationObserver();
  initializeButtonClickListeners();

  waitForContainerToLoad(() => {
    fetchConversations(); // Now, fetchConversations() will only run when the container is available
  });

});
// Retrieve offset from localStorage, default to 0 if not set
let offset = parseInt(localStorage.getItem('offset'), 10) || 0;
const limit = 28; // Matches API's default
const order = 'updated';
let isLoading = false;

async function fetchConversations() {
  console.log('fetchConversations is starting');
  if (isLoading) return; // Prevent duplicate calls
  const container = document.querySelector('#conversations-container');
  if (!container) {
    console.error('Container not found for conversations.');
    return;
  }

  isLoading = true;

  try {
    offset = parseInt(localStorage.getItem('offset'), 10);
    console.log(`Fetching conversations with offset=${offset}, limit=${limit}, order=${order}`);
    const response = await fetch(`/backend-api/conversations?offset=${offset}&limit=${limit}&order=${order}`);
    if (!response.ok) throw new Error(`Failed to fetch conversations: ${response.statusText}`);
    const data = await response.json();
    console.log('Fetched data:', data);
    waitForContainerToLoad(() => {
      updateUIWithConversations(data);
      checkAndReplaceText(); // Categorize new items
      sortLists(); // Sort new items after they have been categorized
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);

  } finally {
    offset += limit; // Increment the offset
    localStorage.setItem('offset', offset); // Save updated offset to localStorage
    isLoading = false; // Ensure it's reset regardless of success or failure
  }
}

function updateUIWithConversations(conversations) {
  if (conversations) {
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
  const container = document.querySelector('#conversations-container');
  if (!container) return;
  console.log('Scroll position:', window.innerHeight + window.scrollY, 'Document height:', document.body.offsetHeight);
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 10) {
    fetchConversations();
  }
}, 200));



function initializeMutationObserver() {
  waitForContainerToLoad(() => {
    const targetNode = document.querySelector('.relative.grow.overflow-hidden.whitespace-nowrap');
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

    if (targetNode) {
      const observer = new MutationObserver(callback);
      observer.observe(targetNode, config);
    }
  });
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
        fetchConversations();
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
    const uncategorizedOlContainer = createCategoryContainer('Uncategorized', uncategorizedItems.map(itemObj => itemObj.item));
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
      sortedCategories.push({ category, items: categories[category].map(itemObj => itemObj.item), earliestDate });
    }
  }

  // Create a "Single Items" section for all single-item categories
  if (singleItems.length > 0) {
    const singleItemsOlContainer = createCategoryContainer('Single Items', singleItems.map(itemObj => itemObj.item));
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
    const newOlContainer = createCategoryContainer(category, items, wordColors[category]);
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
  const todayCategories = ['Æther', 'Æ', 'ω', 'Physics']; // Define specific categories that should be prioritized
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

  // Define your CSS code as a string ---> Same scss as found in the separate styling.scss
  const css = `
			/* Set the body or main container to 100% width */
      body, html {
      	width: 100%;
      }

      ol {
          transition: height 0.3s ease, opacity 0.3s ease;
          overflow: hidden;
      }

      /* Target the chat container and force it to occupy the full width */
      .mx-auto, .flex, .flex-1, .gap-4, .text-base, .md, .lg:gap-6, .md, .lg, .xl, .lg, .w-full, .mx-auto {
      	width: 90% !important;
      	max-width: 90% !important;
      	min-width: 90% !important;
      	padding: 0;
      }

      h3 {
      	width: 90% !important;
      	padding: .5rem 1rem !important;
        box-shadow: 0 0 20px 0 rgba(14, 0, 18, 0.6);
      	border: 1px dotted ;
        line-height: .5rem;
      	background-color: #202;
      }

      h4 {
      	color: #64edd3;
      	width: 90% !important;
      	border: 1px dotted #fff;
      	padding: .5rem 1rem !important;
      	line-height: .5rem;
      	margin: 0;
      	background-color: #202;
        box-shadow: 0 0 20px 0 rgba(14, 0, 18, 0.6);
      }

			.max-w-6xl {
			    max-width: 95%;
			}

			.prose :where(hr):not(:where(.not-prose)) {
			    border-top-width: 1px;
			    margin-bottom: .25em;
			    margin-top: .25em;
			}

			.katex-display {
			    display: block;
			    margin: 0.25em 0;
			    text-align: center;
			}

      div.relative.mt-5 {
      	h3 {
          	width: 90% !important;
          	padding: .25rem 1rem !important;
            box-shadow: 0 0 20px 0 rgba(14, 0, 18, 0.6);
            line-height: .5rem;
          	background-color: #202;
      	}
      }

      .flex-row-reverse {
      	flex-direction: row;
      }

      .mr-1 .rounded-xl .items-center .text-sm {
      	color: #f0f;
      	font-size: 1.25rem;
      	line-height: 1rem;
      	border-color: #f0f;
      }

      .mr-1 .rounded-xl .items-center {
      	color: #f0f;
      	border-color: #f0f;
      }

      .rounded-xl .items-center {
      	color: #f0f;
      	border-color: #f0f;
      }

      .highlighted {
      	padding: 3px;
      	margin: -7px 0;
      	font-weight: bold !important; /* Optionally make it bold */
      }

      .p-2 {
      	padding: 0.25rem;
      }

      .text-sm {
      	font-size: 0.75rem;
      	line-height: 1rem;
      }

      .mx-auto {
      	// Center the container
      	margin-left: auto;
      	margin-right: auto;
      }

      .flex {
      	display: flex;
      }

      .flex-1 {
      	flex: 1; // Make the container take up available space
      }

      .gap-4 {
      	gap: 1rem; // You can tweak this if needed
      }

      .md\:gap-5 {
      	@media (min-width: 768px) {
      		gap: 1.25rem;
      	}
      }

      .lg\:gap-6 {
      	@media (min-width: 1024px) {
      		gap: 1.5rem;
      	}
      }

      .md\:max-w-3xl,
      .lg\:max-w-\[40rem\],
      .xl\:max-w-\[48rem\] {
      	// Remove restrictive maximum widths for wider display
      	@media (min-width: 768px) {
      		max-width: 90%;
      	}
      }

      // Ensure the container always takes 90% of the available width
      .group\/conversation-turn {
      	width: 90%;
      	margin-left: auto;
      	margin-right: auto;
      }

      // Other layout tweaks to ensure consistent appearance
      .flex-shrink-0 {
      	flex-shrink: 0;
      }

      .min-w-0 {
      	min-width: 0;
      }

      .items-end {
      	align-items: flex-end;
      }

      // Styling for the content, avatar, and chat bubbles, ensuring they are properly aligned and readable
      .gizmo-bot-avatar {
      	width: 90%; // Adjust avatar width to 90% of its container (optional, depending on design)
      }

      // Any additional rules to override padding/margin if necessary
      .p-1 {
      	padding: 0.25rem; // Optional: can adjust padding if more/less spacing is desired
      }

      //._main_5jn6z_1 {
      //    width: 90% !important;  // Or any desired width value
      //}

      .custom-width {
          width: 90% !important;  // Or any desired value
      }


      .mt-5 {
          margin: 0;
      }
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
