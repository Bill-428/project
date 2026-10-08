// cutscene.js —— 过场动画管理器（统一字体配置版）
import * as THREE from 'three';
import { FONT_CONFIG } from './fontConfig.js';

const CS = FONT_CONFIG.cutscene;
const FF = FONT_CONFIG.fontFamily;

function createTextSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);

  ctx.fillStyle = CS.fillColor;
  ctx.font = `${CS.fontWeight} ${CS.fontSize}px ${FF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.strokeStyle = CS.strokeColor;
  ctx.lineWidth = CS.strokeWidth;

  ctx.shadowColor = CS.shadowColor;
  ctx.shadowBlur = CS.shadowBlur;

  const lines = text.split('\n');
  const lineHeight = CS.lineHeight;
  const startY = 128 - (lines.length - 1) * lineHeight / 2;
  lines.forEach((line, i) => {
    ctx.strokeText(line, 512, startY + i * lineHeight);
    ctx.fillText(line, 512, startY + i * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(CS.spriteWidth, CS.spriteHeight, 1);
  sprite.renderOrder = 999;
  return sprite;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export function createCutscene(scene, camera, character, options = {}) {
  const { onIntroComplete, onEndingComplete } = options;

  const introShots = [
    { duration: 3.5, camFrom: new THREE.Vector3(0, 90, 70), camTo: new THREE.Vector3(0, 55, 45), lookAt: new THREE.Vector3(0, 0, 0), text: '每个人的心里，\n都有一片湖。', textPos: new THREE.Vector3(0, 0.5, -8) },
    { duration: 3.5, camFrom: new THREE.Vector3(0, 40, 35), camTo: new THREE.Vector3(0, 18, 18), lookAt: new THREE.Vector3(0, 0, -5), text: '湖面上散落着记忆的碎片，\n被遗忘，被尘封。', textPos: new THREE.Vector3(0, 0.5, -12) },
    { duration: 3.5, camFrom: new THREE.Vector3(10, 6, 10), camTo: new THREE.Vector3(5, 4.5, 6), lookAt: new THREE.Vector3(0, 2.5, 0), text: '一盏灯灵在湖畔醒来，\n它的光，微弱却温暖。', textPos: new THREE.Vector3(0, 0.5, -6) },
    { duration: 3.5, camFrom: new THREE.Vector3(5, 4.5, 6), camTo: new THREE.Vector3(0, 22, 20), lookAt: new THREE.Vector3(0, 2.2, 0), text: '收集碎片，点亮记忆，\n也点亮自己。', textPos: new THREE.Vector3(0, 0.5, -10) }
  ];

  const endingShots = [
    { duration: 4.5, camFrom: new THREE.Vector3(0, 8, 14), camTo: new THREE.Vector3(0, 24, 28), lookAt: new THREE.Vector3(0, 2, 0), text: '你拾起了每一片碎片，\n也重新拥抱了完整的自己。', textPos: new THREE.Vector3(0, 0.5, -8) },
    { duration: 4, camFrom: new THREE.Vector3(0, 24, 28), camTo: new THREE.Vector3(0, 38, 8), lookAt: new THREE.Vector3(0, 2, 0), text: '黑暗退散，光已归来。', textPos: new THREE.Vector3(0, 0.5, -6) },
    { duration: 4, camFrom: new THREE.Vector3(0, 38, 8), camTo: new THREE.Vector3(0, 52, -4), lookAt: new THREE.Vector3(0, 1, 0), text: '—— 终 ——', textPos: new THREE.Vector3(0, 0.5, -4) }
  ];

  const FADE_TIME = 0.8;
  let mode = 'idle';
  let elapsed = 0;
  let currentShotIndex = -1;
  let textSprite = null;
  let shots = introShots;
  let shotStartTimes = [];
  let totalDuration = 0;

  function buildTimeline(s) {
    shots = s;
    shotStartTimes = [];
    let acc = 0;
    for (const sh of s) { shotStartTimes.push(acc); acc += sh.duration; }
    totalDuration = acc;
  }

  buildTimeline(introShots);

  function getShotIndexAt(time) {
    for (let i = shots.length - 1; i >= 0; i--) {
      if (time >= shotStartTimes[i]) return i;
    }
    return 0;
  }

  function updateText(text, position) {
    if (textSprite) {
      scene.remove(textSprite);
      textSprite.material.map?.dispose();
      textSprite.material.dispose();
    }
    textSprite = createTextSprite(text);
    textSprite.position.copy(position);
    textSprite.scale.set(0.1, 0.025, 1);
    scene.add(textSprite);
  }

  function start() {
    mode = 'intro';
    elapsed = 0;
    currentShotIndex = -1;
    buildTimeline(introShots);
    camera.position.copy(introShots[0].camFrom);
    camera.lookAt(introShots[0].lookAt);
  }

  function startEnding() {
    mode = 'ending';
    elapsed = 0;
    currentShotIndex = -1;
    buildTimeline(endingShots);
    camera.position.copy(endingShots[0].camFrom);
    camera.lookAt(endingShots[0].lookAt);
  }

  function update(delta) {
    if (mode === 'idle') return;
    elapsed += delta;
    if (elapsed >= totalDuration) {
      const finished = mode;
      mode = 'idle';
      if (textSprite) textSprite.material.opacity = 0;
      if (finished === 'intro') onIntroComplete?.();
      else onEndingComplete?.();
      return;
    }
    const idx = getShotIndexAt(elapsed);
    const shot = shots[idx];
    const shotTime = elapsed - shotStartTimes[idx];
    const t = Math.min(1, shotTime / shot.duration);
    const eased = smoothstep(t);

    if (idx !== currentShotIndex) {
      currentShotIndex = idx;
      updateText(shot.text, shot.textPos);
    }

    camera.position.lerpVectors(shot.camFrom, shot.camTo, eased);
    camera.lookAt(shot.lookAt);

    if (textSprite) {
      const riseT = Math.min(1, shotTime / (shot.duration * 0.4));
      const riseEased = smoothstep(riseT);
      textSprite.position.y = shot.textPos.y + riseEased * CS.riseHeight;
      const scale = 0.1 + riseEased * (CS.spriteWidth - 0.1);
      textSprite.scale.set(scale, scale * (CS.spriteHeight / CS.spriteWidth), 1);
      let opacity = 1;
      if (shotTime < FADE_TIME) opacity = shotTime / FADE_TIME;
      else if (shotTime > shot.duration - FADE_TIME) opacity = (shot.duration - shotTime) / FADE_TIME;
      opacity = Math.max(0, Math.min(1, opacity));
      textSprite.material.opacity = opacity * 0.95;
    }
  }

  function dispose() {
    mode = 'idle';
    if (textSprite) {
      scene.remove(textSprite);
      textSprite.material.map?.dispose();
      textSprite.material.dispose();
      textSprite = null;
    }
  }

  return {
    start,
    startEnding,
    update,
    dispose,
    isActive: () => mode !== 'idle',
    isEnding: () => mode === 'ending'
  };
}
