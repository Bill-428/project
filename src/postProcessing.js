// postProcessing.js —— 后期处理（集成Kuwahara水彩滤镜 + 胶片颗粒）
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { LUTCubeLoader } from 'three/addons/loaders/LUTCubeLoader.js';
import { createKuwaharaPass, setKuwaharaStrength } from './kuwaharaPass.js';
import { createFilmGrainPass, updateFilmGrain, setFilmGrainIntensity } from './filmGrainPass.js';
const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, vignetteStrength: { value: 0.35 }, chromaticAberration: { value: 0.0015 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignetteStrength; uniform float chromaticAberration; varying vec2 vUv;
    void main(){
      vec2 uv=vUv; vec2 dir=uv-0.5; float dist=length(dir);
      vec2 offset=dir*dist*chromaticAberration;
      float r=texture2D(tDiffuse,uv+offset).r; float g=texture2D(tDiffuse,uv).g; float b=texture2D(tDiffuse,uv-offset).b;
      vec3 color=vec3(r,g,b);
      float vignette=1.0-smoothstep(0.25,1.1,dist)*vignetteStrength; color*=vignette;
      gl_FragColor=vec4(color,1.0);
    }`
};
const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.05 },
    saturation: { value: 1.08 },
    temperature: { value: 0.45 },
    haze: { value: 0.15 },
    shadowTint: { value: new THREE.Color(0x8899cc) },
    highlightTint: { value: new THREE.Color(0xffeedd) },
    lift: { value: 0.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float contrast; uniform float saturation; uniform float temperature; uniform float haze; uniform float lift;
    uniform vec3 shadowTint; uniform vec3 highlightTint;
    varying vec2 vUv;
    void main(){
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      color += lift;
      color = (color - 0.5) * contrast + 0.5;
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, saturation);
      vec3 warm = vec3(1.06, 0.99, 0.90);
      vec3 cool = vec3(0.90, 0.97, 1.06);
      color *= mix(cool, warm, temperature);
      float l = dot(color, vec3(0.299, 0.587, 0.114));
      float sMask = 1.0 - smoothstep(0.0, 0.45, l);
      float hMask = smoothstep(0.55, 1.0, l);
      color = mix(color * shadowTint, color, 1.0 - sMask * 0.35);
      color = mix(color, color * highlightTint, hMask * 0.25);
      float midMask = 1.0 - abs(l - 0.42) * 2.2;
      midMask = max(0.0, midMask);
      vec3 hazeColor = mix(vec3(0.55, 0.50, 0.70), vec3(0.95, 0.80, 0.60), temperature);
      color = mix(color, color + hazeColor * midMask * haze * 0.25, 1.0);
      color = mix(color, color * (1.0 - haze * 0.12), 1.0);
      gl_FragColor = vec4(color, 1.0);
    }`
};
const LUTBlendShader = {
  uniforms: {
    tDiffuse: { value: null },
    lut1: { value: null },
    lut2: { value: null },
    blend: { value: 0.0 },
    intensity: { value: 1.0 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler3D lut1;
    uniform sampler3D lut2;
    uniform float blend;
    uniform float intensity;
    varying vec2 vUv;
    void main(){
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      vec3 clamped = clamp(color, 0.0, 1.0);
      vec3 graded1 = texture(lut1, clamped).rgb;
      vec3 graded2 = texture(lut2, clamped).rgb;
      vec3 graded = mix(graded1, graded2, blend);
      color = mix(color, graded, intensity);
      gl_FragColor = vec4(color, 1.0);
    }`
};
const RESOLUTION_SCALE = 0.7;
let composer = null, bloomPass = null, vignettePass = null, bokehPass = null, fxaaPass = null, colorGradePass = null;
let kuwaharaPass = null, filmGrainPass = null;
let lutBlendPass = null;
let lutTextures = [];
let lutCurrentIdx = 0;
let lutTargetIdx = 0;
let lutBlendAmount = 0;
let lutBlendDuration = 0;
let lutBlendElapsed = 0;
let lutLoaded = false;
let pixelRatio = 1;
const PRESETS = {
  dawn:    { contrast: 0.90, saturation: 0.92, temperature: 0.28, haze: 0.55, lift: 0.06, shadowTint: 0x8a9acc, highlightTint: 0xffddbb },
  noon:    { contrast: 1.05, saturation: 1.08, temperature: 0.45, haze: 0.10, lift: 0.0,  shadowTint: 0x8899cc, highlightTint: 0xfff0e0 },
  dusk:    { contrast: 0.98, saturation: 1.05, temperature: 0.75, haze: 0.55, lift: 0.06, shadowTint: 0x7a5a9a, highlightTint: 0xffbb77 },
  night:   { contrast: 1.00, saturation: 0.92, temperature: 0.15, haze: 0.58, lift: 0.06, shadowTint: 0x5a5a8a, highlightTint: 0xaaaaff },
};
let currentPreset = 'night';
export function initPostProcessing(renderer, scene, camera, options = {}) {
  const {
    bloomStrength = 0.3, bloomRadius = 0.2, bloomThreshold = 0.8, useBloom = true,
    vignetteStrength = 0.35, chromaticAberration = 0.0015,
    useDOF = false, dofFocus = 0.85, dofAperture = 0.0012, dofMaxblur = 0.0025,
    initialPreset = 'night',
    useKuwahara = true, kuwaharaStrength = 0.45, kuwaharaRadius = 2.0,
    useFilmGrain = true, filmGrainIntensity = 0.035
  } = options;
  pixelRatio = renderer.getPixelRatio();
  composer = new EffectComposer(renderer);
  const w = Math.floor(window.innerWidth * RESOLUTION_SCALE);
  const h = Math.floor(window.innerHeight * RESOLUTION_SCALE);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  if (useDOF) {
    bokehPass = new BokehPass(scene, camera, { focus: dofFocus, aperture: dofAperture, maxblur: dofMaxblur });
    composer.addPass(bokehPass);
  }
  if (useBloom) {
    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), bloomStrength, bloomRadius, bloomThreshold);
    composer.addPass(bloomPass);
  }
  if (useKuwahara) {
    kuwaharaPass = createKuwaharaPass({ strength: kuwaharaStrength, radius: kuwaharaRadius, anisotropy: 0.7 });
    kuwaharaPass.uniforms.uResolution.value.set(w, h);
    composer.addPass(kuwaharaPass);
  }
  colorGradePass = new ShaderPass(ColorGradeShader);
  composer.addPass(colorGradePass);
  lutBlendPass = new ShaderPass(LUTBlendShader);
  lutBlendPass.enabled = false;
  composer.addPass(lutBlendPass);
  vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms.vignetteStrength.value = vignetteStrength;
  vignettePass.uniforms.chromaticAberration.value = chromaticAberration;
  composer.addPass(vignettePass);
  if (useFilmGrain) {
    filmGrainPass = createFilmGrainPass({ intensity: filmGrainIntensity, scanlineIntensity: 0.01 });
    composer.addPass(filmGrainPass);
  }
  composer.addPass(new OutputPass());
  if (fxaaPass) fxaaPass.uniforms['resolution'].value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
  setColorGradePreset(initialPreset);
  return composer;
}
export function loadLUTs(basePath = '/luts/') {
  const loader = new LUTCubeLoader();
  const promises = [];
  for (let i = 1; i <= 5; i++) {
    promises.push(new Promise((resolve) => {
      loader.load(
        `${basePath}color${i}.cube`,
        (result) => {
          const tex = result.texture3D;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          resolve(tex);
        },
        undefined,
        (err) => {
          console.warn(`[LUT] color${i}.cube 加载失败，该幕将回退到无 LUT 状态`, err);
          resolve(null);
        }
      );
    }));
  }
  return Promise.all(promises).then((textures) => {
    lutTextures = textures;
    const firstValid = textures.findIndex(t => t !== null);
    if (firstValid >= 0 && lutBlendPass) {
      lutBlendPass.uniforms.lut1.value = textures[firstValid];
      lutBlendPass.uniforms.lut2.value = textures[firstValid];
      lutBlendPass.enabled = true;
      lutCurrentIdx = firstValid;
      lutTargetIdx = firstValid;
      lutLoaded = true;
      console.log(`[LUT] 已加载 ${textures.filter(t => t).length}/5 个色彩查找表`);
    }
    return lutTextures;
  });
}
export function setLUT(index) {
  if (!lutLoaded || !lutBlendPass || index < 0 || index >= lutTextures.length) return;
  const tex = lutTextures[index];
  if (!tex) return;
  lutBlendPass.uniforms.lut1.value = tex;
  lutBlendPass.uniforms.lut2.value = tex;
  lutBlendPass.uniforms.blend.value = 0;
  lutCurrentIdx = index;
  lutTargetIdx = index;
  lutBlendAmount = 0;
  lutBlendDuration = 0;
  lutBlendElapsed = 0;
}
export function blendToLUT(index, duration = 2.5) {
  if (!lutLoaded || !lutBlendPass || index < 0 || index >= lutTextures.length) return;
  const targetTex = lutTextures[index];
  if (!targetTex) return;
  if (index === lutTargetIdx && lutBlendDuration === 0) return;
  if (lutBlendAmount > 0.5 && lutTextures[lutTargetIdx]) {
    lutBlendPass.uniforms.lut1.value = lutTextures[lutTargetIdx];
    lutCurrentIdx = lutTargetIdx;
  }
  lutBlendPass.uniforms.lut2.value = targetTex;
  lutTargetIdx = index;
  lutBlendAmount = 0;
  lutBlendElapsed = 0;
  lutBlendDuration = duration;
  lutBlendPass.uniforms.blend.value = 0;
}
export function updateLUTBlend(delta) {
  if (!lutBlendPass || lutBlendDuration <= 0) return;
  lutBlendElapsed += delta;
  const t = Math.min(1, lutBlendElapsed / lutBlendDuration);
  lutBlendAmount = t * t * (3 - 2 * t);
  lutBlendPass.uniforms.blend.value = lutBlendAmount;
  if (t >= 1) {
    if (lutTextures[lutTargetIdx]) {
      lutBlendPass.uniforms.lut1.value = lutTextures[lutTargetIdx];
    }
    lutBlendPass.uniforms.blend.value = 0;
    lutCurrentIdx = lutTargetIdx;
    lutBlendAmount = 0;
    lutBlendDuration = 0;
  }
}
export function setLUTIntensity(v) {
  if (lutBlendPass) lutBlendPass.uniforms.intensity.value = Math.max(0, Math.min(1, v));
}
export function resizePostProcessing(width, height) {
  const w = Math.floor(width * RESOLUTION_SCALE), h = Math.floor(height * RESOLUTION_SCALE);
  if (composer) composer.setSize(w, h);
  if (fxaaPass) fxaaPass.uniforms['resolution'].value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
  if (kuwaharaPass) kuwaharaPass.uniforms.uResolution.value.set(w, h);
}
export function setColorGrade(params) {
  if (!colorGradePass) return;
  const u = colorGradePass.uniforms;
  if (params.contrast !== undefined) u.contrast.value = params.contrast;
  if (params.saturation !== undefined) u.saturation.value = params.saturation;
  if (params.temperature !== undefined) u.temperature.value = params.temperature;
  if (params.haze !== undefined) u.haze.value = params.haze;
  if (params.lift !== undefined) u.lift.value = params.lift;
  if (params.shadowTint !== undefined) u.shadowTint.value.set(params.shadowTint);
  if (params.highlightTint !== undefined) u.highlightTint.value.set(params.highlightTint);
}
export function setColorGradePreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  currentPreset = name;
  setColorGrade(p);
}
export function getColorGradePreset() { return currentPreset; }
let _transitionFrom = null, _transitionTo = null, _transitionT = 0;
export function lerpColorGrade(toName, duration = 2.0) {
  const to = PRESETS[toName];
  if (!to || !colorGradePass) return;
  const u = colorGradePass.uniforms;
  _transitionFrom = {
    contrast: u.contrast.value, saturation: u.saturation.value, temperature: u.temperature.value,
    haze: u.haze.value, lift: u.lift.value,
    shadowTint: u.shadowTint.value.clone(), highlightTint: u.highlightTint.value.clone(),
  };
  _transitionTo = { ...to, shadowTint: new THREE.Color(to.shadowTint), highlightTint: new THREE.Color(to.highlightTint) };
  _transitionT = 0;
  currentPreset = toName;
}
export function updateColorGrade(delta) {
  if (!_transitionFrom || !_transitionTo) return;
  _transitionT = Math.min(1, _transitionT + delta / 2.0);
  const t = _transitionT * _transitionT * (3 - 2 * _transitionT);
  const f = _transitionFrom, to = _transitionTo;
  setColorGrade({
    contrast: f.contrast + (to.contrast - f.contrast) * t,
    saturation: f.saturation + (to.saturation - f.saturation) * t,
    temperature: f.temperature + (to.temperature - f.temperature) * t,
    haze: f.haze + (to.haze - f.haze) * t,
    lift: f.lift + (to.lift - f.lift) * t,
    shadowTint: f.shadowTint.clone().lerp(to.shadowTint, t),
    highlightTint: f.highlightTint.clone().lerp(to.highlightTint, t),
  });
  if (_transitionT >= 1) { _transitionFrom = null; _transitionTo = null; }
}
export function setKuwahara(v) {
  if (kuwaharaPass) setKuwaharaStrength(kuwaharaPass, v);
}
export function getKuwaharaPass() { return kuwaharaPass; }
export function updateFilmGrainPass(time) {
  if (filmGrainPass) updateFilmGrain(filmGrainPass, time);
}
export function setFilmGrain(v) {
  if (filmGrainPass) setFilmGrainIntensity(filmGrainPass, v);
}
export function enableFilmGrain(enabled) {
  if (filmGrainPass) filmGrainPass.enabled = !!enabled;
}
export function getFilmGrainPass() { return filmGrainPass; }
export function getComposer() { return composer; }
export function getBloomPass() { return bloomPass; }
export function getBokehPass() { return bokehPass; }
export function enableDOF(enabled) { if (bokehPass) bokehPass.enabled = !!enabled; }
export function setDOFFocus(depth) { if (bokehPass && bokehPass.uniforms) bokehPass.uniforms.focus.value = Math.min(0.9, Math.max(0.2, depth)); }
export function setDOFAperture(v) { if (bokehPass && bokehPass.uniforms) bokehPass.uniforms.aperture.value = v; }
export function setVignetteStrength(v) { if (vignettePass) vignettePass.uniforms.vignetteStrength.value = Math.max(0, Math.min(1, v)); }
export function setChromaticAberration(v) { if (vignettePass) vignettePass.uniforms.chromaticAberration.value = Math.max(0, Math.min(0.01, v)); }
