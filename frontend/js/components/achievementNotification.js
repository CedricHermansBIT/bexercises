// frontend/js/components/achievementNotification.js

/**
 * Show achievement notification popup
 * @param {Object} achievement - Achievement object with name, description, icon, points
 */
function showAchievementNotification(achievement) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';

    notification.innerHTML = `
        <div class="achievement-notification-header">
            <span>🎉</span>
            <span>Achievement Unlocked!</span>
        </div>
        <div class="achievement-notification-content">
            <div class="achievement-notification-icon">${achievement.icon}</div>
            <div class="achievement-notification-details">
                <div class="achievement-notification-title">${achievement.name}</div>
                <div class="achievement-notification-description">${achievement.description}</div>
                <div class="achievement-notification-points">+${achievement.points} points</div>
            </div>
        </div>
    `;

    // Add to body
    document.body.appendChild(notification);

    // Remove after animation completes (5 seconds)
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

/**
 * Show multiple achievement notifications in sequence
 * @param {Array} achievements - Array of achievement objects
 */
function showAchievementNotifications(achievements) {
    if (!achievements || achievements.length === 0) return;

    achievements.forEach((achievement, index) => {
        setTimeout(() => {
            showAchievementNotification(achievement);
        }, index * 600); // Stagger by 600ms
    });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { showAchievementNotification, showAchievementNotifications };
}

