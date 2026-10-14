import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AVATAR_PALETTES, AVATAR_OPTIONS } from './avatarRenderer.js';

export function applyAvatarSelection(model, selection) {
    const materialSlots = { Skin: 'skin', Hair: 'hairColor', Wardrobe: 'color', Denim: 'pantsColor', Shoes: 'shoesColor' };
    model.traverse(object => {
        const { avatar_slot: slot, avatar_id: id } = object.userData;
        if (slot && AVATAR_OPTIONS[slot]) object.visible = selection[slot] === id;
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            const palette = AVATAR_PALETTES[materialSlots[material.name]];
            const values = palette && (palette[selection[materialSlots[material.name]]] || Object.values(palette)[0]);
            if (values) material.color.setRGB(...values);
        }
    });
}

export async function createAvatarViewer(container, url, selection) {
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
        controls.target.set(0, 1.29, 0); controls.enablePan = false; controls.enableZoom = false;
        controls.enableDamping = true; controls.minPolarAngle = Math.PI / 3; controls.maxPolarAngle = Math.PI / 2;
        controls.update();
        scene.add(new THREE.HemisphereLight(0xf9f4e8, 0x8799ad, 2.3));
        const key = new THREE.DirectionalLight(0xfff4e8, 3.4); key.position.set(-3, 5, 4); key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -2; key.shadow.camera.right = 2;
        key.shadow.camera.top = 3; key.shadow.camera.bottom = -1; key.shadow.normalBias = 0.035; scene.add(key);
        const rim = new THREE.DirectionalLight(0xe4efff, 2.4); rim.position.set(3, 3, -3); scene.add(rim);
        const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.88, 0.10, 64),
            new THREE.MeshStandardMaterial({ color: 0xa2b5b1, roughness: 0.9 }));
        podium.position.y = -0.055; podium.receiveShadow = true; scene.add(podium);
        const gltf = await new GLTFLoader().loadAsync(url);
        model = gltf.scene;
        model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
        scene.add(model); applyAvatarSelection(model, selection);
        let visible = true;
        const resize = () => {
            const width = container.clientWidth, height = container.clientHeight;
            if (!width || !height) return;
            const halfWidth = 1.55 * width / height;
            camera.left = -halfWidth; camera.right = halfWidth; camera.top = 1.55; camera.bottom = -1.55;
            camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
        };
        resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();
        visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }); visibilityObserver.observe(container);
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        renderer.setAnimationLoop(time => {
            if (document.hidden || !visible) return;
            model.position.y = reducedMotion.matches ? 0 : Math.sin(time / 1100) * 0.006;
            controls.update(); renderer.render(scene, camera);
        });
        const rotate = delta => { model.rotation.y += delta; };
        canvas.addEventListener('keydown', event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault(); rotate(event.key === 'ArrowLeft' ? -0.25 : 0.25);
        });
        return { update: value => applyAvatarSelection(model, value), rotate, dispose };
    } catch (error) { dispose(); throw error; }
}
