import { Raycaster, Vector3, Mesh } from "three/webgpu";

export function RaycastSampler(
  terrain: Mesh,
  gridSize: number,          // e.g. 100 — samples per axis
  bounds: { min: Vector3; max: Vector3 }
): Float32Array {
  const raycaster = new Raycaster();

  const heights = new Float32Array(gridSize * gridSize);
  const origin = new Vector3();
  const dir = new Vector3(0, -1, 0);

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = bounds.min.x + (i / (gridSize - 1)) * (bounds.max.x - bounds.min.x);
      const z = bounds.min.z + (j / (gridSize - 1)) * (bounds.max.z - bounds.min.z);

      origin.set(x, bounds.max.y + 1, z);
      raycaster.set(origin, dir);

      const hits = raycaster.intersectObject(terrain, false);
      heights[i * gridSize + j] = hits[0]?.point.y ?? 0;
    }
  }

  return heights;
}