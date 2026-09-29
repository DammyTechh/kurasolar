import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * Procedural hero scene: a tilted rooftop array under a slow gold sun,
 * with energy pulses flowing into a wall battery. No external assets.
 */

function cssColor(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function useCellTexture(cell: string, frame: string) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = frame;
    g.fillRect(0, 0, c.width, c.height);
    const cols = 6, rows = 4, pad = 10, gap = 5;
    const w = (c.width - pad * 2 - gap * (cols - 1)) / cols;
    const h = (c.height - pad * 2 - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const x = pad + q * (w + gap), y = pad + r * (h + gap);
        const grad = g.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, cell);
        grad.addColorStop(1, '#1a0f26');
        g.fillStyle = grad;
        g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(255,255,255,0.08)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + w / 2, y);
        g.lineTo(x + w / 2, y + h);
        g.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [cell, frame]);
}

function Panels({ primary, dark }: { primary: string; dark: string }) {
  const tex = useCellTexture(primary, '#d9d2e3');
  const positions = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) out.push([-2.1 + c * 1.4, 0.55, -0.55 + r * 1.15]);
    return out;
  }, []);
  return (
    <group>
      {positions.map((p, i) => (
        <group key={i} position={p} rotation={[0.5, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.3, 0.05, 1.0]} />
            <meshStandardMaterial attach="material-0" color="#cfc6da" />
            <meshStandardMaterial attach="material-1" color="#cfc6da" />
            <meshStandardMaterial attach="material-2" map={tex} metalness={0.55} roughness={0.28} />
            <meshStandardMaterial attach="material-3" color={dark} />
            <meshStandardMaterial attach="material-4" color="#cfc6da" />
            <meshStandardMaterial attach="material-5" color="#cfc6da" />
          </mesh>
          <mesh position={[0, -0.24, -0.3]}>
            <boxGeometry args={[0.06, 0.4, 0.06]} />
            <meshStandardMaterial color="#b9b0c6" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Sun({ accent, lightRef }: { accent: string; lightRef: React.RefObject<THREE.DirectionalLight | null> }) {
  const group = useRef<THREE.Group>(null);
  const rays = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Sweep slowly across the sky between morning and afternoon.
    const a = Math.PI * (0.5 + 0.16 * Math.sin(t * 0.12));
    const pos = new THREE.Vector3(Math.cos(a) * 4.2 - 0.4, 2.6 + Math.sin(a) * 1.1, -3.0);
    group.current?.position.copy(pos);
    lightRef.current?.position.copy(pos).multiplyScalar(1.4);
    if (rays.current) {
      rays.current.quaternion.copy(camera.quaternion);
      rays.current.rotateZ(Math.sin(t * 0.25) * 0.06);
    }
  });
  const rayAngles = useMemo(() => Array.from({ length: 7 }, (_, i) => Math.PI * (0.12 + (i * 0.76) / 6)), []);
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.55, 48, 48]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <group ref={rays}>
        {rayAngles.map((ang, i) => (
          <mesh key={i} position={[Math.cos(ang) * 1.05, Math.sin(ang) * 1.05, 0]} rotation={[0, 0, ang - Math.PI / 2]}>
            <boxGeometry args={[i % 2 ? 0.16 : 0.2, i % 2 ? 0.34 : 0.46, 0.02]} />
            <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function EnergyFlow({ accent }: { accent: string }) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.9, 0.35, 0.6),
      new THREE.Vector3(2.7, 0.3, 0.9),
      new THREE.Vector3(3.15, 0.55, 0.35),
      new THREE.Vector3(3.3, 0.9, -0.2),
    ]),
    [],
  );
  const dots = useRef<THREE.Mesh[]>([]);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 40, 0.025, 8, false), [curve]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    dots.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.28 + i / 4) % 1;
      m.position.copy(curve.getPointAt(u));
      const s = 0.6 + Math.sin(u * Math.PI) * 0.6;
      m.scale.setScalar(s);
    });
  });
  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial color="#e7e0ef" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => { if (el) dots.current[i] = el; }}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Battery({ primary, dark, accent }: { primary: string; dark: string; accent: string }) {
  const level = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!level.current) return;
    const v = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 0.35));
    level.current.scale.y = v;
    level.current.position.y = 0.55 + (v * 1.0) / 2;
  });
  return (
    <group position={[3.45, 0, -0.55]}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.7, 1.5, 0.42]} />
        <meshStandardMaterial color={primary} metalness={0.2} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.66, 0]}>
        <boxGeometry args={[0.72, 0.12, 0.44]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      <mesh position={[0, 1.05, 0.215]}>
        <boxGeometry args={[0.12, 1.0, 0.01]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.18} />
      </mesh>
      <mesh ref={level} position={[0, 1.0, 0.222]}>
        <boxGeometry args={[0.1, 1.0, 0.01]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ pointer }, dt) => {
    if (!g.current) return;
    const k = 1 - Math.pow(0.001, dt);
    g.current.rotation.y += (pointer.x * 0.12 - 0.22 - g.current.rotation.y) * k;
    g.current.rotation.x += (-pointer.y * 0.05 - g.current.rotation.x) * k;
  });
  return <group ref={g} rotation={[0, -0.22, 0]}>{children}</group>;
}

export default function HeroScene() {
  const primary = cssColor('--ks-primary', '#5B2A86');
  const dark = cssColor('--ks-primary-dark', '#34184A');
  const accent = cssColor('--ks-accent', '#C8973F');
  const sunLight = useRef<THREE.DirectionalLight>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [3.2, 4.6, 11.5], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ camera }) => camera.lookAt(0.3, 1.35, -0.6)}
      aria-hidden
    >
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#ffffff', primary, 0.6]} />
      <directionalLight ref={sunLight} castShadow intensity={2.2} color="#fff4df" shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 0.1, 30]} />
      </directionalLight>
      <Rig>
        <mesh position={[0.4, -0.05, 0]} receiveShadow>
          <boxGeometry args={[7.4, 0.12, 3.6]} />
          <meshStandardMaterial color="#f3eef8" roughness={0.9} />
        </mesh>
        <mesh position={[0.4, -0.17, 0]}>
          <boxGeometry args={[7.5, 0.12, 3.7]} />
          <meshStandardMaterial color={dark} roughness={0.8} />
        </mesh>
        <Panels primary={primary} dark={dark} />
        <EnergyFlow accent={accent} />
        <Battery primary={primary} dark={dark} accent={accent} />
        <Sun accent={accent} lightRef={sunLight} />
      </Rig>
    </Canvas>
  );
}
