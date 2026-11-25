import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Analysis } from '@/engine/types';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { Dust, Lights } from './Environment';
import { buildGraph, type GraphNode } from './graph';
import type { SceneProps } from './Canvas3D';
import { Label3D } from './Label3D';

interface Props extends SceneProps {
  analysis: Analysis;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function SystemMapGraph({ analysis, selected, onSelect, quality, reduced }: Props) {
  const { nodes, edges } = useMemo(() => buildGraph(analysis), [analysis]);
  const n = nodes.length;
  const pos = useMemo(() => {
    const p = new Float32Array(n * 3);
    nodes.forEach((node, i) => {
      const v = node.anchor ? new THREE.Vector3(...node.anchor) : new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 10);
      p.set([v.x, v.y, v.z], i * 3);
    });
    return p;
  }, [nodes, n]);
  const vel = useMemo(() => new Float32Array(n * 3), [n]);
  const awake = useRef(1);
  const drag = useRef<{ i: number; plane: THREE.Plane; moved: boolean; start: [number, number] } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const { camera, raycaster, pointer, gl, invalidate } = useThree();
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const selIdx = selected ? nodes.findIndex((x) => x.id === selected) : -1;
  const neighbours = useMemo(() => {
    const s = new Set<number>();
    if (selIdx < 0) return s;
    for (const e of edges) { if (e.a === selIdx) s.add(e.b); if (e.b === selIdx) s.add(e.a); }
    return s;
  }, [edges, selIdx]);

  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3));
    const c = new Float32Array(edges.length * 6);
    edges.forEach((e, k) => { col.set(e.color).multiplyScalar(1.4); c.set([col.r, col.g, col.b, col.r, col.g, col.b], k * 6); });
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  }, [edges, col]);
  useEffect(() => () => lineGeom.dispose(), [lineGeom]);

  useEffect(() => {
    const up = () => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved) onSelect(nodes[d.i].id === selected ? null : nodes[d.i].id);
      drag.current = null;
      setDragging(false);
      awake.current = 1;
      invalidate();
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [nodes, onSelect, selected, invalidate]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    // ---- physics: repulsion, springs, anchors, damping (sleeps when settled)
    if (awake.current > 0.002 || drag.current) {
      let energy = 0;
      for (let i = 0; i < n; i++) {
        let fx = 0, fy = 0, fz = 0;
        const ix = pos[i * 3], iy = pos[i * 3 + 1], iz = pos[i * 3 + 2];
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = ix - pos[j * 3], dy = iy - pos[j * 3 + 1], dz = iz - pos[j * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz + 0.05;
          if (d2 > 120) continue;
          const f = 3.2 / d2;
          fx += dx * f; fy += dy * f; fz += dz * f;
        }
        const an = nodes[i].anchor;
        if (an) { fx += (an[0] - ix) * 2; fy += (an[1] - iy) * 2; fz += (an[2] - iz) * 2; }
        else { fx -= ix * 0.012; fy -= iy * 0.04; fz -= iz * 0.012; }
        vel[i * 3] += fx * dt; vel[i * 3 + 1] += fy * dt; vel[i * 3 + 2] += fz * dt;
      }
      for (const e of edges) {
        const a = e.a * 3, b = e.b * 3;
        const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-4;
        const rest = 2.6;
        const f = (d - rest) * 2.2 * e.strength / d;
        vel[a] += dx * f * dt; vel[a + 1] += dy * f * dt; vel[a + 2] += dz * f * dt;
        vel[b] -= dx * f * dt; vel[b + 1] -= dy * f * dt; vel[b + 2] -= dz * f * dt;
      }
      for (let i = 0; i < n * 3; i++) {
        vel[i] *= 0.86;
        pos[i] += vel[i] * dt * 6;
        energy += vel[i] * vel[i];
      }
      awake.current = energy / Math.max(1, n);
    }
    // ---- dragging: project pointer onto camera-facing plane through node
    const d = drag.current;
    if (d) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(d.plane, hit)) {
        pos.set([hit.x, hit.y, hit.z], d.i * 3);
        vel.fill(0, d.i * 3, d.i * 3 + 3);
      }
    }
    // ---- write instances + edges
    const m = meshRef.current;
    if (m) {
      for (let i = 0; i < n; i++) {
        const node = nodes[i];
        const focusOn = selIdx < 0 || i === selIdx || neighbours.has(i);
        tmp.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        tmp.scale.setScalar(node.size * (i === hover || i === selIdx ? 1.5 : 1));
        tmp.updateMatrix();
        m.setMatrixAt(i, tmp.matrix);
        col.set(node.color).multiplyScalar(focusOn ? (node.kind === 'module' ? 1.6 : 2.4) : 0.3);
        m.setColorAt(i, col);
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    const lp = lineGeom.getAttribute('position') as THREE.BufferAttribute;
    edges.forEach((e, k) => {
      lp.array.set([pos[e.a * 3], pos[e.a * 3 + 1], pos[e.a * 3 + 2], pos[e.b * 3], pos[e.b * 3 + 1], pos[e.b * 3 + 2]], k * 6);
    });
    lp.needsUpdate = true;
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId === undefined) return;
    e.stopPropagation();
    const i = e.instanceId;
    const p = new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
    drag.current = { i, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, p), moved: false, start: [e.clientX, e.clientY] };
    setDragging(true);
    gl.domElement.style.cursor = 'grabbing';
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (d && !d.moved && Math.hypot(e.clientX - d.start[0], e.clientY - d.start[1]) > 4) d.moved = true;
    if (!d && e.instanceId !== undefined) { setHover(e.instanceId); gl.domElement.style.cursor = 'grab'; }
  };

  const labelIdx = [...new Set([hover, selIdx >= 0 ? selIdx : null])].filter((x): x is number => x !== null);

  return (
    <>
      <Lights />
      <fog attach="fog" args={['#050810', 18, 46]} />
      <lineSegments ref={lineRef} geometry={lineGeom}>
        <lineBasicMaterial vertexColors transparent opacity={0.55} toneMapped={false} depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(1, n)]} key={n}
        onPointerDown={onDown} onPointerMove={onMove} onPointerOut={() => { setHover(null); if (!drag.current) gl.domElement.style.cursor = ''; }}>
        <sphereGeometry args={[1, quality === 'low' ? 10 : 20, quality === 'low' ? 10 : 20]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {nodes.map((node, i) => node.kind === 'module' && <ModuleLabel key={node.id} pos={pos} i={i} node={node} />)}
      {labelIdx.filter((i) => nodes[i]?.kind !== 'module').map((i) => <NodeLabel key={nodes[i].id} pos={pos} i={i} node={nodes[i]} />)}
      <Dust quality={quality} />
      <CameraRig focus={null} home={[0, 9, 20]} autoRotate={false} reduced={reduced} enabled={!dragging} maxDistance={40} />
      <Effects quality={quality} />
    </>
  );
}

function ModuleLabel({ pos, i, node }: { pos: Float32Array; i: number; node: GraphNode }) {
  return (
    <Label3D track={(v) => v.set(pos[i * 3], pos[i * 3 + 1] + 0.95, pos[i * 3 + 2])} k={16} className="whitespace-nowrap text-center"
      lines={[{ text: node.label, className: 'font-display text-[13px] font-semibold text-ink' }, { text: node.sub, className: 'mono text-[10px]', color: node.color }]} />
  );
}
function NodeLabel({ pos, i, node }: { pos: Float32Array; i: number; node: GraphNode }) {
  return (
    <Label3D track={(v) => v.set(pos[i * 3], pos[i * 3 + 1] + 0.6, pos[i * 3 + 2])} k={13} className="max-w-[260px] rounded-lg border border-white/15 bg-void-2/90 px-2.5 py-1 text-center"
      lines={[{ text: node.label, className: 'truncate text-[12px] font-semibold text-ink' }, { text: `${node.kind} · ${node.sub}`, className: 'mono text-[10px]', color: node.color }]} />
  );
}
