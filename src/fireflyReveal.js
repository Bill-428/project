// fireflyReveal.js —— 萤火虫汇聚显现角色和灯
// 过场镜头移动的同时，萤火虫从远处缓慢汇聚，爆闪后角色与灯模型渐显
import * as THREE from 'three';

function getGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,240,180,1)');
  g.addColorStop(0.5, 'rgba(255,200,80,0.8)');
  g.addColorStop(0.8, 'rgba(200,150,50,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

const vertexShader = `
  attribute float aOpacity;
  attribute float aScale;
  attribute vec3 aColor;
  varying float vOpacity;
  varying vec3 vColor;
  varying vec2 vUv;
  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    vUv = uv;
    vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 scl = vec3(
      length(instanceMatrix[0].xyz),
      length(instanceMatrix[1].xyz),
      length(instanceMatrix[2].xyz)
    );
    vec3 toCam = cameraPosition - instPos.xyz;
    float camLen = length(toCam);
    vec3 camDir = camLen > 0.001 ? toCam / camLen : vec3(0.0, 0.0, 1.0);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), camDir));
    vec3 up = cross(camDir, right);
    vec3 worldPos = instPos.xyz + right * position.x * scl.x * aScale + up * position.y * scl.y * aScale;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uMap;
  varying float vOpacity;
  varying vec3 vColor;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.01) discard;
    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vOpacity);
  }
`;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function createFireflyReveal(scene, character, options = {}) {
  const count          = options.count          || 100;
  const gatherDuration = options.gatherDuration || 2.4;
  const flashDuration  = options.flashDuration  || 0.5;
  const revealDuration = options.revealDuration || 0.8;
  const startRadiusMin = options.startRadiusMin || 10;
  const startRadiusMax = options.startRadiusMax || 22;
  const travelTimeMin  = options.travelTimeMin  || 1.4;
  const travelTimeMax  = options.travelTimeMax  || 2.2;
  const wobbleAmpMin   = options.wobbleAmpMin   || 1.5;
  const wobbleAmpMax   = options.wobbleAmpMax   || 4.0;
  const delayMax       = options.delayMax       || 0.7;
  const totalDuration  = gatherDuration + flashDuration + revealDuration;

  const glowTex = getGlowTexture();
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: glowTex } },
    vertexShader, fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.visible = false;
  scene.add(mesh);

  const opacities = new Float32Array(count);
  const scales    = new Float32Array(count);
  const colors    = new Float32Array(count * 3);
  const opacityAttr = new THREE.InstancedBufferAttribute(opacities, 1);
  const scaleAttr   = new THREE.InstancedBufferAttribute(scales, 1);
  const colorAttr   = new THREE.InstancedBufferAttribute(colors, 3);
  mesh.geometry.setAttribute('aOpacity', opacityAttr);
  mesh.geometry.setAttribute('aScale',   scaleAttr);
  mesh.geometry.setAttribute('aColor',   colorAttr);

  const fireflies = [];
  const colorWarm = new THREE.Color(0xffd88a);
  const colorCool = new THREE.Color(0xa8d0ff);
  const colorGold = new THREE.Color(0xffbb55);

  const gatherCenter = new THREE.Vector3();
  const _dummy = new THREE.Object3D();
  let active = false;
  let elapsed = 0;
  let onCompleteCallback = null;
  let characterHidden = false;

  function initFireflies() {
    gatherCenter.copy(character.position);
    gatherCenter.y += 1.8;

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const radius = startRadiusMin + Math.random() * (startRadiusMax - startRadiusMin);
      const startX = gatherCenter.x + radius * Math.sin(phi) * Math.cos(theta);
      const startY = Math.max(0.5, gatherCenter.y + radius * Math.cos(phi) * 0.6 + Math.random() * 3);
      const startZ = gatherCenter.z + radius * Math.sin(phi) * Math.sin(theta);

      const targetOffset = new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 2.5,
        (Math.random() - 0.5) * 1.2
      );

      let col;
      const r = Math.random();
      if (r < 0.7)      col = colorWarm;
      else if (r < 0.9) col = colorGold;
      else               col = colorCool;

      fireflies.push({
        start: new THREE.Vector3(startX, startY, startZ),
        target: targetOffset,
        delay: Math.random() * delayMax,
        travelTime: travelTimeMin + Math.random() * (travelTimeMax - travelTimeMin),
        wobbleAmp: wobbleAmpMin + Math.random() * (wobbleAmpMax - wobbleAmpMin),
        wobbleFreq: 1.5 + Math.random() * 2.0,
        wobblePhase: Math.random() * Math.PI * 2,
        sizeBase: 0.4 + Math.random() * 0.8,
        color: col.clone(),
        x: 0, y: 0, z: 0
      });

      colors[i * 3]     = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    colorAttr.needsUpdate = true;
  }

  function hideCharacter() {
    if (characterHidden) return;
    character.group.traverse(obj => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (m.userData._baseOpacity === undefined) {
            m.userData._baseOpacity = m.opacity !== undefined ? m.opacity : 1;
          }
          m.transparent = true;
          m.opacity = 0;
        });
      }
    });
    if (character.aura)         character.aura.material.opacity = 0;
    if (character.lanternLight)  character.lanternLight.intensity = 0;
    if (character.shadow)       character.shadow.mesh.visible = false;
    if (character.trailMesh)    character.trailMesh.visible = false;
    characterHidden = true;
  }

  function setCharacterOpacity(opacity) {
    character.group.traverse(obj => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          const base = m.userData._baseOpacity !== undefined ? m.userData._baseOpacity : 1;
          m.opacity = base * opacity;
        });
      }
    });
    if (character.aura)         character.aura.material.opacity = 0.25 * opacity;
    if (character.lanternLight)  character.lanternLight.intensity = 2.5 * opacity;
    if (character.shadow)       { character.shadow.mesh.visible = opacity > 0.01; character.shadow.mesh.material.opacity = 0.55 * opacity; }
  }

  function start(onComplete) {
    onCompleteCallback = onComplete;
    character.loaded.then(() => {
      hideCharacter();
      initFireflies();
      active = true;
      elapsed = 0;
      mesh.visible = true;
    });
  }

  function update(delta, time) {
    if (!active) return;
    elapsed += delta;

    const flashT  = Math.min(1, Math.max(0, (elapsed - gatherDuration) / flashDuration));
    const revealT = Math.min(1, Math.max(0, (elapsed - gatherDuration - flashDuration) / revealDuration));

    const flashIntensity = flashT > 0
      ? (flashT < 0.4 ? flashT / 0.4 : 1 - (flashT - 0.4) / 0.6)
      : 0;

    for (let i = 0; i < count; i++) {
      const f = fireflies[i];
      const localTime = elapsed - f.delay;

      let px, py, pz, opacity, scale;

      if (localTime <= 0) {
        px = f.start.x; py = f.start.y; pz = f.start.z;
        const flicker = 0.3 + 0.3 * Math.sin(time * 3 + f.wobblePhase);
        opacity = 0.15 * flicker;
        scale = f.sizeBase * 0.5;
      } else if (localTime < f.travelTime) {
        const t = localTime / f.travelTime;
        const eased = easeInOutCubic(t);

        const tx = gatherCenter.x + f.target.x;
        const ty = gatherCenter.y + f.target.y;
        const tz = gatherCenter.z + f.target.z;

        px = f.start.x + (tx - f.start.x) * eased;
        py = f.start.y + (ty - f.start.y) * eased;
        pz = f.start.z + (tz - f.start.z) * eased;

        const wobbleDecay = 1 - eased;
        px += Math.sin(localTime * f.wobbleFreq + f.wobblePhase) * f.wobbleAmp * wobbleDecay;
        py += Math.cos(localTime * f.wobbleFreq * 0.7 + f.wobblePhase) * f.wobbleAmp * 0.5 * wobbleDecay;
        pz += Math.sin(localTime * f.wobbleFreq * 1.3 + f.wobblePhase * 1.5) * f.wobbleAmp * wobbleDecay;

        const fadeIn = Math.min(1, localTime / 0.5);
        const flicker = 0.7 + 0.3 * Math.sin(localTime * 6 + f.wobblePhase);
        opacity = fadeIn * flicker;
        scale = f.sizeBase * (0.6 + eased * 0.6);
      } else {
        const tx = gatherCenter.x + f.target.x;
        const ty = gatherCenter.y + f.target.y;
        const tz = gatherCenter.z + f.target.z;

        const jitter  = 0.15 * Math.sin(time * 6 + f.wobblePhase);
        const jitterY = 0.1  * Math.cos(time * 5 + f.wobblePhase * 1.2);

        px = tx + jitter;
        py = ty + jitterY;
        pz = tz + jitter * 0.7;

        let baseOpacity = 0.85;
        if (flashIntensity > 0) baseOpacity = 0.85 + flashIntensity * 1.5;
        if (revealT > 0)         baseOpacity *= (1 - revealT);
        const flicker = 0.75 + 0.25 * Math.sin(time * 10 + f.wobblePhase);
        opacity = Math.min(1.5, baseOpacity * flicker);
        scale = f.sizeBase * (1.0 + flashIntensity * 0.8) * (1 - revealT * 0.3);
      }

      f.x = px; f.y = py; f.z = pz;
      _dummy.position.set(px, py, pz);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      opacities[i] = Math.min(1.5, opacity);
      scales[i]    = scale;
    }

    mesh.instanceMatrix.needsUpdate = true;
    opacityAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;

    if (revealT > 0) {
      setCharacterOpacity(easeOutCubic(revealT));
    }

    if (elapsed >= totalDuration) {
      active = false;
      mesh.visible = false;
      setCharacterOpacity(1);
      characterHidden = false;
      const cb = onCompleteCallback;
      onCompleteCallback = null;
      cb?.();
    }
  }

  function reset() {
    active = false;
    elapsed = 0;
    mesh.visible = false;
    fireflies.length = 0;
    onCompleteCallback = null;
    if (characterHidden) {
      setCharacterOpacity(1);
      characterHidden = false;
    }
  }

  function dispose() {
    scene.remove(mesh);
    geo.dispose();
    mat.dispose();
    glowTex.dispose();
    fireflies.length = 0;
  }

  return {
    start, update, reset, dispose,
    isActive: () => active
  };
}
