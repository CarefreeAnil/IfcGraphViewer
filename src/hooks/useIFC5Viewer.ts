/**
 * IFC5 3D Viewer Hook
 * Handles 3D visualization of IFC5 composed objects
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ComposedObject,
  IFC5Material,
  MeshGeometry,
  CurveGeometry,
  PointCloudGeometry,
} from '../types/ifc5';
import {
  extractMeshGeometry,
  extractCurveGeometry,
  extractPointCloudGeometry,
  extractMaterial,
  extractTransform,
} from '../lib/ifc5ToGraph';

export function useIFC5Viewer(
  containerRef: React.RefObject<HTMLDivElement>,
  active: boolean,
  onObjectClick?: (path: string) => void
) {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const raycastRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const animationIdRef = useRef<number | null>(null);
  const onObjectClickRef = useRef<typeof onObjectClick>(onObjectClick);
  const lastLoadedRootRef = useRef<ComposedObject | null>(null);
  const selectedPathRef = useRef<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize scene when active and container has size
  useEffect(() => {
    if (!active) {
      return;
    }

    let rafId: number | null = null;
    let cancelled = false;

    const tryInit = () => {
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) {
        rafId = requestAnimationFrame(tryInit);
        return;
      }

      if (container.clientWidth === 0 || container.clientHeight === 0) {
        rafId = requestAnimationFrame(tryInit);
        return;
      }

      if (sceneRef.current) {
        return;
      }

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        10000
      );
      camera.position.set(50, 50, 50);
      camera.up.set(0, 0, 1); // Z-up convention
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        logarithmicDepthBuffer: true,
      });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight1.position.set(5, -10, 7.5);
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight2.position.set(-5, 5, 5);
      scene.add(directionalLight2);

      const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.3);
      directionalLight3.position.set(0, 8, -10);
      scene.add(directionalLight3);

      // Grid
      const gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0xcccccc);
      gridHelper.rotation.x = Math.PI / 2; // Rotate for Z-up
      scene.add(gridHelper);

      // Axes
      const axesHelper = new THREE.AxesHelper(10);
      scene.add(axesHelper);

      // Animation loop
      const animate = () => {
        const id = requestAnimationFrame(animate);
        animationIdRef.current = id;
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!container || !camera || !renderer) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener('resize', handleResize);

      // Handle clicks on objects
      const handleCanvasClick = (event: MouseEvent) => {
        if (!container || !camera || !cameraRef.current) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycastRef.current.setFromCamera(mouseRef.current, camera);

        // Get all objects in the scene that are not lights/helpers
        const objectsToTest: THREE.Object3D[] = [];
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh && !(obj instanceof THREE.Light) && !(obj instanceof THREE.GridHelper) && !(obj instanceof THREE.AxesHelper)) {
            objectsToTest.push(obj);
          }
        });

        const intersects = raycastRef.current.intersectObjects(objectsToTest);
        if (intersects.length > 0) {
          // Find the path of the clicked object
          let clicked = intersects[0].object;
          while (clicked) {
            if (clicked.userData.path) {
              onObjectClickRef.current?.(clicked.userData.path);
              break;
            }
            clicked = clicked.parent as THREE.Object3D;
          }
        }
      };
      renderer.domElement.addEventListener('click', handleCanvasClick);

      // Mark as initialized
      setIsInitialized(true);

      // Cleanup
      const cleanup = () => {
        if (animationIdRef.current !== null) {
          cancelAnimationFrame(animationIdRef.current);
          animationIdRef.current = null;
        }

        setIsInitialized(false);

        window.removeEventListener('resize', handleResize);
        renderer.domElement.removeEventListener('click', handleCanvasClick);

        if (renderer && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();

        sceneRef.current = null;
        cameraRef.current = null;
        rendererRef.current = null;
        controlsRef.current = null;
      };

      // Store cleanup on ref for effect cleanup
      (container as any)._ifc5Cleanup = cleanup;
    };

    tryInit();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      const container = containerRef.current as any;
      if (container?._ifc5Cleanup) {
        container._ifc5Cleanup();
        delete container._ifc5Cleanup;
      }
    };
  }, [active, containerRef]);

  useEffect(() => {
    onObjectClickRef.current = onObjectClick;
  }, [onObjectClick]);


  // Create mesh from geometry
  const createMesh = (
    geometry: MeshGeometry,
    material: IFC5Material,
    path: ComposedObject[]
  ): THREE.Mesh => {
    const points = new Float32Array(geometry.points);
    const indices = new Uint32Array(geometry.faceVertexIndices);

    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(points, 3)
    );
    bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    bufferGeometry.computeVertexNormals();

    // Create material
    let threeMaterial: THREE.Material;

    if (material.pbrMetallicRoughness) {
      const pbr = material.pbrMetallicRoughness;
      threeMaterial = new THREE.MeshStandardMaterial({
        color: pbr.baseColorFactor
          ? new THREE.Color(
              pbr.baseColorFactor[0],
              pbr.baseColorFactor[1],
              pbr.baseColorFactor[2]
            )
          : 0x888888,
        metalness: pbr.metallicFactor ?? 0.0,
        roughness: pbr.roughnessFactor ?? 0.5,
        transparent: material.opacity !== undefined && material.opacity < 1.0,
        opacity: material.opacity ?? 1.0,
      });
    } else {
      const color = material.diffuseColor
        ? new THREE.Color(
            material.diffuseColor[0],
            material.diffuseColor[1],
            material.diffuseColor[2]
          )
        : new THREE.Color(0x888888);

      threeMaterial = new THREE.MeshLambertMaterial({
        color,
        transparent: material.opacity !== undefined && material.opacity < 1.0,
        opacity: material.opacity ?? 1.0,
      });
    }

    return new THREE.Mesh(bufferGeometry, threeMaterial);
  };

  // Create curve from geometry
  const createCurve = (
    geometry: CurveGeometry,
    material: IFC5Material
  ): THREE.Line => {
    const points = new Float32Array(geometry.points);
    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(points, 3)
    );

    const color = material.diffuseColor
      ? new THREE.Color(
          material.diffuseColor[0],
          material.diffuseColor[1],
          material.diffuseColor[2]
        ).multiplyScalar(0.8)
      : new THREE.Color(0x666666);

    const lineMaterial = new THREE.LineBasicMaterial({ color });

    return new THREE.Line(bufferGeometry, lineMaterial);
  };

  // Create points from geometry
  const createPoints = (
    geometry: PointCloudGeometry,
    hasColors: boolean
  ): THREE.Points => {
    const positions =
      typeof geometry.positions === 'string'
        ? decodeBase64ToFloat32Array(geometry.positions)
        : new Float32Array(geometry.positions);

    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );

    if (hasColors && geometry.colors) {
      const colors =
        typeof geometry.colors === 'string'
          ? decodeBase64ToFloat32Array(geometry.colors)
          : new Float32Array(geometry.colors);
      bufferGeometry.setAttribute(
        'color',
        new THREE.BufferAttribute(colors, 3)
      );
    }

    const material = new THREE.PointsMaterial({
      size: 5,
      sizeAttenuation: false,
      color: hasColors ? 0xffffff : 0x000000,
      vertexColors: hasColors,
    });

    return new THREE.Points(bufferGeometry, material);
  };

  // Decode base64 to Float32Array
  const decodeBase64ToFloat32Array = (base64: string): Float32Array => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Float32Array(bytes.buffer);
  };

  // Traverse and render composed object tree
  const traverseAndRender = (
    path: ComposedObject[],
    parent: THREE.Object3D,
    stats = { meshes: 0, curves: 0, points: 0, nodes: 0 }
  ) => {
    const node = path[0];
    stats.nodes++;
    let elem: THREE.Object3D = new THREE.Group();

    // Check for visibility
    if (
      node.attributes?.['usd::usdgeom::visibility::visibility'] === 'invisible'
    ) {
      return stats;
    }

    // Create appropriate 3D object based on type
    if (node.type === 'Mesh' && node.attributes) {
      const geometry = extractMeshGeometry(node.attributes);
      if (geometry) {
        stats.meshes++;
        const material = extractMaterial(
          node.attributes,
          path.slice(1) // Pass the entire path from parent to root
        );
        elem = createMesh(geometry, material, path);
      } else {
        console.warn('Failed to extract mesh geometry for', node.name);
      }
    } else if (node.type === 'Curve' && node.attributes) {
      const geometry = extractCurveGeometry(node.attributes);
      if (geometry) {
        stats.curves++;
        const material = extractMaterial(
          node.attributes,
          path.slice(1) // Pass the entire path from parent to root
        );
        elem = createCurve(geometry, material);
      }
    } else if (node.type === 'Points' && node.attributes) {
      const geometry = extractPointCloudGeometry(node.attributes);
      if (geometry) {
        stats.points++;
        elem = createPoints(geometry, !!geometry.colors);
      }
    }

    // Store object in map
    objectMapRef.current.set(node.name, elem);
    elem.userData.path = node.name;

    parent.add(elem);

    // Apply transformation
    const transform = node.attributes
      ? extractTransform(node.attributes)
      : null;
    if (transform && transform.matrix) {
      elem.matrixAutoUpdate = false;
      const matrix = new THREE.Matrix4();
      matrix.set(...(transform.matrix as any));
      matrix.transpose(); // Column-major to row-major
      elem.matrix.copy(matrix);
    }

    // Traverse children
    if (node.children) {
      node.children.forEach((child) => {
        traverseAndRender([child, ...path], elem, stats);
      });
    }
    
    return stats;
  };

  // Load composed object
  const loadComposedObject = (root: ComposedObject) => {
    console.log('[loadComposedObject] Called with root:', root?.name, { scene: sceneRef.current, camera: cameraRef.current, controls: controlsRef.current });
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) {
      console.warn('[loadComposedObject] Scene not initialized, returning');
      return;
    }

    if (lastLoadedRootRef.current === root) {
      return;
    }
    lastLoadedRootRef.current = root;

    // Clear previous objects (keep lights and helpers)
    const scene = sceneRef.current;
    const objectsToRemove = scene.children.filter(
      (child) => !(child instanceof THREE.Light) && !(child instanceof THREE.GridHelper) && !(child instanceof THREE.AxesHelper)
    );
    objectsToRemove.forEach((obj) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          const mat = child.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      });
      scene.remove(obj);
    });
    objectMapRef.current.clear();

    // Render new object
    console.time('traverseAndRender');
    const stats = traverseAndRender([root], scene);
    console.timeEnd('traverseAndRender');
    console.log('[loadComposedObject] Rendered', stats.meshes, 'meshes from', stats.nodes, 'nodes');

    // Calculate bounding box of the model only (excluding grid/helpers)
    const modelBox = new THREE.Box3();
    const modelGroup = objectMapRef.current.get(root.name);
    
    if (modelGroup) {
      modelBox.setFromObject(modelGroup);
    } else {
      // Fallback: iterate over all managed objects
      objectMapRef.current.forEach((obj) => {
        modelBox.expandByObject(obj);
      });
    }

    if (!modelBox.isEmpty()) {
      const center = modelBox.getCenter(new THREE.Vector3());
      const size = modelBox.getSize(new THREE.Vector3()).length();
      
      console.log('[loadComposedObject] Fitting camera to model', {
        center: center.toArray(),
        size,
        min: modelBox.min.toArray(),
        max: modelBox.max.toArray()
      });

      const camera = cameraRef.current;
      const controls = controlsRef.current;

      // Ensure size is not too small (avoid division by zero or extreme zoom)
      const adjustedSize = Math.max(size, 1.0);

      camera.position
        .copy(center)
        .add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(adjustedSize * 2)); // Zoom out a bit more
      
      camera.near = adjustedSize / 1000;
      camera.far = adjustedSize * 100;
      camera.updateProjectionMatrix();
      
      controls.target.copy(center);
      controls.update();
    } else {
      console.warn('[loadComposedObject] Model bounding box is empty');
    }
  };

  // Select object by path
  const selectObject = (path: string | null) => {
    // Unhighlight previous selection
    if (selectedPathRef.current) {
      const prevObj = objectMapRef.current.get(selectedPathRef.current);
      if (prevObj) {
        unhighlightObject(prevObj);
      }
    }

    selectedPathRef.current = path;
    setSelectedPath(path);

    // Highlight new selection
    if (path) {
      const obj = objectMapRef.current.get(path);
      if (obj) {
        highlightObject(obj);
      }
    }
  };

  // Highlight object
  const highlightObject = (obj: THREE.Object3D) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.Material | THREE.Material[];
        if (!child.userData._origMaterial) {
          child.userData._origMaterial = mat;
        }

        if (Array.isArray(mat)) {
          const newMats = mat.map((m) => {
            const clone = m.clone();
            if ('emissive' in clone) {
              (clone as THREE.MeshStandardMaterial).emissive?.set(0x4f46e5);
              (clone as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
            }
            return clone;
          });
          child.material = newMats;
        } else {
          const newMat = mat.clone();
          if ('emissive' in newMat) {
            (newMat as THREE.MeshStandardMaterial).emissive?.set(0x4f46e5);
            (newMat as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
          }
          child.material = newMat;
        }
      }
    });
  };

  // Unhighlight object
  const unhighlightObject = (obj: THREE.Object3D) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.userData._origMaterial) {
          const currentMat = child.material as THREE.Material | THREE.Material[];
          if (Array.isArray(currentMat)) {
            currentMat.forEach((m) => m.dispose());
          } else {
            currentMat.dispose();
          }
          child.material = child.userData._origMaterial;
          delete child.userData._origMaterial;
        }
      }
    });
  };

  return {
    loadComposedObject,
    selectObject,
    selectedPath,
    objectMap: objectMapRef.current,
    isInitialized,
  };
}
