// groundShader.js —— 地面材质（水墨晕染版）
// 改动：纹理改为水墨晕染（墨在宣纸上的扩散边缘），颜色从深墨到浅灰
import * as THREE from 'three';
const GROUND_BASE_Y = -0.3;
// 修改：水墨晕染纹理生成
function createGroundTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // 宣纸底色（偏暖的米灰）
  ctx.fillStyle = '#c8c0b0';
  ctx.fillRect(0, 0, size, size);
  // 值噪声
  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise2D(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = hash(xi, yi), b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    const u = smooth(xf), v = smooth(yf);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  function fbm2D(x, y, octaves = 5) {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += amp * noise2D(x * freq, y * freq);
      freq *= 2; amp *= 0.5;
    }
    return val;
  }
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // 大尺度墨晕（墨团）
      const inkBlotch = fbm2D(u * 3, v * 3, 5);
      // 中尺度墨纹
      const inkVein = fbm2D(u * 8 + 5, v * 8 + 3, 4);
      // 细尺度宣纸纤维
      const paperFiber = fbm2D(u * 50, v * 50, 3);
      // 墨点（飞白）
      const inkDotRaw = fbm2D(u * 15 + 20, v * 15 + 30, 4);
      const inkDot = Math.pow(Math.max(0, inkDotRaw - 0.55) * 2.2, 1.5);
      // 基础色：宣纸米灰
      let r = 200, g = 192, b = 176;
      // 墨晕压暗（墨团区域）
      const inkAmount = Math.pow(inkBlotch, 1.5) * 0.6 + inkVein * 0.25;
      r -= inkAmount * 100; g -= inkAmount * 102; b -= inkAmount * 108;
      // 宣纸纤维纹理
      r += (paperFiber - 0.5) * 12; g += (paperFiber - 0.5) * 10; b += (paperFiber - 0.5) * 8;
      // 墨点（更深的飞白）
      r -= inkDot * 60; g -= inkDot * 62; b -= inkDot * 65;
      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 14); tex.anisotropy = 8;
  return tex;
}
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
export function terrainHeight(x, z, lakes = []) {
  let h = 0;
  h += Math.sin(x * 0.035) * 0.8; h += Math.sin(z * 0.030 + 2.1) * 0.6; h += Math.sin((x * 0.5 + z * 0.4) * 0.13) * 0.3;
  let lakeFade = 1;
  for (const L of lakes) { const d = Math.hypot(x - L.x, z - L.z); lakeFade = Math.min(lakeFade, smoothstep(L.r, L.r + 14, d)); }
  h *= lakeFade;
  const half = 250; const edge = Math.max(Math.abs(x), Math.abs(z)); h *= 1 - smoothstep(half - 30, half, edge);
  return GROUND_BASE_Y + h;
}
const vertexShader = `
  varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorldPos; varying vec4 vShadowCoord;
  uniform mat4 uShadowMapMatrix; uniform float uTime; uniform vec4 uLakes[4]; uniform float uGroundHalf;
  float smstep(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
  void main() {
    vUv = uv; vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    float h = 0.0;
    h += sin(worldPos.x * 0.035) * 0.8; h += sin(worldPos.z * 0.030 + 2.1) * 0.6; h += sin((worldPos.x * 0.5 + worldPos.z * 0.4) * 0.13) * 0.3;
    float lakeFade = 1.0;
    for (int i = 0; i < 4; i++) { vec4 L = uLakes[i]; if (L.w < 0.5) continue; float d = length(worldPos.xz - L.xy); lakeFade = min(lakeFade, smstep(L.z, L.z + 14.0, d)); }
    h *= lakeFade;
    float edgeM = max(abs(worldPos.x), abs(worldPos.z)); h *= 1.0 - smstep(uGroundHalf - 30.0, uGroundHalf, edgeM);
    worldPos.y += h; vWorldPos = worldPos.xyz; vShadowCoord = uShadowMapMatrix * worldPos;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;
const fragmentShader = `
  varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorldPos; varying vec4 vShadowCoord;
  uniform vec3 uColor1; uniform vec3 uColor2; uniform vec3 uLightDir; uniform float uTime;
  uniform sampler2D uShadowMap; uniform float uShadowBias; uniform vec2 uShadowMapSize;
  uniform sampler2D uMap; uniform sampler2D uExternalMap; uniform float uUseExternal;
  uniform vec3 uTintColor;
  uniform vec2 uGroundRepeat;
  uniform vec3 uFogColor; uniform float uFogDensity;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float getShadow(vec4 shadowCoord) {
    vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
    if (projCoords.z > 1.0) return 1.0;
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) return 1.0;
    float shadow = 0.0;
    vec2 texel = 1.0 / uShadowMapSize;
    float jitter = hash(projCoords.xy * uShadowMapSize) * 0.5;
    for (int x = -1; x <= 2; x++) {
      for (int y = -1; y <= 2; y++) {
        vec2 offset = (vec2(float(x), float(y)) + jitter) * texel;
        float pcfDepth = texture2D(uShadowMap, projCoords.xy + offset).r;
        shadow += projCoords.z - uShadowBias > pcfDepth ? 0.0 : 1.0;
      }
    }
    return shadow / 16.0;
  }
  void main() {
    vec2 center = vUv - 0.5; float dist = length(center);
    float t = smoothstep(0.05, 1.25, dist);
    // 修改：水墨风格颜色（深墨到浅灰）
    vec3 baseColor = mix(uColor1, uColor2, t);
    float texMicro = texture2D(uMap, vUv).r;
    float texMacro = texture2D(uMap, vUv * 0.12).r;
    float procGray = mix(texMicro, texMacro, 0.38);
    float extGray = texture2D(uExternalMap, vUv * uGroundRepeat).r;
    extGray = smoothstep(0.45, 0.95, extGray);
    float surfaceGray = mix(procGray, extGray, uUseExternal);
    vec3 surfaceTint = mix(baseColor, uTintColor, uUseExternal);
    vec3 col = surfaceTint * (0.52 + surfaceGray * 0.55);
    vec3 normal = normalize(vNormal); vec3 lightDir = normalize(uLightDir);
    float diff = dot(normal, lightDir) * 0.5 + 0.5; diff = smoothstep(0.0, 1.0, diff);
    float shadow = getShadow(vShadowCoord);
    shadow = smoothstep(0.2, 0.8, shadow);
    col *= mix(0.5, 1.0, shadow);
    // 修改：水墨斑块变化（更柔和的浓淡变化）
    float patchVar = hash(floor(vWorldPos.xz * 1.2)); patchVar = floor(patchVar * 4.0) / 4.0;
    col = mix(col, col * vec3(0.95, 0.93, 0.90), patchVar * 0.2);
    float patchVar2 = hash(floor(vWorldPos.xz * 3.0 + 3.1));
    col = mix(col, col * vec3(0.90, 0.92, 0.95), step(0.6, patchVar2) * 0.12);
    // 修改：草纹改为水墨笔触（更柔和的笔触纹理）
    vec2 gw = vWorldPos.xz * 2.0; vec2 cell = floor(gw); vec2 f = fract(gw);
    float h = hash(cell); float h2 = hash(cell + 7.31);
    float bx = abs(f.x - (0.25 + h * 0.5)); float bladeLen = 0.3 + h2 * 0.4;
    float bladeMask = step(bx, 0.04) * step(f.y, bladeLen);
    col *= 1.0 - bladeMask * (0.12 + h * 0.12);
    // 细微颗粒（宣纸感）
    col += (hash(vUv * 1370.0) - 0.5) * 0.015;
    col += (hash(vUv * 731.0) - 0.5) * 0.008;
    // 修改：中心微光改为暖金色（提灯照射感）
    float glow = exp(-dist * 1.5) * 0.08;
    col += vec3(1.0, 0.85, 0.55) * glow;
    float camDist = length(vWorldPos - cameraPosition);
    float fogFactor = 1.0 - exp(-(uFogDensity * camDist) * (uFogDensity * camDist));
    col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;
export function createGroundMaterial(
  color1 = '#5a4f7a', color2 = '#2a2040',
  fogColor = new THREE.Color(0xf2d9a6), fogDensity = 0.011,
  lightDir = new THREE.Vector3(25, 35, 20), lakes = [],
  groundHalf = 250, externalTexture = null, shadowMapSize = 2048, tintColor = '#8a7ab0'
) {
  const uLakes = [];
  for (let i = 0; i < 4; i++) { const L = lakes[i]; uLakes.push(L ? new THREE.Vector4(L.x, L.z, L.r, 1) : new THREE.Vector4(0, 0, 0, 0)); }
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor1: { value: new THREE.Color(color1) }, uColor2: { value: new THREE.Color(color2) },
      uTime: { value: 0 }, uFogColor: { value: fogColor }, uFogDensity: { value: fogDensity },
      uLightDir: { value: lightDir.clone().normalize() },
      uShadowMap: { value: null }, uShadowMapMatrix: { value: new THREE.Matrix4() },
      uShadowBias: { value: 0.0015 }, uShadowMapSize: { value: new THREE.Vector2(shadowMapSize, shadowMapSize) },
      uLakes: { value: uLakes }, uGroundHalf: { value: groundHalf },
      uMap: { value: createGroundTexture() }, uExternalMap: { value: externalTexture }, uUseExternal: { value: externalTexture ? 1.0 : 0.0 },
      uTintColor: { value: new THREE.Color(tintColor) },
      uGroundRepeat: { value: new THREE.Vector2(1, 1) },
    }, vertexShader, fragmentShader,
  });
}
