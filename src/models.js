import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBlobShadow } from './blobShadow.js';

const loader = new FBXLoader();
const gltfLoader = new GLTFLoader();
const glbCache = new Map();

function loadGLB(url) {
    if (glbCache.has(url)) return glbCache.get(url);
    const promise = new Promise((resolve, reject) => {
        gltfLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
    glbCache.set(url, promise);
    return promise;
}

const cache = new Map();
function loadFBX(url) {
    if (cache.has(url)) return cache.get(url);
    const promise = new Promise((resolve, reject) => {
        loader.load(url, (obj) => resolve(obj), undefined, reject);
    });
    cache.set(url, promise);
    return promise;
}

function materialKey(mat) {
    const color = mat.color ? mat.color.getHex() : 0xffffff;
    const hasMap = mat.map ? 1 : 0;
    const transparent = mat.transparent ? 1 : 0;
    const vColors = mat.vertexColors ? 1 : 0;
    return `${hasMap}-${transparent}-${vColors}-${color.toString(16)}`;
}

function normalizeGeometry(geometry, keepColor) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
        const uv = new Float32Array(g.attributes.position.count * 2);
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    if (keepColor && !g.attributes.color) {
        const c = new Float32Array(g.attributes.position.count * 3).fill(1);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') {
            g.deleteAttribute(name);
        }
    }
    return g;
}

export function mergeFBXMeshes(group) {
    group.updateMatrixWorld(true);
    const buckets = new Map();
    group.traverse((child) => {
        if (!child.isMesh) return;
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        const key = materialKey(mat);
        if (!buckets.has(key)) buckets.set(key, { geometries: [], material: mat });
        const entry = buckets.get(key);
        const g = normalizeGeometry(child.geometry, !!mat.vertexColors);
        g.applyMatrix4(child.matrixWorld);
        entry.geometries.push(g);
    });
    const parts = [];
    for (const { geometries, material } of buckets.values()) {
        const merged = mergeGeometries(geometries, false);
        if (merged) {
            merged.computeVertexNormals();
            parts.push({ geometry: merged, material });
        }
    }
    return parts;
}

function normalizePartsToUnit(parts) {
    const box = new THREE.Box3();
    for (const { geometry } of parts) {
        geometry.computeBoundingBox();
        box.union(geometry.boundingBox);
    }
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDim) || maxDim < 1e-9) return null;
    const k = 1 / maxDim;
    for (const { geometry } of parts) geometry.scale(k, k, k);
    box.min.multiplyScalar(k);
    box.max.multiplyScalar(k);
    return box;
}

function computeInstanceBox(unitBox, position, rotY, scale) {
    const cos = Math.cos(rotY), sin = Math.sin(rotY);
    const corners = [
        [unitBox.min.x, unitBox.min.z], [unitBox.max.x, unitBox.min.z],
        [unitBox.min.x, unitBox.max.z], [unitBox.max.x, unitBox.max.z]
    ];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [cx, cz] of corners) {
        const wx = (cx * cos - cz * sin) * scale + position.x;
        const wz = (cx * sin + cz * cos) * scale + position.z;
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wz < minZ) minZ = wz;
        if (wz > maxZ) maxZ = wz;
    }
    return {
        min: new THREE.Vector3(minX, 0, minZ),
        max: new THREE.Vector3(maxX, 0, maxZ)
    };
}

function colliderFromBox(box, config = {}) {
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const halfX = (box.max.x - box.min.x) / 2;
    const halfZ = (box.max.z - box.min.z) / 2;
    const type = config.type || 'box';
    if (type === 'circle') {
        return { type: 'circle', cx, cz, r: halfX * (config.radius ?? 1) };
    }
    if (type === 'ellipse') {
        return { type: 'ellipse', cx, cz, rx: halfX * (config.rx ?? 1), rz: halfZ * (config.rz ?? 1) };
    }
    const sx = config.scale?.x ?? 1;
    const sz = config.scale?.z ?? 1;
    return { type: 'box', minX: cx - halfX * sx, maxX: cx + halfX * sx, minZ: cz - halfZ * sz, maxZ: cz + halfZ * sz };
}

function buildInstanced(parts, count, placer, { castShadow, receiveShadow, unitBox, colliderConfig, shadowRadius, shadowOpacity, shadowColor }) {
    const dummy = new THREE.Object3D();
    const meshes = [];
    const colliders = [];
    const shadowItems = [];
    for (const { geometry, material } of parts) {
        const im = new THREE.InstancedMesh(geometry, material, count);
        im.castShadow = false;
        im.receiveShadow = false;
        im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        meshes.push(im);
    }
    for (let i = 0; i < count; i++) {
        const t = placer(i);
        dummy.position.copy(t.position);
        dummy.rotation.set(t.rotation?.x || 0, t.rotation?.y || 0, t.rotation?.z || 0);
        const s = t.scale || 1;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        for (const im of meshes) im.setMatrixAt(i, dummy.matrix);
        if (unitBox) {
            const box = computeInstanceBox(unitBox, t.position, dummy.rotation.y, s);
            colliders.push(colliderFromBox(box, colliderConfig));
        }
        if (shadowRadius) {
            shadowItems.push({ position: t.position.clone(), scale: s, rotationY: dummy.rotation.y });
        }
    }
    for (const im of meshes) im.instanceMatrix.needsUpdate = true;
    let shadowGroup = null;
    if (shadowRadius && shadowItems.length > 0) {
        shadowGroup = new THREE.Group();
        shadowGroup.name = 'blob-shadows';
        for (const item of shadowItems) {
            const shadow = createBlobShadow({
                radius: shadowRadius * item.scale,
                opacity: shadowOpacity || 0.4,
                color: shadowColor || '#000000',
            });
            shadow.position.set(item.position.x, item.position.y + 0.02, item.position.z);
            shadow.rotation.y = item.rotationY;
            shadowGroup.add(shadow);
        }
    }
    return { meshes, colliders, shadowGroup };
}

export async function createInstancedFromFBX(url, count, placer, options = {}) {
    const group = await loadFBX(url);
    const parts = mergeFBXMeshes(group);
    const unitBox = options.normalize !== false ? normalizePartsToUnit(parts) : null;
    const { meshes, colliders, shadowGroup } = buildInstanced(parts, count, placer, {
        castShadow: false,
        receiveShadow: false,
        unitBox,
        colliderConfig: options.collider,
        shadowRadius: options.shadowRadius,
        shadowOpacity: options.shadowOpacity,
        shadowColor: options.shadowColor,
    });
    const instancedGroup = new THREE.Group();
    meshes.forEach(m => instancedGroup.add(m));
    if (shadowGroup) instancedGroup.add(shadowGroup);
    instancedGroup.userData.colliders = colliders;
    return instancedGroup;
}

export async function createLODFromFBX(url, nearCount, farCount, nearPlacer, farPlacer, options = {}) {
    const group = await loadFBX(url);
    const parts = mergeFBXMeshes(group);
    const unitBox = normalizePartsToUnit(parts);
    const nearBuild = buildInstanced(parts, nearCount, nearPlacer, {
        castShadow: false, receiveShadow: false, unitBox,
        colliderConfig: options.collider,
        shadowRadius: options.shadowRadius,
        shadowOpacity: options.shadowOpacity,
        shadowColor: options.shadowColor,
    });
    const farBuild = buildInstanced(parts, farCount, farPlacer, {
        castShadow: false, receiveShadow: false, unitBox,
        colliderConfig: options.collider,
    });
    const nearGroup = new THREE.Group();
    nearBuild.meshes.forEach(m => nearGroup.add(m));
    if (nearBuild.shadowGroup) nearGroup.add(nearBuild.shadowGroup);
    nearGroup.userData.colliders = nearBuild.colliders;
    const farGroup = new THREE.Group();
    farBuild.meshes.forEach(m => farGroup.add(m));
    farGroup.userData.colliders = farBuild.colliders;
    return { near: nearGroup, far: farGroup };
}

export async function createSingleFBX(url, position, options = {}) {
    const group = await loadFBX(url);
    if (options.normalize !== false) {
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (Number.isFinite(maxDim) && maxDim > 1e-9) {
            group.scale.multiplyScalar(1 / maxDim);
        }
    }
    group.position.copy(position);
    if (options.scale) group.scale.setScalar(options.scale);
    if (options.rotation) group.rotation.set(options.rotation.x, options.rotation.y, options.rotation.z);
    group.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
        }
    });
    group.updateMatrixWorld(true);
    if (options.shadowRadius) {
        const shadow = createBlobShadow({
            radius: options.shadowRadius * (options.scale || 1),
            opacity: options.shadowOpacity || 0.5,
            color: options.shadowColor || '#000000',
        });
        shadow.position.set(position.x, position.y + 0.02, position.z);
        if (options.rotation?.y) shadow.rotation.y = options.rotation.y;
        group.add(shadow);
    }
    const box = new THREE.Box3().setFromObject(group);
    const colliders = (box.isEmpty() || !Number.isFinite(box.min.x))
        ? []
        : [colliderFromBox(box, options.collider)];
    group.userData.colliders = colliders;
    return group;
}

export async function createSingleGLB(url, position, options = {}) {
    const group = await loadGLB(url);
    if (options.normalize !== false) {
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (Number.isFinite(maxDim) && maxDim > 1e-9) {
            group.scale.multiplyScalar(1 / maxDim);
        }
    }
    group.position.copy(position);
    if (options.scale) group.scale.setScalar(options.scale);
    if (options.rotation) group.rotation.set(options.rotation.x, options.rotation.y, options.rotation.z);
    group.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
        }
    });
    group.updateMatrixWorld(true);
    if (options.shadowRadius) {
        const shadow = createBlobShadow({
            radius: options.shadowRadius * (options.scale || 1),
            opacity: options.shadowOpacity || 0.5,
            color: options.shadowColor || '#000000',
        });
        shadow.position.set(position.x, position.y + 0.02, position.z);
        if (options.rotation?.y) shadow.rotation.y = options.rotation.y;
        group.add(shadow);
    }
    const box = new THREE.Box3().setFromObject(group);
    const colliders = (box.isEmpty() || !Number.isFinite(box.min.x))
        ? []
        : [colliderFromBox(box, options.collider)];
    group.userData.colliders = colliders;
    return group;
}
