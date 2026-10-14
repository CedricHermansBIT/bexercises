import { buildUrl } from './navigationUtils.js';
import { renderAvatar } from './avatarRenderer.js';

const wardrobeUrl = new URL('../../assets/avatars/wardrobe.glb', import.meta.url).href;
let portraits, ownSelection, ownRequest;
const painted = new WeakMap();
function portraitRenderer() {
    portraits ||= import('../vendor/avatar3d.bundle.js').then(module => module.createAvatarPortraitRenderer(wardrobeUrl));
    return portraits;
}
export async function paintAvatar(element, selection, name = 'Character') {
    if (!selection) return;
    const token = {}; painted.set(element, token);
    element.innerHTML = renderAvatar(selection, name);
    try {
        const renderer = await portraitRenderer();
        if (!element.isConnected || painted.get(element) !== token) return;
        const picture = new Image(); picture.alt = name; picture.src = renderer.render(selection);
        element.replaceChildren(picture);
    } catch { /* Local character artwork remains available without WebGL. */ }
}

async function showCharacter(selection, name, trigger) {
    const dialog = document.createElement('dialog'); dialog.className = 'character-dialog';
    const title = document.createElement('h2'); title.textContent = `${name}’s character`;
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.className = 'dropdown-item';
    const stage = document.createElement('div'); stage.className = 'character-dialog-stage';
    const hint = document.createElement('p'); hint.textContent = 'Drag to rotate · Scroll to zoom';
    dialog.append(title, stage, hint, close); document.body.append(dialog);
    let viewer, closed = false;
    dialog.addEventListener('close', () => { closed = true; viewer?.dispose(); dialog.remove(); trigger?.focus(); }, { once: true });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.showModal(); close.focus(); stage.innerHTML = renderAvatar(selection, name);
    try {
        const { createAvatarViewer } = await import('../vendor/avatar3d.bundle.js');
        if (closed) return;
        viewer = await createAvatarViewer(stage, wardrobeUrl, selection);
        if (closed) viewer.dispose();
    } catch { hint.textContent = '3D preview is unavailable on this device.'; }
}

let rankingObserver;
export function paintRankingAvatars(container, users) {
    rankingObserver?.disconnect();
    const byId = new Map(users.map(user => [String(user.id), user]));
    rankingObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const button = entry.target, user = byId.get(button.closest('[data-user-id]').dataset.userId);
            void paintAvatar(button, user.avatar, `${user.display_name || 'Anonymous'}’s character`);
            rankingObserver.unobserve(button);
        }
    }, { rootMargin: '150px' });
    for (const button of container.querySelectorAll('.ranking-avatar')) {
        const user = byId.get(button.closest('[data-user-id]').dataset.userId);
        if (!user?.avatar) { button.hidden = true; continue; }
        button.setAttribute('aria-label', `View ${user.display_name || 'Anonymous'}’s character`);
        button.innerHTML = renderAvatar(user.avatar, 'Character');
        button.addEventListener('click', () => void showCharacter(user.avatar, user.display_name || 'Anonymous', button));
        rankingObserver.observe(button);
    }
}

function refreshMenus() {
    const menus = document.querySelectorAll('.user-menu');
    for (const menu of menus) {
        if (menu.dataset.avatarReady) continue;
        const dropdown = menu.querySelector('.user-dropdown');
        if (!dropdown) continue;
        menu.dataset.avatarReady = 'true';
        menu.addEventListener('keydown', event => {
            if (event.key === 'Escape') { menu.classList.remove('active'); menu.querySelector('.user-icon')?.focus(); }
        });
        const link = document.createElement('a'); link.className = 'dropdown-item character-studio-link';
        link.href = buildUrl('/pages/avatar.html'); link.textContent = '✦ Character studio';
        link.addEventListener('click', event => event.stopPropagation());
        dropdown.prepend(link);
        const icon = menu.querySelector('.user-icon');
        if (icon) {
            icon.classList.add('account-avatar'); icon.setAttribute('aria-label', 'Account settings');
            icon.tabIndex = 0; icon.setAttribute('role', 'button'); icon.setAttribute('aria-haspopup', 'true');
            icon.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); icon.click(); }
                if (event.key === 'Escape') menu.classList.remove('active');
            });
        }
    }
    if (!menus.length) return;
    ownRequest ||= fetch(buildUrl('/api/avatar/appearance')).then(response => response.ok ? response.json() : null).then(state => {
        if (state && !ownSelection) ownSelection = state.selection;
        for (const icon of document.querySelectorAll('.account-avatar')) {
            if (ownSelection && !painted.has(icon)) void paintAvatar(icon, ownSelection, 'Your character');
        }
    }).catch(() => {});
    if (ownSelection) for (const icon of document.querySelectorAll('.account-avatar')) {
        if (!painted.has(icon)) void paintAvatar(icon, ownSelection, 'Your character');
    }
}
function init() {
    const style = document.createElement('link'); style.rel = 'stylesheet';
    style.href = new URL('../../avatarIdentity.css', import.meta.url).href; document.head.append(style);
    refreshMenus();
    new MutationObserver(refreshMenus).observe(document.body, { childList: true, subtree: true });
}
window.addEventListener('avatar-saved', event => {
    ownSelection = event.detail;
    for (const icon of document.querySelectorAll('.account-avatar')) void paintAvatar(icon, ownSelection, 'Your character');
});
window.addEventListener('pagehide', () => { portraits?.then(renderer => renderer.dispose()).catch(() => {}); portraits = null; });
window.addEventListener('pageshow', event => {
    if (event.persisted) { ownRequest = null; ownSelection = null; for (const icon of document.querySelectorAll('.account-avatar')) painted.delete(icon); refreshMenus(); }
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
