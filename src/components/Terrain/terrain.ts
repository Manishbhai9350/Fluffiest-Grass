import {
  Box3,
  BufferGeometry,
  Color,
  ConstNode,
  InstancedMesh,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardNodeMaterial,
  Node,
  Object3D,
  Quaternion,
  RepeatWrapping,
  Texture,
  VarNode,
  Vector2,
  Vector3,
  WebGPURenderer,
  type Mesh,
  type Scene,
  type TextureEventMap,
} from "three/webgpu";
import { Debug } from "../../utils/debug";
import {
  Fn,
  mix,
  positionLocal,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  uv,
  vec4,
  vec3,
  mx_noise_float,
  mx_noise_vec3,
  mx_worley_noise_float,
  mx_cell_noise_float,
  mx_fractal_noise_float,
  time,
  vec2,
  sin,
  fract,
  step,
  float,
  floor,
} from "three/tsl";
import {
  BakeHeightmap,
  type HeightmapResult,
} from "../../sampler/gpu.bake.sampler";
import { readHeightmap, sampleGrid } from "./utils/sample.grid";
import type { ResolvedManifest } from "../../assets/loader";
import {
  mx_perlin_noise_float,
  mx_perlin_noise_vec3,
} from "three/src/nodes/materialx/lib/mx_noise.js";

export class Terrain {
  private terrainMesh: Mesh;
  private terrainMaterial: MeshStandardNodeMaterial;
  private scene: Scene;
  private debug: Debug;
  private renderer: WebGPURenderer;
  private assets: ResolvedManifest;

  private uniforms = {
    roughness: 0,
    metalness: 0,
    darkgrass: uniform(new Color("#2E5A1C")),
    // darkgrass: uniform( new Color("#0B6623")),
    grass: uniform(new Color("#85a02b")),
    sand: uniform(new Color("#d1984d")),
    deepsand: uniform(new Color("#6c514a")),
    m1Level: uniform(0),
    m2Level: uniform(0.25),

    // Bounds:
    uMinY: uniform(0),
    uMaxY: uniform(0),

    // Grass:
    uNoiseFrequency: uniform(0.5),
    uWindSpeed: uniform(.96), // how fast the pulse travels
    uWindFrequency: uniform(0.17), // spatial frequency — lower = wider gap
    uWindDuty: uniform(0.07), // pulse width as fraction of cycle (0.1 = short, 0.4 = long)
    uWindRamp: uniform(0.026),
    uWindGapVariation: uniform(1),
  };

  constructor(
    terrain: Mesh,
    scene: Scene,
    renderer: WebGPURenderer,
    assets: ResolvedManifest,
  ) {
    this.terrainMesh = terrain;
    this.scene = scene;
    this.renderer = renderer;
    this.assets = assets;

    this.terrainMesh.scale.setScalar(1.2);
    this.terrainMaterial = new MeshStandardNodeMaterial({
      side: 2,
    });

    this.terrainMaterial.colorNode = Fn(() => {
      const m1 = mix(
        this.uniforms.sand,
        this.uniforms.grass,
        smoothstep(0.18, 0.22, positionLocal.y),
      );

      m1.assign(
        mix(
          this.uniforms.deepsand,
          m1,
          smoothstep(0.13, 0.18, positionLocal.y),
        ),
      );

      return m1;
    })();

    this.terrainMesh.material = this.terrainMaterial;

    this.scene.add(this.terrainMesh);

    this.debug = Debug.getInstance();
    this.initTweeks();
    this.initTerrain();
  }

  private initTerrain() {
    // Terrain Mesh Heightmap Sampling
    const BakedHeightmap = BakeHeightmap(this.renderer, this.terrainMesh);

    const HeightMapRtTexture = BakedHeightmap.rt.texture;
    const HeightMap = texture(HeightMapRtTexture);

    this.initGrass(BakedHeightmap);
  }

  private async initGrass(HeightMap: HeightmapResult) {
    const HeightMapData = await readHeightmap(this.renderer, HeightMap);
    const GrassGrid = sampleGrid(HeightMapData, 250, 0.25);

    const GrassMesh = this.assets.grass_blade.scene.children[0] as Mesh;

    const GrassGeometry = GrassMesh.geometry;

    GrassGeometry.scale(0.1, 0.1, 0.1);

    const GrassMaterial = new MeshStandardNodeMaterial();

    this.assets.perlin.wrapS = this.assets.perlin.wrapT = RepeatWrapping;
    const perlinTexture = texture(this.assets.perlin);

    const perlin2d = Fn(([coords]: [Node<"vec2">]) => {
      return perlinTexture.sample(coords).x;
    });

    GrassMaterial.colorNode = Fn(() => {
      // ── wind pulse with gap variation ─────────────────────────────────────────
      const windOffset = positionWorld.x
        .add(positionWorld.z.mul(0.3))
        .add(time.mul(this.uniforms.uWindSpeed));

      // which "stripe band" are we in — integer index
      const stripeIndex = floor(windOffset.mul(this.uniforms.uWindFrequency));

      // random offset per stripe — breaks the regular spacing
      const stripeRandom = fract(sin(stripeIndex.mul(127.1)).mul(43758.5453));

      // extra random gap delay per stripe — multiplied by uWindGapVariation
      // so at 0 all gaps are equal, at 1 gaps vary wildly
      const gapOffset = stripeRandom.mul(this.uniforms.uWindGapVariation);

      // local position within the cycle, shifted by per-stripe random
      const cycle = fract(
        fract(windOffset.mul(this.uniforms.uWindFrequency)).add(gapOffset),
      );

      // pulse shape — same as before
      const inPulse = smoothstep(float(0), this.uniforms.uWindRamp, cycle).mul(
        smoothstep(
          this.uniforms.uWindDuty,
          this.uniforms.uWindDuty.sub(this.uniforms.uWindRamp),
          cycle,
        ),
      );

      // modulate with noise to break regularity
      const noise = perlin2d(
        positionWorld.xz
          .mul(this.uniforms.uNoiseFrequency.mul(0.5))
          .add(vec2(time.mul(0.1), float(0))),
      )
        .mul(0.5)
        .add(0.5);

      const wind = inPulse.mul(noise);

      // ── color ───────────────────────────────────────────────────────────────
      const blendedGrassColor = mix(
        vec3(0.42, 0.8, 0.09),
        vec3(0.24, 0.35, 0.02),
        uv().x, // bright tip → dark base
      );

      const finalColor = mix(
        blendedGrassColor,
        this.uniforms.darkgrass,
        wind, // dark where wind passes
      );

      // finalColor.assign(vec3(wind, 0, 0));

      return vec4(finalColor, 1.0);
    })();

    const InstancedGrass = new InstancedMesh(
      GrassGeometry,
      GrassMaterial,
      GrassGrid.length,
    );

    // const WUV = new Float32Array(GrassGrid.length * 2)

    const dummy = new Object3D();
    const up = new Vector3(0, 1, 0);
    const normal = new Vector3();
    const quat = new Quaternion();

    GrassGrid.forEach((sample, i) => {
      // normal.set(sample.normal.x, sample.normal.y, sample.normal.z).normalize();
      quat.setFromUnitVectors(up, normal);
      dummy.position.set(sample.x, sample.y, sample.z);
      dummy.quaternion.copy(quat);
      dummy.position.set(sample.x, sample.y, sample.z);
      dummy.quaternion.copy(quat);

      // random Y rotation so blades don't all face same direction
      dummy.rotateY(MathUtils.randFloat(0, Math.PI * 2));

      // slight scale variation per blade
      dummy.scale.setScalar(MathUtils.randFloat(0.8, 1.2));

      dummy.updateMatrix();
      InstancedGrass.setMatrixAt(i, dummy.matrix);
    });

    InstancedGrass.instanceMatrix.needsUpdate = true;

    this.scene.add(InstancedGrass);
  }
  private initTweeks() {
    // ── Terrain ──────────────────────────────────────────────────────────────
    this.debug.add({
      folder: "Terrain",
      object: this.uniforms,
      key: "roughness",
      options: { min: 0, max: 1 },
      onChange: (v) => {
        this.terrainMaterial.roughness = v as number;
      },
    });
    this.debug.add({
      folder: "Terrain",
      object: this.uniforms,
      key: "metalness",
      options: { min: 0, max: 1 },
      onChange: (v) => {
        this.terrainMaterial.metalness = v as number;
      },
    });
    this.debug.addColor({
      folder: "Terrain",
      initialColor: this.uniforms.grass.value,
      label: "Grass",
    });
    this.debug.addColor({
      folder: "Terrain",
      initialColor: this.uniforms.deepsand.value,
      label: "Sand",
    });

    // ── Grass Noise ───────────────────────────────────────────────────────────
    this.debug.add({
      folder: "Grass",
      object: this.uniforms.uNoiseFrequency,
      key: "value",
      options: { min: 0, max: 1, step: 0.01, label: "Noise Freq" },
    });

    // ── Wind ──────────────────────────────────────────────────────────────────
    this.debug.add({
      folder: "Grass",
      object: this.uniforms.uWindSpeed,
      key: "value",
      options: { min: 0, max: 5, step: 0.01, label: "Wind Speed" },
    });
    this.debug.add({
      folder: "Grass",
      object: this.uniforms.uWindFrequency,
      key: "value",
      options: { min: 0, max: 2, step: 0.01, label: "Wind Frequency" },
    });
    this.debug.add({
      folder: "Grass",
      object: this.uniforms.uWindDuty,
      key: "value",
      options: { min: 0.01, max: 0.99, step: 0.01, label: "Wind Duty" },
    });
    this.debug.add({
      folder: "Grass",
      object: this.uniforms.uWindRamp,
      key: "value",
      options: { min: 0.001, max: 0.2, step: 0.001, label: "Wind Ramp" },
    });
    this.debug.add({
      folder: "Grass",
      object: this.uniforms.uWindGapVariation,
      key: "value",
      options: { min: 0, max: 1, step: 0.01, label: "Wind Gap Variation" },
    });
  }

  update(delta: number) {}
}
