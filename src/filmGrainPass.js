// filmGrainPass.js —— 动态胶片颗粒
// 作用：叠加细微动态颗粒，消除数字渲染感，增加胶片/画作质感
// 使用：作为 ShaderPass 加入 EffectComposer，放在最后（OutputPass之前）
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 0.04 },      // 颗粒强度
    uScanlineIntensity: { value: 0.015 }, // 扫描线强度（模拟胶片齿孔/扫描线）
    uVignetteBoost: { value: 0.0 }     // 额外暗角增强
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
    uniform float uTime;
    uniform float uIntensity;
    uniform float uScanlineIntensity;
    uniform float uVignetteBoost;
    varying vec2 vUv;

    // 多层哈希噪声
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // 动态颗粒（每帧变化的高频噪声）
      float t = floor(uTime * 24.0); // 24fps颗粒跳动（电影感）
      float grain1 = noise(vUv * 800.0 + vec2(t * 1.3, t * 2.7));
      float grain2 = noise(vUv * 1200.0 + vec2(t * 2.1, t * 1.1));
      float grain = (grain1 + grain2) * 0.5 - 0.5;
      color += grain * uIntensity;

      // 细微扫描线（模拟胶片/CRT感，强度很低）
      float scanline = sin(vUv.y * 1200.0 + uTime * 0.5) * 0.5 + 0.5;
      color -= scanline * uScanlineIntensity;

      // 额外暗角
      vec2 dir = vUv - 0.5;
      float dist = length(dir);
      float vignette = 1.0 - smoothstep(0.3, 1.1, dist) * uVignetteBoost;
      color *= vignette;

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

export function createFilmGrainPass(options = {}) {
  const { intensity = 0.04, scanlineIntensity = 0.015, vignetteBoost = 0.0 } = options;
  const pass = new ShaderPass(FilmGrainShader);
  pass.uniforms.uIntensity.value = intensity;
  pass.uniforms.uScanlineIntensity.value = scanlineIntensity;
  pass.uniforms.uVignetteBoost.value = vignetteBoost;
  return pass;
}

export function updateFilmGrain(pass, time) {
  if (pass) pass.uniforms.uTime.value = time;
}

export function setFilmGrainIntensity(pass, v) {
  if (pass) pass.uniforms.uIntensity.value = Math.max(0, Math.min(0.2, v));
}
