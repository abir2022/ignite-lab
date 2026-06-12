import React, { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import * as THREE from 'three';
import ElectricalPanel from '../components/ElectricalPanel';
import Editor from '@monaco-editor/react';

// =========================================================
// INTERACTIVE PART COMPONENT - Click to assemble/disassemble
// =========================================================
const getRandDir = (id) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const x = Math.sin(hash + 1) * 3.5;
  const y = Math.abs(Math.sin(hash + 2)) * 3.0 + 2.0; // blast upwards
  const z = Math.cos(hash + 3) * 3.5;
  return [x, y, z];
};

function InteractivePart({ 
  partId, 
  partName, 
  children, 
  position = [0,0,0], 
  rotation = [0,0,0],
  removedParts, 
  onTogglePart, 
  hoveredPart, 
  onHover, 
  assemblyMode,
  removeDirection = [0, 1, 0],
  removeDistance = 2.5,
  explosionLevel = 0,
  isPhysicalExploded = false
}) {
  const groupRef = useRef();
  const [animProgress, setAnimProgress] = useState(removedParts.has(partId) ? 1 : 0);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState([0,0,0]);
  const [currentPos, setCurrentPos] = useState(position);
  const [justSnapped, setJustSnapped] = useState(false);
  const [snapScale, setSnapScale] = useState(0);
  const [physExplodeOffset, setPhysExplodeOffset] = useState([0,0,0]);

  const isRemoved = removedParts.has(partId);
  const isHovered = hoveredPart === partId;
  const targetProgress = isRemoved ? 1 : 0;
  const randDir = useMemo(() => getRandDir(partId), [partId]);

  // Track when part is assembled/disassembled from external actions
  useEffect(() => {
    setAnimProgress(isRemoved ? 1 : 0);
  }, [isRemoved]);

  // Reset physical explosion offset when simulation is reset
  useEffect(() => {
    if (!isPhysicalExploded) {
      setPhysExplodeOffset([0, 0, 0]);
    }
  }, [isPhysicalExploded]);

  // Drag handlers (only in assembly mode)
  const handlePointerDown = (e) => {
    if (!assemblyMode) return;
    e.stopPropagation();
    setDragging(true);
    const point = e.point;
    if (point && groupRef.current) {
      const worldPos = groupRef.current.position;
      setDragOffset([worldPos.x - point.x, worldPos.y - point.y, worldPos.z - point.z]);
    }
  };

  const handlePointerMove = (e) => {
    if (!dragging || !groupRef.current) return;
    e.stopPropagation();
    const point = e.point;
    if (point) {
      const newPos = [point.x + dragOffset[0], point.y + dragOffset[1], point.z + dragOffset[2]];
      setCurrentPos(newPos);
      groupRef.current.position.set(...newPos);
      
      const dist = Math.hypot(
        newPos[0] - position[0],
        newPos[1] - position[1],
        newPos[2] - position[2]
      );
      
      if (dist < 0.6) {
        onHover(partId + '-snap-near');
      } else {
        onHover(partId);
      }
    }
  };

  const handlePointerUp = (e) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    
    const dist = Math.hypot(
      currentPos[0] - position[0],
      currentPos[1] - position[1],
      currentPos[2] - position[2]
    );
    
    if (dist < 0.6) {
      setCurrentPos(position);
      if (groupRef.current) {
        groupRef.current.position.set(...position);
      }
      if (isRemoved) {
        onTogglePart(partId);
      }
      setJustSnapped(true);
      setSnapScale(0.1);
      setTimeout(() => setJustSnapped(false), 800);
    } else {
      const targetX = position[0] + removeDirection[0] * removeDistance * (animProgress + explosionLevel) + physExplodeOffset[0];
      const targetY = position[1] + removeDirection[1] * removeDistance * (animProgress + explosionLevel) + physExplodeOffset[1];
      const targetZ = position[2] + removeDirection[2] * removeDistance * (animProgress + explosionLevel) + physExplodeOffset[2];
      setCurrentPos([targetX, targetY, targetZ]);
    }
    onHover(null);
  };

  useFrame((state, delta) => {
    if (justSnapped) {
      setSnapScale(prev => Math.min(prev + delta * 2.0, 1.0));
    }

    if (dragging) return;

    if (isPhysicalExploded) {
      setPhysExplodeOffset(prev => [
        prev[0] + randDir[0] * delta * 4.0,
        prev[1] + randDir[1] * delta * 4.0,
        prev[2] + randDir[2] * delta * 4.0
      ]);
    }

    const speed = 4.0;
    const targetX = position[0] + removeDirection[0] * removeDistance * (animProgress + explosionLevel) + physExplodeOffset[0];
    const targetY = position[1] + removeDirection[1] * removeDistance * (animProgress + explosionLevel) + physExplodeOffset[1];
    const targetZ = position[2] + removeDirection[2] * removeDistance * (animProgress + explosionLevel) + physExplodeOffset[2];

    if (Math.abs(animProgress - targetProgress) > 0.001) {
      const next = animProgress + (targetProgress - animProgress) * Math.min(delta * speed, 1);
      setAnimProgress(next);
    }

    if (groupRef.current) {
      const currentX = groupRef.current.position.x;
      const currentY = groupRef.current.position.y;
      const currentZ = groupRef.current.position.z;

      groupRef.current.position.x = THREE.MathUtils.lerp(currentX, targetX, Math.min(delta * 12, 1));
      groupRef.current.position.y = THREE.MathUtils.lerp(currentY, targetY, Math.min(delta * 12, 1));
      groupRef.current.position.z = THREE.MathUtils.lerp(currentZ, targetZ, Math.min(delta * 12, 1));

      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, rotation[0] + (animProgress + explosionLevel) * 0.15 + (isPhysicalExploded ? randDir[0]*0.5 : 0), Math.min(delta * 8, 1));
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotation[1] + (isPhysicalExploded ? randDir[1]*0.5 : 0), Math.min(delta * 8, 1));
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, (rotation[2] || 0) + (animProgress + explosionLevel) * 0.1 + (isPhysicalExploded ? randDir[2]*0.5 : 0), Math.min(delta * 8, 1));
    }
  });

  const handleClick = (e) => {
    if (!assemblyMode || dragging) return;
    e.stopPropagation();
    onTogglePart(partId);
  };

  const handlePointerOver = (e) => {
    if (!assemblyMode) return;
    e.stopPropagation();
    onHover(partId);
    document.body.style.cursor = 'grab';
  };

  const handlePointerOut = (e) => {
    if (dragging) return;
    onHover(null);
    document.body.style.cursor = 'auto';
  };

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {children}
      
      {/* Component floating label when hovered or in exploded view */}
      {((isHovered && assemblyMode) || (explosionLevel > 0.3 && !isPhysicalExploded)) && (
        <Html distanceFactor={4} position={[0, removeDistance * 0.2, 0]}>
          <div className="bg-slate-900/90 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded font-mono text-[9px] whitespace-nowrap shadow-lg shadow-black/50 pointer-events-none">
            {partName}
          </div>
        </Html>
      )}

      {justSnapped && (
        <group position={[0, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.01, 1.2 * snapScale, 32]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={1.0 - snapScale} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.4 * snapScale, 16, 16]} />
            <meshBasicMaterial color="#34d399" transparent opacity={(1.0 - snapScale) * 0.5} wireframe depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Helper function for material properties
const getMaterialProps = (partId, defaultColor, hoveredPart, wireframe, assemblyMode, removedParts, options = {}) => {
  const isHovered = hoveredPart === partId && assemblyMode;
  const isRemoved = removedParts?.has(partId);
  const metalness = options.metalness !== undefined ? options.metalness : 0.85;
  const roughness = options.roughness !== undefined ? options.roughness : 0.15;
  
  return {
    color: isHovered ? '#22d3ee' : (isRemoved ? '#475569' : defaultColor),
    metalness: wireframe ? 0 : metalness,
    roughness: wireframe ? 1 : roughness,
    emissive: isHovered ? '#0891b2' : (options.emissive || '#000000'),
    emissiveIntensity: isHovered ? 0.9 : (options.emissiveIntensity || 0),
    wireframe: wireframe,
    transparent: isRemoved ? true : (options.transparent || false),
    opacity: isRemoved ? 0.3 : (options.opacity || 1.0)
  };
};

// =========================================================
// BOLT/NUT COMPONENT - Reusable small hardware
// =========================================================
function Bolt({ position = [0,0,0], rotation = [0,0,0], scale = 1, color = '#94a3b8' }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Hex head */}
      <mesh castShadow>
        <cylinderGeometry args={[0.04 * scale, 0.04 * scale, 0.03 * scale, 6]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Shaft */}
      <mesh position={[0, -0.035 * scale, 0]}>
        <cylinderGeometry args={[0.02 * scale, 0.02 * scale, 0.04 * scale, 8]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

function Nut({ position = [0,0,0], scale = 1, color = '#94a3b8' }) {
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[0.035 * scale, 0.035 * scale, 0.02 * scale, 6]} />
      <meshStandardMaterial color={color} metalness={0.95} roughness={0.08} />
    </mesh>
  );
}

// =========================================================
// PARTICLE VISUAL EFFECTS
// =========================================================
function SparkParticles({ active, position }) {
  const count = 15;
  const refs = useRef([]);
  useFrame((state, delta) => {
    if (!active) return;
    refs.current.forEach((ref) => {
      if (!ref) return;
      ref.position.x += (Math.random() - 0.5) * 0.4 * delta * 20;
      ref.position.y -= Math.random() * 0.8 * delta * 10;
      ref.position.z += (Math.random() - 0.5) * 0.4 * delta * 20;
      if (ref.scale.x > 0.05) {
        ref.scale.x -= delta * 2.0;
        ref.scale.y -= delta * 2.0;
        ref.scale.z -= delta * 2.0;
      } else {
        ref.position.set(0, 0, 0);
        ref.scale.set(0.4, 0.4, 0.4);
      }
    });
  });
  if (!active) return null;
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} scale={[0.4, 0.4, 0.4]}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          <meshBasicMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={3} />
        </mesh>
      ))}
    </group>
  );
}

function PaintMistParticles({ active, position, color = '#3b82f6' }) {
  const count = 20;
  const refs = useRef([]);
  useFrame((state, delta) => {
    if (!active) return;
    refs.current.forEach((ref) => {
      if (!ref) return;
      ref.position.y += Math.random() * 0.5 * delta * 8;
      ref.position.x += (Math.random() - 0.5) * 0.15 * delta * 8;
      ref.position.z += (Math.random() - 0.5) * 0.15 * delta * 8;
      if (ref.scale.x > 0.02) {
        ref.scale.x -= delta * 0.6;
        ref.scale.y -= delta * 0.6;
        ref.scale.z -= delta * 0.6;
      } else {
        ref.position.set(0, 0, 0);
        ref.scale.set(0.5, 0.5, 0.5);
      }
    });
  });
  if (!active) return null;
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} scale={[0.5, 0.5, 0.5]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function RocketPlume({ active, position, scale = 1.0 }) {
  const count = 20;
  const refs = useRef([]);
  useFrame((state, delta) => {
    if (!active) return;
    refs.current.forEach((ref) => {
      if (!ref) return;
      ref.position.y -= (1.5 + Math.random() * 2) * delta * 5;
      ref.position.x += (Math.random() - 0.5) * 0.2 * delta * 5;
      ref.position.z += (Math.random() - 0.5) * 0.2 * delta * 5;
      if (ref.scale.x > 0.05) {
        ref.scale.x -= delta * 1.5;
        ref.scale.y -= delta * 1.5;
        ref.scale.z -= delta * 1.5;
      } else {
        ref.position.set(0, 0, 0);
        ref.scale.set(1, 1, 1);
      }
    });
  });
  if (!active) return null;
  return (
    <group position={position} scale={scale}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshBasicMaterial color={Math.random() > 0.3 ? '#f97316' : '#ef4444'} emissive="#ea580c" emissiveIntensity={2} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function GasJetParticles({ active, position, rotation }) {
  const count = 12;
  const refs = useRef([]);
  useFrame((state, delta) => {
    if (!active) return;
    refs.current.forEach((ref) => {
      if (!ref) return;
      ref.position.z += (1.0 + Math.random()) * delta * 6;
      ref.position.x += (Math.random() - 0.5) * 0.1 * delta * 6;
      ref.position.y += (Math.random() - 0.5) * 0.1 * delta * 6;
      if (ref.scale.z > 0.05) {
        ref.scale.x -= delta * 1.2;
        ref.scale.y -= delta * 1.2;
        ref.scale.z -= delta * 1.2;
      } else {
        ref.position.set(0, 0, 0);
        ref.scale.set(0.6, 0.6, 0.6);
      }
    });
  });
  if (!active) return null;
  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} scale={[0.6, 0.6, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.06, 0.15, 8]} />
          <meshBasicMaterial color="#e2e8f0" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ExplosionParticles({ active }) {
  const count = 50;
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 2 + Math.random() * 6;
      temp.push({
        velocity: [
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.abs(Math.sin(phi) * Math.sin(theta)) * speed + 2.5, // blow upwards
          Math.cos(phi) * speed
        ],
        size: 0.2 + Math.random() * 0.4,
        color: Math.random() > 0.4 ? '#ef4444' : '#f97316'
      });
    }
    return temp;
  }, [active]);

  const groupRef = useRef();

  useFrame((state, delta) => {
    if (!active || !groupRef.current) return;
    groupRef.current.children.forEach((mesh, i) => {
      const p = particles[i];
      if (!p || !mesh) return;
      mesh.position.x += p.velocity[0] * delta;
      mesh.position.y += p.velocity[1] * delta;
      mesh.position.z += p.velocity[2] * delta;
      
      if (mesh.scale.x > 0.01) {
        mesh.scale.x -= delta * 0.4;
        mesh.scale.y -= delta * 0.4;
        mesh.scale.z -= delta * 0.4;
      }
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={[0, 0, 0]}>
          <sphereGeometry args={[p.size, 8, 8]} />
          <meshBasicMaterial color={p.color} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// =========================================================
// 1. COMPLEX KUKA INDUSTRIAL ROBOTIC ARM
// =========================================================
function ProceduralRoboticArm({ params, hoveredPart, wireframe, removedParts, onTogglePart, onHover, assemblyMode, explosionLevel = 0, isPhysicalExploded = false, armState = null }) {
  const baseHeight = params.baseHeight || 0.6;
  const link1Length = params.link1Length || 1.8;
  const link2Length = params.link2Length || 1.5;
  
  // Forward Kinematics angles driven by editor state
  const collarYaw = ((armState?.baseRotation || 0) * Math.PI) / 180;
  const shoulderPitch = ((armState?.shoulderRotation || 8) * Math.PI) / 180;
  const elbowPitch = ((armState?.elbowRotation || -25) * Math.PI) / 180;
  const wristRoll = ((armState?.wristRotation || 0) * Math.PI) / 180;
  const clawOpen = armState?.clawWidth !== undefined ? armState.clawWidth : (params.clawOpen || 0.3);
  const activeTool = armState?.activeTool || 'gripper';

  const L1 = link1Length;
  const L2 = link2Length;

  // Kinematic calculations
  const elbowDir = [
    Math.sin(shoulderPitch) * Math.sin(collarYaw),
    Math.cos(shoulderPitch),
    Math.sin(shoulderPitch) * Math.cos(collarYaw)
  ];
  const elbowPos = [
    L1 * elbowDir[0],
    baseHeight + 0.35 + L1 * elbowDir[1],
    L1 * elbowDir[2]
  ];

  const alpha = shoulderPitch + elbowPitch;
  const wristDir = [
    Math.sin(alpha) * Math.sin(collarYaw),
    Math.cos(alpha),
    Math.sin(alpha) * Math.cos(collarYaw)
  ];
  const wristPos = [
    elbowPos[0] + L2 * wristDir[0],
    elbowPos[1] + L2 * wristDir[1],
    elbowPos[2] + L2 * wristDir[2]
  ];

  const M = (id, color, opts) => getMaterialProps(id, color, hoveredPart, wireframe, assemblyMode, removedParts, opts);

  const drillBitRef = useRef();
  useFrame((state, delta) => {
    if (armState?.isDrilling && drillBitRef.current) {
      drillBitRef.current.rotation.y += delta * 30.0;
    }
  });

  return (
    <group position={[0, -1.8, 0]}>
      
      {/* === MOUNTING BASE PLATE === */}
      <InteractivePart partId="arm-baseplate" partName="Mounting Base Plate" position={[0, 0.04, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, -1, 0]} removeDistance={1.5}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.08, 1.8]} />
          <meshStandardMaterial {...M('arm-baseplate', '#1e293b', { metalness: 0.95, roughness: 0.25 })} />
        </mesh>
        {/* Mounting holes */}
        {[[-0.7, -0.7], [-0.7, 0.7], [0.7, -0.7], [0.7, 0.7]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.05, z]}>
            <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
      </InteractivePart>

      {/* === BASE PLATE BOLTS === */}
      <InteractivePart partId="arm-basebolts" partName="Base Mounting Bolts (Ã—8)" position={[0, 0.1, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, 1.5, 1]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
          const angle = (i / 8) * Math.PI * 2;
          return <Bolt key={i} position={[Math.cos(angle) * 0.72, 0, Math.sin(angle) * 0.72]} />;
        })}
      </InteractivePart>

      {/* === HEAVY PEDESTAL BASE === */}
      <InteractivePart partId="arm-pedestal" partName="Industrial Pedestal" position={[0, baseHeight / 2 + 0.1, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, -0.5, 0]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.62, 0.78, baseHeight, 32]} />
          <meshStandardMaterial {...M('arm-pedestal', '#0f172a', { metalness: 0.9, roughness: 0.2 })} />
        </mesh>
        {[0, 1, 2, 3].map(i => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(angle) * 0.64, -0.05, Math.sin(angle) * 0.64]} rotation={[0, angle, 0]}>
              <boxGeometry args={[0.18, 0.12, 0.03]} />
              <meshStandardMaterial color="#334155" metalness={0.8} />
            </mesh>
          );
        })}
        <mesh position={[0, baseHeight * 0.35, 0]}>
          <cylinderGeometry args={[0.66, 0.66, 0.06, 32]} />
          <meshStandardMaterial color="#ea580c" metalness={0.8} roughness={0.15} />
        </mesh>
      </InteractivePart>

      {/* === ROTATIONAL COLLAR WITH BEARING === */}
      <InteractivePart partId="arm-collar" partName="Rotational Bearing Collar" position={[0, baseHeight + 0.12, 0]} rotation={[0, collarYaw, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[1, 0.5, 0]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow>
          <cylinderGeometry args={[0.64, 0.64, 0.2, 32]} />
          <meshStandardMaterial {...M('arm-collar', '#facc15', { metalness: 0.7, roughness: 0.3 })} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.65, 0.65, 0.06, 32]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.2} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (i / 6) * Math.PI * 2;
          return <Nut key={i} position={[Math.cos(angle) * 0.58, 0.11, Math.sin(angle) * 0.58]} />;
        })}
      </InteractivePart>

      {/* === SHOULDER JOINT ASSEMBLY === */}
      <InteractivePart partId="arm-shoulder" partName="Shoulder Joint Assembly" position={[0, baseHeight + 0.35, 0]} rotation={[0, collarYaw, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[-1, 0.3, 0.5]} removeDistance={2.5}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow>
          <sphereGeometry args={[0.52, 32, 32]} />
          <meshStandardMaterial {...M('arm-shoulder', '#ea580c', { metalness: 0.85, roughness: 0.1 })} />
        </mesh>
        <mesh position={[-0.42, 0, 0]} castShadow>
          <boxGeometry args={[0.45, 0.55, 0.55]} />
          <meshStandardMaterial {...M('arm-shoulder', '#334155', { metalness: 0.85, roughness: 0.2 })} />
        </mesh>
        <mesh position={[0, 0, 0.45]} castShadow>
          <boxGeometry args={[0.3, 0.3, 0.15]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Encoder sensor (blue cylinder) */}
        <mesh position={[0.26, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 12]} />
          <meshStandardMaterial color="#06b6d4" emissive="#0891b2" emissiveIntensity={0.5} />
        </mesh>
      </InteractivePart>

      {/* === LOWER ARM SEGMENT === */}
      <InteractivePart partId="arm-lowerarm" partName="Lower Arm Segment" position={[0, baseHeight + 0.35, 0]} rotation={[shoulderPitch, collarYaw, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0.8, 0.5, 0]} removeDistance={3}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <group>
          <mesh position={[-0.14, link1Length / 2, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.13, link1Length, 16]} />
            <meshStandardMaterial {...M('arm-lowerarm', '#ea580c', { metalness: 0.8, roughness: 0.1 })} />
          </mesh>
          <mesh position={[0.14, link1Length / 2, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.13, link1Length, 16]} />
            <meshStandardMaterial {...M('arm-lowerarm', '#ea580c', { metalness: 0.8, roughness: 0.1 })} />
          </mesh>
          {[0.3, 0.6, 0.9].map((frac, i) => (
            <mesh key={i} position={[0, link1Length * frac, 0]} rotation={[0, 0, Math.PI/2]}>
              <cylinderGeometry args={[0.025, 0.025, 0.28, 8]} />
              <meshStandardMaterial color="#1e293b" metalness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, link1Length * 0.25, 0.12]} castShadow>
            <boxGeometry args={[0.35, link1Length * 0.4, 0.06]} />
            <meshStandardMaterial color="#ea580c" metalness={0.75} roughness={0.12} />
          </mesh>
          <mesh position={[0, link1Length * 0.7, -0.12]} castShadow>
            <boxGeometry args={[0.35, link1Length * 0.35, 0.06]} />
            <meshStandardMaterial color="#ea580c" metalness={0.75} roughness={0.12} />
          </mesh>
          {/* Vision system camera module */}
          <mesh position={[0, link1Length * 0.5, 0.18]} castShadow>
            <boxGeometry args={[0.15, 0.15, 0.1]} />
            <meshStandardMaterial color="#475569" metalness={0.9} />
          </mesh>
          <mesh position={[0, link1Length * 0.5, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.02, 12]} />
            <meshStandardMaterial color="#0f172a" roughness={0.1} emissive="#06b6d4" emissiveIntensity={0.5} />
          </mesh>
        </group>
      </InteractivePart>

      {/* === HYDRAULIC CYLINDERS === */}
      <InteractivePart partId="arm-hydraulics" partName="Hydraulic Piston Cylinders" position={[0, baseHeight + 0.35, 0]} rotation={[shoulderPitch, collarYaw, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, 0.3, 1.2]} removeDistance={2.5}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <group position={[0, 0, 0.22]}>
          <mesh position={[0.08, link1Length * 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.055, link1Length * 0.55, 12]} />
            <meshStandardMaterial {...M('arm-hydraulics', '#1e293b', { metalness: 0.9, roughness: 0.15 })} />
          </mesh>
          <mesh position={[0.08, link1Length * 0.65, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, link1Length * 0.55, 12]} />
            <meshStandardMaterial {...M('arm-hydraulics', '#e2e8f0', { metalness: 1.0, roughness: 0.02 })} />
          </mesh>
          <mesh position={[-0.08, link1Length * 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.045, link1Length * 0.45, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
          </mesh>
          <mesh position={[-0.08, link1Length * 0.58, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, link1Length * 0.45, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={1.0} roughness={0.02} />
          </mesh>
        </group>
      </InteractivePart>

      {/* === CABLE BUNDLES & HOSES === */}
      <InteractivePart partId="arm-cables" partName="Pneumatic Cables & Hoses" position={[0, baseHeight + 0.35, 0]} rotation={[shoulderPitch, collarYaw, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[-1, 0.2, 0.5]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <group>
          <mesh position={[-0.22, link1Length / 2, 0.08]} rotation={[0.04, 0, 0.02]}>
            <cylinderGeometry args={[0.015, 0.015, link1Length * 0.92, 8]} />
            <meshStandardMaterial color="#06b6d4" emissive="#0891b2" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[-0.25, link1Length / 2, 0.02]} rotation={[0.03, 0, -0.02]}>
            <cylinderGeometry args={[0.012, 0.012, link1Length * 0.88, 8]} />
            <meshStandardMaterial color="#f97316" roughness={0.8} metalness={0.1} />
          </mesh>
          <mesh position={[-0.19, link1Length / 2, 0.14]} rotation={[-0.02, 0, 0.03]}>
            <cylinderGeometry args={[0.01, 0.01, link1Length * 0.85, 8]} />
            <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.3} />
          </mesh>
        </group>
      </InteractivePart>

      {/* === ELBOW JOINT === */}
      <InteractivePart partId="arm-elbow" partName="Elbow Hinge Joint" position={elbowPos} rotation={[alpha, collarYaw, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[1, 0.5, 0]} removeDistance={2.5}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.28, 0.28, 0.65, 24]} />
          <meshStandardMaterial {...M('arm-elbow', '#475569', { metalness: 0.92, roughness: 0.18 })} />
        </mesh>
        <mesh position={[0.34, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.025, 16]} />
          <meshStandardMaterial color="#f8fafc" metalness={1.0} roughness={0.05} />
        </mesh>
        <mesh position={[-0.34, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.025, 16]} />
          <meshStandardMaterial color="#f8fafc" metalness={1.0} roughness={0.05} />
        </mesh>
        <mesh rotation={[0, Math.PI/2, 0]}>
          <torusGeometry args={[0.29, 0.025, 8, 24]} />
          <meshStandardMaterial color="#ea580c" metalness={0.8} roughness={0.15} />
        </mesh>
        {/* Encoder sensor (blue cylinder) */}
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.1, 12]} />
          <meshStandardMaterial color="#06b6d4" emissive="#0891b2" emissiveIntensity={0.5} />
        </mesh>
      </InteractivePart>

      {/* === UPPER ARM SEGMENT === */}
      <InteractivePart partId="arm-upperarm" partName="Upper Arm Segment" position={elbowPos} rotation={[alpha, collarYaw, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[-0.5, 0.8, 0.3]} removeDistance={3}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <group>
          <mesh position={[0, link2Length / 2, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, link2Length, 16]} />
            <meshStandardMaterial {...M('arm-upperarm', '#ea580c', { metalness: 0.8, roughness: 0.1 })} />
          </mesh>
          <mesh position={[0, link2Length / 2, 0.11]} castShadow>
            <boxGeometry args={[0.05, link2Length * 0.8, 0.04]} />
            <meshStandardMaterial color="#1e293b" metalness={0.85} />
          </mesh>
          <mesh position={[0.12, link2Length / 2, 0]} castShadow>
            <boxGeometry args={[0.04, link2Length * 0.7, 0.08]} />
            <meshStandardMaterial color="#c2410c" metalness={0.8} roughness={0.15} />
          </mesh>
        </group>
      </InteractivePart>

      {/* === WRIST SERVO ASSEMBLY === */}
      <InteractivePart partId="arm-wrist" partName="Wrist Servo & Gear Box" position={wristPos} rotation={[alpha, collarYaw, wristRoll]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0.5, 0.8, -0.3]} removeDistance={2.5}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.32, 0.3]} />
          <meshStandardMaterial {...M('arm-wrist', '#1e293b', { metalness: 0.88, roughness: 0.2 })} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.07, 16]} />
          <meshStandardMaterial color="#b45309" metalness={0.92} roughness={0.08} />
        </mesh>
        {/* Encoder sensor (blue cylinder) */}
        <mesh position={[0.12, 0.1, 0.12]}>
          <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
          <meshStandardMaterial color="#06b6d4" emissive="#0891b2" emissiveIntensity={0.5} />
        </mesh>
      </InteractivePart>

      {/* === GRIPPER BASE / END-EFFECTOR MOUNT === */}
      <InteractivePart partId="arm-gripperbase" partName={activeTool === 'gripper' ? "Gripper Mounting Plate" : "End-Effector Mount"}
        position={[
          wristPos[0] + 0.28 * wristDir[0],
          wristPos[1] + 0.28 * wristDir[1],
          wristPos[2] + 0.28 * wristDir[2]
        ]}
        rotation={[alpha, collarYaw, wristRoll]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, 1, -0.5]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow>
          <boxGeometry args={[0.52, 0.09, 0.2]} />
          <meshStandardMaterial {...M('arm-gripperbase', '#334155', { metalness: 0.88, roughness: 0.2 })} />
        </mesh>
        {/* Force sensor cell (gold cylinder ring) */}
        <mesh position={[0, -0.06, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.04, 16]} />
          <meshStandardMaterial color="#b45309" metalness={0.98} roughness={0.1} />
        </mesh>
        
        {/* === TOOL ATTACHMENT SWAPPING === */}
        {activeTool === 'welding' && (
          <group position={[0, 0.12, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.04, 0.06, 0.24, 12]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh castShadow position={[0, 0.22, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
              <meshStandardMaterial color="#b45309" metalness={0.95} roughness={0.15} />
            </mesh>
            <SparkParticles active={armState?.isWelding} position={[0, 0.28, 0]} />
            {armState?.isWelding && (
              <pointLight position={[0, 0.3, 0]} color="#22d3ee" intensity={3.5} distance={5} />
            )}
          </group>
        )}

        {activeTool === 'vacuum' && (
          <group position={[0, 0.04, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.42, 0.04, 0.42]} />
              <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
            </mesh>
            {[[-0.12, -0.12], [-0.12, 0.12], [0.12, -0.12], [0.12, 0.12]].map(([x, z], i) => (
              <mesh key={i} castShadow position={[x, 0.05, z]}>
                <cylinderGeometry args={[0.05, 0.03, 0.06, 12]} />
                <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.1} />
              </mesh>
            ))}
          </group>
        )}

        {activeTool === 'paint' && (
          <group position={[0, 0.08, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.15, 12]} />
              <meshStandardMaterial color="#b91c1c" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh castShadow position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.06, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
            </mesh>
            <PaintMistParticles active={armState?.isPainting} position={[0, 0.18, 0]} color="#3b82f6" />
          </group>
        )}

        {activeTool === 'drill' && (
          <group position={[0, 0.08, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.08, 0.08, 0.12, 16]} />
              <meshStandardMaterial color="#1e293b" metalness={0.95} roughness={0.1} />
            </mesh>
            <group ref={drillBitRef} position={[0, 0.2, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.98} roughness={0.05} />
              </mesh>
              {[0, 1, 2, 3, 4].map(i => (
                <mesh key={i} position={[0, -0.08 + i * 0.04, 0]} rotation={[0.4, i * 1.2, 0]}>
                  <torusGeometry args={[0.026, 0.008, 6, 12]} />
                  <meshStandardMaterial color="#475569" metalness={0.9} />
                </mesh>
              ))}
            </group>
          </group>
        )}
      </InteractivePart>

      {/* === LEFT GRIPPER JAW === */}
      {activeTool === 'gripper' && (
        <InteractivePart partId="arm-leftjaw" partName="Left Gripper Jaw"
          position={[
            wristPos[0] + 0.32 * wristDir[0] - (clawOpen / 2 + 0.06) * Math.cos(collarYaw),
            wristPos[1] + 0.32 * wristDir[1] + 0.15,
            wristPos[2] + 0.32 * wristDir[2] + (clawOpen / 2 + 0.06) * Math.sin(collarYaw)
          ]}
          rotation={[alpha, collarYaw, wristRoll]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[-1, 0.3, 0]} removeDistance={2}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.32, 0.1]} />
            <meshStandardMaterial {...M('arm-leftjaw', '#ea580c', { metalness: 0.82, roughness: 0.12 })} />
          </mesh>
          <mesh position={[0.042, 0.04, 0]}>
            <boxGeometry args={[0.018, 0.2, 0.09]} />
            <meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.92} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0.042, -0.06 + i * 0.04, 0]}>
              <boxGeometry args={[0.02, 0.008, 0.08]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} />
            </mesh>
          ))}
          <Bolt position={[0, -0.14, 0]} scale={0.7} color="#475569" />
        </InteractivePart>
      )}

      {/* === RIGHT GRIPPER JAW === */}
      {activeTool === 'gripper' && (
        <InteractivePart partId="arm-rightjaw" partName="Right Gripper Jaw"
          position={[
            wristPos[0] + 0.32 * wristDir[0] + (clawOpen / 2 + 0.06) * Math.cos(collarYaw),
            wristPos[1] + 0.32 * wristDir[1] + 0.15,
            wristPos[2] + 0.32 * wristDir[2] - (clawOpen / 2 + 0.06) * Math.sin(collarYaw)
          ]}
          rotation={[alpha, collarYaw, wristRoll]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[1, 0.3, 0]} removeDistance={2}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.32, 0.1]} />
            <meshStandardMaterial {...M('arm-rightjaw', '#ea580c', { metalness: 0.82, roughness: 0.12 })} />
          </mesh>
          <mesh position={[-0.042, 0.04, 0]}>
            <boxGeometry args={[0.018, 0.2, 0.09]} />
            <meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.92} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[-0.042, -0.06 + i * 0.04, 0]}>
              <boxGeometry args={[0.02, 0.008, 0.08]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} />
            </mesh>
          ))}
          <Bolt position={[0, -0.14, 0]} scale={0.7} color="#475569" />
        </InteractivePart>
      )}

      {/* === ELBOW BOLTS === */}
      <InteractivePart partId="arm-elbowbolts" partName="Elbow Joint Bolts (Ã—6)" position={elbowPos} rotation={[alpha, collarYaw, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[1.2, 0.5, 0]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (i / 6) * Math.PI * 2;
          return <Nut key={i} position={[-0.36, Math.cos(angle) * 0.18, Math.sin(angle) * 0.18]} scale={0.9} color="#cbd5e1" />;
        })}
      </InteractivePart>

      {/* === SUPPORT SYSTEM: POWER & CONTROL CABINETS === */}
      <group position={[0, 0, 0]}>
        {/* Power Supply Cabinet */}
        <mesh position={[1.6, 0.45, -1.6]} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.9, 0.6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* PLC Ethernet module details */}
        <mesh position={[1.6, 0.6, -1.29]} castShadow>
          <boxGeometry args={[0.3, 0.25, 0.04]} />
          <meshStandardMaterial color="#334155" metalness={0.5} />
        </mesh>
        <mesh position={[1.6, 0.6, -1.26]}>
          <boxGeometry args={[0.1, 0.1, 0.03]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.5} />
        </mesh>
        {/* Cable harness running from power supply to pedestal base */}
        <mesh position={[0.8, 0.08, -0.8]} rotation={[0.07, 0.78, 0.1]} castShadow>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 2.2, 8]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
        </mesh>

        {/* Controller Cabinet */}
        <mesh position={[-1.6, 0.5, -1.6]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 1.0, 0.5]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Blinking Monitor on Controller */}
        <mesh position={[-1.6, 0.75, -1.34]} castShadow>
          <boxGeometry args={[0.38, 0.26, 0.03]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={1.2} />
        </mesh>
        {[[-0.12, '#22c55e'], [0, '#eab308'], [0.12, '#ef4444']].map(([xOffset, color], i) => (
          <mesh key={i} position={[-1.6 + xOffset, 0.5, -1.34]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={Math.random() > 0.5 ? 2.5 : 0.4} />
          </mesh>
        ))}
      </group>

    </group>
  );
}

// =========================================================
// 2. SPACEX STARSHIP - LARGE SCALE
// =========================================================
function ProceduralStarship({ params, hoveredPart, wireframe, removedParts, onTogglePart, onHover, assemblyMode, explosionLevel = 0, isPhysicalExploded = false, rocketState = null }) {
  const nozzleScale = params.nozzleScale || 1.0;
  const fuelFill = rocketState?.propellantLevel !== undefined ? rocketState.propellantLevel : (params.fuelFill || 75);
  const strutCount = Math.max(4, params.strutCount || 6);
  const gridFinAngle = rocketState?.gridFinAngle !== undefined ? rocketState.gridFinAngle : (params.gridFinAngle || 0);
  const M = (id, color, opts) => getMaterialProps(id, color, hoveredPart, wireframe, assemblyMode, removedParts, opts);

  const altitude = rocketState?.launchAltitude || 0;
  const isStaged = rocketState?.isStaged || false;
  const isIgnited = rocketState?.isIgnited || false;

  // Staging positioning offsets
  const boosterY = altitude;
  const upperStageY = altitude + (isStaged ? 9.5 : 0.0);

  return (
    <group position={[0, 2.5, 0]}>

      {/* ========================================================= */}
      {/* 1. FIRST STAGE (BOOSTER) COMPONENTS - shift by boosterY */}
      {/* ========================================================= */}
      <group position={[0, boosterY, 0]}>
        
        {/* === 33 RAPTOR ENGINES === */}
        <InteractivePart partId="ss-engines" partName="Raptor Engine Array (Ã—33)" position={[0, 0.3, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[0, -1, 0]} removeDistance={4}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          <mesh castShadow>
            <cylinderGeometry args={[1.4, 1.4, 0.35, 48]} />
            <meshStandardMaterial {...M('ss-engines', '#0f172a', { metalness: 0.92, roughness: 0.2 })} />
          </mesh>
          {/* Inner ring (13 engines) */}
          {Array.from({ length: 13 }, (_, i) => {
            const r = i === 0 ? 0 : (i <= 3 ? 0.35 : 0.7);
            const angle = i === 0 ? 0 : (i <= 3 ? ((i-1) / 3) * Math.PI * 2 : ((i-4) / 9) * Math.PI * 2);
            const x = i === 0 ? 0 : Math.cos(angle) * r;
            const z = i === 0 ? 0 : Math.sin(angle) * r;
            return (
              <group key={`inner-${i}`} position={[x, -0.1, z]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.06 * nozzleScale, 0.12 * nozzleScale, 0.3, 12, 1, true]} />
                  <meshStandardMaterial color="#334155" metalness={0.95} roughness={0.15} />
                </mesh>
                <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.03 * nozzleScale, 0.07 * nozzleScale, 0.12, 8]} />
                  <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={isIgnited ? 4 : 0} toneMapped={false} />
                </mesh>
                {/* Gimbal actuators */}
                {i > 0 && i < 4 && (
                  <mesh position={[0, 0.2, 0]} rotation={[0, angle, 0.15]}>
                    <cylinderGeometry args={[0.015, 0.015, 0.25, 8]} />
                    <meshStandardMaterial color="#64748b" metalness={0.9} />
                  </mesh>
                )}
              </group>
            );
          })}
          {/* Outer ring (20 engines) */}
          {Array.from({ length: 20 }, (_, i) => {
            const angle = (i / 20) * Math.PI * 2;
            return (
              <group key={`outer-${i}`} position={[Math.cos(angle) * 1.1, -0.1, Math.sin(angle) * 1.1]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.06 * nozzleScale, 0.12 * nozzleScale, 0.3, 12, 1, true]} />
                  <meshStandardMaterial color="#334155" metalness={0.95} roughness={0.15} />
                </mesh>
                <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.03 * nozzleScale, 0.07 * nozzleScale, 0.12, 8]} />
                  <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={isIgnited ? 3 : 0} toneMapped={false} />
                </mesh>
              </group>
            );
          })}
          <RocketPlume active={isIgnited && !isStaged} position={[0, -0.4, 0]} scale={2.8} />
        </InteractivePart>

        {/* === ENGINE MOUNTING BOLTS === */}
        <InteractivePart partId="ss-enginebolts" partName="Engine Mount Bolts (Ã—24)" position={[0, 0.5, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[0, -1, 1]} removeDistance={3}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            return <Bolt key={i} position={[Math.cos(angle) * 1.38, 0, Math.sin(angle) * 1.38]} scale={1.2} />;
          })}
        </InteractivePart>

        {/* === BOOSTER BODY (Super Heavy) === */}
        <InteractivePart partId="ss-booster" partName="Super Heavy Booster Body" position={[0, 4.2, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[-0.3, -0.5, 0]} removeDistance={5}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          <mesh castShadow>
            <cylinderGeometry args={[1.38, 1.38, 7.0, 48]} />
            <meshStandardMaterial {...M('ss-booster', '#cbd5e1', { metalness: 0.95, roughness: 0.15 })} />
          </mesh>
          {/* Welding seams */}
          {[-2.8, -1.4, 0, 1.4, 2.8].map((y, i) => (
            <mesh key={i} position={[0, y, 0]}>
              <cylinderGeometry args={[1.395, 1.395, 0.04, 48, 1, true]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.98} roughness={0.1} />
            </mesh>
          ))}
          {/* SpaceX stripe */}
          <mesh position={[1.39, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.12, 6.8, 0.015]} />
            <meshStandardMaterial color="#0f172a" metalness={0.5} />
          </mesh>
          {/* Propellant level overlay */}
          <mesh position={[0, -3.5 + (fuelFill / 100) * 3.5, 0]}>
            <cylinderGeometry args={[1.33, 1.33, (fuelFill / 100) * 6.8, 24]} />
            <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.25} transparent opacity={0.3} />
          </mesh>
        </InteractivePart>

        {/* === GRID FINS === */}
        <InteractivePart partId="ss-gridfins" partName="Grid Fins (Ã—4)" position={[0, 7.2, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[1, 0.3, 0]} removeDistance={3}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          {[0, 1, 2, 3].map(i => {
            const angle = (i / 4) * Math.PI * 2;
            const rot = (gridFinAngle * Math.PI) / 180;
            return (
              <group key={i} position={[Math.cos(angle) * 1.48, 0, Math.sin(angle) * 1.48]} rotation={[0, angle, rot]}>
                <mesh castShadow>
                  <boxGeometry args={[0.06, 0.8, 0.6]} />
                  <meshStandardMaterial {...M('ss-gridfins', '#1e293b', { metalness: 0.95, roughness: 0.1 })} />
                </mesh>
                {[-0.15, 0, 0.15].map((offset, j) => (
                  <mesh key={j} position={[0, offset, 0]}>
                    <boxGeometry args={[0.05, 0.025, 0.55]} />
                    <meshStandardMaterial color="#334155" metalness={0.9} />
                  </mesh>
                ))}
                <Bolt position={[0, -0.4, 0]} scale={1.0} />
              </group>
            );
          })}
        </InteractivePart>

        {/* === COLD GAS THRUSTERS === */}
        <InteractivePart partId="ss-coldgas" partName="Cold Gas Attitude Thrusters" position={[0, 7.5, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[0.5, 0.8, 0]} removeDistance={2.5}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          {[0, 1, 2, 3].map(i => {
            const angle = (i / 4) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(angle) * 1.39, 0, Math.sin(angle) * 1.39]} rotation={[0, angle, 0]}>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.03, 0.045, 0.08, 8]} />
                  <meshStandardMaterial color="#475569" metalness={0.9} />
                </mesh>
                <GasJetParticles active={rocketState?.coldGasFiring} position={[0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
              </group>
            );
          })}
        </InteractivePart>

        {/* === LANDING GEAR LEGS === */}
        <InteractivePart partId="ss-landinggear" partName="Landing Gear Legs (Ã—4)" position={[0, 0.9, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[0.5, -0.2, 0.5]} removeDistance={2.5}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          {[0, 1, 2, 3].map(i => {
            const angle = (i / 4) * Math.PI * 2;
            const legRot = rocketState?.isLandingGearDeployed ? 0.75 : -0.15;
            return (
              <group key={i} position={[Math.cos(angle) * 1.35, 0, Math.sin(angle) * 1.35]} rotation={[0, angle, legRot]}>
                <mesh position={[0, -0.5, 0]} castShadow>
                  <cylinderGeometry args={[0.04, 0.04, 1.0, 8]} />
                  <meshStandardMaterial color="#475569" metalness={0.95} roughness={0.1} />
                </mesh>
                <mesh position={[0, -1.0, 0]} castShadow>
                  <cylinderGeometry args={[0.18, 0.18, 0.05, 12]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.9} />
                </mesh>
              </group>
            );
          })}
        </InteractivePart>

        {/* === INTERSTAGE SEPARATION RING === */}
        <InteractivePart partId="ss-interstage" partName="Interstage Separation Ring" position={[0, 7.9, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[0, 0.5, 0.8]} removeDistance={3}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          <mesh castShadow>
            <cylinderGeometry args={[1.4, 1.4, 0.4, 48]} />
            <meshStandardMaterial {...M('ss-interstage', '#1e293b', { metalness: 0.92, roughness: 0.15 })} />
          </mesh>
          {Array.from({ length: strutCount }, (_, i) => {
            const a = (i / strutCount) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25]} rotation={[0.1, -a, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
              </mesh>
            );
          })}
        </InteractivePart>

      </group>

      {/* ========================================================= */}
      {/* 2. SECOND STAGE (ORBITER) COMPONENTS - shift by upperStageY */}
      {/* ========================================================= */}
      <group position={[0, upperStageY, 0]}>

        {/* === STARSHIP UPPER STAGE BODY === */}
        <InteractivePart partId="ss-ship" partName="Starship Upper Stage" position={[0, 10.8, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[0, 0.5, 0]} removeDistance={5}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          <mesh castShadow>
            <cylinderGeometry args={[1.35, 1.35, 5.2, 48]} />
            <meshStandardMaterial {...M('ss-ship', '#e2e8f0', { metalness: 0.95, roughness: 0.12 })} />
          </mesh>
          {/* Welding seams */}
          {[-1.8, -0.6, 0.6, 1.8].map((y, i) => (
            <mesh key={i} position={[0, y, 0]}>
              <cylinderGeometry args={[1.37, 1.37, 0.035, 48, 1, true]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.98} />
            </mesh>
          ))}
          {/* Avionics motherboard cutaway */}
          {(removedParts.has('ss-ship') || explosionLevel > 0.3) && (
            <group position={[0, 0.5, 0]}>
              <mesh>
                <boxGeometry args={[0.8, 1.2, 0.08]} />
                <meshStandardMaterial color="#166534" roughness={0.4} />
              </mesh>
              {[[-0.2, 0.4], [0.2, -0.2], [0, 0]].map(([x, y], idx) => (
                <mesh key={idx} position={[x, y, 0.05]}>
                  <boxGeometry args={[0.15, 0.15, 0.03]} />
                  <meshStandardMaterial color="#0f172a" metalness={0.8} />
                </mesh>
              ))}
              {[[-0.2, -0.4, '#06b6d4'], [0.2, 0.2, '#22c55e']].map(([x, y, color], idx) => (
                <mesh key={idx} position={[x, y, 0.05]}>
                  <sphereGeometry args={[0.02, 8, 8]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
                </mesh>
              ))}
            </group>
          )}
        </InteractivePart>

        {/* === HEAT SHIELD TILES === */}
        <InteractivePart partId="ss-heattiles" partName="Heat Shield Tile Panels" position={[0, 10.8, -1.36]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[0, 0, -1]} removeDistance={3}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          {Array.from({ length: 6 }, (_, row) =>
            Array.from({ length: 4 }, (_, col) => (
              <mesh key={`${row}-${col}`} 
                position={[-0.45 + col * 0.3, -1.5 + row * 0.6, 0]}>
                <boxGeometry args={[0.26, 0.52, 0.04]} />
                <meshStandardMaterial color="#1f2937" metalness={0.1} roughness={0.9} />
              </mesh>
            ))
          )}
        </InteractivePart>

        {/* === UPPER STAGE VACUUM RAPTOR ENGINES === */}
        <InteractivePart partId="ss-vacuum" partName="Vacuum Raptor Engines" position={[0, 8.05, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[0, -1, 0]} removeDistance={3}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          {[0, 1, 2].map(i => {
            const angle = (i / 3) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(angle) * 0.65, 0.1, Math.sin(angle) * 0.65]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.06, 0.22, 0.55, 12, 1, true]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
                </mesh>
                <mesh position={[0.0, -0.1, 0.0]}>
                  <cylinderGeometry args={[0.04, 0.18, 0.2, 8]} />
                  <meshStandardMaterial color="#b45309" metalness={0.95} />
                </mesh>
              </group>
            );
          })}
          <RocketPlume active={isIgnited && isStaged} position={[0, -0.2, 0]} scale={2.0} />
        </InteractivePart>

        {/* === AFT FLAPS === */}
        <InteractivePart partId="ss-aftflaps" partName="Aft Control Flaps (Ã—2)" position={[0, 8.4, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[1, 0, 0.5]} removeDistance={3}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          {[0, Math.PI].map((angle, i) => (
            <group key={i} rotation={[0, angle, 0]}>
              <mesh position={[1.38, 0, 0]} rotation={[0, 0, 0.15]} castShadow>
                <boxGeometry args={[0.6, 1.2, 0.08]} />
                <meshStandardMaterial color={angle === 0 ? '#1e293b' : '#cbd5e1'} metalness={0.95} roughness={0.15} />
              </mesh>
              <mesh position={[1.1, -0.5, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.25, 12]} />
                <meshStandardMaterial color="#475569" metalness={0.9} />
              </mesh>
              <Bolt position={[1.1, -0.4, 0.14]} scale={0.8} />
              <Bolt position={[1.1, 0.2, 0.14]} scale={0.8} />
            </group>
          ))}
        </InteractivePart>

        {/* === FORWARD FLAPS === */}
        <InteractivePart partId="ss-fwdflaps" partName="Forward Control Flaps (Ã—2)" position={[0, 12.8, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[-1, 0.3, 0.5]} removeDistance={3}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          {[Math.PI/2, -Math.PI/2].map((angle, i) => (
            <group key={i} rotation={[0, angle, 0]}>
              <mesh position={[1.38, 0, 0]} rotation={[0, 0, -0.1]} castShadow>
                <boxGeometry args={[0.5, 1.0, 0.06]} />
                <meshStandardMaterial color={i === 0 ? '#1e293b' : '#e2e8f0'} metalness={0.95} roughness={0.2} />
              </mesh>
              <mesh position={[1.12, 0.4, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.2, 12]} />
                <meshStandardMaterial color="#475569" metalness={0.9} />
              </mesh>
              <Bolt position={[1.12, 0.3, 0.11]} scale={0.7} />
            </group>
          ))}
        </InteractivePart>

        {/* === RCS ATTITUDE NOZZLES === */}
        <InteractivePart partId="ss-rcs" partName="RCS Reaction Control System" position={[0, 13.3, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[-0.5, 0.8, 0]} removeDistance={2}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          {[0, Math.PI].map((angle, i) => (
            <group key={i} rotation={[0, angle, 0]} position={[0, 0, 0.95]}>
              <mesh>
                <cylinderGeometry args={[0.018, 0.028, 0.06, 8]} />
                <meshStandardMaterial color="#475569" />
              </mesh>
              <GasJetParticles active={rocketState?.rcsFiring} position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
        </InteractivePart>

        {/* === SPLIT NOSE CONE FAIRINGS === */}
        <group position={[0, 14.2, 0]}>
          
          <InteractivePart partId="ss-nosecone-l" partName="Aerodynamic Nose Cone (L)"
            position={[rocketState?.isPayloadDeployed ? -1.4 : 0, 0, 0]}
            rotation={[0, 0, rocketState?.isPayloadDeployed ? 0.25 : 0]}
            removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
            assemblyMode={assemblyMode} removeDirection={[-1, 0.8, 0]} removeDistance={3}
            explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
            <mesh castShadow>
              <cylinderGeometry args={[0.0, 1.35, 2.2, 48, 1, false, 0, Math.PI]} />
              <meshStandardMaterial {...M('ss-nosecone-l', '#cbd5e1', { metalness: 0.95, roughness: 0.15 })} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.0, 1.36, 2.18, 48, 1, true, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#1f2937" metalness={0.1} roughness={0.9} />
            </mesh>
          </InteractivePart>

          <InteractivePart partId="ss-nosecone-r" partName="Aerodynamic Nose Cone (R)"
            position={[rocketState?.isPayloadDeployed ? 1.4 : 0, 0, 0]}
            rotation={[0, 0, rocketState?.isPayloadDeployed ? -0.25 : 0]}
            removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
            assemblyMode={assemblyMode} removeDirection={[1, 0.8, 0]} removeDistance={3}
            explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
            <mesh castShadow>
              <cylinderGeometry args={[0.0, 1.35, 2.2, 48, 1, false, Math.PI, Math.PI]} />
              <meshStandardMaterial {...M('ss-nosecone-r', '#cbd5e1', { metalness: 0.95, roughness: 0.15 })} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.0, 1.36, 2.18, 48, 1, true, Math.PI, Math.PI / 2]} />
              <meshStandardMaterial color="#1f2937" metalness={0.1} roughness={0.9} />
            </mesh>
          </InteractivePart>

          {/* Golden satellite payload & mounting adapter */}
          {(rocketState?.isPayloadDeployed || explosionLevel > 0.1) && (
            <group position={[0, -0.4, 0]}>
              <mesh castShadow position={[0, -0.4, 0]}>
                <cylinderGeometry args={[0.4, 0.6, 0.2, 16]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
              </mesh>
              <mesh castShadow position={[0, 0.2, 0]}>
                <boxGeometry args={[0.42, 0.56, 0.42]} />
                <meshStandardMaterial color="#b45309" metalness={0.98} roughness={0.08} />
              </mesh>
              <mesh castShadow position={[-0.56, 0.2, 0]}>
                <boxGeometry args={[0.62, 0.28, 0.02]} />
                <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh castShadow position={[0.56, 0.2, 0]}>
                <boxGeometry args={[0.62, 0.28, 0.02]} />
                <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          )}

        </group>

      </group>

      {/* === LAUNCH CLAMP HOLDDOWNS === */}
      <InteractivePart partId="ss-clamps" partName="Launch Clamp Hold-downs (Ã—4)" position={[0, 0.1, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[1, -0.5, 1]} removeDistance={3}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        {[0, 1, 2, 3].map(i => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI/4;
          return (
            <group key={i} position={[Math.cos(angle) * 1.6, 0, Math.sin(angle) * 1.6]} rotation={[0, angle, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.15, 0.6, 0.15]} />
                <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
              </mesh>
              <mesh position={[-0.12, 0.25, 0]}>
                <boxGeometry args={[0.12, 0.15, 0.12]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.15} />
              </mesh>
              <Bolt position={[0, -0.25, 0.09]} scale={0.9} />
            </group>
          );
        })}
      </InteractivePart>

      {/* === UMBILICAL CONNECTOR === */}
      <InteractivePart partId="ss-umbilical" partName="Fuel Umbilical Connector" position={[1.55, 3.0, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[1, 0, 0]} removeDistance={3}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.5, 0.3]} />
          <meshStandardMaterial color="#475569" metalness={0.88} roughness={0.2} />
        </mesh>
        <mesh position={[0.2, 0, 0.05]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.45, 8]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.2, 0, -0.05]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.45, 8]} />
          <meshStandardMaterial color="#f97316" metalness={0.6} />
        </mesh>
        <Bolt position={[-0.1, 0.2, 0.16]} scale={0.8} color="#f59e0b" />
        <Bolt position={[-0.1, -0.2, 0.16]} scale={0.8} color="#f59e0b" />
      </InteractivePart>

      {/* === LAUNCH PAD BASE === */}
      <InteractivePart partId="ss-launchpad" partName="Launch Pad & Flame Diverter" position={[0, -0.6, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, -1, 0]} removeDistance={3}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh receiveShadow>
          <cylinderGeometry args={[3.5, 3.5, 0.4, 6]} />
          <meshStandardMaterial color="#64748b" metalness={0.3} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[1.8, 2.2, 0.3, 32, 1, true]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
        </mesh>
        {[0, 1, 2, 3].map(i => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(angle) * 2.5, 0.3, Math.sin(angle) * 2.5]}>
              <cylinderGeometry args={[0.06, 0.06, 0.6, 8]} />
              <meshStandardMaterial color="#0ea5e9" metalness={0.7} roughness={0.3} />
            </mesh>
          );
        })}
      </InteractivePart>

      <ExplosionParticles active={isPhysicalExploded} />

    </group>
  );
}
// =========================================================
// 3. PROCEDURAL AUTONOMOUS ROVER
// =========================================================
function ProceduralRobot({ params, hoveredPart, wireframe, removedParts, onTogglePart, onHover, assemblyMode, explosionLevel = 0, isPhysicalExploded = false, roverState = null }) {
  const chassisWidth = params.chassisWidth || 1.2;
  const wheelSize = params.wheelSize || 0.34;
  const lidarSpeed = params.lidarSpeed || 1.5;
  const batteryCells = params.batteryCells || 4;
  const M = (id, color, opts) => getMaterialProps(id, color, hoveredPart, wireframe, assemblyMode, removedParts, opts);

  const power = roverState?.power || false;
  const speed = roverState?.speed || 0;
  const steeringAngle = ((roverState?.steeringAngle || 0) * Math.PI) / 180;
  const isLidarEnabled = roverState?.isLidarEnabled || false;

  const lidarRef = useRef();
  const gear1Ref = useRef();
  const gear2Ref = useRef();

  useFrame((state, delta) => {
    if (isLidarEnabled && lidarRef.current) {
      lidarRef.current.rotation.y += delta * lidarSpeed * 5.0;
    }
    if (speed !== 0 && gear1Ref.current && gear2Ref.current) {
      gear1Ref.current.rotation.z += delta * speed * 6.0;
      gear2Ref.current.rotation.z -= delta * speed * 6.0;
    }
  });

  const renderWheelTreads = (wSize) => {
    const treads = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      treads.push(
        <mesh key={i} position={[Math.cos(angle) * wSize, Math.sin(angle) * wSize, 0]} rotation={[0, 0, angle]}>
          <boxGeometry args={[0.03, 0.05, 0.16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.95} metalness={0.1} />
        </mesh>
      );
    }
    return treads;
  };

  return (
    <group position={[0, -0.3, 0]}>

      {/* === CHASSIS PLATFORM === */}
      <InteractivePart partId="rover-chassis" partName="Chassis Platform" position={[0, 0.1, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, 1, 0]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[chassisWidth, 0.22, 1.15]} />
          <meshStandardMaterial {...M('rover-chassis', '#fbbf24', { metalness: 0.7, roughness: 0.2 })} />
        </mesh>
        {/* Metal side reinforcements */}
        <mesh position={[chassisWidth / 2 + 0.01, 0, 0]} castShadow>
          <boxGeometry args={[0.02, 0.18, 1.1]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh position={[-chassisWidth / 2 - 0.01, 0, 0]} castShadow>
          <boxGeometry args={[0.02, 0.18, 1.1]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
        </mesh>
      </InteractivePart>

      {/* === ROLL CAGE FRAME === */}
      <InteractivePart partId="rover-cage" partName="Roll Cage Frame" position={[0, 0.22, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, 1, 0]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, chassisWidth * 1.05, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
        <mesh position={[-chassisWidth / 2 + 0.02, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.65, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
        <mesh position={[chassisWidth / 2 - 0.02, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.65, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
      </InteractivePart>

      {/* === AXLES === */}
      <InteractivePart partId="rover-axles" partName="Drivetrain Steel Axles (Ã—2)" position={[0, 0, 0]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, -1, 0]} removeDistance={1.8}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        {/* Front Axle */}
        <mesh position={[0, 0, 0.32]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, chassisWidth + 0.1, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.95} roughness={0.1} />
        </mesh>
        {/* Rear Axle */}
        <mesh position={[0, 0, -0.32]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, chassisWidth + 0.1, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.95} roughness={0.1} />
        </mesh>
      </InteractivePart>

      {/* === DRIVE MOTOR & GEARS === */}
      <InteractivePart partId="rover-drivemotor" partName="Electric Drive Motor & Gears" position={[0, 0.05, -0.32]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0.5, -0.5, -0.5]} removeDistance={2.0}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        {/* Motor body */}
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.28, 12]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.25} />
        </mesh>
        {/* Brass terminal connections */}
        <mesh position={[-0.15, 0.04, 0.03]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.04, 8]} />
          <meshStandardMaterial color="#b45309" metalness={0.98} />
        </mesh>
        <mesh position={[-0.15, 0.04, -0.03]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.04, 8]} />
          <meshStandardMaterial color="#b45309" metalness={0.98} />
        </mesh>
        {/* Interlocking Gears */}
        <group position={[0.15, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh ref={gear1Ref}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
          </mesh>
          <mesh ref={gear2Ref} position={[0.08, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.018, 12]} />
            <meshStandardMaterial color="#b45309" metalness={0.95} />
          </mesh>
        </group>
      </InteractivePart>

      {/* === STEERING SERVO ACTUATOR === */}
      <InteractivePart partId="rover-steering" partName="Steering Servo Actuator" position={[0, 0.08, 0.32]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[-0.5, 0.5, 0.5]} removeDistance={2.0}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.12, 0.12]} />
          <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Steering arm linkage */}
        <mesh position={[0, -0.07, 0]} rotation={[0, steeringAngle, 0]} castShadow>
          <boxGeometry args={[0.35, 0.02, 0.04]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      </InteractivePart>

      {/* === PCB BOARD & ANTENNA === */}
      <InteractivePart partId="rover-pcb" partName="PCB Receiver Board & Antenna" position={[0, 0.25, 0.2]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, 1, 0.5]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow>
          <boxGeometry args={[chassisWidth * 0.7, 0.03, 0.46]} />
          <meshStandardMaterial {...M('rover-pcb', '#15803d', { metalness: 0.5, roughness: 0.4 })} />
        </mesh>
        <mesh position={[0, 0.025, 0.06]} castShadow>
          <boxGeometry args={[0.16, 0.03, 0.16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
        <mesh position={[0.22, 0.025, -0.06]} castShadow>
          <boxGeometry args={[0.11, 0.03, 0.11]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
        {/* Blinking system LED */}
        <mesh position={[-0.2, 0.025, 0.1]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color={power ? "#22c55e" : "#ef4444"} emissive={power ? "#22c55e" : "#ef4444"} emissiveIntensity={power ? (Math.random() > 0.5 ? 3.0 : 1.5) : 0} />
        </mesh>
        {/* Copper coiled wire antenna */}
        <group position={[-0.24, 0.12, -0.1]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.2, 8]} />
            <meshStandardMaterial color="#b45309" metalness={0.98} roughness={0.1} />
          </mesh>
          {[0, 1, 2, 3, 4].map(idx => (
            <mesh key={idx} position={[0, 0.06 + idx * 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.02, 0.005, 6, 12]} />
              <meshStandardMaterial color="#b45309" metalness={0.98} />
            </mesh>
          ))}
        </group>
      </InteractivePart>

      {/* === BATTERY CELL PACK === */}
      <InteractivePart partId="rover-battery" partName="Battery Cell Pack" position={[0, 0.22, -0.2]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, 1, -0.8]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        {Array.from({ length: batteryCells }, (_, i) => {
          const spacing = 0.16;
          const xOffset = (i - (batteryCells - 1) / 2) * spacing;
          return (
            <group key={i} position={[xOffset, 0, 0]}>
              <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.24, 16]} />
                <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.1} />
              </mesh>
              <mesh position={[0, 0, 0.125]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.035, 0.035, 0.01, 8]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
              </mesh>
            </group>
          );
        })}
      </InteractivePart>

      {/* === STEREO CAMERA MODULE === */}
      <InteractivePart partId="rover-camera" partName="Stereo Camera Module" position={[0, 0.2, 0.52]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, 0.5, 1]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.08, 0.08]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        {[[-0.1, '#06b6d4'], [0.1, '#06b6d4']].map(([x, c], i) => (
          <group key={i}>
            <mesh position={[x, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.02, 12]} />
              <meshStandardMaterial color="#0f172a" roughness={0.1} />
            </mesh>
            <mesh position={[x, 0, 0.056]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={3} />
            </mesh>
          </group>
        ))}
      </InteractivePart>

      {/* === LIDAR SCANNER === */}
      <InteractivePart partId="rover-lidar" partName="LiDAR Scanner" position={[0, 0.34, -0.38]}
        removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
        assemblyMode={assemblyMode} removeDirection={[0, 1, -0.5]} removeDistance={2}
        explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
        <group ref={lidarRef}>
          <mesh castShadow>
            <cylinderGeometry args={[0.14, 0.16, 0.14, 16]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.11, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.08, 16]} />
            <meshStandardMaterial color="#0f172a" metalness={0.95} />
          </mesh>
          <mesh position={[0.09, 0.11, 0]}>
            <boxGeometry args={[0.05, 0.04, 0.04]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={isLidarEnabled ? 4 : 0} />
          </mesh>
        </group>
        {isLidarEnabled && (
          <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.2, 2.5, 32]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.18} side={THREE.DoubleSide} />
          </mesh>
        )}
      </InteractivePart>

      {/* === WHEELS === */}
      {[
        { id: 'rover-wheelFL', name: 'Front Left Wheel', pos: [-chassisWidth / 2 - 0.09, 0, 0.32], hubX: -0.085, rotY: steeringAngle },
        { id: 'rover-wheelFR', name: 'Front Right Wheel', pos: [chassisWidth / 2 + 0.09, 0, 0.32], hubX: 0.085, rotY: steeringAngle },
        { id: 'rover-wheelRL', name: 'Rear Left Wheel', pos: [-chassisWidth / 2 - 0.09, 0, -0.32], hubX: -0.085, rotY: 0 },
        { id: 'rover-wheelRR', name: 'Rear Right Wheel', pos: [chassisWidth / 2 + 0.09, 0, -0.32], hubX: 0.085, rotY: 0 },
      ].map(({ id, name, pos, hubX, rotY }) => (
        <InteractivePart key={id} partId={id} partName={name} position={pos} rotation={[0, rotY, 0]}
          removedParts={removedParts} onTogglePart={onTogglePart} hoveredPart={hoveredPart} onHover={onHover}
          assemblyMode={assemblyMode} removeDirection={[Math.sign(pos[0]), 0, 0]} removeDistance={2}
          explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded}>
          <group rotation={[0, 0, Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[wheelSize, wheelSize, 0.15, 24]} />
              <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.9} />
            </mesh>
            {renderWheelTreads(wheelSize)}
            <mesh position={[hubX, 0, 0]}>
              <cylinderGeometry args={[wheelSize * 0.48, wheelSize * 0.48, 0.02, 12]} />
              <meshStandardMaterial color="#d97706" metalness={1.0} roughness={0.1} />
            </mesh>
          </group>
        </InteractivePart>
      ))}

      {/* === PHYSICAL TRANSMITTER (GROUND ACCENT) === */}
      <group position={[1.4, -2.1, 0.8]} rotation={[-Math.PI / 2, 0, 0.35]}>
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.22, 0.06]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.16, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
        <mesh position={[-0.08, -0.02, 0.04]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0.08, -0.02, 0.04]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0, 0.06, 0.045]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color={power ? "#22c55e" : "#ef4444"} emissive={power ? "#22c55e" : "#ef4444"} emissiveIntensity={power ? 2.5 : 0} />
        </mesh>
      </group>

      {/* === POWER SWITCH (ON CHASSIS) === */}
      <group position={[-chassisWidth / 2 - 0.02, 0.1, 0.1]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <boxGeometry args={[0.04, 0.08, 0.04]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0, 0.022, power ? 0.02 : -0.02]} castShadow>
          <boxGeometry args={[0.02, 0.025, 0.02]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>

      <ExplosionParticles active={isPhysicalExploded} />

    </group>
  );
}

// Sky + Ground environment
function SceneEnvironment() {
  return (
    <>
      <mesh position={[0, 0, -30]} rotation={[0, 0, 0]}>
        <planeGeometry args={[200, 80]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      <mesh position={[0, -14, -30]}>
        <planeGeometry args={[200, 20]} />
        <meshBasicMaterial color="#7dd3fc" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#16a34a" roughness={0.9} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.21, -10]}>
        <planeGeometry args={[100, 60]} />
        <meshStandardMaterial color="#15803d" roughness={0.95} />
      </mesh>
    </>
  );
}

// ==========================================
// MODEL VIEWER CONTAINER
// ==========================================
function resolveModelType(name) {
  if (!name) return 'unknown';
  const n = name.toLowerCase();
  if (n.includes('rocket') || n.includes('starship') || n.includes('spacex') || n.includes('booster')) return 'starship';
  if (n.includes('kuka') || n.includes('robotic arm') || n.includes('robot arm')) return 'arm';
  if (n.includes('device') || n.includes('rover') || n.includes('robot')) return 'robot';
  return 'unknown';
}

function ModelViewer({ 
  modelName, 
  autoRotate, 
  wireframe, 
  resetKey, 
  params, 
  hoveredPart, 
  removedParts, 
  onTogglePart, 
  onHover, 
  assemblyMode, 
  explosionLevel = 0, 
  isPhysicalExploded = false, 
  armState = null, 
  rocketState = null, 
  roverState = null 
}) {
  const modelType = resolveModelType(modelName);
  const isRocket = modelType === 'starship';
  const cameraPos = isRocket ? [0, 12, 35] : [0, 2, 12];
  const fov = isRocket ? 50 : 50;
  const controlsTarget = isRocket ? [0, 8, 0] : [0, 0, 0];
  
  return (
    <Canvas shadows dpr={[1, 2]} style={{ background: 'linear-gradient(to bottom, #0ea5e9 0%, #38bdf8 40%, #7dd3fc 65%, #bae6fd 100%)' }}>
      <PerspectiveCamera makeDefault position={cameraPos} fov={fov} key={resetKey} />
      <ambientLight intensity={1.2} color="#e0f2fe" />
      <directionalLight position={[15, 25, 10]} intensity={3.0} castShadow shadow-mapSize={[2048, 2048]} color="#fef9c3" />
      <directionalLight position={[-10, 8, -5]} intensity={1.2} color="#bae6fd" />
      <directionalLight position={[0, -5, 8]} intensity={0.5} color="#86efac" />
      <SceneEnvironment />
      
      <Suspense fallback={null}>
        <group>
          {modelType === 'arm' && (
            <ProceduralRoboticArm 
              params={params} hoveredPart={hoveredPart} wireframe={wireframe}
              removedParts={removedParts} onTogglePart={onTogglePart} onHover={onHover} assemblyMode={assemblyMode}
              explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded} armState={armState}
            />
          )}
          {modelType === 'starship' && (
            <ProceduralStarship 
              params={params} hoveredPart={hoveredPart} wireframe={wireframe}
              removedParts={removedParts} onTogglePart={onTogglePart} onHover={onHover} assemblyMode={assemblyMode}
              explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded} rocketState={rocketState}
            />
          )}
          {modelType === 'robot' && (
            <ProceduralRobot 
              params={params} hoveredPart={hoveredPart} wireframe={wireframe}
              removedParts={removedParts} onTogglePart={onTogglePart} onHover={onHover} assemblyMode={assemblyMode}
              explosionLevel={explosionLevel} isPhysicalExploded={isPhysicalExploded} roverState={roverState}
            />
          )}
        </group>
      </Suspense>
      <OrbitControls 
        autoRotate={autoRotate} 
        autoRotateSpeed={2.5}
        enablePan={true} 
        makeDefault 
        minPolarAngle={0.1} 
        maxPolarAngle={Math.PI / 1.8} 
        target={controlsTarget}
      />
    </Canvas>
  );
}

// ==========================================
// PARTS DEFINITIONS
// ==========================================
const PARTS_MAP = {
  'KUKA Robotic Arm': [
    { id: 'arm-baseplate', name: 'Mounting Base Plate', icon: 'foundation' },
    { id: 'arm-basebolts', name: 'Base Mounting Bolts (Ã—8)', icon: 'hardware' },
    { id: 'arm-pedestal', name: 'Industrial Pedestal', icon: 'view_column' },
    { id: 'arm-collar', name: 'Rotational Bearing Collar', icon: 'settings' },
    { id: 'arm-shoulder', name: 'Shoulder Joint Assembly', icon: 'hub' },
    { id: 'arm-lowerarm', name: 'Lower Arm Segment', icon: 'straighten' },
    { id: 'arm-hydraulics', name: 'Hydraulic Piston Cylinders', icon: 'water_drop' },
    { id: 'arm-cables', name: 'Pneumatic Cables & Hoses', icon: 'cable' },
    { id: 'arm-elbow', name: 'Elbow Hinge Joint', icon: 'pivot_table_chart' },
    { id: 'arm-elbowbolts', name: 'Elbow Joint Bolts (Ã—6)', icon: 'hardware' },
    { id: 'arm-upperarm', name: 'Upper Arm Segment', icon: 'straighten' },
    { id: 'arm-wrist', name: 'Wrist Servo & Gear Box', icon: 'settings_suggest' },
    { id: 'arm-gripperbase', name: 'Gripper Mounting Plate', icon: 'grid_view' },
    { id: 'arm-leftjaw', name: 'Left Gripper Jaw', icon: 'pan_tool' },
    { id: 'arm-rightjaw', name: 'Right Gripper Jaw', icon: 'pan_tool' },
  ],
  'Starship Rocket': [
    { id: 'ss-launchpad', name: 'Launch Pad & Flame Diverter', icon: 'foundation' },
    { id: 'ss-clamps', name: 'Launch Clamp Hold-downs (Ã—4)', icon: 'lock' },
    { id: 'ss-engines', name: 'Raptor Engine Array (Ã—33)', icon: 'local_fire_department' },
    { id: 'ss-enginebolts', name: 'Engine Mount Bolts (Ã—24)', icon: 'hardware' },
    { id: 'ss-booster', name: 'Super Heavy Booster Body', icon: 'view_column' },
    { id: 'ss-gridfins', name: 'Grid Fins (Ã—4)', icon: 'air' },
    { id: 'ss-interstage', name: 'Interstage Separation Ring', icon: 'donut_large' },
    { id: 'ss-ship', name: 'Starship Upper Stage', icon: 'rocket' },
    { id: 'ss-heattiles', name: 'Heat Shield Tile Panels', icon: 'grid_4x4' },
    { id: 'ss-aftflaps', name: 'Aft Control Flaps (Ã—2)', icon: 'flight' },
    { id: 'ss-fwdflaps', name: 'Forward Control Flaps (Ã—2)', icon: 'flight' },
    { id: 'ss-nosecone', name: 'Aerodynamic Nose Cone', icon: 'change_history' },
    { id: 'ss-umbilical', name: 'Fuel Umbilical Connector', icon: 'power' },
  ],
  'Sample Device': [
    { id: 'rover-chassis', name: 'Chassis Platform', icon: 'dashboard' },
    { id: 'rover-cage', name: 'Roll Cage Frame', icon: 'crop_free' },
    { id: 'rover-pcb', name: 'PCB Controller Board', icon: 'memory' },
    { id: 'rover-battery', name: 'Battery Cell Pack', icon: 'battery_full' },
    { id: 'rover-camera', name: 'Stereo Camera Module', icon: 'videocam' },
    { id: 'rover-lidar', name: 'LiDAR Scanner', icon: 'radar' },
    { id: 'rover-wheelFL', name: 'Front Left Wheel', icon: 'tire_repair' },
    { id: 'rover-wheelFR', name: 'Front Right Wheel', icon: 'tire_repair' },
    { id: 'rover-wheelRL', name: 'Rear Left Wheel', icon: 'tire_repair' },
    { id: 'rover-wheelRR', name: 'Rear Right Wheel', icon: 'tire_repair' },
  ]
};

// PRELOADED SCRIPT TEMPLATES
const CODE_TEMPLATES = {
  arm: {
    welding: `// KUKA Robotic Arm: Precision Welding Routine
async function run() {
  console.log("Initializing robotic arm routine...");
  await arm.setTool("welding");
  await sleep(1000);
  
  console.log("Moving arm to target welding coordinates...");
  await arm.setRotation(45);
  await arm.setShoulder(30);
  await arm.setElbow(-15);
  await sleep(1500);

  console.log("Starting high-intensity welding torch...");
  await arm.startTool();
  await sleep(2500);

  console.log("Welding complete. Extinguishing torch.");
  await arm.stopTool();
  await sleep(1000);

  console.log("Repositioning back to home state.");
  await arm.setRotation(0);
  await arm.setShoulder(8);
  await arm.setElbow(-25);
}`,
    drilling: `// KUKA Robotic Arm: Component Drilling Routine
async function run() {
  console.log("Initializing robotic arm routine...");
  await arm.setTool("drill");
  await sleep(1000);
  
  console.log("Positioning spindle tip above workpiece...");
  await arm.setRotation(-30);
  await arm.setShoulder(20);
  await arm.setElbow(-35);
  await sleep(1500);

  console.log("Spindle motor active. Starting drilling cycle...");
  await arm.startTool();
  await sleep(3000);

  console.log("Drill hole complete. Spindle stopping.");
  await arm.stopTool();
  await sleep(1000);

  console.log("Returning to home coordinates.");
  await arm.setRotation(0);
  await arm.setShoulder(8);
  await arm.setElbow(-25);
}`,
    painting: `// KUKA Robotic Arm: Spray Painting Sweeps
async function run() {
  console.log("Initializing robotic arm routine...");
  await arm.setTool("paint");
  await sleep(1000);
  
  console.log("Moving to paint start position...");
  await arm.setRotation(-45);
  await arm.setShoulder(15);
  await arm.setElbow(-20);
  await sleep(1000);

  console.log("Activating atomized spray nozzle...");
  await arm.startTool();
  
  // Sweep across target
  for (let angle = -45; angle <= 45; angle += 15) {
    await arm.setRotation(angle);
    await sleep(400);
  }

  console.log("Sweep complete. Stopping spray...");
  await arm.stopTool();
  await sleep(1000);

  console.log("Returning to home coordinates.");
  await arm.setRotation(0);
  await arm.setShoulder(8);
  await arm.setElbow(-25);
}`
  },
  starship: {
    launch: `// SpaceX Starship Pre-launch & Flight Sequence
async function run() {
  console.log("T-minus 3 seconds: Flight computer active.");
  await sleep(1000);
  console.log("T-minus 2 seconds: Recirculation valves opening.");
  await sleep(1000);
  
  console.log("Ignition sequence start! Raptor engines firing...");
  await rocket.ignite();
  await sleep(1500);

  console.log("Liftoff! Starship is clearing the launch pad...");
  for (let alt = 0; alt <= 15; alt += 1) {
    await rocket.setAltitude(alt);
    await sleep(150);
  }
  
  console.log("Max-Q. Deflecting booster grid fins for orientation...");
  await rocket.setGridFinAngle(25);
  await sleep(1500);

  console.log("Booster staging confirmed. Separation ring active.");
  await rocket.stage();
  await sleep(1500);

  console.log("Executing attitude adjustment with RCS thrusters...");
  await rocket.fireRCS(1200);
  await sleep(1500);

  console.log("Deploying nosecone payload fairings...");
  await rocket.deployPayload();
  await sleep(1000);
  console.log("Satellite deployment successful.");
}`,
    abort: `// SpaceX Starship: Mid-flight Abort Test
async function run() {
  console.log("Igniting Raptor engines for flight abort test...");
  await rocket.ignite();
  await sleep(1000);

  console.log("Ascending to test abort altitude...");
  for (let alt = 1; alt <= 8; alt++) {
    await rocket.setAltitude(alt);
    await sleep(200);
  }

  console.log("ABORT COMMAND INITIATED! Firing attitude thrusters...");
  await rocket.fireRCS(1500);
  await sleep(600);

  console.log("Separating Upper Stage from Super Heavy Booster...");
  await rocket.stage();
  await sleep(2000);

  console.log("Emergency test completed successfully.");
}`
  },
  robot: {
    navigation: `// Autonomous Rover Navigation Path
async function run() {
  console.log("Rover systems booting...");
  await rover.powerOn();
  await sleep(1000);
  
  console.log("Activating optical LiDAR and scanner cones...");
  await rover.enableLidar();
  await sleep(1500);

  console.log("Calibrating front wheel steering linkages...");
  await rover.steer(-25);
  await sleep(800);
  await rover.steer(25);
  await sleep(800);
  await rover.steer(0);
  await sleep(500);

  console.log("Engaging drive motor. Setting speed parameter...");
  await rover.drive(1.5);
  await sleep(2000);

  console.log("Scanning... Obstacle detected! Engaging brakes.");
  await rover.drive(0);
  await sleep(1000);

  console.log("Navigating around object. Reversing...");
  await rover.steer(-20);
  await rover.drive(-1.0);
  await sleep(1500);
  
  console.log("Halted. Shutting down array.");
  await rover.drive(0);
  await rover.steer(0);
  await rover.disableLidar();
  await rover.powerOff();
  console.log("Diagnostic routine completed.");
}`
  }
};

// ==========================================
// MAIN HARDWARE LAB PAGE COMPONENT
// ==========================================
const HardwareLab = () => {
  // Tabs State
  const [sidebarTab, setSidebarTab] = useState('ide'); // 'ide' | 'assembly'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  
  // Electrical Panel UI state
  const [showElectricalPanel, setShowElectricalPanel] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Viewport Settings
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Structural States
  const [assemblyMode, setAssemblyMode] = useState(false);
  const [removedParts, setRemovedParts] = useState(new Set());
  const [explosionLevel, setExplosionLevel] = useState(0);
  const [isPhysicalExploded, setIsPhysicalExploded] = useState(false);

  // Programmable Simulator States
  const [code, setCode] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [showApiCheatSheet, setShowApiCheatSheet] = useState(true);

  // Simulation Machine parameters driven by sandboxed script runner
  const [armState, setArmState] = useState({
    baseRotation: 0,
    shoulderRotation: 8,
    elbowRotation: -25,
    wristRotation: 0,
    clawWidth: 0.3,
    activeTool: 'gripper',
    isWelding: false,
    isPainting: false,
    isDrilling: false
  });

  const [rocketState, setRocketState] = useState({
    propellantLevel: 75,
    gridFinAngle: 0,
    launchAltitude: 0,
    isStaged: false,
    isIgnited: false,
    rcsFiring: false,
    isPayloadDeployed: false
  });

  const [roverState, setRoverState] = useState({
    power: false,
    speed: 0,
    steeringAngle: 0,
    isLidarEnabled: false
  });

  // Dynamic Parameter States (Manual calibration sliders)
  const [armParams, setArmParams] = useState({
    baseHeight: 0.6, link1Length: 1.8, link2Length: 1.5, clawOpen: 0.3
  });
  const [rocketParams, setRocketParams] = useState({
    nozzleScale: 1.0, fuelFill: 75, strutCount: 6, gridFinAngle: 0
  });
  const [robotParams, setRobotParams] = useState({
    chassisWidth: 1.2, wheelSize: 0.34, lidarSpeed: 1.5, batteryCells: 4
  });

  const [hoveredPart, setHoveredPart] = useState(null);
  const consoleEndRef = useRef(null);
  const abortSignalRef = useRef(null);

  // Auth
  const { user, isAdmin } = useAuth();
  
  useEffect(() => {
    if (user && !isAdmin) { 
      logAttendance(); 
    }
  }, [user]);

  const logAttendance = async () => {
    try {
      await supabase.from('attendance').insert({
        student_id: user?.id, 
        session_type: '3D Hardware Lab'
      });
    } catch (err) {
      console.warn("Attendance log skipped:", err);
    }
  };

  useEffect(() => { 
    fetchModels(); 
  }, []);

  const fetchModels = async () => {
    const staticModels = [
      { id: '1', name: 'KUKA Robotic Arm', description: 'Complex 6-axis industrial robot with hydraulic pistons, pneumatic cables, rotational bearing collar, and precision gripper jaws. Every bolt, hose, and joint can be individually removed and reinstalled.', category: 'Robotics', icon: 'precision_manufacturing', file_url: 'procedural' },
      { id: '2', name: 'Starship Rocket', description: 'SpaceX Starship & Super Heavy â€” full-scale with 33 Raptor engines, heat shield tiles, forward/aft flaps, grid fins, interstage ring, launch clamps, and umbilical connectors. All components are modular.', category: 'Aerospace', icon: 'rocket_launch', file_url: 'procedural' },
      { id: '3', name: 'Sample Device', description: 'Autonomous rover with modular PCB controller, LiDAR scanner, stereo cameras, battery cells, and 4 independent drive wheels. Full assembly/disassembly support.', category: 'Robotics', icon: 'memory', file_url: 'procedural' }
    ];
    
    try {
      const { data } = await supabase.from('hardware_models').select('*').order('name');
      if (data && data.length > 0) {
        const updatedDbModels = data.map(m => {
          const normalizedName = m.name === 'Rocket Engine' ? 'Starship Rocket' : m.name;
          const match = staticModels.find(sm => sm.name === normalizedName);
          return match ? { ...m, name: normalizedName, description: match.description } : { ...m, name: normalizedName };
        });
        setModels(updatedDbModels);
        setSelectedModel(updatedDbModels[0]);
      } else {
        setModels(staticModels);
        setSelectedModel(staticModels[0]);
      }
    } catch {
      setModels(staticModels);
      setSelectedModel(staticModels[0]);
    }
    setLoading(false);
  };

  const selectedType = resolveModelType(selectedModel?.name);

  // Set default code template when model changes
  useEffect(() => {
    if (selectedType && CODE_TEMPLATES[selectedType]) {
      const templates = CODE_TEMPLATES[selectedType];
      const defaultKey = Object.keys(templates)[0];
      setSelectedTemplateKey(defaultKey);
      setCode(templates[defaultKey]);
    }
  }, [selectedModel, selectedType]);

  // Console autoscroll
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleTemplateChange = (templateKey) => {
    setSelectedTemplateKey(templateKey);
    if (selectedType && CODE_TEMPLATES[selectedType] && CODE_TEMPLATES[selectedType][templateKey]) {
      setCode(CODE_TEMPLATES[selectedType][templateKey]);
    }
  };

  const resetSimulation = () => {
    if (isRunning && abortSignalRef.current) {
      abortSignalRef.current();
    }
    setIsRunning(false);
    setIsPhysicalExploded(false);
    setExplosionLevel(0);
    setLogs([]);
    
    setArmState({
      baseRotation: 0,
      shoulderRotation: 8,
      elbowRotation: -25,
      wristRotation: 0,
      clawWidth: 0.3,
      activeTool: 'gripper',
      isWelding: false,
      isPainting: false,
      isDrilling: false
    });

    setRocketState({
      propellantLevel: 75,
      gridFinAngle: 0,
      launchAltitude: 0,
      isStaged: false,
      isIgnited: false,
      rcsFiring: false,
      isPayloadDeployed: false
    });

    setRoverState({
      power: false,
      speed: 0,
      steeringAngle: 0,
      isLidarEnabled: false
    });

    setResetKey(prev => prev + 1);
  };

  // Safe Sandboxed JavaScript compiler & executor
  const runCode = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([{ type: 'system', text: "Loading simulation thread and binding API hooks...", time: new Date().toLocaleTimeString() }]);

    const sleep = (ms) => new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, ms);
      abortSignalRef.current = () => {
        clearTimeout(timeoutId);
        reject(new Error("Simulation Aborted"));
      };
    });

    const customConsole = {
      log: (...args) => {
        const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
        setLogs(prev => [...prev, { type: 'info', text: msg, time: new Date().toLocaleTimeString() }]);
      },
      warn: (...args) => {
        const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
        setLogs(prev => [...prev, { type: 'warning', text: msg, time: new Date().toLocaleTimeString() }]);
      },
      error: (...args) => {
        const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
        setLogs(prev => [...prev, { type: 'error', text: msg, time: new Date().toLocaleTimeString() }]);
      }
    };

    const armAPI = {
      setRotation: async (yaw) => {
        setArmState(prev => ({ ...prev, baseRotation: yaw }));
        customConsole.log(`[ARM] Rotated base joint to ${yaw}Â°`);
      },
      setShoulder: async (pitch) => {
        setArmState(prev => ({ ...prev, shoulderRotation: pitch }));
        customConsole.log(`[ARM] Adjusted shoulder pitch to ${pitch}Â°`);
      },
      setElbow: async (pitch) => {
        setArmState(prev => ({ ...prev, elbowRotation: pitch }));
        customConsole.log(`[ARM] Adjusted elbow pitch to ${pitch}Â°`);
      },
      setWrist: async (roll) => {
        setArmState(prev => ({ ...prev, wristRotation: roll }));
        customConsole.log(`[ARM] Spun wrist servo gear to ${roll}Â°`);
      },
      setClaw: async (width) => {
        setArmState(prev => ({ ...prev, clawWidth: width }));
        customConsole.log(`[ARM] Claw effector distance set to ${width}m`);
      },
      setTool: async (toolName) => {
        setArmState(prev => ({ ...prev, activeTool: toolName }));
        customConsole.log(`[ARM] Swapped active end-effector tool to: ${toolName.toUpperCase()}`);
      },
      startTool: async () => {
        setArmState(prev => {
          const next = { ...prev };
          if (prev.activeTool === 'welding') next.isWelding = true;
          if (prev.activeTool === 'paint') next.isPainting = true;
          if (prev.activeTool === 'drill') next.isDrilling = true;
          return next;
        });
        customConsole.log(`[ARM] Active tool activation signal SENT.`);
      },
      stopTool: async () => {
        setArmState(prev => ({ ...prev, isWelding: false, isPainting: false, isDrilling: false }));
        customConsole.log(`[ARM] Active tool spindle deactivated.`);
      }
    };

    const rocketAPI = {
      ignite: async () => {
        setRocketState(prev => ({ ...prev, isIgnited: true }));
        customConsole.log(`[ROCKET] Raptor engines started. Main stage ignition confirmed.`);
      },
      setAltitude: async (altitude) => {
        setRocketState(prev => ({ ...prev, launchAltitude: altitude }));
        customConsole.log(`[ROCKET] Altitude telemetry updated: ${altitude} meters`);
      },
      stage: async () => {
        setRocketState(prev => ({ ...prev, isStaged: true }));
        customConsole.log(`[ROCKET] Separation clamps blown. Hot-staging separation SUCCESS.`);
      },
      setGridFinAngle: async (angle) => {
        setRocketState(prev => ({ ...prev, gridFinAngle: angle }));
        customConsole.log(`[ROCKET] Aero grid fin angle set to ${angle}Â°`);
      },
      fireRCS: async (duration) => {
        setRocketState(prev => ({ ...prev, rcsFiring: true }));
        customConsole.log(`[ROCKET] RCS cold gas attitude thrusters FIRING...`);
        await sleep(duration);
        setRocketState(prev => ({ ...prev, rcsFiring: false }));
        customConsole.log(`[ROCKET] RCS thrust cycle COMPLETED.`);
      },
      deployPayload: async () => {
        setRocketState(prev => ({ ...prev, isPayloadDeployed: true }));
        customConsole.log(`[ROCKET] Split fairings open. Releasing golden satellite cargo.`);
      }
    };

    const roverAPI = {
      powerOn: async () => {
        setRoverState(prev => ({ ...prev, power: true }));
        customConsole.log(`[ROVER] Controller logic power ON. Antennas emitting.`);
      },
      powerOff: async () => {
        setRoverState(prev => ({ ...prev, power: false }));
        customConsole.log(`[ROVER] Systems deactivated.`);
      },
      steer: async (angle) => {
        setRoverState(prev => ({ ...prev, steeringAngle: angle }));
        customConsole.log(`[ROVER] Front steering rack rotation: ${angle}Â°`);
      },
      drive: async (speed) => {
        setRoverState(prev => ({ ...prev, speed: speed }));
        customConsole.log(`[ROVER] Gearbox engaged. Driving motors set to ${speed} m/s`);
      },
      enableLidar: async () => {
        setRoverState(prev => ({ ...prev, isLidarEnabled: true }));
        customConsole.log(`[ROVER] Rotating LiDAR laser sensor array active.`);
      },
      disableLidar: async () => {
        setRoverState(prev => ({ ...prev, isLidarEnabled: false }));
        customConsole.log(`[ROVER] LiDAR scan halted.`);
      }
    };

    try {
      let runFn;
      try {
        runFn = new Function('arm', 'rocket', 'rover', 'sleep', 'console', `
          ${code}
          if (typeof run === 'function') {
            return run();
          } else {
            console.warn("System Check: No run() routine found. Executing root instructions.");
          }
        `);
      } catch (err) {
        throw new Error(`Syntax Error: ${err.message}`);
      }

      await runFn(armAPI, rocketAPI, roverAPI, sleep, customConsole);
      customConsole.log("[SYSTEM] Navigation/Routine sequence completed. Status: NOMINAL.");
    } catch (err) {
      if (err.message === "Simulation Aborted") {
        setLogs(prev => [...prev, { type: 'warning', text: "[SYSTEM] Process aborted by user interrupt.", time: new Date().toLocaleTimeString() }]);
      } else {
        setLogs(prev => [...prev, { type: 'error', text: `Runtime Error: ${err.message}`, time: new Date().toLocaleTimeString() }]);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const PARTS_TYPE_MAP = { arm: 'KUKA Robotic Arm', starship: 'Starship Rocket', robot: 'Sample Device' };
  
  const currentParts = useMemo(() => {
    return PARTS_MAP[PARTS_TYPE_MAP[selectedType]] || [];
  }, [selectedType]);

  const removedCount = useMemo(() => {
    return currentParts.filter(p => removedParts.has(p.id)).length;
  }, [currentParts, removedParts]);

  const onTogglePart = useCallback((partId) => {
    setRemovedParts(prev => {
      const next = new Set(prev);
      if (next.has(partId)) { 
        next.delete(partId); 
      } else { 
        next.add(partId); 
      }
      return next;
    });
  }, []);

  const onHover = useCallback((partId) => {
    setHoveredPart(partId);
  }, []);

  const disassembleAll = () => {
    const allIds = new Set(currentParts.map(p => p.id));
    setRemovedParts(allIds);
  };

  const assembleAll = () => {
    setRemovedParts(new Set());
  };

  const activeParams = selectedType === 'arm' ? armParams : (selectedType === 'starship' ? rocketParams : robotParams);

  const handleParamChange = (key, value) => {
    if (selectedType === 'arm') {
      setArmParams(prev => ({ ...prev, [key]: value }));
    } else if (selectedType === 'starship') {
      setRocketParams(prev => ({ ...prev, [key]: value }));
    } else {
      setRobotParams(prev => ({ ...prev, [key]: value }));
    }
  };

  if (loading) return (
    <div className="h-[calc(100vh-64px)] bg-[#020617] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-mono text-xs tracking-widest uppercase opacity-50">Initializing 3D Procedural Engine...</p>
    </div>
  );

  return (
    <div className="relative h-[calc(100vh-64px)] overflow-hidden bg-[#020617]">
      
      {/* ============================================ */}
      {/* FULL-SCREEN 3D VIEWPORT (ALWAYS BEHIND)     */}
      {/* ============================================ */}
      <div className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing">
        {selectedModel && (
          <ModelViewer 
            modelName={selectedModel.name} 
            autoRotate={autoRotate} 
            wireframe={wireframe}
            resetKey={resetKey}
            params={activeParams}
            hoveredPart={hoveredPart}
            removedParts={removedParts}
            onTogglePart={onTogglePart}
            onHover={onHover}
            assemblyMode={assemblyMode}
            explosionLevel={explosionLevel}
            isPhysicalExploded={isPhysicalExploded}
            armState={armState}
            rocketState={rocketState}
            roverState={roverState}
          />
        )}
      </div>

      {/* Vignette + scan effects */}
      <div className="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(2,6,23,0.35)_100%)]"></div>

      {/* ============================================ */}
      {/* SIDEBAR TOGGLE BUTTON (always visible)      */}
      {/* ============================================ */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute z-30 flex items-center justify-center transition-all duration-300 ease-in-out"
        style={{
          top: '50%',
          left: isSidebarOpen ? '480px' : '0px',
          transform: 'translateY(-50%)',
          width: '28px',
          height: '64px',
          borderRadius: '0 8px 8px 0',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderLeft: 'none',
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer'
        }}
        title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
      >
        <span className="material-symbols-outlined text-[16px]" style={{ transform: isSidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s ease' }}>
          chevron_left
        </span>
      </button>

      {/* ============================================ */}
      {/* LEFT SLIDE-IN SIDEBAR: IDE + ASSEMBLY       */}
      {/* ============================================ */}
      <aside 
        className="absolute top-0 bottom-0 z-20 flex flex-col bg-[#0f172a]/95 backdrop-blur-xl border-r border-white/10 shadow-2xl"
        style={{
          width: '480px',
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        
        {/* Tab Switcher Headers */}
        <div className="flex border-b border-white/10 bg-slate-950/40 shrink-0">
          <button
            onClick={() => setSidebarTab('ide')}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              sidebarTab === 'ide' 
                ? 'border-cyan-500 text-cyan-400 bg-cyan-950/10' 
                : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">code</span>
            Ignite Code Studio
          </button>
          <button
            onClick={() => setSidebarTab('assembly')}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              sidebarTab === 'assembly' 
                ? 'border-orange-500 text-orange-400 bg-orange-950/10' 
                : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">build</span>
            Structure & Assembly
          </button>
        </div>

        {/* Dynamic Tab Panel content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {sidebarTab === 'ide' ? (
            <div className="flex-1 min-h-0 flex flex-col p-4 space-y-3">
              
              {/* Toolbar Controls */}
              <div className="flex items-center justify-between gap-3 shrink-0 bg-slate-950/40 border border-white/5 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider font-mono">Routine Script:</span>
                  <select
                    value={selectedTemplateKey}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="bg-slate-900 text-white border border-white/10 rounded px-2.5 py-1 font-mono text-[10px] focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {selectedType && CODE_TEMPLATES[selectedType] && Object.keys(CODE_TEMPLATES[selectedType]).map(key => (
                      <option key={key} value={key}>{key.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={runCode}
                    disabled={isRunning}
                    className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                      isRunning 
                        ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' 
                        : 'bg-cyan-500 text-slate-950 border-cyan-400 hover:bg-cyan-400 hover:shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px] font-bold">play_arrow</span>
                    Run Script
                  </button>
                  <button
                    onClick={resetSimulation}
                    className="px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all border bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[12px]">restart_alt</span>
                    Reset Thread
                  </button>
                </div>
              </div>

              {/* API Accordion */}
              <div className="border border-white/5 rounded-lg bg-slate-950/20 overflow-hidden shrink-0">
                <button 
                  onClick={() => setShowApiCheatSheet(!showApiCheatSheet)}
                  className="w-full flex items-center justify-between px-3 py-1.5 bg-white/2 hover:bg-white/5 text-[9px] text-cyan-400 font-bold uppercase tracking-wider font-mono transition-colors border-b border-white/5"
                >
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">integration_instructions</span>API Cheat Sheet Reference</span>
                  <span className="material-symbols-outlined text-[14px]">
                    {showApiCheatSheet ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {showApiCheatSheet && (
                  <div className="p-3 text-[10px] font-mono text-slate-400 space-y-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
                    {selectedType === 'arm' && (
                      <>
                        <div><code className="text-cyan-300 font-bold">await arm.setRotation(deg)</code> - Yaw base rotation (-180 to 180).</div>
                        <div><code className="text-cyan-300 font-bold">await arm.setShoulder(deg)</code> - Shoulder hinge (-45 to 90).</div>
                        <div><code className="text-cyan-300 font-bold">await arm.setElbow(deg)</code> - Elbow hinge joint (-90 to 45).</div>
                        <div><code className="text-cyan-300 font-bold">await arm.setWrist(deg)</code> - Roll wrist gear spindle (-180 to 180).</div>
                        <div><code className="text-cyan-300 font-bold">await arm.setClaw(width)</code> - Effector gap width (0.1 to 0.6).</div>
                        <div><code className="text-cyan-300 font-bold">await arm.setTool(name)</code> - Swappable tools (<code className="text-slate-300">"welding" | "drill" | "paint" | "vacuum" | "gripper"</code>).</div>
                        <div><code className="text-cyan-300 font-bold">await arm.startTool()</code> - Activates specific sparks, drilling, paint mist.</div>
                        <div><code className="text-cyan-300 font-bold">await arm.stopTool()</code> - Stops current tool action.</div>
                      </>
                    )}
                    {selectedType === 'starship' && (
                      <>
                        <div><code className="text-cyan-300 font-bold">await rocket.ignite()</code> - Engine combustion starter (Raptor flame plume).</div>
                        <div><code className="text-cyan-300 font-bold">await rocket.setAltitude(alt)</code> - Scales position Y coordinates (0 to 15).</div>
                        <div><code className="text-cyan-300 font-bold">await rocket.stage()</code> - Triggers hot-stage interstage booster separation.</div>
                        <div><code className="text-cyan-300 font-bold">await rocket.setGridFinAngle(deg)</code> - Adjust Super Heavy grid fin pitch (-45 to 45).</div>
                        <div><code className="text-cyan-300 font-bold">await rocket.fireRCS(duration)</code> - Fires cold gas RCS attitude thrusters.</div>
                        <div><code className="text-cyan-300 font-bold">await rocket.deployPayload()</code> - Splits aerodynamic fairings to deploy satellite.</div>
                      </>
                    )}
                    {selectedType === 'robot' && (
                      <>
                        <div><code className="text-cyan-300 font-bold">await rover.powerOn()</code> - Power systems online, activate antennas & blinking LED.</div>
                        <div><code className="text-cyan-300 font-bold">await rover.powerOff()</code> - Shutdown internal power cells and telemetry.</div>
                        <div><code className="text-cyan-300 font-bold">await rover.steer(deg)</code> - Rotates front wheels steering angle (-30 to 30).</div>
                        <div><code className="text-cyan-300 font-bold">await rover.drive(speed)</code> - Spins wheels and interlocking chassis gears.</div>
                        <div><code className="text-cyan-300 font-bold">await rover.enableLidar()</code> - Powers up spinning LiDAR scanner array.</div>
                        <div><code className="text-cyan-300 font-bold">await rover.disableLidar()</code> - Halts LiDAR spin.</div>
                      </>
                    )}
                    <div><code className="text-cyan-300 font-bold">await sleep(ms)</code> - Blocks sandbox threads execution (e.g. 1000 for 1 second).</div>
                  </div>
                )}
              </div>

              {/* Monaco Editor Component */}
              <div className="flex-1 min-h-0 border border-white/10 rounded-lg overflow-hidden bg-[#1e1e1e]">
                <Editor
                  height="100%"
                  language="javascript"
                  theme="vs-dark"
                  value={code}
                  onChange={(val) => setCode(val)}
                  options={{
                    fontSize: 12,
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    folding: true,
                    scrollBeyondLastLine: false,
                    cursorBlinking: 'smooth',
                    formatOnType: true,
                    padding: { top: 8, bottom: 8 },
                    fontFamily: 'Fira Code, Consolas, Monaco, monospace'
                  }}
                />
              </div>

              {/* Terminal Logs Console Output */}
              <div className="h-44 border border-white/10 bg-[#020617] rounded-lg flex flex-col font-mono overflow-hidden shrink-0">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-slate-950/60">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Console Output Terminal</span>
                  </div>
                  <button 
                    onClick={() => setLogs([])}
                    className="text-[8px] text-slate-500 hover:text-white uppercase font-bold tracking-wider transition-colors"
                  >
                    Clear Logs
                  </button>
                </div>
                <div className="flex-1 p-3 overflow-y-auto space-y-1 text-[10px] leading-relaxed scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                  {logs.length === 0 ? (
                    <div className="text-slate-600 italic text-[9px]">Awaiting program compiler output...</div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-slate-600 shrink-0 select-none">[{log.time}]</span>
                        <span className={
                          log.type === 'error' ? 'text-red-400 font-bold' :
                          log.type === 'warning' ? 'text-yellow-400 font-bold' :
                          log.type === 'success' ? 'text-green-400 font-bold' :
                          log.type === 'system' ? 'text-cyan-400 font-bold' : 'text-slate-200'
                        }>
                          {log.text}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={consoleEndRef} />
                </div>
              </div>

            </div>
          ) : (
            // ASSEMBLY TAB
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
              
              {/* Assembly Mode Toggle */}
              <div className={`rounded-xl p-3 border transition-all ${assemblyMode ? 'bg-orange-500/10 border-orange-500/30' : 'bg-black/30 border-white/5'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-bold uppercase tracking-widest font-mono flex items-center gap-1 ${assemblyMode ? 'text-orange-400' : 'text-white/40'}`}>
                    <span className="material-symbols-outlined text-xs">build</span>
                    Assembly Mode
                  </span>
                  <button
                    onClick={() => setAssemblyMode(!assemblyMode)}
                    className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all border ${
                      assemblyMode 
                        ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.4)]' 
                        : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {assemblyMode ? 'ON' : 'OFF'}
                  </button>
                </div>
                {assemblyMode && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      <button onClick={disassembleAll} className="flex-1 px-2 py-1.5 rounded text-[8px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30 transition-all">
                        âŠ– Disassemble All
                      </button>
                      <button onClick={assembleAll} className="flex-1 px-2 py-1.5 rounded text-[8px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/20 hover:bg-green-500/30 transition-all">
                        âŠ• Assemble All
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-white/30 font-mono">Parts installed</span>
                      <span className="text-[9px] text-primary font-mono font-bold">{currentParts.length - removedCount}/{currentParts.length}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full transition-all duration-500"
                        style={{ width: `${currentParts.length > 0 ? ((currentParts.length - removedCount) / currentParts.length) * 100 : 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Assembly Parts Tree */}
              <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                <span className="text-[9px] text-primary font-bold uppercase tracking-widest block mb-2 font-mono flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">account_tree</span>
                  Assembly Parts Tree
                </span>
                <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
                  {currentParts.map(part => (
                    <div
                      key={part.id}
                      onMouseEnter={() => setHoveredPart(part.id)}
                      onMouseLeave={() => setHoveredPart(null)}
                      onClick={() => assemblyMode && onTogglePart(part.id)}
                      className={`px-2 py-1.5 rounded text-[10px] font-mono cursor-pointer transition-all flex items-center gap-1.5 ${
                        removedParts.has(part.id) 
                          ? 'bg-red-500/10 text-red-400/70 border-l-2 border-red-500/50 line-through' 
                          : hoveredPart === part.id 
                            ? 'bg-primary/10 text-primary font-bold border-l-2 border-primary' 
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[11px] opacity-60">{part.icon || 'settings'}</span>
                      <span className="flex-1 truncate">{part.name}</span>
                      {removedParts.has(part.id) && (
                        <span className="text-[7px] text-red-400 font-bold uppercase">removed</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[8px] text-white/20 mt-2 text-center font-mono">
                  {assemblyMode ? 'Click any part inside listing to remove or reinstall it' : 'Enable Assembly Mode to select individual components'}
                </p>
              </div>

              {/* MANUAL CALIBRATION ACCORDION */}
              <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                <span className="text-[9px] text-primary font-bold uppercase tracking-widest block mb-3 font-mono flex items-center gap-1 border-b border-white/5 pb-1">
                  <span className="material-symbols-outlined text-xs">tune</span>
                  ðŸ§¬ Dynamic Hardware Calibration
                </span>
                
                {selectedType === 'arm' && (
                  <div className="space-y-3">
                    {[
                      { key: 'baseHeight', label: 'BASE HEIGHT', min: 0.3, max: 1.2, step: 0.05, unit: 'm' },
                      { key: 'link1Length', label: 'LOWER ARM LINK', min: 1.0, max: 3.0, step: 0.05, unit: 'm' },
                      { key: 'link2Length', label: 'UPPER ARM LINK', min: 0.8, max: 2.5, step: 0.05, unit: 'm' },
                      { key: 'clawOpen', label: 'EFFECTOR CLAW', min: 0.1, max: 0.6, step: 0.02, unit: 'm' },
                    ].map(({ key, label, min, max, step, unit }) => (
                      <div key={key}>
                        <div className="flex justify-between text-[8px] font-mono text-white/40 mb-1">
                          <span>{label}</span>
                          <span>{armParams[key]}{unit}</span>
                        </div>
                        <input 
                          type="range" min={min} max={max} step={step} value={armParams[key]} 
                          onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                          className="w-full h-1 bg-white/5 appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {selectedType === 'starship' && (
                  <div className="space-y-3">
                    {[
                      { key: 'nozzleScale', label: 'RAPTOR NOZZLE SCALE', min: 0.5, max: 2.0, step: 0.05, unit: 'x', parse: parseFloat },
                      { key: 'fuelFill', label: 'PROPELLANT FILL LEVEL', min: 0, max: 100, step: 1, unit: '%', parse: parseFloat },
                      { key: 'strutCount', label: 'INTERSTAGE STRUTS', min: 4, max: 12, step: 1, unit: ' units', parse: parseInt },
                      { key: 'gridFinAngle', label: 'GRID FIN PITCH', min: -45, max: 45, step: 5, unit: 'Â°', parse: parseInt },
                    ].map(({ key, label, min, max, step, unit, parse }) => (
                      <div key={key}>
                        <div className="flex justify-between text-[8px] font-mono text-white/40 mb-1">
                          <span>{label}</span>
                          <span>{rocketParams[key]}{unit}</span>
                        </div>
                        <input 
                          type="range" min={min} max={max} step={step} value={rocketParams[key]} 
                          onChange={(e) => handleParamChange(key, parse(e.target.value))}
                          className="w-full h-1 bg-white/5 appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {selectedType === 'robot' && (
                  <div className="space-y-3">
                    {[
                      { key: 'chassisWidth', label: 'CHASSIS WIDTH', min: 0.8, max: 2.0, step: 0.05, unit: 'm', parse: parseFloat },
                      { key: 'wheelSize', label: 'WHEEL DIAMETER', min: 0.2, max: 0.6, step: 0.02, unit: 'm', parse: parseFloat },
                      { key: 'lidarSpeed', label: 'LIDAR SPIN SPEED', min: 0.0, max: 5.0, step: 0.2, unit: ' rad/s', parse: parseFloat },
                      { key: 'batteryCells', label: 'BATTERY CELLS', min: 1, max: 6, step: 1, unit: ' units', parse: parseInt },
                    ].map(({ key, label, min, max, step, unit, parse }) => (
                      <div key={key}>
                        <div className="flex justify-between text-[8px] font-mono text-white/40 mb-1">
                          <span>{label}</span>
                          <span>{robotParams[key]}{unit}</span>
                        </div>
                        <input 
                          type="range" min={min} max={max} step={step} value={robotParams[key]} 
                          onChange={(e) => handleParamChange(key, parse(e.target.value))}
                          className="w-full h-1 bg-white/5 appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[7px] text-white/20 mt-2 text-center font-mono">Modifying parameters rebuilds the 3D meshes dynamically</p>
              </div>

            </div>
          )}
        </div>
      </aside>

      {/* ============================================ */}
      {/* TOP DETAILS BAR (collapsible)               */}
      {/* ============================================ */}
      <div 
        className="absolute z-10 transition-all duration-300 ease-in-out pointer-events-auto"
        style={{
          top: isDetailsOpen ? '0' : '-140px',
          left: isSidebarOpen ? '508px' : '36px',
          right: '0',
          transition: 'top 0.35s cubic-bezier(0.4,0,0.2,1), left 0.35s cubic-bezier(0.4,0,0.2,1)'
        }}
      >
        <div className="flex items-start gap-3 p-4">
          {/* Model info card */}
          <div className="bg-slate-950/90 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-2xl max-w-sm">
            <div className="flex items-center justify-between mb-2 gap-3">
              <span className="text-[8px] text-white/40 font-mono tracking-wider">HARDWARE SELECTOR</span>
              <select
                value={selectedModel?.id || ''}
                onChange={(e) => {
                  const model = models.find(m => m.id === e.target.value);
                  if (model) {
                    setSelectedModel(model);
                    setResetKey(prev => prev + 1);
                    setRemovedParts(new Set());
                    resetSimulation();
                  }
                }}
                className="bg-slate-900 text-white border border-white/10 rounded px-2 py-0.5 font-mono text-[9px] focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <h1 className="text-white font-bold text-sm mb-1">{selectedModel?.name}</h1>
            <p className="text-[10px] text-white/40 leading-relaxed mb-2.5">{selectedModel?.description}</p>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-primary font-bold uppercase tracking-widest">{selectedModel?.category}</span>
              <div className="w-1 h-1 bg-white/20 rounded-full"></div>
              <span className={`text-[8px] font-mono font-bold ${assemblyMode ? 'text-orange-400' : 'text-slate-400'}`}>
                {assemblyMode ? 'ASSEMBLY MODE' : 'VIEW MODE'}
              </span>
            </div>
          </div>

          {/* Viewport controls toolbar */}
          <div className="flex gap-1.5 mt-1">
            <button
              onClick={() => setShowElectricalPanel(prev => !prev)}
              className={`px-3 py-1 h-9 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border flex items-center gap-1 ${
                showElectricalPanel 
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]' 
                  : 'bg-slate-950/80 text-white/60 border-white/10 hover:text-white'
              }`}
              title="Toggle Electrical Panel"
            >
              âš¡ Schematics
            </button>
            <button 
              onClick={() => setAutoRotate(!autoRotate)}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                autoRotate ? 'bg-primary border-primary text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-slate-950/80 border-white/10 text-white/60 hover:text-white'
              }`}
              title="Toggle Auto-Rotate"
            >
              <span className="material-symbols-outlined text-[18px]">sync</span>
            </button>
            <button 
              onClick={() => setWireframe(!wireframe)}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                wireframe ? 'bg-primary border-primary text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-slate-950/80 border-white/10 text-white/60 hover:text-white'
              }`}
              title="Toggle X-Ray Grid"
            >
              <span className="material-symbols-outlined text-[18px]">grid_4x4</span>
            </button>
            <button 
              onClick={() => setResetKey(prev => prev + 1)}
              className="w-9 h-9 rounded-lg bg-slate-950/80 border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all"
              title="Reset Viewpoint"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            </button>
          </div>
        </div>
      </div>

      {/* Minimize/Expand details bar toggle button */}
      <button
        onClick={() => setIsDetailsOpen(!isDetailsOpen)}
        className="absolute z-10 pointer-events-auto flex items-center justify-center"
        style={{
          top: isDetailsOpen ? '130px' : '8px',
          right: '20px',
          width: '32px',
          height: '24px',
          borderRadius: '0 0 8px 8px',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderTop: isDetailsOpen ? 'none' : '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
          transition: 'top 0.35s cubic-bezier(0.4,0,0.2,1)'
        }}
        title={isDetailsOpen ? 'Hide Details Bar' : 'Show Details Bar'}
      >
        <span className="material-symbols-outlined text-[14px]" style={{ transform: isDetailsOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s ease' }}>
          expand_less
        </span>
      </button>

      {/* ============================================ */}
      {/* Structural Disassembly controls (right side) */}
      {/* ============================================ */}
      <div className="absolute z-10 w-56 pointer-events-auto" style={{ top: isDetailsOpen ? '150px' : '40px', right: '20px', transition: 'top 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
        <div className="bg-slate-950/90 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-2xl space-y-3.5">
          <span className="text-[9px] text-orange-400 font-bold uppercase tracking-wider font-mono block border-b border-white/5 pb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs">explosion</span>
            Structural Disassembly
          </span>
          
          <div>
            <div className="flex justify-between text-[8px] font-mono text-white/40 mb-1">
              <span>MANUAL EXPLODE LEVEL</span>
              <span>{Math.round(explosionLevel * 66.6)}%</span>
            </div>
            <input 
              type="range" min={0.0} max={1.5} step={0.05} value={explosionLevel} 
              onChange={(e) => setExplosionLevel(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/5 appearance-none cursor-pointer accent-orange-500"
            />
          </div>

          <button
            onClick={() => {
              setIsPhysicalExploded(true);
              setLogs(prev => [
                ...prev, 
                { type: 'warning', text: "[SYSTEM CRITICAL] EMERGENCY OVERPRESSURE OVERRIDE DETECTED.", time: new Date().toLocaleTimeString() },
                { type: 'error', text: "[SYSTEM CRITICAL] STRUCTURAL FAILURE: SELF-DESTRUCT INITIATED. ALL PIECES EXPELLED.", time: new Date().toLocaleTimeString() }
              ]);
            }}
            disabled={isPhysicalExploded}
            className={`w-full py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
              isPhysicalExploded 
                ? 'bg-red-950/30 text-red-500 border-red-900/30 cursor-not-allowed' 
                : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500 hover:text-white shadow-[0_0_12px_rgba(239,68,68,0.2)]'
            }`}
          >
            {isPhysicalExploded ? 'ðŸ’¥ DESTRUCTED' : 'ðŸ’¥ SELF-DESTRUCT'}
          </button>
        </div>
      </div>

      {/* Bottom stats cards */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-5 pointer-events-none grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-950/80 backdrop-blur-md p-3 rounded-lg border border-white/5">
          <p className="text-[8px] text-white/30 uppercase font-bold tracking-widest mb-1">Render Engine</p>
          <p className="text-[10px] text-green-400 font-mono flex items-center gap-1.5 font-bold">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
            THREE.JS ACTIVE
          </p>
        </div>
        <div className="bg-slate-950/80 backdrop-blur-md p-3 rounded-lg border border-white/5">
          <p className="text-[8px] text-white/30 uppercase font-bold tracking-widest mb-1">Shading Model</p>
          <p className="text-[10px] text-white font-mono uppercase font-bold">{wireframe ? 'WIREFRAME-X' : 'PHYSICAL-PBR'}</p>
        </div>
        <div className="bg-slate-950/80 backdrop-blur-md p-3 rounded-lg border border-white/5">
          <p className="text-[8px] text-white/30 uppercase font-bold tracking-widest mb-1">Assembly Status</p>
          <p className={`text-[10px] font-mono uppercase font-bold ${assemblyMode ? 'text-orange-400' : 'text-slate-400'}`}>
            {assemblyMode ? `${currentParts.length - removedCount}/${currentParts.length} INSTALLED` : 'VIEW ONLY'}
          </p>
        </div>
        <div className="bg-slate-950/80 backdrop-blur-md p-3 rounded-lg border border-white/5">
          <p className="text-[8px] text-white/30 uppercase font-bold tracking-widest mb-1">System Health</p>
          <p className="text-[10px] text-primary font-mono uppercase font-bold">100% NOMINAL</p>
        </div>
      </div>

      {/* WIDE ELECTRICAL SCHEMATIC DRAWER OVERLAY */}
      {showElectricalPanel && (
        <aside className="absolute top-0 right-0 bottom-0 w-full lg:w-[480px] z-30 bg-[#070b14] border-l border-white/10 flex flex-col animate-fade-in pointer-events-auto">
          <div className="absolute top-3 right-3 z-30">
            <button 
              onClick={() => setShowElectricalPanel(false)}
              className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 text-white/60 hover:text-white flex items-center justify-center hover:bg-slate-800 transition-all shadow-lg"
              title="Close Panel"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ElectricalPanel />
          </div>
        </aside>
      )}
    </div>
  );
};

export default HardwareLab;

