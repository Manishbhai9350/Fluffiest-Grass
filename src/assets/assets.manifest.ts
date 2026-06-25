// Fill these in with your real paths. Empty by default so the starter
// runs with nothing to load. Example shape:

// ?? Example
// export const manifest: AssetManifest = {
//   heroTexture: { type: "texture", url: "/textures/hero.jpg" },
//   handModel: { type: "model", url: "/models/hand.glb" },
//   ambientTrack: { type: "audio", url: "/audio/ambient.mp3" },
// };
export type AssetEntry =
  | { type: "texture"; url: string }
  | { type: "model"; url: string }
  | { type: "audio"; url: string };

// ✅ Add 'as const' here
export const manifest = {
  terrain: { type: "model", url: "/models/terrain.glb" },
} as const;

// Now 'typeof manifest' preserves the literal "model" instead of widening to "string"
export type AssetManifest = typeof manifest;

export type keys = keyof typeof manifest;
