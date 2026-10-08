// main.js —— 湖畔灯灵（Blob Shadow 版 + 视频开场 + 萤火虫汇聚显现）
import * as THREE from 'three';
import {
    initControls, mouse, raycaster, groundPlane, targetPos, cameraOffset,
    isMoveActive, updateMouseTarget, updateCameraFollow, groundHalfSize, setControlsEnabled
} from './controls.js';
import { GameState, getState, setState, onStateChange, isPlaying, isIntro, isTransitioning } from './gameState.js';
import { createUI } from './ui.js';
import { initAudio, playBGM, stopBGM, pauseBGM, resumeBGM, playSFX, setBGMVolume, setSFXVolume } from './audio.js';
import { createCutscene } from './cutscene.js';
import { createFragments } from './fragments.js';
import { initPostProcessing, resizePostProcessing, getBloomPass, setDOFFocus, enableDOF, updateColorGrade, lerpColorGrade, setColorGradePreset, setKuwahara, updateFilmGrainPass, enableFilmGrain, loadLUTs, updateLUTBlend, setLUT} from './postProcessing.js';
import { createGroundMaterial, terrainHeight } from './groundShader.js';
import { createSky } from './sky.js';
import { createPetals } from './petals.js';
import { createFloatingObjects } from './floatingObjects.js';
import { createReeds } from './reeds.js';
import { createVolumetricLight } from './volumetricLight.js';
import { applyTreeWind, updateTreeWind } from './treeWind.js';
import { createCharacter } from './character.js';
import { createLights } from './lights.js';
import { createLakeShapeFromPoints, createLake, pointsToHolePath } from './lake.js';
import { createInstancedFromFBX, createLODFromFBX, createSingleFBX } from './models.js';
import { createGrass } from './grass.js';
import { createFireflies } from './fireflies.js';
import { registerColliders, resolveCollisions, createColliderDebugGroup, getColliderCount } from './colliders.js';
import { PlanarReflection, createReflectionDouble } from './planarReflection.js';
import { createSkyLanterns } from './skyLanterns.js';
import { createVideoIntro } from './videoIntro.js';
import { createFireflyReveal } from './fireflyReveal.js';
import { loadTextures } from './textureLoader.js';
import { TEXTURE_CONFIG } from './textureConfig.js';
import { injectFontFace, FONT_CONFIG } from './fontConfig.js';
injectFontFace();
let gameTextures = {};
const CHARACTER_DAMPING = 0.75;
const CHARACTER_Y = 2.2;
const CHARACTER_RADIUS = 1.0;
const GROUND_SIZE = 250;
const GROUND_RENDER_SIZE = 900;
const TREE_NEAR = 22;
const TREE_FAR = 58;
const STONE_COUNT = 60;
const LAKE_CENTERS = [
    { x: 0, z: 0, r: 28 },
    { x: 100, z: 80, r: 20 }
];
const SHOW_COLLIDERS = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3d3370);
let sky = null;
sky = createSky(scene, { topColor: 0x0d0d24, bottomColor: 0x3d3370, cloudCount: 4, cloudSpeed: 0.5 });

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 60, 15);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", precision: "highp" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envScene = new THREE.Scene();
const envGeo = new THREE.SphereGeometry(100, 32, 16);
const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color(0x0d0d24) }, bottomColor: { value: new THREE.Color(0x3d3370) } },
    vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vPos; void main(){ float h=normalize(vPos).y*0.5+0.5; gl_FragColor=vec4(mix(bottomColor,topColor,pow(h,0.7)),1.0); }`
});
envScene.add(new THREE.Mesh(envGeo, envMat));
const envLight = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffeedd }));
envLight.position.set(50, 60, 30);
envScene.add(envLight);
const envRT = pmrem.fromScene(envScene, 0.04);
scene.environment = envRT.texture;
envGeo.dispose(); envMat.dispose(); envLight.geometry.dispose(); envLight.material.dispose();

let cutscene = null, fragments = null, petals = null, floatingObjects = null, reeds = null, volumetricLight = null;
let tree = null, tree2 = null;
let planarReflection = null;
let reflectionDouble = null;
let skyLanterns = null;
let videoIntro = null;
let fireflyReveal = null;
let lastFragmentStage = 0;

const ui = createUI({
    onStart: () => {
        initAudio(); playSFX('buttonClick'); playBGM();
        setState(GameState.INTRO);
        videoIntro?.start(() => {
            ui.hideSkipBtn();
            cutscene?.start();          // 镜头移动开始
            fireflyReveal?.start();     // 萤火虫汇聚同时开始
        });
    },
    onSkip: () => {
        videoIntro?.skip();
    },
    onPause: () => { if (isPlaying()) { playSFX('buttonClick'); pauseBGM(); setState(GameState.PAUSED); } },
    onResume: () => { playSFX('buttonClick'); resumeBGM(); setState(GameState.PLAYING); },
    onRestart: () => { playSFX('buttonClick'); stopBGM(); fragments?.reset(); cutscene?.dispose(); videoIntro?.reset(); fireflyReveal?.reset(); setState(GameState.MENU); skyLanterns?.clear(); lastFragmentStage = 0;setLUT(0); }
});

onStateChange((newState, oldState) => {
    console.log(`[GameState] ${oldState} → ${newState}`);
    switch (newState) {
        case GameState.MENU: ui.showMenu(); ui.hidePause(); ui.hideGameover(); ui.hideSkipBtn(); setControlsEnabled(false); stopBGM(); break;
        case GameState.INTRO: ui.hideMenu(); ui.hidePause(); ui.hideGameover(); ui.hidePauseBtn(); ui.showSkipBtn(); setControlsEnabled(false); break;
        case GameState.PLAYING: ui.hideMenu(); ui.hidePause(); ui.hideGameover(); ui.hidePauseBtn(); ui.showPauseBtn(); setControlsEnabled(true); break;
        case GameState.PAUSED: ui.showPause(); ui.hidePauseBtn(); setControlsEnabled(false); break;
        case GameState.TRANSITIONING: ui.hidePauseBtn(); setControlsEnabled(false); break;
        case GameState.GAMEOVER: ui.showGameover(); setControlsEnabled(false); stopBGM(); break;
    }
});

const lights = createLights(scene);
const { directional } = lights;
if (directional) {
    scene.add(directional.target);
}

volumetricLight = createVolumetricLight(scene, {
    rayCount: 4, color: 0xc9bcff, opacity: 0.12, rayWidth: 14, rayHeight: 110
});

const fog = new THREE.FogExp2(0x40347a, 0.018);
scene.fog = fog;

const lakes = [], lakeShores = [];
let groundMesh = null;
const groundMaterial = createGroundMaterial(
    '#5a4f7a', '#2a2040',
    new THREE.Color(0x40347a), 0.016,
    new THREE.Vector3(25, 35, 20), LAKE_CENTERS,
    250, null, 1024
);

const holePaths = [];
function rebuildGround() {
    if (groundMesh) { scene.remove(groundMesh); groundMesh.geometry.dispose(); }
    const groundShape = new THREE.Shape();
    groundShape.moveTo(-GROUND_RENDER_SIZE/2, -GROUND_RENDER_SIZE/2);
    groundShape.lineTo( GROUND_RENDER_SIZE/2, -GROUND_RENDER_SIZE/2);
    groundShape.lineTo( GROUND_RENDER_SIZE/2, GROUND_RENDER_SIZE/2);
    groundShape.lineTo(-GROUND_RENDER_SIZE/2, GROUND_RENDER_SIZE/2);
    groundShape.closePath();
    for (const path of holePaths) groundShape.holes.push(path);
    const geometry = new THREE.ShapeGeometry(groundShape, 128);
    geometry.rotateX(-Math.PI / 2);
    groundMesh = new THREE.Mesh(geometry, groundMaterial);
    groundMesh.position.y = -0.3;
    groundMesh.receiveShadow = false;
    scene.add(groundMesh);
    groundHalfSize.value = GROUND_SIZE / 2;
}

function addLakeWithHole(controlPoints, position, colorOptions = {}, smoothness = 200, segments = 128, options = {}) {
    const { shape, points } = createLakeShapeFromPoints(controlPoints, smoothness);
    const lake = createLake(shape, position, colorOptions, segments, undefined, { ...options, reflectionMap: planarReflection ? planarReflection.getTexture() : null });
    scene.add(lake); lakes.push(lake);
    const worldPts = points.map(p => ({ x: p.x + position.x, z: position.z - p.y }));
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxR = 0;
    for (const p of worldPts) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
        maxR = Math.max(maxR, Math.hypot(p.x - position.x, p.z - position.z));
    }
    lakeShores.push({ cx: position.x, cz: position.z, points: worldPts, bbox: { minX, maxX, minZ, maxZ }, maxR });
    const holePath = pointsToHolePath(points, position.x, -position.z);
    holePaths.push(holePath);
    rebuildGround();
    return lake;
}

rebuildGround();

const character = createCharacter(scene);
character.position.set(0, 1, 0);

planarReflection = new PlanarReflection(renderer, scene, camera, {
    textureWidth: 256,
    textureHeight: 256,
    planeY: -0.2,
    reflectStrength: 0.55,
    updateEveryNFrames: 2
});
const _fixTex = new THREE.DataTexture(new Uint8Array([255,255,255,255]), 1, 1, THREE.RGBAFormat);
_fixTex.needsUpdate = true;
function fixAllShaderUniforms(root, label) {
    let fixed = 0;
    root.traverse(obj => {
        if (!obj.isMesh) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
            if (!mat || !mat.isShaderMaterial || !mat.uniforms) continue;
            for (const key in mat.uniforms) {
                const u = mat.uniforms[key];
                if (u === undefined) {
                    console.warn(`[uniform-undefined] ${label} | ${obj.name || obj.type} | ${key} = undefined`);
                    mat.uniforms[key] = { value: _fixTex };
                    fixed++;
                } else if (u.value === null || u.value === undefined) {
                    if (key.toLowerCase().includes('map') || key.toLowerCase().includes('tex')) {
                        console.warn(`[uniform-null] ${label} | ${obj.name || obj.type} | ${key}`);
                        u.value = _fixTex;
                        fixed++;
                    }
                }
            }
        }
    });
    if (fixed > 0) console.log(`[fix] ${label} 修复了 ${fixed} 个 uniform`);
}
fixAllShaderUniforms(scene, 'init');

function hideAllBlobShadows(root) {
    root.traverse(obj => {
        if (obj.userData && obj.userData.isBlobShadow) {
            planarReflection.hideInReflection(obj);
        }
    });
}
if (character.shadow) planarReflection.hideInReflection(character.shadow.mesh);
planarReflection.hideInReflection(character.group);
reflectionDouble = createReflectionDouble(character.group, {
    baseOpacity: 0.25,
    colorTint: 0x3a2a5a
});
planarReflection.showInReflection(reflectionDouble.group);
scene.add(reflectionDouble.group);
character.loaded.then(() => {
    if (reflectionDouble) {
        planarReflection.removeFromReflection(reflectionDouble.group);
        scene.remove(reflectionDouble.group);
        reflectionDouble.dispose();
    }
    reflectionDouble = createReflectionDouble(character.group, {
        baseOpacity: 0.25,
        colorTint: 0x3a2a5a
    });
    planarReflection.showInReflection(reflectionDouble.group);
    scene.add(reflectionDouble.group);
});

cutscene = createCutscene(scene, camera, character, {
    onIntroComplete: () => {
        // 萤火虫与镜头并行；镜头结束时若汇聚尚未完成，短暂等待后再进入游戏
        function enterWhenReady() {
            if (fireflyReveal && fireflyReveal.isActive()) {
                setTimeout(enterWhenReady, 80);
            } else {
                setState(GameState.PLAYING);
                fragments?.start();
            }
        }
        enterWhenReady();
    },
    onEndingComplete: () => { setState(GameState.GAMEOVER); }
});

skyLanterns = createSkyLanterns(scene, {
    maxLanterns: 25,
    riseSpeed: 1.2,
    lanternScale: 0.9
});

videoIntro = createVideoIntro({
    src: '/video/intro.mp4'
});

fireflyReveal = createFireflyReveal(scene, character, {
    count: 120,               // 萤火虫数量（稍多，汇聚更壮观）
    gatherDuration: 8.0,       // 汇聚阶段总时长（秒）—— 原来2.4，现在放慢到8秒
    flashDuration: 0.8,        // 爆闪阶段时长
    revealDuration: 1.5,       // 角色渐显时长
    startRadiusMin: 14,        // 起始最小半径（从更远的地方飞来）
    startRadiusMax: 30,        // 起始最大半径
    travelTimeMin: 4.5,        // 单只萤火虫最短飞行时间（秒）—— 原来1.4
    travelTimeMax: 7.0,        // 单只萤火虫最长飞行时间（秒）—— 原来2.2
    wobbleAmpMin: 2.0,         // 摆动幅度下限
    wobbleAmpMax: 5.0,         // 摆动幅度上限
    delayMax: 1.0,             // 个体错峰最大延迟（秒）
});

const lake1Scale = 1.35;
const lake1Points = [
    new THREE.Vector2(0, 0), new THREE.Vector2(12 * lake1Scale, -4 * lake1Scale),
    new THREE.Vector2(18 * lake1Scale, 2 * lake1Scale), new THREE.Vector2(14 * lake1Scale, 12 * lake1Scale),
    new THREE.Vector2(6 * lake1Scale, 18 * lake1Scale), new THREE.Vector2(-4 * lake1Scale, 16 * lake1Scale),
    new THREE.Vector2(-10 * lake1Scale, 8 * lake1Scale), new THREE.Vector2(-6 * lake1Scale, 2 * lake1Scale)
];
addLakeWithHole(lake1Points, new THREE.Vector3(0, -0.2, -5),
    { base: '#a0d8e0', deep: '#1a4a5a' }, 200, 128,
    { landColor: '#b08a44', shoreWidth: 2.0, subdivideIterations: 1, edgeFadeDistance: 3.0 });

const lake2Scale = 1.3;
const lake2Points = [
    new THREE.Vector2(0, 0), new THREE.Vector2(8 * lake2Scale, -3 * lake2Scale),
    new THREE.Vector2(12 * lake2Scale, 1 * lake2Scale), new THREE.Vector2(9 * lake2Scale, 8 * lake2Scale),
    new THREE.Vector2(4 * lake2Scale, 12 * lake2Scale), new THREE.Vector2(-3 * lake2Scale, 10 * lake2Scale),
    new THREE.Vector2(-7 * lake2Scale, 5 * lake2Scale), new THREE.Vector2(-4 * lake2Scale, 1 * lake2Scale)
];
addLakeWithHole(lake2Points, new THREE.Vector3(100, -0.2, 80),
    { base: '#a0d8e0', deep: '#1a4a5a' }, 200, 128,
    { landColor: '#b08a44', shoreWidth: 4.5, subdivideIterations: 1, edgeFadeDistance: 3.0 });

for (const lake of lakes) planarReflection.hideInReflection(lake);

(function syncLakeUniform() {
    const arr = groundMaterial.uniforms.uLakes.value;
    for (let i = 0; i < 4; i++) {
        if (i < LAKE_CENTERS.length) { const L = LAKE_CENTERS[i]; arr[i].set(L.x, L.z, L.r, 1); }
        else arr[i].set(0, 0, 0, 0);
    }
})();

floatingObjects = createFloatingObjects(scene, lakeShores, {
    lotusCount: 14, algaeCount: 20, floatSpeed: 0.7, floatAmount: 0.12
});

reeds = createReeds(scene, lakeShores, {
    count: 150, minHeight: 2.5, maxHeight: 5.0, swayAmount: 0.12, swaySpeed: 1.1,
    rimColor: '#9a8aff', rimStrength: 0.5,
    fogColor: new THREE.Color(0x40347a), fogDensity: 0.018,
    characterRadius: 4.0, characterBendAmount: 0.8
});

const grass = createGrass(scene, {
    lakes: LAKE_CENTERS, mapHalf: 160, density: 0.20,
    minHeight: 1.3, maxHeight: 3.2, flowerDensity: 0.010,
    rootA: '#1a1230', tipA: '#3a2a5a', rootB: '#151028', tipB: '#2a1f48',
    rimColor: '#8a7aff', rimStrength: 0.45,
    fogColor: new THREE.Color(0x40347a), fogDensity: 0.014
});

const FIREFLY_CLUSTERS = 6;
const fireflyGroups = [];
const fireflyColors = [0xffe6a3, 0xa8e0ff, 0xffd98c];
for (let i = 0; i < FIREFLY_CLUSTERS; i++) {
    const pos = randomPos(200);
    const group = createFireflies(scene, {
        count: 5 + Math.floor(Math.random() * 3),
        color: new THREE.Color(fireflyColors[Math.floor(Math.random() * fireflyColors.length)]),
        maxHeight: 5 + Math.random() * 4, radius: 1.5 + Math.random() * 3,
        riseSpeed: 0.25 + Math.random() * 0.2, sizeMin: 0.3, sizeMax: 1.0 + Math.random() * 0.7,
        wobbleAmplitude: 1.0 + Math.random() * 0.8, wobbleFrequency: 0.8 + Math.random() * 0.6,
        scatterRadius: 12, scatterStrength: 7
    });
    group.setPosition(pos.x, pos.y + 0.5, pos.z);
    fireflyGroups.push(group);
}

petals = createPetals(scene, {
    count: 50, color: 0xc8a8ff, spread: 120,
    minHeight: 12, maxHeight: 45, fallSpeed: 1.2, swayAmount: 2.5, swaySpeed: 0.7,
    terrainHeight, lakes: LAKE_CENTERS, landStayTime: 4.5
});

initControls(camera, renderer);
setControlsEnabled(false);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizePostProcessing(window.innerWidth, window.innerHeight);
    if (planarReflection) planarReflection.setSize(window.innerWidth, window.innerHeight);
});

const composer = initPostProcessing(renderer, scene, camera, {
    bloomStrength: 0.55, bloomRadius: 1.0, bloomThreshold: 0.45, useBloom: true,
    dofAperture: 0.0012, dofMaxblur: 0.0025, useDOF: false,
    initialPreset: 'night',
    useKuwahara: true, kuwaharaStrength: 0.55, kuwaharaRadius: 2.0,
    useFilmGrain: true, filmGrainIntensity: 0.035
});
enableFilmGrain(false);
loadLUTs('/luts/').then(() => {
    setLUT(0);
    console.log('[LUT] 初始化完成，默认应用第一幕色彩');
});

fragments = createFragments({
    scene, character, ui, terrainHeight, lakes: LAKE_CENTERS, fog, lights,
    groundMaterial, bloomPass: getBloomPass(), playSFX, sky, petals, volumetricLight, grass, reeds,
    onTransitionStart: () => setState(GameState.TRANSITIONING),
    onTransitionEnd: () => setState(GameState.PLAYING),
    onGameComplete: () => { cutscene?.startEnding(); }
});

updateCameraFollow(camera, character);

function isInLake(x, z) {
    for (const lake of LAKE_CENTERS) {
        const dx = x - lake.x, dz = z - lake.z;
        if (dx * dx + dz * dz < lake.r * lake.r) return true;
    }
    return false;
}

function randomPos(range) {
    let x, z;
    do { x = (Math.random() - 0.5) * range; z = (Math.random() - 0.5) * range; } while (isInLake(x, z));
    const y = terrainHeight(x, z, LAKE_CENTERS);
    return new THREE.Vector3(x, y, z);
}

(async () => {
    try {
        const stones = await createInstancedFromFBX('/models/stone.fbx', STONE_COUNT,
            () => ({ position: randomPos(400), rotation: { y: Math.random() * Math.PI * 2 }, scale: 1.5 + Math.random() * 5.5 }),
            {
                castShadow: false, receiveShadow: false,
                shadowRadius: 1.5, shadowOpacity: 0.4,
                collider: { type: 'circle', radius: 0.85 }
            });
        scene.add(stones); registerColliders(stones);

        tree = await createLODFromFBX('/models/tree.fbx', TREE_NEAR, TREE_FAR,
            () => ({ position: randomPos(160), rotation: { y: Math.random() * Math.PI * 2 }, scale: 6.5 + Math.random() * 5.5 }),
            () => ({ position: randomPos(400), rotation: { y: Math.random() * Math.PI * 2 }, scale: 6.5 + Math.random() * 5.5 }),
            {
                shadowRadius: 4.0, shadowOpacity: 0.45,
                collider: { type: 'circle', radius: 0.28 }
            });
        scene.add(tree.near); scene.add(tree.far);
        registerColliders(tree.near);

        tree2 = await createLODFromFBX('/models/tree2.fbx', TREE_NEAR, TREE_FAR,
            () => ({ position: randomPos(160), rotation: { y: Math.random() * Math.PI * 2 }, scale: 6.5 + Math.random() * 5.5 }),
            () => ({ position: randomPos(400), rotation: { y: Math.random() * Math.PI * 2 }, scale: 6.5 + Math.random() * 5.5 }),
            {
                shadowRadius: 4.0, shadowOpacity: 0.45,
                collider: { type: 'circle', radius: 0.28 }
            });
        scene.add(tree2.near); scene.add(tree2.far);
        registerColliders(tree2.near);

        const house = await createSingleFBX('/models/house.fbx',
            new THREE.Vector3(-15, terrainHeight(-15, 5, LAKE_CENTERS), 5),
            {
                scale: 0.3, rotation: { x: 0, y: Math.PI / 4, z: 0 },
                shadowRadius: 5.0, shadowOpacity: 0.5,
                collider: { type: 'box', scale: { x: 0.5, z: 0.5 }}
            });
        scene.add(house); registerColliders(house);

        if (SHOW_COLLIDERS) { const dbg = createColliderDebugGroup(); if (dbg) scene.add(dbg); }
        console.log('✅ 碰撞盒注册完成，共', getColliderCount(), '个');
        scene.traverse(obj => {
            if (!obj.isMesh) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((mat, mi) => {
                if (!mat) return;
                const bad = [];
                for (const key in mat) {
                    const val = mat[key];
                    if (val === undefined && key.toLowerCase().includes('map')) {
                        bad.push(`${key}=undefined`);
                    }
                }
                if (bad.length > 0) {
                    console.warn(`[bad-material] ${obj.name || obj.type} | mat${mi}=${mat.type} | ${bad.join(', ')}`);
                    bad.forEach(b => {
                        const k = b.split('=')[0];
                        mat[k] = null;
                    });
                    mat.needsUpdate = true;
                }
            });
        });
        hideAllBlobShadows(scene);
        sanitizeAllMaterials(scene);
        fixAllShaderUniforms(scene, 'after-models');

        applyTreeWind(tree.near, { strength: 0.12, speed: 1.0, heightFactor: 0.4 });
        applyTreeWind(tree.far, { strength: 0.12, speed: 1.0, heightFactor: 0.4 });
        applyTreeWind(tree2.near, { strength: 0.15, speed: 1.2, heightFactor: 0.45 });
        applyTreeWind(tree2.far, { strength: 0.15, speed: 1.2, heightFactor: 0.45 });

        const _treeEmissive = new THREE.Color(0x1a1240);
        [tree.near, tree.far, tree2.near, tree2.far].forEach(g => g.traverse(c => {
            if (c.isMesh && c.material) {
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach(m => {
                    if (m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial) {
                        m.emissive = _treeEmissive;
                        m.emissiveIntensity = 0.25;
                    }
                });
            }
        }));
    } catch (e) { console.error('FBX 加载失败:', e); }
})();

const clock = new THREE.Clock();
let prevManPos = new THREE.Vector3();
const velocity = new THREE.Vector3();
const _focusVec = new THREE.Vector3();

function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = performance.now() * 0.001;

        groundMaterial.uniforms.uTime.value = time;
        grass.updateGrass(time, character.position);

        for (const lake of lakes) {
            lake.material.uniforms.uTime.value = time;
            if (lake.userData.shoreMaterial) lake.userData.shoreMaterial.uniforms.uTime.value = time;
        }

        const cutsceneActive = !!cutscene?.isActive();
        if (cutsceneActive) cutscene.update(delta);
        if (videoIntro?.isActive()) videoIntro.update(delta);
        if (fireflyReveal?.isActive()) fireflyReveal.update(delta, time);
        if (isPlaying() || isTransitioning()) fragments?.update(delta, time);

        if (fragments) {
            const currentStage = fragments.getCurrentStage();
            if (currentStage !== lastFragmentStage && currentStage > 0) {
                skyLanterns?.release(3 + currentStage, character.position.x, character.position.z);
                character.setGrowthLevel(currentStage / fragments.getTotalStages());
                const clarity = currentStage / fragments.getTotalStages();
                reflectionDouble?.setClarity(clarity);
                for (const lake of lakes) {
                    if (lake.material.uniforms.uReflectionClarity) {
                        lake.material.uniforms.uReflectionClarity.value = 0.2 + clarity * 0.7;
                    }
                }
                setKuwahara(0.55 - clarity * 0.35);
                lastFragmentStage = currentStage;
            }
        }

        if (isPlaying() && !cutsceneActive) {
            camera.updateMatrixWorld();
            _focusVec.copy(character.position).project(camera);
        } else { enableDOF(false); }

        if (isPlaying() && !cutsceneActive) {
            updateMouseTarget(camera);
            if (isMoveActive) {
                const from = character.position.clone();
                character.position.x = THREE.MathUtils.damp(from.x, targetPos.x, CHARACTER_DAMPING, delta);
                character.position.z = THREE.MathUtils.damp(from.z, targetPos.z, CHARACTER_DAMPING, delta);
                character.position.y = CHARACTER_Y;
                resolveCollisions(from, character.position, CHARACTER_RADIUS);
                const direction = new THREE.Vector3().copy(targetPos).sub(character.position);
                if (direction.lengthSq() > 0.001) { direction.y = 0; character.rotation.y = Math.atan2(direction.x, direction.z); }
            }
            if (directional) {
                const off = fragments?.getDirOffset() || { x: 30, y: 45, z: 20 };
                directional.position.set(character.position.x + off.x, off.y, character.position.z + off.z);
                directional.target.position.copy(character.position);
            }
            const currentPos = character.position.clone();
            velocity.copy(currentPos).sub(prevManPos);
            character.update(delta, time, { moving: isMoveActive, speed: velocity.length() / Math.max(delta, 0.001) });
            prevManPos.copy(currentPos);
            if (velocity.length() < 0.0001) velocity.set(0, 0, 0);
            for (const lake of lakes) {
                lake.material.uniforms.uCharacterPos.value.copy(character.position);
                lake.material.uniforms.uVelocity.value.copy(velocity);
                lake.material.uniforms.uEnableRipple.value = 1.0;
            }
            updateCameraFollow(camera, character);
        }

        if (reflectionDouble) {
            reflectionDouble.update(character.position, character.rotation, time);
        }
        if (planarReflection && isPlaying()) {
            planarReflection.update();
        }
        for (const group of fireflyGroups) group.update(delta, time, character.position);
        sky?.update(delta, time);
        petals?.update(delta, time);
        floatingObjects?.update(delta, time);
        reeds?.update(delta, time, character.position);
        volumetricLight?.update(delta, time);
        updateTreeWind(time);
        skyLanterns?.update(delta, time);
        updateColorGrade(delta);
        updateLUTBlend(delta);
        updateFilmGrainPass(time);
        if (tree && tree2) {
            const distToChar = camera.position.distanceTo(character.position);
            const showNear = distToChar < 60;
            tree.near.visible = showNear; tree.far.visible = !showNear;
            tree2.near.visible = showNear; tree2.far.visible = !showNear;
        }
        try {
            composer.render();
        } catch (e) {
            console.error('[render-error]', e.message);
            console.error('[render-stack]', e.stack);
            scene.traverse(obj => {
                if (!obj.isMesh || !obj.material) return;
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const mat of mats) {
                    if (!mat.uniforms) continue;
                    for (const key in mat.uniforms) {
                        const u = mat.uniforms[key];
                        if (u === undefined || u.value === undefined) {
                            console.error(`  [scene] ${obj.name || obj.type} | mat=${mat.type} | ${key} =`, u);
                        }
                    }
                }
            });
            if (composer && composer.passes) {
                composer.passes.forEach((pass, pi) => {
                    const mats = [];
                    if (pass.material) mats.push(pass.material);
                    if (pass.materials) mats.push(...Object.values(pass.materials));
                    if (pass.copyMaterial) mats.push(pass.copyMaterial);
                    mats.forEach((mat, mi) => {
                        if (!mat || !mat.uniforms) return;
                        for (const key in mat.uniforms) {
                            const u = mat.uniforms[key];
                            if (u === undefined || u.value === undefined) {
                                console.error(`  [pass ${pi}] ${pass.constructor.name} | mat${mi}=${mat.type} | ${key} =`, u);
                            }
                        }
                    });
                });
            }
        }
    }

    loadTextures(TEXTURE_CONFIG, renderer).then((t) => {
        gameTextures = t;
        const ok = Object.values(t).filter(Boolean).length;
        const total = Object.keys(TEXTURE_CONFIG).length;
        console.log(`[textures] ${ok}/${total} 加载完成，缺失纹理将使用程序化兜底`);

        if (t.ground) {
            groundMaterial.uniforms.uExternalMap.value = t.ground;
            groundMaterial.uniforms.uUseExternal.value = 1.0;
            groundMaterial.uniforms.uTintColor.value.set('#6a5a90');
            groundMaterial.uniforms.uGroundRepeat.value.set(0.05, 0.05);
            groundMaterial.needsUpdate = true;
        }

        const grassTexs  = [t.grass1,  t.grass2,  t.grass3].filter(Boolean);
        const flowerTexs = [t.flower1, t.flower2, t.flower3, t.flower4].filter(Boolean);
        const reedTexs   = [t.reed1,   t.reed2].filter(Boolean);

        const HOTSPOT = { x: -75, z: 55, radius: 50 };

        grass.rebuild({
            textures: grassTexs.length > 0 ? grassTexs : null,
            grassRatios: [6, 1, 3],
            grassZones: [
                { x: HOTSPOT.x, z: HOTSPOT.z, radius: HOTSPOT.radius, texWeights: [1, 3, 1] },
            ],
            grassWidthMul: 1.8,
            grassHeightMul: 1.8,

            flowerTextures: flowerTexs.length > 0 ? flowerTexs : null,
            flowerRatios: [7, 1, 1, 1],
            flowerZones: [
                { x: HOTSPOT.x, z: HOTSPOT.z, radius: HOTSPOT.radius, texWeights: [0.5, 2.5, 2.5, 2.5] },
            ],
            flowerWidthMul: 2.0,
            flowerHeightMul: 2.0,
        });

        reeds.rebuild({
            textures: reedTexs.length > 0 ? reedTexs : null,
            tintColor: '#9a8aff',
            reedRatios: [3, 7],
            reedZones: [
                { x: 100, z: 80, radius: 32, texWeights: [5.4, 1.0] },
            ],
            reedWidthMul: 1.8,
            reedHeightMul: 1.0,
        });

        if (fragments) fragments.setTextures(t);
        animate();
        console.log('✅ 湖畔灯灵（Blob Shadow 版）启动');
    });