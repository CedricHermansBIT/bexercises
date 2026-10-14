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
