// proceduralTextures.js —— 程序化纹理生成
// 【外部美术迭代点】
//   createGoldFoilTexture()  → 后续替换为真实金箔扫描无缝贴图
//   createInkPaperTexture()  → 后续替换为真实宣纸/水墨纸扫描图
//   替换时只需改函数内部返回值，所有调用方无需改动。
import * as THREE from 'three';

// ========== 工具：值噪声 / FBM ==========
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, y, octaves = 5) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise(x * freq, y * freq);
    freq *= 2; amp *= 0.5;
  }
  return val;
}

// ========== 金箔纹理 ==========
// 模拟金箔的斑驳反光：底色金 + 不规则亮斑/暗斑 + 细微裂纹
// 【外部美术迭代点】替换为真实金箔扫描无缝贴图时，直接 return new THREE.TextureLoader().load('path/to/goldfoil.jpg')
export function createGoldFoilTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // 大尺度斑驳
      const blotch = fbm(u * 4, v * 4, 4);
      // 中尺度褶皱
      const wrinkle = fbm(u * 12 + 5.3, v * 12 + 1.7, 4);
      // 细微颗粒
      const grain = fbm(u * 40, v * 40, 3);
      // 裂纹（用阈值化噪声）
      const crackRaw = fbm(u * 8 + 10, v * 8 + 20, 5);
      const crack = Math.pow(Math.max(0, crackRaw - 0.55) * 3, 2);

      // 金色基底
      let r = 218, g = 178, b = 92;
      // 斑驳提亮/压暗
      const blotchMod = (blotch - 0.5) * 0.6;
      r += blotchMod * 60; g += blotchMod * 50; b += blotchMod * 30;
      // 褶皱高光
      const wrinkleHi = Math.max(0, wrinkle - 0.5) * 1.5;
      r += wrinkleHi * 50; g += wrinkleHi * 40; b += wrinkleHi * 20;
      // 颗粒
      r += (grain - 0.5) * 18; g += (grain - 0.5) * 15; b += (grain - 0.5) * 10;
      // 裂纹压暗
      r -= crack * 80; g -= crack * 70; b -= crack * 50;

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ========== 水墨 / 宣纸纹理 ==========
// 模拟宣纸的纤维感 + 淡墨晕染斑块
// 【外部美术迭代点】替换为真实宣纸扫描图时，直接 return new THREE.TextureLoader().load('path/to/xuanpaper.jpg')
export function createInkPaperTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // 纤维（高频细噪声）
      const fiber = fbm(u * 60, v * 60, 3);
      // 淡墨晕染（大尺度低频）
      const inkWash = fbm(u * 3 + 2, v * 3 + 8, 5);
      // 墨点
      const inkDotRaw = fbm(u * 15 + 20, v * 15 + 30, 4);
      const inkDot = Math.pow(Math.max(0, inkDotRaw - 0.6) * 2.5, 1.5);

      // 宣纸底色（偏暖的米白）
      let r = 238, g = 232, b = 218;
      // 纤维纹理
      r += (fiber - 0.5) * 14; g += (fiber - 0.5) * 12; b += (fiber - 0.5) * 10;
      // 淡墨晕染（偏冷灰）
      const washMod = inkWash * 0.35;
      r -= washMod * 50; g -= washMod * 52; b -= washMod * 55;
      // 墨点
      r -= inkDot * 90; g -= inkDot * 92; b -= inkDot * 95;

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ========== 径向光晕纹理（通用） ==========
export function createGlowTexture(innerColor = 'rgba(255,255,255,1)', midColor = 'rgba(255,220,150,0.6)', outerColor = 'rgba(255,180,80,0)', size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, innerColor);
  g.addColorStop(0.35, midColor);
  g.addColorStop(1, outerColor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ========== 墨滴扩散纹理（用于开场动画和拼合仪式地面墨晕） ==========
export function createInkDropTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const cx = size / 2, cy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / (size / 2);
      const dy = (y - cy) / (size / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 不规则边缘（噪声扰动半径）
      const angle = Math.atan2(dy, dx);
      const edgeNoise = fbm(Math.cos(angle) * 3 + 5, Math.sin(angle) * 3 + 5, 3) * 0.15;
      const irregularDist = dist - edgeNoise;
      // 墨晕：中心实，边缘扩散，带不规则渗透
      let alpha = 0;
      if (irregularDist < 0.3) {
        alpha = 1.0;
      } else if (irregularDist < 0.7) {
        const t = (irregularDist - 0.3) / 0.4;
        alpha = 1.0 - t * t * (3 - 2 * t);
        // 渗透纹理
        const seep = fbm(dx * 8 + angle, dy * 8 + angle, 3);
        alpha *= 0.7 + seep * 0.5;
      } else if (irregularDist < 1.0) {
        const t = (irregularDist - 0.7) / 0.3;
        alpha = (1 - t) * 0.3;
        const seep = fbm(dx * 12, dy * 12, 3);
        alpha *= seep * 1.5;
      }
      alpha = Math.max(0, Math.min(1, alpha));
      const idx = (y * size + x) * 4;
      data[idx] = 20; data[idx + 1] = 15; data[idx + 2] = 35;
      data[idx + 3] = Math.floor(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}
