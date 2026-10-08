// lake.js —— 湖泊创建（修改版：支持反射纹理）
import * as THREE from 'three';
import { createWaterMaterial } from './waterShader.js';
import { createShoreMaterial } from './shoreShader.js';

export function createLakeShapeFromPoints(controlPoints, smoothness = 200) {
    const pts3 = controlPoints.map(p => new THREE.Vector3(p.x, 0, p.y));
    const curve = new THREE.CatmullRomCurve3(pts3, true, 'catmullrom', 0.5);
    const sampled = curve.getPoints(smoothness);
    const pts2 = sampled.map(p => new THREE.Vector2(p.x, p.z));
    if (pts2.length > 1 && pts2[0].distanceTo(pts2[pts2.length-1]) < 0.001) {
        pts2.pop();
    }
    const shape = new THREE.Shape();
    shape.moveTo(pts2[0].x, pts2[0].y);
    for (let i = 1; i < pts2.length; i++) {
        shape.lineTo(pts2[i].x, pts2[i].y);
    }
    shape.closePath();
    return { shape, points: pts2 };
}

export function createLakeShape(controlPoints, smoothness = 200) {
    return createLakeShapeFromPoints(controlPoints, smoothness);
}

export function pointsToHolePath(points, offsetX, offsetZ) {
    let pts = points.slice();
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    area /= 2;
    if (area > 0) {
        pts.reverse();
    }
    const path = new THREE.Path();
    path.moveTo(pts[0].x + offsetX, pts[0].y + offsetZ);
    for (let i = 1; i < pts.length; i++) {
        path.lineTo(pts[i].x + offsetX, pts[i].y + offsetZ);
    }
    path.closePath();
    return path;
}

export function shapeToHolePath(shape, offsetX, offsetZ, segments = 200) {
    const points = shape.getPoints(segments);
    if (points.length > 1 && points[0].distanceTo(points[points.length-1]) < 0.001) {
        points.pop();
    }
    return pointsToHolePath(points, offsetX, offsetZ);
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * abx;
    const cy = ay + t * aby;
    const dx = px - cx;
    const dy = py - cy;
    return Math.sqrt(dx * dx + dy * dy);
}

function addEdgeFactorAttribute(geometry, shape, fadeDistance = 3.0) {
    const boundary = shape.getPoints(200);
    if (boundary.length > 1 && boundary[0].distanceTo(boundary[boundary.length - 1]) < 0.001) {
        boundary.pop();
    }
    const pos = geometry.attributes.position;
    const count = pos.count;
    const edgeFactor = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        let minDist = Infinity;
        for (let j = 0; j < boundary.length; j++) {
            const a = boundary[j];
            const b = boundary[(j + 1) % boundary.length];
            const d = pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y);
            if (d < minDist) minDist = d;
        }
        const t = Math.min(1, minDist / fadeDistance);
        edgeFactor[i] = t * t * (3 - 2 * t);
    }
    geometry.setAttribute('edgeFactor', new THREE.BufferAttribute(edgeFactor, 1));
}

function subdivideGeometry(geometry, iterations = 1, attrNames = ['position', 'uv']) {
    for (let iter = 0; iter < iterations; iter++) {
        const srcAttrs = {};
        const itemSizes = {};
        for (const name of attrNames) {
            if (geometry.attributes[name]) {
                srcAttrs[name] = geometry.attributes[name].array;
                itemSizes[name] = geometry.attributes[name].itemSize;
            }
        }
        const idx = geometry.index ? geometry.index.array : null;
        const pos = srcAttrs.position;
        const triCount = idx ? idx.length / 3 : pos.length / 9;
        const newAttrs = {};
        for (const name in srcAttrs) newAttrs[name] = [];
        for (let t = 0; t < triCount; t++) {
            const ia = idx ? idx[t * 3] : t * 3;
            const ib = idx ? idx[t * 3 + 1] : t * 3 + 1;
            const ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
            const vData = {};
            for (const name in srcAttrs) {
                const size = itemSizes[name];
                const arr = srcAttrs[name];
                const A = [], B = [], C = [];
                for (let k = 0; k < size; k++) {
                    A.push(arr[ia * size + k]);
                    B.push(arr[ib * size + k]);
                    C.push(arr[ic * size + k]);
                }
                const AB = A.map((v, k) => (v + B[k]) / 2);
                const BC = B.map((v, k) => (v + C[k]) / 2);
                const CA = C.map((v, k) => (v + A[k]) / 2);
                vData[name] = { A, B, C, AB, BC, CA };
            }
            const tris = [
                ['A', 'AB', 'CA'],
                ['AB', 'B', 'BC'],
                ['CA', 'BC', 'C'],
                ['AB', 'BC', 'CA']
            ];
            for (const [va, vb, vc] of tris) {
                for (const name in srcAttrs) {
                    const d = vData[name];
                    for (const v of [d[va], d[vb], d[vc]]) {
                        for (let k = 0; k < itemSizes[name]; k++) {
                            newAttrs[name].push(v[k]);
                        }
                    }
                }
            }
        }
        const newGeo = new THREE.BufferGeometry();
        for (const name in newAttrs) {
            newGeo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(newAttrs[name]), itemSizes[name]));
        }
        geometry = newGeo;
    }
    return geometry;
}

function createShoreRing(points, width = 4.0, segments = 300, innerOffset = 1.0) {
    const pts3 = points.map(p => new THREE.Vector3(p.x, p.y, 0));
    const curve = new THREE.CatmullRomCurve3(pts3, true, 'catmullrom', 0.5);
    const sampled = curve.getPoints(segments);
    const n = sampled.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += sampled[i].x * sampled[j].y - sampled[j].x * sampled[i].y;
    }
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i < n; i++) {
        const curr = sampled[i];
        const next = sampled[(i + 1) % n];
        const prev = sampled[(i - 1 + n) % n];
        const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
        const normal = new THREE.Vector3(tangent.y, -tangent.x, 0);
        if (area < 0) normal.negate();
        const inner = new THREE.Vector3().copy(curr).addScaledVector(normal, -innerOffset);
        positions.push(inner.x, inner.y, 0);
        uvs.push(0, i / n);
        const outer = new THREE.Vector3().copy(curr).addScaledVector(normal, width);
        positions.push(outer.x, outer.y, 0);
        uvs.push(1, i / n);
    }
    for (let i = 0; i < n; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = ((i + 1) % n) * 2;
        const d = ((i + 1) % n) * 2 + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
}

// 修改：createLake 新增 reflectionMap 参数
export function createLake(shape, position, colorOptions = {}, geometrySegments = 256, lightDir = new THREE.Vector3(20,40,20), options = {}) {
    const {
        landColor = '#423789',
        shoreWidth = 4.0,
        subdivideIterations = 2,
        edgeFadeDistance = 3.0,
        shoreInnerOffset = 0.05,
        reflectionMap = null  // 新增：平面反射纹理
    } = options;

    let geometry = new THREE.ShapeGeometry(shape, geometrySegments);
    geometry = subdivideGeometry(geometry, subdivideIterations, ['position', 'uv']);
    addEdgeFactorAttribute(geometry, shape, edgeFadeDistance);
    geometry.rotateX(-Math.PI / 2);

    // 修改：传入反射纹理
    const material = createWaterMaterial(
        colorOptions.base || '#91d4db',
        colorOptions.deep || '#143c47',
        lightDir,
        undefined, undefined, undefined, undefined,
        reflectionMap
    );

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.receiveShadow = true;
    mesh.castShadow = false;

    const shorePoints = shape.getPoints(300);
    if (shorePoints.length > 1 && shorePoints[0].distanceTo(shorePoints[shorePoints.length-1]) < 0.001) {
        shorePoints.pop();
    }
    const shoreGeometry = createShoreRing(shorePoints, shoreWidth, 300, shoreInnerOffset);
    const shoreMaterial = createShoreMaterial(
        colorOptions.base || '#91d4db',
        landColor
    );
    const shoreRing = new THREE.Mesh(shoreGeometry, shoreMaterial);
    shoreRing.renderOrder = 2;
    mesh.add(shoreRing);
    mesh.userData.shoreMaterial = shoreMaterial;
    mesh.userData.shoreRing = shoreRing;
    return mesh;
}

export function createLakeFromPoints(controlPoints, position, colorOptions = {}, smoothness = 200, geometrySegments = 256, lightDir, options = {}) {
    const { shape } = createLakeShape(controlPoints, smoothness);
    return createLake(shape, position, colorOptions, geometrySegments, lightDir, options);
}
