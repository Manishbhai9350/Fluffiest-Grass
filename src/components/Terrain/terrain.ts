import {
  Box3,
  BufferGeometry,
  Color,
  InstancedMesh,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  Quaternion,
  Texture,
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
  vec3
} from "three/tsl";
import {
  BakeHeightmap,
  type HeightmapResult,
} from "../../sampler/gpu.bake.sampler";
import { readHeightmap, sampleGrid } from "./utils/sample.grid";
import type { ResolvedManifest } from "../../assets/loader";

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
    grass: uniform(new Color("#85a02b")),
    sand: uniform(new Color("#d1984d")),
    deepsand: uniform(new Color("#6c514a")),
    m1Level: uniform(0),
    m2Level: uniform(0.25),

    // Bounds:
    uMinY: uniform(0),
    uMaxY: uniform(0),
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

    this.terrainMesh.scale.setScalar(0.8);
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
        mix(this.uniforms.deepsand, m1, smoothstep(0.13, 0.18, positionLocal.y)),
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
    const GrassGrid = sampleGrid(HeightMapData, 250, 0.2);

    const GrassMesh = this.assets.grass_blade.scene.children[0] as Mesh;

    const GrassGeometry = GrassMesh.geometry;

    GrassGeometry.scale(0.1, 0.1, 0.1);

    const GrassMaterial = new MeshStandardNodeMaterial();

    GrassMaterial.colorNode = Fn(() => {

      return vec4(mix(vec3(.42,.8,.09),vec3(.24,.35,.02),uv().y.oneMinus()),1.0);
    })();

    const InstancedGrass = new InstancedMesh(
      GrassGeometry,
      GrassMaterial,
      GrassGrid.length,
    );

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
    this.debug.add({
      folder: "Terrain",
      object: this.uniforms,
      key: "roughness",
      options: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        this.terrainMaterial.roughness = v as number;
      },
    });
    this.debug.add({
      folder: "Terrain",
      object: this.uniforms,
      key: "metalness",
      options: {
        min: 0,
        max: 1,
      },
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
  }

  update(delta: number) {}
}
