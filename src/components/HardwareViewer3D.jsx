import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stage, Center } from '@react-three/drei';

function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

const HardwareViewer3D = () => {
  return (
    <div className="w-full h-full relative bg-inverse-surface rounded-xl overflow-hidden cursor-grab active:cursor-grabbing shadow-[0_4px_20px_rgba(34,211,238,0.15)]">
      
      {/* HUD Elements */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <span className="bg-primary/80 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wider border border-white/20">
          3D Interactive Mode
        </span>
      </div>
      
      <div className="absolute bottom-4 left-4 z-10">
        <p className="text-white/70 text-xs bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
          Drag to rotate • Scroll to zoom
        </p>
      </div>

      <Canvas camera={{ position: [5, 2, 5], fov: 45 }} shadows>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} adjustCamera>
            <Model url="/rocket.glb" />
          </Stage>
        </Suspense>
        
        <OrbitControls 
          enablePan={false}
          makeDefault
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  );
};

export default HardwareViewer3D;
