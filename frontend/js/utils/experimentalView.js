// Local, opt-in workspace layout. The standard view remains the default.
const storageKey = 'bitlab-experimental-view';
let enabled = false;
try { enabled = localStorage.getItem(storageKey) === 'true'; } catch { /* Storage can be unavailable. */ }

export function isExperimentalView() { return enabled; }

function applyPreference() {
    document.documentElement.classList.toggle('experimental-view', enabled);
    document.querySelectorAll('#experimental-view-toggle').forEach(button => {
        button.setAttribute('aria-checked', String(enabled));
    });
}

export function setupExperimentalViewToggle() {
    applyPreference();
    const button = document.getElementById('experimental-view-toggle');
    if (!button || button.dataset.bound) return;
    button.dataset.bound = 'true';
    button.addEventListener('click', event => {
        event.stopPropagation();
        enabled = !enabled;
        try { localStorage.setItem(storageKey, String(enabled)); } catch { /* Keep the choice for this page. */ }
        applyPreference();
        window.dispatchEvent(new CustomEvent('experimentalviewchange', { detail: { enabled } }));
        button.closest('.user-menu')?.classList.remove('active');
    });
}

export function setupExperimentalWorkspace(onResize) {
    const editor = document.querySelector('.editor-container');
    const results = document.querySelector('.results-container');
    const applyLayout = () => {
        if (!editor || !results) return;
        let saved;
        try { saved = localStorage.getItem(enabled ? 'experimental-workspace-editor-height' : 'workspace-editor-height'); } catch { /* Use defaults. */ }
        const height = Number(saved);
        editor.style.flex = height >= 200 ? `0 0 ${height}px` : enabled ? '2 1 0' : '';
        results.style.flex = height >= 200 || enabled ? '1 1 0' : '';
        requestAnimationFrame(() => onResize?.());
    };
    const workspace = document.getElementById('workspace-screen');
    const resultsHeader = document.querySelector('.results-header');
    if (workspace && resultsHeader) {
        const statsButton = document.createElement('button');
        statsButton.type = 'button';
        statsButton.className = 'experimental-statistics-toggle';
        statsButton.textContent = 'Statistics';
        statsButton.setAttribute('aria-controls', 'statistics-panel');
        statsButton.setAttribute('aria-expanded', 'false');
        let resultsScroll = 0;
        statsButton.addEventListener('click', () => {
            const content = document.querySelector('.results-content');
            if (!workspace.classList.contains('experimental-stats-open')) resultsScroll = content?.scrollTop || 0;
            const open = workspace.classList.toggle('experimental-stats-open');
            statsButton.setAttribute('aria-expanded', String(open));
            if (open) document.getElementById('statistics-panel')?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
            else content?.scrollTo({top: resultsScroll, behavior: 'instant'});
        });
        resultsHeader.appendChild(statsButton);
    }
    const description = document.getElementById('exercise-description');
    const applyHints = () => {
        if (!description) return;
        [...description.children].filter(element => /^H[1-6]$/.test(element.tagName) && element.textContent.trim().toLowerCase() === 'hint').forEach(heading => {
            const details = document.createElement('details');
            details.className = 'exercise-hint';
            const summary = document.createElement('summary');
            heading.before(details);
            summary.appendChild(heading);
            details.appendChild(summary);
            details.addEventListener('toggle', () => {
                if (details.open) window.dispatchEvent(new CustomEvent('exercisehintopened'));
            });
            while (details.nextElementSibling && !/^H[1-6]$/.test(details.nextElementSibling.tagName) && !/^Difficulty:/.test(details.nextElementSibling.textContent.trim())) {
                details.appendChild(details.nextElementSibling);
            }
        });
    };
    applyLayout();
    applyHints();
    if (description) new MutationObserver(applyHints).observe(description, {childList: true});
    window.addEventListener('experimentalviewchange', () => { applyLayout(); applyHints(); });
}

applyPreference();
window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    try { enabled = localStorage.getItem(storageKey) === 'true'; } catch { enabled = false; }
    applyPreference();
    window.dispatchEvent(new CustomEvent('experimentalviewchange', { detail: { enabled } }));
});
