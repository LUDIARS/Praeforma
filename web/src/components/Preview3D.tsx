// three.js を使った 3D placeholder preview。 OrbitControls なし (= 最小)。
// 用途: layout.kind='world-3d' のプロジェクトで、 placement の 3D 配置を視覚化する。

import React from 'react';
import * as THREE from 'three';
import type { PlacementItem } from './PlacementCanvas.tsx';

interface Props {
  items: PlacementItem[];
  shapeFor: (it: PlacementItem) => 'cube' | 'sphere' | 'plane' | 'cylinder';
  colorFor: (it: PlacementItem) => string;
}

export function Preview3D({ items, shapeFor, colorFor }: Props): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const meshesRef = React.useRef<Map<string, THREE.Mesh>>(new Map());
  const animRef = React.useRef<number | null>(null);

  // 初期化
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6f7f9);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    camera.position.set(8, 6, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 7);
    scene.add(ambient, directional);

    // grid + axes
    const grid = new THREE.GridHelper(20, 20, 0xc8cad0, 0xe3e5ea);
    scene.add(grid);
    const axes = new THREE.AxesHelper(2);
    scene.add(axes);

    // 簡易マウス回転
    let phi = 0.6, theta = 0.7, radius = 14;
    let dragging = false;
    let lastX = 0, lastY = 0;
    const onDown = (e: MouseEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      theta += (e.clientX - lastX) * 0.005;
      phi -= (e.clientY - lastY) * 0.005;
      phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => {
      radius *= e.deltaY > 0 ? 1.1 : 0.9;
      radius = Math.max(3, Math.min(80, radius));
      e.preventDefault();
    };
    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    function render(): void {
      camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
      camera.position.z = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(render);
    }
    render();

    function onResize(): void {
      if (!containerRef.current) return;
      const w2 = containerRef.current.clientWidth;
      const h2 = containerRef.current.clientHeight || 400;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    }
    window.addEventListener('resize', onResize);

    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.domElement.removeEventListener('mousedown', onDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  // items の差分を mesh に反映
  React.useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const existing = meshesRef.current;
    const seen = new Set<string>();

    for (const it of items) {
      seen.add(it.id);
      let mesh = existing.get(it.id);
      const targetGeom = shapeFor(it);
      const colorHex = new THREE.Color(colorFor(it));

      if (!mesh) {
        const geom = makeGeometry(targetGeom);
        const mat = new THREE.MeshStandardMaterial({ color: colorHex, transparent: true, opacity: 0.85 });
        mesh = new THREE.Mesh(geom, mat);
        mesh.userData.geomKind = targetGeom;
        scene.add(mesh);
        existing.set(it.id, mesh);
      } else if (mesh.userData.geomKind !== targetGeom) {
        // shape 変更時は geometry 差し替え
        mesh.geometry.dispose();
        mesh.geometry = makeGeometry(targetGeom);
        mesh.userData.geomKind = targetGeom;
      }

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(colorHex);

      // 2D の x,y を 3D の x,z にマップ (= y up、 平面に置く)
      mesh.position.set(it.x / 80, 0.5 * it.sy, it.y / 80);
      mesh.scale.set(it.sx, it.sy, it.sx);
    }

    // 削除分
    for (const [id, mesh] of existing.entries()) {
      if (!seen.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        existing.delete(id);
      }
    }
  }, [items, shapeFor, colorFor]);

  return <div ref={containerRef} style={{ width: '100%', height: 400, borderRadius: 8, overflow: 'hidden' }} />;
}

function makeGeometry(kind: 'cube' | 'sphere' | 'plane' | 'cylinder'): THREE.BufferGeometry {
  switch (kind) {
    case 'sphere':   return new THREE.SphereGeometry(0.5, 24, 16);
    case 'plane':    return new THREE.BoxGeometry(1, 0.05, 1);
    case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    default:         return new THREE.BoxGeometry(1, 1, 1);
  }
}
