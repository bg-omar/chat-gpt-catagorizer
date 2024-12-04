(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [resource, config] = args;

    if (config && config.headers) {// Check if headers is a Headers instance or a plain object
      let token = null;
      if (config.headers instanceof Headers) {
        if (config.headers.has('Authorization')) { // For Headers object
          const authHeader = config.headers.get('Authorization');
          if (authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
        }
      } else if (typeof config.headers === 'object') {
        const authHeader = config.headers['Authorization'];        // For plain object
        if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
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

sessionStorage.setItem('apiOffset', 0);
let apiLimit = 28; // Matches API's default
let apiOrder = 'updated';
let isScriptLoading = false;
let shouldFetchMore = true; // Initially, allow fetching

document.addEventListener('DOMContentLoaded', () => {
  repeater();
  initializeMutationObserver();
  initializeButtonClickListeners();
});


function repeater() {
  // Set intervals with error handling
  const firstInterval = setInterval(() => {
    try {
      checkAndReplaceText();
    } catch (e) {
      console.error("Error in checkAndReplaceText interval:", e);
    }
  }, 1000);

  const firstSort = setInterval(() => {
    try {
      sortLists();
      if (shouldFetchMore) fetchConversations();
    } catch (e) {
      console.error("Error in sortLists interval:", e);
    }
  }, 4500);

  setTimeout(() => {
    clearInterval(firstInterval);
    clearInterval(firstSort);

    setInterval(() => {
      try {
        checkAndReplaceText();
        sortLists();
      } catch (e) {
        console.error("Error in checkAndReplaceText interval after timeout:", e);
      }
    }, 30000);
  }, 30000);
}

function checkAndReplaceText() {
  const divElements = document.querySelectorAll('.relative.grow.overflow-hidden.whitespace-nowrap');
  if (divElements.length === 0) return;

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
    conversations.forEach((item) => {
      if (item.title == textContent){
        date = item.update_time
        id = item.id
      }});
//   console.log("date: ", date);
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
      totalitems++
      if (processedItems.has(item)) return;

      const category = item.getAttribute('data-category');
      const dateStr = item.getAttribute('data-date');
      const dataId = item.getAttribute('data-id');

      conversations = removeObjectWithId(conversations, dataId);
      console.log("conversations: ", conversations.length, dataId);
      const date = dateStr ? new Date(dateStr) : null;

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
  console.log("totalitems: ", totalitems);
  let olElement = olListsToCategorize[0];


  let orphans = 0;
  if (conversations && conversations.length > 0) {
    conversations.forEach((conversation) => {
      const dateStr = conversation.update_time;
      const date = dateStr ? new Date(dateStr) : null;
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
      return a.date - b.date;
    });
  }

  // Sort uncategorized items by date
  // uncategorizedItems.sort((a, b) => {
  //   if (!a.date) return 1;
  //   if (!b.date) return -1;
  //   return a.date - b.date;
  // });

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

function handleButtonClick(button) {
  console.log(`Button with ID ${button.id} was clicked!`);
  // Additional functionality can be added here
}

function reinitializeDropdowns() {
  document.querySelectorAll('[data-radix-menu-content]').forEach(dropdown => {
    // Custom initialization or reattachment logic as needed by the dropdown library
  });
}

async function fetchConversations() {
  console.log('Starting fetchConversations, isScriptLoading: ', isScriptLoading, 'shouldFetchMore: ', shouldFetchMore);
  if (isScriptLoading) return;
  isScriptLoading = true;

  try {
    let updatedConversations = [];

    if (shouldFetchMore) {
      apiOffset = parseInt(sessionStorage.getItem('apiOffset'), 10) || 0;
      console.log('apiOffset : ', apiOffset);

      const token = sessionStorage.getItem('authToken');    // Retrieve the token from local storage
      if (!token) throw new Error('Bearer token not found');

      const response = await fetch(`/backend-api/conversations?offset=${apiOffset}&limit=${apiLimit}&order=${apiOrder}`, {  headers: {'Authorization': `Bearer ${token}`}  });     // Add Authorization header and make the API call

      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      apiOffset += apiLimit;

      sessionStorage.setItem('apiOffset', apiOffset);
      updatedConversations = mergeAndCleanConversations(managesessionStorage('get'), data.items);
      managesessionStorage('set', updatedConversations);

      if (apiOffset >= data.total) {
        shouldFetchMore = false;
        console.log("All conversations have been fetched.");
      }
    }
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

function addCustomCSS() {
  // Create a <style> element
  const style = document.createElement('style');
  style.type = 'text/css';

  // Define your CSS code as a string ---> Same scss as found in the separate styling.scss
  const css = `
			/* Set the body or main container to 100% width */
      body, html {
      \twidth: 100%;
      }

      ol {
          transition: height 0.3s ease, opacity 0.3s ease;
          overflow: hidden;
      }

      /* Target the chat container and force it to occupy the full width */
      .mx-auto, .flex, .flex-1, .gap-4, .text-base, .md, .lg:gap-6, .md, .lg, .xl, .lg, .w-full, .mx-auto {
      \twidth: 90% !important;
      \tmax-width: 90% !important;
      \tmin-width: 90% !important;
      \tpadding: 0;
      }

      h3 {
      \twidth: 90% !important;
      \tpadding: .5rem 1rem !important;
        box-shadow: 0 0 20px 0 rgba(14, 0, 18, 0.6);
      \tborder: 1px dotted ;
        line-height: .5rem;
      \tbackground-color: #202;
      }

      h4 {
      \tcolor: #64edd3;
      \twidth: 90% !important;
      \tborder: 1px dotted #fff;
      \tpadding: .5rem 1rem !important;
      \tline-height: .5rem;
      \tmargin: 0;
      \tbackground-color: #202;
        box-shadow: 0 0 20px 0 rgba(14, 0, 18, 0.6);
      }

\t\t\t.max-w-6xl {
\t\t\t    max-width: 95%;
\t\t\t}

\t\t\t.prose :where(hr):not(:where(.not-prose)) {
\t\t\t    border-top-width: 1px;
\t\t\t    margin-bottom: .25em;
\t\t\t    margin-top: .25em;
\t\t\t}
\t\t\t
\t\t\t.katex-display {
\t\t\t    display: block;
\t\t\t    margin: 0.25em 0;
\t\t\t    text-align: center;
\t\t\t}
\t\t\t
      div.relative.mt-5 {
      \th3 {
          \twidth: 90% !important;
          \tpadding: .25rem 1rem !important;
            box-shadow: 0 0 20px 0 rgba(14, 0, 18, 0.6);
            line-height: .5rem;
          \tbackground-color: #202;
      \t}
      }

      .flex-row-reverse {
      \tflex-direction: row;
      }

      .mr-1 .rounded-xl .items-center .text-sm {
      \tcolor: #f0f;
      \tfont-size: 1.25rem;
      \tline-height: 1rem;
      \tborder-color: #f0f;
      }

      .mr-1 .rounded-xl .items-center {
      \tcolor: #f0f;
      \tborder-color: #f0f;
      }

      .rounded-xl .items-center {
      \tcolor: #f0f;
      \tborder-color: #f0f;
      }

      .highlighted {
      \tpadding: 3px;
      \tmargin: -7px 0;
      \tfont-weight: bold !important; /* Optionally make it bold */
      }

      .p-2 {
      \tpadding: 0.25rem;
      }

      .text-sm {
      \tfont-size: 0.75rem;
      \tline-height: 1rem;
      }

      .mx-auto {
      \t// Center the container
      \tmargin-left: auto;
      \tmargin-right: auto;
      }

      .flex {
      \tdisplay: flex;
      }

      .flex-1 {
      \tflex: 1; // Make the container take up available space
      }

      .gap-4 {
      \tgap: 1rem; // You can tweak this if needed
      }

      .md\\:gap-5 {
      \t@media (min-width: 768px) {
      \t\tgap: 1.25rem;
      \t}
      }

      .lg\\:gap-6 {
      \t@media (min-width: 1024px) {
      \t\tgap: 1.5rem;
      \t}
      }

      .md\\:max-w-3xl,
      .lg\\:max-w-\\[40rem\\],
      .xl\\:max-w-\\[48rem\\] {
      \t// Remove restrictive maximum widths for wider display
      \t@media (min-width: 768px) {
      \t\tmax-width: 90%;
      \t}
      }

      // Ensure the container always takes 90% of the available width
      .group\\/conversation-turn {
      \twidth: 90%;
      \tmargin-left: auto;
      \tmargin-right: auto;
      }

      // Other layout tweaks to ensure consistent appearance
      .flex-shrink-0 {
      \tflex-shrink: 0;
      }

      .min-w-0 {
      \tmin-width: 0;
      }

      .items-end {
      \talign-items: flex-end;
      }

      // Styling for the content, avatar, and chat bubbles, ensuring they are properly aligned and readable
      .gizmo-bot-avatar {
      \twidth: 90%; // Adjust avatar width to 90% of its container (optional, depending on design)
      }

      // Any additional rules to override padding/margin if necessary
      .p-1 {
      \tpadding: 0.25rem; // Optional: can adjust padding if more/less spacing is desired
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
