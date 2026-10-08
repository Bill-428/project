// colliders.js —— 轻量静态碰撞系统（XZ 平面）
// 支持三种碰撞体：box(轴对齐矩形) / circle(圆) / ellipse(椭圆)。
// 纯 CPU 数据：不创建 Mesh、不进 scene、零渲染开销。
// 碰撞体在模型加载时一次性生成；运行时仅做"圆(角色) vs 碰撞体"的逐轴扫描。
import * as THREE from 'three';

const colliders = [];

export function clearColliders() { colliders.length = 0; }

// 新增矩形碰撞体（XZ 范围）
export function addColliderBox(minX, minZ, maxX, maxZ) {
    colliders.push({ type: 'box', minX, minZ, maxX, maxZ });
}
// 新增圆形碰撞体（cx,cz 圆心；r 为世界半径，不含角色半径）
export function addColliderCircle(cx, cz, r) {
    colliders.push({ type: 'circle', cx, cz, r });
}
// 新增椭圆碰撞体（rx/rz 为两轴半长）
export function addColliderEllipse(cx, cz, rx, rz) {
    colliders.push({ type: 'ellipse', cx, cz, rx, rz });
}

// 从模型组的 userData.colliders 批量注册（models.js 加载时写入）
export function registerColliders(group) {
    if (group && Array.isArray(group.userData.colliders)) {
        for (const c of group.userData.colliders) colliders.push(c);
    }
}

export function getColliderCount() { return colliders.length; }

// ---- 各碰撞体在行 z 上的 ±X 进入点；不经过返回 null ----
function entryXPlus(c, z, r) {
    switch (c.type) {
        case 'box': {
            if (z <= c.minZ - r || z >= c.maxZ + r) return null;
            return c.minX - r;
        }
        case 'circle': {
            const R = c.r + r, dz = z - c.cz;
            if (dz * dz > R * R) return null;
            return c.cx - Math.sqrt(R * R - dz * dz);
        }
        case 'ellipse': {
            const rx = c.rx + r, rz = c.rz + r, t = (z - c.cz) / rz;
            if (t * t > 1) return null;
            return c.cx - rx * Math.sqrt(1 - t * t);
        }
    }
    return null;
}
function entryXMinus(c, z, r) {
    switch (c.type) {
        case 'box': {
            if (z <= c.minZ - r || z >= c.maxZ + r) return null;
            return c.maxX + r;
        }
        case 'circle': {
            const R = c.r + r, dz = z - c.cz;
            if (dz * dz > R * R) return null;
            return c.cx + Math.sqrt(R * R - dz * dz);
        }
        case 'ellipse': {
            const rx = c.rx + r, rz = c.rz + r, t = (z - c.cz) / rz;
            if (t * t > 1) return null;
            return c.cx + rx * Math.sqrt(1 - t * t);
        }
    }
    return null;
}
function entryZPlus(c, x, r) {
    switch (c.type) {
        case 'box': {
            if (x <= c.minX - r || x >= c.maxX + r) return null;
            return c.minZ - r;
        }
        case 'circle': {
            const R = c.r + r, dx = x - c.cx;
            if (dx * dx > R * R) return null;
            return c.cz - Math.sqrt(R * R - dx * dx);
        }
        case 'ellipse': {
            const rx = c.rx + r, rz = c.rz + r, t = (x - c.cx) / rx;
            if (t * t > 1) return null;
            return c.cz - rz * Math.sqrt(1 - t * t);
        }
    }
    return null;
}
function entryZMinus(c, x, r) {
    switch (c.type) {
        case 'box': {
            if (x <= c.minX - r || x >= c.maxX + r) return null;
            return c.maxZ + r;
        }
        case 'circle': {
            const R = c.r + r, dx = x - c.cx;
            if (dx * dx > R * R) return null;
            return c.cz + Math.sqrt(R * R - dx * dx);
        }
        case 'ellipse': {
            const rx = c.rx + r, rz = c.rz + r, t = (x - c.cx) / rx;
            if (t * t > 1) return null;
            return c.cz + rz * Math.sqrt(1 - t * t);
        }
    }
    return null;
}

// 逐轴扫描：取移动方向上最近的一道碰撞体的进入边界
function clampX(fromX, fromZ, toX, r) {
    let limit = toX;
    const dir = toX >= fromX ? 1 : -1;
    for (const c of colliders) {
        const e = dir > 0 ? entryXPlus(c, fromZ, r) : entryXMinus(c, fromZ, r);
        if (e === null) continue;
        if (dir > 0 ? (e >= fromX && e < limit) : (e <= fromX && e > limit)) limit = e;
    }
    return limit;
}
function clampZ(fromZ, fromX, toZ, r) {
    let limit = toZ;
    const dir = toZ >= fromZ ? 1 : -1;
    for (const c of colliders) {
        const e = dir > 0 ? entryZPlus(c, fromX, r) : entryZMinus(c, fromX, r);
        if (e === null) continue;
        if (dir > 0 ? (e >= fromZ && e < limit) : (e <= fromZ && e > limit)) limit = e;
    }
    return limit;
}

// 逐轴碰撞解析：from 为上帧位置，to 为本帧目标位置（原地修改并返回）。
// 线段扫描而非端点判断，薄墙/大步长也不会穿透；贴墙可切向滑动。
export function resolveCollisions(from, to, radius) {
    if (colliders.length === 0) return to;
    const r = radius || 0.5;
    to.x = clampX(from.x, from.z, to.x, r);
    to.z = clampZ(from.z, to.x, to.z, r);
    return to;
}

// 调试可视化：box 画矩形线框，circle/ellipse 画圆环线框（默认不调用，零渲染）
export function createColliderDebugGroup() {
    const group = new THREE.Group();
    const boxMat = new THREE.LineBasicMaterial({ color: 0xff00ff });
    const ringMat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const SEG = 32;
    for (const c of colliders) {
        if (c.type === 'box') {
            const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
            const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.05, d));
            const line = new THREE.LineSegments(geo, boxMat);
            line.position.set((c.minX + c.maxX) / 2, 0.05, (c.minZ + c.maxZ) / 2);
            group.add(line);
        } else {
            const rx = c.type === 'circle' ? c.r : c.rx;
            const rz = c.type === 'circle' ? c.r : c.rz;
            const pts = [];
            for (let i = 0; i <= SEG; i++) {
                const a = (i / SEG) * Math.PI * 2;
                pts.push(new THREE.Vector3(c.cx + Math.cos(a) * rx, 0.05, c.cz + Math.sin(a) * rz));
            }
            group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
        }
    }
    return group;
}
