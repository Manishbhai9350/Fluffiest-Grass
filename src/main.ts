import "./style.css";

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  WebGPURenderer,
} from "three/webgpu";
import { PerspectiveCamera, Scene } from "three";
import { Clock } from "./Clock";
import { manifest } from "./assets/assets.manifest";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { Terrain } from "./entities/terrain";
import { Loader, type ResolvedManifest } from "./assets/loader";

// ── Scene ──────────────────────────────────────────────────────────────

class App {
  controls: OrbitControls;
  terrain!: Terrain;
  private renderer: WebGPURenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private clock: Clock;
  private loader: Loader;
  private assets!: ResolvedManifest;
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
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.clock = new Clock();
    this.loader = new Loader();

    this.init();
  }

  private async init() {
    await Promise.all([this.renderer.init(), this.loader.load(manifest)]);

    this.assets = this.loader.assets;

    const TerrainScene = this.assets.terrain.scene as Group;
    const TerrainMesh = TerrainScene.children[0] as unknown as Mesh;
    this.terrain = new Terrain(TerrainMesh, this.scene, this.renderer);

    this.scene.add(new AmbientLight(0xffffff, 0.5));

    const dir = new DirectionalLight(0xffffff, 2);
    dir.position.set(2, 2, 2);

    const dir2 = new DirectionalLight(0xffffff, 1);
    dir2.position.set(0, 4, 0);
    this.scene.add(dir, dir2);

    this.resize();
    this.loop();

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

    this.terrain.update(delta);

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
