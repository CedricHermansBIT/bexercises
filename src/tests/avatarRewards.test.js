const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('achievement reward previews show earned, unlocked items and match language-specific rewards', async () => {
    const source = fs.readFileSync('frontend/js/utils/avatarRewards.js', 'utf8');
    const { getAchievementRewards } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const catalog = [
        { id: 'specs', achievement: 'nice', unlocked: true },
        { id: 'headphones', achievement: 'nice', unlocked: true },
        { id: 'secret', achievement: 'hackerman', unlocked: false },
        { id: 'medal', languageMaster: true, unlocked: true },
        { id: 'snake', languageIds: ['python'], unlocked: true },
        { id: 'hat', languageIds: ['sql', 'mariadb'], unlocked: true },
        { id: 'free', unlocked: true }
    ];
    const rewards = (id, earned = true) => getAchievementRewards({ id, earned }, catalog).map(item => item.id);
    assert.deepEqual(rewards('nice'), ['specs', 'headphones']);
    assert.deepEqual(rewards('nice', false), []);
    assert.deepEqual(rewards('hackerman'), []);
    assert.deepEqual(rewards('language-master-python'), ['medal', 'snake']);
    assert.deepEqual(rewards('language-master-sql'), ['medal', 'hat']);
    assert.deepEqual(rewards('language-master-bash'), ['medal']);
    assert.deepEqual(getAchievementRewards({ id: 'nice', earned: true }), []);
});

test('standalone wearable previews contain only the selected item meshes, without skin or other gear', async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const bundle = fs.readFileSync('frontend/js/vendor/avatar3d.bundle.js', 'utf8');
    const { selectAvatarReward } = await import(`data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`);
    const data = fs.readFileSync('frontend/assets/avatars/wardrobe.glb');
    const { scene } = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.length), '');
    const { DEFAULT_SELECTION } = require('../services/avatarService');
    for (const [slot, id] of [['accessory', 'glasses-69'], ['audio', 'cat-headphones'], ['hat', 'propeller'], ['back', 'wings'], ['outfit', 'space-suit'], ['companion', 'cat-pal'], ['outfit', 'party-dress'], ['outfit', 'wizard-robe'], ['pants', 'tulle-skirt'], ['shoes', 'mary-janes']]) {
        const box = selectAvatarReward(scene, DEFAULT_SELECTION, { slot, id });
        assert.ok(!box.isEmpty());
        let count = 0;
        scene.traverse(object => {
            if (!object.isMesh || !object.visible) return;
            count++;
            let owner = object;
            while (owner && !owner.userData.avatar_slot) owner = owner.parent;
            assert.equal(owner?.userData.avatar_slot, slot);
            assert.equal(owner?.userData.avatar_id, id);
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            assert.ok(materials.every(material => material.name !== 'Skin'));
        });
        assert.ok(count > 0);
    }
});
