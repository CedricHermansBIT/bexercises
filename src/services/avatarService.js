const { getAvatarProgress, progressFor } = require('./avatarProgressService');
const DEFAULT_SELECTION = Object.freeze({ character: 'robot', outfit: 'tee', accessory: 'none', color: 'sky',
    skin: 'skin-warm', hair: 'crop', hairColor: 'hair-chestnut', pantsColor: 'pants-navy', shoesColor: 'shoes-cream', hat: 'hat-none',
    audio: 'audio-none', jewellery: 'jewel-none', back: 'back-none', companion: 'companion-none', idle: 'idle-relaxed', celebration: 'cel-wave', pants: 'straight', shoes: 'sneakers' });
const CHARACTER_PRESETS = { robot: {}, sprout: { skin: 'skin-deep', hair: 'curls', hairColor: 'hair-black' },
    fox: { skin: 'skin-fair', hair: 'bob', hairColor: 'hair-copper' }, cat: { skin: 'skin-brown', hair: 'bun', hairColor: 'hair-black' } };
const LEGACY_SLOTS = { headphones: 'audio', crown: 'hat', lightning: 'jewellery', 'bow-tie': 'jewellery', 'language-medal': 'jewellery', wings: 'back' };
const CATALOG = Object.freeze([
    { id: 'robot', slot: 'character', name: 'Alex', description: 'Easygoing explorer. Always up for the next challenge.' },
    { id: 'sprout', slot: 'character', name: 'Mika', description: 'A curious mind, with a little extra bounce.' },
    { id: 'fox', slot: 'character', name: 'Robin', description: 'Resourceful, adventurous, and ready to go.', achievement: 'quick-learner' },
    { id: 'cat', slot: 'character', name: 'Sage', description: 'A calm head for tricky problems.', achievement: 'dedicated' },
    { id: 'nova', slot: 'character', name: 'Nova', description: 'Bright-eyed dreamer with big ideas.' },
    { id: 'dungarees', slot: 'outfit', name: 'Workshop dungarees' },
    { id: 'tee', slot: 'outfit', name: 'Everyday tee' },
    { id: 'hoodie', slot: 'outfit', name: 'Cosy hoodie' },
    { id: 'lab-coat', slot: 'outfit', name: 'Lab coat', achievement: 'first-steps' },
    { id: 'space-suit', slot: 'outfit', name: 'Space suit', achievement: 'master' },
    { id: 'pumpkin-knit', slot: 'outfit', name: 'Midnight pumpkin jumper', achievement: 'night-owl' },
    { id: 'festive-knit', slot: 'outfit', name: 'Streak-season festive knit', achievement: 'streak-starter' },
    { id: 'pumpkin-hat', slot: 'hat', name: 'Little pumpkin patch', achievement: 'night-owl' },
    { id: 'santa-hat', slot: 'hat', name: 'Committed Claus', achievement: 'committed' },
    { id: 'elf-shoes', slot: 'shoes', name: 'Curly elf shoes', achievement: 'committed' },
    { id: 'chef-jacket', slot: 'outfit', name: 'Chef’s double-breasted jacket', achievement: 'perfectionist' },
    { id: 'safety-goggles', slot: 'accessory', name: 'Lab safety goggles', achievement: 'first-steps' },
    { id: 'chef-hat', slot: 'hat', name: 'Chef’s toque', achievement: 'perfectionist' },
    { id: 'welding-visor', slot: 'hat', name: 'Workshop welding visor', achievement: 'persistent' },
    { id: 'clogs', slot: 'shoes', name: 'Lab & kitchen clogs', achievement: 'first-steps' },
    { id: 'bomber', slot: 'outfit', name: 'Campus bomber jacket' },
    { id: 'varsity', slot: 'outfit', name: 'Chapter varsity jacket', achievement: 'chapter-complete' },
    { id: 'rugby', slot: 'outfit', name: 'Striped rugby shirt' },
    { id: 'cardigan', slot: 'outfit', name: 'Library cardigan' },
    { id: 'raincoat', slot: 'outfit', name: 'Rainy-day explorer', achievement: 'dedicated' },
    ...[['straight', 'Classic trousers'], ['chinos', 'Turn-up chinos'], ['cargo', 'Cargo trousers'], ['shorts', 'Summer shorts'], ['joggers', 'Campus joggers'], ['wide-leg', 'Wide-leg trousers']].map(([id, name]) => ({ id, slot: 'pants', name })),
    ...[['sneakers', 'Everyday sneakers'], ['high-tops', 'High-top sneakers'], ['boots', 'Trail boots'], ['loafers', 'Smart loafers'], ['sandals', 'Summer sandals'], ['trainers', 'Track trainers']].map(([id, name]) => ({ id, slot: 'shoes', name })),
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
    { id: 'gamer-headset', slot: 'audio', name: 'RGB gaming headset', achievement: 'elite' },
    { id: 'studio-headset', slot: 'audio', name: 'Studio headset', achievement: 'dedicated' },
    { id: 'cat-headphones', slot: 'audio', name: 'Cat-ear headphones', achievement: 'nice' },
    { id: 'earbuds', slot: 'audio', name: 'Everyday earbuds' },
    { id: 'retro-headphones', slot: 'audio', name: 'Retro headphones', achievement: 'rickrolled', secret: true },
    { id: 'rocket-pack', slot: 'back', name: 'Rocket backpack', achievement: 'master' },
    { id: 'bookbag', slot: 'back', name: 'Scholar bookbag', achievement: 'chapter-complete' },
    { id: 'turtle-shell', slot: 'back', name: 'Slow-and-steady shell', achievement: 'never-give-up' },
    { id: 'owl-pal', slot: 'companion', name: 'Night owl pal', achievement: 'night-owl' },
    { id: 'duck-pal', slot: 'companion', name: 'Rubber duck pal', achievement: 'helpful-nudge' },
    { id: 'robot-pal', slot: 'companion', name: 'Tiny robot pal', achievement: 'answer-to-everything' },
    { id: 'cat-pal', slot: 'companion', name: 'Curious cat pal', achievement: 'quick-learner' },
    { id: 'star-pin', slot: 'jewellery', name: 'First-step star pin', achievement: 'first-steps' },
    { id: 'scarf', slot: 'jewellery', name: 'Cosy scarf' },
    { id: 'audio-none', slot: 'audio', name: 'No headphones' },
    { id: 'jewel-none', slot: 'jewellery', name: 'No jewellery' },
    { id: 'back-none', slot: 'back', name: 'No back accessory' },
    { id: 'companion-none', slot: 'companion', name: 'No companion' },
    { id: 'python-snake', slot: 'companion', name: 'Python shoulder pal', languageIds: ['python'] },
    { id: 'terminal-pack', slot: 'back', name: 'Bash terminal backpack', languageIds: ['bash'] },
    { id: 'database-hat', slot: 'hat', name: 'SQL database hat', languageIds: ['sql', 'mysql', 'mariadb', 'postgresql'] },
    ...[['relaxed', 'Relaxed', 'Easy breathing and relaxed arms.'], ['confident', 'Confident', 'Hands on hips, chin lifted.'], ['shy', 'Shy', 'Arms folded forward, head lowered.'], ['bouncy', 'Happy bounce', 'Raised arms and gentle hops.'], ['drowsy', 'Sleepy daydreamer', 'Closed eyes and sleepy nods.'], ['curious', 'Curious thinker', 'A tilted head and one hand by your chin.'], ['groovy', 'Headphone groove', 'A little shoulder sway, even between exercises.']].map(([id, name, description]) => ({ id: `idle-${id}`, slot: 'idle', name, description })),
    ...[['wave', 'Friendly wave'], ['celebrate', 'Victory cheer'], ['bounce', 'Happy bounce'], ['dance', 'Victory dance'], ['bow', 'Take a bow'], ['salute', 'Ready for launch'], ['dab', 'Victory dab'], ['clap', 'Round of applause']].map(([id, name]) => ({ id: `cel-${id}`, slot: 'celebration', name })),
    ...['sky', 'mint', 'rose', 'amber', 'violet', 'slate', 'crimson', 'orange', 'lemon', 'lime', 'forest', 'teal', 'cyan', 'ocean', 'navy', 'lavender', 'magenta', 'chocolate', 'sand', 'cream', 'white', 'black'].map(id => ({ id, slot: 'color', name: id[0].toUpperCase() + id.slice(1) })),
    { id: 'golden', slot: 'color', name: 'Learner gold', achievement: 'quick-learner' },
    ...['fair', 'warm', 'olive', 'brown', 'deep', 'porcelain', 'peach', 'umber', 'ebony'].map(id => ({ id: `skin-${id}`, slot: 'skin', name: id[0].toUpperCase() + id.slice(1) })),
    ...['chestnut', 'black', 'blonde', 'copper', 'espresso', 'auburn', 'platinum', 'rose', 'violet', 'blue', 'mint', 'white'].map(id => ({ id: `hair-${id}`, slot: 'hairColor', name: id[0].toUpperCase() + id.slice(1) })),
    { id: 'hair-silver', slot: 'hairColor', name: 'Flawless silver', achievement: 'flawless' },
    { id: 'hair-ember', slot: 'hairColor', name: 'Streak ember', achievement: 'streak-starter' },
    ...['navy', 'sand', 'charcoal', 'plum', 'forest', 'sky', 'rose', 'white', 'black', 'orange', 'teal', 'chocolate'].map(id => ({ id: `pants-${id}`, slot: 'pantsColor', name: id[0].toUpperCase() + id.slice(1) })),
    ...['cream', 'ink', 'rose', 'mint', 'crimson', 'orange', 'lemon', 'violet', 'cyan', 'white', 'chocolate', 'silver'].map(id => ({ id: `shoes-${id}`, slot: 'shoesColor', name: id[0].toUpperCase() + id.slice(1) })),
].map(item => ({ ...item, slot: LEGACY_SLOTS[item.id] || item.slot })));

function validateSelection(value) {
    const oldKeys = ['character', 'outfit', 'accessory', 'color', 'skin', 'hair', 'hairColor', 'pantsColor', 'shoesColor', 'hat'];
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some(key => !Object.hasOwn(DEFAULT_SELECTION, key))) throw new Error('Choose a complete avatar selection');
    const keys = Object.keys(value);
    const legacy = [4, 9, 10, 16].includes(keys.length);
    const required = legacy ? (keys.length === 16 ? Object.keys(DEFAULT_SELECTION).slice(0, 16) : oldKeys.slice(0, keys.length)) : Object.keys(DEFAULT_SELECTION);
    if (keys.length !== required.length || !required.every(key => Object.hasOwn(value, key))) throw new Error('Choose a complete avatar selection');
    const selection = { ...DEFAULT_SELECTION, ...(keys.length === 4 ? CHARACTER_PRESETS[value.character] : {}), ...value };
    if (legacy && LEGACY_SLOTS[value.accessory]) { selection[LEGACY_SLOTS[value.accessory]] = value.accessory; selection.accessory = 'none'; }
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
            const achievements = new Map((await database.db.all('SELECT id, name, description, icon, hidden, requirement_type, requirement_value FROM achievements')).map(row => [row.id, row]));
            const progress = await getAvatarProgress(database.db, userId);
            const languageMatches = item => [...achievements.values()].filter(a => a.id.startsWith('language-master-') && (item.languageMaster || item.languageIds?.includes(a.id.slice('language-master-'.length))));
            for (const item of CATALOG) {
                if ((item.achievement && earned.has(item.achievement)) || ((item.languageMaster || item.languageIds) && languageMatches(item).some(a => earned.has(a.id)))) {
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
            const catalog = CATALOG.filter(item => !item.secret || unlocked.has(item.id)).map(item => {
                const languages = languageMatches(item);
                const languageReward = languages.find(a => earned.has(a.id)) || languages.sort((a, b) => progressFor(b, progress).fraction - progressFor(a, progress).fraction)[0];
                const reward = (item.languageMaster || item.languageIds ? languageReward : achievements.get(item.achievement)) || null;
                const measure = reward ? progressFor(reward, progress) : null;
                return { ...item, reward, unlocked: (!item.achievement && !item.languageMaster && !item.languageIds) || unlocked.has(item.id),
                    progress: measure?.current ?? null, target: measure?.target ?? null, progressLabel: measure?.label || null,
                    requirement: reward ? `Earn ${reward.name} — ${reward.description}` : item.languageIds ? `Master ${item.languageIds.join(' or ')} to unlock` : item.languageMaster ? 'Master any language — complete all its chapters' : 'Available from the start' };
            });
            const looks = await database.db.all('SELECT slot, name, selection, updated_at AS updatedAt FROM user_avatar_looks WHERE user_id = ? ORDER BY slot', [userId]);
            const nextUnlocks = catalog.filter(i => !i.unlocked && i.progress !== null && i.target > 0)
                .sort((a, b) => b.progress / b.target - a.progress / a.target || (a.target - a.progress) - (b.target - b.progress));
            const unique = [...new Map(nextUnlocks.map(i => [i.reward.id, i])).values()].slice(0, 4);
            return { selection, completed, catalog, nextUnlocks: unique, looks: looks.map(l => ({ ...l, selection: validateSelection(JSON.parse(l.selection)) })) };
        });
    }
    async function checked(userId, value) {
        const parsed = validateSelection(value);
        const state = await getState(userId);
        let selection = parsed;
        if (Object.keys(value).length < Object.keys(DEFAULT_SELECTION).length) {
            const migrated = { ...state.selection, ...value };
            if (LEGACY_SLOTS[value.accessory]) { migrated[LEGACY_SLOTS[value.accessory]] = value.accessory; migrated.accessory = 'none'; }
            selection = validateSelection(migrated);
        }
        for (const [slot, id] of Object.entries(selection)) {
            if (!state.catalog.find(entry => entry.id === id && entry.slot === slot)?.unlocked) throw new Error('Unlock this item before equipping it');
        }
        return { state, selection };
    }
    async function saveSelection(userId, value) {
        const { state, selection } = await checked(userId, value);
        await database.withWriteTransaction(() => database.db.run(`INSERT INTO user_avatars (user_id, selection) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET selection = excluded.selection, updated_at = CURRENT_TIMESTAMP`, [userId, JSON.stringify(selection)]));
        return { ...state, selection };
    }
    async function saveLook(userId, slot, body) {
        if (!Number.isInteger(slot) || slot < 1 || slot > 5 || !body || Object.keys(body).some(k => !['name', 'selection'].includes(k))
            || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 40) throw new Error('Invalid saved look: choose a slot from 1 to 5 and a name up to 40 characters');
        const { selection } = await checked(userId, body.selection);
        await database.withWriteTransaction(() => database.db.run(`INSERT INTO user_avatar_looks (user_id, slot, name, selection) VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, slot) DO UPDATE SET name = excluded.name, selection = excluded.selection, updated_at = CURRENT_TIMESTAMP`, [userId, slot, body.name.trim(), JSON.stringify(selection)]));
        return getState(userId);
    }
    async function deleteLook(userId, slot) {
        if (!Number.isInteger(slot) || slot < 1 || slot > 5) throw new Error('Invalid saved look slot');
        await database.withWriteTransaction(() => database.db.run('DELETE FROM user_avatar_looks WHERE user_id = ? AND slot = ?', [userId, slot]));
        return getState(userId);
    }

    // Public identity consists only of equipped, validated catalog IDs.
    async function getAppearances(userIds) {
        const ids = [...new Set(userIds.filter(Number.isSafeInteger))];
        const appearances = new Map(ids.map(id => [id, { ...DEFAULT_SELECTION }]));
        if (!ids.length) return appearances;
        const rows = await database.db.all(`SELECT user_id, selection FROM user_avatars WHERE user_id IN (${ids.map(() => '?').join(',')})`, ids);
        for (const row of rows) {
            try { appearances.set(row.user_id, validateSelection(JSON.parse(row.selection))); }
            catch { /* A damaged old selection falls back to the starter character. */ }
        }
        return appearances;
    }
    return { getState, saveSelection, saveLook, deleteLook, getAppearances };
}
module.exports = { createAvatarService, DEFAULT_SELECTION, CATALOG, validateSelection };
