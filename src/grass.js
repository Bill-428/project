// grass.js —— 草地（外部贴图 billboard 版）
// 平面 billboard + alpha test + 外部纹理 + 颜色染色 + 风摆 + 角色压倒 + 噪声密度分布
// 支持：多纹理按比例生成、区域偏好、独立尺寸、运行时 rebuild
import * as THREE from 'three';
import { terrainHeight } from './groundShader.js';

const GRID_SIZE = 6;

function fbm2(x, z) {
  function hash(x, z) {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < 4; i++) {
    const xi = Math.floor(x * freq), zi = Math.floor(z * freq);
    const xf = x * freq - xi, zf = z * freq - zi;
    const a = hash(xi, zi), b = hash(xi + 1, zi);
    const c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
    const u = smooth(xf), v = smooth(zf);
    val += (a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v) * amp;
    freq *= 2; amp *= 0.5;
  }
  return val;
}

function createFlowerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(70,110,50,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(48, 128); ctx.quadraticCurveTo(46, 80, 48, 58);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.save();
    ctx.translate(48 + Math.cos(a) * 9, 40 + Math.sin(a) * 9);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, -14, 0, 6);
    g.addColorStop(0, 'rgba(255,255,255,0.98)');
    g.addColorStop(0.55, 'rgba(255,150,180,0.92)');
    g.addColorStop(1, 'rgba(220,90,130,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,214,80,1)';
  ctx.beginPath(); ctx.arc(48, 40, 6, 0, Math.PI * 2); ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

const vertexShader = `
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2  uWindDir;
  uniform float uFogDensity;
  uniform vec3  uFogColor;
  uniform vec3  uCharacterPos;
  uniform float uCharacterRadius;
  attribute float aPhase;
  attribute float aWindMul;
  attribute float aColorMix;
  varying float vHeight;
  varying float vColorMix;
  varying vec3  vWorldPos;
  varying float vFogFactor;
  varying float vBendAmount;
  varying vec2  vUv;
  void main() {
    vUv = uv;
    vHeight   = uv.y;
    vColorMix = aColorMix;
    vec4 instP = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 scl = vec3(
      length(instanceMatrix[0].xyz),
      length(instanceMatrix[1].xyz),
      length(instanceMatrix[2].xyz)
    );
    float ph = uTime * 1.7 + instP.x * 0.18 + instP.z * 0.14 + aPhase * 6.2831853;
    float swayX = sin(ph) * 0.6 + sin(ph * 2.1 + aPhase * 2.9) * 0.3;
    float w = vHeight * vHeight * uWindStrength * aWindMul;
    vec2 dir = normalize(uWindDir);
    float bendAng = clamp(dir.x * swayX * w * 0.34, -0.45, 0.45);
    vec2 toChar = instP.xz - uCharacterPos.xz;
    float charDist = length(toChar);
    float charInfluence = 1.0 - smoothstep(0.0, uCharacterRadius, charDist);
    vec2 pushDir = charDist > 0.001 ? toChar / charDist : vec2(0.0, 1.0);
    float charBend = charInfluence * vHeight * vHeight * 1.2;
    bendAng += charBend * 0.5;
    vBendAmount = abs(bendAng) + charInfluence * 0.5;
    vec3 toCam = cameraPosition - instP.xyz;
    vec3 camXZ = vec3(toCam.x, 0.0, toCam.z);
    float camLen = length(camXZ);
    vec3 camDir = camLen > 0.0001 ? camXZ / camLen : vec3(0.0, 0.0, 1.0);
    vec3 right = vec3(camDir.z, 0.0, -camDir.x);
    vec3 up = vec3(0.0, 1.0, 0.0);
    float bend = bendAng * uv.y;
    float cb = cos(bend), sb = sin(bend);
    vec3 windWorld = vec3(dir.x, 0.0, dir.y);
    vec3 basePos = right * position.x * scl.x + up * uv.y * scl.y;
    basePos.x += pushDir.x * charBend * 0.3;
    basePos.z += pushDir.y * charBend * 0.3;
    float offUp = dot(basePos, up);
    float offW  = dot(basePos, windWorld);
    vec3 rotated = up * (offUp * cb - offW * sb) + windWorld * (offUp * sb + offW * cb);
    vec3 worldOff = rotated + (basePos - up * offUp - windWorld * offW);
    float camDist = length(instP.xyz - cameraPosition);
    float lodFade = 1.0 - smoothstep(70.0, 115.0, camDist);
    worldOff.y *= lodFade;
    vec3 worldPos = instP.xyz + worldOff;
    vWorldPos = worldPos;
    float dist = length(worldPos - cameraPosition);
    vFogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uMap;
  uniform vec3  uColorRootA;
  uniform vec3  uColorTipA;
  uniform vec3  uColorRootB;
  uniform vec3  uColorTipB;
  uniform vec3  uFogColor;
  uniform vec3  uRimColor;
  uniform float uRimStrength;
  uniform float uAlphaTest;
  varying float vHeight;
  varying float vColorMix;
  varying vec3  vWorldPos;
  varying float vFogFactor;
  varying float vBendAmount;
  varying vec2  vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < uAlphaTest) discard;
    vec3 root = mix(uColorRootA, uColorRootB, vColorMix);
    vec3 tip  = mix(uColorTipA,  uColorTipB,  vColorMix);
    float grad = smoothstep(0.0, 1.0, vHeight);
    vec3 tint = mix(root, tip, grad);
    vec3 col = tex.rgb * tint;
    float rim = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 2.0);
    rim *= smoothstep(0.1, 0.9, vHeight);
    rim *= 1.0 + vBendAmount * 0.5;
    col += uRimColor * rim * uRimStrength;
    float n = hash(floor(vWorldPos.xz * 32.0));
    col += (n - 0.5) * 0.04;
    col = mix(col, uFogColor, vFogFactor);
    gl_FragColor = vec4(col, tex.a);
  }
`;

export function createGrass(scene, options = {}) {
  // ===== 配置（可被 rebuild 覆盖）=====
  const cfg = {
    lakes: [],
    mapHalf: 125,
    density: 0.20,
    minHeight: 1.3,
    maxHeight: 3.2,
    flowerDensity: 0.008,
    rootA: '#1a1230', tipA: '#3a2a5a',
    rootB: '#151028', tipB: '#2a1f48',
    rimColor: '#8a7aff', rimStrength: 0.4,
    fogColor: new THREE.Color(0xf2d9a6),
    fogDensity: 0.0011,
    windStrength: 1.0,
    windDir: new THREE.Vector2(0.75, -0.35),
    clumpMinBlades: 5,
    clumpMaxBlades: 9,
    clumpRadiusMin: 0.5,
    clumpRadiusMax: 1.4,
    textures: null,
    flowerTextures: null,
    alphaTest: 0.4,
    densityNoiseScale: 0.015,
    densityNoiseThreshold: 0.35,
    seed: 20260827,
    // —— 新增：多纹理比例 ——
    grassRatios: null,        // 例 [0.5, 0.3, 0.2]，null 则平均
    flowerRatios: null,
    // —— 新增：区域偏好 ——
    // { x, z, radius, texWeights: [1.5, 1.0, 0.8] }
    // 半径内对应纹理权重 = 基础权重 * (1 + (texWeight-1) * 线性衰减)
    grassZones: [],
    flowerZones: [],
    // —— 新增：全局尺寸倍率 ——
    grassWidthMul: 1.0,
    grassHeightMul: 1.0,
    flowerWidthMul: 1.0,
    flowerHeightMul: 1.0,
    // —— 新增：每种纹理独立尺寸范围（覆盖全局）——
    // [{ minW, maxW, minH, maxH }, ...]  缺省回退到全局 minHeight/maxHeight
    perTexGrassSizes: null,
    perTexFlowerSizes: null,  // [{ minW, maxW, minH, maxH }, ...]
  };
  Object.assign(cfg, options);

  let _seed = cfg.seed;
  const rand = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };
  const randRange = (a, b) => a + (b - a) * rand();

  const inLake = (x, z) => {
    for (const L of cfg.lakes) {
      const dx = x - L.x, dz = z - L.z;
      if (dx * dx + dz * dz < (L.r + 1.5) * (L.r + 1.5)) return true;
    }
    return false;
  };

  function randomLand() {
    for (let t = 0; t < 24; t++) {
      const x = randRange(-cfg.mapHalf, cfg.mapHalf);
      const z = randRange(-cfg.mapHalf, cfg.mapHalf);
      if (!inLake(x, z)) return { x, z };
    }
    return { x: 0, z: 0 };
  }

  // ===== 加权纹理索引：基础比例 + 区域偏好叠加 =====
  function weightedTexIdx(ratios, zones, x, z, texCount) {
    const weights = new Array(texCount).fill(1);
    if (ratios && ratios.length >= texCount) {
      for (let i = 0; i < texCount; i++) weights[i] = ratios[i] || 0;
    }
    for (const zone of (zones || [])) {
      const dx = x - zone.x, dz = z - zone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < zone.radius) {
        const falloff = 1 - dist / zone.radius;
        const tw = zone.texWeights || [];
        for (let i = 0; i < texCount; i++) {
          if (tw[i] !== undefined && tw[i] > 0) {
            weights[i] *= 1 + (tw[i] - 1) * falloff;
          }
        }
      }
    }
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) return 0;
    let r = rand() * sum;
    for (let i = 0; i < texCount; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return texCount - 1;
  }

  const blockSize = (cfg.mapHalf * 2) / GRID_SIZE;
  const blockCount = GRID_SIZE * GRID_SIZE;

  function getBlockIndex(x, z) {
    const bx = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor((x + cfg.mapHalf) / blockSize)));
    const bz = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor((z + cfg.mapHalf) / blockSize)));
    return bz * GRID_SIZE + bx;
  }

  const grassGeo = new THREE.PlaneGeometry(0.8, 1.0);
  grassGeo.translate(0, 0.5, 0);
  const flowerGeo = new THREE.PlaneGeometry(0.6, 0.8);
  flowerGeo.translate(0, 0.4, 0);

  let grassMats = [];
  let flowerMats = [];
  let grassBlocks = [];
  let flowerBlocks = [];

  function makeGrassMaterial(tex) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: cfg.windStrength },
        uWindDir: { value: cfg.windDir.clone().normalize() },
        uColorRootA: { value: new THREE.Color(cfg.rootA) },
        uColorTipA:  { value: new THREE.Color(cfg.tipA) },
        uColorRootB: { value: new THREE.Color(cfg.rootB) },
        uColorTipB:  { value: new THREE.Color(cfg.tipB) },
        uFogColor: { value: cfg.fogColor },
        uFogDensity: { value: cfg.fogDensity },
        uRimColor: { value: new THREE.Color(cfg.rimColor) },
        uRimStrength: { value: cfg.rimStrength },
        uCharacterPos: { value: new THREE.Vector3(9999, 0, 9999) },
        uCharacterRadius: { value: 3.0 },
        uAlphaTest: { value: cfg.alphaTest },
        uMap: { value: tex }
      },
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
      transparent: true
    });
  }

  function makeFlowerMaterial(tex) {
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.3,
      color: 0xffffff,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }

  // ===== 构建草地 =====
  function buildGrass() {
    const activeTextures = (cfg.textures && cfg.textures.length > 0) ? cfg.textures.filter(Boolean) : null;
    const texCount = activeTextures ? activeTextures.length : 1;

    grassMats = [];
    for (let ti = 0; ti < texCount; ti++) {
      grassMats.push(makeGrassMaterial(activeTextures ? activeTextures[ti] : null));
    }

    const capacity = Math.round(4 * cfg.mapHalf * cfg.mapHalf * cfg.density);
    const avgBlades = (cfg.clumpMinBlades + cfg.clumpMaxBlades) * 0.5;
    const clumpCount = Math.max(1, Math.ceil(capacity / avgBlades));

    const blockData = Array.from({ length: blockCount }, () => []);
    let placed = 0;

    for (let c = 0; c < clumpCount && placed < capacity; c++) {
      const { x: cx, z: cz } = randomLand();
      const noiseVal = fbm2(cx * cfg.densityNoiseScale, cz * cfg.densityNoiseScale);
      if (noiseVal < cfg.densityNoiseThreshold) continue;
      const densityMul = 0.4 + (noiseVal - cfg.densityNoiseThreshold) * 2.5;
      const clumpR = randRange(cfg.clumpRadiusMin, cfg.clumpRadiusMax);
      const clumpScale = randRange(0.7, 1.7);
      const bladesInClump = Math.round((cfg.clumpMinBlades + Math.floor(rand() * (cfg.clumpMaxBlades - cfg.clumpMinBlades + 1))) * densityMul);

      for (let b = 0; b < bladesInClump && placed < capacity; b++) {
        const ang = rand() * Math.PI * 2;
        const rad = Math.sqrt(rand()) * clumpR;
        const x = cx + Math.cos(ang) * rad;
        const z = cz + Math.sin(ang) * rad;
        const y = terrainHeight(x, z, cfg.lakes) + 0.02;
        const rim = rad / clumpR;

        const texIdx = weightedTexIdx(cfg.grassRatios, cfg.grassZones, x, z, texCount);

        // 尺寸：perTex 优先，否则全局
        const pts = cfg.perTexGrassSizes && cfg.perTexGrassSizes[texIdx];
        const minW = pts ? (pts.minW ?? 0.6) : 0.6;
        const maxW = pts ? (pts.maxW ?? 1.2) : 1.2;
        const minH = pts ? (pts.minH ?? cfg.minHeight) : cfg.minHeight;
        const maxH = pts ? (pts.maxH ?? cfg.maxHeight) : cfg.maxHeight;

        const h = randRange(minH, maxH) * clumpScale * (1.0 - rim * 0.22) * randRange(0.7, 1.05) * cfg.grassHeightMul;
        const w = randRange(minW, maxW) * clumpScale * cfg.grassWidthMul;

        const bi = getBlockIndex(x, z);
        blockData[bi].push({
          x, y, z,
          sx: w, sy: h, sz: 1,
          phase: rand(),
          windMul: randRange(0.6, 1.4),
          colorMix: rand(),
          texIdx
        });
        placed++;
      }
    }

    const dummy = new THREE.Object3D();
    for (let bi = 0; bi < blockCount; bi++) {
      const data = blockData[bi];
      if (data.length === 0) continue;
      const byTex = Array.from({ length: texCount }, () => []);
      for (const d of data) byTex[d.texIdx].push(d);

      let centerX = 0, centerZ = 0;
      for (const d of data) { centerX += d.x; centerZ += d.z; }
      centerX /= data.length;
      centerZ /= data.length;

      for (let ti = 0; ti < texCount; ti++) {
        const tdata = byTex[ti];
        if (tdata.length === 0) continue;
        const blockGeo = grassGeo.clone();
        const mesh = new THREE.InstancedMesh(blockGeo, grassMats[ti], tdata.length);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        const phases = new Float32Array(tdata.length);
        const windMuls = new Float32Array(tdata.length);
        const colorMixes = new Float32Array(tdata.length);
        for (let i = 0; i < tdata.length; i++) {
          const d = tdata[i];
          dummy.position.set(d.x, d.y, d.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(d.sx, d.sy, d.sz);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          phases[i] = d.phase;
          windMuls[i] = d.windMul;
          colorMixes[i] = d.colorMix;
        }
        mesh.instanceMatrix.needsUpdate = true;
        blockGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
        blockGeo.setAttribute('aWindMul', new THREE.InstancedBufferAttribute(windMuls, 1));
        blockGeo.setAttribute('aColorMix', new THREE.InstancedBufferAttribute(colorMixes, 1));
        blockGeo.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(centerX, cfg.maxHeight * 0.5, centerZ),
          blockSize * 0.75 + cfg.maxHeight
        );
        mesh.frustumCulled = true;
        mesh.renderOrder = 2;
        scene.add(mesh);
        grassBlocks.push(mesh);
      }
    }
  }

  // ===== 构建花 =====
  function buildFlowers() {
    const activeFlowerTexs = (cfg.flowerTextures && cfg.flowerTextures.length > 0)
      ? cfg.flowerTextures.filter(Boolean)
      : [createFlowerTexture()];
    const flowerTexCount = activeFlowerTexs.length;

    flowerMats = [];
    for (let fi = 0; fi < flowerTexCount; fi++) {
      flowerMats.push(makeFlowerMaterial(activeFlowerTexs[fi]));
    }

    const flowerCount = Math.round(4 * cfg.mapHalf * cfg.mapHalf * cfg.flowerDensity);
    const flowerBlockData = Array.from({ length: blockCount }, () => []);

    for (let i = 0; i < flowerCount; i++) {
      const { x, z } = randomLand();
      const noiseVal = fbm2(x * cfg.densityNoiseScale, z * cfg.densityNoiseScale);
      if (noiseVal < cfg.densityNoiseThreshold * 0.8) continue;
      const y = terrainHeight(x, z, cfg.lakes) + 0.02;

      const texIdx = weightedTexIdx(cfg.flowerRatios, cfg.flowerZones, x, z, flowerTexCount);

      const pts = cfg.perTexFlowerSizes && cfg.perTexFlowerSizes[texIdx];
      const minW = pts ? (pts.minW ?? 0.7) : 0.7;
      const maxW = pts ? (pts.maxW ?? 1.8) : 1.8;
      const minH = pts ? (pts.minH ?? 0.7) : 0.7;
      const maxH = pts ? (pts.maxH ?? 1.8) : 1.8;

      const bi = getBlockIndex(x, z);
      flowerBlockData[bi].push({
        x, y, z,
        rotY: rand() * Math.PI,
        sx: randRange(minW, maxW) * cfg.flowerWidthMul,
        sy: randRange(minH, maxH) * cfg.flowerHeightMul,
        texIdx
      });
    }

    const dummy = new THREE.Object3D();
    for (let bi = 0; bi < blockCount; bi++) {
      const data = flowerBlockData[bi];
      if (data.length === 0) continue;
      const byTex = Array.from({ length: flowerTexCount }, () => []);
      for (const d of data) byTex[d.texIdx].push(d);

      for (let ti = 0; ti < flowerTexCount; ti++) {
        const tdata = byTex[ti];
        if (tdata.length === 0) continue;
        const mesh = new THREE.InstancedMesh(flowerGeo, flowerMats[ti], tdata.length);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.renderOrder = 3;
        let cx = 0, cz = 0;
        for (let i = 0; i < tdata.length; i++) {
          const d = tdata[i];
          dummy.position.set(d.x, d.y, d.z);
          dummy.rotation.set(0, d.rotY, 0);
          dummy.scale.set(d.sx, d.sy, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          cx += d.x; cz += d.z;
        }
        mesh.instanceMatrix.needsUpdate = true;
        cx /= tdata.length; cz /= tdata.length;
        flowerGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 0.5, cz), blockSize * 0.75 + 1);
        mesh.frustumCulled = true;
        scene.add(mesh);
        flowerBlocks.push(mesh);
      }
    }
  }

  function disposeAll() {
    grassBlocks.forEach(m => { scene.remove(m); m.geometry.dispose(); });
    grassBlocks = [];
    flowerBlocks.forEach(m => { scene.remove(m); m.geometry.dispose(); });
    flowerBlocks = [];
    grassMats.forEach(m => m.dispose());
    grassMats = [];
    flowerMats.forEach(m => { m.dispose(); });
    flowerMats = [];
  }

  // 初始构建
  buildGrass();
  buildFlowers();

  const api = {
    updateGrass(time, characterPos = null) {
      for (const m of grassBlocks) {
        m.material.uniforms.uTime.value = time;
        if (characterPos) {
          m.material.uniforms.uCharacterPos.value.copy(characterPos);
        }
      }
    },
    setGrassColors(rA, tA, rB, tB) {
      for (const m of grassBlocks) {
        m.material.uniforms.uColorRootA.value.set(rA);
        m.material.uniforms.uColorTipA.value.set(tA);
        m.material.uniforms.uColorRootB.value.set(rB);
        m.material.uniforms.uColorTipB.value.set(tB);
      }
    },
    setRimColor(color) {
      for (const m of grassBlocks) {
        m.material.uniforms.uRimColor.value.set(color);
      }
    },
    setRimStrength(v) {
      for (const m of grassBlocks) {
        m.material.uniforms.uRimStrength.value = v;
      }
    },
    // 兼容旧接口：仅更新配置，不重建
    setTextures(texs) {
      if (!texs || texs.length === 0) return;
      cfg.textures = texs.filter(Boolean);
    },
    setFlowerTextures(texs) {
      if (!texs || texs.length === 0) return;
      cfg.flowerTextures = texs.filter(Boolean);
    },
    /**
     * 重建草地与花：传入纹理数组 + 比例 + 区域 + 尺寸，一次性生效
     * @param {Object} opts - 覆盖 cfg 的任意字段
     */
    rebuild(opts = {}) {
      Object.assign(cfg, opts);
      _seed = cfg.seed; // 重置随机种子，保证可复现
      disposeAll();
      buildGrass();
      buildFlowers();
    },
    grassBlocks,
    flowerBlocks
  };
  return api;
}
