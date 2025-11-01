// frontend/js/utils/resizeUtils.js
/**
 * Utility for making sidebars resizable
 */

/**
 * Make a sidebar resizable by dragging
 * @param {string} handleSelector - Selector for the resize handle element
 * @param {string} sidebarSelector - Selector for the sidebar element
 * @param {string} cssVarName - CSS variable name to update (e.g., '--admin-sidebar-width')
 * @param {number} minWidth - Minimum width in pixels
 * @param {number} maxWidth - Maximum width in pixels
 * @param {string} storageKey - localStorage key to persist width
 */
export function makeResizable(handleSelector, sidebarSelector, cssVarName, minWidth = 200, maxWidth = 800, storageKey = null) {
	const handle = document.querySelector(handleSelector);
	const sidebar = document.querySelector(sidebarSelector);
	
	if (!handle || !sidebar) {
		console.warn(`Resize setup failed - handle: ${!!handle}, sidebar: ${!!sidebar} for ${handleSelector}`);
		return;
	}
	
	//console.log(`Setting up resize for ${sidebarSelector}`);

	// Load saved width from localStorage
	if (storageKey) {
		const savedWidth = localStorage.getItem(storageKey);
		if (savedWidth) {
			document.documentElement.style.setProperty(cssVarName, savedWidth + 'px');
			handle.style.left = `calc(${savedWidth}px - 5px)`;
			//console.log(`Loaded saved width: ${savedWidth}px for ${cssVarName}`);
		}
	}
	
	let isResizing = false;
	let startX = 0;
	let startWidth = 0;
	
	handle.addEventListener('mousedown', (e) => {
		//console.log('Resize started');
		isResizing = true;
		startX = e.clientX;
		startWidth = sidebar.offsetWidth;
		
		handle.classList.add('resizing');
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		
		e.preventDefault();
		e.stopPropagation();
	});
	
	document.addEventListener('mousemove', (e) => {
		if (!isResizing) return;
		
		const delta = e.clientX - startX;
		let newWidth = startWidth + delta;
		
		// Constrain within min/max
		newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
		
		// Update CSS variable
		document.documentElement.style.setProperty(cssVarName, newWidth + 'px');

		// Update handle position
		handle.style.left = `calc(${newWidth}px - 5px)`;

		e.preventDefault();
	});
	
	document.addEventListener('mouseup', () => {
		if (isResizing) {
			//console.log('Resize ended');
			isResizing = false;
			handle.classList.remove('resizing');
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			
			// Save to localStorage
			if (storageKey) {
				const currentWidth = sidebar.offsetWidth;
				localStorage.setItem(storageKey, currentWidth);
				//console.log(`Saved width: ${currentWidth}px`);
			}
		}
	});
}

/**
 * Make panels vertically resizable by dragging
 * @param {string} handleSelector - Selector for the resize handle element
 * @param {string} topPanelSelector - Selector for the top panel element
 * @param {string} bottomPanelSelector - Selector for the bottom panel element
 * @param {number} minTopHeight - Minimum height for top panel in pixels
 * @param {number} minBottomHeight - Minimum height for bottom panel in pixels
 * @param {string} storageKey - localStorage key to persist height split
 * @param {Function} onResize - Callback function called during resize (optional)
 */
export function makeVerticallyResizable(handleSelector, topPanelSelector, bottomPanelSelector, minTopHeight = 200, minBottomHeight = 150, storageKey = null, onResize = null) {
	const handle = document.querySelector(handleSelector);
	const topPanel = document.querySelector(topPanelSelector);
	const bottomPanel = document.querySelector(bottomPanelSelector);

	if (!handle || !topPanel || !bottomPanel) {
		console.warn(`Vertical resize setup failed - handle: ${!!handle}, top: ${!!topPanel}, bottom: ${!!bottomPanel}`);
		return;
	}

	//console.log(`Setting up vertical resize for ${topPanelSelector} and ${bottomPanelSelector}`);

	// Load saved height from localStorage
	if (storageKey) {
		const savedHeight = localStorage.getItem(storageKey);
		if (savedHeight) {
			topPanel.style.flex = `0 0 ${savedHeight}px`;
			bottomPanel.style.flex = `1 1 auto`;
			//console.log(`Loaded saved top panel height: ${savedHeight}px`);

			// Trigger resize callback if provided (for CodeMirror refresh)
			if (onResize && typeof onResize === 'function') {
				// Wait a bit for the DOM to settle before calling the callback
				setTimeout(() => onResize(), 100);
			}
		}
	}

	let isResizing = false;
	let startY = 0;
	let startTopHeight = 0;
	let startBottomHeight = 0;

	handle.addEventListener('mousedown', (e) => {
		//console.log('Vertical resize started');
		isResizing = true;
		startY = e.clientY;
		startTopHeight = topPanel.offsetHeight;
		startBottomHeight = bottomPanel.offsetHeight;

		handle.classList.add('resizing');
		document.body.style.cursor = 'row-resize';
		document.body.style.userSelect = 'none';

		e.preventDefault();
		e.stopPropagation();
	});

	document.addEventListener('mousemove', (e) => {
		if (!isResizing) return;

		const deltaY = e.clientY - startY;
		let newTopHeight = startTopHeight + deltaY;
		let newBottomHeight = startBottomHeight - deltaY;

		// Constrain within min heights
		if (newTopHeight >= minTopHeight && newBottomHeight >= minBottomHeight) {
			topPanel.style.flex = `0 0 ${newTopHeight}px`;
			bottomPanel.style.flex = `1 1 auto`;

			// Call optional resize callback
			if (onResize && typeof onResize === 'function') {
				onResize();
			}
		}

		e.preventDefault();
	});

	document.addEventListener('mouseup', () => {
		if (isResizing) {
			//console.log('Vertical resize ended');
			isResizing = false;
			handle.classList.remove('resizing');
			document.body.style.cursor = '';
			document.body.style.userSelect = '';

			// Save to localStorage
			if (storageKey) {
				const currentHeight = topPanel.offsetHeight;
				localStorage.setItem(storageKey, currentHeight);
				//console.log(`Saved top panel height: ${currentHeight}px`);
			}
		}
	});
}

/**
 * Initialize all resizable sidebars on the page
 */
export function initializeResizableSidebars() {
	// Admin sidebar
	if (document.querySelector('.admin-layout .resize-handle')) {
		makeResizable(
			'.admin-layout .resize-handle',
			'.admin-sidebar',
			'--admin-sidebar-width',
			250,
			600,
			'admin-sidebar-width'
		);
	}
	
	// Workspace sidebar
	if (document.querySelector('.workspace-layout .resize-handle')) {
		makeResizable(
			'.workspace-layout .resize-handle',
			'.workspace-sidebar',
			'--workspace-sidebar-width',
			250,
			800,
			'workspace-sidebar-width'
		);
	}
}

