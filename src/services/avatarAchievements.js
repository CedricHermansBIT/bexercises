const { DEFAULT_SELECTION } = require('./avatarDefaults');

const AVATAR_ACHIEVEMENTS = [
    { id: 'made-it-mine', name: 'Made It Mine', description: 'Save an avatar with at least one appearance choice changed from the starter character', icon: '🎨', category: 'avatar', points: 10, requirement_type: 'avatar_customized', requirement_value: 1 },
    { id: 'main-character-energy', name: 'Main Character Energy', description: 'Save your avatar with both a different idle pose and a different celebration', icon: '✨', category: 'avatar', points: 10, requirement_type: 'avatar_personality', requirement_value: 2 },
    { id: 'wardrobe-curator', name: 'Wardrobe Curator', description: 'Keep three visually different looks in your saved wardrobe slots', icon: '👗', category: 'avatar', points: 20, requirement_type: 'avatar_looks_saved', requirement_value: 3 }
];
const REWARD_MOVES = [
    ['star-pin', 'made-it-mine'],
    ['studio-headset', 'main-character-energy'],
    ['golden', 'main-character-energy'],
    ['party-dress', 'wardrobe-curator'],
    ['tulle-skirt', 'wardrobe-curator'],
    ['starlight-dress', 'wardrobe-curator']
];
const appearanceSlots = Object.keys(DEFAULT_SELECTION).filter(slot => !['idle', 'celebration'].includes(slot));
function parseSelection(value) {
    try { return { ...DEFAULT_SELECTION, ...JSON.parse(value) }; }
    catch { return { ...DEFAULT_SELECTION }; }
}
async function getAvatarAchievementProgress(db, userId) {
    const row = await db.get('SELECT selection FROM user_avatars WHERE user_id = ?', [userId]);
    const selection = parseSelection(row?.selection);
    const looks = await db.all('SELECT selection FROM user_avatar_looks WHERE user_id = ?', [userId]);
    return {
        avatarCustomized: Number(Boolean(row) && appearanceSlots.some(slot => selection[slot] !== DEFAULT_SELECTION[slot])),
        avatarPersonality: row ? ['idle', 'celebration'].filter(slot => selection[slot] !== DEFAULT_SELECTION[slot]).length : 0,
        avatarLooks: new Set(looks.map(look => {
            const saved = parseSelection(look.selection);
            return JSON.stringify(appearanceSlots.map(slot => saved[slot]));
        })).size
    };
}
// Caller owns the write transaction. Conditional inserts prevent repeated awards on saves or reloads.
async function awardAvatarAchievements(db, userId) {
    const stats = await getAvatarAchievementProgress(db, userId);
    const values = { avatar_customized: stats.avatarCustomized, avatar_personality: stats.avatarPersonality, avatar_looks_saved: stats.avatarLooks };
    const awarded = [];
    for (const definition of AVATAR_ACHIEVEMENTS) {
        if (values[definition.requirement_type] < definition.requirement_value) continue;
        const result = await db.run(`INSERT INTO user_achievements(user_id, achievement_id, progress, earned_at)
            VALUES (?, ?, 100, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, achievement_id) DO UPDATE SET progress = 100, earned_at = CURRENT_TIMESTAMP
            WHERE user_achievements.earned_at IS NULL`, [userId, definition.id]);
        if (result.changes) awarded.push(await db.get('SELECT * FROM achievements WHERE id = ?', [definition.id]));
    }
    return awarded;
}
async function migrateAvatarRewards(db) {
    await db.exec('CREATE TABLE IF NOT EXISTS data_migrations (id TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    const id = 'avatar-achievement-rewards-v1';
    if (await db.get('SELECT id FROM data_migrations WHERE id = ?', [id])) return;
    for (const [item, achievement] of REWARD_MOVES) {
        await db.run(`DELETE FROM user_avatar_unlocks WHERE item_id = ? AND user_id NOT IN
            (SELECT user_id FROM user_achievements WHERE achievement_id = ? AND earned_at IS NOT NULL)`, [item, achievement]);
    }
    // Remove moved rewards from equipped avatars too; saved looks remain editable previews.
    for (const row of await db.all('SELECT user_id, selection FROM user_avatars')) {
        let selection;
        try { selection = JSON.parse(row.selection); } catch { continue; }
        if (!selection || typeof selection !== 'object' || Array.isArray(selection)) continue;
        let changed = false;
        for (const [slot, item] of Object.entries(selection)) {
            const move = REWARD_MOVES.find(([id]) => id === item);
            if (!move || await db.get('SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ? AND earned_at IS NOT NULL', [row.user_id, move[1]])) continue;
            selection[slot] = DEFAULT_SELECTION[slot]; changed = true;
        }
        if (changed) await db.run('UPDATE user_avatars SET selection = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [JSON.stringify(selection), row.user_id]);
    }
    await db.run('INSERT INTO data_migrations(id) VALUES (?)', [id]);
}
module.exports = { AVATAR_ACHIEVEMENTS, REWARD_MOVES, getAvatarAchievementProgress, awardAvatarAchievements, migrateAvatarRewards };
