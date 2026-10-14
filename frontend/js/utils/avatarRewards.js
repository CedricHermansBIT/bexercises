// Use the account's server-filtered catalog; never reveal unearned secret rewards.
export function getAchievementRewards(achievement, catalog = []) {
    if (!achievement.earned) return [];
    const language = achievement.id.startsWith('language-master-') ? achievement.id.slice('language-master-'.length) : null;
    return catalog.filter(item => item.unlocked && (item.achievement === achievement.id
        || (language && (item.languageMaster || item.languageIds?.includes(language)))));
}
