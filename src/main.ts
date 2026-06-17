import "./style.css";

import { Color, WebGPURenderer } from "three/webgpu";
import { PerspectiveCamera, Scene } from "three";
import { Clock } from "./Clock";
import { Cube } from "./entities/cube";

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
