// skyLanterns.js —— 孔明灯（记忆放飞）
// 作用：每完成一组碎片拼合，升起3-5盏孔明灯，最终融入天空变成星星
// 五幕结束时，整个夜空被点亮——"黑暗退散，光已归来"
import * as THREE from 'three';
import { createGlowTexture } from './proceduralTextures.js';

export function createSkyLanterns(scene, options = {}) {
  const {
    maxLanterns = 25,
    riseSpeed = 1.5,
    driftAmount = 8,
    lanternScale = 0.8,
    baseHeight = 10,
    targetHeight = 120,
    color = 0xffbb55
  } = options;

  const group = new THREE.Group();
  scene.add(group);

  const lanterns = [];
  const glowTex = createGlowTexture(
    'rgba(255,255,220,1)',
    'rgba(255,180,80,0.7)',
    'rgba(255,120,30,0)'
  );

  // 创建一盏孔明灯
  function createLantern() {
    const lanternGroup = new THREE.Group();

    // 灯身（圆柱，半透明暖色）
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.8, 12, 1, true);
    const bodyMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    lanternGroup.add(body);

    // 顶部和底部环
    const topRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.03, 6, 12),
      new THREE.MeshBasicMaterial({ color: 0x885522, transparent: true, opacity: 0.6 })
    );
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = 0.4;
    lanternGroup.add(topRing);

    const bottomRing = topRing.clone();
    bottomRing.position.y = -0.4;
    lanternGroup.add(bottomRing);

    // 内部火焰发光
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffee88,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    lanternGroup.add(flame);

    // 光晕
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: color,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    glow.scale.set(3, 3, 1);
    lanternGroup.add(glow);


    return {
      group: lanternGroup,
      body, flame, glow,
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      phase: 'rising' // rising → drifting → star
    };
  }

  // 释放一批孔明灯
  function release(count = 3, originX = 0, originZ = 0) {
    for (let i = 0; i < count; i++) {
      if (lanterns.length >= maxLanterns) {
        // 替换最老的一盏
        const oldest = lanterns.shift();
        group.remove(oldest.group);
      }
      const lantern = createLantern();
      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * 6;
      lantern.group.position.set(
        originX + Math.cos(angle) * dist,
        baseHeight + Math.random() * 3,
        originZ + Math.sin(angle) * dist
      );
      lantern.group.scale.setScalar(lanternScale * (0.8 + Math.random() * 0.4));
      lantern.velocity.set(
        (Math.random() - 0.5) * 0.3,
        riseSpeed * (0.8 + Math.random() * 0.4),
        (Math.random() - 0.5) * 0.3
      );
      lantern.maxLife = 30 + Math.random() * 20;
      lantern.life = 0;
      group.add(lantern.group);
      lanterns.push(lantern);
    }
  }

  function update(delta, time) {
    for (let i = lanterns.length - 1; i >= 0; i--) {
      const l = lanterns[i];
      l.life += delta;

      if (l.phase === 'rising') {
        // 上升阶段
        l.group.position.addScaledVector(l.velocity, delta);
        // 水平漂移
        l.group.position.x += Math.sin(time * 0.5 + i) * 0.01;
        l.group.position.z += Math.cos(time * 0.4 + i * 1.3) * 0.01;
        // 火焰闪烁
        const flicker = 0.8 + Math.sin(time * 8 + i * 2) * 0.15 + Math.sin(time * 13 + i) * 0.08;
        l.flame.scale.setScalar(flicker);
        l.glow.material.opacity = 0.5 + Math.sin(time * 4 + i) * 0.15;


        // 到达目标高度后转为星星
        if (l.group.position.y > targetHeight || l.life > l.maxLife * 0.6) {
          l.phase = 'star';
        }
      } else if (l.phase === 'star') {
        // 星星阶段：固定在天空，微弱闪烁
        l.group.position.y += 0.05; // 继续缓慢上升
        const twinkle = 0.5 + Math.sin(time * 1.5 + i * 3) * 0.3 + Math.sin(time * 3.7 + i) * 0.2;
        l.glow.material.opacity = twinkle * 0.8;
        l.body.material.opacity = twinkle * 0.4;
        l.flame.visible = false;

        // 缩小成星点
        const targetScale = lanternScale * 0.3;
        l.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 0.5);
      }

      // 超过最大生命后移除（但保留星星）
      if (l.life > l.maxLife && l.phase !== 'star') {
        group.remove(l.group);
        lanterns.splice(i, 1);
      }
    }
  }

  // 获取当前孔明灯/星星数量
  function getCount() {
    return lanterns.length;
  }

  // 清空
  function clear() {
    lanterns.forEach(l => group.remove(l.group));
    lanterns.length = 0;
  }

  return {
    group,
    release,
    update,
    getCount,
    clear
  };
}
