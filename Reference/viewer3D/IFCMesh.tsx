import { useMemo, useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { IFCGeometry } from '@/lib/ifc-geometry-parser';

interface IFCMeshProps {
  geometry: IFCGeometry;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (expressId: number) => void;
  onPointerOver: (expressId: number) => void;
  onPointerOut: () => void;
}

export function IFCMesh({ 
  geometry, 
  isSelected, 
  isHovered,
  onClick,
  onPointerOver,
  onPointerOut 
}: IFCMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create BufferGeometry from IFC data
  const bufferGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    
    // web-ifc returns interleaved vertex data: [x, y, z, nx, ny, nz, ...]
    const vertexData = geometry.vertices;
    const indexData = geometry.indices;
    
    // Separate positions and normals
    const positions: number[] = [];
    const normals: number[] = [];
    
    for (let i = 0; i < vertexData.length; i += 6) {
      positions.push(vertexData[i], vertexData[i + 1], vertexData[i + 2]);
      normals.push(vertexData[i + 3], vertexData[i + 4], vertexData[i + 5]);
    }
    
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setIndex(Array.from(indexData));
    
    return geom;
  }, [geometry]);
  
  // Create transformation matrix
  const matrix = useMemo(() => {
    const mat = new THREE.Matrix4();
    mat.fromArray(geometry.matrix);
    return mat;
  }, [geometry.matrix]);
  
  // Create material with selection/hover states
  const material = useMemo(() => {
    const baseColor = geometry.color || { r: 0.7, g: 0.7, b: 0.7, a: 1 };
    
    let color = new THREE.Color(baseColor.r, baseColor.g, baseColor.b);
    let emissive = new THREE.Color(0, 0, 0);
    let opacity = baseColor.a;
    
    if (isSelected) {
      emissive = new THREE.Color(0.2, 0.4, 0.8);
      opacity = Math.max(opacity, 0.9);
    } else if (isHovered) {
      emissive = new THREE.Color(0.1, 0.2, 0.4);
      opacity = Math.max(opacity, 0.8);
    }
    
    return new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: isSelected ? 0.5 : isHovered ? 0.3 : 0,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      flatShading: false,
    });
  }, [geometry.color, isSelected, isHovered]);
  
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(geometry.expressId);
  };
  
  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onPointerOver(geometry.expressId);
  };
  
  return (
    <mesh
      ref={meshRef}
      geometry={bufferGeometry}
      material={material}
      matrix={matrix}
      matrixAutoUpdate={false}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={onPointerOut}
    />
  );
}
