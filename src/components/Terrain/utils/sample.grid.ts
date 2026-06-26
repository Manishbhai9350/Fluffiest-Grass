import type { WebGPURenderer } from "three/webgpu";
import type { HeightmapResult } from "../../../sampler/gpu.bake.sampler";

export interface CellSample {
  x: number;
  y: number;
  z: number;
  normal: { x: number; y: number; z: number };
}

export interface HeightmapData {
  pixels: Float32Array;
  resolution: number;
  bounds: HeightmapResult["bounds"];
}

export async function readHeightmap(
  renderer: WebGPURenderer,
  result: HeightmapResult,
): Promise<HeightmapData> {
  const { rt, bounds } = result;
  const res = rt.width;

  const pixels = (await renderer.readRenderTargetPixelsAsync(
    rt,
    0,
    0,
    res,
    res,
  )) as Float32Array;

  return { pixels, resolution: res, bounds };
}

export function sampleGrid(
  data: HeightmapData,
  gridSize: number,
  heightThreshold: number, // real world Y, e.g. 0.5 means "above y=0.5"
): CellSample[] {
  const { pixels, resolution, bounds } = data;
  const samples: CellSample[] = [];

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const u = (i + 0.5) / gridSize;
      const v = (j + 0.5) / gridSize;

      const px = Math.floor(u * resolution);
      const py = Math.floor(v * resolution); // flip Y, bottom-left origin
      const idx = (py * resolution + px) * 4;

      const worldY = pixels[idx + 0]; // R — raw world Y, no reconstruction needed

      if (worldY < heightThreshold) continue;

      samples.push({
        x: bounds.minX + u * (bounds.maxX - bounds.minX),
        y: worldY, // ← direct
        z: bounds.minZ + v * (bounds.maxZ - bounds.minZ),
        normal: {
          x: pixels[idx + 1], // already [-1,1], no unpack needed
          y: pixels[idx + 2],
          z: pixels[idx + 3],
        },
      });
    }
  }

  return samples;
}
