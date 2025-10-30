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
		console.warn('Resize handle or sidebar not found');
		return;
	}
	
	// Load saved width from localStorage
	if (storageKey) {
		const savedWidth = localStorage.getItem(storageKey);
		if (savedWidth) {
			document.documentElement.style.setProperty(cssVarName, savedWidth + 'px');
		}
	}
	
	let isResizing = false;
	let startX = 0;
	let startWidth = 0;
	
	handle.addEventListener('mousedown', (e) => {
		isResizing = true;
		startX = e.clientX;
		startWidth = sidebar.offsetWidth;
		
		handle.classList.add('resizing');
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		
		e.preventDefault();
	});
	
	document.addEventListener('mousemove', (e) => {
		if (!isResizing) return;
		
		const delta = e.clientX - startX;
		let newWidth = startWidth + delta;
		
		// Constrain within min/max
		newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
		
		// Update CSS variable
		document.documentElement.style.setProperty(cssVarName, newWidth + 'px');
	});
	
	document.addEventListener('mouseup', () => {
		if (isResizing) {
			isResizing = false;
			handle.classList.remove('resizing');
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			
			// Save to localStorage
			if (storageKey) {
				const currentWidth = sidebar.offsetWidth;
				localStorage.setItem(storageKey, currentWidth);
			}
		}
	});
}

/**
 * Initialize all resizable sidebars on the page
 */
export function initializeResizableSidebars() {
	// Admin sidebar
	if (document.querySelector('.admin-sidebar .resize-handle')) {
		makeResizable(
			'.admin-sidebar .resize-handle',
			'.admin-sidebar',
			'--admin-sidebar-width',
			250,
			600,
			'admin-sidebar-width'
		);
	}
	
	// Workspace sidebar
	if (document.querySelector('.workspace-sidebar .resize-handle')) {
		makeResizable(
			'.workspace-sidebar .resize-handle',
			'.workspace-sidebar',
			'--workspace-sidebar-width',
			250,
			800,
			'workspace-sidebar-width'
		);
	}
}

