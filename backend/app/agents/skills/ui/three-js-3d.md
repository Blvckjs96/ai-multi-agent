---
name: three-js-3d
description: Generate 3D scenes with Three.js and React Three Fiber (R3F) — scene setup, PBR materials, lighting, GLTF loading, animations, shaders, post-processing, and performance patterns for React.
---

## Install

```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

## Vanilla Three.js — Scene Setup

```ts
import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.02);

const camera = new THREE.PerspectiveCamera(
  75,                                      // fov (degrees)
  window.innerWidth / window.innerHeight,  // aspect
  0.1,                                     // near
  1000,                                    // far
);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap — never uncapped
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;  // r152+ required
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Delta-based loop — frame-rate independent
const clock = new THREE.Clock();
function animate() {
  const delta = clock.getDelta();           // seconds since last frame
  mesh.rotation.y += delta * 0.5;          // consistent at any fps
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// Responsive resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
```

## Materials

| Material | Use case | Lighting |
|----------|----------|----------|
| `MeshBasicMaterial` | Unlit, wireframes | None |
| `MeshLambertMaterial` | Matte, fast | Diffuse only |
| `MeshPhongMaterial` | Shiny/plastic | Phong specular |
| `MeshStandardMaterial` | PBR — recommended | Full PBR |
| `MeshPhysicalMaterial` | Glass, clearcoat, fabric | PBR+ |
| `MeshToonMaterial` | Cel-shaded | Toon |
| `ShaderMaterial` | Custom GLSL | Custom |

### MeshStandardMaterial (PBR)

```ts
const material = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.4,         // 0 = mirror, 1 = fully diffuse
  metalness: 0.8,         // 0 = dielectric, 1 = metal
  map: colorTexture,
  roughnessMap: roughTex,
  metalnessMap: metalTex,
  normalMap: normalTex,
  normalScale: new THREE.Vector2(1, 1),
  aoMap: aoTex,           // requires uv2 attribute on geometry
  emissive: 0x000000,
  emissiveIntensity: 1,
  envMap: envTexture,
  envMapIntensity: 1,
});
// aoMap needs a second UV channel:
geometry.setAttribute("uv2", geometry.attributes.uv);
```

### Glass (MeshPhysicalMaterial)

```ts
const glass = new THREE.MeshPhysicalMaterial({
  metalness: 0,
  roughness: 0,
  transmission: 1.0,      // fully transparent/refractive
  thickness: 0.5,
  ior: 1.5,               // index of refraction
  envMapIntensity: 1,
});
```

### Car paint (MeshPhysicalMaterial)

```ts
const paint = new THREE.MeshPhysicalMaterial({
  color: 0xff2200,
  metalness: 0.9,
  roughness: 0.5,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
});
```

### ShaderMaterial with uniforms

```ts
const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime:  { value: 0 },
    uColor: { value: new THREE.Color(0x6c63ff) },
  },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      pos.z += sin(pos.x * 10.0 + uTime) * 0.1;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(uColor, 1.0);
    }
  `,
});
// Update in loop:
material.uniforms.uTime.value = clock.getElapsedTime();
```

## Lighting

```ts
// Base ambient — fill shadows, never use alone
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

// Key light with shadows
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 8, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
scene.add(dirLight);

// Point light for accent / warmth
const pointLight = new THREE.PointLight(0xff8800, 1.5, 20);
pointLight.position.set(-3, 2, 0);
scene.add(pointLight);

// Environment map for PBR reflections
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
const pmremGenerator = new THREE.PMREMGenerator(renderer);
new RGBELoader().load("/hdr/studio.hdr", (texture) => {
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = envMap;   // PBR lighting
  scene.background = envMap;    // skybox (optional)
  texture.dispose();
  pmremGenerator.dispose();
});
```

## GLTF Loading

```ts
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load("/models/hero.glb", (gltf) => {
  const model = gltf.scene;
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(model);
});
```

## AnimationMixer — playing GLTF animations

```ts
let mixer: THREE.AnimationMixer;

loader.load("/models/character.glb", (gltf) => {
  const model = gltf.scene;
  scene.add(model);

  mixer = new THREE.AnimationMixer(model);

  const walkClip = THREE.AnimationClip.findByName(gltf.animations, "Walk");
  if (walkClip) {
    const action = mixer.clipAction(walkClip);
    action.loop = THREE.LoopRepeat;
    action.play();
  }

  // Crossfade between clips
  const idleAction = mixer.clipAction(idleClip);
  idleAction.play();
  idleAction.crossFadeTo(mixer.clipAction(walkClip), 0.5, true);
});

// Update in loop — required
function animate() {
  const delta = clock.getDelta();
  mixer?.update(delta);
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
```

## Particles

```ts
const count = 3000;
const positions = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 20;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const points = new THREE.Points(geometry, new THREE.PointsMaterial({
  size: 0.03,
  sizeAttenuation: true,
  color: 0xa78bfa,
  transparent: true,
  opacity: 0.85,
}));
scene.add(points);

// Slow drift in loop
points.rotation.y = clock.getElapsedTime() * 0.04;
```

## Proper Cleanup — always dispose

```ts
function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((m) => m.dispose());
  } else {
    mesh.material.dispose();
  }
  scene.remove(mesh);
}

// On unmount / route change:
renderer.dispose();
scene.traverse((child) => {
  if ((child as THREE.Mesh).isMesh) disposeMesh(child as THREE.Mesh);
});
```

---

## React Three Fiber (R3F) — Canvas Setup

```tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from "@react-three/drei";
import { Suspense } from "react";

export default function ThreeHero() {
  return (
    <div className="relative w-full h-screen">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}            // cap pixel ratio
        frameloop="demand"      // only render on change — use "always" for animations
        shadows
      >
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 2, 5]} fov={60} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
          <Environment preset="city" />
          <ContactShadows position={[0, -1.5, 0]} opacity={0.4} blur={2} />
          <Scene />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  );
}
```

## R3F — useFrame (delta-based, never fixed constants)

```tsx
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

function RotatingMesh() {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += delta * 0.6;   // delta — frame-rate independent
  });

  return (
    <mesh ref={mesh} castShadow>
      <icosahedronGeometry args={[1, 2]} />
      <meshStandardMaterial color="#6c63ff" roughness={0.3} metalness={0.7} />
    </mesh>
  );
}
```

## R3F — Distortion + Float

```tsx
import { MeshDistortMaterial, Float } from "@react-three/drei";

function HeroBlob() {
  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh>
        <sphereGeometry args={[1.2, 64, 64]} />
        <MeshDistortMaterial color="#0ea5e9" distort={0.4} speed={2} roughness={0.1} metalness={0.5} />
      </mesh>
    </Float>
  );
}
```

## R3F — GLTF with Animations

```tsx
import { useGLTF, useAnimations } from "@react-three/drei";

function Character({ url }: { url: string }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    actions["Walk"]?.play();
  }, [actions]);

  return <primitive ref={group} object={scene} />;
}

useGLTF.preload("/models/character.glb");
```

## R3F — GSAP Camera ScrollTrigger

```tsx
import { useThree } from "@react-three/fiber";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function CameraRig() {
  const { camera } = useThree();

  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: "#scroll-wrapper",
        start: "top top",
        end: "+=300%",
        scrub: 1.5,
        pin: true,
      },
    });
    tl.to(camera.position, { z: 2, ease: "none" })
      .to(camera.position, { x: 3, y: 1, ease: "none" })
      .to(camera.rotation, { y: -0.6, ease: "none" }, "<");
  });

  return null;
}
```

## R3F — Post-Processing

```tsx
import { EffectComposer, Bloom, DepthOfField, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

// Inside Canvas:
<EffectComposer>
  <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.5} />
  <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={3} />
  <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.002, 0.002]} />
</EffectComposer>
```

## R3F — HTML Overlay on Canvas

```tsx
import { Html } from "@react-three/drei";

function Label3D() {
  return (
    <Html center distanceFactor={5} occlude>
      <div className="bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm font-medium">
        Interactive label
      </div>
    </Html>
  );
}
```

## Math Utilities

```ts
THREE.MathUtils.lerp(0, 100, 0.5);           // 50
THREE.MathUtils.clamp(value, 0, 1);
THREE.MathUtils.mapLinear(v, 0, 1, -5, 5);
THREE.MathUtils.degToRad(90);               // Math.PI / 2
THREE.MathUtils.smoothstep(x, min, max);

const v = new THREE.Vector3(1, 0, 0);
v.lerp(new THREE.Vector3(0, 1, 0), 0.5);   // in-place
v.normalize();
v.distanceTo(other);
```

## Performance Rules

- `dpr={[1, 2]}` — always cap pixel ratio
- `frameloop="demand"` for static/infrequent scenes; call `invalidate()` to trigger a render
- Allocate buffers / arrays outside `useFrame` — never inside
- Use `<Detailed>` (R3F LOD) for complex models
- Merge static geometries with `BufferGeometryUtils.mergeGeometries()`
- Dispose geometries, materials, and textures on unmount

## Motion Token Reference

| Element | Pattern | Notes |
|---------|---------|-------|
| Hero entrance | GSAP tl, 0.8s expo.out | useGSAP scope on wrapper |
| Camera fly-through | GSAP scrub ScrollTrigger | scrub: 1.5 for smooth lag |
| Mesh idle float | `<Float>` Drei / useFrame sin | delta-based |
| Mesh idle rotation | `useFrame * delta` | never fixed constant |
| Particle drift | rotation.y += delta * 0.04 | slow, atmospheric |

## Quality Checklist

- [ ] `renderer.outputColorSpace = THREE.SRGBColorSpace` set on renderer
- [ ] `renderer.toneMapping = THREE.ACESFilmicToneMapping` set on renderer
- [ ] `dpr={[1, 2]}` on Canvas — pixel ratio capped
- [ ] `frameloop="demand"` for non-animated scenes
- [ ] `Suspense` wraps async content (GLTF, Environment, textures)
- [ ] `useFrame` uses `delta` — never frame-rate dependent constants
- [ ] GLTF preloaded with `useGLTF.preload()` at module level
- [ ] Scene has ambient + directional lights — never unlit
- [ ] `geometry.dispose()` + `material.dispose()` on unmount
- [ ] HTML overlays use Drei `<Html>` — not DOM elements outside Canvas
- [ ] `App.tsx` has `export default function App()`
