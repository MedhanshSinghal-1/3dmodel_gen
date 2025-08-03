import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';

interface Room {
  id: string;
  name: string;
  color: string;
  vertices: Array<[number, number]>;
  center: [number, number];
}

interface ProcessedData {
  rooms: Room[];
  walls: Array<Array<[number, number]>>;
  originalImage: string;
  processedImage: string;
}

interface ThreeDViewerProps {
  processedData: ProcessedData;
  selectedRoom: string | null;
  onRoomSelect: (roomId: string | null) => void;
}

const ThreeDViewer = forwardRef<{ resetView: () => void; exportModel: () => void }, ThreeDViewerProps>(
  ({ processedData, selectedRoom, onRoomSelect }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const roomMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
    const animationIdRef = useRef<number | null>(null);
    const mouseRef = useRef(new THREE.Vector2());
    const raycasterRef = useRef(new THREE.Raycaster());

    useImperativeHandle(ref, () => ({
      resetView: () => {
        if (cameraRef.current) {
          cameraRef.current.position.set(0, 100, 100);
          cameraRef.current.lookAt(0, 0, 0);
        }
      },
      exportModel: () => {
        console.log('Exporting 3D model...');
        // In a real implementation, this would export the 3D model
        alert('Export functionality would be implemented here');
      }
    }));

    useEffect(() => {
      if (!mountRef.current) return;

      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf8fafc);
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(
        75,
        mountRef.current.clientWidth / mountRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 100, 100);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;
      mountRef.current.appendChild(renderer.domElement);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(50, 100, 50);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      // Mouse controls
      let isMouseDown = false;
      let previousMousePosition = { x: 0, y: 0 };

      const onMouseDown = (event: MouseEvent) => {
        isMouseDown = true;
        previousMousePosition = { x: event.clientX, y: event.clientY };
      };

      const onMouseUp = () => {
        isMouseDown = false;
      };

      const onMouseMove = (event: MouseEvent) => {
        if (!isMouseDown || !cameraRef.current) return;

        const deltaMove = {
          x: event.clientX - previousMousePosition.x,
          y: event.clientY - previousMousePosition.y
        };

        const rotationSpeed = 0.005;
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(cameraRef.current.position);
        spherical.theta -= deltaMove.x * rotationSpeed;
        spherical.phi += deltaMove.y * rotationSpeed;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

        cameraRef.current.position.setFromSpherical(spherical);
        cameraRef.current.lookAt(0, 0, 0);

        previousMousePosition = { x: event.clientX, y: event.clientY };
      };

      const onWheel = (event: WheelEvent) => {
        if (!cameraRef.current) return;
        
        const scaleFactor = event.deltaY > 0 ? 1.1 : 0.9;
        cameraRef.current.position.multiplyScalar(scaleFactor);
        cameraRef.current.position.clampLength(30, 300);
      };

      const onClick = (event: MouseEvent) => {
        if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

        const rect = mountRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(
          Array.from(roomMeshesRef.current.values())
        );

        if (intersects.length > 0) {
          const clickedMesh = intersects[0].object as THREE.Mesh;
          const roomId = clickedMesh.userData.roomId;
          onRoomSelect(roomId === selectedRoom ? null : roomId);
        } else {
          onRoomSelect(null);
        }
      };

      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('wheel', onWheel);
      renderer.domElement.addEventListener('click', onClick);

      // Animation loop
      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!mountRef.current || !camera || !renderer) return;
        
        camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.domElement.removeEventListener('click', onClick);
        window.removeEventListener('resize', handleResize);
        
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    }, []);

    // Update 3D model when processedData changes
    useEffect(() => {
      if (!sceneRef.current || !processedData) return;

      // Clear existing room meshes
      roomMeshesRef.current.forEach(mesh => {
        sceneRef.current?.remove(mesh);
      });
      roomMeshesRef.current.clear();

      // Create floor
      const floorGeometry = new THREE.PlaneGeometry(300, 300);
      const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -2;
      floor.receiveShadow = true;
      sceneRef.current.add(floor);

      // Create rooms
      processedData.rooms.forEach(room => {
        if (room.vertices.length < 3) return;

        // Create room shape
        const shape = new THREE.Shape();
        const vertices = room.vertices;
        shape.moveTo(vertices[0][0], vertices[0][1]);
        
        for (let i = 1; i < vertices.length; i++) {
          shape.lineTo(vertices[i][0], vertices[i][1]);
        }
        shape.lineTo(vertices[0][0], vertices[0][1]);

        // Create room geometry (floor)
        const roomGeometry = new THREE.ShapeGeometry(shape);
        const roomMaterial = new THREE.MeshLambertMaterial({
          color: new THREE.Color(room.color),
          transparent: true,
          opacity: 0.8
        });
        
        const roomMesh = new THREE.Mesh(roomGeometry, roomMaterial);
        roomMesh.rotation.x = -Math.PI / 2;
        roomMesh.position.y = 0;
        roomMesh.userData.roomId = room.id;
        roomMesh.castShadow = true;
        roomMesh.receiveShadow = true;
        
        sceneRef.current.add(roomMesh);
        roomMeshesRef.current.set(room.id, roomMesh);

        // Create walls
        for (let i = 0; i < vertices.length; i++) {
          const currentVertex = vertices[i];
          const nextVertex = vertices[(i + 1) % vertices.length];
          
          const wallLength = Math.sqrt(
            Math.pow(nextVertex[0] - currentVertex[0], 2) +
            Math.pow(nextVertex[1] - currentVertex[1], 2)
          );
          
          const wallGeometry = new THREE.BoxGeometry(wallLength, 25, 2);
          const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
          const wall = new THREE.Mesh(wallGeometry, wallMaterial);
          
          const midX = (currentVertex[0] + nextVertex[0]) / 2;
          const midY = (currentVertex[1] + nextVertex[1]) / 2;
          
          wall.position.set(midX, 12.5, midY);
          
          const angle = Math.atan2(
            nextVertex[1] - currentVertex[1],
            nextVertex[0] - currentVertex[0]
          );
          wall.rotation.y = angle;
          
          wall.castShadow = true;
          wall.receiveShadow = true;
          
          sceneRef.current.add(wall);
        }
      });

    }, [processedData]);

    // Update room selection
    useEffect(() => {
      roomMeshesRef.current.forEach((mesh, roomId) => {
        const room = processedData.rooms.find(r => r.id === roomId);
        if (!room) return;

        const isSelected = roomId === selectedRoom;
        const material = mesh.material as THREE.MeshLambertMaterial;
        
        material.color.setHex(new THREE.Color(room.color).getHex());
        material.opacity = isSelected ? 1.0 : 0.8;
        
        if (isSelected) {
          mesh.position.y = 2;
        } else {
          mesh.position.y = 0;
        }
      });
    }, [selectedRoom, processedData.rooms]);

    return (
      <div ref={mountRef} className="w-full h-full min-h-[500px] rounded-lg overflow-hidden" />
    );
  }
);

ThreeDViewer.displayName = 'ThreeDViewer';

export default ThreeDViewer;