document.addEventListener('DOMContentLoaded', () => {
  repeater();
  initializeMutationObserver();
  initializeButtonClickListeners();
});

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
      } catch (e) {
        console.error("Error in checkAndReplaceText interval after timeout:", e);
      }
    }, 30000);

    setInterval(() => {
      try {
        sortLists();
      } catch (e) {
        console.error("Error in sortLists interval after timeout:", e);
      }
    }, 30000);
  }, 20000);
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

  // Load color assignments from localStorage with error handling
  let wordColors = {};
  try {
    wordColors = JSON.parse(localStorage.getItem('wordColors')) || {};
  } catch (e) {
    console.error("Error parsing wordColors from localStorage:", e);
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

  // Save updated color assignments to localStorage
  try {
    localStorage.setItem('wordColors', JSON.stringify(wordColors));
  } catch (e) {
    console.error("Error saving wordColors to localStorage:", e);
  }
}

function sortLists() {
  const categories = {};
  const uncategorizedItems = [];
  const listContainer = document.querySelector('.flex.flex-col.gap-2.pb-2');
  if (!listContainer) return;

  // Find all <ol> elements that need to be categorized
  const originalOlLists = listContainer.querySelectorAll('ol');
  const olListsToCategorize = Array.from(originalOlLists).slice(1); // Skip first <ol> if needed

  const processedItems = new Set();
  let wordColors = {};

  try {
    wordColors = JSON.parse(localStorage.getItem('wordColors')) || {};
  } catch (e) {
    console.error("Error parsing wordColors from localStorage:", e);
  }

  olListsToCategorize.forEach((ol) => {
    const listItems = ol.querySelectorAll('li');
    listItems.forEach((item) => {
      if (processedItems.has(item)) return;

      const category = item.getAttribute('data-category');
      if (category) {
        if (!categories[category]) categories[category] = [];
        categories[category].push(item);
      } else {
        uncategorizedItems.push(item);
      }

      processedItems.add(item);
    });
  });

  const fragment = document.createDocumentFragment();

  for (const category in categories) {
    const newOlContainer = createCategoryContainer(category, categories[category], wordColors[category]);
    fragment.appendChild(newOlContainer);
  }

  if (uncategorizedItems.length > 0) {
    const uncategorizedOlContainer = createCategoryContainer('Uncategorized', uncategorizedItems);
    fragment.appendChild(uncategorizedOlContainer);
  }

  listContainer.querySelectorAll('ol').forEach((ol, index) => {
    if (index > 0) {
      ol.parentElement?.remove();
    }
  });

  listContainer.appendChild(fragment);

  initializeButtonClickListeners();
  reinitializeDropdowns();
}

function createCategoryContainer(category, items, color) {
  const newOlContainer = document.createElement('div');
  newOlContainer.className = 'relative mt-5 first:mt-0 last:mb-5';

  const categoryHeader = document.createElement('h3');
  categoryHeader.className =
    'sticky bg-token-sidebar-surface-primary top-0 z-20 flex h-9 items-center px-2 text-xs font-semibold text-ellipsis overflow-hidden break-all pt-3 pb-2 text-token-text-primary';
  categoryHeader.textContent = `Category: ${category}`;

  if (color) {
    categoryHeader.style.color = color;
    categoryHeader.style.border = `1px dotted ${color}`;
  }

  newOlContainer.appendChild(categoryHeader);

  const newOl = document.createElement('ol');
  items.forEach((item) => {
    if (document.body.contains(item)) {
      newOl.appendChild(item);
    }
  });
  newOlContainer.appendChild(newOl);

  return newOlContainer;
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
