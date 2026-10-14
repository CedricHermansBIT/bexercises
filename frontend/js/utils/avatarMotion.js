// Work from rest transforms, never from the previous frame, to avoid drift.
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
        gesture(name, seconds) { if (['wave', 'celebrate'].includes(name)) gesture = { name, start: seconds }; },
        update(seconds, reducedMotion = false) {
            const progress = gesture ? (seconds - gesture.start) / 2.8 : 1;
            if (progress >= 1 || reducedMotion) gesture = null;
            const amount = gesture ? Math.max(0, Math.min(1, progress / 0.2, (1 - progress) / 0.2)) : 0;
            const raised = amount * amount * (3 - 2 * amount);
            for (const { object, motion, side, position, rotation, scale } of parts) {
                if (['spin', 'duck', 'bird', 'tassel', 'wing', 'head', 'arm'].includes(motion)) object.rotation.copy(rotation);
                if (['duck', 'bird'].includes(motion)) object.position.copy(position);
                if (['flame', 'sparkle', 'pulse', 'blink'].includes(motion)) object.scale.copy(scale);
                if (reducedMotion || !visible(object)) continue;
                if (motion === 'spin') object.rotation.y += seconds * 6 % (2 * Math.PI);
                if (motion === 'duck') { object.rotation.z += Math.sin(seconds * 2.4) * 0.065; object.position.y += Math.sin(seconds * 2.4) * 0.008; }
                if (motion === 'bird') { object.position.y += Math.max(0, Math.sin(seconds * 2)) * 0.045; object.rotation.y += Math.sin(seconds * 1.6) * 0.18; }
                if (motion === 'tassel') object.rotation.z += Math.sin(seconds * 2.2) * 0.12;
                if (motion === 'wing') object.rotation.y += side * Math.sin(seconds * 2.5) * 0.23;
                if (motion === 'head') { object.rotation.y += Math.sin(seconds * 0.65) * 0.04; object.rotation.x += Math.sin(seconds * 1.1) * 0.014; }
                if (motion === 'arm') {
                    const active = gesture && (gesture.name === 'celebrate' || side === 1);
                    object.rotation.z += side * (active ? raised * (1.85 + Math.sin(seconds * 8) * 0.12) : Math.sin(seconds * 0.9 + side) * 0.025);
                }
                if (motion === 'flame') { object.scale.y *= 1 + Math.sin(seconds * 7) * 0.065 + Math.sin(seconds * 11) * 0.025; object.scale.x *= 1 + Math.sin(seconds * 6) * 0.04; }
                if (motion === 'sparkle') object.scale.multiplyScalar(1 + Math.sin(seconds * 2.8) * 0.15);
                if (motion === 'pulse') object.scale.multiplyScalar(1 + Math.sin(seconds * 3.5) * 0.045);
                if (motion === 'blink' && seconds % 3.8 < 0.14) object.scale.y *= 0.12;
            }
        }
    };
}
