document.addEventListener('DOMContentLoaded', () => {
    repeater();
    initializeMutationObserver();
    initializeButtonClickListeners();
});

function initializeMutationObserver() {
    const targetNode = document.querySelector('.relative.grow.overflow-hidden.whitespace-nowrap');
    const config = { childList: true, subtree: true, characterData: true };

    const callback = (mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                checkAndReplaceText();
            }
        }
    };

    if (targetNode) {
        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);
    }
}

function repeater() {
    const firstInterval = setInterval(checkAndReplaceText, 1000);
		const firstSort = setInterval(sortLists, 4500);
    setTimeout(() => {
        clearInterval(firstInterval);
        clearInterval(firstSort);
        setInterval(checkAndReplaceText, 30000);
        setInterval(sortLists, 30000);
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

    // Load color assignments from localStorage
    const wordColors = JSON.parse(localStorage.getItem('wordColors')) || {};

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
            divElement.closest('li').setAttribute('data-category', match[1].trim());
        }

        divElement.innerHTML = newText;
    });

    localStorage.setItem('wordColors', JSON.stringify(wordColors));
}

function sortLists() {
    const categories = {};
    const uncategorizedItems = [];
    const listContainer = document.querySelector('.flex.flex-col.gap-2.pb-2');

    if (!listContainer) return;

    // Find all <ol> elements that need to be categorized
    const originalOlLists = listContainer.querySelectorAll('ol');
    const olListsToCategorize = Array.from(originalOlLists).slice(1); // Skip first <ol> if needed

    // Track already processed items to avoid duplicates
    const processedItems = new Set();
    const wordColors = JSON.parse(localStorage.getItem('wordColors')) || {};

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

            // Mark the original item as processed
            processedItems.add(item);
        });
    });

    // Create a document fragment to hold new categorized <ol> elements
    const fragment = document.createDocumentFragment();

    // Create new <ol> elements for each category and add categorized items
    for (const category in categories) {
        const newOlContainer = createCategoryContainer(category, categories[category], wordColors[category]);
        fragment.appendChild(newOlContainer);
    }

    // Create an "Uncategorized" <ol> for items that didn't match any category
    if (uncategorizedItems.length > 0) {
        const uncategorizedOlContainer = createCategoryContainer('Uncategorized', uncategorizedItems);
        fragment.appendChild(uncategorizedOlContainer);
    }

    // Clear all existing <ol> elements from the container, except the first one
    listContainer.querySelectorAll('ol').forEach((ol, index) => {
        if (index > 0) {
            ol.parentElement.remove();
        }
    });

    // Append the new organized <ol> elements to the list container
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
    categoryHeader.textContent = `Category: ${category}`;

    // Set the color if available
    if (color) {
        categoryHeader.style.color = color;
        categoryHeader.style.border = `1px dotted ${color}`;
    }

    newOlContainer.appendChild(categoryHeader);

    const newOl = document.createElement('ol');
    items.forEach((item) => newOl.appendChild(item));
    newOlContainer.appendChild(newOl);

    return newOlContainer;
}


function initializeButtonClickListeners() {
    const listContainer = document.querySelector('.flex.flex-col.gap-2.pb-2');
    if (!listContainer) return;

    listContainer.addEventListener('click', (event) => {
        // Check if the clicked element is a button or inside a button
        const button = event.target.closest('button');
        if (button) {
            // Handle button click
            handleButtonClick(button);
        }
    });
}

function handleButtonClick(button) {
    // Custom logic for button click
    console.log(`Button with ID ${button.id} was clicked!`);
    // You can add more functionality here as needed
}

function reinitializeDropdowns() {
    // Assuming the dropdown library needs to be reinitialized after DOM changes.
    // If you are using a library like Radix or similar, you need to re-run their initialization methods here.
    // This part is dependent on the specific dropdown library you use.

    // Example for reinitializing dropdowns:
    document.querySelectorAll('[data-radix-menu-content]').forEach(dropdown => {
        // Custom initialization logic or library-specific re-attach logic
        // Placeholder code; adjust according to your dropdown/popup library
    });
}
