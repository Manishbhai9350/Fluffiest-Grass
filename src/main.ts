import "./style.css";

import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  UniformNode,
  WebGPURenderer,
} from "three/webgpu";
import {
  normalLocal,
  vec4,
  mix,
  dot,
  vec3,
  color,
  uniform,
  Fn,
  uv,
  normalWorld,
} from "three/tsl";
import { PerspectiveCamera, Scene, type Material } from "three";
import { Clock } from "./Clock";
import { Debug } from "./utils/debug";

// ── Cube ──────────────────────────────────────────────────────────────────────

class Cube {
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

// ── Scene ──────────────────────────────────────────────────────────────

class App {
  private renderer: WebGPURenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private clock: Clock;
  private cube: Cube;
  private animFrameId: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGPURenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    this.scene = new Scene();
    this.scene.background = new Color(0x0e0d0b);

    this.camera = new PerspectiveCamera(
      50,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100,
    );
    this.camera.position.set(0, 0, 3);

    this.clock = new Clock();
    this.cube = new Cube(this.scene);

    this.init();
  }

  private async init() {
    await this.renderer.init();
    this.resize();
    this.loop();

    window.addEventListener("resize", () => this.resize());
  }

  private resize() {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private loop() {
    this.animFrameId = requestAnimationFrame(() => this.loop());
    this.cube.update(this.clock);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", () => this.resize());
    this.cube.dispose();
    this.renderer.dispose();
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
new App(canvas);
