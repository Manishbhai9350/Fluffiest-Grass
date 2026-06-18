import {
  Color,
  MeshStandardNodeMaterial,
  type Mesh,
  type Scene,
} from "three/webgpu";
import { Debug } from "../utils/debug";
import { Fn, mix, positionLocal, smoothstep, uniform } from "three/tsl";

export class Terrain {
  private terrainMesh: Mesh;
  private terrainMaterial: MeshStandardNodeMaterial;
  private scene: Scene;
  private debug: Debug;

  private uniforms = {
    roughness: 0,
    metalness: 0,
    grass: uniform(new Color("#85a02b")),
    sand: uniform(new Color("#d1984d")),
    deepsand: uniform(new Color("#6c514a")),
    m1Level: uniform(0),
    m2Level: uniform(0.25),
  };

  constructor(terrain: Mesh, scene: Scene) {
    this.terrainMesh = terrain;
    this.scene = scene;

    this.terrainMesh.scale.setScalar(0.8);
    this.scene.add(this.terrainMesh);
    this.terrainMaterial = new MeshStandardNodeMaterial();

    this.debug = Debug.getInstance();
    this.initTerrain();
    this.initTweeks();
  }

  private initTerrain() {
    this.terrainMesh.material = this.terrainMaterial;
    this.terrainMaterial.colorNode = Fn(() => {
      const m1 = mix(
        this.uniforms.sand,
        this.uniforms.grass,
        smoothstep(0.23, 0.27, positionLocal.y),
      );

      m1.assign(
        mix(this.uniforms.deepsand, m1, smoothstep(0.15, 0.2, positionLocal.y)),
      );
      return m1;
      //   return vec4(step(positionLocal.y, 0.2), 0, 0, 1);
    })();

    // this.terrainMaterial.positionNode = Fn(() => {

    //     return vec4(positionLocal.x,0.0,positionLocal.z,1.0);
    // })();
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
