// Poses use articulated shoulders, elbows and a waist. Always start from rest to avoid drift.
export function createAvatarAnimator(model) {
    const parts = [];
    model.traverse(object => {
        if (!object.userData.avatar_motion) return;
        parts.push({ object, motion: object.userData.avatar_motion, side: object.userData.avatar_side || 1,
            position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone() });
    });
    let gesture = null;
    const visible = object => {
        for (let node = object; node; node = node.parent) if (!node.visible) return false;
        return true;
    };
    return {
        gesture(name, seconds) { if (['wave', 'celebrate', 'bounce', 'dance', 'bow'].includes(name)) gesture = { name, start: seconds }; },
        update(seconds, reducedMotion = false, selection = {}) {
            const progress = gesture ? (seconds - gesture.start) / 3.2 : 1;
            if (progress >= 1 || reducedMotion) gesture = null;
            const amount = gesture ? Math.max(0, Math.min(1, progress / 0.2, (1 - progress) / 0.2)) : 0;
            const raised = amount * amount * (3 - 2 * amount);
            const personality = selection.idle || 'idle-relaxed';
            for (const { object, motion, side, position, rotation, scale } of parts) {
                if (['spin', 'duck', 'bird', 'tassel', 'wing', 'head', 'arm', 'elbow', 'torso'].includes(motion)) object.rotation.copy(rotation);
                if (['duck', 'bird', 'snake'].includes(motion)) object.position.copy(position);
                if (['flame', 'sparkle', 'pulse', 'blink'].includes(motion)) object.scale.copy(scale);
                if (!visible(object)) continue;
                // Reduced motion retains the chosen static personality, but removes movement.
                if (motion === 'arm') object.rotation.z += side * ({ 'idle-confident': 0.38, 'idle-shy': -0.17, 'idle-bouncy': 0.65 }[personality] || 0);
                if (motion === 'elbow') {
                    object.rotation.z += side * ({ 'idle-confident': -0.95, 'idle-bouncy': 0.75 }[personality] || 0);
                    object.rotation.x += ({ 'idle-confident': -0.50, 'idle-shy': -1.25, 'idle-drowsy': -0.15 }[personality] || 0);
                }
                if (motion === 'head') {
                    object.rotation.x += ({ 'idle-shy': 0.13, 'idle-drowsy': 0.20, 'idle-confident': -0.04 }[personality] || 0);
                    if (personality === 'idle-shy') object.rotation.y += 0.14;
                }
                if (motion === 'blink' && personality === 'idle-drowsy') object.scale.y *= 0.15;
                if (reducedMotion) continue;
                if (gesture && motion === 'arm') {
                    object.rotation.copy(rotation);
                    const angles = { wave: side === 1 ? 0.80 : 0, celebrate: 2.35, bounce: 0.70,
                        dance: 0.55 + Math.sin(seconds * 5 + side) * 0.65, bow: 0.08 };
                    object.rotation.z += side * raised * angles[gesture.name];
                }
                if (gesture && motion === 'elbow') {
                    object.rotation.copy(rotation);
                    object.rotation.z += side * raised * ({ wave: side === 1 ? 1.25 + Math.sin(seconds * 9) * 0.15 : 0,
                        celebrate: 0.35, bounce: 1.1, dance: 0.9 + Math.cos(seconds * 5 + side) * 0.75, bow: 0 }[gesture.name]);
                    if (gesture.name === 'bow' && side === 1) object.rotation.x -= raised * 0.8;
                }
                if (motion === 'torso') object.rotation.x += gesture?.name === 'bow' ? raised * 0.48 : personality === 'idle-shy' ? 0.045 : 0;
                if (motion === 'head') {
                    if (gesture?.name === 'bow') object.rotation.x += raised * 0.12;
                    else { object.rotation.y += Math.sin(seconds * 0.65) * 0.04; object.rotation.x += Math.sin(seconds * 1.1) * 0.014; }
                }
                if (motion === 'spin') object.rotation.y += seconds * 6 % (2 * Math.PI);
                if (motion === 'snake') object.position.y += Math.sin(seconds * 2) * 0.008;
                if (motion === 'duck') { object.rotation.z += Math.sin(seconds * 2.4) * 0.065; object.position.y += Math.sin(seconds * 2.4) * 0.008; }
                if (motion === 'bird') { object.position.y += Math.max(0, Math.sin(seconds * 2)) * 0.045; object.rotation.y += Math.sin(seconds * 1.6) * 0.18; }
                if (motion === 'tassel') object.rotation.z += Math.sin(seconds * 2.2) * 0.12;
                if (motion === 'wing') object.rotation.y += side * Math.sin(seconds * 2.5) * 0.23;
                if (motion === 'flame') { object.scale.y *= 1 + Math.sin(seconds * 7) * 0.065 + Math.sin(seconds * 11) * 0.025; object.scale.x *= 1 + Math.sin(seconds * 6) * 0.04; }
                if (motion === 'sparkle') object.scale.multiplyScalar(1 + Math.sin(seconds * 2.8) * 0.15);
                if (motion === 'pulse') object.scale.multiplyScalar(1 + Math.sin(seconds * 3.5) * 0.045);
                if (motion === 'blink' && seconds % 3.8 < 0.14) object.scale.y *= 0.12;
            }
            return { bounce: reducedMotion ? 0 : gesture?.name === 'bounce' ? raised * Math.abs(Math.sin(seconds * 8)) * 0.16
                : gesture?.name === 'dance' ? raised * Math.abs(Math.sin(seconds * 5)) * 0.055
                : personality === 'idle-bouncy' ? Math.abs(Math.sin(seconds * 3)) * 0.055 : 0,
                sway: reducedMotion ? 0 : gesture?.name === 'dance' ? Math.sin(seconds * 5) * raised * 0.12 : 0 };
        }
    };
}
