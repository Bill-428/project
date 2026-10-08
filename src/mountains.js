// mountains.js —— 远山如黛
// 作用：在场景边缘添加多层半透明远山，山脊轮廓由噪声生成，颜色从深到浅渐变
// 东方意境核心元素：远山如黛，近水含烟
import * as THREE from 'three';

// 生成一层远山的山脊纹理（canvas程序化生成）
function createMountainLayerTexture(options = {}) {
  const {
    width = 1024,
    height = 512,
    baseColor = '#2a1f4a',
    peakColor = '#4a3a6a',
    ridgeHeight = 0.6,       // 山脊高度占比 0-1
    roughness = 3.0,          // 山脊粗糙度（频率）
    layers = 4,               // 噪声层数
    seed = 0
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  // 值噪声
  function hash(x) {
    const s = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise1D(x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    return hash(xi) * (1 - smooth(xf)) + hash(xi + 1) * smooth(xf);
  }
  function fbm1D(x, octaves) {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += amp * noise1D(x * freq);
      freq *= 2; amp *= 0.5;
    }
    return val;
  }

  // 生成山脊高度曲线
  const ridgePoints = [];
  for (let x = 0; x <= width; x++) {
    const u = x / width;
    // 多层fbm叠加，大尺度决定整体走势，小尺度决定细节
    let h = fbm1D(u * roughness + seed * 10, layers);
    // 加一些主峰（用高斯峰）
    const peakCount = 3 + Math.floor(hash(seed + 1) * 3);
    for (let p = 0; p < peakCount; p++) {
      const peakX = hash(seed * 100 + p * 17) * 0.8 + 0.1;
      const peakW = 0.05 + hash(seed * 200 + p * 23) * 0.12;
      const peakH = 0.15 + hash(seed * 300 + p * 31) * 0.3;
      const dist = Math.abs(u - peakX);
      h += Math.exp(-dist * dist / (peakW * peakW)) * peakH;
    }
    h = Math.min(1, Math.max(0, h * ridgeHeight));
    ridgePoints.push(h);
  }

  // 绘制山体（从山脊线向下填充渐变）
  const base = new THREE.Color(baseColor);
  const peak = new THREE.Color(peakColor);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `rgba(${Math.floor(peak.r * 255)},${Math.floor(peak.g * 255)},${Math.floor(peak.b * 255)},0.9)`);
  gradient.addColorStop(0.3, `rgba(${Math.floor(base.r * 255)},${Math.floor(base.g * 255)},${Math.floor(base.b * 255)},0.85)`);
  gradient.addColorStop(1, `rgba(${Math.floor(base.r * 255)},${Math.floor(base.g * 255)},${Math.floor(base.b * 255)},0.95)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x++) {
    const y = height - ridgePoints[x] * height * 0.85;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // 山脊线高光（微弱的亮边，模拟远处光线）
  ctx.strokeStyle = `rgba(${Math.floor(peak.r * 255)},${Math.floor(peak.g * 255)},${Math.floor(peak.b * 255)},0.3)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= width; x++) {
    const y = height - ridgePoints[x] * height * 0.85;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createMountains(scene, options = {}) {
  const {
    layerCount = 4,
    radius = 200,              // 远山距离中心的半径
    height = 80,               // 远山总高度
    baseOpacity = 0.7,
    colors = [
      { base: '#1a1230', peak: '#2a1f4a' },  // 最远层（最深）
      { base: '#251a3e', peak: '#3a2a5a' },
      { base: '#322550', peak: '#4a3a6a' },
      { base: '#403060', peak: '#5a4a7a' }   // 最近层（最浅）
    ]
  } = options;

  const group = new THREE.Group();
  const layers = [];

  for (let i = 0; i < layerCount; i++) {
    const colorIdx = Math.min(i, colors.length - 1);
    const col = colors[colorIdx];
    const layerRadius = radius - i * 18;  // 每层稍近
    const layerHeight = height - i * 12;   // 每层稍矮
    const opacity = baseOpacity + i * 0.07;

    const tex = createMountainLayerTexture({
      baseColor: col.base,
      peakColor: col.peak,
      ridgeHeight: 0.5 + i * 0.08,
      roughness: 2.5 + i * 0.3,
      layers: 4,
      seed: i * 7 + 3
    });

    const geo = new THREE.PlaneGeometry(layerRadius * 2.5, layerHeight, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true
    });

    // 每层山用8个平面围成环形（覆盖360度）
    const segmentCount = 8;
    for (let s = 0; s < segmentCount; s++) {
      const angle = (s / segmentCount) * Math.PI * 2;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        Math.cos(angle) * layerRadius,
        layerHeight * 0.35,
        Math.sin(angle) * layerRadius
      );
      mesh.lookAt(0, layerHeight * 0.35, 0);
      mesh.rotateY(Math.PI); // 法线朝外
      mesh.renderOrder = -10 + i; // 远的先渲染
      group.add(mesh);
    }

    layers.push({ meshes: group.children.slice(-segmentCount), material: mat, texture: tex });
  }

  scene.add(group);

  const api = {
    group,
    layers,
    update(time) {
      // 远山轻微的呼吸感（透明度微变）
      layers.forEach((layer, i) => {
        layer.material.opacity = (baseOpacity + i * 0.07) + Math.sin(time * 0.3 + i) * 0.02;
      });
    },
    setColors(newColors) {
      // 随场景氛围变化时调用，渐变远山颜色
      layers.forEach((layer, i) => {
        const col = newColors[Math.min(i, newColors.length - 1)];
        // 注意：因为纹理是canvas生成的，换色需要重新生成纹理
        // 这里只调整材质的颜色tint
        layer.material.color.set(col.base);
      });
    },
    dispose() {
      layers.forEach(layer => {
        layer.texture.dispose();
        layer.material.dispose();
      });
      scene.remove(group);
    }
  };

  return api;
}
