const COLORS = { sky: '#5f9ff5', mint: '#5ec9ab', rose: '#ef8eb2', amber: '#f3bc62', violet: '#aa91ee', slate: '#8394ab' };

// All drawing inputs resolve to local shapes and colors; no user-provided SVG.
export function renderAvatar(selection, label = 'Your character') {
    const color = COLORS[selection.color] || COLORS.sky;
    const character = ['robot', 'sprout', 'fox', 'cat'].includes(selection.character) ? selection.character : 'robot';
    const face = { robot: '#b8d9e7', sprout: '#b4dfa0', fox: '#efaa6e', cat: '#bcb8d6' }[character];
    const ears = character === 'fox' || character === 'cat'
        ? `<path d="M69 95 65 40 104 66M171 95 175 40 136 66" fill="${face}" stroke="#354354" stroke-width="5" stroke-linejoin="round"/><path d="m77 62 4 23 14-13m68-10-4 23-14-13" fill="#f3bcc1"/>`
        : character === 'sprout'
            ? '<path d="M120 62V39" stroke="#59805a" stroke-width="5"/><path d="M121 44Q90 44 93 19Q124 19 121 44M122 39Q124 14 149 18Q149 42 122 39" fill="#80bd85" stroke="#59805a" stroke-width="3"/>'
            : '<path d="M120 62V36" stroke="#354354" stroke-width="5"/><circle cx="120" cy="31" r="8" fill="#f2bf70" stroke="#354354" stroke-width="4"/>';
    const outfit = selection.outfit;
    const clothing = outfit === 'lab-coat'
        ? '<path d="M85 158h70l18 79H67z" fill="#fffaf0"/><path d="m100 159 20 29 20-29M120 188v49" fill="none" stroke="#bac5cc" stroke-width="4"/><rect x="138" y="197" width="20" height="18" rx="3" fill="#c1d9e3"/>'
        : outfit === 'space-suit'
            ? `<path d="M85 158h70l18 79H67z" fill="#fffaf0"/><rect x="97" y="178" width="46" height="35" rx="7" fill="${color}"/><circle cx="108" cy="189" r="4" fill="#fff"/><path d="M122 189h12m-26 13h26" stroke="#fff" stroke-width="3"/>`
            : `<path d="M85 158h70l18 79H67z" fill="${color}"/>${outfit === 'hoodie' ? '<path d="m97 160 23 17 23-17M111 177v26m18-26v26M95 211h50" fill="none" stroke="#ffffff8a" stroke-width="4" stroke-linecap="round"/>' : '<path d="M105 161q15 16 30 0" fill="none" stroke="#ffffff8a" stroke-width="5"/>'}`;
    const accessory = selection.accessory === 'glasses'
        ? '<g fill="none" stroke="#354354" stroke-width="5"><rect x="80" y="98" width="32" height="25" rx="9"/><rect x="128" y="98" width="32" height="25" rx="9"/><path d="M112 110h16m-56-6h8m80 0h8"/></g>'
        : selection.accessory === 'headphones'
            ? '<path d="M60 116V98a60 60 0 0 1 120 0v18" fill="none" stroke="#495875" stroke-width="10"/><rect x="53" y="101" width="18" height="35" rx="8" fill="#f2bf70"/><rect x="169" y="101" width="18" height="35" rx="8" fill="#f2bf70"/>'
            : selection.accessory === 'crown'
                ? '<path d="m86 68-6-29 23 13 17-24 17 24 23-13-6 29z" fill="#f2bf70" stroke="#ac7b30" stroke-width="4" stroke-linejoin="round"/><circle cx="120" cy="55" r="5" fill="#ed8e9c"/>' : '';
    const safeLabel = String(label).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" role="img" aria-label="${safeLabel}">
        <ellipse cx="120" cy="257" rx="66" ry="12" fill="#35435418"/>
        <path d="M90 229v20m60-20v20" stroke="#354354" stroke-width="19" stroke-linecap="round"/>
        <path d="m85 175-21 36m91-36 21 36" stroke="${face}" stroke-width="21" stroke-linecap="round"/>
        ${clothing}${ears}
        <rect x="66" y="59" width="108" height="99" rx="${character === 'robot' ? '25' : '46'}" fill="${face}" stroke="#354354" stroke-width="5"/>
        ${character === 'fox' ? '<path d="M73 112q22-11 47 21 25-32 47-21v15q-5 28-47 28-42 0-47-28z" fill="#fff4df"/>' : ''}
        <circle cx="96" cy="108" r="6" fill="#354354"/><circle cx="144" cy="108" r="6" fill="#354354"/>
        <path d="M110 133q10 8 20 0" stroke="#354354" stroke-width="4" fill="none" stroke-linecap="round"/>
        <ellipse cx="84" cy="126" rx="8" ry="4" fill="#ee8fa280"/><ellipse cx="156" cy="126" rx="8" ry="4" fill="#ee8fa280"/>
        ${accessory}</svg>`;
}
