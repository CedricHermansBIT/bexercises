// Use the account's server-filtered catalog; never reveal unearned secret rewards.
export function getAchievementRewards(achievement, catalog = [], { includeLocked = false } = {}) {
    if (!achievement.earned && (!includeLocked || achievement.hidden)) return [];
    const language = achievement.id.startsWith('language-master-') ? achievement.id.slice('language-master-'.length) : null;
    return catalog.filter(item => (item.unlocked || (includeLocked && !item.secret)) && (item.achievement === achievement.id
        || (language && (item.languageMaster || item.languageIds?.includes(language)))));
}
