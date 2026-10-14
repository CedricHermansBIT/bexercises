// Linear RGB palettes shared by the 3D viewer and trusted color swatches.
export const AVATAR_COLORS = { sky: [0.12, 0.36, 0.72], mint: [0.10, 0.56, 0.40], rose: [0.74, 0.22, 0.40],
    amber: [0.87, 0.48, 0.12], violet: [0.43, 0.27, 0.73], slate: [0.25, 0.34, 0.45], golden: [0.92, 0.66, 0.16] };
export const AVATAR_SKINS = { 'skin-fair': [0.88, 0.64, 0.46], 'skin-warm': [0.67, 0.40, 0.25],
    'skin-olive': [0.55, 0.37, 0.22], 'skin-brown': [0.40, 0.22, 0.13], 'skin-deep': [0.20, 0.10, 0.06] };
export const AVATAR_HAIR_COLORS = { 'hair-chestnut': [0.10, 0.055, 0.035], 'hair-black': [0.025, 0.02, 0.02],
    'hair-blonde': [0.65, 0.43, 0.18], 'hair-copper': [0.38, 0.12, 0.045], 'hair-silver': [0.60, 0.65, 0.70] };
export const AVATAR_PANTS_COLORS = { 'pants-navy': [0.09, 0.14, 0.23], 'pants-sand': [0.59, 0.46, 0.29],
    'pants-charcoal': [0.09, 0.10, 0.12], 'pants-plum': [0.24, 0.09, 0.21] };
export const AVATAR_SHOES_COLORS = { 'shoes-cream': [0.92, 0.92, 0.85], 'shoes-ink': [0.035, 0.045, 0.06],
    'shoes-rose': [0.74, 0.22, 0.40], 'shoes-mint': [0.10, 0.56, 0.40] };
export const AVATAR_PALETTES = { color: AVATAR_COLORS, skin: AVATAR_SKINS, hairColor: AVATAR_HAIR_COLORS,
    pantsColor: AVATAR_PANTS_COLORS, shoesColor: AVATAR_SHOES_COLORS };
export const AVATAR_OPTIONS = { character: ['robot', 'sprout', 'fox', 'cat'], outfit: ['tee', 'hoodie', 'lab-coat', 'space-suit'],
    accessory: ['none', 'glasses', 'headphones', 'crown'], hair: ['crop', 'curls', 'bob', 'bun', 'mohawk', 'braid'],
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
