import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getAvatarFit } from './avatarFit.js';
import { createAvatarAnimator } from './avatarMotion.js';
import { AVATAR_PALETTES, AVATAR_OPTIONS } from './avatarRenderer.js';

const fitTransforms = new WeakMap();

export function applyAvatarSelection(model, selection) {
    const materialSlots = { Skin: 'skin', Hair: 'hairColor', Wardrobe: 'color', Denim: 'pantsColor', Shoes: 'shoesColor' };
    const fit = getAvatarFit(selection);
    let coversHair = false, hairTop = 2.40, hairWidth = 0.355;
    model.traverse(object => {
        if (object.userData.avatar_slot === 'hat' && object.userData.avatar_id === selection.hat) coversHair = !!object.userData.avatar_covers_hair;
        if (object.userData.avatar_slot === 'hair' && object.userData.avatar_id === selection.hair) {
            hairTop = object.userData.avatar_hair_top || hairTop; hairWidth = object.userData.avatar_hair_width || hairWidth;
        }
    });
    if (coversHair) { hairTop = 2.40; hairWidth = 0.355; }
    model.traverse(object => {
        const { avatar_slot: slot, avatar_id: id } = object.userData;
        if (slot && AVATAR_OPTIONS[slot]) object.visible = selection[slot] === id && !(slot === 'hair' && coversHair) && !fit.hiddenSlots.includes(slot);
        if (object.userData.avatar_hide_back) object.visible = !object.userData.avatar_hide_back.includes(selection.back);
        if (object.userData.avatar_hide_hair) object.visible = coversHair || !object.userData.avatar_hide_hair.includes(selection.hair);
        if (object.userData.avatar_hide_outfits) object.visible = !object.userData.avatar_hide_outfits.includes(selection.outfit);
        if (object.userData.avatar_fit) {
            if (!fitTransforms.has(object)) fitTransforms.set(object, { position: object.position.clone(), scale: object.scale.clone() });
            const rest = fitTransforms.get(object); object.position.copy(rest.position); object.scale.copy(rest.scale);
            if (object.userData.avatar_fit === 'perch') object.position.y += Math.max(0, hairTop + 0.025 - 2.40);
            if (object.userData.avatar_fit === 'headband') { object.scale.y *= Math.max(1, (hairTop + 0.07 - 2.02) / 0.47); object.scale.x *= Math.max(1, (hairWidth + 0.03) / 0.395); }
            if (object.userData.avatar_fit === 'earcup') object.position.x += (object.userData.avatar_side || 1) * Math.max(0, hairWidth - 0.38);
            if (object.userData.avatar_fit === 'backpack' && selection.outfit === 'space-suit') object.position.z -= 0.18;
        }
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            const palette = AVATAR_PALETTES[materialSlots[material.name]];
            const values = palette && (palette[selection[materialSlots[material.name]]] || Object.values(palette)[0]);
            if (values) material.color.setRGB(...values);
        }
    });
}

// Select a reward's own geometry; untagged body parts never enter item previews.
export function selectAvatarReward(model, selection, item) {
    model.traverse(object => { object.visible = true; });
    applyAvatarSelection(model, { ...selection, [item.slot]: item.id });
    if (item.slot !== 'character') {
        model.traverse(object => { object.visible = true; });
        model.traverse(object => {
            if (!object.isMesh) return;
            let owner = object;
            while (owner && !owner.userData.avatar_slot) owner = owner.parent;
            object.visible = owner?.userData.avatar_slot === item.slot && owner?.userData.avatar_id === item.id;
        });
    }
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    model.traverse(object => {
        if (!object.isMesh) return;
        for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return;
        object.geometry.computeBoundingBox();
        bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    });
    if (bounds.isEmpty()) throw new Error('Reward has no preview geometry');
    return bounds;
}

export async function createAvatarViewer(container, url, selection, item = null) {
    let renderer, controls, resizeObserver, visibilityObserver, model;
    const scene = new THREE.Scene();
    function dispose() {
        renderer?.setAnimationLoop(null); controls?.dispose(); resizeObserver?.disconnect(); visibilityObserver?.disconnect();
        scene.traverse(object => {
            object.geometry?.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) material?.dispose();
        });
        renderer?.dispose(); renderer?.domElement.remove();
    }
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
        const canvas = renderer.domElement;
        canvas.setAttribute('aria-label', '3D character preview. Drag or use left and right arrow keys to rotate.');
        canvas.tabIndex = 0;
        container.replaceChildren(canvas);
        const camera = new THREE.OrthographicCamera(-1.4, 1.4, 1.6, -1.6, 0.1, 30);
        camera.position.set(3.1, 2.8, 6.8);
        controls = new OrbitControls(camera, canvas);
        controls.target.set(0, 1.42, 0); controls.enablePan = false; controls.enableZoom = true; controls.minZoom = 0.8; controls.maxZoom = 2.8;
        controls.enableDamping = true; controls.minPolarAngle = Math.PI / 3; controls.maxPolarAngle = Math.PI / 2;
        controls.update();
        scene.add(new THREE.HemisphereLight(0xf9f4e8, 0x8799ad, 2.3));
        const key = new THREE.DirectionalLight(0xfff4e8, 3.4); key.position.set(-3, 5, 4); key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -2; key.shadow.camera.right = 2;
        key.shadow.camera.top = 3; key.shadow.camera.bottom = -1; key.shadow.normalBias = 0.035; scene.add(key);
        const rim = new THREE.DirectionalLight(0xe4efff, 2.4); rim.position.set(3, 3, -3); scene.add(rim);
        const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.88, 0.10, 64),
            new THREE.MeshStandardMaterial({ color: 0xa2b5b1, roughness: 0.9 }));
        podium.visible = !item; podium.position.y = -0.055; podium.receiveShadow = true; scene.add(podium);
        const gltf = await new GLTFLoader().loadAsync(url);
        model = gltf.scene;
        model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
        scene.add(model); applyAvatarSelection(model, selection);
        const rewardBounds = item ? selectAvatarReward(model, selection, item) : null;
        const rewardCenter = rewardBounds?.getCenter(new THREE.Vector3());
        const rotationRoot = new THREE.Group(); scene.add(rotationRoot); rotationRoot.add(model);
        if (item) {
            model.position.sub(rewardCenter);
            controls.target.set(0, 0, 0); camera.position.set(3.1, 1.7, item.slot === 'back' ? -6.8 : 6.8);
            controls.minZoom = 0.2; controls.maxZoom = 40; controls.update();
        }
        const animator = createAvatarAnimator(model);
        let elapsed = 0, lastTime = null;
        let targetRotation = null;
        let framing = item ? null : { y: 1.42, zoom: 0.9 };
        const frame = slot => {
            targetRotation = slot === 'back' ? Math.PI : 0;
            const head = ['hair', 'hairColor', 'skin', 'character', 'companion'].includes(slot);
            const faceAccessory = ['accessory', 'audio'].includes(slot);
            if (slot === 'hat') framing = { y: 2.30, zoom: 1.6 };
            else if (head || faceAccessory) framing = { y: 2.17, zoom: 1.8 };
            else if (slot === 'shoesColor') framing = { y: 0.45, zoom: 1.8 };
            else if (slot === 'pantsColor') framing = { y: 0.85, zoom: 1.4 };
            else if (slot === 'color' || slot === 'jewellery') framing = { y: 1.45, zoom: 1.5 };
            else framing = { y: 1.42, zoom: 0.9 };
        };
        let visible = true;
        const resize = () => {
            const width = container.clientWidth, height = container.clientHeight;
            if (!width || !height) return;
            const halfWidth = 1.70 * width / height;
            camera.left = -halfWidth; camera.right = halfWidth; camera.top = 1.70; camera.bottom = -1.70;
            if (rewardBounds) {
                const size = rewardBounds.getSize(new THREE.Vector3());
                const extent = Math.max(size.x, size.y, size.z, 0.05);
                camera.zoom = Math.min(3.4, 2 * halfWidth) * 0.72 / extent;
            }
            camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
        };
        resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();
        visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }); visibilityObserver.observe(container);
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        renderer.setAnimationLoop(time => {
            const delta = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.05); lastTime = time;
            if (document.hidden || !visible) return;
            elapsed += delta;
            const bodyMotion = animator.update(elapsed, reducedMotion.matches, selection);
            if (targetRotation !== null) {
                const difference = Math.atan2(Math.sin(targetRotation - model.rotation.y), Math.cos(targetRotation - model.rotation.y));
                model.rotation.y += difference * (reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 9));
                if (Math.abs(difference) < 0.002) targetRotation = null;
            }
            if (framing) {
                const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 9);
                const target = framing.y - controls.target.y;
                camera.position.y += target * blend; controls.target.y += target * blend;
                camera.zoom += (framing.zoom - camera.zoom) * blend; camera.updateProjectionMatrix();
                if (Math.abs(target) < 0.002 && Math.abs(framing.zoom - camera.zoom) < 0.002) framing = null;
            }
            model.position.y = (rewardCenter ? -rewardCenter.y : 0) + (reducedMotion.matches ? 0 : Math.sin(elapsed / 1.1) * 0.006 + bodyMotion.bounce);
            model.rotation.z = item ? 0 : bodyMotion.sway;
            controls.update(); renderer.render(scene, camera);
        });
        const rotate = delta => { targetRotation = null; (item ? rotationRoot : model).rotation.y += delta; };
        controls.addEventListener('start', () => { framing = null; targetRotation = null; });
        canvas.addEventListener('keydown', event => {
            if (['+', '=', '-'].includes(event.key)) {
                event.preventDefault(); framing = null; camera.zoom = THREE.MathUtils.clamp(camera.zoom + (event.key === '-' ? -0.25 : 0.25), controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); return;
            }
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault(); rotate(event.key === 'ArrowLeft' ? -0.25 : 0.25);
        });
        canvas.addEventListener('wheel', () => { framing = null; }, { passive: true });
        return { update: value => { selection = value; applyAvatarSelection(model, value); }, rotate, dispose, frame,
            zoom: delta => { framing = null; camera.zoom = THREE.MathUtils.clamp(camera.zoom + delta, controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); },
            gesture: name => { framing = { y: 1.42, zoom: 0.9 }; animator.gesture(name, elapsed); },
            fullView: () => { framing = { y: 1.42, zoom: 0.9 }; } };
    } catch (error) { dispose(); throw error; }
}

// Render many identity pictures with one scene and WebGL context, not one per row.
export async function createAvatarPortraitRenderer(url) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const scene = new THREE.Scene();
    try {
        renderer.setSize(160, 160); renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
        const camera = new THREE.OrthographicCamera(-0.95, 0.95, 0.95, -0.95, 0.1, 30);
        camera.position.set(0.8, 2.65, 7); camera.lookAt(0, 2.15, 0);
        scene.add(new THREE.HemisphereLight(0xf9f4e8, 0x8799ad, 2.3));
        const key = new THREE.DirectionalLight(0xfff4e8, 3.4); key.position.set(-3, 5, 4); scene.add(key);
        const rim = new THREE.DirectionalLight(0xe4efff, 2.4); rim.position.set(3, 3, -3); scene.add(rim);
        const model = (await new GLTFLoader().loadAsync(url)).scene; scene.add(model);
        const cache = new Map();
        const dispose = () => {
            scene.traverse(object => {
                object.geometry?.dispose();
                for (const material of Array.isArray(object.material) ? object.material : [object.material]) material?.dispose();
            });
            renderer.dispose(); cache.clear();
        };
        return {
            render(selection) {
                const key = JSON.stringify(selection);
                if (cache.has(key)) return cache.get(key);
                model.traverse(object => { object.visible = true; });
                camera.left = -0.95; camera.right = 0.95; camera.top = 0.95; camera.bottom = -0.95;
                camera.position.set(0.8, 2.65, 7); camera.lookAt(0, 2.15, 0); camera.updateProjectionMatrix();
                applyAvatarSelection(model, selection); renderer.render(scene, camera);
                const result = renderer.domElement.toDataURL('image/png');
                if (cache.size >= 120) cache.delete(cache.keys().next().value);
                cache.set(key, result); return result;
            },
            renderItem(selection, item) {
                const key = 'item:' + item.id + ':' + JSON.stringify(selection);
                if (cache.has(key)) return cache.get(key);
                const bounds = selectAvatarReward(model, selection, item);
                const center = bounds.getCenter(new THREE.Vector3());
                const size = bounds.getSize(new THREE.Vector3());
                const half = Math.max(size.x, size.y, size.z, 0.05) * 0.7;
                camera.left = -half; camera.right = half; camera.top = half; camera.bottom = -half;
                camera.position.copy(center).add(new THREE.Vector3(0.7, 0.4, item.slot === 'back' ? -7 : 7));
                camera.lookAt(center); camera.updateProjectionMatrix(); renderer.render(scene, camera);
                const result = renderer.domElement.toDataURL('image/png');
                if (cache.size >= 120) cache.delete(cache.keys().next().value);
                cache.set(key, result); return result;
            }, dispose
        };
    } catch (error) { renderer.dispose(); throw error; }
}
