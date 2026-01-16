/**
 * 3D IFC Viewer - Simple Three.js implementation
 * Shows IFC entities as colored boxes with proper interaction
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as WebIFC from 'web-ifc';
import { AlertCircle } from 'lucide-react';

interface Viewer3DProps {
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  ifcFileBuffer?: ArrayBuffer;
}

export default function Viewer3D({ selectedNodeId, onSelectNode, ifcFileBuffer }: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const originalMaterialRef = useRef<THREE.Material | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geometryCount, setGeometryCount] = useState(0);

  // Handle selection from other components or internal clicks
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const scene = sceneRef.current;

    if (!selectedNodeId || !meshesRef.current.length) {
      // Reset all meshes to full opacity
      meshesRef.current.forEach(m => {
        if (m.material instanceof THREE.Material) {
          m.material.transparent = false;
          m.material.opacity = 1.0;
          m.material.needsUpdate = true;
        }
      });

      // Reset selection if nothing selected
      if (selectedMeshRef.current && originalMaterialRef.current) {
        selectedMeshRef.current.material = originalMaterialRef.current;
        selectedMeshRef.current = null;
        originalMaterialRef.current = null;
      }
      return;
    }

    // Reset previous selection
    if (selectedMeshRef.current && originalMaterialRef.current) {
      selectedMeshRef.current.material = originalMaterialRef.current;
      selectedMeshRef.current = null;
      originalMaterialRef.current = null;
    }

    // Find and highlight the selected mesh
    const nodeIdMatch = selectedNodeId.match(/node_(\d+)/);
    if (nodeIdMatch) {
      const expressId = parseInt(nodeIdMatch[1]);
      const mesh = meshesRef.current.find(m => m.userData.ifcExpressId === expressId);
      
      if (mesh && mesh.material instanceof THREE.Material) {
        originalMaterialRef.current = mesh.material;
        const highlightMaterial = new THREE.MeshStandardMaterial({
          color: 0xffff00,
          emissive: 0xffaa00,
          emissiveIntensity: 0.5,
          side: THREE.DoubleSide,
          metalness: 0.2,
          roughness: 0.6,
          transparent: false,
          opacity: 1.0,
        });
        mesh.material = highlightMaterial;
        selectedMeshRef.current = mesh;

        // Make all other meshes transparent
        meshesRef.current.forEach(m => {
          if (m !== mesh && m.material instanceof THREE.Material) {
            // Store original transparency state if not already stored
            if (!m.userData.originalTransparent) {
              m.userData.originalTransparent = m.material.transparent;
              m.userData.originalOpacity = m.material.opacity;
            }
            m.material.transparent = true;
            m.material.opacity = 0.08; // 8% opacity - more aggressive de-emphasis
            m.material.needsUpdate = true;
          }
        });

        // Zoom to fit the selected mesh
        if (camera && controls) {
          const box = new THREE.Box3().setFromObject(mesh);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          
          // Calculate camera position
          const fov = camera.fov * (Math.PI / 180);
          const cameraDistance = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5;
          
          // Smooth camera transition
          const direction = camera.position.clone().sub(controls.target).normalize();
          const targetPosition = center.clone().add(direction.multiplyScalar(cameraDistance));
          
          // Animate camera movement
          const startPos = camera.position.clone();
          const startTarget = controls.target.clone();
          const duration = 800; // ms
          const startTime = Date.now();
          
          const animateCamera = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            
            camera.position.lerpVectors(startPos, targetPosition, eased);
            controls.target.lerpVectors(startTarget, center, eased);
            controls.update();
            
            if (progress < 1) {
              requestAnimationFrame(animateCamera);
            }
          };
          
          animateCamera();
        }
      }
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (!containerRef.current) return;

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let meshes: THREE.Mesh[] = [];

    const init = async () => {
      try {
        // Scene setup
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e1b4b);
        sceneRef.current = scene;

        // Camera setup
        const width = containerRef.current!.clientWidth;
        const height = containerRef.current!.clientHeight;
        camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
        camera.position.set(50, 50, 50);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.current!.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lighting - optimized for sharp rendering
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(100, 100, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);
        
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight2.position.set(-100, -100, -100);
        scene.add(directionalLight2);
        
        // Point light for additional illumination
        const pointLight = new THREE.PointLight(0xffffff, 0.3);
        pointLight.position.set(50, 50, 50);
        scene.add(pointLight);

        // Grid
        const gridHelper = new THREE.GridHelper(200, 20, 0x444466, 0x222233);
        scene.add(gridHelper);

        // Setup OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = true;
        controls.minDistance = 5;
        controls.maxDistance = 500;
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        controlsRef.current = controls;

        // Load IFC if provided
        if (ifcFileBuffer) {
          meshes = await loadIFC(scene, ifcFileBuffer);
          meshesRef.current = meshes;
          
          // Auto-fit camera to loaded geometry
          if (meshes.length > 0) {
            const box = new THREE.Box3();
            meshes.forEach(mesh => box.expandByObject(mesh));
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // Update camera position
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            
            camera.position.copy(center);
            camera.position.z += cameraZ * 1.5;
            camera.lookAt(center);
            camera.updateProjectionMatrix();
            
            // Update controls
            controls.target.copy(center);
            controls.maxDistance = maxDim * 10;
            controls.minDistance = maxDim * 0.1;
            controls.update();
            
            console.log('[Viewer3D] Auto-fitted camera. Scene bounds:', { min: box.min, max: box.max });
          }
          
          setGeometryCount(meshes.length);
          setIsLoading(false);
        } else {
          // Demo cube
          const geometry = new THREE.BoxGeometry(10, 10, 10);
          const material = new THREE.MeshPhongMaterial({ color: 0xfbbf24 });
          const cube = new THREE.Mesh(geometry, material);
          scene.add(cube);
          meshes = [cube];
          setGeometryCount(1);
          setIsLoading(false);
        }

        // Continuous animation loop for smooth interaction
        const animate = () => {
          controls.update();
          renderer.render(scene, camera);
          requestAnimationFrame(animate);
        };
        animate();

        // Add click selection
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        const handleClick = (e: MouseEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(meshes);

          if (intersects.length > 0) {
            const mesh = intersects[0].object as THREE.Mesh;
            const { ifcExpressId } = mesh.userData;
            
            // Just notify parent - the useEffect will handle highlighting
            if (ifcExpressId && onSelectNode) {
              onSelectNode(`node_${ifcExpressId}`);
            }
          } else {
            // Clicked empty space - deselect
            if (onSelectNode) {
              onSelectNode('');
            }
          }
        };
        
        renderer.domElement.addEventListener('click', handleClick);

        // Resize handler
        const handleResize = () => {
          if (!containerRef.current) return;
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          renderer.domElement.removeEventListener('click', handleClick);
          controls.dispose();
          renderer.dispose();
          if (containerRef.current?.contains(renderer.domElement)) {
            containerRef.current.removeChild(renderer.domElement);
          }
        };
      } catch (err) {
        console.error('[Viewer3D] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize viewer');
        setIsLoading(false);
      }
    };

    init();
  }, [ifcFileBuffer]);

  const loadIFC = async (scene: THREE.Scene, buffer: ArrayBuffer): Promise<THREE.Mesh[]> => {
    console.log('[Viewer3D] Loading IFC file using StreamAllMeshes');
    const meshes: THREE.Mesh[] = [];

    try {
      const ifcApi = new WebIFC.IfcAPI();
      await ifcApi.Init();
      
      const uint8Array = new Uint8Array(buffer);
      const modelId = ifcApi.OpenModel(uint8Array);
      console.log('[Viewer3D] IFC model opened, ID:', modelId);

      // Default colors for entity types
      const typeColors: Record<string, number> = {
        'IFCWALL': 0xCCBBB8,
        'IFCWALLSTANDARDCASE': 0xCCBBB8,
        'IFCSLAB': 0xCCCCCC,
        'IFCSLABSTANDARDCASE': 0xCCCCCC,
        'IFCDOOR': 0x996633,
        'IFCWINDOW': 0xB3D9FF,
        'IFCCOLUMN': 0xB3B3B3,
        'IFCBEAM': 0xC0C0C0,
        'IFCROOF': 0x996622,
        'IFCSTAIR': 0xD9D9D9,
        'IFCRAILING': 0x808080,
        'IFCFURNISHINGELEMENT': 0x805020,
        'IFCOPENINGELEMENT': 0x4D4D4D,
      };

      // Stream all meshes efficiently
      ifcApi.StreamAllMeshes(modelId, (flatMesh: WebIFC.FlatMesh) => {
        const expressId = flatMesh.expressID;
        
        // Get type name
        let typeName = 'default';
        try {
          const lineData = ifcApi.GetLine(modelId, expressId, false);
          if (lineData) {
            typeName = ifcApi.GetNameFromTypeCode(lineData.type)?.toUpperCase() || 'default';
          }
        } catch (e) {
          // Ignore
        }

        const color = new THREE.Color(typeColors[typeName] || 0xB3B3B3);
        
        // Process each geometry in the mesh
        for (let i = 0; i < flatMesh.geometries.size(); i++) {
          const geometry = flatMesh.geometries.get(i);
          const geometryData = ifcApi.GetGeometry(modelId, geometry.geometryExpressID);
          
          if (!geometryData) continue;

          // Get interleaved vertex data (position + normal = 6 floats per vertex)
          const vertexData = ifcApi.GetVertexArray(
            geometryData.GetVertexData(),
            geometryData.GetVertexDataSize()
          );
          const indices = ifcApi.GetIndexArray(
            geometryData.GetIndexData(),
            geometryData.GetIndexDataSize()
          );

          if (!vertexData || vertexData.length === 0) {
            geometryData.delete();
            continue;
          }

          // Create BufferGeometry and separate position/normal
          const bufferGeometry = new THREE.BufferGeometry();
          
          const positions: number[] = [];
          const normals: number[] = [];
          
          // web-ifc returns [x, y, z, nx, ny, nz, ...] - 6 floats per vertex
          for (let v = 0; v < vertexData.length; v += 6) {
            positions.push(vertexData[v], vertexData[v + 1], vertexData[v + 2]);
            normals.push(vertexData[v + 3], vertexData[v + 4], vertexData[v + 5]);
          }
          
          bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
          
          if (indices && indices.length > 0) {
            bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
          }

          // Create material - optimized for sharp appearance
          const material = new THREE.MeshStandardMaterial({
            color,
            side: THREE.DoubleSide,
            metalness: 0.3,
            roughness: 0.4,
            flatShading: false,
            envMapIntensity: 1.0,
          });

          // Create mesh
          const mesh = new THREE.Mesh(bufferGeometry, material);
          
          // Extract transformation matrix (4x4)
          const matrix = new THREE.Matrix4();
          const transform = geometry.flatTransformation;
          
          if (transform && typeof transform !== 'number') {
            const matrixArray: number[] = [];
            for (let j = 0; j < 16; j++) {
              const val = Array.isArray(transform) ? transform[j] : (transform as any).get?.(j) ?? 0;
              matrixArray.push(typeof val === 'number' ? val : 0);
            }
            matrix.fromArray(matrixArray);
          }
          
          // Apply transformation and disable auto-update
          mesh.matrix.copy(matrix);
          mesh.matrixAutoUpdate = false;
          
          mesh.userData = {
            ifcType: typeName,
            ifcExpressId: expressId,
          };

          scene.add(mesh);
          meshes.push(mesh);
          
          geometryData.delete();
        }
      });

      console.log(`[Viewer3D] Loaded ${meshes.length} meshes`);
      ifcApi.CloseModel(modelId);
    } catch (err) {
      console.error('[Viewer3D] IFC loading error:', err);
      throw err;
    }

    return meshes;
  };

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 p-4">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">3D Viewer Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10">
          <div className="text-slate-400">Initializing 3D Viewer...</div>
        </div>
      )}
      
      <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          {geometryCount > 0 ? `${geometryCount} objects loaded` : 'Ready'}
        </div>
        <button
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.requestFullscreen().catch(() => {});
            }
          }}
          className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded"
        >
          Fullscreen
        </button>
      </div>
      
      <div ref={containerRef} className="flex-1 bg-slate-900" />
    </div>
  );
}
