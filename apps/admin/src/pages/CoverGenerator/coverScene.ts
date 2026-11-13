import * as THREE from 'three';

// The animated 3D backdrop, ported 1:1 from the website's cover generator so admin-made
// covers match the ones made there. Rendered off-screen; CoverComposer copies each frame.

interface OrbitLight {
  light: THREE.PointLight;
  radius: number;
  speed: number;
  ySpeed: number;
  phase: number;
}

export interface CoverScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  timer: THREE.Timer;
  group: THREE.Group;
  knot: THREE.Mesh;
  halo1: THREE.Mesh;
  halo2: THREE.Mesh;
  particles: THREE.Points;
  orbitLights: OrbitLight[];
  /** Every geometry/material created here: add new ones or they leak GPU memory. */
  disposables: (THREE.BufferGeometry | THREE.Material)[];
}

const PARTICLE_COUNT = 700;
const PARTICLE_PALETTE = [0xfd7e14, 0xffa94d, 0xff922b, 0xffe066, 0xec4899];

const ORBIT_LIGHTS = [
  { color: 0xfd7e14, intensity: 110, radius: 3.6, speed: 0.45, ySpeed: 0.3, phase: 0 },
  { color: 0xffa94d, intensity: 90, radius: 3.0, speed: -0.35, ySpeed: 0.4, phase: Math.PI },
  { color: 0xff922b, intensity: 70, radius: 3.4, speed: 0.4, ySpeed: 0.22, phase: Math.PI / 2 },
  { color: 0xffe066, intensity: 55, radius: 2.6, speed: -0.55, ySpeed: 0.48, phase: Math.PI * 1.5 },
];

export function createCoverScene(width: number, height: number): CoverScene {
  // preserveDrawingBuffer: the 2D canvas reads this canvas after the frame is presented.
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
  camera.position.z = 7;

  const group = new THREE.Group();
  scene.add(group);

  const knotGeometry = new THREE.TorusKnotGeometry(1.0, 0.32, 220, 32, 2, 3);
  const knotMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xfd7e14),
    metalness: 0.85,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.88,
    envMapIntensity: 1.8,
  });
  const knot = new THREE.Mesh(knotGeometry, knotMaterial);
  group.add(knot);

  const shellGeometry = new THREE.TorusKnotGeometry(1.05, 0.42, 160, 20, 2, 3);
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: 0xfd7e14,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  knot.add(new THREE.Mesh(shellGeometry, shellMaterial));

  const haloGeometry = new THREE.TorusGeometry(2.6, 0.008, 6, 256);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0xffa94d,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const halo1 = new THREE.Mesh(haloGeometry, haloMaterial);
  halo1.rotation.x = Math.PI / 2.6;
  const halo2 = new THREE.Mesh(haloGeometry, haloMaterial);
  halo2.rotation.x = Math.PI / 1.7;
  halo2.rotation.y = Math.PI / 3.5;
  group.add(halo1, halo2);

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const palette = PARTICLE_PALETTE.map((hex) => new THREE.Color(hex));
  const fallbackParticleColor = new THREE.Color(0xfd7e14);
  for (let index = 0; index < PARTICLE_COUNT; index++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const radius = 3.2 + Math.random() * 4.2;
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[index * 3 + 2] = radius * Math.cos(phi);
    const color = palette[Math.floor(Math.random() * palette.length)] ?? fallbackParticleColor;
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.032,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
    vertexColors: true,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  group.add(particles);

  scene.add(new THREE.AmbientLight(0x1a0a00, 4));
  const orbitLights: OrbitLight[] = ORBIT_LIGHTS.map(
    ({ color, intensity, radius, speed, ySpeed, phase }) => {
      const light = new THREE.PointLight(color, intensity, 14);
      scene.add(light);
      return { light, radius, speed, ySpeed, phase };
    },
  );

  return {
    renderer,
    scene,
    camera,
    timer: new THREE.Timer(),
    group,
    knot,
    halo1,
    halo2,
    particles,
    orbitLights,
    disposables: [
      knotGeometry,
      shellGeometry,
      haloGeometry,
      particleGeometry,
      knotMaterial,
      shellMaterial,
      haloMaterial,
      particleMaterial,
    ],
  };
}

export function disposeCoverScene(coverScene: CoverScene): void {
  coverScene.disposables.forEach((disposable) => disposable.dispose());
  coverScene.renderer.dispose();
}

/** Advances the animation and renders one frame into `renderer.domElement`. */
export function renderCoverSceneFrame(coverScene: CoverScene): void {
  coverScene.timer.update();
  const elapsedSeconds = coverScene.timer.getElapsed();

  coverScene.group.rotation.y = elapsedSeconds * 0.18;
  coverScene.group.rotation.x = Math.sin(elapsedSeconds * 0.15) * 0.08;
  coverScene.knot.rotation.x = elapsedSeconds * 0.32;
  coverScene.knot.rotation.y = elapsedSeconds * 0.4;
  coverScene.halo1.rotation.z = elapsedSeconds * 0.2;
  coverScene.halo2.rotation.z = -elapsedSeconds * 0.16;
  coverScene.particles.rotation.y = elapsedSeconds * 0.025;

  coverScene.orbitLights.forEach(({ light, radius, speed, ySpeed, phase }) => {
    light.position.x = Math.cos(elapsedSeconds * speed + phase) * radius;
    light.position.y = Math.sin(elapsedSeconds * ySpeed) * 2.0;
    light.position.z = Math.sin(elapsedSeconds * speed + phase) * radius;
  });

  coverScene.renderer.render(coverScene.scene, coverScene.camera);
}
