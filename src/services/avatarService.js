const DEFAULT_SELECTION = Object.freeze({ character: 'robot', outfit: 'tee', accessory: 'none', color: 'sky',
    skin: 'skin-warm', hair: 'crop', hairColor: 'hair-chestnut', pantsColor: 'pants-navy', shoesColor: 'shoes-cream' });
const LEGACY_KEYS = ['character', 'outfit', 'accessory', 'color'];
const CHARACTER_PRESETS = { robot: {}, sprout: { skin: 'skin-deep', hair: 'curls', hairColor: 'hair-black' },
    fox: { skin: 'skin-fair', hair: 'bob', hairColor: 'hair-copper' }, cat: { skin: 'skin-brown', hair: 'bun', hairColor: 'hair-black' } };
const CATALOG = Object.freeze([
    { id: 'robot', slot: 'character', name: 'Alex', description: 'Easygoing explorer. Always up for the next challenge.' },
    { id: 'sprout', slot: 'character', name: 'Mika', description: 'A curious mind, with a little extra bounce.' },
    { id: 'fox', slot: 'character', name: 'Robin', description: 'Resourceful, adventurous, and ready to go.', achievement: 'quick-learner' },
    { id: 'cat', slot: 'character', name: 'Sage', description: 'A calm head for tricky problems.', achievement: 'dedicated' },
    { id: 'tee', slot: 'outfit', name: 'Everyday tee' },
    { id: 'hoodie', slot: 'outfit', name: 'Cosy hoodie' },
    { id: 'lab-coat', slot: 'outfit', name: 'Lab coat', achievement: 'first-steps' },
    { id: 'space-suit', slot: 'outfit', name: 'Space suit', achievement: 'master' },
    { id: 'none', slot: 'accessory', name: 'Keep it simple' },
    { id: 'glasses', slot: 'accessory', name: 'Bright ideas', achievement: 'helpful-nudge' },
    { id: 'headphones', slot: 'accessory', name: 'Focus headphones', achievement: 'persistent' },
    { id: 'crown', slot: 'accessory', name: 'Problem-solver crown', achievement: 'legendary' },
    { id: 'crop', slot: 'hair', name: 'Swept crop' },
    { id: 'curls', slot: 'hair', name: 'Soft curls' },
    { id: 'bob', slot: 'hair', name: 'Classic bob' },
    { id: 'bun', slot: 'hair', name: 'Top knot', achievement: 'perfectionist' },
    { id: 'mohawk', slot: 'hair', name: 'Comeback crest', achievement: 'comeback-kid' },
    { id: 'braid', slot: 'hair', name: 'Explorer braid', achievement: 'dedicated' },
    ...['sky', 'mint', 'rose', 'amber', 'violet', 'slate'].map(id => ({ id, slot: 'color', name: id[0].toUpperCase() + id.slice(1) })),
    { id: 'golden', slot: 'color', name: 'Learner gold', achievement: 'quick-learner' },
    ...[['fair', 'Fair'], ['warm', 'Warm'], ['olive', 'Olive'], ['brown', 'Brown'], ['deep', 'Deep']].map(([id, name]) => ({ id: `skin-${id}`, slot: 'skin', name })),
    ...[['chestnut', 'Chestnut'], ['black', 'Black'], ['blonde', 'Blonde'], ['copper', 'Copper']].map(([id, name]) => ({ id: `hair-${id}`, slot: 'hairColor', name })),
    { id: 'hair-silver', slot: 'hairColor', name: 'Flawless silver', achievement: 'flawless' },
    ...[['navy', 'Navy'], ['sand', 'Sand'], ['charcoal', 'Charcoal'], ['plum', 'Plum']].map(([id, name]) => ({ id: `pants-${id}`, slot: 'pantsColor', name })),
    ...[['cream', 'Cream'], ['ink', 'Ink'], ['rose', 'Rose'], ['mint', 'Mint']].map(([id, name]) => ({ id: `shoes-${id}`, slot: 'shoesColor', name }))
]);

function validateSelection(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some(key => !Object.hasOwn(DEFAULT_SELECTION, key))
        || ![4, Object.keys(DEFAULT_SELECTION).length].includes(Object.keys(value).length)
        || !LEGACY_KEYS.every(key => Object.hasOwn(value, key))) throw new Error('Choose a complete avatar selection');
    // Older saved looks had only four fields. Expand those into the new wardrobe.
    const selection = { ...DEFAULT_SELECTION, ...(Object.keys(value).length === 4 ? CHARACTER_PRESETS[value.character] : {}), ...value };
    for (const slot of Object.keys(DEFAULT_SELECTION)) {
        if (!CATALOG.some(item => item.slot === slot && item.id === selection[slot])) throw new Error(`Unknown avatar ${slot}`);
    }
    return selection;
}

function createAvatarService(database) {
    async function getState(userId) {
        return database.withWriteTransaction(async () => {
            const { completed } = await database.db.get('SELECT COUNT(*) AS completed FROM user_progress WHERE user_id = ? AND completed = 1', [userId]);
            const earned = new Set((await database.db.all('SELECT achievement_id FROM user_achievements WHERE user_id = ? AND earned_at IS NOT NULL', [userId])).map(row => row.achievement_id));
            const achievements = new Map((await database.db.all('SELECT id, name, description, icon FROM achievements')).map(row => [row.id, row]));
            for (const item of CATALOG) {
                if (item.achievement && earned.has(item.achievement)) {
                    await database.db.run('INSERT OR IGNORE INTO user_avatar_unlocks (user_id, item_id) VALUES (?, ?)', [userId, item.id]);
                }
            }
            const row = await database.db.get('SELECT selection FROM user_avatars WHERE user_id = ?', [userId]);
            const stored = row ? JSON.parse(row.selection) : null;
            const selection = stored ? validateSelection(stored) : { ...DEFAULT_SELECTION };
            // Keep previously saved hairstyles wearable when migrating the mascot-era records.
            if (stored && Object.keys(stored).length === 4) {
                await database.db.run('INSERT OR IGNORE INTO user_avatar_unlocks (user_id, item_id) VALUES (?, ?)', [userId, selection.hair]);
            }
            const unlocked = new Set((await database.db.all('SELECT item_id FROM user_avatar_unlocks WHERE user_id = ?', [userId])).map(row => row.item_id));
            return { selection, completed, catalog: CATALOG.map(item => {
                const reward = achievements.get(item.achievement) || null;
                return { ...item, reward, unlocked: !item.achievement || unlocked.has(item.id),
                    requirement: item.achievement ? `Earn ${reward?.name || item.achievement}${reward ? ` — ${reward.description}` : ''}` : 'Available from the start', progress: null };
            }) };
        });
    }
    async function saveSelection(userId, value) {
        const parsed = validateSelection(value);
        const state = await getState(userId);
        // Old clients cannot accidentally overwrite newly customized skin/hair/colors.
        const selection = Object.keys(value).length === 4 ? validateSelection({ ...state.selection, ...value }) : parsed;
        for (const [slot, id] of Object.entries(selection)) {
            if (!state.catalog.find(entry => entry.id === id && entry.slot === slot)?.unlocked) throw new Error('Unlock this item before equipping it');
        }
        await database.withWriteTransaction(() => database.db.run(`INSERT INTO user_avatars (user_id, selection) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET selection = excluded.selection, updated_at = CURRENT_TIMESTAMP`, [userId, JSON.stringify(selection)]));
        return { ...state, selection };
    }
    return { getState, saveSelection };
}
module.exports = { createAvatarService, DEFAULT_SELECTION, CATALOG, validateSelection };
