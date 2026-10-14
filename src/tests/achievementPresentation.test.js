const test = require('node:test');
const assert = require('node:assert/strict');
const { presentAchievements } = require('../services/achievementPresentation');
const { progressFor } = require('../services/avatarProgressService');

test('regular achievement hints use the same measures as character rewards', () => {
    const achievement = { id: 'learner', name: 'Learner', earned: 0, hidden: 0, requirement_type: 'exercises_completed', requirement_value: 10 };
    const stats = { completed: 4 };
    const [result] = presentAchievements([achievement], stats);
    assert.deepEqual(result.measure, progressFor(achievement, stats));
    assert.equal(result.measure.current, 4);
    assert.equal(result.measure.label, '6 more exercises to go');
});

test('locked secrets expose no requirement, description, points or progress hints', () => {
    const secret = { id: 'secret', name: 'Revealing title', description: 'Revealing instruction', points: 500, earned: 0, hidden: 1, requirement_type: 'exercises_completed', requirement_value: 10, progress: 4 };
    const [result] = presentAchievements([secret], { completed: 4 });
    assert.deepEqual(Object.keys(result).sort(), ['category', 'description', 'earned', 'hidden', 'icon', 'id', 'name']);
    assert.equal(result.name, 'Secret achievement');
    assert.ok(!JSON.stringify(result).includes('Revealing'));
    const [earned] = presentAchievements([{ ...secret, earned: 1 }], { completed: 4 });
    assert.equal(earned.name, secret.name);
    assert.equal(earned.measure, null);
});

test('earned milestones keep their earned status when live counters decrease', () => {
    const [earned] = presentAchievements([{ earned: 1, requirement_type: 'daily_streak', requirement_value: 7 }], { streak: 0 });
    assert.equal(earned.earned, 1);
    assert.equal(earned.measure, null);
});
