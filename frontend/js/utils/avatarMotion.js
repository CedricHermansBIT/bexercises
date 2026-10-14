// Poses use articulated shoulders, elbows and a waist. Always start from rest to avoid drift.
export function createAvatarAnimator(model) {
    const vector = (x, y, z) => model.position.clone().set(x, y, z);
    // Hand targets are relative to the shoulder. Solve both joints together so
    // the forearm actually crosses the face or the hand reaches above the head.
    function armPose(name, side, seconds) {
        let target, bend, reach;
        if (name === 'dab') {
            reach = side === 1 ? 1.6 : 1.7;
            target = side === 1 ? vector(.78, .48, .04) : vector(.42, .48, .56);
            bend = side === 1 ? vector(.4, -.3, .1) : vector(-.9, 1.2, .8);
        } else if (name === 'celebrate') {
            reach = 1.65; target = vector(side * .10, .91, .04); bend = vector(side, .1, .2);
        } else if (name === 'wave' && side === 1) {
            reach = 1.35; target = vector(.23 + Math.sin(seconds * 9) * .055, .70, .06); bend = vector(.7, .1, .3);
        } else if (name === 'salute' && side === 1) {
            reach = 1.25; target = vector(-.12, .54, .31); bend = vector(.8, .4, .15);
        } else if (name === 'bounce') {
            reach = 1.15; target = vector(side * .18, .40, .15); bend = vector(side, .1, .3);
        } else if (name === 'dance') {
            reach = 1.25; target = vector(side * (.40 + Math.sin(seconds * 5 + side) * .08), .16 + Math.sin(seconds * 5 + side) * .32, .18); bend = vector(side, .1, .4);
        } else return null;
        const upper = vector(side * .101, -.275, 0);
        const lower = vector(side * .075, -.275, .025);
        const a = upper.length() * reach, b = lower.length() * reach;
        const distance = Math.min(target.length(), a + b - .0001);
        const direction = target.clone().normalize(); target.copy(direction).multiplyScalar(distance);
        const along = (a * a + distance * distance - b * b) / (2 * distance);
        const perpendicular = bend.addScaledVector(direction, -bend.dot(direction)).normalize();
        const elbow = direction.clone().multiplyScalar(along).addScaledVector(perpendicular, Math.sqrt(Math.max(0, a * a - along * along)));
        const shoulderRotation = model.quaternion.clone().identity().setFromUnitVectors(upper.normalize(), elbow.clone().normalize());
        const forearmDirection = target.sub(elbow).normalize().applyQuaternion(shoulderRotation.clone().invert());
        return { reach, shoulderRotation, elbowRotation: model.quaternion.clone().identity().setFromUnitVectors(lower.normalize(), forearmDirection) };
    }

    const parts = [];
    model.traverse(object => {
        if (!object.userData.avatar_motion) return;
        let limb = null;
        if (object.userData.avatar_motion === 'arm') {
            const meshes = [];
            object.traverse(child => {
                if (child.isMesh) meshes.push({ object: child, scale: child.scale.clone(), joint: /^(Arm|Sleeve)_cap_B[0-9]*$/.test(child.name),
                    segment: /^(Arm|Forearm|Sleeve|Sleeve_forearm|Sleeve_cuff|Sleeve_knit_cuff|Sleeve_blouse_cuff|Sleeve_robe_cuff|Suit_wrist_seal|Shoulder_armor)[0-9]*$/.test(child.name) });
            });
            limb = { meshes, reach: 1 };
        }
        parts.push({ object, limb, motion: object.userData.avatar_motion, side: object.userData.avatar_side || 1,
            position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone() });
    });
    let gesture = null;
    const visible = object => {
        for (let node = object; node; node = node.parent) if (!node.visible) return false;
        return true;
    };
    return {
        gesture(name, seconds) { if (['wave', 'celebrate', 'bounce', 'dance', 'bow', 'salute', 'dab', 'clap'].includes(name)) gesture = { name, start: seconds }; },
        update(seconds, reducedMotion = false, selection = {}) {
            const progress = gesture ? (seconds - gesture.start) / 3.2 : 1;
            if (progress >= 1 || reducedMotion) gesture = null;
            const amount = gesture ? Math.max(0, Math.min(1, progress / 0.2, (1 - progress) / 0.2)) : 0;
            const raised = amount * amount * (3 - 2 * amount);
            const personality = selection.idle || 'idle-relaxed';
            const armPoses = gesture ? new Map([-1, 1].map(side => [side, armPose(gesture.name, side, seconds)])) : new Map();
            for (const { object, limb, motion, side, position, rotation, scale } of parts) {
                if (limb && limb.reach !== 1) {
                    object.scale.copy(scale); limb.meshes.forEach(mesh => mesh.object.scale.copy(mesh.scale)); limb.reach = 1;
                }
                if (['spin', 'duck', 'bird', 'tassel', 'wing', 'head', 'arm', 'elbow', 'torso', 'cloth'].includes(motion)) object.rotation.copy(rotation);
                if (['duck', 'bird', 'snake', 'code'].includes(motion)) object.position.copy(position);
                if (['flame', 'sparkle', 'pulse', 'blink', 'jet'].includes(motion)) object.scale.copy(scale);
                if (!visible(object)) continue;
                // Reduced motion retains the chosen static personality, but removes movement.
                if (motion === 'arm') object.rotation.z += side * ({ 'idle-confident': 0.38, 'idle-shy': -0.17, 'idle-bouncy': 0.65, 'idle-curious': side === 1 ? 1.0 : 0, 'idle-groovy': 0.22 }[personality] || 0);
                if (motion === 'elbow') {
                    object.rotation.z += side * ({ 'idle-confident': -0.95, 'idle-bouncy': 0.75, 'idle-curious': side === 1 ? 2.8 : 0, 'idle-groovy': 0.65 }[personality] || 0);
                    object.rotation.x += ({ 'idle-confident': -0.50, 'idle-shy': -1.25, 'idle-drowsy': -0.15, 'idle-curious': side === 1 ? -0.15 : 0 }[personality] || 0);
                }
                if (motion === 'head') {
                    object.rotation.x += ({ 'idle-shy': 0.13, 'idle-drowsy': 0.20, 'idle-confident': -0.04 }[personality] || 0);
                    if (personality === 'idle-shy') object.rotation.y += 0.14;
                    if (personality === 'idle-curious') object.rotation.z += 0.16;
                }
                if (motion === 'blink' && personality === 'idle-drowsy') object.scale.y *= 0.15;
                if (reducedMotion) continue;
                if (gesture && motion === 'arm') {
                    object.rotation.copy(rotation);
                    if (gesture.name === 'bow') object.rotation.z += side * raised * .08;
                    if (gesture.name === 'clap') { object.rotation.z -= side * raised * .35; object.rotation.x -= raised * 1.2; }
                }
                if (gesture && motion === 'elbow') {
                    object.rotation.copy(rotation);
                    if (gesture.name === 'bow' && side === 1) object.rotation.x -= raised * .8;
                    if (gesture.name === 'clap') { object.rotation.z += side * raised * (-.6 - (1 + Math.sin(seconds * 11)) * .1); object.rotation.x += raised * .8; }
                }
                const pose = armPoses.get(side);
                if (pose && (motion === 'arm' || motion === 'elbow')) {
                    object.rotation.copy(rotation);
                    object.quaternion.slerp(motion === 'arm' ? pose.shoulderRotation : pose.elbowRotation, raised);
                    if (limb) {
                        const reach = 1 + (pose.reach - 1) * raised;
                        object.scale.copy(scale).multiplyScalar(reach); limb.reach = reach;
                        for (const mesh of limb.meshes) {
                            mesh.object.scale.copy(mesh.scale).divideScalar(reach);
                            if (mesh.segment) mesh.object.scale.y *= reach;
                            if (mesh.joint) mesh.object.scale.multiplyScalar(1 + (reach - 1) * .15);
                        }
                    }
                }
                if (motion === 'torso') {
                    object.rotation.x += gesture?.name === 'bow' ? raised * 0.48 : personality === 'idle-shy' ? 0.045 : Math.sin(seconds * 1.4) * 0.008;
                    if (personality === 'idle-groovy' && !gesture) object.rotation.z += Math.sin(seconds * 2.6) * 0.045;
                    if (gesture?.name === 'dab') object.rotation.z += raised * 0.10;
                }
                if (motion === 'arm' && personality === 'idle-groovy' && !gesture) object.rotation.x += Math.sin(seconds * 2.6 + side) * 0.12;
                if (motion === 'head') {
                    if (gesture?.name === 'dab') { object.rotation.z += raised * 0.28; object.rotation.x += raised * 0.35; object.rotation.y -= raised * 0.25; }
                    else if (gesture?.name === 'bow') object.rotation.x += raised * 0.12;
                    else { object.rotation.y += Math.sin(seconds * 0.65) * 0.04; object.rotation.x += Math.sin(seconds * 1.1) * 0.014; }
                }
                if (motion === 'cloth') { object.rotation.x += Math.sin(seconds * 2.1) * 0.08; object.rotation.z += Math.sin(seconds * 1.7) * 0.07; }
                if (motion === 'code') {
                    const phase = (seconds * 0.65 + (object.userData.avatar_phase || 0)) % 1;
                    object.position.y = position.y - (object.userData.avatar_code_row || 0) * 0.023 - 0.015 + (1 - phase) * 0.06;
                }
                if (motion === 'jet') {
                    object.scale.y *= 0.85 + Math.sin(seconds * 17 + side) * 0.18 + Math.sin(seconds * 29) * 0.07;
                    object.scale.x *= 1 + Math.sin(seconds * 13 + side) * 0.09;
                    object.scale.z *= 1 + Math.sin(seconds * 13 + side) * 0.09;
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
