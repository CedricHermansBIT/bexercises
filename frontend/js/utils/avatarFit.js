// New selections replace competing gear; old saved combinations render with a note.
export function getAvatarFit(selection) {
    const hat = selection.hat || 'hat-none';
    const hiddenSlots = [];
    if (!['audio-none', 'earbuds', undefined].includes(selection.audio) && !['hat-none', 'runner', 'crown'].includes(hat)) hiddenSlots.push('audio');
    if (selection.jewellery === 'lightning' && ['space-helmet', 'viking', 'centurion-helmet'].includes(hat)) hiddenSlots.push('jewellery');
    // Retain compatibility with older clients while their records migrate.
    if (selection.accessory === 'crown' && !['hat-none', 'runner'].includes(hat)
        || selection.accessory === 'headphones' && !['hat-none', 'runner'].includes(hat)
        || selection.accessory === 'lightning' && ['space-helmet', 'viking', 'centurion-helmet'].includes(hat)) hiddenSlots.push('accessory');
    return { hiddenSlots, hideAccessory: hiddenSlots.includes('accessory'), notes: hiddenSlots.length ? ['This headwear covers some gear. Choose no hat to show it, or pick different gear.'] : [] };
}
export function chooseAvatarItem(selection, slot, id) {
    const next = { ...selection, [slot]: id };
    const hidden = getAvatarFit(next).hiddenSlots;
    let removedSlot = null;
    if (hidden.length) {
        if (hidden.includes(slot)) { next.hat = 'hat-none'; removedSlot = 'hat'; }
        else for (const blocked of hidden) {
            next[blocked] = { audio: 'audio-none', jewellery: 'jewel-none', accessory: 'none' }[blocked]; removedSlot = blocked;
        }
    }
    return { selection: next, removedSlot };
}
