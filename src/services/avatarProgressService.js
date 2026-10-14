// Read-only achievement measures, matching the counters used by achievement checks.
async function getAvatarProgress(db, userId) {
    const stats = await db.get(`SELECT COUNT(CASE WHEN completed = 1 THEN 1 END) AS completed,
        COUNT(CASE WHEN completed = 1 AND COALESCE(attempts_to_completion, attempts) = 1 THEN 1 END) AS firstTry,
        COALESCE(SUM(attempts), 0) AS runs,
        COALESCE(MAX(CASE WHEN completed = 1 THEN COALESCE(attempts_to_completion, attempts) ELSE attempts END), 0) AS persistence
        FROM user_progress WHERE user_id = ?`, [userId]);
    const chapters = await db.all(`SELECT c.id, c.language_id, l.enabled, COUNT(e.id) AS total,
        SUM(CASE WHEN up.completed = 1 THEN 1 ELSE 0 END) AS completed
        FROM chapters c JOIN languages l ON l.id = c.language_id JOIN exercises e ON e.chapter_id = c.id
        LEFT JOIN user_progress up ON up.exercise_id = e.id AND up.user_id = ? GROUP BY c.id`, [userId]);
    const days = await db.all("SELECT DISTINCT DATE(completed_at) AS day FROM user_progress WHERE user_id = ? AND completed = 1 AND completed_at IS NOT NULL ORDER BY day DESC", [userId]);
    const today = (await db.get("SELECT DATE('now') AS day")).day;
    let streak = 0;
    if (days.length && (Date.parse(today) - Date.parse(days[0].day)) / 86400000 <= 1) {
        streak = 1;
        while (streak < days.length && (Date.parse(days[streak - 1].day) - Date.parse(days[streak].day)) / 86400000 === 1) streak++;
    }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const speed = await db.get(`SELECT COUNT(CASE WHEN datetime(completed_at) >= datetime('now', '-1 hour') THEN 1 END) AS hourly,
        COUNT(CASE WHEN datetime(completed_at) >= datetime(?) THEN 1 END) AS daily
        FROM user_progress WHERE user_id = ? AND completed = 1`, [todayStart.toISOString(), userId]);
    return { ...stats, chapters, streak, ...speed };
}
function progressFor(achievement, stats) {
    let current, target = Number(achievement.requirement_value), unit;
    switch (achievement.requirement_type) {
    case 'exercises_completed': current = stats.completed; unit = 'exercises'; break;
    case 'total_test_runs': current = stats.runs; unit = 'test runs'; break;
    case 'first_try_completions': current = stats.firstTry; unit = 'first-try completions'; break;
    case 'persistent_completion': current = stats.persistence; unit = 'attempts before a completion'; break;
    case 'daily_streak': current = stats.streak; unit = 'consecutive days'; break;
    case 'exercises_per_hour': current = stats.hourly; unit = 'completions in the last hour'; break;
    case 'exercises_per_day': current = stats.daily; unit = 'completions today'; break;
    case 'chapter_complete': current = stats.chapters.filter(c => c.total === c.completed).length; unit = 'completed chapters'; break;
    case 'all_chapters_complete': {
        const chapters = stats.chapters.filter(c => c.enabled === 1);
        target = chapters.length; current = chapters.filter(c => c.total === c.completed).length; unit = 'published chapters'; break;
    }
    case 'language_complete': {
        const chapters = stats.chapters.filter(c => c.language_id === String(achievement.requirement_value));
        target = chapters.length; current = chapters.filter(c => c.total === c.completed).length; unit = 'language chapters'; break;
    }
    default: return { current: null, target: null, fraction: 0, label: null };
    }
    const remaining = Math.max(0, target - current);
    const displayUnit = remaining === 1 ? unit.replace(/s(?= |$)/, '') : unit;
    return { current: target > 0 ? Math.min(current, target) : current, target, fraction: target > 0 ? Math.min(1, current / target) : 0,
        label: target === 0 ? 'No eligible chapters yet' : remaining === 0 ? 'Requirement reached; earn the achievement to unlock' : `${remaining} more ${displayUnit} to go` };
}
module.exports = { getAvatarProgress, progressFor };
