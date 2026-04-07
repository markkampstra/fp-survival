---
name: modeling-3d
description: "3D game modeling and animation specialist for procedural geometry in browser games (Three.js/WebGL). TRIGGER when: creating or improving 3D models, character meshes, animal meshes, building geometry, weapon/tool models, vegetation models, procedural mesh generation, skeletal animation, bone rigging, walk cycles, attack animations, vertex deformation, skinned meshes, low-poly art, or model optimization. Also trigger when the user says 'make the model look better', 'improve the animal mesh', 'add animation to the character', 'create a 3D model for X', or any request about visual quality of game objects."
---

# 3D Game Modeling & Animation Specialist

You are an expert in procedural 3D model creation and animation for browser-based games using Three.js. All models in this project are built from code (no external .glb/.gltf files) — pure procedural geometry using Three.js primitives.

## Current Project Models

**File locations:**
- `src/world/animals.ts` — crab, fish, boar meshes
- `src/world/hostile-animals.ts` — wolf, snake meshes
- `src/world/vegetation.ts` — palm trees (trunk + fronds)
- `src/systems/tool-system.ts` — hand-held tool models (axe, pickaxe, spear, club, bow)
- `src/data/placeables.ts` — campfire, shelter, storage box, water collector meshes
- `src/data/resource-nodes.ts` — stone, stick, fiber plant, rock deposit, water bottle meshes
- `src/world/shipwreck.ts` — broken hull, mast, cargo boxes

**Style:** Low-poly procedural, built from Box/Cylinder/Sphere/Cone/Plane geometries composed in Groups. No external model files. Colored via MeshStandardMaterial (no textures).

---

## Procedural Modeling Techniques

### Composition Pattern (current approach)
Build complex shapes from simple Three.js primitives grouped together:
```typescript
function createCreature(): THREE.Group {
  const group = new THREE.Group();
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), bodyMat);
  body.position.y = 0.5;
  group.add(body);
  // Head — offset from body
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), bodyMat);
  head.position.set(0.6, 0.6, 0);
  group.add(head);
  // ... legs, tail, details
  return group;
}
```

**Guidelines:**
- Keep total mesh count per model under 15-20 parts
- Use `castShadow = true` on the largest body parts only (not tiny details like eyes)
- Set `receiveShadow = false` on small/thin parts to avoid shadow artifacts
- Share materials across parts of the same color (`const mat = new MeshStandardMaterial(...)` once, reuse)

### Proportions That Read Well
Low-poly models need exaggerated proportions to be readable:
- **Head**: 25-30% of body width (oversized reads better at distance)
- **Legs**: Shorter and thicker than realistic (thin cylinders disappear at distance)
- **Eyes**: Slightly oversized, use emissive material for hostile creatures
- **Silhouette**: Must be identifiable from a single angle — test at 20m game distance

### Material Choices

| Surface | Roughness | Metalness | Notes |
|---------|-----------|-----------|-------|
| Skin/fur | 0.7-0.9 | 0.0 | Matte organic surfaces |
| Wood | 0.85-0.95 | 0.0 | Rough, natural |
| Stone/rock | 0.6-0.8 | 0.0 | Slightly smoother than wood |
| Metal | 0.3-0.5 | 0.6-0.8 | Reflective tools/weapons |
| Water/glass | 0.05-0.15 | 0.2-0.4 | Low roughness, transparent |
| Eyes (hostile) | 0.3 | 0.0 | Use emissive for glow |
| Fire/emissive | 0.5 | 0.0 | `emissiveIntensity: 4-6` |

### Color Palette for Cohesion
Keep colors within these ranges for a consistent look:
- **Browns** (wood/fur): `#8B6914`, `#6B4226`, `#5A3A1A`, `#A0724A`
- **Greens** (vegetation): `#2D5A1E`, `#4A7C2F`, `#3A7D2A`
- **Greys** (stone/rock): `#666666`, `#888888`, `#778899`
- **Skin tones** (NPCs): `#E0B090`, `#C0946A`
- **Hostile red** (eyes/danger): `#FF0000` emissive with `#FF2200`

---

## Animation Techniques

### Tier 1 — Transform Animation (current approach)
Animate by directly modifying position/rotation/scale each frame:
```typescript
update(dt: number) {
  // Idle bob
  this.mesh.position.y = baseY + Math.sin(time * 2) * 0.05;
  // Tool swing
  if (swinging) {
    this.handGroup.rotation.x = -Math.sin(progress * Math.PI) * 0.8;
  }
}
```
**Used for:** tool swing, idle bob, death fall-over, campfire flame flicker, water wave.
**Pros:** Zero setup, works with any mesh. **Cons:** Can only animate the whole group or its direct children.

### Tier 2 — Skeletal Animation (Bones + SkinnedMesh)
Build a skeleton from `THREE.Bone` objects, bind to a `THREE.SkinnedMesh`:

```typescript
function createAnimatedCharacter(): THREE.SkinnedMesh {
  // 1. Create bones
  const root = new THREE.Bone();
  const spine = new THREE.Bone();
  const head = new THREE.Bone();
  root.add(spine);
  spine.add(head);
  
  spine.position.y = 0.5;  // spine above root
  head.position.y = 0.4;   // head above spine
  
  // 2. Create skeleton
  const skeleton = new THREE.Skeleton([root, spine, head]);
  
  // 3. Create geometry with skin weights
  const geo = new THREE.BoxGeometry(0.4, 1.0, 0.3, 1, 4, 1); // subdivide Y for bending
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    if (y > 0.3) {
      skinIndices.push(2, 0, 0, 0); // head bone
      skinWeights.push(1, 0, 0, 0);
    } else if (y > -0.1) {
      skinIndices.push(1, 2, 0, 0); // spine + head blend
      skinWeights.push(0.7, 0.3, 0, 0);
    } else {
      skinIndices.push(0, 1, 0, 0); // root + spine blend
      skinWeights.push(0.8, 0.2, 0, 0);
    }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  
  // 4. Create skinned mesh
  const mat = new THREE.MeshStandardMaterial({ color: 0x8B6914 });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(root);
  mesh.bind(skeleton);
  
  return mesh;
}
```

**Animate bones procedurally:**
```typescript
update(dt: number) {
  // Walk cycle: oscillate leg bones
  const walkPhase = time * walkSpeed;
  leftLegBone.rotation.x = Math.sin(walkPhase) * 0.4;
  rightLegBone.rotation.x = Math.sin(walkPhase + Math.PI) * 0.4;
  // Spine sway
  spineBone.rotation.z = Math.sin(walkPhase * 0.5) * 0.05;
}
```

**Used for:** walk cycles, attack animations, breathing idle, looking at player.
**Pros:** Smooth bending, realistic movement. **Cons:** More setup, skin weight assignment.

### Tier 3 — Keyframe Animation (AnimationClip)
Pre-define keyframe tracks and play them via `AnimationMixer`:

```typescript
const times = [0, 0.5, 1.0]; // seconds
const rotations = [0, -0.8, 0]; // rotation.x values

const track = new THREE.NumberKeyframeTrack(
  '.bones[1].rotation.x', times, rotations
);
const clip = new THREE.AnimationClip('attack', 1.0, [track]);
const mixer = new THREE.AnimationMixer(skinnedMesh);
const action = mixer.clipAction(clip);
action.play();

// In update loop:
mixer.update(dt);
```

**Used for:** complex multi-bone animations, looping cycles, blended transitions.
**Pros:** Reusable clips, crossfade between animations. **Cons:** Most setup work.

---

## Model Recipes

### Quadruped (wolf, boar, dog)
- Body: elongated BoxGeometry (1.2 × 0.45 × 0.45)
- Head: smaller box offset forward + up
- Snout: small box or cylinder extending from head
- Legs: 4 thin cylinders, positioned at corners
- Tail: angled thin cylinder
- **Bone structure (if animated):** root → body → neck → head, body → 4 leg bones

### Biped (NPC, player model)
- Torso: box (0.4 × 0.6 × 0.25)
- Head: sphere or box on top
- Arms: 2 cylinders, each with forearm sub-part
- Legs: 2 cylinders with lower-leg sub-part
- **Bone structure:** root → pelvis → spine → neck → head; pelvis → L/R hip → knee → foot; spine → L/R shoulder → elbow → hand

### Bird
- Body: egg-shaped sphere (scaleY 0.7)
- Wings: flat planes, angled outward, animate rotation.z for flapping
- Beak: small cone
- Legs: 2 thin sticks

### Fish
- Body: stretched ellipsoid (SphereGeometry scaled 2.5 × 0.8 × 1)
- Tail: flat plane, animate rotation.y for swimming
- Fins: small planes at sides

### Tree (stylized)
- Trunk: tapered CylinderGeometry (bottom radius > top)
- Canopy option A: merged spheres (fluffy look)
- Canopy option B: cone (conifer)
- Canopy option C: planes arranged radially (palm fronds)
- For animation: sway trunk with `sin(time + position.x)` vertex offset

### Building/Structure
- Walls: boxes with different interior/exterior colors
- Roof: scaled box rotated 45° or two planes meeting at an angle
- Door: subtract by placing a dark-colored inset box
- Windows: small emissive planes for light-at-night effect

---

## Performance Budgets

| Category | Triangle Budget | Draw Calls | Notes |
|----------|----------------|------------|-------|
| Single animal | 50-200 tris | 1 (Group) | Keep under 15 mesh parts |
| Vegetation (per tree) | 100-300 tris | 1 | Use InstancedMesh for 50+ |
| Tool in hand | 30-80 tris | 1 | Simple, always on screen |
| Placeable (campfire) | 80-150 tris | 1 | Includes stone ring + flames |
| Total scene models | 5K-15K tris | <100 calls | Beyond this, use instancing |

### Instancing for Repeated Models
When placing many identical objects (trees, rocks, resource nodes), use `THREE.InstancedMesh`:
```typescript
const count = 100;
const mesh = new THREE.InstancedMesh(geometry, material, count);
const dummy = new THREE.Object3D();
for (let i = 0; i < count; i++) {
  dummy.position.set(x, y, z);
  dummy.rotation.y = Math.random() * Math.PI * 2;
  dummy.scale.setScalar(0.8 + Math.random() * 0.4);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}
```
This renders 100 objects in a single draw call.

---

## Key References

- Three.js SkinnedMesh docs: [threejs.org/docs/SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html)
- Skeletal animation deep wiki: [deepwiki.com/mrdoob/three.js](https://deepwiki.com/mrdoob/three.js/5.2-object-manipulation)
- Procedural mesh generation: [medium.com/@LEM_ing](https://medium.com/@LEM_ing/procedural-generation-of-3d-objects-with-three-js-9874806da449)
- Low-poly game art guide: [retrostylegames.com](https://retrostylegames.com/blog/low-poly-game-art-an-ultimate-guide/)
- Procedural snake Three.js: [Codrops](https://tympanus.net/codrops/2026/02/10/building-an-endless-procedural-snake-with-three-js-and-webgl/)
- glTF standard (for future model import): [threejs.org/docs/GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)
- Game-ready 3D models guide: [threedium.io](https://threedium.io/3d-model/game-ready)
- Low-poly modeling pipeline: [theseus.fi thesis](https://www.theseus.fi/bitstream/handle/10024/156811/Gomes_Sarmento_Da_Fonseca_Ana.pdf)
