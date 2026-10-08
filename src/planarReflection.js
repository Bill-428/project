import * as THREE from 'three';

export class PlanarReflection {
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    const {
      textureWidth = 512,
      textureHeight = 512,
      planeY = 0,
      clipBias = 0.02,
      reflectStrength = 0.5,
      updateEveryNFrames = 2
    } = options;
    this.planeY = planeY;
    this.clipBias = clipBias;
    this.reflectStrength = reflectStrength;
    this.updateEveryNFrames = updateEveryNFrames;
    this._frameCounter = 0;
    this.renderTarget = new THREE.WebGLRenderTarget(textureWidth, textureHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType
    });
    this.renderTarget.texture.name = 'PlanarReflection';
    this.reflectionCamera = new THREE.PerspectiveCamera();
    this.reflectionCamera.position.copy(camera.position);
    this.reflectionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), planeY);
    this.hiddenInReflection = new Set();
    this.shownInReflection = new Set();
    this._visibilityCache = new Map();
    this.textureMatrix = new THREE.Matrix4();
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.enabled = true;
    this._clipPlane = null;
  }

  hideInReflection(object) { this.hiddenInReflection.add(object); }
  showInReflection(object) { this.shownInReflection.add(object); }
  removeFromReflection(object) {
    this.hiddenInReflection.delete(object);
    this.shownInReflection.delete(object);
  }

    update() {
    if (!this.enabled) return;
    this._frameCounter++;
    if (this._frameCounter % this.updateEveryNFrames !== 0) return;

    const camera = this.camera;
    const reflectionCamera = this.reflectionCamera;

    this._visibilityCache.clear();
    this.hiddenInReflection.forEach(obj => {
      this._visibilityCache.set(obj, obj.visible);
      obj.visible = false;
    });
    this.shownInReflection.forEach(obj => {
      this._visibilityCache.set(obj, obj.visible);
      obj.visible = true;
    });

    const cameraWorldPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPosition);
    const reflectedPosition = cameraWorldPosition.clone();
    reflectedPosition.y = 2 * this.planeY - cameraWorldPosition.y;
    reflectionCamera.position.copy(reflectedPosition);

    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    const lookAtPoint = cameraWorldPosition.clone().add(cameraDirection.multiplyScalar(10));
    lookAtPoint.y = 2 * this.planeY - lookAtPoint.y;
    reflectionCamera.lookAt(lookAtPoint);
    reflectionCamera.fov = camera.fov;
    reflectionCamera.aspect = camera.aspect;
    reflectionCamera.near = camera.near;
    reflectionCamera.far = camera.far;
    reflectionCamera.updateProjectionMatrix();

    const renderer = this.renderer;
    const currentRenderTarget = renderer.getRenderTarget();
    const oldClippingPlanes = renderer.clippingPlanes;
    const oldLocalClipping = renderer.localClippingEnabled;

    const clipPlane = this.reflectionPlane.clone();
    clipPlane.normal.negate();
    clipPlane.constant = -clipPlane.constant + this.clipBias;
    renderer.clippingPlanes = [clipPlane];
    renderer.localClippingEnabled = false;
    renderer.setRenderTarget(this.renderTarget);
    renderer.clear();

    // ===== 关键修复：try-catch 保底 + 逐对象诊断 =====
    try {
      renderer.render(this.scene, reflectionCamera);
    } catch (e) {
      console.warn('[PlanarReflection] 反射渲染出错，已跳过本帧:', e.message);
      // 诊断：遍历场景找出哪个材质有问题
      this.scene.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.isShaderMaterial) {
          const u = obj.material.uniforms;
          for (const key in u) {
            if (u[key] === undefined || u[key] === null) {
              console.warn(`  → 可疑对象: ${obj.name || obj.type}, uniform: ${key} =`, u[key]);
            }
          }
        }
      });
    }

    renderer.setRenderTarget(currentRenderTarget);
    renderer.clippingPlanes = oldClippingPlanes;
    renderer.localClippingEnabled = oldLocalClipping;

    this._visibilityCache.forEach((visible, obj) => { obj.visible = visible; });
    this.updateTextureMatrix();
  }


  updateTextureMatrix() {
    this.textureMatrix.identity();
    this.textureMatrix.multiply(this.reflectionCamera.projectionMatrix);
    this.textureMatrix.multiply(this.reflectionCamera.matrixWorldInverse);
  }

  getTexture() { return this.renderTarget.texture; }
  getStrength() { return this.reflectStrength; }
  setStrength(v) { this.reflectStrength = Math.max(0, Math.min(1, v)); }
  setSize(width, height) { this.renderTarget.setSize(width, height); }
  dispose() { this.renderTarget.dispose(); }
}

export function createReflectionDouble(characterGroup, options = {}) {
  const {
    baseOpacity = 0.3,
    baseScale = 0.95,
    colorTint = 0x4a3a7a
  } = options;
  const doubleGroup = new THREE.Group();
  doubleGroup.visible = false;
  characterGroup.traverse(child => {
    if (child.isMesh) {
      const clonedGeo = child.geometry.clone();
      const doubleMat = new THREE.MeshBasicMaterial({
        color: colorTint,
        transparent: true,
        opacity: baseOpacity,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const clonedMesh = new THREE.Mesh(clonedGeo, doubleMat);
      clonedMesh.position.copy(child.position);
      clonedMesh.rotation.copy(child.rotation);
      clonedMesh.scale.copy(child.scale);
      doubleGroup.add(clonedMesh);
    }
  });
  let clarity = 0;
  const api = {
    group: doubleGroup,
    update(characterPosition, characterRotation, time) {
      doubleGroup.position.set(
        characterPosition.x,
        -characterPosition.y + 0.1,
        characterPosition.z
      );
      doubleGroup.rotation.copy(characterRotation);
      doubleGroup.scale.y = -Math.abs(doubleGroup.scale.y || 1) * baseScale;
      doubleGroup.traverse(child => {
        if (child.isMesh && child.material) {
          const targetOpacity = baseOpacity + clarity * (0.7 - baseOpacity);
          child.material.opacity = targetOpacity + Math.sin(time * 2) * 0.02;
          const tint = new THREE.Color(colorTint).lerp(new THREE.Color(0xffffff), clarity * 0.6);
          child.material.color.copy(tint);
        }
      });
    },
    setClarity(v) { clarity = Math.max(0, Math.min(1, v)); },
    getClarity() { return clarity; },
    dispose() {
      doubleGroup.traverse(child => {
        if (child.isMesh) { child.geometry.dispose(); child.material.dispose(); }
      });
    }
  };
  return api;
}
