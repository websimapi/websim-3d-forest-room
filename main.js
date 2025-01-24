import * as THREE from 'three';

class ForestRoom {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.motionInfo = document.getElementById('motion-info');
    this.hasPermission = false;
    this.initialOrientation = null;
    this.targetRotation = new THREE.Vector3();
    this.currentRotation = new THREE.Vector3();
    this.orientationData = { alpha: 0, beta: 0, gamma: 0 };
    
    this.init();
    this.createRoom();
    this.setupMotionControls();
    this.animate();
  }

  init() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    // Moved camera back and up for better view
    this.camera.position.z = 8;
    this.camera.position.y = 3;
    this.camera.lookAt(0, 0, 0);

    // Increased ambient light brightness
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Adjusted directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  createRoom() {
    // Floor - made bigger and greener
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x4CAF50,
      roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Trees
    this.createTrees();

    // Lighter fog
    this.scene.fog = new THREE.FogExp2(0xCCFFCC, 0.08);
  }

  createTrees() {
    const createTree = (x, z) => {
      const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);

      const leavesGeometry = new THREE.ConeGeometry(1, 3, 8);
      const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x2E7D32 });
      const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
      leaves.position.y = 2.4;

      const tree = new THREE.Group();
      tree.add(trunk);
      tree.add(leaves);
      tree.position.set(x, 1, z);
      return tree;
    };

    // Add more trees in multiple circles
    for (let ring = 1; ring <= 2; ring++) {
      const treesInRing = 12 * ring;
      const radius = 4 * ring;
      
      for (let i = 0; i < treesInRing; i++) {
        const angle = (i / treesInRing) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const tree = createTree(x, z);
        // Add some random variation to trees
        tree.rotation.y = Math.random() * Math.PI * 2;
        tree.scale.setScalar(0.8 + Math.random() * 0.4);
        this.scene.add(tree);
      }
    }
  }

  setupMotionControls() {
    const tapOverlay = document.getElementById('tap-overlay');
    
    const requestPermission = async () => {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          // iOS 13+ devices
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            this.hasPermission = true;
            this.enableOrientationControls();
            this.motionInfo.textContent = 'Motion access granted! Move your device.';
          } else {
            this.motionInfo.textContent = 'Motion access denied. Tap to try again.';
          }
        } else {
          // Android and other devices
          this.hasPermission = true;
          this.enableOrientationControls();
          this.motionInfo.textContent = 'Motion controls enabled! Move your device.';
        }
      } catch (error) {
        console.error('Error requesting motion permission:', error);
        // Fallback for Android
        if (window.DeviceOrientationEvent) {
          this.hasPermission = true;
          this.enableOrientationControls();
          this.motionInfo.textContent = 'Motion controls enabled! Move your device.';
        } else {
          this.motionInfo.textContent = 'Device orientation not supported. Tap to retry.';
        }
      }
    };

    tapOverlay.addEventListener('click', () => {
      if (!this.hasPermission) {
        requestPermission();
      }
    });

    // Check if running on mobile device
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      this.motionInfo.textContent = 'Tap anywhere to enable motion controls';
    } else {
      this.motionInfo.textContent = 'Please view on a mobile device for motion controls';
    }
  }

  enableOrientationControls() {
    const handleOrientation = (event) => {
      if (!this.hasPermission) return;
      
      // Store orientation data
      this.orientationData = {
        alpha: event.alpha || 0,
        beta: event.beta || 0,
        gamma: event.gamma || 0
      };

      // Store initial orientation for calibration
      if (!this.initialOrientation) {
        this.initialOrientation = { ...this.orientationData };
        return;
      }

      // Calculate relative changes
      const betaDiff = this.orientationData.beta - this.initialOrientation.beta;
      const gammaDiff = this.orientationData.gamma - this.initialOrientation.gamma;
      
      // Convert to radians and apply sensitivity
      const sensitivity = 0.02;
      this.targetRotation.x = THREE.MathUtils.degToRad(betaDiff) * sensitivity;
      this.targetRotation.y = THREE.MathUtils.degToRad(gammaDiff) * sensitivity;

      // Update debug info
      this.motionInfo.textContent = `
        Tilt Front/Back: ${Math.round(betaDiff)}°
        Tilt Left/Right: ${Math.round(gammaDiff)}°
        Alpha: ${Math.round(this.orientationData.alpha)}°
      `;
    };

    // Try multiple event types for better device compatibility
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    
    // Fallback for Android
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', (event) => {
        const rotation = event.rotationRate;
        if (rotation) {
          this.targetRotation.y += (rotation.gamma || 0) * 0.01;
          this.targetRotation.x += (rotation.beta || 0) * 0.01;
        }
      }, true);
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Smooth camera rotation with enhanced damping
    const lerpFactor = 0.05;
    this.currentRotation.x = THREE.MathUtils.lerp(this.currentRotation.x, this.targetRotation.x, lerpFactor);
    this.currentRotation.y = THREE.MathUtils.lerp(this.currentRotation.y, this.targetRotation.y, lerpFactor);
    
    // Apply rotation with wider range
    this.camera.rotation.x = THREE.MathUtils.clamp(this.currentRotation.x, -Math.PI / 2, Math.PI / 2);
    this.camera.rotation.y = THREE.MathUtils.clamp(this.currentRotation.y, -Math.PI / 2, Math.PI / 2);

    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize forest room
const forestRoom = new ForestRoom();

// Global error handler
window.addEventListener('error', (error) => {
  console.error('Global error:', error);
  document.getElementById('motion-info').textContent = `Error: ${error.message}`;
});