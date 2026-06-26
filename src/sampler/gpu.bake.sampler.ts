import {
  Box3,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  RenderTarget,
  Scene,
  type Mesh,
  type WebGPURenderer,
} from "three/webgpu";
import { Fn, normalWorld, positionWorld, uniform, vec4 } from "three/tsl";

export interface HeightmapResult {
  /** The render target — pass rt.texture directly into your grass shader */
  rt: RenderTarget;
  /** Bounds used for the bake — keep these to reconstruct world positions */
  bounds: {
    minY: number;
    maxY: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export function BakeHeightmap(
  renderer: WebGPURenderer,
  terrain: Mesh,
  resolution = 512,
): HeightmapResult {
  // ── Bounds (world space, after scale/transforms are applied) ──────────────
  const ClonedTerrain = terrain.clone();
  ClonedTerrain.applyMatrix4(terrain.matrixWorld);
  const box = new Box3().setFromObject(ClonedTerrain);

  const bounds = {
    minX: box.min.x,
    maxX: box.max.x,
    minY: box.min.y,
    maxY: box.max.y,
    minZ: box.min.z,
    maxZ: box.max.z,
  };

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const height = bounds.maxY - bounds.minY;

  // ── Uniforms ──────────────────────────────────────────────────────────────
  const uMinY = uniform(bounds.minY);
  const uMaxY = uniform(bounds.maxY);

  // ── Bake material (TSL) ───────────────────────────────────────────────────
  // R  → normalised height  (0 → 1)
  // GBA → world-space normal packed to (0 → 1)
  const bakeMat = new MeshBasicNodeMaterial();
  bakeMat.colorNode = Fn(() => {
    const h = positionWorld.y.sub(uMinY).div(uMaxY.sub(uMinY));

    // pack normal [-1,1] → [0,1]
    const n = normalWorld.mul(0.5).add(0.5);

    return vec4(h, n.x, n.y, n.z);
  })();

  // ── Orthographic camera looking straight down ─────────────────────────────
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  const cam = new OrthographicCamera(
    -width / 2, // left
    width / 2, // right
    depth / 2, // top
    -depth / 2, // bottom
    0, // near
    height + 1, // far
  );
  cam.position.set(cx, bounds.maxY + 0.5, cz);
  cam.lookAt(cx, bounds.minY, cz);
  cam.updateMatrixWorld();

  // ── Render target ─────────────────────────────────────────────────────────
  const rt = new RenderTarget(resolution, resolution, {
    depthBuffer: true,
  });

  // ── Swap material → bake → restore ───────────────────────────────────────
  const prevMat = ClonedTerrain.material;
  ClonedTerrain.material = bakeMat;

  const bakeScene = new Scene();
  bakeScene.add(ClonedTerrain);

  renderer.setRenderTarget(rt);
  renderer.render(bakeScene, cam);
  renderer.setRenderTarget(null);

  ClonedTerrain.material = prevMat;
  bakeScene.remove(ClonedTerrain);

  return { rt, bounds };
}
