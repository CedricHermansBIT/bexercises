const DEFAULT_SELECTION = Object.freeze({ character: 'robot', outfit: 'tee', accessory: 'none', color: 'sky',
    skin: 'skin-warm', hair: 'crop', hairColor: 'hair-chestnut', pantsColor: 'pants-navy', shoesColor: 'shoes-cream', hat: 'hat-none' });
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
    { id: 'glasses-69', slot: 'accessory', name: 'Nice 69 glasses', achievement: 'nice' },
    { id: 'glasses-67', slot: 'accessory', name: 'Six Seven specs', achievement: 'six-seven' },
    { id: 'star-glasses', slot: 'accessory', name: 'Superstar specs', achievement: 'untouchable' },
    { id: 'pixel-shades', slot: 'accessory', name: '1337 pixel shades', achievement: 'elite' },
    { id: 'owl-glasses', slot: 'accessory', name: 'Night owl eyes', achievement: 'night-owl' },
    { id: 'lightning', slot: 'accessory', name: 'Lightning earrings', achievement: 'speed-demon' },
    { id: 'bow-tie', slot: 'accessory', name: 'First-try bow tie', achievement: 'perfectionist' },
    { id: 'wings', slot: 'accessory', name: 'Unstoppable wings', achievement: 'unstoppable' },
    { id: 'language-medal', slot: 'accessory', name: 'Language master medal', languageMaster: true },
    { id: 'matrix-shades', slot: 'accessory', name: 'Matrix shades', achievement: 'hackerman', secret: true },
    { id: 'hat-none', slot: 'hat', name: 'No hat' },
    { id: 'cap', slot: 'hat', name: 'Everyday cap' },
    { id: 'beanie', slot: 'hat', name: 'Comfy beanie' },
    { id: 'duck', slot: 'hat', name: 'Rubber duck debugger', achievement: 'helpful-nudge' },
    { id: 'propeller', slot: 'hat', name: 'Answer-to-everything propeller', achievement: 'answer-to-everything' },
    { id: 'wizard', slot: 'hat', name: 'Chapter wizard', achievement: 'chapter-complete' },
    { id: 'graduation', slot: 'hat', name: 'Graduation cap', achievement: 'all-chapters' },
    { id: 'space-helmet', slot: 'hat', name: 'Space helmet', achievement: 'master' },
    { id: 'viking', slot: 'hat', name: 'Never-give-up Viking', achievement: 'never-give-up' },
    { id: 'centurion-helmet', slot: 'hat', name: 'Centurion helmet', achievement: 'centurion' },
    { id: 'mushroom', slot: 'hat', name: '420 mushroom', achievement: 'snoopdog' },
    { id: 'top-hat', slot: 'hat', name: 'Thousandaire top hat', achievement: 'thousandaire' },
    { id: 'runner', slot: 'hat', name: 'Marathon headband', achievement: 'marathon-runner' },
    { id: 'early-bird-hat', slot: 'hat', name: 'Early bird nest', achievement: 'early-bird' },
    { id: 'flame', slot: 'hat', name: 'Streak flame', achievement: 'committed' },
    { id: 'bald', slot: 'hair', name: 'Smooth & simple' },
    { id: 'buzz', slot: 'hair', name: 'Buzz cut' },
    { id: 'pixie', slot: 'hair', name: 'Pixie cut' },
    { id: 'afro', slot: 'hair', name: 'Cloud afro' },
    { id: 'ponytail', slot: 'hair', name: 'High ponytail' },
    { id: 'twin-buns', slot: 'hair', name: 'Twin buns' },
    { id: 'spiky', slot: 'hair', name: 'Spiky hair' },
    { id: 'long-waves', slot: 'hair', name: 'Long waves' },
    { id: 'dreads', slot: 'hair', name: 'Locs' },
    { id: 'pompadour', slot: 'hair', name: 'Retro pop pompadour', achievement: 'rickrolled', secret: true },
    ...['sky', 'mint', 'rose', 'amber', 'violet', 'slate', 'crimson', 'orange', 'lemon', 'lime', 'forest', 'teal', 'cyan', 'ocean', 'navy', 'lavender', 'magenta', 'chocolate', 'sand', 'cream', 'white', 'black'].map(id => ({ id, slot: 'color', name: id[0].toUpperCase() + id.slice(1) })),
    { id: 'golden', slot: 'color', name: 'Learner gold', achievement: 'quick-learner' },
    ...['fair', 'warm', 'olive', 'brown', 'deep', 'porcelain', 'peach', 'umber', 'ebony'].map(id => ({ id: `skin-${id}`, slot: 'skin', name: id[0].toUpperCase() + id.slice(1) })),
    ...['chestnut', 'black', 'blonde', 'copper', 'espresso', 'auburn', 'platinum', 'rose', 'violet', 'blue', 'mint', 'white'].map(id => ({ id: `hair-${id}`, slot: 'hairColor', name: id[0].toUpperCase() + id.slice(1) })),
    { id: 'hair-silver', slot: 'hairColor', name: 'Flawless silver', achievement: 'flawless' },
    { id: 'hair-ember', slot: 'hairColor', name: 'Streak ember', achievement: 'streak-starter' },
    ...['navy', 'sand', 'charcoal', 'plum', 'forest', 'sky', 'rose', 'white', 'black', 'orange', 'teal', 'chocolate'].map(id => ({ id: `pants-${id}`, slot: 'pantsColor', name: id[0].toUpperCase() + id.slice(1) })),
    ...['cream', 'ink', 'rose', 'mint', 'crimson', 'orange', 'lemon', 'violet', 'cyan', 'white', 'chocolate', 'silver'].map(id => ({ id: `shoes-${id}`, slot: 'shoesColor', name: id[0].toUpperCase() + id.slice(1) })),
]);

function validateSelection(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some(key => !Object.hasOwn(DEFAULT_SELECTION, key))
        || ![4, 9, Object.keys(DEFAULT_SELECTION).length].includes(Object.keys(value).length)
        || Object.keys(value).length === 9 && Object.hasOwn(value, 'hat')
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
            const achievements = new Map((await database.db.all('SELECT id, name, description, icon, hidden FROM achievements')).map(row => [row.id, row]));
            for (const item of CATALOG) {
                if ((item.achievement && earned.has(item.achievement)) || (item.languageMaster && [...earned].some(id => id.startsWith('language-master-')))) {
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
            return { selection, completed, catalog: CATALOG.filter(item => !item.secret || unlocked.has(item.id)).map(item => {
                const languageReward = item.languageMaster ? [...achievements.values()].find(a => a.id.startsWith('language-master-') && earned.has(a.id)) : null;
                const reward = languageReward || achievements.get(item.achievement) || null;
                return { ...item, reward, unlocked: (!item.achievement && !item.languageMaster) || unlocked.has(item.id),
                    requirement: item.achievement ? `Earn ${reward?.name || item.achievement}${reward ? ` — ${reward.description}` : ''}` : item.languageMaster ? 'Master any language — complete all its chapters' : 'Available from the start', progress: null };
            }) };
        });
    }
    async function saveSelection(userId, value) {
        const parsed = validateSelection(value);
        const state = await getState(userId);
        // Old clients cannot accidentally overwrite newly customized skin/hair/colors.
        const selection = Object.keys(value).length < Object.keys(DEFAULT_SELECTION).length ? validateSelection({ ...state.selection, ...value }) : parsed;
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
