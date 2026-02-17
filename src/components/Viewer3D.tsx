/**
 * 3D IFC Viewer - Simple Three.js implementation
 * Shows IFC entities as colored boxes with proper interaction
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AlertCircle } from 'lucide-react';

interface Viewer3DProps {
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  ifcFileBuffer?: ArrayBuffer;
  isContextOnly?: boolean;  // OPTIMIZATION: Skip costly overlays for context-only view
}

export default function Viewer3D({ selectedNodeId, onSelectNode, ifcFileBuffer, isContextOnly = true }: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const selectedMeshRef = useRef<THREE.Mesh | THREE.InstancedMesh | null>(null);
  const originalMaterialRef = useRef<THREE.Material | null>(null);
  const selectedInstanceRef = useRef<{ mesh: THREE.InstancedMesh; id: number; color: THREE.Color } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geometryCount, setGeometryCount] = useState(0);

  useEffect(() => {
    console.log('[Viewer3D] Mounted with ifcFileBuffer:', ifcFileBuffer ? `${ifcFileBuffer.byteLength} bytes` : 'undefined');
  }, [ifcFileBuffer]);  // Read debug flag at component initialization so it's available everywhere
  const COLOR_DEBUG_MODE = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('colorDebug') ?? null : null;
  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef<boolean>(false); // true when worker has model loaded and can inspect
  const pendingInspectsRef = useRef<number[]>([]); // queue inspect IDs requested before model load

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

    // Reset previous selection (restore original emissive)
    if (selectedMeshRef.current && originalMaterialRef.current && selectedMeshRef.current.material instanceof THREE.MeshStandardMaterial) {
      const originalMaterial = originalMaterialRef.current as THREE.MeshStandardMaterial;
      selectedMeshRef.current.material.emissive.copy(originalMaterial.emissive);
      selectedMeshRef.current.material.emissiveIntensity = originalMaterial.emissiveIntensity;
      selectedMeshRef.current.material.needsUpdate = true;
      selectedMeshRef.current = null;
      originalMaterialRef.current = null;
    }
    if (selectedInstanceRef.current) {
      const { mesh, id, color } = selectedInstanceRef.current;
      mesh.setColorAt(id, color);
      mesh.instanceColor!.needsUpdate = true;
      selectedInstanceRef.current = null;
    }

    // Find and highlight the selected mesh
    const nodeIdMatch = selectedNodeId.match(/node_(\d+)/);
    if (nodeIdMatch) {
      const expressId = parseInt(nodeIdMatch[1]);
      const mesh = meshesRef.current.find(m => m.userData.ifcExpressId === expressId);
      
      if (mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
        originalMaterialRef.current = mesh.material.clone();
        // Use emissive glow for selection (cleaner than color change)
        mesh.material.emissive = new THREE.Color(0x0066ff);
        mesh.material.emissiveIntensity = 0.6;
        mesh.material.needsUpdate = true;
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
      } else {
        const instanced = meshesRef.current.find(m => Array.isArray(m.userData.instanceExpressIds) && m.userData.instanceExpressIds.includes(expressId));
        if (instanced && instanced instanceof THREE.InstancedMesh) {
          const instanceIndex = instanced.userData.instanceExpressIds.indexOf(expressId);
          const currentColor = new THREE.Color();
          instanced.getColorAt(instanceIndex, currentColor);
          instanced.setColorAt(instanceIndex, new THREE.Color(0xffff00));
          instanced.instanceColor!.needsUpdate = true;
          selectedInstanceRef.current = { mesh: instanced, id: instanceIndex, color: currentColor };
        }
      }
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Read debug flag once for shareable behavior across functions (moved to component scope)

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let meshes: THREE.Mesh[] = [];

    const init = async () => {
      try {
        // Scene setup
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x3a3a4a);  // Lighter blue-gray background
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.current!.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lighting - Multi-directional for even illumination (inspired by IFC3DViewer reference)
        // Soft ambient base
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // Primary directional light (top-right-front)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.far = 500;
        scene.add(directionalLight);
        
        // Secondary light (back-left, reduces harsh shadows)
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-80, 40, -80);
        scene.add(directionalLight2);
        
        // Tertiary light (bottom-front for fill)
        const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.25);
        directionalLight3.position.set(50, -50, 60);
        scene.add(directionalLight3);
        
        // Use ACES Filmic tone mapping and slightly reduce exposure for a softer, more cinematic look
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.85;

        // Grid - Better spatial reference (inspired by IFC3DViewer reference)
        const gridHelper = new THREE.GridHelper(500, 50, 0x666688, 0x333344);
        gridHelper.position.y = -1;
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
          console.log('[Viewer3D] Loading IFC from buffer:', ifcFileBuffer.byteLength, 'bytes');
          meshes = await loadIFC(scene, ifcFileBuffer);
          console.log('[Viewer3D] IFC loaded, got', meshes.length, 'meshes');
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
            
        
          }
          
          setGeometryCount(meshes.length);
          setIsLoading(false);
          
          // Colors are applied during geometry parsing by the geometry worker
          console.log('[Viewer3D] Colors loaded during geometry parsing');
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
            const hit = intersects[0];
            const mesh = hit.object as THREE.Mesh;
            const { ifcExpressId } = mesh.userData;
            const instanceId = (hit as any).instanceId as number | undefined;
            let resolvedId = ifcExpressId;

            if (resolvedId === undefined && mesh instanceof THREE.InstancedMesh && typeof instanceId === 'number') {
              const ids = mesh.userData.instanceExpressIds as number[] | undefined;
              if (ids && ids[instanceId] !== undefined) {
                resolvedId = ids[instanceId];
              }
            }

            // Debug: when colorDebug is set, log mesh/payload material details for clicked object
            try {
              if (COLOR_DEBUG_MODE) {
                // Basic mesh info
                const info: any = { resolvedId };
                info.userData = mesh.userData;
                if (mesh instanceof THREE.InstancedMesh && typeof instanceId === 'number') {
                  const colorAttr = mesh.instanceColor as THREE.InstancedBufferAttribute | null;
                  const col = new THREE.Color();
                  if (colorAttr) {
                    const arr = colorAttr.array as Float32Array;
                    const off = instanceId * 3;
                    col.setRGB(arr[off], arr[off + 1], arr[off + 2]);
                    info.instanceColor = col;
                  }
                } else if (mesh.material && (mesh.material as any).color) {
                  info.materialColor = (mesh.material as any).color;
                  info.materialEmissive = (mesh.material as any).emissive;
                }
                // eslint-disable-next-line no-console
                console.log('[Viewer3D] click debug', info);

                // Ask the worker to inspect the IFC entities for this resolvedId
                try {
                  if (workerRef.current && resolvedId) {
                    if (workerReadyRef.current) {
                      console.log('[Viewer3D] Sending inspect for', resolvedId);
                      workerRef.current.postMessage({ type: 'inspect', id: resolvedId });
                    } else {
                      // Queue the inspect request until the worker finishes parsing
                      console.log('[Viewer3D] Queuing inspect for', resolvedId, 'worker not ready yet');
                      pendingInspectsRef.current.push(resolvedId);
                      // eslint-disable-next-line no-console
                      console.log('[Viewer3D] Inspect queued until worker ready:', resolvedId);
                    }
                  } else {
                    console.log('[Viewer3D] No worker or no resolvedId for inspect');
                    // eslint-disable-next-line no-console
                    console.warn('[Viewer3D] No worker available to inspect:', resolvedId);
                  }
                } catch (e) {
                  console.error('[Viewer3D] Error sending inspect:', e);
                }
              }
            } catch (e) {
              // ignore
            }
            
            // Just notify parent - the useEffect will handle highlighting
            if (resolvedId && onSelectNode) {
              onSelectNode(`node_${resolvedId}`);
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
          meshesRef.current.forEach((mesh) => {
            mesh.geometry?.dispose();
            const mat = mesh.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) {
              mat.forEach((m) => m.dispose());
            } else {
              mat.dispose();
            }
          });
          meshesRef.current = [];
          controls.dispose();
          renderer.dispose();
          if (containerRef.current?.contains(renderer.domElement)) {
            containerRef.current.removeChild(renderer.domElement);
          }
          // Dispose worker and free web-ifc model if still loaded
          try {
            if (workerRef.current) {
              try { workerRef.current.postMessage({ type: 'dispose' }); } catch (e) {}
              try { workerRef.current.terminate(); } catch (e) {}
              workerRef.current = null;
            }
          } catch (e) {}
        };
      } catch (err) {
        console.error('[Viewer3D] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize viewer');
        setIsLoading(false);
      }
    };

    init();
  }, [ifcFileBuffer]);

  interface MeshPayload {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    color: number;
    opacity: number;
    transforms: Float32Array;
    expressIds: Int32Array;
    ifcType: string;
    instanceCount: number;
  }

  const loadIFC = async (scene: THREE.Scene, buffer: ArrayBuffer): Promise<THREE.Mesh[]> => {
        
    const meshes: THREE.Mesh[] = [];

    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('../workers/ifcGeometryWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data as any;
        if (data?.type === 'debug') {
          // Log compact debug info from worker to help diagnose style/color mapping
          // eslint-disable-next-line no-console
          console.log('[Viewer3D] IFC worker debug:', data);
          return;
        }
        if (data?.type === 'modelLoaded') {
          // Worker indicates the model is loaded and we can now inspect
          console.log('[Viewer3D] Received modelLoaded, setting workerReadyRef to true');
          workerReadyRef.current = true;
          // flush pending inspect requests
          if (pendingInspectsRef.current.length > 0) {
            console.log('[Viewer3D] Flushing', pendingInspectsRef.current.length, 'pending inspects');
            for (const pid of pendingInspectsRef.current) {
              try { workerRef.current?.postMessage({ type: 'inspect', id: pid }); } catch (e) {}
            }
            pendingInspectsRef.current = [];
          }
          // eslint-disable-next-line no-console
          console.log('[Viewer3D] worker modelLoaded:', data.modelId);
          return;
        }
        if (data?.type === 'inspectResult') {
          // eslint-disable-next-line no-console
          if (data.error === 'Model not loaded' && !workerReadyRef.current) {
            console.warn('[Viewer3D] Inspect returned "Model not loaded" — the worker model is not yet ready. This may occur if you clicked before loading finished.');
          }
          console.log('[Viewer3D] inspect result:', data);
          return;
        }
        const { type, meshes: payloads, error } = data as {
          type: 'complete' | 'error';
          meshes?: MeshPayload[];
          error?: string;
        };

        if (type === 'error') {
          worker.terminate();
          workerRef.current = null;
          reject(new Error(error || 'IFC geometry worker failed'));
          return;
        }

        if (type === 'complete' && payloads) {
          console.log('[Viewer3D] IFC payloads loaded:', payloads.length, 'meshes');

          // Optional visual debug toggle: append ?colorDebug=1 for emissive debug, ?colorDebug=2 for flat unlit colors

          payloads.forEach((payload) => {
            const bufferGeometry = new THREE.BufferGeometry();
            bufferGeometry.setAttribute(
              'position',
              new THREE.Float32BufferAttribute(payload.positions, 3)
            );
            bufferGeometry.setAttribute(
              'normal',
              new THREE.Float32BufferAttribute(payload.normals, 3)
            );
            if (payload.indices && payload.indices.length > 0) {
              bufferGeometry.setIndex(new THREE.BufferAttribute(payload.indices, 1));
            }

            // Use normalized RGBA from payload when available
            const rgb = (payload as any).colorRgb;
            const baseColorRaw = rgb ? new THREE.Color(rgb.r, rgb.g, rgb.b) : new THREE.Color(payload.color);
            const baseColorLinear = baseColorRaw.clone().convertSRGBToLinear();
            const opacity = rgb && typeof rgb.a === 'number' ? rgb.a : (typeof payload.opacity === 'number' ? payload.opacity : 1.0);

            // Debug mode 4: use raw (sRGB) colors directly (no convertSRGBToLinear)
            const useRawColor = COLOR_DEBUG_MODE === '4';
            const colorForMaterial = useRawColor ? baseColorRaw : baseColorLinear;

            let material: THREE.Material;
            if (COLOR_DEBUG_MODE === '2') {
              // Flat unlit material for precise color verification
              material = new THREE.MeshBasicMaterial({ color: colorForMaterial, side: THREE.DoubleSide, transparent: opacity < 1.0, opacity });
            } else {
              // Default PBR material tuned to favor vivid IFC colors (match professional viewer look)
              material = new THREE.MeshStandardMaterial({
                color: colorForMaterial,
                side: THREE.DoubleSide,
                metalness: opacity < 0.7 ? 0.3 : 0.0,  // Slight metalness for transparent/glass materials
                roughness: opacity < 0.7 ? 0.1 : 0.18, // Smoother for glass, slightly rough for opaque
                flatShading: false,
                envMapIntensity: 1.0,
                vertexColors: false,
                transparent: opacity < 1.0,
                opacity: opacity,
              });

              // If the payload contains an IFC-derived color, bias the material with an emissive component
              // so colors remain bright under scene lighting similar to the professional viewer.
              try {
                if ((payload as any).colorRgb) {
                  (material as THREE.MeshStandardMaterial).emissive = colorForMaterial.clone();
                  // Adjust emissive intensity based on opacity:
                  // Transparent materials (glass/windows) need less emissive to avoid washing out
                  // Opaque materials get full emissive for vivid colors
                  if (opacity < 0.7) {
                    (material as any).emissiveIntensity = 0.5; // Lower for transparency
                  } else {
                    (material as any).emissiveIntensity = 0.95; // Full for opaque
                  }
                }
              } catch (e) {}

              if (COLOR_DEBUG_MODE === '1') {
                (material as THREE.MeshStandardMaterial).emissive = colorForMaterial.clone();
                (material as any).emissiveIntensity = 0.95;
              }
            }
            if (payload.instanceCount > 1) {
              let instancedMaterial = material.clone();
              // For flat basic debug mode, clone may be a MeshBasicMaterial - ensure vertexColors behavior
              if (instancedMaterial instanceof THREE.MeshBasicMaterial) {
                // MeshBasicMaterial doesn't use vertex colors with instanced.setColorAt unless vertexColors true
                instancedMaterial.vertexColors = true;
              } else {
                (instancedMaterial as THREE.MeshStandardMaterial).vertexColors = true;
              }
              instancedMaterial.color = new THREE.Color(0xffffff);
              const instanced = new THREE.InstancedMesh(
                bufferGeometry,
                instancedMaterial,
                payload.instanceCount
              );
              instanced.frustumCulled = true;
              instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
              instanced.instanceColor = new THREE.InstancedBufferAttribute(
                new Float32Array(payload.instanceCount * 3),
                3
              );

              const matrix = new THREE.Matrix4();
              const rgb = (payload as any).colorRgb;
              const baseColorRaw = rgb ? new THREE.Color(rgb.r, rgb.g, rgb.b) : new THREE.Color(payload.color);
              const baseColorLinear = baseColorRaw.clone().convertSRGBToLinear();
              const instOpacity = rgb && typeof rgb.a === 'number' ? rgb.a : (typeof payload.opacity === 'number' ? payload.opacity : 1.0);
              instancedMaterial.transparent = instOpacity < 1.0;
              instancedMaterial.opacity = instOpacity;

              // Adjust material properties for transparency
              if (instOpacity < 0.7) {
                (instancedMaterial as THREE.MeshStandardMaterial).metalness = 0.3;
                (instancedMaterial as THREE.MeshStandardMaterial).roughness = 0.1;
              } else {
                (instancedMaterial as THREE.MeshStandardMaterial).metalness = 0.0;
                (instancedMaterial as THREE.MeshStandardMaterial).roughness = 0.18;
              }

              // Choose whether to set instance color as raw sRGB or linear (debug mode 4)
              const useRawInstanceColor = COLOR_DEBUG_MODE === '4';
              const colorForInstance = useRawInstanceColor ? baseColorRaw : baseColorLinear;

              if (COLOR_DEBUG_MODE === '1') {
                instancedMaterial.emissive = colorForInstance.clone();
                (instancedMaterial as any).emissiveIntensity = 0.6;
              }

              // If the payload contains an IFC-derived color, bias emissive for better visibility and parity with other viewers.
              try {
                if ((payload as any).colorRgb) {
                  instancedMaterial.emissive = colorForInstance.clone();
                  // Adjust emissive intensity based on opacity for transparent materials
                  if (instOpacity < 0.7) {
                    (instancedMaterial as any).emissiveIntensity = 0.5;
                  } else {
                    (instancedMaterial as any).emissiveIntensity = 0.95;
                  }
                }
              } catch (e) {}

              const instanceMatrices = [] as THREE.Matrix4[];
              for (let i = 0; i < payload.instanceCount; i++) {
                const offset = i * 16;
                matrix.fromArray(payload.transforms.subarray(offset, offset + 16));
                instanced.setMatrixAt(i, matrix);
                instanced.setColorAt(i, colorForInstance);
                // remember matrices for optional wire overlay
                instanceMatrices.push(matrix.clone());
              }

              instanced.instanceMatrix.needsUpdate = true;
              instanced.instanceColor.needsUpdate = true;

              // lighten the instance material a bit for more pleasing contrast
              try {
                (instanced.material as THREE.Material).needsUpdate = true;
              } catch (e) {}
              instanced.userData = {
                ifcType: payload.ifcType,
                instanceExpressIds: Array.from(payload.expressIds),
              };

              scene.add(instanced);
              meshes.push(instanced as unknown as THREE.Mesh);

              // OPTIMIZATION: Skip wireframe overlay for context-only view (saves 100-150 MB)
              // For context views, skip the wireframe overlay that doubles geometry memory
              if (!isContextOnly) {
                // Add subtle instanced wireframe overlay (thin dark wireframe to improve edge definition)
                try {
                  const wireMat = instanced.material.clone();
                  wireMat.color = new THREE.Color(0x0b0b0b);
                  wireMat.wireframe = true;
                  wireMat.transparent = true;
                  wireMat.opacity = 0.06;
                  wireMat.depthWrite = false;

                  const wireInst = new THREE.InstancedMesh(
                    bufferGeometry,
                    wireMat,
                    payload.instanceCount
                  );
                  wireInst.frustumCulled = true;

                  for (let i = 0; i < payload.instanceCount; i++) {
                    wireInst.setMatrixAt(i, instanceMatrices[i]);
                  }
                  wireInst.instanceMatrix.needsUpdate = true;
                  scene.add(wireInst);
                  meshes.push(wireInst as unknown as THREE.Mesh);
                } catch (e) {
                  // non-critical if instanced wireframe overlay fails on some platforms
                }
              }
            } else {
              const mesh = new THREE.Mesh(bufferGeometry, material);
              mesh.frustumCulled = true;

              const matrix = new THREE.Matrix4();
              matrix.fromArray(payload.transforms.subarray(0, 16));
              mesh.matrix.copy(matrix);
              mesh.matrixAutoUpdate = false;

              mesh.userData = {
                ifcType: payload.ifcType,
                ifcExpressId: payload.expressIds[0],
              };

              scene.add(mesh);
              meshes.push(mesh);

              // OPTIMIZATION: Skip edge overlay for context-only view (saves memory)
              if (!isContextOnly) {
                // subtle edges overlay for single meshes (improves visual definition)
                try {
                  const edges = new THREE.EdgesGeometry(bufferGeometry);
                  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.08 }));
                  line.matrix.copy(mesh.matrix);
                  line.matrixAutoUpdate = false;
                  scene.add(line);
                  meshes.push(line as unknown as THREE.Mesh);
                } catch (e) {
                  // non critical
                }
              }
            }
          });

          // OPTIMIZATION: For context-only view, dispose worker immediately after loading (saves 200-300 MB)
          // For interactive inspection mode, keep worker alive for 60 seconds
          if (isContextOnly) {
            try {
              worker.postMessage({ type: 'dispose' });
              worker.terminate();
            } catch (e) {}
          }

          resolve(meshes);
          // Note: For interactive mode, worker stays running; disposed on unmount or after 60s inactivity.
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      const transferBuffer = buffer.slice(0);
      worker.postMessage({ type: 'parse', buffer: transferBuffer }, [transferBuffer]);
    });
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
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-400">
            {geometryCount > 0 ? `${geometryCount} objects loaded` : 'Ready'}
          </div>
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
