import {
  Box3,
  FloatType,
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
  // ── Bounds ────────────────────────────────────────────────────────────────
  const BakingTerrain = terrain.clone();
  const box = new Box3().setFromObject(BakingTerrain); // world space, no clone needed

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

  // ── Bake material ─────────────────────────────────────────────────────────
  const bakeMat = new MeshBasicNodeMaterial();
  bakeMat.colorNode = Fn(() => {
    return vec4(positionWorld.y, normalWorld.xyz); // R = raw world Y
  })();

  // ── Camera ────────────────────────────────────────────────────────────────
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  const cam = new OrthographicCamera(
    -width / 2,
    width / 2, // left, right
    depth / 2,
    -depth / 2, // top, bottom
    0,
    height + 1, // near, far
  );
  cam.position.set(cx, bounds.maxY + 0.5, cz);
  cam.lookAt(cx, bounds.minY, cz);
  cam.updateMatrixWorld();

  // ── Render target ─────────────────────────────────────────────────────────
  const rt = new RenderTarget(resolution, resolution, {
    depthBuffer: true,
    type: FloatType,
  });

  // ── Bake ──────────────────────────────────────────────────────────────────
  const prevMat = BakingTerrain.material;
  BakingTerrain.material = bakeMat;

  const bakeScene = new Scene();
  bakeScene.add(BakingTerrain);

  renderer.setRenderTarget(rt);
  renderer.render(bakeScene, cam);
  renderer.setRenderTarget(null);

  BakingTerrain.material = prevMat;
  bakeScene.remove(BakingTerrain);

  return { rt, bounds };
}
