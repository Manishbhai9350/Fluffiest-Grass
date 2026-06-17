// ── Cube ──────────────────────────────────────────────────────────────────────

import { Mesh } from "three";
import { BoxGeometry, Color, Material, MeshBasicNodeMaterial, type Scene, type UniformNode } from "three/webgpu";
import { Debug } from "../utils/debug";
import { Fn, mix, normalWorld, uniform } from "three/tsl";
import type { Clock } from "../Clock";

export class Cube {
  mesh: Mesh;

  // ── correct types for TSL uniforms ───────────────────────────────────────────
  colorA: UniformNode<"color", Color>;
  colorB: UniformNode<"color", Color>;
  private debug: Debug;

  material: MeshBasicNodeMaterial;

  constructor(scene: Scene) {
    this.debug = Debug.getInstance();

    const geometry = new BoxGeometry(1, 1, 1);
    this.material = new MeshBasicNodeMaterial();

    this.colorA = uniform(new Color("#cd2f86"));
    this.colorB = uniform(new Color("#16cb19"));

    this.material.colorNode = Fn(() => {
      return mix(this.colorA, this.colorB, normalWorld.x);
    })();

    this.mesh = new Mesh(geometry, this.material);
    scene.add(this.mesh);

    this.initDebugs();
  }

  initDebugs() {
    this.debug.addColor({
      folder: "Cube",
      initialColor: this.colorA.value,
      label: "Color A",
      onChange: (color) => {
        this.colorA.value.set(color);
      },
    });
    this.debug.addColor({
      folder: "Cube",
      initialColor: this.colorB.value,
      label: "Color B",
      onChange: (color) => {
        this.colorB.value.set(color);
      },
    });
  }

  update(clock: Clock) {
    this.mesh.rotation.x = clock.getElapsedTime() * 0.5;
    this.mesh.rotation.y = clock.getElapsedTime() * 0.8;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as Material).dispose();
  }
}


