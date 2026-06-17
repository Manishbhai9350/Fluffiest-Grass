import "./style.css";

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  WebGPURenderer,
} from "three/webgpu";
import { PerspectiveCamera, Scene } from "three";
import { Clock } from "./Clock";
import { Assets } from "./assets/assets";
import { manifest } from "./assets/assets.manifest";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { Fn, positionLocal, step, vec4 } from "three/tsl";

// ── Scene ──────────────────────────────────────────────────────────────

class App {
  private renderer: WebGPURenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private controls: OrbitControls;
  private clock: Clock;
  private terrain: Mesh;
  private assets: Assets;
  private animFrameId: number = 0;
  private lastFrameTime = performance.now();
  private tickAccumulator = 0;

  // Bound once so dispose() can actually remove the same reference
  // that was added — the old version created a fresh arrow function
  // on each call, so the listener never got cleaned up.
  private onResize = () => this.resize();

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
    this.camera.position.set(-2, 2, 2);

    this.clock = new Clock();
    this.assets = new Assets();

    this.init();
  }

  private async init() {
    await Promise.all([this.renderer.init(), this.assets.load(manifest)]);
    this.resize();
    this.loop();

    console.log(this.assets.assets);

    this.terrain = this.assets.assets.terrain.scene
      .children[0] as unknown as Mesh;
    this.terrain.scale.setScalar(1);
    this.scene.add(this.terrain);

    this.terrain.material = new MeshStandardNodeMaterial();

    this.terrain.material.colorNode = Fn(() => {
      return vec4(step(positionLocal.y,.17),.0,.0, 1.0);
    })();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.scene.add(new AmbientLight(0xffffff, 0.5));

    const dir = new DirectionalLight(0xffffff, 2);
    dir.position.set(2, 2, 2);
    this.scene.add(dir);

    window.addEventListener("resize", this.onResize);
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

    const now = performance.now();
    const delta = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    // Throttled telemetry out to the UI — this is the engine "talking".
    this.tickAccumulator += delta;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
new App(canvas);
