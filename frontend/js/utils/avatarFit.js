export const DRESS_OUTFITS = ['sundress', 'pinafore', 'party-dress', 'starlight-dress', 'wizard-robe'];
// New selections replace competing gear; old saved combinations render with a note.
export function getAvatarFit(selection) {
    const hat = selection.hat || 'hat-none';
    const hiddenSlots = [];
    if (!['audio-none', 'earbuds', undefined].includes(selection.audio) && !['hat-none', 'runner', 'crown'].includes(hat)) hiddenSlots.push('audio');
    if (selection.jewellery === 'lightning' && ['space-helmet', 'viking', 'centurion-helmet', 'welding-visor'].includes(hat)) hiddenSlots.push('jewellery');
    // Retain compatibility with older clients while their records migrate.
    if (selection.accessory === 'crown' && !['hat-none', 'runner'].includes(hat)
        || selection.accessory === 'headphones' && !['hat-none', 'runner'].includes(hat)
        || selection.accessory === 'lightning' && ['space-helmet', 'viking', 'centurion-helmet', 'welding-visor'].includes(hat)) hiddenSlots.push('accessory');
    const coversPants = DRESS_OUTFITS.includes(selection.outfit);
    const clothingNote = coversPants ? ['This outfit includes its own skirt or robe. Choosing pants or a separate skirt switches back to a tee; your shoes stay on.'] : selection.outfit === 'space-suit' ? ['The space suit includes pressure trousers and moon boots. Your pants and shoes return when you change outfits.'] : [];
    return { hiddenSlots, coversPants, hideAccessory: hiddenSlots.includes('accessory'), notes: [...(hiddenSlots.length ? ['This headwear covers some gear. Choose no hat to show it, or pick different gear.'] : []), ...clothingNote] };
}
export function chooseAvatarItem(selection, slot, id) {
    const next = { ...selection, [slot]: id };
    const hidden = getAvatarFit(next).hiddenSlots;
    let removedSlot = null;
    if (slot === 'pants' && DRESS_OUTFITS.includes(next.outfit)) { next.outfit = 'tee'; removedSlot = 'outfit'; }
    if (hidden.length) {
        if (hidden.includes(slot)) { next.hat = 'hat-none'; removedSlot = 'hat'; }
        else for (const blocked of hidden) {
            next[blocked] = { audio: 'audio-none', jewellery: 'jewel-none', accessory: 'none' }[blocked]; removedSlot = blocked;
        }
    }
    return { selection: next, removedSlot };
}
