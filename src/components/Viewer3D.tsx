/**
 * 3D IFC Viewer - Simple Three.js implementation
 * Shows IFC entities as colored boxes with proper interaction
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AlertCircle } from 'lucide-react';
// Type-only import — erased at compile time, keeps the topology chunk decoupled.
import type { TopologyPathStep as PathHighlightStep } from '@/lib/topology/tgraph';

// Local mirror of the worker's MeshPayload shape — kept here (not imported from the
// worker file) to prevent the bundler from pulling web-ifc WASM into the main bundle.
interface MeshPayload {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  color: number;
  opacity: number;
  colorRgb?: { r: number; g: number; b: number; a: number };
  transforms: Float32Array;
  expressIds: Int32Array;
  ifcType: string;
  instanceCount: number;
  geometryId?: number;
  colorSource?: number | null;
  worldSpace?: boolean;
}

interface Viewer3DProps {
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  ifcFileBuffer?: ArrayBuffer;
  isContextOnly?: boolean;  // OPTIMIZATION: Skip costly overlays for context-only view
  pathHighlight?: PathHighlightStep[] | null; // topology panel shortest-path route
}

export default function Viewer3D({ selectedNodeId, onSelectNode, ifcFileBuffer, isContextOnly = true, pathHighlight }: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const selectedMeshRef = useRef<THREE.Mesh | THREE.InstancedMesh | null>(null);
  const originalMaterialRef = useRef<THREE.Material | null>(null);
  const selectedInstanceRef = useRef<{ mesh: THREE.InstancedMesh; id: number; color: THREE.Color } | null>(null);
  const selectedHighlightMeshRef = useRef<THREE.Mesh | null>(null);
  const expressIdLookupRef = useRef<Map<number, { mesh: THREE.Mesh; range: { expressId: number; start: number; count: number; bbox: { min: [number,number,number]; max: [number,number,number] } } }>>(new Map());
  // Demand rendering: only call renderer.render() when something changed.
  // Saves GPU/CPU on idle frames; use markDirty() whenever scene or camera changes.
  const framesRemainingRef = useRef(90);
  
  const [error, setError] = useState<string | null>(null);
  const [geometryCount, setGeometryCount] = useState(0);
  // Bumped when the worker/scene become able to serve a route (modelLoaded and
  // streaming complete) so the path effect re-runs if the route was set while
  // the viewer was still initializing.
  const [viewerReadyTick, setViewerReadyTick] = useState(0);

  useEffect(() => {
    console.log('[Viewer3D] Mounted with ifcFileBuffer:', ifcFileBuffer ? `${ifcFileBuffer.byteLength} bytes` : 'undefined');
  }, [ifcFileBuffer]);  // Read debug flag at component initialization so it's available everywhere
  const COLOR_DEBUG_MODE = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('colorDebug') ?? null : null;
  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef<boolean>(false); // true when worker has model loaded and can inspect
  const pendingInspectsRef = useRef<number[]>([]); // queue inspect IDs requested before model load
  const pendingGeometryRef = useRef<number | null>(null); // single queued getGeometry ID (only one selection active at a time)
  // Topology route visualization: hop-colored overlay meshes, one per path step.
  // Spaces aren't streamed, so their geometry arrives via getGeometry responses —
  // pathPendingRef correlates those responses (by echoed express id) to their step.
  const pathMeshesRef = useRef<THREE.Mesh[]>([]);
  const pathPendingRef = useRef<Map<number, PathHighlightStep>>(new Map());
  const pathBBoxRef = useRef<THREE.Box3>(new THREE.Box3());

  // Handle selection from other components or internal clicks
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const scene = sceneRef.current;

    // --- Cleanup previous highlight overlay ---
    framesRemainingRef.current = Math.max(framesRemainingRef.current, 60); // selection change = scene change
    if (selectedHighlightMeshRef.current && scene) {
      scene.remove(selectedHighlightMeshRef.current);
      selectedHighlightMeshRef.current.geometry.dispose();
      (selectedHighlightMeshRef.current.material as THREE.Material).dispose();
      selectedHighlightMeshRef.current = null;
    }

    // Restore all meshes to normal opacity
    meshesRef.current.forEach(m => {
      if (m.material instanceof THREE.Material) {
        const origOpacity = m.userData.originalOpacity;
        const origTransparent = m.userData.originalTransparent;
        if (origOpacity !== undefined) {
          m.material.transparent = origTransparent ?? m.material.transparent;
          m.material.opacity = origOpacity;
          m.material.needsUpdate = true;
          delete m.userData.originalOpacity;
          delete m.userData.originalTransparent;
        }
      }
    });

    // Restore single-mesh selection state if set
    if (selectedMeshRef.current && originalMaterialRef.current && selectedMeshRef.current.material instanceof THREE.MeshStandardMaterial) {
      const orig = originalMaterialRef.current as THREE.MeshStandardMaterial;
      selectedMeshRef.current.material.emissive.copy(orig.emissive);
      selectedMeshRef.current.material.emissiveIntensity = orig.emissiveIntensity;
      selectedMeshRef.current.material.needsUpdate = true;
      selectedMeshRef.current = null;
      originalMaterialRef.current = null;
    }

    if (!selectedNodeId || !meshesRef.current.length) return;

    const nodeIdMatch = selectedNodeId.match(/node_(\d+)/);
    if (!nodeIdMatch) return;
    const expressId = parseInt(nodeIdMatch[1]);

    // ── Shared helpers (used by both normal-mesh and hidden-type highlight paths) ──

    const ghostOtherMeshes = () => {
      meshesRef.current.forEach(m => {
        if (m.material instanceof THREE.Material) {
          if (m.userData.originalOpacity === undefined) {
            m.userData.originalTransparent = m.material.transparent;
            m.userData.originalOpacity = m.material.opacity;
          }
          m.material.transparent = true;
          m.material.opacity = 0.06;
          m.material.needsUpdate = true;
        }
      });
    };

    const animateCamera = (center: THREE.Vector3, maxDim: number) => {
      if (!camera || !controls || maxDim <= 0) return;
      const fov = camera.fov * (Math.PI / 180);
      const dist = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5;
      const dir = camera.position.clone().sub(controls.target).normalize();
      const targetPos = center.clone().add(dir.multiplyScalar(dist));
      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      const duration = 800;
      const startTime = Date.now();
      const step = () => {
        const t = Math.min((Date.now() - startTime) / duration, 1);
        const e = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(startPos, targetPos, e);
        controls.target.lerpVectors(startTarget, center, e);
        controls.update();
        framesRemainingRef.current = Math.max(framesRemainingRef.current, 5);
        if (t < 1) requestAnimationFrame(step);
      };
      step();
    };

    // ── Lookup & dispatch ────────────────────────────────────────────────────────

    const result = expressIdLookupRef.current.get(expressId);
    if (!result) {
      // Element not in streamed set (IFCSPACE etc. — skipped during streaming because
      // their geometry computation is expensive). Request on-demand from the worker;
      // the geometryResult handler will create the highlight mesh.
      if (workerRef.current && workerReadyRef.current) {
        workerRef.current.postMessage({ type: 'getGeometry', id: expressId });
      } else {
        pendingGeometryRef.current = expressId;
      }
      return;
    }

    const { mesh, range } = result;

    if (mesh.userData.isBatchMesh && scene) {
      // Create highlight overlay from the element's triangle range
      const batchGeo = mesh.geometry as THREE.BufferGeometry;
      const highlightGeo = new THREE.BufferGeometry();
      highlightGeo.setAttribute('position', batchGeo.getAttribute('position'));
      highlightGeo.setAttribute('normal', batchGeo.getAttribute('normal'));
      highlightGeo.setIndex(batchGeo.getIndex());
      highlightGeo.setDrawRange(range.start * 3, range.count * 3);

      const highlightMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.15, 0.45, 1.0),
        emissive: new THREE.Color(0.05, 0.25, 0.8),
        emissiveIntensity: 0.6,
        side: THREE.DoubleSide,
        transparent: false,
      });

      const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
      scene.add(highlightMesh);
      selectedHighlightMeshRef.current = highlightMesh;

      ghostOtherMeshes();

      // Camera zoom using pre-computed bbox
      const [minX, minY, minZ] = range.bbox.min;
      const [maxX, maxY, maxZ] = range.bbox.max;
      const center = new THREE.Vector3((minX+maxX)/2, (minY+maxY)/2, (minZ+maxZ)/2);
      const maxDim = Math.max(maxX-minX, maxY-minY, maxZ-minZ);
      animateCamera(center, maxDim);
    } else {
      // Single transparent mesh — emissive highlight
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        originalMaterialRef.current = mesh.material.clone();
        mesh.material.emissive = new THREE.Color(0x0066ff);
        mesh.material.emissiveIntensity = 0.6;
        mesh.material.needsUpdate = true;
        selectedMeshRef.current = mesh;
      }

      ghostOtherMeshes();

      const box = new THREE.Box3().setFromObject(mesh);
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        animateCamera(center, Math.max(size.x, size.y, size.z));
      }
    }
  }, [selectedNodeId]);

  // ── Topology route (path mode) → hop-colored overlay meshes ────────────────
  // Runs after the selection effect (declared below it) so path ghosting wins
  // when both are active. Streamed elements get drawRange overlays immediately;
  // spaces are fetched on demand and added by the geometryResult handler.
  useEffect(() => {
    const scene = sceneRef.current;
    framesRemainingRef.current = Math.max(framesRemainingRef.current, 60);

    // Clear previous route
    pathMeshesRef.current.forEach(m => {
      scene?.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    pathMeshesRef.current = [];
    pathPendingRef.current.clear();
    pathBBoxRef.current = new THREE.Box3();

    if (!pathHighlight || pathHighlight.length === 0 || !scene) {
      // Un-ghost only when no selection is active (the selection effect owns
      // ghosting while an element is selected).
      if (!selectedNodeId) {
        meshesRef.current.forEach(m => {
          if (m.material instanceof THREE.Material && m.userData.originalOpacity !== undefined) {
            m.material.transparent = m.userData.originalTransparent ?? m.material.transparent;
            m.material.opacity = m.userData.originalOpacity;
            m.material.needsUpdate = true;
            delete m.userData.originalOpacity;
            delete m.userData.originalTransparent;
          }
        });
      }
      return;
    }

    // Ghost the model so the route reads clearly (same idiom as selection)
    meshesRef.current.forEach(m => {
      if (m.material instanceof THREE.Material) {
        if (m.userData.originalOpacity === undefined) {
          m.userData.originalTransparent = m.material.transparent;
          m.userData.originalOpacity = m.material.opacity;
        }
        m.material.transparent = true;
        m.material.opacity = 0.06;
        m.material.needsUpdate = true;
      }
    });

    for (const step of pathHighlight) {
      const found = expressIdLookupRef.current.get(step.expressId);
      if (!found) {
        // Not streamed (IFCSPACE etc.) — fetch geometry from the worker; the
        // geometryResult handler matches the echoed id back to this step. If
        // the worker isn't ready yet, skip: viewerReadyTick re-runs this
        // effect once it is.
        if (workerRef.current && workerReadyRef.current) {
          pathPendingRef.current.set(step.expressId, step);
          workerRef.current.postMessage({ type: 'getGeometry', id: step.expressId });
        }
        continue;
      }

      const { mesh, range } = found;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(step.color),
        emissive: new THREE.Color(step.color),
        emissiveIntensity: step.kind === 'space' ? 0.25 : 0.5,
        transparent: step.kind === 'space',
        opacity: step.kind === 'space' ? 0.35 : 1,
        side: THREE.DoubleSide,
        depthWrite: step.kind !== 'space',
      });

      let overlay: THREE.Mesh;
      if (mesh.userData.isBatchMesh) {
        const batchGeo = mesh.geometry as THREE.BufferGeometry;
        const overlayGeo = new THREE.BufferGeometry();
        overlayGeo.setAttribute('position', batchGeo.getAttribute('position'));
        overlayGeo.setAttribute('normal', batchGeo.getAttribute('normal'));
        overlayGeo.setIndex(batchGeo.getIndex());
        overlayGeo.setDrawRange(range.start * 3, range.count * 3);
        overlay = new THREE.Mesh(overlayGeo, mat);
        pathBBoxRef.current.expandByPoint(new THREE.Vector3(...range.bbox.min));
        pathBBoxRef.current.expandByPoint(new THREE.Vector3(...range.bbox.max));
      } else {
        overlay = new THREE.Mesh(mesh.geometry, mat);
        overlay.applyMatrix4(mesh.matrixWorld);
        pathBBoxRef.current.union(new THREE.Box3().setFromObject(overlay));
      }
      scene.add(overlay);
      pathMeshesRef.current.push(overlay);
    }

    // Frame the route now if everything was streamed; otherwise the
    // geometryResult handler re-frames when the last pending space arrives.
    if (pathPendingRef.current.size === 0 && !pathBBoxRef.current.isEmpty()
        && cameraRef.current && controlsRef.current) {
      const center = pathBBoxRef.current.getCenter(new THREE.Vector3());
      const size = pathBBoxRef.current.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const fov = cameraRef.current.fov * (Math.PI / 180);
        const dist = Math.abs(maxDim / Math.tan(fov / 2)) * 1.2;
        const dir = cameraRef.current.position.clone().sub(controlsRef.current.target).normalize();
        const targetPos = center.clone().add(dir.multiplyScalar(dist));
        const startPos = cameraRef.current.position.clone();
        const startTarget = controlsRef.current.target.clone();
        const dur = 800, t0 = Date.now();
        const step = () => {
          const t = Math.min((Date.now() - t0) / dur, 1);
          const e = 1 - Math.pow(1 - t, 3);
          cameraRef.current!.position.lerpVectors(startPos, targetPos, e);
          controlsRef.current!.target.lerpVectors(startTarget, center, e);
          controlsRef.current!.update();
          framesRemainingRef.current = Math.max(framesRemainingRef.current, 5);
          if (t < 1) requestAnimationFrame(step);
        };
        step();
      }
    }
  }, [pathHighlight, selectedNodeId, viewerReadyTick]);

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
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap at 1.5× saves ~44% GPU fill vs 2×
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Shadows disabled: IFC viewers don't benefit from ray-traced shadows and
        // a 2048² shadow map wastes 16 MB of GPU VRAM with no visible quality gain.
        containerRef.current!.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lighting - Multi-directional for even illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // Primary directional light (top-right-front) — no shadow casting
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 100);
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

        // Demand-based rendering: only call render() when framesRemainingRef > 0.
        // Camera interactions, new geometry batches, and selection changes all bump the
        // counter so the scene stays live for those events, then goes idle when quiet.
        const markDirty = (frames = 60) => {
          framesRemainingRef.current = Math.max(framesRemainingRef.current, frames);
        };
        controls.addEventListener('change', () => markDirty(30)); // 30 frames covers damping tail

        const animate = () => {
          requestAnimationFrame(animate);
          controls.update(); // always update for smooth damping
          if (framesRemainingRef.current > 0) {
            renderer.render(scene, camera);
            framesRemainingRef.current--;
          }
        };
        framesRemainingRef.current = 90; // render for 1.5 s on startup
        animate();

        // Load IFC if provided
        if (ifcFileBuffer) {
          console.log('[Viewer3D] Loading IFC from buffer:', ifcFileBuffer.byteLength, 'bytes');
          meshes = await loadIFC(scene, ifcFileBuffer);
          console.log('[Viewer3D] IFC first batch received, got', meshes.length, 'meshes so far');
          meshesRef.current = meshes;

          const fitCamera = () => {
            const allMeshes = meshesRef.current;
            if (allMeshes.length === 0) return;
            const box = new THREE.Box3();
            allMeshes.forEach(mesh => {
              try { box.expandByObject(mesh); } catch { /* ignore geometry errors */ }
            });
            if (box.isEmpty()) return;
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim === 0) return;
            const fov = camera.fov * (Math.PI / 180);
            const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

            camera.position.copy(center);
            camera.position.z += cameraZ * 1.5;
            camera.lookAt(center);
            camera.updateProjectionMatrix();

            controls.target.copy(center);
            controls.maxDistance = maxDim * 10;
            controls.minDistance = maxDim * 0.1;
            controls.update();
          };

          // Fit on first batch, then re-fit after 1 s once more geometry has streamed in
          fitCamera();
          setTimeout(fitCamera, 1000);

          console.log('[Viewer3D] Colors loaded during geometry parsing');
        } else {
          // Demo cube fallback when no IFC file is provided
          const geometry = new THREE.BoxGeometry(10, 10, 10);
          const material = new THREE.MeshPhongMaterial({ color: 0xfbbf24 });
          const cube = new THREE.Mesh(geometry, material);
          scene.add(cube);
          meshes = [cube];
          setGeometryCount(1);
        }

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
            let resolvedId: number | undefined;

            if (mesh.userData.isBatchMesh) {
              // Batch mesh: binary-search triangle ranges to find the expressId
              const faceIndex = hit.faceIndex;
              if (typeof faceIndex === 'number') {
                const range = findEntityByFace(mesh.userData.triangleRanges as TriangleRange[], faceIndex);
                if (range) resolvedId = range.expressId;
              }
            } else {
              resolvedId = mesh.userData.ifcExpressId;
            }

            // Debug: when colorDebug is set, log mesh/payload material details for clicked object
            try {
              if (COLOR_DEBUG_MODE) {
                const info: Record<string, unknown> = { resolvedId, userData: mesh.userData };
                if (mesh.material && 'color' in mesh.material) {
                  info.materialColor = (mesh.material as THREE.MeshStandardMaterial).color;
                }
                console.log('[Viewer3D] click debug', info);
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
          framesRemainingRef.current = Math.max(framesRemainingRef.current, 5);
        };
        const resizeObserver = typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(handleResize)
          : null;
        if (containerRef.current && resizeObserver) {
          resizeObserver.observe(containerRef.current);
        }
        window.addEventListener('resize', handleResize);

        return () => {
          resizeObserver?.disconnect();
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
          expressIdLookupRef.current.clear();
          // Dispose any active highlight overlay
          if (selectedHighlightMeshRef.current) {
            selectedHighlightMeshRef.current.geometry.dispose();
            (selectedHighlightMeshRef.current.material as THREE.Material).dispose();
            selectedHighlightMeshRef.current = null;
          }
          controls.dispose();
          renderer.dispose();
          if (containerRef.current?.contains(renderer.domElement)) {
            containerRef.current.removeChild(renderer.domElement);
          }
          // Dispose worker and free web-ifc model if still loaded
          try {
            if (workerRef.current) {
              try { workerRef.current.postMessage({ type: 'dispose' }); } catch { /* ignore */ }
              try { workerRef.current.terminate(); } catch { /* ignore */ }
              workerRef.current = null;
            }
          } catch { /* ignore cleanup errors */ }
        };
      } catch (err) {
        console.error('[Viewer3D] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize viewer');
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ifcFileBuffer]);

  interface TriangleRange {
    expressId: number;
    start: number;
    count: number;
    bbox: { min: [number, number, number]; max: [number, number, number] };
  }

  function findEntityByFace(ranges: TriangleRange[], faceIndex: number): TriangleRange | undefined {
    let lo = 0, hi = ranges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = ranges[mid];
      if (faceIndex < r.start) {
        hi = mid - 1;
      } else if (faceIndex >= r.start + r.count) {
        lo = mid + 1;
      } else {
        return r;
      }
    }
    return undefined;
  }

  const loadIFC = async (scene: THREE.Scene, buffer: ArrayBuffer): Promise<THREE.Mesh[]> => {
        
    const meshes: THREE.Mesh[] = [];
    let resolved = false;

    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('../workers/ifcGeometryWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data as Record<string, unknown>;
        if (data?.type === 'debug') {
          // Log compact debug info from worker to help diagnose style/color mapping
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
              try { workerRef.current?.postMessage({ type: 'inspect', id: pid }); } catch { /* ignore */ }
            }
            pendingInspectsRef.current = [];
          }
          // flush pending on-demand geometry request (e.g. IFCSPACE selected before model loaded)
          if (pendingGeometryRef.current !== null) {
            try { workerRef.current?.postMessage({ type: 'getGeometry', id: pendingGeometryRef.current }); } catch { /* ignore */ }
            pendingGeometryRef.current = null;
          }
          // re-run the route effect: steps that couldn't be requested while the
          // worker was initializing get posted now (see viewerReadyTick).
          setViewerReadyTick(t => t + 1);
          console.log('[Viewer3D] worker modelLoaded:', data.modelId);
          return;
        }
        if (data?.type === 'disposed') {
          // Worker self-terminated after 60s keepAlive timeout — mark it as no longer ready.
          // Future getGeometry requests will be silently dropped (worker is gone).
          workerReadyRef.current = false;
          console.log('[Viewer3D] worker self-disposed after inactivity:', data.reason);
          return;
        }
        if (data?.type === 'inspectResult') {
          if (data.error === 'Model not loaded' && !workerReadyRef.current) {
            console.warn('[Viewer3D] Inspect returned "Model not loaded" — the worker model is not yet ready. This may occur if you clicked before loading finished.');
          }
          console.log('[Viewer3D] inspect result:', data);
          return;
        }
        if (data?.type === 'geometryResult') {
          // Route step? (topology path) — the worker echoes the requested id, which
          // lets us tell path fetches apart from the single-selection fetch below.
          const pathStep = typeof data.id === 'number' ? pathPendingRef.current.get(data.id) : undefined;
          if (pathStep) {
            pathPendingRef.current.delete(data.id);
            const stepPayloads = data.payloads as MeshPayload[] | null;
            if (stepPayloads && stepPayloads.length > 0 && sceneRef.current) {
              let total = 0;
              for (const p of stepPayloads) total += p.positions.length / 3;
              if (total > 0) {
                const pos = new Float32Array(total * 3);
                const nor = new Float32Array(total * 3);
                const idx: number[] = [];
                let off = 0;
                for (const p of stepPayloads) {
                  pos.set(p.positions, off * 3);
                  nor.set(p.normals, off * 3);
                  for (let i = 0; i < p.indices.length; i++) idx.push(p.indices[i] + off);
                  off += p.positions.length / 3;
                }
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
                geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));

                const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
                  color: new THREE.Color(pathStep.color),
                  emissive: new THREE.Color(pathStep.color),
                  emissiveIntensity: pathStep.kind === 'space' ? 0.25 : 0.5,
                  transparent: pathStep.kind === 'space',
                  opacity: pathStep.kind === 'space' ? 0.35 : 1,
                  side: THREE.DoubleSide,
                  depthWrite: pathStep.kind !== 'space',
                }));
                sceneRef.current.add(mesh);
                pathMeshesRef.current.push(mesh);
                geo.computeBoundingBox();
                if (geo.boundingBox) pathBBoxRef.current.union(geo.boundingBox);
              }
            }
            // Last pending step arrived → frame the whole route
            if (pathPendingRef.current.size === 0 && !pathBBoxRef.current.isEmpty()
                && cameraRef.current && controlsRef.current) {
              const center = pathBBoxRef.current.getCenter(new THREE.Vector3());
              const size = pathBBoxRef.current.getSize(new THREE.Vector3());
              const maxDim = Math.max(size.x, size.y, size.z);
              if (maxDim > 0) {
                const fov = cameraRef.current.fov * (Math.PI / 180);
                const dist = Math.abs(maxDim / Math.tan(fov / 2)) * 1.2;
                const dir = cameraRef.current.position.clone().sub(controlsRef.current.target).normalize();
                const targetPos = center.clone().add(dir.multiplyScalar(dist));
                const startPos = cameraRef.current.position.clone();
                const startTarget = controlsRef.current.target.clone();
                const dur = 800, t0 = Date.now();
                const step = () => {
                  const t = Math.min((Date.now() - t0) / dur, 1);
                  const e = 1 - Math.pow(1 - t, 3);
                  cameraRef.current!.position.lerpVectors(startPos, targetPos, e);
                  controlsRef.current!.target.lerpVectors(startTarget, center, e);
                  controlsRef.current!.update();
                  framesRemainingRef.current = Math.max(framesRemainingRef.current, 5);
                  if (t < 1) requestAnimationFrame(step);
                };
                step();
              }
            }
            framesRemainingRef.current = Math.max(framesRemainingRef.current, 60);
            return;
          }

          // On-demand geometry for hidden element types (IFCSPACE etc.) requested from
          // the selectedNodeId effect when the element isn't in expressIdLookupRef.
          const onDemandPayloads = data.payloads as MeshPayload[] | null;
          if (!onDemandPayloads || onDemandPayloads.length === 0) return;
          if (!sceneRef.current) return;

          // Clean up any previous highlight first
          if (selectedHighlightMeshRef.current) {
            sceneRef.current.remove(selectedHighlightMeshRef.current);
            selectedHighlightMeshRef.current.geometry.dispose();
            (selectedHighlightMeshRef.current.material as THREE.Material).dispose();
            selectedHighlightMeshRef.current = null;
          }

          // Merge geometry parts into one highlight mesh
          let totalVerts = 0;
          for (const p of onDemandPayloads) totalVerts += p.positions.length / 3;
          if (totalVerts === 0) return;

          const allPos = new Float32Array(totalVerts * 3);
          const allNor = new Float32Array(totalVerts * 3);
          const idxParts: number[] = [];
          let vOff = 0;
          for (const p of onDemandPayloads) {
            const vc = p.positions.length / 3;
            allPos.set(p.positions, vOff * 3);
            allNor.set(p.normals, vOff * 3);
            for (let i = 0; i < p.indices.length; i++) idxParts.push(p.indices[i] + vOff);
            vOff += vc;
          }
          const allIdx = new Uint32Array(idxParts);

          const isSpace = onDemandPayloads[0].ifcType === 'IFCSPACE' || onDemandPayloads[0].ifcType === 'IFCSPACESTANDARDCASE';
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
          geo.setAttribute('normal',   new THREE.BufferAttribute(allNor, 3));
          geo.setIndex(new THREE.BufferAttribute(allIdx, 1));

          const mat = new THREE.MeshStandardMaterial({
            color: isSpace ? new THREE.Color(0.6, 0.85, 1.0) : new THREE.Color(0.15, 0.45, 1.0),
            emissive: new THREE.Color(0.05, 0.2, 0.6),
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: isSpace ? 0.3 : 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
          });

          const onDemandMesh = new THREE.Mesh(geo, mat);
          sceneRef.current.add(onDemandMesh);
          selectedHighlightMeshRef.current = onDemandMesh;

          // Ghost all streaming meshes
          meshesRef.current.forEach(m => {
            if (m.material instanceof THREE.Material) {
              if (m.userData.originalOpacity === undefined) {
                m.userData.originalTransparent = m.material.transparent;
                m.userData.originalOpacity = m.material.opacity;
              }
              m.material.transparent = true;
              m.material.opacity = 0.06;
              m.material.needsUpdate = true;
            }
          });

          // Camera zoom to the on-demand geometry's bounding box
          geo.computeBoundingBox();
          const box = geo.boundingBox;
          if (box && !box.isEmpty() && cameraRef.current && controlsRef.current) {
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
              const fov = cameraRef.current.fov * (Math.PI / 180);
              const dist = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5;
              const dir  = cameraRef.current.position.clone().sub(controlsRef.current.target).normalize();
              const targetPos = center.clone().add(dir.multiplyScalar(dist));
              const startPos   = cameraRef.current.position.clone();
              const startTarget = controlsRef.current.target.clone();
              const dur = 800, t0 = Date.now();
              const step = () => {
                const t = Math.min((Date.now() - t0) / dur, 1);
                const e = 1 - Math.pow(1 - t, 3);
                cameraRef.current!.position.lerpVectors(startPos, targetPos, e);
                controlsRef.current!.target.lerpVectors(startTarget, center, e);
                controlsRef.current!.update();
                framesRemainingRef.current = Math.max(framesRemainingRef.current, 5);
                if (t < 1) requestAnimationFrame(step);
              };
              step();
            }
          }
          framesRemainingRef.current = Math.max(framesRemainingRef.current, 60);
          return;
        }
        const { type, meshes: payloads, error } = data as {
          type: 'batch' | 'complete' | 'error';
          meshes?: MeshPayload[];
          error?: string;
        };

        if (type === 'error') {
          worker.terminate();
          workerRef.current = null;
          reject(new Error(error || 'IFC geometry worker failed'));
          return;
        }

        const appendPayloadsToScene = (batch: MeshPayload[]) => {
          if (!batch || batch.length === 0) return;

          const HIDDEN_TYPES = new Set(['IFCOPENINGELEMENT', 'IFCSPACE', 'IFCSPACESTANDARDCASE', 'IFCVIRTUALELEMENT']);
          const visible = batch.filter(p => !HIDDEN_TYPES.has(p.ifcType));

          // Separate opaque from transparent — opaque gets merged into a single batch
          // mesh (drastically fewer draw calls), transparent stays as individual meshes
          // so blend order and material settings can vary per element.
          const opaque      = visible.filter(p => p.opacity >= 0.85);
          const transparent = visible.filter(p => p.opacity < 0.85);

          // ── Opaque batch mesh (vertex-colour merged geometry) ───────────────────
          if (opaque.length > 0) {
            let totalVerts = 0, totalTris = 0;
            for (const p of opaque) {
              totalVerts += p.positions.length / 3;
              totalTris  += p.indices.length / 3;
            }

            const allPos = new Float32Array(totalVerts * 3);
            const allNor = new Float32Array(totalVerts * 3);
            const allCol = new Float32Array(totalVerts * 3);
            const allIdx = new Uint32Array(totalTris * 3);
            const ranges: TriangleRange[] = [];

            let vOff = 0, iOff = 0, triOff = 0;
            for (const p of opaque) {
              const vc = p.positions.length / 3;
              const tc = p.indices.length / 3;

              allPos.set(p.positions, vOff * 3);
              allNor.set(p.normals,   vOff * 3);

              // Per-vertex colour (linear) from payload colorRgb
              const raw = p.colorRgb;
              const c = raw
                ? new THREE.Color(raw.r, raw.g, raw.b).convertSRGBToLinear()
                : new THREE.Color(p.color).convertSRGBToLinear();
              for (let v = 0; v < vc; v++) {
                const off3 = (vOff + v) * 3;
                allCol[off3]     = c.r;
                allCol[off3 + 1] = c.g;
                allCol[off3 + 2] = c.b;
              }

              // Compute AABB for camera zoom
              let minX = Infinity, minY = Infinity, minZ = Infinity;
              let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
              for (let v = 0; v < vc; v++) {
                const x = p.positions[v*3], y = p.positions[v*3+1], z = p.positions[v*3+2];
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
              }

              ranges.push({
                expressId: p.expressIds[0],
                start: triOff,
                count: tc,
                bbox: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
              });

              for (let i = 0; i < p.indices.length; i++) {
                allIdx[iOff + i] = p.indices[i] + vOff;
              }
              vOff  += vc;
              iOff  += p.indices.length;
              triOff += tc;
            }

            const bGeo = new THREE.BufferGeometry();
            bGeo.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
            bGeo.setAttribute('normal',   new THREE.BufferAttribute(allNor, 3));
            bGeo.setAttribute('color',    new THREE.BufferAttribute(allCol, 3));
            bGeo.setIndex(new THREE.BufferAttribute(allIdx, 1));

            const bMat = new THREE.MeshStandardMaterial({
              vertexColors: true,
              side: THREE.DoubleSide,
              metalness: 0.0,
              roughness: 0.5,
            });

            const batchMesh = new THREE.Mesh(bGeo, bMat);
            batchMesh.frustumCulled = true;
            batchMesh.userData.triangleRanges = ranges;
            batchMesh.userData.isBatchMesh = true;
            bGeo.computeBoundingSphere(); // compute once eagerly — Three.js caches it
            scene.add(batchMesh);
            meshes.push(batchMesh);

            // Register all elements for O(log n) selection lookup
            for (const r of ranges) {
              expressIdLookupRef.current.set(r.expressId, { mesh: batchMesh, range: r });
            }
          }

          // ── Transparent elements (glass, windows) — individual meshes ───────────
          for (const payload of transparent) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(payload.positions, 3));
            geo.setAttribute('normal',   new THREE.Float32BufferAttribute(payload.normals,   3));
            if (payload.indices.length > 0) geo.setIndex(new THREE.BufferAttribute(payload.indices, 1));

            const rgb = payload.colorRgb;
            const baseRaw    = rgb ? new THREE.Color(rgb.r, rgb.g, rgb.b) : new THREE.Color(payload.color);
            const baseLinear = baseRaw.clone().convertSRGBToLinear();
            const opacity    = rgb?.a ?? payload.opacity;

            const mat = new THREE.MeshPhysicalMaterial({
              color: baseLinear,
              side: THREE.DoubleSide,
              metalness: 0.0,
              roughness: 0.05,
              transparent: true,
              opacity: Math.max(0.15, opacity),
              depthWrite: false,
              envMapIntensity: 0.6,
              emissive: baseLinear.clone(),
              emissiveIntensity: 0.15,
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = true;
            mesh.userData.ifcExpressId = payload.expressIds[0];
            mesh.userData.ifcType      = payload.ifcType;
            scene.add(mesh);
            meshes.push(mesh);

            // Register for selection lookup
            expressIdLookupRef.current.set(payload.expressIds[0], {
              mesh,
              range: {
                expressId: payload.expressIds[0],
                start: 0,
                count: payload.indices.length / 3,
                bbox: { min: [0,0,0], max: [0,0,0] },
              },
            });
          }

          setGeometryCount(meshes.length);
          framesRemainingRef.current = Math.max(framesRemainingRef.current, 30); // ensure new geometry renders
        };

        if (type === 'batch' && payloads) {
          appendPayloadsToScene(payloads);
          // Resolve the promise on first batch so init() can continue (camera fit, etc.)
          // while geometry keeps streaming in the background
          if (!resolved) {
            resolved = true;
            resolve(meshes);
          }
          return;
        }

        if (type === 'complete') {
          // Backward compatibility: support old worker behavior where all payloads
          // arrive in the final complete event.
          if (payloads && payloads.length > 0) {
            appendPayloadsToScene(payloads);
          }

          // Resolve if not already resolved (no batch events were emitted)
          if (!resolved) {
            resolved = true;
            resolve(meshes);
          }

          // OPTIMIZATION: For context-only view, dispose worker immediately after loading (saves 200-300 MB)
          // For interactive inspection mode, keep worker alive for 60 seconds
          if (isContextOnly) {
            try {
              worker.postMessage({ type: 'dispose' });
              worker.terminate();
            } catch { /* ignore */ }
          }

          // Update geometry count with final total
          setGeometryCount(meshes.length);
          // All meshes are in the scene now — re-run the route effect so an
          // active route re-applies ghosting to everything that streamed in.
          setViewerReadyTick(t => t + 1);
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      const transferBuffer = buffer.slice(0);
      // keepModel: true (when not context-only) keeps _ifcApiGlobal alive after streaming
      // so on-demand getGeometry requests (e.g. IFCSPACE) can be served.
      // The worker auto-terminates after 60s idle via scheduleKeepAlive → self.close().
      worker.postMessage({ type: 'parse', buffer: transferBuffer, keepModel: !isContextOnly }, [transferBuffer]);
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
      <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-400">
            {geometryCount > 0 ? `${geometryCount} objects loaded` : 'Initializing...'}
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
