// Headwear competes for physical space. Keep old saved choices intact when rendering;
// for new choices the item picked last wins, rather than saving intersecting gear.
export function getAvatarFit(selection) {
    const hat = selection.hat || 'hat-none';
    const blocked = selection.accessory === 'crown' && !['hat-none', 'runner'].includes(hat)
        || selection.accessory === 'headphones' && !['hat-none', 'runner'].includes(hat)
        || selection.accessory === 'lightning' && ['space-helmet', 'viking', 'centurion-helmet'].includes(hat);
    return { hideAccessory: blocked, notes: blocked ? ['This headwear covers your accessory. Choose no hat to show it, or pick another accessory.'] : [] };
}
export function chooseAvatarItem(selection, slot, id) {
    const next = { ...selection, [slot]: id };
    let removedSlot = null;
    if (getAvatarFit(next).hideAccessory) {
        removedSlot = slot === 'accessory' ? 'hat' : 'accessory';
        next[removedSlot] = removedSlot === 'hat' ? 'hat-none' : 'none';
    }
    return { selection: next, removedSlot };
}
