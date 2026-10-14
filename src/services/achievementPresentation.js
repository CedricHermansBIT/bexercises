const { progressFor } = require('./avatarProgressService');

// Never attach discovery hints to secret achievements, even after they are earned.
function presentAchievements(achievements, stats) {
    return achievements.map(achievement => {
        if (achievement.hidden && !achievement.earned) {
            return { id: achievement.id, hidden: 1, earned: 0, category: 'secret', name: 'Secret achievement', description: 'Keep exploring BITLab to discover this achievement.', icon: '🔒' };
        }
        return { ...achievement, name: achievement.earned ? achievement.name : 'Locked achievement', measure: achievement.hidden || achievement.earned ? null : progressFor(achievement, stats) };
    });
}
module.exports = { presentAchievements };
