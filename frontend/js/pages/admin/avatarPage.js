import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import Navbar from '../../components/navbar.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { renderAvatar } from '../../utils/avatarRenderer.js';

class AvatarPage {
    constructor() {
        this.api = new ApiService();
        this.auth = new AuthComponent(this.api);
        this.slot = 'character';
        this.saving = false;
        this.init();
    }
    status(message, error = false) {
        const status = document.getElementById('studio-status');
        status.textContent = message;
        status.dataset.error = String(error);
    }
    async init() {
        const authenticated = await this.auth.checkAuth();
        if (authenticated === null) return;
        if (!authenticated) return navigateTo('login.html');
        if (!this.auth.isAdmin()) return navigateTo('languages.html');
        const navbar = new Navbar();
        document.getElementById('navbar-container').innerHTML = navbar.render({ showBack: true,
            backUrl: 'admin/index.html', backText: 'admin', appTitle: 'Avatar studio', isAdminPage: true });
        void navbar.init(this.auth);
        try {
            this.state = await this.api._get('/api/admin/avatar');
            this.saved = { ...this.state.selection };
            this.selection = { ...this.saved };
            document.getElementById('studio-content').hidden = false;
            document.getElementById('wardrobe-tabs').addEventListener('click', event => {
                const button = event.target.closest('[data-slot]');
                if (!button) return;
                if (this.saving) return;
                this.slot = button.dataset.slot;
                this.render();
            });
            document.getElementById('avatar-save').addEventListener('click', () => this.save());
            document.getElementById('avatar-reset').addEventListener('click', () => {
                this.selection = { ...this.saved }; this.render(); this.status('Back to your saved look.');
            });
            this.render(); this.status('Your wardrobe is ready. Pick a character to get started.');
        } catch (error) { this.status(`Could not load your wardrobe: ${error.message}. Refresh to retry.`, true); }
    }
    lockedSelections() {
        return this.state.catalog.filter(item => this.selection[item.slot] === item.id && !item.unlocked);
    }
    render() {
        const character = this.state.catalog.find(item => item.id === this.selection.character);
        document.getElementById('avatar-preview').innerHTML = renderAvatar(this.selection, character.name);
        document.getElementById('avatar-name').textContent = character.name;
        document.getElementById('avatar-description').textContent = character.description;
        const unlocked = this.state.catalog.filter(item => item.unlocked).length;
        document.getElementById('avatar-progress').textContent = `${unlocked} / ${this.state.catalog.length} items unlocked · ${this.state.completed} exercises completed`;
        document.querySelectorAll('[data-slot]').forEach(button => {
            button.disabled = this.saving;
            button.setAttribute('aria-pressed', String(button.dataset.slot === this.slot));
        });
        document.getElementById('avatar-reset').disabled = this.saving;
        const grid = document.getElementById('wardrobe-items');
        grid.replaceChildren();
        this.state.catalog.filter(item => item.slot === this.slot).forEach(item => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'wardrobe-item'; button.disabled = this.saving;
            button.dataset.locked = String(!item.unlocked);
            button.setAttribute('aria-pressed', String(this.selection[this.slot] === item.id));
            button.setAttribute('aria-label', `${item.name}. ${item.unlocked ? 'Unlocked' : `Locked: ${item.requirement}. Preview only`}`);
            const picture = document.createElement('span'); picture.className = 'wardrobe-item-art';
            picture.setAttribute('aria-hidden', 'true');
            picture.innerHTML = renderAvatar({ ...this.selection, [this.slot]: item.id });
            const title = document.createElement('strong'); title.textContent = item.name;
            const state = document.createElement('span'); state.className = 'item-state'; state.textContent = item.unlocked ? 'Unlocked' : 'Locked · preview';
            const detail = document.createElement('small'); detail.textContent = item.unlocked ? 'Ready to wear' : item.requirement;
            if (!item.unlocked && item.progress !== null) detail.textContent += ` · ${item.progress}/${item.completions}`;
            button.append(picture, title, state, detail);
            button.addEventListener('click', () => {
                this.selection[this.slot] = item.id; this.render();
                const locked = this.lockedSelections();
                this.status(locked.length ? `Preview only. ${locked.map(item => item.requirement).join('; ')} to save this look.` : 'Looking good. Save when you’re ready.');
            });
            grid.appendChild(button);
        });
        const save = document.getElementById('avatar-save');
        save.disabled = this.saving || this.lockedSelections().length > 0 || JSON.stringify(this.saved) === JSON.stringify(this.selection);
        save.textContent = this.saving ? 'Saving…' : this.lockedSelections().length ? 'Preview only' : 'Save avatar';
    }
    async save() {
        if (this.saving || this.lockedSelections().length) return;
        this.saving = true; this.render(); this.status('Saving your look…');
        try {
            const state = await this.api._put('/api/admin/avatar', this.selection);
            this.state = state; this.selection = { ...state.selection }; this.saved = { ...state.selection };
            this.status('Avatar saved. Your look will be here next time.');
        } catch (error) { this.status(`Could not save: ${error.message}. Your preview is still here.`, true); }
        finally { this.saving = false; this.render(); }
    }
}
document.addEventListener('DOMContentLoaded', () => new AvatarPage());
