// Categorize by rename chats and writing between brackets like so: [catagory]

document.addEventListener('DOMContentLoaded', () => {
	repeater();
	initializeMutationObserver();
});

function initializeMutationObserver() {
	const targetNode = document.querySelector(
		'.relative.grow.overflow-hidden.whitespace-nowrap'
	);
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

	setTimeout(() => {
		clearInterval(firstInterval);
		setInterval(checkAndReplaceText, 30000);
		setInterval(sortLists, 30000);
	}, 10000);
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

	olListsToCategorize.forEach((ol) => {
		const listItems = ol.querySelectorAll('li');
		listItems.forEach((item) => {
			if (processedItems.has(item)) return;

			const category = item.getAttribute('data-category');
			const clonedItem = item.cloneNode(true); // Clone the item to avoid issues with re-using DOM nodes

			if (category) {
				if (!categories[category]) categories[category] = [];
				categories[category].push(clonedItem);
			} else {
				uncategorizedItems.push(clonedItem);
			}

			// Mark the original item as processed
			processedItems.add(item);
		});
	});

	// Create a document fragment to hold new categorized <ol> elements
	const fragment = document.createDocumentFragment();

	// Create new <ol> elements for each category and add categorized items
	for (const category in categories) {
		const newOlContainer = createCategoryContainer(
			category,
			categories[category]
		);
		fragment.appendChild(newOlContainer);
	}

	// Create an "Uncategorized" <ol> for items that didn't match any category
	if (uncategorizedItems.length > 0) {
		const uncategorizedOlContainer = createCategoryContainer(
			'Uncategorized',
			uncategorizedItems
		);
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
}

function createCategoryContainer(category, items) {
	const newOlContainer = document.createElement('div');
	newOlContainer.className = 'relative mt-5 first:mt-0 last:mb-5';

	const categoryHeader = document.createElement('h3');
	categoryHeader.className =
		'sticky bg-token-sidebar-surface-primary top-0 z-20 flex h-9 items-center px-2 text-xs font-semibold text-ellipsis overflow-hidden break-all pt-3 pb-2 text-token-text-primary';
	categoryHeader.textContent = `Category: ${category}`;
	newOlContainer.appendChild(categoryHeader);

	const newOl = document.createElement('ol');
	items.forEach((item) => newOl.appendChild(item));
	newOlContainer.appendChild(newOl);

	return newOlContainer;
}
