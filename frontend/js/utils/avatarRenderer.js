// Linear RGB palettes shared by the 3D viewer and trusted color swatches.
const EXTRA_COLORS = { crimson: [.72,.035,.06], orange: [.95,.22,.025], lemon: [.94,.85,.05], lime: [.40,.77,.05],
    forest: [.035,.22,.07], teal: [.035,.38,.36], cyan: [.07,.72,.87], ocean: [.025,.18,.63], navy: [.025,.045,.15],
    lavender: [.57,.42,.84], magenta: [.82,.055,.50], chocolate: [.19,.085,.04], sand: [.60,.45,.25],
    cream: [.90,.84,.69], white: [.96,.96,.94], black: [.018,.022,.03] };
export const AVATAR_COLORS = { sky: [0.12, 0.36, 0.72], mint: [0.10, 0.56, 0.40], rose: [0.74, 0.22, 0.40],
    amber: [0.87, 0.48, 0.12], violet: [0.43, 0.27, 0.73], slate: [0.25, 0.34, 0.45], golden: [0.92, 0.66, 0.16], ...EXTRA_COLORS };
export const AVATAR_SKINS = { 'skin-fair': [0.88, 0.64, 0.46], 'skin-warm': [0.67, 0.40, 0.25],
    'skin-olive': [0.55, 0.37, 0.22], 'skin-brown': [0.40, 0.22, 0.13], 'skin-deep': [0.20, 0.10, 0.06],
    'skin-porcelain': [.96,.78,.65], 'skin-peach': [.78,.51,.36], 'skin-umber': [.30,.155,.085], 'skin-ebony': [.105,.047,.027] };
export const AVATAR_HAIR_COLORS = { 'hair-chestnut': [0.10, 0.055, 0.035], 'hair-black': [0.025, 0.02, 0.02],
    'hair-blonde': [0.65, 0.43, 0.18], 'hair-copper': [0.38, 0.12, 0.045], 'hair-silver': [0.60, 0.65, 0.70], 'hair-espresso': [.055,.025,.012], 'hair-auburn': [.19,.045,.025],
    'hair-platinum': [.87,.81,.66], 'hair-rose': [.84,.19,.39], 'hair-violet': [.36,.075,.68],
    'hair-blue': [.04,.20,.78], 'hair-mint': [.10,.65,.40], 'hair-white': [.92,.93,.94], 'hair-ember': [.95,.16,.025] };
export const AVATAR_PANTS_COLORS = { 'pants-navy': [0.09, 0.14, 0.23], 'pants-sand': [0.59, 0.46, 0.29],
    'pants-charcoal': [0.09, 0.10, 0.12], 'pants-plum': [0.24, 0.09, 0.21],
    ...Object.fromEntries(['forest','sky','rose','white','black','orange','teal','chocolate'].map(id => [`pants-${id}`, AVATAR_COLORS[id]])) };
export const AVATAR_SHOES_COLORS = { 'shoes-cream': [0.92, 0.92, 0.85], 'shoes-ink': [0.035, 0.045, 0.06],
    'shoes-rose': [0.74, 0.22, 0.40], 'shoes-mint': [0.10, 0.56, 0.40],
    ...Object.fromEntries(['crimson','orange','lemon','violet','cyan','white','chocolate'].map(id => [`shoes-${id}`, AVATAR_COLORS[id]])), 'shoes-silver': [.60,.65,.70] };
export const AVATAR_PALETTES = { color: AVATAR_COLORS, skin: AVATAR_SKINS, hairColor: AVATAR_HAIR_COLORS,
    pantsColor: AVATAR_PANTS_COLORS, shoesColor: AVATAR_SHOES_COLORS };
export const AVATAR_OPTIONS = { character: ['robot', 'sprout', 'fox', 'cat'], outfit: ['tee', 'hoodie', 'lab-coat', 'space-suit'],
    accessory: ['none', 'glasses', 'headphones', 'crown', 'glasses-69', 'glasses-67', 'star-glasses', 'pixel-shades', 'owl-glasses', 'lightning', 'bow-tie', 'wings', 'language-medal', 'matrix-shades'], hair: ['crop', 'curls', 'bob', 'bun', 'mohawk', 'braid', 'bald', 'buzz', 'pixie', 'afro', 'ponytail', 'twin-buns', 'spiky', 'long-waves', 'dreads', 'pompadour'],
    hat: ['hat-none', 'cap', 'beanie', 'duck', 'propeller', 'wizard', 'graduation', 'space-helmet', 'viking', 'centurion-helmet', 'mushroom', 'top-hat', 'runner', 'early-bird-hat', 'flame'],
    ...Object.fromEntries(Object.entries(AVATAR_PALETTES).map(([slot, palette]) => [slot, Object.keys(palette)])) };

// Local Blender renders provide wardrobe thumbnails and a non-WebGL fallback.
export function renderAvatar(selection, label = 'Your character', slot = 'character') {
    if (!AVATAR_OPTIONS[slot]) slot = 'character';
    const id = AVATAR_OPTIONS[slot].includes(selection[slot]) ? selection[slot] : AVATAR_OPTIONS[slot][0];
    const safeLabel = String(label).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const palette = AVATAR_PALETTES[slot];
    if (palette) {
        const rgb = palette[id].map(v => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
        return `<span class="avatar-swatch" role="img" aria-label="${safeLabel}" style="background-color:rgb(${rgb.join(',')})"></span>`;
    }
    return `<img class="avatar-thumbnail" src="../../assets/avatars/${slot}-${id}.png" alt="${safeLabel}" loading="lazy" decoding="async">`;
}
