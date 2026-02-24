import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

function GlassSphere({ position, scale, speed }: { position: [number, number, number]; scale: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * speed * 0.3;
      ref.current.rotation.y = state.clock.elapsedTime * speed * 0.2;
    }
  });
  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={1.5}>
      <mesh ref={ref} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 1]} />
        <MeshDistortMaterial
          color="#7c3aed"
          speed={2}
          distort={0.3}
          roughness={0}
          metalness={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>
    </Float>
  );
}

function FloatingTorus({ position, scale, speed }: { position: [number, number, number]; scale: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * speed * 0.5;
      ref.current.rotation.z = state.clock.elapsedTime * speed * 0.3;
    }
  });
  return (
    <Float speed={speed * 0.8} rotationIntensity={0.6} floatIntensity={2}>
      <mesh ref={ref} position={position} scale={scale}>
        <torusGeometry args={[1, 0.4, 16, 32]} />
        <MeshDistortMaterial
          color="#06b6d4"
          speed={1.5}
          distort={0.15}
          roughness={0.1}
          metalness={0.9}
          transparent
          opacity={0.5}
        />
      </mesh>
    </Float>
  );
}

function FloatingOctahedron({ position, scale, speed }: { position: [number, number, number]; scale: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * speed * 0.4;
      ref.current.rotation.z = state.clock.elapsedTime * speed * 0.2;
    }
  });
  return (
    <Float speed={speed * 0.6} rotationIntensity={0.5} floatIntensity={1.8}>
      <mesh ref={ref} position={position} scale={scale}>
        <octahedronGeometry args={[1]} />
        <MeshDistortMaterial
          color="#ec4899"
          speed={2}
          distort={0.2}
          roughness={0.05}
          metalness={0.85}
          transparent
          opacity={0.45}
        />
      </mesh>
    </Float>
  );
}

function Particles() {
  const count = 80;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      ref.current.rotation.x = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#a78bfa" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export function Hero3DScene() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#c4b5fd" />
        <directionalLight position={[-5, -5, -5]} intensity={0.4} color="#67e8f9" />
        <pointLight position={[0, 3, 3]} intensity={0.8} color="#f0abfc" />
        
        <GlassSphere position={[-3.5, 1.5, -1]} scale={1.2} speed={0.8} />
        <FloatingTorus position={[3.5, -0.5, -2]} scale={0.9} speed={1.2} />
        <FloatingOctahedron position={[1.5, 2.5, -3]} scale={0.7} speed={1} />
        <GlassSphere position={[-2, -2, -2]} scale={0.6} speed={1.4} />
        <FloatingTorus position={[4, 2, -4]} scale={0.5} speed={0.9} />
        <Particles />
      </Canvas>
    </div>
  );
}

export default Hero3DScene;
