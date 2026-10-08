// treeWind.js —— 树木随风摆动（onBeforeCompile 注入顶点着色器）
import * as THREE from 'three';

const windUniform = { value: 0 };
export function updateTreeWind(time) { windUniform.value = time; }

function applyToMaterial(material, options = {}) {
    const { strength = 0.15, speed = 1.0, heightFactor = 0.5 } = options;
    if (!material || material.userData.treeWindApplied) return;
    material.userData.treeWindApplied = true;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = windUniform;
        shader.uniforms.uWindStrength = { value: strength };
        shader.uniforms.uWindSpeed = { value: speed };
        shader.uniforms.uWindHeightFactor = { value: heightFactor };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                uniform float uWindTime; uniform float uWindStrength; uniform float uWindSpeed; uniform float uWindHeightFactor;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                float windHeight = max(position.y, 0.0) * uWindHeightFactor;
                float windWave = sin(uWindTime * uWindSpeed + position.x * 0.1 + position.z * 0.1) * uWindStrength;
                float windWave2 = sin(uWindTime * uWindSpeed * 0.7 + position.x * 0.2) * uWindStrength * 0.5;
                transformed.x += (windWave + windWave2) * windHeight;
                transformed.z += (windWave * 0.7 - windWave2) * windHeight;`);
    };
    material.needsUpdate = true;
}

export function applyTreeWind(object, options = {}) {
    if (!object) return;
    object.traverse((child) => {
        if (child.isMesh) {
            if (Array.isArray(child.material)) child.material.forEach(m => applyToMaterial(m, options));
            else applyToMaterial(child.material, options);
        }
    });
}
