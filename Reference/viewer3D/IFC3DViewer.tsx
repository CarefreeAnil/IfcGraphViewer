import { Suspense, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, PerspectiveCamera, Center } from '@react-three/drei';
import * as THREE from 'three';
import { useIFCViewer } from '@/contexts/IFCViewerContext';
import { IFCMesh } from './IFCMesh';
import { Loader2, Box, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

function IFCModel() {
  const { 
    geometries, 
    selectedEntityId, 
    hoveredEntityId,
    selectEntity,
    hoverEntity 
  } = useIFCViewer();
  
  // Convert geometries map to array for rendering
  const geometryArray = useMemo(() => {
    return Array.from(geometries.values());
  }, [geometries]);
  
  const handleClick = useCallback((expressId: number) => {
    selectEntity(`#${expressId}`);
  }, [selectEntity]);
  
  const handlePointerOver = useCallback((expressId: number) => {
    hoverEntity(`#${expressId}`);
  }, [hoverEntity]);
  
  const handlePointerOut = useCallback(() => {
    hoverEntity(null);
  }, [hoverEntity]);
  
  // Calculate bounding box for centering
  const bounds = useMemo(() => {
    const box = new THREE.Box3();
    geometryArray.forEach(geom => {
      const vertices = geom.vertices;
      for (let i = 0; i < vertices.length; i += 6) {
        box.expandByPoint(new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]));
      }
    });
    return box;
  }, [geometryArray]);
  
  const center = useMemo(() => {
    const c = new THREE.Vector3();
    bounds.getCenter(c);
    return c;
  }, [bounds]);
  
  if (geometryArray.length === 0) {
    return null;
  }
  
  return (
    <group position={[-center.x, -center.y, -center.z]}>
      {geometryArray.map((geom) => (
        <IFCMesh
          key={geom.expressId}
          geometry={geom}
          isSelected={selectedEntityId === `#${geom.expressId}`}
          isHovered={hoveredEntityId === `#${geom.expressId}`}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      ))}
    </group>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[20, 15, 20]} fov={50} />
      <OrbitControls 
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={200}
      />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[50, 50, 50]} 
        intensity={0.8}
        castShadow
      />
      <directionalLight 
        position={[-30, 30, -30]} 
        intensity={0.3}
      />
      
      {/* Environment for better reflections */}
      <Environment preset="city" />
      
      {/* Grid */}
      <Grid
        position={[0, -0.01, 0]}
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6b7280"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#374151"
        fadeDistance={100}
        fadeStrength={1}
        followCamera={false}
      />
      
      {/* IFC Model */}
      <Suspense fallback={null}>
        <IFCModel />
      </Suspense>
    </>
  );
}

export function IFC3DViewer() {
  const { geometries, isLoading, rawIFCData } = useIFCViewer();
  const [showWireframe, setShowWireframe] = useState(false);
  
  const hasGeometry = geometries.size > 0;
  const hasData = rawIFCData !== null;
  
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-card/95 backdrop-blur border border-border rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center gap-3">
            <Box className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">3D Viewer</span>
            <span className="text-xs text-muted-foreground">
              {geometries.size} elements
            </span>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          size="sm"
          variant={showWireframe ? "default" : "outline"}
          onClick={() => setShowWireframe(!showWireframe)}
          className="bg-card/95 backdrop-blur"
        >
          {showWireframe ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </Button>
      </div>
      
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Extracting geometry...</p>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {!hasData && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <Box className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-medium text-lg text-muted-foreground mb-2">
              No IFC Loaded
            </h3>
            <p className="text-sm text-muted-foreground/70">
              Upload an IFC file to view the 3D model here. The graph and 3D views are synchronized.
            </p>
          </div>
        </div>
      )}
      
      {/* No geometry but has data */}
      {hasData && !hasGeometry && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <Box className="w-16 h-16 text-amber-500/40 mx-auto mb-4" />
            <h3 className="font-medium text-lg text-amber-500 mb-2">
              No Geometry Found
            </h3>
            <p className="text-sm text-muted-foreground/70">
              This IFC file doesn't contain renderable geometry. It may only have spatial structure data.
            </p>
          </div>
        </div>
      )}
      
      {/* 3D Canvas */}
      {hasGeometry && (
        <Canvas
          shadows
          gl={{ 
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1,
          }}
          style={{ background: 'transparent' }}
        >
          <Scene />
        </Canvas>
      )}
      
      {/* Stats */}
      {hasGeometry && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 shadow-lg">
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>Click to select • Scroll to zoom • Drag to rotate</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
