import { showAchievementNotifications } from '../../components/achievementNotification.js';
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import Navbar from '../../components/navbar.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { getAvatarFit, chooseAvatarItem } from '../../utils/avatarFit.js';
import { renderAvatar } from '../../utils/avatarRenderer.js';
import { setFavicon } from '../../utils/faviconUtils.js';

class AvatarPage {
    constructor() {
        this.api = new ApiService();
        this.auth = new AuthComponent(this.api);
        this.slot = 'character';
        this.saving = false;
        this.viewer = null;
        this.viewerAttempted = false;
        this.init();
    }
    status(message, error = false) {
        const status = document.getElementById('studio-status');
        status.textContent = message;
        status.dataset.error = String(error);
    }
    async init() {
        setFavicon();
        const authenticated = await this.auth.checkAuth();
        if (authenticated === null) return;
        if (!authenticated) return navigateTo('login.html');
        const navbar = new Navbar();
        document.getElementById('navbar-container').innerHTML = navbar.render({ showBack: true,
            backUrl: 'languages.html', backText: 'exercises', appTitle: 'Avatar studio' });
        void navbar.init(this.auth);
        try {
            this.state = await this.api._get('/api/avatar');
            showAchievementNotifications(this.state.newAchievements);
            this.saved = { ...this.state.selection };
            this.selection = { ...this.saved };
            document.getElementById('studio-content').hidden = false;
            document.getElementById('wardrobe-tabs').addEventListener('click', event => {
                const button = event.target.closest('[data-slot]');
                if (!button) return;
                if (this.saving) return;
                this.slot = button.dataset.slot;
                this.render(); this.viewer?.frame(this.slot);
            });
            document.getElementById('wardrobe-unlocked').addEventListener('change', () => this.render());
            document.getElementById('avatar-shuffle').addEventListener('click', () => {
                for (const slot of Object.keys(this.selection)) {
                    const choices = this.state.catalog.filter(item => item.slot === slot && item.unlocked);
                    if (choices.length) this.selection[slot] = choices[Math.floor(Math.random() * choices.length)].id;
                }
                for (const slot of getAvatarFit(this.selection).hiddenSlots) this.selection[slot] = { audio: 'audio-none', jewellery: 'jewel-none', accessory: 'none' }[slot];
                this.render(); this.viewer?.fullView(); this.status('A fresh mix from your unlocked wardrobe. Save it or try another!');
            });
            document.getElementById('avatar-save').addEventListener('click', () => this.save());
            document.getElementById('avatar-reset').addEventListener('click', () => {
                this.selection = { ...this.saved }; this.render(); this.status('Back to your saved look.');
            });
            document.getElementById('saved-look-form').addEventListener('submit', event => { event.preventDefault(); void this.saveLook(); });
            document.getElementById('look-slot').addEventListener('change', () => { const look = this.state.looks.find(l => l.slot === Number(document.getElementById('look-slot').value)); document.getElementById('look-name').value = look?.name || ''; this.render(); });
            document.getElementById('look-delete').addEventListener('click', () => this.deleteLook());
            this.render(); this.status('Your wardrobe is ready. Pick a character to get started.');
            await this.initViewer();
        } catch (error) { this.status(`Could not load your wardrobe: ${error.message}. Refresh to retry.`, true); }
    }
    async initViewer() {
        this.viewerAttempted = true;
        const container = document.getElementById('avatar-preview');
        const note = document.getElementById('viewer-note');
        try {
            note.textContent = 'Loading your 3D character…';
            const { createAvatarViewer } = await import('../../vendor/avatar3d.bundle.js');
            this.viewer = await createAvatarViewer(container,
                new URL('../../../assets/avatars/wardrobe.glb', import.meta.url).href, this.selection);
            this.viewer.update(this.selection); this.render();
            note.textContent = 'Drag to rotate · scroll to zoom';
            for (const [id, action] of Object.entries({ 'avatar-zoom-in': () => this.viewer.zoom(0.25), 'avatar-zoom-out': () => this.viewer.zoom(-0.25),
                'avatar-full-view': () => this.viewer.fullView(), 'avatar-wave': () => this.viewer.gesture('wave'), 'avatar-celebrate': () => this.viewer.gesture(this.selection.celebration.replace('cel-', '')) })) {
                const button = document.getElementById(id); button.disabled = false; button.addEventListener('click', action);
            }
            const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
            const syncMotion = () => {
                for (const id of ['avatar-wave', 'avatar-celebrate']) {
                    const button = document.getElementById(id); button.disabled = motionPreference.matches;
                    button.title = motionPreference.matches ? 'Animations follow your device’s reduced-motion setting' : '';
                }
            };
            syncMotion(); motionPreference.addEventListener('change', syncMotion);
            window.addEventListener('pagehide', () => motionPreference.removeEventListener('change', syncMotion), { once: true });
            this.viewer.frame(this.slot);
            document.getElementById('avatar-turn-left').disabled = false;
            document.getElementById('avatar-turn-right').disabled = false;
            document.getElementById('avatar-turn-left').addEventListener('click', () => this.viewer.rotate(-0.3));
            document.getElementById('avatar-turn-right').addEventListener('click', () => this.viewer.rotate(0.3));
            window.addEventListener('pagehide', () => { this.viewer.dispose(); }, { once: true });
            window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
        } catch (error) {
            container.innerHTML = renderAvatar(this.selection);
            note.textContent = '3D preview unavailable on this device. Showing a rendered character instead.';
            console.error('Avatar 3D preview unavailable:', error);
        }
    }
    lockedSelections() {
        return this.state.catalog.filter(item => this.selection[item.slot] === item.id && !item.unlocked);
    }
    render() {
        this.renderLooks(); this.renderUnlocks();
        const character = this.state.catalog.find(item => item.id === this.selection.character);
        if (this.viewer) this.viewer.update(this.selection);
        else if (!this.viewerAttempted || !document.querySelector('#avatar-preview canvas')) {
            document.getElementById('avatar-preview').innerHTML = renderAvatar(this.selection, character.name);
        }
        document.getElementById('avatar-name').textContent = character.name;
        document.getElementById('avatar-description').textContent = character.description;
        document.getElementById('avatar-fit-note').textContent = getAvatarFit(this.selection).notes.join(' ');
        const unlocked = this.state.catalog.filter(item => item.unlocked).length;
        document.getElementById('avatar-progress').textContent = `${unlocked} / ${this.state.catalog.length} items unlocked · ${this.state.completed} exercises completed`;
        document.querySelectorAll('[data-slot]').forEach(button => {
            button.disabled = this.saving;
            button.setAttribute('aria-pressed', String(button.dataset.slot === this.slot));
        });
        document.getElementById('avatar-reset').disabled = this.saving;
        document.getElementById('avatar-shuffle').disabled = this.saving;
        document.getElementById('wardrobe-unlocked').disabled = this.saving;
        const grid = document.getElementById('wardrobe-items');
        grid.replaceChildren();
        const items = this.state.catalog.filter(item => item.slot === this.slot && (!document.getElementById('wardrobe-unlocked').checked || item.unlocked));
        document.getElementById('wardrobe-count').textContent = `${items.length} choices`;
        grid.dataset.swatches = String(['color', 'skin', 'hairColor', 'pantsColor', 'shoesColor'].includes(this.slot));
        if (!items.length) { const empty = document.createElement('p'); empty.textContent = 'No unlocked items here yet. Turn off the filter to explore the rewards.'; grid.append(empty); }
        items.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'wardrobe-item'; button.disabled = this.saving;
            button.dataset.locked = String(!item.unlocked);
            button.setAttribute('aria-pressed', String(this.selection[this.slot] === item.id));
            button.setAttribute('aria-label', `${item.name}. ${item.unlocked ? 'Unlocked' : `Locked: ${item.requirement}. Preview only`}`);
            const picture = document.createElement('span'); picture.className = 'wardrobe-item-art';
            picture.setAttribute('aria-hidden', 'true');
            picture.innerHTML = renderAvatar({ ...this.selection, [this.slot]: item.id }, item.name, this.slot);
            const title = document.createElement('strong'); title.textContent = item.name;
            const state = document.createElement('span'); state.className = 'item-state'; state.textContent = item.unlocked ? 'Unlocked' : 'Locked · preview';
            const detail = document.createElement('small'); detail.textContent = item.unlocked ? (item.reward ? `Reward: ${item.reward.name}` : item.description || (item.achievement || item.languageMaster || item.languageIds ? 'Permanent achievement reward' : 'Available from the start')) : item.requirement;
            if (!item.unlocked && item.progress !== null && item.target > 0) detail.textContent += ` · ${item.progress}/${item.target} · ${item.progressLabel}`;
            button.append(picture, title, state, detail);
            button.addEventListener('click', () => {
                const { selection, removedSlot } = chooseAvatarItem(this.selection, this.slot, item.id);
                this.selection = selection; this.render(); this.viewer?.frame(this.slot);
                if (this.slot === 'celebration') this.viewer?.gesture(item.id.replace('cel-', ''));
                const fitMessage = removedSlot === 'outfit' ? 'Switched to a tee to show your new bottoms. ' : removedSlot ? `Removed the ${removedSlot === 'hat' ? 'hat' : removedSlot === 'audio' ? 'headphones' : 'accessory'} so your new choice fits. ` : '';
                const locked = this.lockedSelections();
                this.status(fitMessage + (locked.length ? `Preview only. ${[...new Set(locked.map(item => item.requirement))].join('; ')} to save this look.` : 'Looking good. Save when you’re ready.'));
            });
            grid.appendChild(button);
        });
        const save = document.getElementById('avatar-save');
        save.disabled = this.saving || this.lockedSelections().length > 0 || JSON.stringify(this.saved) === JSON.stringify(this.selection);
        save.textContent = this.saving ? 'Saving…' : this.lockedSelections().length ? 'Preview only' : 'Save avatar';
    }
    renderLooks() {
        const grid = document.getElementById('saved-looks'); grid.replaceChildren();
        for (let slot = 1; slot <= 5; slot++) {
            const look = this.state.looks.find(l => l.slot === slot);
            const button = document.createElement('button'); button.type = 'button'; button.disabled = this.saving;
            button.textContent = look ? `${slot}. ${look.name}` : `${slot}. Empty slot`;
            button.addEventListener('click', () => {
                document.getElementById('look-slot').value = String(slot); document.getElementById('look-name').value = look?.name || '';
                if (look) { this.selection = { ...look.selection }; this.viewer?.fullView(); this.status(`Previewing ${look.name}. Save avatar to equip it.`); }
                this.render();
            }); grid.append(button);
        }
        const existing = this.state.looks.some(l => l.slot === Number(document.getElementById('look-slot').value));
        document.getElementById('look-delete').disabled = this.saving || !existing;
        document.getElementById('look-save').disabled = this.saving || this.lockedSelections().length > 0;
        document.getElementById('look-save').textContent = existing ? 'Replace saved look' : 'Save current look';
        document.getElementById('look-slot').disabled = this.saving; document.getElementById('look-name').disabled = this.saving;
    }
    renderUnlocks() {
        const container = document.getElementById('next-unlocks'); container.replaceChildren();
        for (const item of this.state.nextUnlocks) {
            const button = document.createElement('button'); button.type = 'button'; button.disabled = this.saving; button.className = 'next-unlock';
            const title = document.createElement('strong'); title.textContent = `${item.reward.name}: ${item.name}`;
            const bar = document.createElement('progress'); bar.max = item.target; bar.value = Math.min(item.progress, item.target); bar.setAttribute('aria-label', item.reward.name);
            const text = document.createElement('span'); text.textContent = `${item.progress}/${item.target} · ${item.progressLabel}`;
            button.append(title, bar, text); button.addEventListener('click', () => { this.slot = item.slot; this.selection = chooseAvatarItem(this.selection, item.slot, item.id).selection; this.render(); this.viewer?.frame(this.slot); this.status(`Preview only. ${item.requirement}.`); });
            container.append(button);
        }
        if (!this.state.nextUnlocks.length) container.textContent = 'Explore the wardrobe for achievement rewards. Some require a specific action rather than a counter.';
    }
    async saveLook() {
        if (this.saving || this.lockedSelections().length) return;
        this.saving = true; this.render();
        try {
            this.state = await this.api._put(`/api/avatar/looks/${document.getElementById('look-slot').value}`, { name: document.getElementById('look-name').value, selection: this.selection });
            showAchievementNotifications(this.state.newAchievements);
            this.saved = { ...this.state.selection }; this.status('Look saved to your account. Your equipped avatar is unchanged.');
        } catch (error) { this.status(`Could not save look: ${error.message}`, true); }
        finally { this.saving = false; this.render(); }
    }
    async deleteLook() {
        if (this.saving) return;
        this.saving = true; this.render();
        try { this.state = await this.api._delete(`/api/avatar/looks/${document.getElementById('look-slot').value}`); document.getElementById('look-name').value = ''; this.status('Saved slot cleared. Your current preview is still here.'); }
        catch (error) { this.status(`Could not delete look: ${error.message}`, true); }
        finally { this.saving = false; this.render(); }
    }
    async save() {
        if (this.saving || this.lockedSelections().length) return;
        this.saving = true; this.render(); this.status('Saving your look…');
        try {
            const state = await this.api._put('/api/avatar', this.selection);
            showAchievementNotifications(state.newAchievements);
            this.state = state; this.selection = { ...state.selection }; this.saved = { ...state.selection };
            window.dispatchEvent(new CustomEvent('avatar-saved', { detail: state.selection }));
            this.status('Avatar saved. Your look will be here next time.');
        } catch (error) { this.status(`Could not save: ${error.message}. Your preview is still here.`, true); }
        finally { this.saving = false; this.render(); }
    }
}
document.addEventListener('DOMContentLoaded', () => new AvatarPage());
