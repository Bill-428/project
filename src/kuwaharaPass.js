// kuwaharaPass.js —— 各向异性 Kuwahara 水彩滤镜
// 作用：将3D渲染转化为水彩/手绘色块感，是「夜湖梦境」画风的核心pass
// 使用：作为 ShaderPass 加入 EffectComposer，在 Bloom 之后、颜色分级之前
// 强度控制：uniforms.uStrength (0=关闭, 1=完全水彩化)
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const KuwaharaShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1024, 1024) },
    uStrength: { value: 0.6 },       // 0=原图, 1=完全水彩化
    uRadius: { value: 4.0 },          // 采样半径，越大色块越大
    uAnisotropy: { value: 0.7 }       // 各向异性强度，0=各向同性
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uStrength;
    uniform float uRadius;
    uniform float uAnisotropy;
    varying vec2 vUv;

    // 结构张量：计算局部方向（各向异性Kuwahara的核心）
    vec3 structureTensor(vec2 uv) {
      vec2 texel = 1.0 / uResolution;
      // Sobel 梯度
      vec3 c00 = texture2D(tDiffuse, uv + texel * vec2(-1, -1)).rgb;
      vec3 c10 = texture2D(tDiffuse, uv + texel * vec2( 0, -1)).rgb;
      vec3 c20 = texture2D(tDiffuse, uv + texel * vec2( 1, -1)).rgb;
      vec3 c01 = texture2D(tDiffuse, uv + texel * vec2(-1,  0)).rgb;
      vec3 c21 = texture2D(tDiffuse, uv + texel * vec2( 1,  0)).rgb;
      vec3 c02 = texture2D(tDiffuse, uv + texel * vec2(-1,  1)).rgb;
      vec3 c12 = texture2D(tDiffuse, uv + texel * vec2( 0,  1)).rgb;
      vec3 c22 = texture2D(tDiffuse, uv + texel * vec2( 1,  1)).rgb;

      vec3 gx = -c00 - 2.0*c01 - c02 + c20 + 2.0*c21 + c22;
      vec3 gy = -c00 - 2.0*c10 - c20 + c02 + 2.0*c12 + c22;

      float gxL = dot(gx, vec3(0.299, 0.587, 0.114));
      float gyL = dot(gy, vec3(0.299, 0.587, 0.114));

      // 结构张量 [Jxx, Jxy, Jyy]
      return vec3(gxL * gxL, gxL * gyL, gyL * gyL);
    }

    // 计算局部特征方向和各向异性度
    vec2 eigenDecompose(vec3 T) {
      float Jxx = T.x, Jxy = T.y, Jyy = T.z;
      float trace = Jxx + Jyy;
      float det = Jxx * Jyy - Jxy * Jxy;
      float disc = sqrt(max(0.0, trace * trace * 0.25 - det));
      float lambda1 = trace * 0.5 + disc;
      float lambda2 = trace * 0.5 - disc;
      // 方向角（最大特征值对应的特征向量方向）
      float angle = atan(2.0 * Jxy, Jxx - Jyy) * 0.5;
      // 各向异性度 (0=各向同性, 1=强方向性)
      float ani = (lambda1 + lambda2 > 0.001) ? (lambda1 - lambda2) / (lambda1 + lambda2) : 0.0;
      return vec2(angle, ani);
    }

    void main() {
      vec2 texel = 1.0 / uResolution;
      vec3 original = texture2D(tDiffuse, vUv).rgb;

      if (uStrength < 0.01) {
        gl_FragColor = vec4(original, 1.0);
        return;
      }

      // 计算结构张量和方向
      vec3 T = structureTensor(vUv);
      vec2 eigen = eigenDecompose(T);
      float angle = eigen.x;
      float ani = eigen.y * uAnisotropy;

      // 沿方向和垂直方向的采样半径
      float rLong = uRadius * (1.0 + ani * 1.5);
      float rShort = uRadius * (1.0 - ani * 0.6);

      float ca = cos(angle), sa = sin(angle);

      // 四个象限的均值和方差（Kuwahara核心）
      vec3 mean[4];
      float variance[4];
      for (int q = 0; q < 4; q++) {
        vec3 sum = vec3(0.0);
        vec3 sumSq = vec3(0.0);
        float count = 0.0;
        // 每个象限采样一个扇形区域
        float angleStart = float(q) * 3.14159 * 0.5;
        for (int i = 0; i < 12; i++) {
          float fi = float(i);
          float a = angleStart + (fi / 11.0) * 3.14159 * 0.5;
          for (int j = 1; j <= 4; j++) {
            float fj = float(j);
            float r = fj / 4.0;
            // 椭圆采样（沿方向拉长）
            float ox = cos(a) * r * rLong;
            float oy = sin(a) * r * rShort;
            // 旋转到特征方向
            float rx = ox * ca - oy * sa;
            float ry = ox * sa + oy * ca;
            vec2 sampleUv = vUv + vec2(rx, ry) * texel;
            vec3 c = texture2D(tDiffuse, sampleUv).rgb;
            sum += c;
            sumSq += c * c;
            count += 1.0;
          }
        }
        mean[q] = sum / count;
        vec3 var = sumSq / count - mean[q] * mean[q];
        variance[q] = dot(var, vec3(0.299, 0.587, 0.114));
      }

      // 选择方差最小的象限的均值（Kuwahara：最均匀的区域）
      int bestQ = 0;
      float minVar = variance[0];
      if (variance[1] < minVar) { minVar = variance[1]; bestQ = 1; }
      if (variance[2] < minVar) { minVar = variance[2]; bestQ = 2; }
      if (variance[3] < minVar) { minVar = variance[3]; bestQ = 3; }

      vec3 kuwaharaColor = mean[bestQ];

      // 轻微叠加纸张颗粒感
      float paperNoise = fract(sin(dot(vUv * uResolution, vec2(12.9898, 78.233))) * 43758.5453);
      kuwaharaColor += (paperNoise - 0.5) * 0.02 * uStrength;

      // 与原图混合（uStrength控制）
      vec3 finalColor = mix(original, kuwaharaColor, uStrength);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

export function createKuwaharaPass(options = {}) {
  const { strength = 0.6, radius = 4.0, anisotropy = 0.7 } = options;
  const pass = new ShaderPass(KuwaharaShader);
  pass.uniforms.uStrength.value = strength;
  pass.uniforms.uRadius.value = radius;
  pass.uniforms.uAnisotropy.value = anisotropy;
  return pass;
}

export function setKuwaharaStrength(pass, v) {
  if (pass) pass.uniforms.uStrength.value = Math.max(0, Math.min(1, v));
}

export function setKuwaharaRadius(pass, v) {
  if (pass) pass.uniforms.uRadius.value = Math.max(1, Math.min(12, v));
}
