// reeds.js —— 芦苇（外部贴图版）
// 支持多纹理按比例生成、区域偏好、独立尺寸控制、运行时 rebuild
import * as THREE from 'three';

function createReedTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(32, 0, 32, 256);
  grad.addColorStop(0, 'rgba(28,20,48,1)');
  grad.addColorStop(0.7, 'rgba(22,16,38,1)');
  grad.addColorStop(1, 'rgba(18,12,30,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(29, 56, 6, 200);
  for (let i = 0; i < 9; i++) {
    const y = 26 + i * 13;
    const spread = 3 + i * 1.8;
    const a = 0.5 - i * 0.04;
    ctx.fillStyle = `rgba(60,40,70,${Math.max(0.08, a)})`;
    ctx.beginPath();
    ctx.ellipse(32 - spread, y, spread, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(32 + spread, y, spread, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(180,150,120,0.5)';
  ctx.beginPath();
  ctx.ellipse(32, 12, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

const reedVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vHeight;
  void main() {
    vUv = uv;
    vHeight = uv.y;
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const reedFragmentShader = `
  uniform sampler2D uMap;
  uniform vec3 uTintColor;
  uniform vec3 uRimColor;
  uniform float uRimStrength;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vHeight;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.05) discard;
    vec3 col = tex.rgb * uTintColor;
    float edgeX = 1.0 - abs(vUv.x - 0.5) * 2.0;
    float rim = pow(edgeX, 3.0);
    rim *= smoothstep(0.1, 0.8, vHeight);
    col += uRimColor * rim * uRimStrength;
    float dist = length(vWorldPos - cameraPosition);
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
    gl_FragColor = vec4(col, tex.a);
  }
`;

export function createReeds(scene, lakeShores, options = {}) {
  const cfg = {
    count: 90,
    minHeight: 2.5,
    maxHeight: 5.0,
    swayAmount: 0.12,
    swaySpeed: 1.1,
    color: 0xffffff,
    rimColor: '#9a8aff',
    rimStrength: 0.5,
    tintColor: '#ffffff',
    textures: null,
    fogColor: new THREE.Color(0x40347a),
    fogDensity: 0.011,
    characterRadius: 4.0,
    characterBendAmount: 0.8,
    seed: 20260901,
    // —— 新增：多纹理比例 ——
    reedRatios: null,        // 例 [0.6, 0.4]，null 则平均
    // —— 新增：区域偏好 ——
    // { x, z, radius, texWeights: [1.5, 0.8] }
    reedZones: [],
    // —— 新增：全局尺寸倍率 ——
    reedWidthMul: 1.0,
    reedHeightMul: 1.0,
    // —— 新增：每种纹理独立尺寸范围 ——
    // [{ minW, maxW, minH, maxH }, ...]
    perTexReedSizes: null,
  };
  Object.assign(cfg, options);

  let _seed = cfg.seed;
  const rand = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };
  const randRange = (a, b) => a + (b - a) * rand();

  const reedGeo = new THREE.PlaneGeometry(1.2, 1);
  reedGeo.translate(0, 0.5, 0);

  let reedMats = [];
  let instancedMeshes = [];
  let reeds = [];
  let meshCount = 1;

  const shorePts = [];
  for (const shore of lakeShores) {
    for (const p of shore.points) {
      shorePts.push({ x: p.x, z: p.z, cx: shore.cx, cz: shore.cz });
    }
  }

  // ===== 加权纹理索引 =====
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

  function buildReeds() {
    const activeTextures = (cfg.textures && cfg.textures.length > 0)
      ? cfg.textures.filter(Boolean)
      : [createReedTexture()];
    meshCount = activeTextures.length;

    reedMats = activeTextures.map((tex) => new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex },
        uTintColor: { value: new THREE.Color(cfg.tintColor) },
        uRimColor: { value: new THREE.Color(cfg.rimColor) },
        uRimStrength: { value: cfg.rimStrength },
        uFogColor: { value: cfg.fogColor },
        uFogDensity: { value: cfg.fogDensity }
      },
      vertexShader: reedVertexShader,
      fragmentShader: reedFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    }));

    // 按纹理分组统计数量
    const byTex = Array.from({ length: meshCount }, () => []);
    reeds = [];

    for (let i = 0; i < cfg.count; i++) {
      const pt = shorePts[Math.floor(rand() * shorePts.length)];
      const dx = pt.x - pt.cx, dz = pt.z - pt.cz;
      const len = Math.hypot(dx, dz) || 1;
      const ox = dx / len, oz = dz / len;
      const dist = 0.6 + rand() * 2.2;
      const x = pt.x + ox * dist;
      const z = pt.z + oz * dist;

      const texIdx = weightedTexIdx(cfg.reedRatios, cfg.reedZones, x, z, meshCount);

      const pts = cfg.perTexReedSizes && cfg.perTexReedSizes[texIdx];
      const minW = pts ? (pts.minW ?? 0.8) : 0.8;
      const maxW = pts ? (pts.maxW ?? 1.4) : 1.4;
      const minH = pts ? (pts.minH ?? cfg.minHeight) : cfg.minHeight;
      const maxH = pts ? (pts.maxH ?? cfg.maxHeight) : cfg.maxHeight;

      const reed = {
        x, z,
        height: randRange(minH, maxH) * cfg.reedHeightMul,
        width: randRange(minW, maxW) * cfg.reedWidthMul,
        rotationY: rand() * Math.PI,
        phase: rand() * Math.PI * 2,
        swayOffset: (rand() - 0.5) * 0.05,
        currentBend: 0,
        targetBend: 0,
        bendDir: new THREE.Vector2(),
        texIdx
      };
      reeds.push(reed);
      byTex[texIdx].push(reed);
    }

    instancedMeshes = [];
    const dummy = new THREE.Object3D();
    for (let ti = 0; ti < meshCount; ti++) {
      const tdata = byTex[ti];
      if (tdata.length === 0) continue;
      const mesh = new THREE.InstancedMesh(reedGeo, reedMats[ti], tdata.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.renderOrder = 4;
      scene.add(mesh);
      // 记录每个 reed 在其 mesh 中的 local index
      tdata.forEach((r, localIdx) => { r._localIdx = localIdx; r._meshIdx = ti; });
      instancedMeshes.push(mesh);
    }

    // 初始矩阵
    writeMatrices();
  }

  function writeMatrices() {
    const dummy = new THREE.Object3D();
    for (const r of reeds) {
      dummy.position.set(r.x, -0.28, r.z);
      dummy.rotation.set(0, r.rotationY, 0);
      dummy.scale.set(r.width, r.height, 1);
      dummy.updateMatrix();
      instancedMeshes[r._meshIdx].setMatrixAt(r._localIdx, dummy.matrix);
    }
    instancedMeshes.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  }

  function disposeAll() {
    instancedMeshes.forEach(m => scene.remove(m));
    instancedMeshes = [];
    reedMats.forEach(m => { m.uniforms.uMap.value?.dispose?.(); m.dispose(); });
    reedMats = [];
    reeds = [];
  }

  buildReeds();

  let frameCount = 0;

  const api = {
    setTextures(texs) {
      if (!texs || texs.length === 0) return;
      cfg.textures = texs.filter(Boolean);
    },
    setTintColor(hex) { reedMats.forEach(m => m.uniforms.uTintColor.value.setHex(hex)); },
    setRimColor(hex) { reedMats.forEach(m => m.uniforms.uRimColor.value.setHex(hex)); },
    setRimStrength(v) { reedMats.forEach(m => m.uniforms.uRimStrength.value = v); },
    /**
     * 重建芦苇：传入纹理数组 + 比例 + 区域 + 尺寸
     */
    rebuild(opts = {}) {
      Object.assign(cfg, opts);
      _seed = cfg.seed;
      disposeAll();
      buildReeds();
    },
    update(delta, time, characterPos = null) {
      reeds.forEach((r) => {
        r.currentSway = Math.sin(time * cfg.swaySpeed + r.phase) * cfg.swayAmount + r.swayOffset;
        if (characterPos) {
          const dx = r.x - characterPos.x;
          const dz = r.z - characterPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < cfg.characterRadius) {
            const influence = 1.0 - dist / cfg.characterRadius;
            r.targetBend = influence * cfg.characterBendAmount;
            r.bendDir.set(dx / (dist || 1), dz / (dist || 1));
          } else {
            r.targetBend = 0;
          }
        } else {
          r.targetBend = 0;
        }
        r.currentBend += (r.targetBend - r.currentBend) * Math.min(1, delta * 5);
      });
      frameCount++;
      if (frameCount % 2 === 0) {
        const dummy = new THREE.Object3D();
        for (const r of reeds) {
          const sway = r.currentSway;
          const bendX = r.bendDir.x * r.currentBend;
          const bendZ = r.bendDir.y * r.currentBend;
          dummy.position.set(r.x, 0, r.z);
          dummy.rotation.set(sway + bendZ, r.rotationY, sway * 0.3 + bendX);
          dummy.scale.set(r.width, r.height, 1);
          dummy.updateMatrix();
          instancedMeshes[r._meshIdx].setMatrixAt(r._localIdx, dummy.matrix);
        }
        instancedMeshes.forEach(m => { m.instanceMatrix.needsUpdate = true; });
      }
    },
    dispose() {
      disposeAll();
      reedGeo.dispose();
    }
  };
  return api;
}
