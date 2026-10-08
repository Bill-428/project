import * as THREE from 'three';
import { createSingleGLB } from './models.js';
import { createFollowShadow } from './blobShadow.js';

function glowTexture(inner, mid, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.35, mid); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const CONFIG = {
  characterScale: 0.85,
  characterRotationY: 0,
  characterYOffset: 0,
  lanternScale: 0.15,
  lanternPosMoving: { x: 0, y: 0.4, z: 1.6 },
  lanternPosIdle:   { x: -1.1, y: 0.7, z: 0.3 },
  lightColor: 0xffbb55,
  lightIntensity: 2.5,
  lightDistance: 14,
  lightDecay: 1.5,
  flameColor: 0xff8830,
  flameCoreColor: 0xfff8e0,
  // ===== 角色阴影参数 =====
  shadowRadius: 1.8,
  shadowOpacity: 0.55,
  shadowColor: '#000000',
};

export function createCharacter(scene) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ===== 角色跟随阴影 =====
  const followShadow = createFollowShadow({
    radius: CONFIG.shadowRadius,
    opacity: CONFIG.shadowOpacity,
    color: CONFIG.shadowColor,
    yOffset: 0.02,
  });
  scene.add(followShadow.mesh);

  const lantern = new THREE.Group();
  lantern.position.set(CONFIG.lanternPosIdle.x, CONFIG.lanternPosIdle.y, CONFIG.lanternPosIdle.z);
  body.add(lantern);

  const lanternLight = new THREE.PointLight(
    CONFIG.lightColor, CONFIG.lightIntensity, CONFIG.lightDistance, CONFIG.lightDecay
  );
  lanternLight.position.set(0, 0, 0);
  lantern.add(lanternLight);

  const flameGeo = new THREE.SphereGeometry(0.1, 16, 12);
  const flameMat = new THREE.MeshBasicMaterial({
    color: CONFIG.flameColor,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(0, 0, 0);
  lantern.add(flame);

  const flameCoreGeo = new THREE.SphereGeometry(0.05, 12, 8);
  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: CONFIG.flameCoreColor,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameCore = new THREE.Mesh(flameCoreGeo, flameCoreMat);
  flameCore.position.set(0, 0.02, 0);
  lantern.add(flameCore);

  const glowTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,220,150,1)', 'rgba(255,180,80,0)');
  const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffc76e,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.6,
  }));
  lanternGlow.position.set(0, 0, 0);
  lanternGlow.scale.set(1.8, 1.8, 1);
  lantern.add(lanternGlow);

  const auraTex = glowTexture('rgba(255,255,255,1)', 'rgba(200,170,255,1)', 'rgba(140,110,255,0)');
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: auraTex,
    color: 0x9a88ff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.25,
  }));
  aura.position.set(0, 1.2, 0);
  aura.scale.set(5.0, 5.0, 1);
  body.add(aura);

  const TRAIL_LENGTH = 30;
  const trailPositions = [];
  const trailGeo = new THREE.BufferGeometry();
  const trailVertices = new Float32Array(TRAIL_LENGTH * 2 * 3);
  const trailUvs = new Float32Array(TRAIL_LENGTH * 2 * 2);
  const trailIndices = [];
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    trailUvs[i * 4] = 0; trailUvs[i * 4 + 1] = i / TRAIL_LENGTH;
    trailUvs[i * 4 + 2] = 1; trailUvs[i * 4 + 3] = i / TRAIL_LENGTH;
    if (i < TRAIL_LENGTH - 1) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      trailIndices.push(a, c, b, b, c, d);
    }
  }
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailVertices, 3));
  trailGeo.setAttribute('uv', new THREE.BufferAttribute(trailUvs, 2));
  trailGeo.setIndex(trailIndices);
  const trailMat = new THREE.MeshBasicMaterial({
    color: 0xc8b8ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const trailMesh = new THREE.Mesh(trailGeo, trailMat);
  trailMesh.frustumCulled = false;
  scene.add(trailMesh);
  scene.add(root);

  const damp = (v, target, lambda, dt) => THREE.MathUtils.damp(v, target, lambda, dt);
  const _lanternWorld = new THREE.Vector3();
  let growthLevel = 0;
  let isMoving = false;
  let trailActive = false;

  const loaded = (async () => {
    const characterModel = await createSingleGLB('/character.glb', new THREE.Vector3(0, 0, 0), {
      scale: CONFIG.characterScale,
      castShadow: false,
      receiveShadow: false,
    });
    const charBox = new THREE.Box3().setFromObject(characterModel);
    characterModel.position.y -= charBox.min.y;
    characterModel.position.y += CONFIG.characterYOffset;
    characterModel.rotation.y = CONFIG.characterRotationY;
    body.add(characterModel);

    const lanternModel = await createSingleGLB('/lantern.glb', new THREE.Vector3(0, 0, 0), {
      scale: CONFIG.lanternScale,
      castShadow: false,
      receiveShadow: false,
    });
    const lanternBox = new THREE.Box3().setFromObject(lanternModel);
    const lanternCenter = lanternBox.getCenter(new THREE.Vector3());
    lanternModel.position.sub(lanternCenter);
    lantern.add(lanternModel);

    lanternModel.renderOrder = 0;
    flame.renderOrder = 1;
    flameCore.renderOrder = 2;
    lanternGlow.renderOrder = 3;
    characterModel.traverse(c => {
        if (c.isMesh && c.material) {
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            mats.forEach(m => {
                for (const key in m) {
                    if (m[key] === undefined && key.toLowerCase().includes('map')) {
                        console.warn('[character bad-material]', c.name || c.type, m.type, key);
                        m[key] = null;
                        m.needsUpdate = true;
                    }
                }
            });
        }
    });
    lanternModel.traverse(c => {
        if (c.isMesh && c.material) {
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            mats.forEach(m => {
                for (const key in m) {
                    if (m[key] === undefined && key.toLowerCase().includes('map')) {
                        console.warn('[lantern bad-material]', c.name || c.type, m.type, key);
                        m[key] = null;
                        m.needsUpdate = true;
                    }
                }
            });
        }
    });
    console.log('[character] FBX 模型加载完成');
  })();

  function update(delta, time, anim = {}) {
    const moving = !!anim.moving;
    isMoving = moving;
    const t = time;

    body.position.y = Math.sin(t * 1.1) * 0.15 + (moving ? Math.sin(t * 3.0) * 0.04 : 0);
    body.rotation.z = Math.sin(t * 0.8) * 0.04;
    body.rotation.x = Math.sin(t * 0.6) * 0.02 + (moving ? 0.05 : 0);

    const targetPos = moving ? CONFIG.lanternPosMoving : CONFIG.lanternPosIdle;
    lantern.position.x = damp(lantern.position.x, targetPos.x, 3, delta);
    lantern.position.y = damp(lantern.position.y, targetPos.y, 3, delta);
    lantern.position.z = damp(lantern.position.z, targetPos.z, 3, delta);

    lantern.rotation.z = Math.sin(t * 2.4) * 0.09 + (moving ? 0 : 0.15);
    lantern.rotation.x = moving ? 0.04 : -0.1;

    const flicker = 1
      + Math.sin(t * 5) * 0.15
      + Math.sin(t * 11) * 0.08
      + Math.sin(t * 17) * 0.05;
    flame.scale.setScalar(flicker);
    flameCore.scale.setScalar(0.85 + flicker * 0.25);
    flameMat.opacity = 0.75 + Math.sin(t * 7) * 0.15;
    flameCoreMat.opacity = 0.85 + Math.sin(t * 9) * 0.1;

    const gs = 0.95 + Math.sin(t * 4.0) * 0.12;
    lanternGlow.scale.set(gs * 1.8, gs * 1.8, 1);
    lanternGlow.material.opacity = (0.55 + Math.sin(t * 4.0) * 0.12) * (1 + growthLevel * 0.6);

    lanternLight.intensity = (CONFIG.lightIntensity + Math.sin(t * 4) * 0.3 + Math.sin(t * 13) * 0.15) * (1 + growthLevel * 1.5);
    lanternLight.distance = CONFIG.lightDistance + growthLevel * 8;

    const auraScale = 5.0 + growthLevel * 4.0;
    aura.scale.set(auraScale, auraScale, 1);
    aura.material.opacity = (0.22 + Math.sin(t * 1.8) * 0.06) * (1 + growthLevel * 0.8);

    // ===== 跟随阴影更新 =====
    const groundY = 0;
    const heightAbove = Math.max(0, root.position.y - groundY);
    const maxJumpH = 5;
    const hFactor = Math.max(0.15, 1 - heightAbove / maxJumpH);
    followShadow.update(root.position, groundY, hFactor, hFactor * hFactor);

    if (moving) {
      trailActive = true;
      const trailPos = root.position.clone();
      trailPos.y += 1.0;
      trailPositions.unshift(trailPos);
      if (trailPositions.length > TRAIL_LENGTH) trailPositions.pop();
      if (trailPositions.length >= 2) {
        const posAttr = trailGeo.attributes.position;
        for (let i = 0; i < TRAIL_LENGTH; i++) {
          if (i < trailPositions.length) {
            const p = trailPositions[i];
            let tangent;
            if (i < trailPositions.length - 1) {
              tangent = new THREE.Vector3().subVectors(trailPositions[i], trailPositions[i + 1]).normalize();
            } else {
              tangent = new THREE.Vector3(0, 0, 1);
            }
            const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            const width = (1 - i / TRAIL_LENGTH) * 0.4;
            posAttr.array[i * 6]     = p.x + side.x * width;
            posAttr.array[i * 6 + 1] = p.y;
            posAttr.array[i * 6 + 2] = p.z + side.z * width;
            posAttr.array[i * 6 + 3] = p.x - side.x * width;
            posAttr.array[i * 6 + 4] = p.y;
            posAttr.array[i * 6 + 5] = p.z - side.z * width;
          }
        }
        posAttr.needsUpdate = true;
        trailMat.opacity = 0.35 * (1 + growthLevel * 0.5);
      }
    } else {
      if (trailActive) {
        trailMat.opacity *= 0.95;
        if (trailMat.opacity < 0.01) {
          trailActive = false;
          trailPositions.length = 0;
        }
      }
    }
  }

  function triggerBlink() {}
  function triggerWideEyes(duration = 0.5) {}

  return {
    get position() { return root.position; },
    get rotation() { return root.rotation; },
    get radius() { return 1.0; },
    getLanternWorldPosition(target = new THREE.Vector3()) {
      lantern.getWorldPosition(_lanternWorld);
      target.copy(_lanternWorld);
      return target;
    },
    update,
    group: root,
    setGrowthLevel(level) {
      growthLevel = Math.max(0, Math.min(1, level));
    },
    getGrowthLevel() { return growthLevel; },
    triggerBlink,
    triggerWideEyes,
    aura, lanternLight, trailMesh,
    lantern,
    shadow: followShadow,
    loaded,
  };
}
