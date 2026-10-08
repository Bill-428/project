// controls.js
import * as THREE from 'three';

export const mouse = new THREE.Vector2();
export const raycaster = new THREE.Raycaster();
export const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export const targetPos = new THREE.Vector3();
export const cameraOffset = new THREE.Vector3(0, 20, 20);
export let isMoveActive = false;

// 改为对象，允许修改 value 属性
export const groundHalfSize = { value: 25 };

// 控制启用开关：菜单/暂停/结束时禁用，避免点击画布误触移动模式
let controlsEnabled = false;

export function setControlsEnabled(enabled) {
    controlsEnabled = enabled;
    if (!enabled) isMoveActive = false;
}

export function getControlsEnabled() {
    return controlsEnabled;
}

export function initControls(camera, renderer) {
    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    renderer.domElement.addEventListener('mousedown', (e) => {
        if (!controlsEnabled) return;
        if (e.button === 0) {
            isMoveActive = !isMoveActive;
            console.log('移动模式:', isMoveActive ? '开启' : '关闭');
        }
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

export function updateMouseTarget(camera) {
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(groundPlane, targetPos);
    if (targetPos) {
        const half = groundHalfSize.value;
        targetPos.x = Math.max(-half, Math.min(half, targetPos.x));
        targetPos.z = Math.max(-half, Math.min(half, targetPos.z));
        targetPos.y = 0;
    }
}

export function updateCameraFollow(camera, man) {
    const targetCamPos = man.position.clone().add(cameraOffset);
    camera.position.copy(targetCamPos);
    camera.lookAt(man.position);
}
