// inkDropIntro.js —— 开场墨滴入水动画
// 作用：一滴金色墨水滴入黑暗水面，扩散成涟漪，涟漪中浮现场景
// 确立"水墨×金箔"的艺术基调
import * as THREE from 'three';

const inkDropVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const inkDropFragmentShader = `
  uniform float uTime;
  uniform float uProgress; // 0=完全墨黑, 1=完全透出现场
  uniform vec3 uInkColor;
  uniform vec3 uGoldColor;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // 墨滴扩散半径（随时间增大）
    float dropRadius = uProgress * 1.2;
    // 涟漪：多层环形
    float ripple1 = sin(dist * 40.0 - uTime * 8.0) * 0.5 + 0.5;
    float ripple2 = sin(dist * 25.0 - uTime * 5.0 + 1.0) * 0.5 + 0.5;
    float ripples = (ripple1 * 0.6 + ripple2 * 0.4);

    // 墨晕：中心金色，边缘深色，不规则边缘
    float inkEdge = smoothstep(dropRadius, dropRadius + 0.15 + fbm(uv * 8.0 + uTime) * 0.1, dist);
    float inkCenter = 1.0 - smoothstep(0.0, dropRadius * 0.5, dist);

    // 墨色：深紫黑
    vec3 inkDark = vec3(0.05, 0.03, 0.12);
    // 金色墨晕
    vec3 goldWarm = uGoldColor;
    // 混合：中心金色，向外过渡到深墨
    vec3 inkColor = mix(goldWarm, inkDark, smoothstep(0.0, dropRadius * 0.7, dist));
    // 涟漪处金色高光
    inkColor += goldWarm * ripples * 0.15 * (1.0 - inkEdge);

    // 透明度：墨滴区域不透明，外部透明（透出现场）
    float inkAlpha = 1.0 - inkEdge;
    // 开始时全屏墨黑
    inkAlpha = max(inkAlpha, 1.0 - smoothstep(0.0, 0.1, uProgress));
    // 结束时完全透明
    inkAlpha *= 1.0 - smoothstep(0.85, 1.0, uProgress);

    // 纸张纹理叠加
    float paperNoise = fbm(uv * 30.0);
    inkColor += (paperNoise - 0.5) * 0.05;

    gl_FragColor = vec4(inkColor, inkAlpha);
  }
`;

export function createInkDropIntro(scene, options = {}) {
  const {
    duration = 3.5,
    inkColor = 0x0a0818,
    goldColor = 0xd4a848
  } = options;

  // 全屏覆盖quad
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uInkColor: { value: new THREE.Color(inkColor) },
      uGoldColor: { value: new THREE.Color(goldColor) }
    },
    vertexShader: inkDropVertexShader,
    fragmentShader: inkDropFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });

  const quad = new THREE.Mesh(geo, mat);
  quad.renderOrder = 9999;
  quad.visible = false;
  scene.add(quad);

  let active = false;
  let elapsed = 0;
  let onCompleteCallback = null;

  function start(onComplete) {
    active = true;
    elapsed = 0;
    quad.visible = true;
    mat.uniforms.uProgress.value = 0;
    onCompleteCallback = onComplete;
  }

  function update(delta) {
    if (!active) return;
    elapsed += delta;
    const t = Math.min(1, elapsed / duration);
    // 缓动：先慢后快再慢
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    mat.uniforms.uTime.value = elapsed;
    mat.uniforms.uProgress.value = eased;

    if (t >= 1) {
      active = false;
      quad.visible = false;
      onCompleteCallback?.();
    }
  }

  function dispose() {
    scene.remove(quad);
    geo.dispose();
    mat.dispose();
  }

  return {
    start,
    update,
    dispose,
    isActive: () => active,
    quad
  };
}
