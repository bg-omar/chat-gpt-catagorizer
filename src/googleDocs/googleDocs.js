document.addEventListener('DOMContentLoaded', () => {
    // Only add the button to the main document
    if (window.top === window) {
        const activationButton = document.createElement('button');
        activationButton.textContent = 'Drag';
        activationButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 1000;
      padding: 10px 20px;
      font-size: 16px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    `;
        document.body.appendChild(activationButton);

        // Attach click event to the button
        activationButton.addEventListener('click', () => {
            const sidebar = document.querySelector('.script-application-sidebar');
            if (sidebar) {
                makeDraggable(sidebar);
            } else {
                alert('Sidebar not found. Ensure the plugin is activated.');
            }
        });
    }
});

function makeDraggable(element) {
    element.style.cssText += `
    position: fixed !important;
    top: 20px;
    right: 20px;
    z-index: 2000;
    cursor: move;
    width: 300px;
    height: 200px;
    overflow: hidden;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  `;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    // Add event listeners for dragging
    element.addEventListener('mousedown', (event) => {
        isDragging = true;
        offsetX = event.clientX - element.getBoundingClientRect().left;
        offsetY = event.clientY - element.getBoundingClientRect().top;
        document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    });

    document.addEventListener('mousemove', (event) => {
        if (isDragging) {
            element.style.left = `${event.clientX - offsetX}px`;
            element.style.top = `${event.clientY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = ''; // Re-enable text selection
    });
}
