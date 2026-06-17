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

type AssetEntry =
  | { type: "texture"; url: string }
  | { type: "model"; url: string }
  | { type: "audio"; url: string };

export type AssetManifest = Record<string, AssetEntry>;

type LoadedAsset = Texture | GLTF | AudioBuffer;

/**
 * Flat asset store. Define a manifest once (see assets-manifest.ts),
 * call load(manifest), then read everything back off this.assets by
 * the key you gave it — this.assets.heroTexture, this.assets.bgMusic,
 * whatever. One loading pass, one place to look for what's loaded.
 *
 * Use the typed getters (getTexture/getModel/getAudio) at call sites
 * if you want the return type narrowed instead of casting yourself.
 */
export class Assets {
  assets: Record<string, LoadedAsset> = {};

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
    await Promise.all(
      Object.entries(manifest).map(([key, entry]) => this.loadOne(key, entry)),
    );
  }

  private loadOne(key: string, entry: AssetEntry): Promise<void> {
    switch (entry.type) {
      case "texture":
        return new Promise((resolve, reject) => {
          this.textureLoader.load(
            entry.url,
            (texture) => {
              this.assets[key] = texture;
              resolve();
            },
            undefined,
            reject,
          );
        });

      case "model":
        return new Promise((resolve, reject) => {
          this.gltfLoader.load(
            entry.url,
            (gltf) => {
              this.assets[key] = gltf;
              resolve();
            },
            undefined,
            reject,
          );
        });

      case "audio":
        return new Promise((resolve, reject) => {
          this.audioLoader.load(
            entry.url,
            (buffer) => {
              this.assets[key] = buffer;
              resolve();
            },
            undefined,
            reject,
          );
        });
    }
  }

  getTexture(key: string): Texture {
    return this.assets[key] as Texture;
  }

  getModel(key: string): GLTF {
    return this.assets[key] as GLTF;
  }

  getAudio(key: string): AudioBuffer {
    return this.assets[key] as AudioBuffer;
  }

  dispose() {
    for (const asset of Object.values(this.assets)) {
      if (asset instanceof Texture) asset.dispose();
      // GLTF scenes and AudioBuffers don't hold GPU/decoder resources
      // the same way — nothing to dispose there.
    }
    this.assets = {};
  }
}
