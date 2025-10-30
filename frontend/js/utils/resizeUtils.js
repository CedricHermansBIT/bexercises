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
	
	console.log(`Setting up resize for ${sidebarSelector}`);

	// Load saved width from localStorage
	if (storageKey) {
		const savedWidth = localStorage.getItem(storageKey);
		if (savedWidth) {
			document.documentElement.style.setProperty(cssVarName, savedWidth + 'px');
			handle.style.left = `calc(${savedWidth}px - 5px)`;
			console.log(`Loaded saved width: ${savedWidth}px for ${cssVarName}`);
		}
	}
	
	let isResizing = false;
	let startX = 0;
	let startWidth = 0;
	
	handle.addEventListener('mousedown', (e) => {
		console.log('Resize started');
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
			console.log('Resize ended');
			isResizing = false;
			handle.classList.remove('resizing');
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			
			// Save to localStorage
			if (storageKey) {
				const currentWidth = sidebar.offsetWidth;
				localStorage.setItem(storageKey, currentWidth);
				console.log(`Saved width: ${currentWidth}px`);
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

