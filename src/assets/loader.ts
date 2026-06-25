import {
  AudioLoader,
  LoadingManager,
  Texture,
  TextureLoader,
} from "three/webgpu";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/Addons.js";
import type { AssetEntry, AssetManifest } from "./assets.manifest";

// ─── Type Utilities ──────────────────────────────────────────────────────────

/** Maps a single AssetEntry union member → its resolved runtime value */
type ResolvedEntry<E extends AssetEntry> = E extends { type: "texture" }
  ? Texture
  : E extends { type: "model" }
    ? GLTF
    : E extends { type: "audio" }
      ? AudioBuffer
      : never;

/**
 * Given the manifest shape, produce a record where every key maps to
 * the correct resolved runtime type.
 *
 *   { terrain: { type: "model"; url: "/models/terrain.glb" } }
 *   →  { terrain: GLTF }
 */
export type ResolvedManifest = {
  [K in keyof AssetManifest]: ResolvedEntry<AssetManifest[K]>;
};

// ─── Loader ──────────────────────────────────────────────────────────────────

export class Loader {
  assets: ResolvedManifest = {} as ResolvedManifest;

  private manager = new LoadingManager();
  private draco = new DRACOLoader(this.manager);
  private textureLoader = new TextureLoader(this.manager);
  private gltfLoader = new GLTFLoader(this.manager);
  private audioLoader = new AudioLoader(this.manager);

  constructor(onProgress?: (ratio: number) => void) {
    if (onProgress) {
      this.manager.onProgress = (_url, loaded, total) => {
        onProgress(total > 0 ? loaded / total : 1);
      };
    }

    this.draco.setDecoderConfig({ type: "js" });
    this.draco.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    this.gltfLoader.setDRACOLoader(this.draco);
  }

  async load(manifest: AssetManifest): Promise<void> {
    const promises = (Object.keys(manifest) as Array<keyof AssetManifest>).map(
      (key) => this.loadOne(key, manifest[key]),
    );
    await Promise.all(promises);
  }

  // entry is typed as AssetEntry — a proper discriminated union — so the
  // switch narrows correctly and .type / .url are always visible.
  private loadOne(key: keyof AssetManifest, entry: AssetEntry): Promise<void> {
    // Internal slot — cast to index by key without losing the public types.
    const slot = this.assets as Record<keyof AssetManifest, unknown>;

    return new Promise((resolve, reject) => {
      switch (entry.type) {
        case "texture":
          this.textureLoader.load(
            entry.url,
            (texture) => {
              slot[key] = texture;
              resolve();
            },
            undefined,
            reject,
          );
          break;

        case "model":
          this.gltfLoader.load(
            entry.url,
            (gltf) => {
              slot[key] = gltf;
              resolve();
            },
            undefined,
            reject,
          );
          break;

        case "audio":
          this.audioLoader.load(
            entry.url,
            (buffer) => {
              slot[key] = buffer;
              resolve();
            },
            undefined,
            reject,
          );
          break;

        default:
          // Exhaustiveness guard — add a new AssetEntry variant without
          // handling it here and TypeScript will surface an error.
          entry satisfies never;
          reject(
            new Error(`Unknown asset type: ${(entry as AssetEntry).type}`),
          );
      }
    });
  }

  /** Typed accessor — return type resolves to the exact runtime value. */
  get<K extends keyof AssetManifest>(key: K): ResolvedManifest[K] {
    return this.assets[key];
  }

  dispose(): void {
    for (const asset of Object.values(this.assets)) {
      if (asset instanceof Texture) asset.dispose();
    }
    this.assets = {} as ResolvedManifest;
  }
}
