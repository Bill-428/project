// fragments.js —— 碎片收集系统（艺术化重写版）
// 5组×3个碎片，收集→拼合仪式（金色墨晕+粒子符号）→光化过渡→场景变化→下一组
import * as THREE from 'three';
import { createGlowTexture, createInkDropTexture, createGoldFoilTexture } from './proceduralTextures.js';
import { blendToLUT } from './postProcessing.js';
// ========== 配置 ==========
const ORIGIN = new THREE.Vector3(0, 0, 0);
const COLLECT_RADIUS = 2.8;
const RETURN_RADIUS = 3.5;
const FRAGMENT_FLOAT_HEIGHT = 2.5;
const TOTAL_STAGES = 5;
const STAGE_CENTERS = [
  { x: -60, z: -40 },
  { x:  60, z: -60 },
  { x:  80, z:  30 },
  { x: -70, z:  50 },
  { x:   0, z: -80 }
];
const STAGE_COLORS = [
  0xb89aff, 0x8ad8ff, 0xffd98a, 0xffb8d8, 0xfff0a8
];
const STAGE_TEXTS = [
  ['你不必完美，', '也不必坚强，', '你只需是你自己。'],
  ['那些走过的路，', '那些流过的泪，', '都在塑造成今天的你。'],
  ['风会停，', '雨会歇，', '你会在平静里找到自己。'],
  ['把伤口交给时间，', '把疲惫交给湖水，', '把温柔留给自己。'],
  ['碎片终将拼合，', '黑暗终将退散，', '你已是完整的光。']
];
const STAGE_TITLES = [
  '第一幕 · 接纳自我',
  '第二幕 · 与过去和解',
  '第三幕 · 当下的力量',
  '第四幕 · 自我疗愈',
  '第五幕 · 重生完整'
];
const STAGE_SYMBOLS = ['circle', 'spiral', 'triangle', 'heart', 'star'];
const STAGE_ATMOSPHERE = [
  { bg: 0x3d3370, fog: 0x40347a, fogDensity: 0.011, ambient: 0xb9a8f5, ambientI: 1.0, dir: 0xc9bcff, dirI: 1.35, ground1: '#9a84dc', ground2: '#5b3fa0', bloom: 0.18,
    skyTop: 0x0d0d24, skyBottom: 0x3d3370, dirOffset: { x: 30, y: 45, z: 20 }, petalColor: 0xc8a8ff, cloudOpacity: 0.25, volumetricColor: 0xc9bcff,
    grass: { rootA: '#5a3f9e', tipA: '#c4b5ff', rootB: '#3d2a78', tipB: '#8f7ff0' }, groundTint: '#7a6ab0', reedTint: '#9a8aff', reedRimColor: '#c8b8ff' },
  { bg: 0x3a4480, fog: 0x3a4478, fogDensity: 0.010, ambient: 0xa8c0f5, ambientI: 1.1, dir: 0xffb878, dirI: 1.40, ground1: '#84a0dc', ground2: '#3f5fa0', bloom: 0.20,
    skyTop: 0x1a2a4a, skyBottom: 0xc87a5a, dirOffset: { x: -25, y: 18, z: 30 }, petalColor: 0xffb8a8, cloudOpacity: 0.45, volumetricColor: 0xffb878,
    grass: { rootA: '#5a6a9e', tipA: '#9ad8c0', rootB: '#3a4a78', tipB: '#6fb8a0' }, groundTint: '#6a8ab0', reedTint: '#8aa8d8', reedRimColor: '#b8d0f0' },
  { bg: 0x4a5a90, fog: 0x4a5588, fogDensity: 0.009, ambient: 0xa8d8f5, ambientI: 1.2, dir: 0xffe0a8, dirI: 1.45, ground1: '#7ab8d8', ground2: '#3a78a0', bloom: 0.22,
    skyTop: 0x3a6a9a, skyBottom: 0xe8c89a, dirOffset: { x: 20, y: 38, z: 25 }, petalColor: 0xfff0a8, cloudOpacity: 0.55, volumetricColor: 0xffe0a8,
    grass: { rootA: '#6a9a6a', tipA: '#d8e8a8', rootB: '#4a6a4a', tipB: '#a8c878' }, groundTint: '#7ab098', reedTint: '#8ac8a8', reedRimColor: '#b8e0c8' },
  { bg: 0x6a5a90, fog: 0x6a5588, fogDensity: 0.008, ambient: 0xf5c8a8, ambientI: 1.25, dir: 0xffffff, dirI: 1.50, ground1: '#d8a884', ground2: '#a05f3f', bloom: 0.25,
    skyTop: 0x5a9ad8, skyBottom: 0xc8d8e8, dirOffset: { x: 10, y: 52, z: 15 }, petalColor: 0xffd8b8, cloudOpacity: 0.4, volumetricColor: 0xffffff,
    grass: { rootA: '#a87850', tipA: '#e8d8a8', rootB: '#785838', tipB: '#c8a870' }, groundTint: '#b09070', reedTint: '#c8a080', reedRimColor: '#e8c8a0' },
  { bg: 0x8a7a6a, fog: 0x8a7a6a, fogDensity: 0.007, ambient: 0xfff0c8, ambientI: 1.35, dir: 0xffa868, dirI: 1.60, ground1: '#e8d8a8', ground2: '#c89868', bloom: 0.28,
    skyTop: 0x4a2a5a, skyBottom: 0xe89a5a, dirOffset: { x: -30, y: 14, z: -20 }, petalColor: 0xffa878, cloudOpacity: 0.5, volumetricColor: 0xffa868,
    grass: { rootA: '#b88850', tipA: '#f0d898', rootB: '#885830', tipB: '#d8b878' }, groundTint: '#c8b088', reedTint: '#d8b888', reedRimColor: '#f0d8a8' }
];
function lerpVal(a, b, t) { return a + (b - a) * t; }
// ========== 生成符号粒子位置 ==========
function generateSymbolPositions(type, count = 80) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    let x = 0, y = 0, z = 0;
    switch (type) {
      case 'circle': {
        const angle = t * Math.PI * 2;
        const r = 2.5 + Math.sin(t * 20) * 0.1;
        x = Math.cos(angle) * r; z = Math.sin(angle) * r;
        y = Math.sin(t * 10) * 0.2;
        break;
      }
      case 'spiral': {
        const angle = t * Math.PI * 4;
        const r = t * 3;
        x = Math.cos(angle) * r; z = Math.sin(angle) * r;
        y = t * 1.5;
        break;
      }
      case 'triangle': {
        const seg = Math.floor(t * 3);
        const lt = (t * 3) % 1;
        const size = 3;
        const pts = [
          [0, size], [size * 0.87, -size * 0.5], [-size * 0.87, -size * 0.5]
        ];
        const a = pts[seg], b = pts[(seg + 1) % 3];
        x = a[0] + (b[0] - a[0]) * lt;
        z = a[1] + (b[1] - a[1]) * lt;
        y = Math.sin(t * 15) * 0.15;
        break;
      }
      case 'heart': {
        const angle = t * Math.PI * 2;
        const s = Math.sin(angle), c = Math.cos(angle);
        x = 16 * Math.pow(s, 3) / 6;
        z = (13 * c - 5 * Math.cos(2*angle) - 2 * Math.cos(3*angle) - Math.cos(4*angle)) / 6;
        y = Math.sin(t * 12) * 0.15;
        break;
      }
      case 'star': {
        const angle = t * Math.PI * 2;
        const spikes = 5;
        const r = 2.5 + Math.sin(angle * spikes) * 1.2;
        x = Math.cos(angle) * r; z = Math.sin(angle) * r;
        y = Math.sin(t * 20) * 0.25;
        break;
      }
    }
    positions.push(new THREE.Vector3(x, y + 4, z));
  }
  return positions;
}
export function createFragments(options) {
  const {
    scene, character, ui, terrainHeight, lakes, fog, lights,
    groundMaterial, bloomPass, playSFX, sky, petals, volumetricLight, grass, reeds,
    textures = null,
    onGameComplete, onTransitionStart, onTransitionEnd
  } = options;
  let currentStage = 0;
  let collectedCount = 0;
  let fragments = [];
  let currentDirOffset = { x: 30, y: 45, z: 20 };
  let allFragments = [];
  let arrow = null;
  let transitionActive = false;
  let transitionTime = 0;
  let transitionFragments = [];
  let mergeSymbol = null;
  let lightPillar = null;
  let lightRing = null;
  let particles = [];
  let collectLights = [];
  let atmosphereLerp = { active: false, t: 0, from: null, to: null };
  let characterBaseY = 2.2;
  let started = false;
  let inkBlob = null;
  let symbolParticles = null;
  let symbolPositions = [];
  const goldFoilTex = createGoldFoilTexture(256);
  function createFragment(stageIdx, fragIdx, x, z) {
    const color = STAGE_COLORS[stageIdx];
    const group = new THREE.Group();
    const texKey = `chapter${stageIdx + 1}-debris${fragIdx + 1}`;
    const fragTex = textures && textures[texKey] ? textures[texKey] : null;
    const spriteMat = new THREE.SpriteMaterial({
      map: fragTex, color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.2, 2.8, 1);
    group.add(sprite);
    const glowTex = createGlowTexture(
      `rgba(${new THREE.Color(color).r*255},${new THREE.Color(color).g*255},${new THREE.Color(color).b*255},1)`,
      `rgba(${new THREE.Color(color).r*255},${new THREE.Color(color).g*255},${new THREE.Color(color).b*255},0.4)`,
      'rgba(0,0,0,0)'
    );
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: color, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75
    }));
    glow.scale.set(9, 9, 1);
    group.add(glow);
    const y = terrainHeight(x, z, lakes) + FRAGMENT_FLOAT_HEIGHT;
    group.position.set(x, y, z);
    group.renderOrder = 6;
    scene.add(group);
    return {
      group, sprite, glow,
      baseY: y, stageIdx, fragIdx, collected: false, collecting: false, collectT: 0,
      shatterParticles: [],
      text: STAGE_TEXTS[stageIdx][fragIdx], color
    };
  }
  function randomFragmentPos(center, existingPos) {
    for (let tries = 0; tries < 80; tries++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 24;
      const x = center.x + Math.cos(angle) * dist;
      const z = center.z + Math.sin(angle) * dist;
      let inLake = false;
      for (const lake of lakes) {
        const dx = x - lake.x, dz = z - lake.z;
        if (dx * dx + dz * dz < (lake.r + 6) * (lake.r + 6)) { inLake = true; break; }
      }
      if (inLake) continue;
      if (Math.hypot(x, z) < 12) continue;
      let tooClose = false;
      for (const p of existingPos) {
        if (Math.hypot(x - p.x, z - p.z) < 10) { tooClose = true; break; }
      }
      if (tooClose) continue;
      return { x, z };
    }
    const idx = existingPos.length;
    const angle = (idx / 3) * Math.PI * 2;
    return { x: center.x + Math.cos(angle) * 15, z: center.z + Math.sin(angle) * 15 };
  }
  function initAllFragments() {
    allFragments = [];
    for (let s = 0; s < TOTAL_STAGES; s++) {
      const group = [];
      const center = STAGE_CENTERS[s];
      const positions = [];
      for (let f = 0; f < 3; f++) {
        const pos = randomFragmentPos(center, positions);
        positions.push(pos);
        const frag = createFragment(s, f, pos.x, pos.z);
        frag.group.visible = false;
        group.push(frag);
      }
      allFragments.push(group);
    }
    fragments = allFragments[0];
  }
  function createArrow() {
    // PNG 纹理平面箭头：PNG 中箭头默认朝上（图片 +Y 方向）
    // PlaneGeometry 默认在 XY 平面，rotateX(Math.PI/2) 后 +Y→+Z，与原 ShapeGeometry 朝向完全一致
    const geo = new THREE.PlaneGeometry(4.0, 4.0);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: null,                  // 纹理由 setTextures 注入（key: returnArrow）
      color: STAGE_COLORS[0xffffff],     // 白色 PNG 会被染成当前幕次色；若 PNG 已是最终色，改为 0xffffff
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,     // rotateX 后法线朝下，需双面渲染才能从上方看到
      depthWrite: false
    });
    const arr = new THREE.Mesh(geo, mat);
    arr.visible = false;
    scene.add(arr);
    return arr;
  }
  function createTransitionObjects() {
    const pillarGeo = new THREE.CylinderGeometry(0.6, 2.5, 12, 20, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    });
    lightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    lightPillar.position.set(0, 4, 0);
    lightPillar.visible = false;
    scene.add(lightPillar);
    const ringGeo = new THREE.RingGeometry(0.8, 1.2, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    });
    lightRing = new THREE.Mesh(ringGeo, ringMat);
    lightRing.position.set(0, 0.1, 0);
    lightRing.visible = false;
    scene.add(lightRing);
    const inkTex = createInkDropTexture(256);
    const inkGeo = new THREE.PlaneGeometry(20, 20);
    inkGeo.rotateX(-Math.PI / 2);
    const inkMat = new THREE.MeshBasicMaterial({
      map: inkTex, color: 0xd4a848, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    inkBlob = new THREE.Mesh(inkGeo, inkMat);
    inkBlob.position.set(0, 0.05, 0);
    inkBlob.visible = false;
    scene.add(inkBlob);
  }
  function createMergeSymbol(color) {
    const symbolType = STAGE_SYMBOLS[currentStage];
    symbolPositions = generateSymbolPositions(symbolType, 100);
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(symbolPositions.length * 3);
    const sizes = new Float32Array(symbolPositions.length);
    for (let i = 0; i < symbolPositions.length; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      sizes[i] = 0.15 + Math.random() * 0.15;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const glowTex = createGlowTexture(
      'rgba(255,255,255,1)',
      `rgba(${new THREE.Color(color).r*255},${new THREE.Color(color).g*255},${new THREE.Color(color).b*255},0.7)`,
      'rgba(0,0,0,0)'
    );
    const pMat = new THREE.PointsMaterial({
      size: 0.25, map: glowTex, color: color,
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true
    });
    symbolParticles = new THREE.Points(pGeo, pMat);
    symbolParticles.position.set(0, 0, 0);
    scene.add(symbolParticles);
    return symbolParticles;
  }
  function spawnParticles(color, count = 40) {
    for (let i = 0; i < count; i++) {
      const tex = createGlowTexture(
        'rgba(255,255,255,1)',
        `rgba(${new THREE.Color(color).r*255},${new THREE.Color(color).g*255},${new THREE.Color(color).b*255},0.6)`,
        'rgba(0,0,0,0)'
      );
      const mat = new THREE.SpriteMaterial({
        map: tex, color: color, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1
      });
      const p = new THREE.Sprite(mat);
      const size = 0.4 + Math.random() * 0.8;
      p.scale.set(size, size, 1);
      p.position.set(0, 5 + Math.random() * 2, 0);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      p.userData = {
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 1 + Math.random() * 3, Math.sin(angle) * speed),
        life: 1.5 + Math.random() * 1.5,
        maxLife: 1.5 + Math.random() * 1.5
      };
      scene.add(p);
      particles.push(p);
    }
  }
  function shatterFragment(frag) {
    const color = frag.color;
    const shatterCount = 10;
    for (let i = 0; i < shatterCount; i++) {
      const tex = createGlowTexture(
        'rgba(255,255,255,1)',
        `rgba(${new THREE.Color(color).r*255},${new THREE.Color(color).g*255},${new THREE.Color(color).b*255},0.7)`,
        'rgba(0,0,0,0)'
      );
      const mat = new THREE.SpriteMaterial({
        map: tex, color: color, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1
      });
      const p = new THREE.Sprite(mat);
      const size = 0.2 + Math.random() * 0.3;
      p.scale.set(size, size, 1);
      p.position.copy(frag.group.position);
      const angle = Math.random() * Math.PI * 2;
      const upVel = 1 + Math.random() * 2;
      const horizVel = 1 + Math.random() * 3;
      p.userData = {
        velocity: new THREE.Vector3(
          Math.cos(angle) * horizVel,
          upVel,
          Math.sin(angle) * horizVel
        ),
        life: 1.2,
        maxLife: 1.2,
        phase: 'scatter',
        convergeDelay: 0.3 + Math.random() * 0.2
      };
      scene.add(p);
      frag.shatterParticles.push(p);
    }
  }
  function collectFragment(frag) {
    if (frag.collected || frag.collecting) return;
    frag.collecting = true;
    frag.collectT = 0;
    playSFX?.('collect');
    ui.showFragmentText(frag.text, 2800);
    const light = new THREE.PointLight(frag.color, 3.5, 18, 1.5);
    light.position.copy(frag.group.position);
    scene.add(light);
    collectLights.push({ light, life: 1.2, maxLife: 1.2, baseIntensity: 3.5 });
    shatterFragment(frag);
  }
  function onGroupComplete() {
    playSFX?.('groupComplete');
    const fullText = STAGE_TEXTS[currentStage].join('\n');
    ui.showFragmentText(fullText, 4000);
    ui.showReturnHint();
    arrow.visible = true;
    arrow.material.color.setHex(STAGE_COLORS[currentStage]);
  }
  function startTransition() {
    transitionActive = true;
    transitionTime = 0;
    ui.hideReturnHint();
    arrow.visible = false;
    playSFX?.('groupComplete');
    onTransitionStart?.();
    const color = STAGE_COLORS[currentStage];
    transitionFragments = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.OctahedronGeometry(0.6, 0);
      geo.scale(1, 0.35, 1);
      const mat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 1.0, transparent: true, opacity: 1
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(character.position);
      m.position.y += 1;
      scene.add(m);
      transitionFragments.push({ mesh: m, startPos: character.position.clone().setY(character.position.y + 1), angle: (i / 3) * Math.PI * 2 });
    }
    lightPillar.visible = true;
    lightRing.visible = true;
    inkBlob.visible = true;
    lightPillar.material.color.setHex(color);
    lightRing.material.color.setHex(color);
    inkBlob.material.color.setHex(color);
    mergeSymbol = createMergeSymbol(color);
    const nextStage = Math.min(currentStage + 1, TOTAL_STAGES - 1);
    atmosphereLerp = { active: true, t: 0, from: captureAtmosphere(), to: STAGE_ATMOSPHERE[nextStage] };
    blendToLUT(nextStage, 2.5);
  }
  function captureAtmosphere() {
    const cur = STAGE_ATMOSPHERE[currentStage];
    return {
      bg: scene.background.getHex(),
      fog: fog.color.getHex(),
      fogDensity: fog.density,
      ambient: lights.ambient.color.getHex(),
      ambientI: lights.ambient.intensity,
      dir: lights.directional.color.getHex(),
      dirI: lights.directional.intensity,
      ground1: groundMaterial.uniforms.uColor1.value.getStyle(),
      ground2: groundMaterial.uniforms.uColor2.value.getStyle(),
      bloom: bloomPass ? bloomPass.strength : 0.18,
      skyTop: cur.skyTop,
      skyBottom: cur.skyBottom,
      dirOffset: { ...currentDirOffset },
      petalColor: cur.petalColor,
      cloudOpacity: cur.cloudOpacity,
      volumetricColor: cur.volumetricColor,
      grass: { ...cur.grass },
      groundTint: groundMaterial.uniforms.uTintColor.value.getStyle(),
      reedTint: STAGE_ATMOSPHERE[currentStage].reedTint,
      reedRimColor: STAGE_ATMOSPHERE[currentStage].reedRimColor
    };
  }
  function lerpColorHex(hex1, hex2, t) {
    const c1 = new THREE.Color(hex1), c2 = new THREE.Color(hex2);
    c1.lerp(c2, t);
    return c1.getHex();
  }
  function lerpColorHexStyle(style1, style2, t) {
    const c1 = new THREE.Color(style1), c2 = new THREE.Color(style2);
    c1.lerp(c2, t);
    return '#' + c1.getHexString();
  }
  function updateAtmosphereLerp(delta) {
    if (!atmosphereLerp.active) return;
    atmosphereLerp.t += delta / 2.0;
    const t = Math.min(1, atmosphereLerp.t);
    const { from, to } = atmosphereLerp;
    scene.background.setHex(lerpColorHex(from.bg, to.bg, t));
    fog.color.setHex(lerpColorHex(from.fog, to.fog, t));
    fog.density = lerpVal(from.fogDensity, to.fogDensity, t);
    lights.ambient.color.setHex(lerpColorHex(from.ambient, to.ambient, t));
    lights.ambient.intensity = lerpVal(from.ambientI, to.ambientI, t);
    lights.directional.color.setHex(lerpColorHex(from.dir, to.dir, t));
    lights.directional.intensity = lerpVal(from.dirI, to.dirI, t);
    groundMaterial.uniforms.uColor1.value.set(lerpColorHexStyle(from.ground1, to.ground1, t));
    groundMaterial.uniforms.uColor2.value.set(lerpColorHexStyle(from.ground2, to.ground2, t));
    if (bloomPass) bloomPass.strength = lerpVal(from.bloom, to.bloom, t);
    if (sky) sky.lerpColors(from.skyTop, from.skyBottom, to.skyTop, to.skyBottom, t);
    if (petals) petals.setColor(lerpColorHex(from.petalColor, to.petalColor, t));
    if (sky) sky.setCloudOpacity(lerpVal(from.cloudOpacity, to.cloudOpacity, t));
    if (volumetricLight) volumetricLight.setColor(lerpColorHex(from.volumetricColor, to.volumetricColor, t));
    if (grass) grass.setGrassColors(
      lerpColorHexStyle(from.grass.rootA, to.grass.rootA, t),
      lerpColorHexStyle(from.grass.tipA, to.grass.tipA, t),
      lerpColorHexStyle(from.grass.rootB, to.grass.rootB, t),
      lerpColorHexStyle(from.grass.tipB, to.grass.tipB, t)
    );
    groundMaterial.uniforms.uTintColor.value.set(lerpColorHexStyle(from.groundTint, to.groundTint, t));
    if (reeds) {
      reeds.setTintColor(lerpColorHexStyle(from.reedTint, to.reedTint, t));
      reeds.setRimColor(lerpColorHexStyle(from.reedRimColor, to.reedRimColor, t));
    }
    currentDirOffset.x = lerpVal(from.dirOffset.x, to.dirOffset.x, t);
    currentDirOffset.y = lerpVal(from.dirOffset.y, to.dirOffset.y, t);
    currentDirOffset.z = lerpVal(from.dirOffset.z, to.dirOffset.z, t);
    if (t >= 1) atmosphereLerp.active = false;
  }
  function finishTransition() {
    transitionActive = false;
    transitionFragments.forEach(f => { scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); });
    transitionFragments = [];
    if (mergeSymbol) { scene.remove(mergeSymbol); mergeSymbol.geometry.dispose(); mergeSymbol.material.dispose(); mergeSymbol = null; }
    lightPillar.visible = false;
    lightRing.visible = false;
    inkBlob.visible = false;
    currentStage++;
    collectedCount = 0;
    if (currentStage >= TOTAL_STAGES) { onGameComplete?.(); return; }
    fragments = allFragments[currentStage];
    fragments.forEach(f => { f.collected = false; f.collecting = false; f.group.visible = true; });
    ui.updateProgress(currentStage, 0);
    ui.showStageTitle(STAGE_TITLES[currentStage], 2800);
    onTransitionEnd?.();
  }
  function updateTransition(delta, time) {
    transitionTime += delta;
    const t = transitionTime;
    const color = STAGE_COLORS[currentStage];
    if (t < 1.0) {
      const kt = t / 1.0;
      transitionFragments.forEach((f) => {
        const targetAngle = f.angle + kt * Math.PI * 2;
        const radius = lerpVal(0.5, 1.5, kt);
        f.mesh.position.set(Math.cos(targetAngle) * radius, lerpVal(character.position.y + 1, 5.5, kt), Math.sin(targetAngle) * radius);
        f.mesh.rotation.y += delta * 3;
        f.mesh.rotation.x += delta * 2;
      });
      character.position.y = lerpVal(characterBaseY, characterBaseY + 1.5, kt);
      if (inkBlob) {
        inkBlob.material.opacity = kt * 0.6;
        inkBlob.scale.setScalar(lerpVal(0.3, 1.0, kt));
      }
    } else if (t < 2.0) {
      const kt = (t - 1.0) / 1.0;
      const ease = kt * kt * (3 - 2 * kt);
      transitionFragments.forEach((f) => {
        const targetAngle = f.angle + Math.PI * 2 + kt * Math.PI;
        const radius = lerpVal(1.5, 0.1, ease);
        f.mesh.position.set(Math.cos(targetAngle) * radius, 5.5 + Math.sin(kt * Math.PI) * 0.5, Math.sin(targetAngle) * radius);
        f.mesh.rotation.y += delta * 5;
        f.mesh.scale.setScalar(1 - ease * 0.3);
      });
      if (symbolParticles) {
        symbolParticles.material.opacity = ease * 0.95;
        const posAttr = symbolParticles.geometry.attributes.position;
        for (let i = 0; i < symbolPositions.length; i++) {
          const target = symbolPositions[i];
          posAttr.array[i * 3] = lerpVal(0, target.x, ease);
          posAttr.array[i * 3 + 1] = lerpVal(0, target.y, ease);
          posAttr.array[i * 3 + 2] = lerpVal(0, target.z, ease);
        }
        posAttr.needsUpdate = true;
      }
      lightRing.material.opacity = ease * 0.8;
      lightRing.scale.setScalar(lerpVal(1, 8, ease));
      lightPillar.material.opacity = ease * 0.5;
      lightPillar.scale.y = lerpVal(0.3, 1.2, ease);
      if (inkBlob) {
        inkBlob.material.opacity = 0.5 + ease * 0.2;
        inkBlob.scale.setScalar(lerpVal(1.0, 2.5, ease));
      }
      character.position.y = lerpVal(characterBaseY + 1.5, characterBaseY + 3.5, ease);
    } else if (t < 3.0) {
      const kt = (t - 2.0) / 1.0;
      ui.setLightOverlay(kt);
      transitionFragments.forEach(f => { f.mesh.material.opacity = 1 - kt; f.mesh.scale.setScalar(1 - kt * 0.7); });
      if (symbolParticles) {
        symbolParticles.material.opacity = 0.9 + Math.sin(time * 4) * 0.1;
        const scale = 1 + Math.sin(time * 3) * 0.05;
        symbolParticles.scale.setScalar(scale);
      }
      lightPillar.material.opacity = lerpVal(0.5, 0.9, kt);
      lightRing.material.opacity = lerpVal(0.8, 1.0, kt);
      lightRing.scale.setScalar(lerpVal(8, 15, kt));
      if (t > 2.3 && !atmosphereLerp.active) {
        atmosphereLerp.active = true;
        atmosphereLerp.t = 0;
      }
    } else if (t < 4.5) {
      const kt = (t - 3.0) / 1.5;
      ui.setLightOverlay(1 - kt);
      if (particles.length === 0) spawnParticles(color, 45);
      if (symbolParticles) {
        symbolParticles.material.opacity = (1 - kt) * 0.9;
        const posAttr = symbolParticles.geometry.attributes.position;
        for (let i = 0; i < symbolPositions.length; i++) {
          const target = symbolPositions[i];
          const drift = kt * 3;
          posAttr.array[i * 3] = target.x + Math.sin(time * 2 + i) * drift;
          posAttr.array[i * 3 + 1] = target.y + kt * 4;
          posAttr.array[i * 3 + 2] = target.z + Math.cos(time * 2 + i) * drift;
        }
        posAttr.needsUpdate = true;
      }
      lightPillar.material.opacity = (1 - kt) * 0.9;
      lightRing.material.opacity = (1 - kt) * 1.0;
      lightRing.scale.setScalar(lerpVal(15, 25, kt));
      if (inkBlob) {
        inkBlob.material.opacity = (1 - kt) * 0.7;
        inkBlob.scale.setScalar(lerpVal(2.5, 4, kt));
      }
      character.position.y = lerpVal(characterBaseY + 3.5, characterBaseY + 2, kt * 0.5);
    } else if (t < 5.5) {
      const kt = (t - 4.5) / 1.0;
      character.position.y = lerpVal(characterBaseY + 2, characterBaseY, kt);
      lightPillar.material.opacity = (1 - kt) * 0.4;
      lightRing.material.opacity = (1 - kt) * 0.5;
    } else {
      ui.setLightOverlay(0);
      character.position.y = characterBaseY;
      finishTransition();
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.userData.life -= delta;
      p.position.addScaledVector(p.userData.velocity, delta);
      p.userData.velocity.y -= delta * 0.5;
      p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
      if (p.userData.life <= 0) { scene.remove(p); p.material.map?.dispose(); p.material.dispose(); particles.splice(i, 1); }
    }
    updateAtmosphereLerp(delta);
  }
  function update(delta, time) {
    if (!started) return;
    for (let i = collectLights.length - 1; i >= 0; i--) {
      const cl = collectLights[i];
      cl.life -= delta;
      const t = Math.max(0, cl.life / cl.maxLife);
      cl.light.intensity = cl.baseIntensity * t * t;
      if (cl.life <= 0) { scene.remove(cl.light); collectLights.splice(i, 1); }
    }
    if (transitionActive) { updateTransition(delta, time); return; }
    for (const frag of fragments) {
      if (frag.collected) continue;
      if (frag.collecting) {
        frag.collectT += delta * 3;
        const kt = Math.min(1, frag.collectT);
        frag.sprite.material.opacity = 1 - kt;
        frag.glow.material.opacity = (1 - kt) * 0.45;
        frag.sprite.scale.setScalar(2.5 * (1 + kt * 0.3));
        for (let i = frag.shatterParticles.length - 1; i >= 0; i--) {
          const p = frag.shatterParticles[i];
          p.userData.life -= delta;
          if (p.userData.phase === 'scatter') {
            p.position.addScaledVector(p.userData.velocity, delta);
            p.userData.velocity.y -= delta * 1.5;
            p.userData.convergeDelay -= delta;
            if (p.userData.convergeDelay <= 0) {
              p.userData.phase = 'converge';
            }
          } else {
            const target = character.position.clone();
            target.y += 0.5;
            const dir = target.sub(p.position).normalize();
            p.userData.velocity.lerp(dir.multiplyScalar(8), delta * 3);
            p.position.addScaledVector(p.userData.velocity, delta);
          }
          p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
          const s = 0.2 + (1 - p.userData.life / p.userData.maxLife) * 0.15;
          p.scale.setScalar(s);
          if (p.userData.life <= 0) {
            scene.remove(p); p.material.map?.dispose(); p.material.dispose();
            frag.shatterParticles.splice(i, 1);
          }
        }
        if (kt >= 1) {
          frag.collected = true;
          frag.group.visible = false;
          collectedCount++;
          ui.updateProgress(currentStage, collectedCount);
          if (collectedCount >= 3) onGroupComplete();
        }
        continue;
      }
      frag.group.position.y = frag.baseY + Math.sin(time * 1.5 + frag.fragIdx * 2) * 0.4;
      frag.sprite.material.opacity = 0.85 + Math.sin(time * 2 + frag.fragIdx) * 0.15;
      frag.glow.material.opacity = 0.35 + Math.sin(time * 2 + frag.fragIdx * 1.5) * 0.15;
      const breathe = 1 + Math.sin(time * 1.5 + frag.fragIdx) * 0.06;
      frag.sprite.scale.set(2.2 * breathe, 2.8 * breathe, 1);
      const dx = frag.group.position.x - character.position.x;
      const dz = frag.group.position.z - character.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 8) {
        const heartbeat = 1 + Math.sin(time * 5) * 0.08 * (1 - dist / 8);
        frag.group.scale.setScalar(heartbeat);
      } else {
        frag.group.scale.setScalar(1);
      }
      if (dist < COLLECT_RADIUS) collectFragment(frag);
    }
    if (arrow.visible) {
      arrow.position.set(character.position.x, 0.3, character.position.z);
      const dx = ORIGIN.x - character.position.x;
      const dz = ORIGIN.z - character.position.z;
      arrow.rotation.y = Math.atan2(dx, dz);
      const pulse = 0.6 + Math.sin(time * 3) * 0.2;
      arrow.material.opacity = pulse;
      arrow.scale.setScalar(1 + Math.sin(time * 3) * 0.1);
      const distToOrigin = Math.hypot(character.position.x, character.position.z);
      if (distToOrigin < RETURN_RADIUS) startTransition();
    }
  }
  function start() {
    started = true;
    currentStage = 0;
    collectedCount = 0;
    ui.hideReturnHint();
    allFragments.forEach((group, gi) => {
      group.forEach(f => { f.collected = false; f.collecting = false; f.group.visible = (gi === 0); f.group.scale.setScalar(1); });
    });
    fragments = allFragments[0];
    ui.updateProgress(0, 0);
    ui.showProgress();
    ui.showStageTitle(STAGE_TITLES[0], 2500);
  }
  function reset() {
    started = false;
    transitionActive = false;
    transitionTime = 0;
    currentStage = 0;
    collectedCount = 0;
    if (arrow) arrow.visible = false;
    if (lightPillar) lightPillar.visible = false;
    if (lightRing) lightRing.visible = false;
    if (inkBlob) inkBlob.visible = false;
    ui.hideReturnHint();
    ui.setLightOverlay(0);
    ui.hideProgress();
    transitionFragments.forEach(f => { scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); });
    transitionFragments = [];
    particles.forEach(p => { scene.remove(p); p.material.map?.dispose(); p.material.dispose(); });
    particles = [];
    collectLights.forEach(cl => scene.remove(cl.light));
    collectLights = [];
    if (mergeSymbol) { scene.remove(mergeSymbol); mergeSymbol.geometry.dispose(); mergeSymbol.material.dispose(); mergeSymbol = null; }
    allFragments.forEach(group => {
      group.forEach(f => {
        f.shatterParticles.forEach(p => { scene.remove(p); p.material.map?.dispose(); p.material.dispose(); });
        f.shatterParticles = [];
      });
    });
    const atm = STAGE_ATMOSPHERE[0];
    scene.background.setHex(atm.bg);
    fog.color.setHex(atm.fog);
    fog.density = atm.fogDensity;
    lights.ambient.color.setHex(atm.ambient);
    lights.ambient.intensity = atm.ambientI;
    lights.directional.color.setHex(atm.dir);
    lights.directional.intensity = atm.dirI;
    groundMaterial.uniforms.uColor1.value.set(atm.ground1);
    groundMaterial.uniforms.uColor2.value.set(atm.ground2);
    if (bloomPass) bloomPass.strength = atm.bloom;
    if (sky) { sky.setColors(atm.skyTop, atm.skyBottom); sky.setCloudOpacity(atm.cloudOpacity); }
    if (petals) petals.setColor(atm.petalColor);
    if (volumetricLight) volumetricLight.setColor(atm.volumetricColor);
    if (grass) grass.setGrassColors(atm.grass.rootA, atm.grass.tipA, atm.grass.rootB, atm.grass.tipB);
    currentDirOffset = { ...atm.dirOffset };
  }
  function dispose() {
    reset();
    allFragments.forEach(group => {
      group.forEach(f => {
        scene.remove(f.group);
        f.sprite.material.map?.dispose(); f.sprite.material.dispose();
        f.glow.material.map?.dispose(); f.glow.material.dispose();
      });
    });
    if (arrow) { scene.remove(arrow); arrow.geometry.dispose(); arrow.material.dispose(); }
    if (lightPillar) { scene.remove(lightPillar); lightPillar.geometry.dispose(); lightPillar.material.dispose(); }
    if (lightRing) { scene.remove(lightRing); lightRing.geometry.dispose(); lightRing.material.dispose(); }
    if (inkBlob) { scene.remove(inkBlob); inkBlob.geometry.dispose(); inkBlob.material.map?.dispose(); inkBlob.material.dispose(); }
    if (arrow) { scene.remove(arrow); arrow.geometry.dispose(); arrow.material.map?.dispose(); arrow.material.dispose(); }
  }
  initAllFragments();
  arrow = createArrow();
  createTransitionObjects();
  function setTextures(texs) {
    if (!texs) return;
    // 注入返回原点箭头纹理
    if (texs.returnArrow && arrow) {
      arrow.material.map = texs.returnArrow;
      arrow.material.needsUpdate = true;
    }
    for (const group of allFragments) {
      for (const frag of group) {
        const key = `chapter${frag.stageIdx + 1}-debris${frag.fragIdx + 1}`;
        if (texs[key] && frag.sprite) {
          frag.sprite.material.map = texs[key];
          frag.sprite.material.needsUpdate = true;
        }
      }
    }
}
  return {
    update, start, reset, dispose, setTextures,
    getCurrentStage: () => currentStage,
    getCollectedCount: () => collectedCount,
    isTransitioning: () => transitionActive,
    getDirOffset: () => currentDirOffset,
    getTotalStages: () => TOTAL_STAGES
  };
}

