// sky.js —— 渐变天空 + 移动云层
import * as THREE from 'three';

const SkyShader = {
    uniforms: { topColor: { value: new THREE.Color(0x1a1a3e) }, bottomColor: { value: new THREE.Color(0x4a3a6a) }, offset: { value: 20 }, exponent: { value: 0.7 } },
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorldPosition=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main(){ float h=normalize(vWorldPosition+vec3(0.0,offset,0.0)).y; float t=max(pow(max(h,0.0),exponent),0.0); gl_FragColor=vec4(mix(bottomColor,topColor,t),1.0); }`
};

function createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 256);
    for (let i = 0; i < 25; i++) {
        const x = Math.random()*512, y = 60+Math.random()*140, r = 30+Math.random()*60;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        const a = 0.15+Math.random()*0.25;
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${a*0.5})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

export function createSky(scene, options = {}) {
    const { topColor = 0x1a1a3e, bottomColor = 0x4a3a6a, cloudCount = 4, cloudSpeed = 0.5 } = options;
    const skyGeo = new THREE.SphereGeometry(500, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms),
        vertexShader: SkyShader.vertexShader, fragmentShader: SkyShader.fragmentShader,
        side: THREE.BackSide, depthWrite: false
    });
    skyMat.uniforms.topColor.value.setHex(topColor);
    skyMat.uniforms.bottomColor.value.setHex(bottomColor);
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -1;
    scene.add(sky);

    const cloudTexture = createCloudTexture();
    const clouds = [];
    for (let i = 0; i < cloudCount; i++) {
        const cloudGeo = new THREE.PlaneGeometry(200, 60);
        const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, opacity: 0.4+Math.random()*0.3, depthWrite: false, side: THREE.DoubleSide });
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        const angle = (i/cloudCount)*Math.PI*2+Math.random()*0.5;
        const radius = 150+Math.random()*100;
        cloud.position.set(Math.cos(angle)*radius, 40+Math.random()*50, Math.sin(angle)*radius);
        cloud.rotation.x = -Math.PI/2;
        cloud.rotation.z = Math.random()*Math.PI;
        cloud.userData = { speed: cloudSpeed*(0.5+Math.random()*0.8), radius, angle, height: cloud.position.y };
        scene.add(cloud);
        clouds.push(cloud);
    }

    return {
        setColors(top, bottom) { skyMat.uniforms.topColor.value.setHex(top); skyMat.uniforms.bottomColor.value.setHex(bottom); },
        lerpColors(fromTop, fromBottom, toTop, toBottom, t) {
            const c1 = new THREE.Color(fromTop), c2 = new THREE.Color(toTop); c1.lerp(c2, t);
            skyMat.uniforms.topColor.value.copy(c1);
            const c3 = new THREE.Color(fromBottom), c4 = new THREE.Color(toBottom); c3.lerp(c4, t);
            skyMat.uniforms.bottomColor.value.copy(c3);
        },
        setCloudOpacity(v) { clouds.forEach(c => c.material.opacity = v); },
        update(delta, time) {
            clouds.forEach(cloud => {
                cloud.userData.angle += cloud.userData.speed * delta * 0.05;
                cloud.position.x = Math.cos(cloud.userData.angle) * cloud.userData.radius;
                cloud.position.z = Math.sin(cloud.userData.angle) * cloud.userData.radius;
                if (cloud.material.map) cloud.material.map.offset.x += delta * 0.01;
            });
        },
        dispose() { scene.remove(sky); skyGeo.dispose(); skyMat.dispose(); clouds.forEach(c => { scene.remove(c); c.geometry.dispose(); c.material.map?.dispose(); c.material.dispose(); }); }
    };
}
