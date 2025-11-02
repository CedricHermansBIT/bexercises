// frontend/js/pages/admin/filesPage.js
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setupAdminCommon, formatFileSize, escapeHtml } from './adminUtils.js';
import { setFavicon } from '../../utils/faviconUtils.js';

class FilesPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();

        window.authComponent = this.authComponent;

        this.files = [];
        this.exercises = [];

        this.init();
    }

    async init() {
        // Check authentication
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            navigateTo('login.html');
            return;
        }

        // Check admin privileges
        if (!this.authComponent.isAdmin()) {
            alert('Access denied. Admin privileges required.');
            navigateTo('languages.html');
            return;
        }

        setFavicon();

        // Initialize notification banner
        await this.notificationBanner.init();

        // Setup common admin functionality
        setupAdminCommon(this.authComponent);

        // Load exercises (needed for usage count)
        await this.loadExercises();

        // Load files
        await this.loadFiles();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        const uploadBtn = document.getElementById('upload-file-btn');
        const fileInput = document.getElementById('file-upload-input');

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', async (e) => {
                await this.handleFileUpload(e);
            });
        }

        const uploadFolderBtn = document.getElementById('upload-folder-btn');
        const folderInput = document.getElementById('folder-upload-input');

        if (uploadFolderBtn && folderInput) {
            uploadFolderBtn.addEventListener('click', () => {
                folderInput.click();
            });

            folderInput.addEventListener('change', async (e) => {
                await this.handleFileUpload(e);
            });
        }

        const createFolderBtn = document.getElementById('create-folder-btn');
        if (createFolderBtn) {
            createFolderBtn.addEventListener('click', () => {
                this.createFolder();
            });
        }

        const syncDbBtn = document.getElementById('sync-db-btn');
        if (syncDbBtn) {
            syncDbBtn.addEventListener('click', async () => {
                await this.syncDatabase();
            });
        }

        const closeViewerBtn = document.getElementById('close-file-viewer');
        if (closeViewerBtn) {
            closeViewerBtn.addEventListener('click', () => {
                document.getElementById('file-viewer').style.display = 'none';
                document.getElementById('admin-welcome').style.display = 'flex';
            });
        }
    }

    async loadFiles() {
        try {
            this.files = await this.apiService.getFixtureFiles();
            this.renderFilesList();
        } catch (error) {
            console.error('Failed to load files:', error);
        }
    }

    async loadExercises() {
        try {
            this.exercises = await this.apiService.getAdminExercises();
        } catch (error) {
            console.error('Failed to load exercises:', error);
        }
    }

    renderFilesList() {
        const list = document.getElementById('files-list');
        if (!list) return;

        list.innerHTML = '';

        if (this.files.length === 0) {
            list.innerHTML = '<p class="no-files">No files uploaded yet</p>';
            return;
        }

        // Build hierarchical structure
        const hierarchy = this.buildFileHierarchy(this.files);

        // Render the hierarchy
        this.renderHierarchy(hierarchy, list, 0);
    }

    buildFileHierarchy(files) {
        const root = { type: 'root', children: {}, files: [] };

        files.forEach(file => {
            if (file.type === 'folder') {
                // It's a folder entry
                const parts = file.filename.split('/');
                let current = root;

                parts.forEach((part, index) => {
                    if (part) { // Skip empty parts
                        if (!current.children[part]) {
                            current.children[part] = {
                                type: 'folder',
                                name: part,
                                fullPath: parts.slice(0, index + 1).join('/'),
                                children: {},
                                files: [],
                                folderData: file
                            };
                        }
                        current = current.children[part];
                    }
                });
            } else {
                // It's a file
                const parts = file.filename.split('/');
                if (parts.length === 1) {
                    // Root level file
                    root.files.push(file);
                } else {
                    // File in a folder
                    let current = root;
                    const fileName = parts.pop();

                    parts.forEach((part, index) => {
                        if (!current.children[part]) {
                            current.children[part] = {
                                type: 'folder',
                                name: part,
                                fullPath: parts.slice(0, index + 1).join('/'),
                                children: {},
                                files: []
                            };
                        }
                        current = current.children[part];
                    });

                    current.files.push(file);
                }
            }
        });

        return root;
    }

    renderHierarchy(node, container, depth) {
        // Render folders first
        Object.keys(node.children).sort().forEach(key => {
            const folder = node.children[key];
            this.renderFolder(folder, container, depth);
        });

        // Then render files at this level
        node.files.forEach(file => {
            this.renderFile(file, container, depth);
        });
    }

    renderFolder(folder, container, depth) {
        const item = document.createElement('div');
        item.className = 'file-item folder-item';
        item.style.paddingLeft = `${1 + depth * 1.5}rem`;
        item.dataset.folder = folder.fullPath;

        const fileCount = this.countFilesInFolder(folder);
        const usageCount = this.getFileUsageCount(folder.fullPath + '/');
        const usageText = usageCount > 0 ? `Used in ${usageCount} test case${usageCount !== 1 ? 's' : ''}` : '';

        item.innerHTML = `
            <div class="file-info">
                <div class="file-name">
                    <span class="folder-toggle">📁</span> ${escapeHtml(folder.name)}
                </div>
                <div class="file-size">${fileCount} item${fileCount !== 1 ? 's' : ''}</div>
                <div class="file-usage">${usageText}</div>
            </div>
            <div class="file-actions">
                <button class="icon-btn" data-action="upload-to-folder" data-folder="${escapeHtml(folder.fullPath)}" title="Upload Files to Folder">
                    <span>📤</span>
                </button>
                <button class="icon-btn delete" data-action="delete" data-filename="${escapeHtml(folder.fullPath + '/')}" title="Delete">
                    <span>🗑️</span>
                </button>
            </div>
        `;

        // Create container for folder contents
        const folderContents = document.createElement('div');
        folderContents.className = 'folder-contents';
        folderContents.style.display = 'none';

        // Toggle folder on click
        item.addEventListener('click', (e) => {
            if (e.target.closest('.icon-btn')) return;

            const isExpanded = folderContents.style.display !== 'none';
            folderContents.style.display = isExpanded ? 'none' : 'block';

            const toggle = item.querySelector('.folder-toggle');
            toggle.textContent = isExpanded ? '📁' : '📂';
        });

        // Upload to folder button
        item.querySelector('[data-action="upload-to-folder"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.uploadToFolder(folder.fullPath);
        });

        // Delete button
        item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteFile(folder.fullPath + '/');
        });

        container.appendChild(item);
        container.appendChild(folderContents);

        // Recursively render contents
        this.renderHierarchy(folder, folderContents, depth + 1);
    }

    renderFile(file, container, depth) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.style.paddingLeft = `${1 + depth * 1.5}rem`;

        const fileName = file.filename.split('/').pop();
        const usageCount = this.getFileUsageCount(file.filename);
        const usageText = usageCount > 0 ? `Used in ${usageCount} test case${usageCount !== 1 ? 's' : ''}` : 'Not used';

        // Display permissions if available
        const permissionsDisplay = file.permissions || 'rwxr-xr-x';

        item.innerHTML = `
            <div class="file-info">
                <div class="file-name">📄 ${escapeHtml(fileName)}</div>
                <div class="file-size">${formatFileSize(file.size || 0)} | ${permissionsDisplay}</div>
                <div class="file-usage">${usageText}</div>
            </div>
            <div class="file-actions">
                <button class="icon-btn" data-action="permissions" data-filename="${escapeHtml(file.filename)}" title="Edit Permissions">
                    <span>🔒</span>
                </button>
                <button class="icon-btn" data-action="view" data-filename="${escapeHtml(file.filename)}" title="View">
                    <span>👁️</span>
                </button>
                <button class="icon-btn delete" data-action="delete" data-filename="${escapeHtml(file.filename)}" title="Delete">
                    <span>🗑️</span>
                </button>
            </div>
        `;

        // Permissions button
        item.querySelector('[data-action="permissions"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.editFilePermissions(file.filename, file.permissions || 'rwxr-xr-x');
        });

        // View button
        item.querySelector('[data-action="view"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.viewFile(file.filename);
        });

        // Delete button
        item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteFile(file.filename);
        });

        container.appendChild(item);
    }

    countFilesInFolder(folder) {
        let count = folder.files.length;
        Object.values(folder.children).forEach(child => {
            count += this.countFilesInFolder(child);
        });
        return count;
    }

    async handleFileUpload(e) {
        const files = Array.from(e.target.files);

        for (const file of files) {
            try {
                // Check if the file has a webkitRelativePath (when uploading folders)
                const filePath = file.webkitRelativePath || file.name;
                const content = await this.readFileAsText(file);
                await this.apiService.uploadFixtureFile(filePath, content);
            } catch (error) {
                console.error(`Failed to upload ${file.name}:`, error);
                alert(`Failed to upload ${file.name}: ${error.message}`);
            }
        }

        // Clear input and reload
        e.target.value = '';
        await this.loadFiles();
    }

    uploadToFolder(folderPath) {
        // Create a temporary file input for this specific folder
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.style.display = 'none';

        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);

            for (const file of files) {
                try {
                    // Upload file with folder path prefix
                    const fullPath = `${folderPath}/${file.name}`;
                    const content = await this.readFileAsText(file);
                    await this.apiService.uploadFixtureFile(fullPath, content);
                } catch (error) {
                    console.error(`Failed to upload ${file.name}:`, error);
                    alert(`Failed to upload ${file.name}: ${error.message}`);
                }
            }

            // Remove temp input and reload
            document.body.removeChild(input);
            await this.loadFiles();
        });

        document.body.appendChild(input);
        input.click();
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    async syncDatabase() {
        if (!confirm('Sync database with filesystem? This will remove database entries for files that no longer exist on disk.')) {
            return;
        }

        try {
            const result = await this.apiService.syncFixtures();

            if (result.removedCount > 0) {
                alert(`✅ Database synced!\n\nRemoved ${result.removedCount} orphaned entries:\n\n${result.removedFiles.join('\n')}`);
            } else {
                alert('✅ Database is already in sync! No orphaned entries found.');
            }

            await this.loadFiles();
        } catch (error) {
            console.error('Failed to sync database:', error);
            alert('Failed to sync database: ' + error.message);
        }
    }

    async createFolder() {
        const folderName = prompt('Enter folder name:');
        if (!folderName || !folderName.trim()) return;

        try {
            await this.apiService.createFixtureFolder(folderName.trim());
            await this.loadFiles();
        } catch (error) {
            console.error('Failed to create folder:', error);
            alert('Failed to create folder: ' + error.message);
        }
    }

    async viewFile(filename) {
        try {
            const content = await this.apiService.getFixtureFileContent(filename);

            // Show file content in main panel
            document.getElementById('admin-welcome').style.display = 'none';
            document.getElementById('file-viewer').style.display = 'block';
            document.getElementById('file-viewer-title').textContent = filename;
            document.getElementById('file-content-display').textContent = content;

        } catch (error) {
            console.error('Failed to view file:', error);
            alert('Failed to view file: ' + error.message);
        }
    }

    async deleteFile(filename) {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) {
            return;
        }

        try {
            await this.apiService.deleteFixtureFile(filename);
            await this.loadFiles();
        } catch (error) {
            console.error('Failed to delete file:', error);
            alert('Failed to delete file: ' + error.message);
        }
    }

    async manageFolderContents(foldername) {
        // Show folder contents in the main panel
        try {
            const folderFiles = this.files.filter(f =>
                f.filename.startsWith(foldername + '/') && f.type !== 'folder'
            );

            document.getElementById('admin-welcome').style.display = 'none';
            document.getElementById('file-viewer').style.display = 'block';
            document.getElementById('file-viewer-title').textContent = `📁 ${foldername}`;

            if (folderFiles.length === 0) {
                document.getElementById('file-content-display').textContent = 'Empty folder';
            } else {
                const fileList = folderFiles.map(f => {
                    const size = formatFileSize(f.size || 0);
                    return `${f.filename} (${size})`;
                }).join('\n');
                document.getElementById('file-content-display').textContent = fileList;
            }
        } catch (error) {
            console.error('Failed to manage folder:', error);
            alert('Failed to manage folder: ' + error.message);
        }
    }

    async openFolder(folderName) {
        // Redirect to manageFolderContents
        this.manageFolderContents(folderName);
    }

    getFileUsageCount(filename) {
        let count = 0;

        this.exercises.forEach(ex => {
            if (ex.testCases && Array.isArray(ex.testCases)) {
                ex.testCases.forEach((tc) => {
                    // Count each test case only once, even if file appears in multiple fields
                    let foundInThisTestCase = false;

                    // Check fixtures array (legacy field)
                    if (!foundInThisTestCase && tc.fixtures && Array.isArray(tc.fixtures)) {
                        if (tc.fixtures.includes(filename)) {
                            foundInThisTestCase = true;
                        }
                    }

                    // Check arguments array
                    if (!foundInThisTestCase && tc.arguments && Array.isArray(tc.arguments)) {
                        if (tc.arguments.includes(filename)) {
                            foundInThisTestCase = true;
                        }
                    }

                    // Check input array (filenames might be in input for interactive scripts)
                    if (!foundInThisTestCase && tc.input && Array.isArray(tc.input)) {
                        if (tc.input.includes(filename)) {
                            foundInThisTestCase = true;
                        }
                    }

                    if (foundInThisTestCase) {
                        count++;
                    }
                });
            }
        });

        return count;
    }

    editFilePermissions(filename, currentPermissions) {
        // Create permission editor modal
        const modal = document.createElement('div');
        modal.className = 'permission-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;';

        // Parse current permissions (e.g., 'rwxr-xr-x' or '755')
        let ownerR = true, ownerW = true, ownerX = true;
        let groupR = true, groupW = false, groupX = true;
        let otherR = true, otherW = false, otherX = true;

        if (currentPermissions.includes('r') || currentPermissions.includes('w') || currentPermissions.includes('x')) {
            // String format like 'rwxr-xr-x'
            ownerR = currentPermissions[0] === 'r';
            ownerW = currentPermissions[1] === 'w';
            ownerX = currentPermissions[2] === 'x';
            groupR = currentPermissions[3] === 'r';
            groupW = currentPermissions[4] === 'w';
            groupX = currentPermissions[5] === 'x';
            otherR = currentPermissions[6] === 'r';
            otherW = currentPermissions[7] === 'w';
            otherX = currentPermissions[8] === 'x';
        }

        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: var(--border-radius); max-width: 500px; width: 90%;">
                <h3 style="margin-top: 0; color: var(--text-primary);">Edit Permissions: ${escapeHtml(filename)}</h3>
                
                <div style="margin: 1.5rem 0;">
                    <div style="margin-bottom: 1rem;">
                        <strong style="color: var(--text-primary);">Owner:</strong><br>
                        <label style="display: inline-block; margin-right: 1rem; color: var(--text-primary);">
                            <input type="checkbox" id="owner-r" ${ownerR ? 'checked' : ''}> Read
                        </label>
                        <label style="display: inline-block; margin-right: 1rem; color: var(--text-primary);">
                            <input type="checkbox" id="owner-w" ${ownerW ? 'checked' : ''}> Write
                        </label>
                        <label style="display: inline-block; color: var(--text-primary);">
                            <input type="checkbox" id="owner-x" ${ownerX ? 'checked' : ''}> Execute
                        </label>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <strong style="color: var(--text-primary);">Group:</strong><br>
                        <label style="display: inline-block; margin-right: 1rem; color: var(--text-primary);">
                            <input type="checkbox" id="group-r" ${groupR ? 'checked' : ''}> Read
                        </label>
                        <label style="display: inline-block; margin-right: 1rem; color: var(--text-primary);">
                            <input type="checkbox" id="group-w" ${groupW ? 'checked' : ''}> Write
                        </label>
                        <label style="display: inline-block; color: var(--text-primary);">
                            <input type="checkbox" id="group-x" ${groupX ? 'checked' : ''}> Execute
                        </label>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <strong style="color: var(--text-primary);">Others:</strong><br>
                        <label style="display: inline-block; margin-right: 1rem; color: var(--text-primary);">
                            <input type="checkbox" id="other-r" ${otherR ? 'checked' : ''}> Read
                        </label>
                        <label style="display: inline-block; margin-right: 1rem; color: var(--text-primary);">
                            <input type="checkbox" id="other-w" ${otherW ? 'checked' : ''}> Write
                        </label>
                        <label style="display: inline-block; color: var(--text-primary);">
                            <input type="checkbox" id="other-x" ${otherX ? 'checked' : ''}> Execute
                        </label>
                    </div>

                    <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <strong style="color: var(--text-primary);">Preview:</strong> 
                        <span id="permission-preview" style="color: var(--accent-blue); font-family: monospace; font-size: 1.1rem;"></span>
                    </div>
                </div>

                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="action-btn" id="cancel-permissions">Cancel</button>
                    <button class="action-btn primary" id="save-permissions">Save Permissions</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Update preview
        const updatePreview = () => {
            const r = (id) => modal.querySelector(`#${id}`).checked;
            const permStr =
                (r('owner-r') ? 'r' : '-') + (r('owner-w') ? 'w' : '-') + (r('owner-x') ? 'x' : '-') +
                (r('group-r') ? 'r' : '-') + (r('group-w') ? 'w' : '-') + (r('group-x') ? 'x' : '-') +
                (r('other-r') ? 'r' : '-') + (r('other-w') ? 'w' : '-') + (r('other-x') ? 'x' : '-');
            modal.querySelector('#permission-preview').textContent = permStr;
        };

        // Add listeners to update preview
        modal.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', updatePreview);
        });
        updatePreview();

        // Cancel button
        modal.querySelector('#cancel-permissions').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Save button
        modal.querySelector('#save-permissions').addEventListener('click', async () => {
            const r = (id) => modal.querySelector(`#${id}`).checked;
            const permStr =
                (r('owner-r') ? 'r' : '-') + (r('owner-w') ? 'w' : '-') + (r('owner-x') ? 'x' : '-') +
                (r('group-r') ? 'r' : '-') + (r('group-w') ? 'w' : '-') + (r('group-x') ? 'x' : '-') +
                (r('other-r') ? 'r' : '-') + (r('other-w') ? 'w' : '-') + (r('other-x') ? 'x' : '-');

            try {
                await this.apiService.setFilePermissions(filename, permStr);
                document.body.removeChild(modal);
                await this.loadFiles();
            } catch (error) {
                alert('Failed to set permissions: ' + error.message);
            }
        });

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    renderFolderContentsList(contents) {
        // Legacy method - no longer used
        return '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FilesPage();
});

