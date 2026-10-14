const DEFAULT_SELECTION = Object.freeze({ character: 'robot', outfit: 'tee', accessory: 'none', color: 'sky' });
const CATALOG = Object.freeze([
    { id: 'robot', slot: 'character', name: 'Byte', description: 'A curious little robot.' },
    { id: 'sprout', slot: 'character', name: 'Sprout', description: 'A fresh start, with a leafy antenna.' },
    { id: 'fox', slot: 'character', name: 'Pixel fox', description: 'For resourceful problem solvers.', completions: 5 },
    { id: 'cat', slot: 'character', name: 'Debug cat', description: 'Always lands on the right answer.', completions: 10 },
    { id: 'tee', slot: 'outfit', name: 'Everyday tee' },
    { id: 'hoodie', slot: 'outfit', name: 'Cosy hoodie' },
    { id: 'lab-coat', slot: 'outfit', name: 'Lab coat', completions: 3 },
    { id: 'space-suit', slot: 'outfit', name: 'Space suit', completions: 15 },
    { id: 'none', slot: 'accessory', name: 'Keep it simple' },
    { id: 'glasses', slot: 'accessory', name: 'Bright ideas', achievement: 'helpful-nudge', requirement: 'Earn Helpful Nudge by opening an exercise hint' },
    { id: 'headphones', slot: 'accessory', name: 'Focus headphones', completions: 5 },
    { id: 'crown', slot: 'accessory', name: 'Problem-solver crown', completions: 20 },
    ...['sky', 'mint', 'rose', 'amber', 'violet', 'slate'].map(id => ({ id, slot: 'color', name: id[0].toUpperCase() + id.slice(1) }))
]);

function validateSelection(selection) {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)
        || Object.keys(selection).length !== 4) throw new Error('Choose a character, outfit, accessory and color');
    for (const slot of Object.keys(DEFAULT_SELECTION)) {
        if (!CATALOG.some(item => item.slot === slot && item.id === selection[slot])) throw new Error(`Unknown avatar ${slot}`);
    }
    return Object.fromEntries(Object.keys(DEFAULT_SELECTION).map(slot => [slot, selection[slot]]));
}

function createAvatarService(database) {
    async function getState(userId) {
        return database.withWriteTransaction(async () => {
            const { completed } = await database.db.get('SELECT COUNT(*) AS completed FROM user_progress WHERE user_id = ? AND completed = 1', [userId]);
            const earned = new Set((await database.db.all('SELECT achievement_id FROM user_achievements WHERE user_id = ? AND earned_at IS NOT NULL', [userId])).map(row => row.achievement_id));
            for (const item of CATALOG) {
                if ((item.completions && completed >= item.completions) || (item.achievement && earned.has(item.achievement))) {
                    await database.db.run('INSERT OR IGNORE INTO user_avatar_unlocks (user_id, item_id) VALUES (?, ?)', [userId, item.id]);
                }
            }
            const unlocked = new Set((await database.db.all('SELECT item_id FROM user_avatar_unlocks WHERE user_id = ?', [userId])).map(row => row.item_id));
            const row = await database.db.get('SELECT selection FROM user_avatars WHERE user_id = ?', [userId]);
            const selection = row ? validateSelection(JSON.parse(row.selection)) : { ...DEFAULT_SELECTION };
            return { selection, completed, catalog: CATALOG.map(item => ({ ...item,
                unlocked: !item.completions && !item.achievement || unlocked.has(item.id),
                requirement: item.requirement || (item.completions ? `Complete ${item.completions} exercises` : 'Available from the start'),
                progress: item.completions ? Math.min(completed, item.completions) : null })) };
        });
    }
    async function saveSelection(userId, value) {
        const selection = validateSelection(value);
        const state = await getState(userId);
        for (const item of Object.values(selection)) {
            if (!state.catalog.find(entry => entry.id === item)?.unlocked) throw new Error('Unlock this item before equipping it');
        }
        await database.withWriteTransaction(() => database.db.run(`INSERT INTO user_avatars (user_id, selection) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET selection = excluded.selection, updated_at = CURRENT_TIMESTAMP`, [userId, JSON.stringify(selection)]));
        return { ...state, selection };
    }
    return { getState, saveSelection };
}
module.exports = { createAvatarService, DEFAULT_SELECTION, CATALOG, validateSelection };
