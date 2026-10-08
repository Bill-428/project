// waterShader.js —— 水面材质（支持真实平面反射）
// 在原有水面动画基础上，添加：
//   1. 真实反射纹理采样（PlanarReflection渲染）
//   2. fresnel系数混合反射与水色
//   3. 波纹法线扰动反射uv（水面扭曲）
//   4. 倒影清晰度随游戏进程变化（记忆逐渐清晰）
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime; uniform vec3 uCharacterPos; uniform vec3 uVelocity; uniform float uEnableRipple;
  varying vec3 vPosition; varying vec2 vUv; varying float vRipple; varying float vEdge;
  varying vec4 vScreenPos;
  attribute float edgeFactor;
  void main() {
    vUv = uv; vEdge = edgeFactor;
    vec4 worldPos4 = modelMatrix * vec4(position, 1.0); vec3 worldPos = worldPos4.xyz;
    float tinyH = 0.0;
    tinyH += sin(worldPos.x * 0.25 + worldPos.z * 0.18 + uTime * 0.35) * 0.012 * edgeFactor;
    tinyH += sin(worldPos.x * 0.18 - worldPos.z * 0.30 + uTime * 0.28 + 1.2) * 0.008 * edgeFactor;
    vec2 diff = worldPos.xz - uCharacterPos.xz; float dist = length(diff);
    float moveSpeed = length(uVelocity.xz);
    float speedFactor = smoothstep(0.0003, 0.005, moveSpeed) * uEnableRipple;
    float rippleDisp = sin(dist * 0.9 - uTime * 2.5) * exp(-dist * 0.25) * 0.04 * speedFactor * edgeFactor;
    float totalH = tinyH + rippleDisp;
    vec3 newPosition = position + vec3(0.0, totalH, 0.0);
    vPosition = (modelMatrix * vec4(newPosition, 1.0)).xyz;
    vRipple = speedFactor * exp(-dist * 0.1) * smoothstep(1.0, 0.0, dist);
    vec4 clipPos = projectionMatrix * viewMatrix * modelMatrix * vec4(newPosition, 1.0);
    vScreenPos = clipPos;
    gl_Position = clipPos;
  }
`;

const fragmentShader = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  varying vec3 vPosition; varying vec2 vUv; varying float vRipple; varying float vEdge;
  varying vec4 vScreenPos;
  uniform vec3 uCharacterPos; uniform vec3 uVelocity; uniform float uEnableRipple;
  uniform vec3 uBaseColor; uniform float uTime;
  uniform vec3 uSkyTop; uniform vec3 uSkyBottom; uniform float uFogDensity; uniform vec3 uFogColor;
  // ===== 新增：反射纹理 =====
  uniform sampler2D uReflectionMap;
  uniform float uReflectionStrength;   // 反射总强度
  uniform float uReflectionClarity;    // 倒影清晰度（0=模糊暗淡, 1=清晰）
  uniform vec2 uResolution;

  void main() {
    float wf = 0.0;
    wf += sin(vPosition.x * 0.38 + vPosition.z * 0.27 + uTime * 0.44) * 1.00;
    wf += sin(vPosition.x * 0.216 - vPosition.z * 0.468 + uTime * 0.32 + 1.3) * 0.75;
    wf += sin(vPosition.x * 0.976 + vPosition.z * 0.504 + uTime * 0.76 + 2.7) * 0.45;
    wf += sin(vPosition.x * 0.526 + vPosition.z * 0.962 + uTime * 0.20 + 0.5) * 0.55;
    vec3 deepBlue = vec3(0.10, 0.32, 0.52);
    vec3 midBlue = vec3(0.20, 0.52, 0.72);
    vec3 lightBlue = vec3(0.38, 0.70, 0.85);
    float depthT = smoothstep(-1.5, 1.5, wf);
    vec3 waterColor = mix(deepBlue, midBlue, depthT);
    waterColor = mix(waterColor, lightBlue, smoothstep(0.6, 1.2, depthT));
    float lineWidth = 0.12;
    float line = 1.0 - smoothstep(0.0, lineWidth, abs(wf));
    float lineVar = 0.65 + 0.35 * sin(vPosition.x * 0.08 + vPosition.z * 0.10 + uTime * 0.12);
    vec3 lineColor = vec3(0.55, 0.78, 0.92);
    waterColor = mix(waterColor, lineColor, line * lineVar * 0.9);
    float edgeLine = 1.0 - smoothstep(0.0, 0.035, vEdge);
    waterColor = mix(waterColor, vec3(0.93, 0.97, 1.0), edgeLine * 0.92);
    float edgeGlow = (1.0 - smoothstep(0.0, 0.14, vEdge)) * smoothstep(0.0, 0.015, vEdge);
    waterColor += vec3(0.50, 0.75, 0.94) * edgeGlow * 0.28;
    vec2 rdiff = vPosition.xz - uCharacterPos.xz; float rdist = length(rdiff);
    float rSpeed = length(uVelocity.xz);
    float rSpeedFactor = smoothstep(0.0003, 0.005, rSpeed) * uEnableRipple;
    float rippleWave = sin(rdist * 0.85 - uTime * 2.4) * exp(-rdist * 0.22);
    rippleWave *= smoothstep(8.0, 0.0, rdist);
    float rippleLine1 = 1.0 - smoothstep(0.0, 0.10, abs(rippleWave - 0.28));
    float rippleLine2 = (1.0 - smoothstep(0.0, 0.08, abs(rippleWave + 0.12))) * 0.45;
    float rippleLines = rippleLine1 + rippleLine2;
    waterColor = mix(waterColor, vec3(0.94, 0.98, 1.0), rippleLines * rSpeedFactor * 0.65);
    vec2 splashCell = floor(vPosition.xz * 5.5) + vec2(floor(uTime * 7.0));
    float splashHash = hash(splashCell);
    float splash = step(0.92, splashHash) * smoothstep(4.5, 0.0, rdist) * rSpeedFactor;
    waterColor = mix(waterColor, vec3(1.0), splash * 0.85);
    waterColor = mix(waterColor, waterColor * uBaseColor, 0.0);
    float noise = sin(vPosition.x * 18.0 + vPosition.z * 13.0 + uTime * 0.15) * 0.008;
    waterColor += noise;

    // ===== 计算水面法线（用于反射扰动和fresnel）=====
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float dx = 0.02;
    float hL = sin((vPosition.x - dx) * 0.38 + vPosition.z * 0.27 + uTime * 0.44) * 0.04
             + sin((vPosition.x - dx) * 0.216 - vPosition.z * 0.468 + uTime * 0.32) * 0.03;
    float hR = sin((vPosition.x + dx) * 0.38 + vPosition.z * 0.27 + uTime * 0.44) * 0.04
             + sin((vPosition.x + dx) * 0.216 - vPosition.z * 0.468 + uTime * 0.32) * 0.03;
    float hD = sin(vPosition.x * 0.38 + (vPosition.z - dx) * 0.27 + uTime * 0.44) * 0.04
             + sin(vPosition.x * 0.216 - (vPosition.z - dx) * 0.468 + uTime * 0.32) * 0.03;
    float hU = sin(vPosition.x * 0.38 + (vPosition.z + dx) * 0.27 + uTime * 0.44) * 0.04
             + sin(vPosition.x * 0.216 - (vPosition.z + dx) * 0.468 + uTime * 0.32) * 0.03;
    vec3 waterNormal = normalize(vec3(hL - hR, 2.0 * dx, hD - hU));

    // ===== fresnel 反射系数 =====
    float fresnel = pow(1.0 - max(dot(viewDir, waterNormal), 0.0), 3.0);
    float reflStrength = fresnel * uReflectionStrength * smoothstep(0.02, 0.3, vEdge);

    // ===== 采样真实反射纹理（屏幕空间，用法线扰动uv）=====
    vec2 screenUv = (vScreenPos.xy / vScreenPos.w) * 0.5 + 0.5;
    // 反射纹理是上下翻转的（镜像相机），所以V坐标翻转
    screenUv.y = 1.0 - screenUv.y;
    // 用法线扰动反射uv（水面扭曲）
    vec2 reflOffset = waterNormal.xz * 0.015 * (1.0 - uReflectionClarity * 0.5);
    vec2 reflUv = screenUv + reflOffset;
    // 边缘区域降低反射（避免拉伸伪影）
    float edgeMask = smoothstep(0.0, 0.1, reflUv.x) * smoothstep(1.0, 0.9, reflUv.x)
                   * smoothstep(0.0, 0.1, reflUv.y) * smoothstep(1.0, 0.9, reflUv.y);
    vec3 reflectionColor = texture2D(uReflectionMap, reflUv).rgb;
    // 清晰度影响：低清晰度时反射偏暗偏冷，高清晰度时明亮
    vec3 reflTint = mix(vec3(0.3, 0.25, 0.45), vec3(1.0), uReflectionClarity);
    reflectionColor *= reflTint;
    // 低清晰度时轻微模糊（用多次采样近似）
    if (uReflectionClarity < 0.5) {
      float blurAmount = (0.5 - uReflectionClarity) * 0.01;
      vec3 blurColor = reflectionColor;
      blurColor += texture2D(uReflectionMap, reflUv + vec2(blurAmount, 0)).rgb * reflTint;
      blurColor += texture2D(uReflectionMap, reflUv - vec2(blurAmount, 0)).rgb * reflTint;
      blurColor += texture2D(uReflectionMap, reflUv + vec2(0, blurAmount)).rgb * reflTint;
      blurColor += texture2D(uReflectionMap, reflUv - vec2(0, blurAmount)).rgb * reflTint;
      reflectionColor = blurColor / 5.0;
    }

    // 混合反射与水色
    waterColor = mix(waterColor, reflectionColor, reflStrength * edgeMask);

    // ===== 天空假反射（保留作为补充，在真实反射弱的区域）=====
    vec3 reflDir = reflect(-viewDir, waterNormal);
    float skyT = smoothstep(-0.15, 0.85, reflDir.y);
    vec3 skyRefl = mix(uSkyBottom, uSkyTop, skyT);
    float skyReflStrength = fresnel * 0.25 * (1.0 - reflStrength * edgeMask);
    waterColor = mix(waterColor, skyRefl, skyReflStrength);

    // 水面高光
    vec3 lightDir = normalize(vec3(0.5, 0.7, 0.35));
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(waterNormal, halfDir), 0.0), 64.0);
    waterColor += vec3(0.9, 0.85, 1.0) * spec * 0.4;

    // ===== 雾效 =====
    float camDist = length(vPosition - cameraPosition);
    float fogF = 1.0 - exp(-(uFogDensity * camDist) * (uFogDensity * camDist));
    waterColor = mix(waterColor, uFogColor, clamp(fogF, 0.0, 1.0));

    gl_FragColor = vec4(waterColor, 1.0);
  }
`;

export function createWaterMaterial(
  baseColor = '#8fcbd4', deepColor = '#091a20',
  lightDir = new THREE.Vector3(20, 40, 20),
  skyTop = new THREE.Color(0x0d0d24), skyBottom = new THREE.Color(0x3d3370),
  fogColor = new THREE.Color(0x40347a), fogDensity = 0.011,
  reflectionMap = null
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uCharacterPos: { value: new THREE.Vector3(0, 0, 0) },
      uVelocity: { value: new THREE.Vector3(0, 0, 0) }, uEnableRipple: { value: 1.0 },
      uLightDir: { value: lightDir.clone().normalize() },
      uBaseColor: { value: new THREE.Color(baseColor) }, uDeepColor: { value: new THREE.Color(deepColor) },
      uSkyTop: { value: skyTop }, uSkyBottom: { value: skyBottom },
      uFogColor: { value: fogColor }, uFogDensity: { value: fogDensity },
      // 新增：反射相关
      uReflectionMap: { value: reflectionMap },
      uReflectionStrength: { value: reflectionMap ? 0.6 : 0.0 },
      uReflectionClarity: { value: 0.2 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    }, vertexShader, fragmentShader, side: THREE.DoubleSide, transparent: false, wireframe: false
  });
}
