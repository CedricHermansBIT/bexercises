import soundEffects from '../utils/soundEffects.js';
import ApiService from '../services/apiService.js';
import { getAchievementRewards } from '../utils/avatarRewards.js';
import { paintRewardThumbnail, previewAvatarReward } from '../utils/avatarIdentity.js';

function loadRewardState() {
    // Fetch after the award so newly earned (including secret) items are unlocked.
    return new ApiService()._get('/api/avatar').catch(() => null);
}

function node(tag, className, text) {
    const element = document.createElement(tag); element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function showAchievementNotification(achievement, rewardState) {
    soundEffects.playAchievement();
    let stack = document.getElementById('achievement-notifications');
    if (!stack) { stack = node('div', 'achievement-notifications'); stack.id = 'achievement-notifications'; document.body.append(stack); }
    const notification = node('div', 'achievement-notification'); notification.setAttribute('role', 'status');
    const header = node('div', 'achievement-notification-header');
    const close = node('button', 'achievement-notification-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Dismiss achievement notification');
    header.append(node('span', '', '🎉'), node('span', '', 'Achievement Unlocked!'), close);
    const content = node('div', 'achievement-notification-content');
    const details = node('div', 'achievement-notification-details');
    details.append(node('div', 'achievement-notification-title', achievement.name),
        node('div', 'achievement-notification-description', achievement.description),
        node('div', 'achievement-notification-points', `+${achievement.points} points`));
    content.append(node('div', 'achievement-notification-icon', achievement.icon), details);
    notification.append(header, content); stack.append(notification);
    let timer, hovered = false, previewOpen = false;
    const dismiss = () => { clearTimeout(timer); notification.remove(); if (!stack.children.length) stack.remove(); };
    const scheduleDismiss = () => {
        clearTimeout(timer);
        if (!hovered && !previewOpen && !notification.contains(document.activeElement)) timer = setTimeout(dismiss, 9000);
    };
    close.addEventListener('click', dismiss);
    notification.addEventListener('pointerenter', () => { hovered = true; clearTimeout(timer); });
    notification.addEventListener('pointerleave', () => { hovered = false; scheduleDismiss(); });
    notification.addEventListener('focusin', () => clearTimeout(timer));
    notification.addEventListener('focusout', scheduleDismiss);
    scheduleDismiss();
    void Promise.resolve(rewardState || loadRewardState()).then(async state => {
        if (!state || !notification.isConnected) return;
        const rewards = getAchievementRewards({ ...achievement, earned: true }, state.catalog);
        if (!rewards.length) return;
        const section = node('section', 'achievement-rewards'); section.append(node('h3', '', 'Unlocked character rewards'));
        const list = node('div', 'achievement-reward-list');
        const previews = [];
        for (const item of rewards) {
            const button = node('button', 'achievement-reward-button'); button.type = 'button'; button.setAttribute('aria-label', `Preview ${item.name}`);
            const art = node('span', 'achievement-reward-art'); art.setAttribute('aria-hidden', 'true');
            button.append(art, node('span', '', item.name)); list.append(button);
            button.addEventListener('click', () => {
                previewOpen = true; clearTimeout(timer);
                void previewAvatarReward(state.selection, item, button);
                const dialog = document.getElementById('avatar-reward-title')?.closest('dialog');
                if (dialog) dialog.addEventListener('close', () => { previewOpen = false; scheduleDismiss(); }, { once: true });
                else { previewOpen = false; scheduleDismiss(); }
            });
            previews.push(() => paintRewardThumbnail(art, { ...state.selection, [item.slot]: item.id }, item));
        }
        section.append(list); notification.append(section);
        await Promise.allSettled(previews.map(preview => preview()));
        if (notification.isConnected) scheduleDismiss();
    }).catch(() => {}); // The achievement message remains usable if previews fail.
    return notification;
}

function showAchievementNotifications(achievements) {
    if (!achievements?.length) return;
    const rewardState = loadRewardState();
    achievements.forEach((achievement, index) => {
        setTimeout(() => showAchievementNotification(achievement, rewardState), index * 600);
    });
}

export { showAchievementNotification, showAchievementNotifications };
