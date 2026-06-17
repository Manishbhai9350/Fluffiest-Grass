import { Pane, FolderApi, type BindingParams } from "tweakpane";
import * as THREE from "three/webgpu";

// ── types ─────────────────────────────────────────────────────────────────────

type Bindable = Record<string, unknown>;

interface DebugBinding<T extends Bindable> {
  folder: string;
  object: T;
  key: keyof T & string;
  options?: BindingParams;
  onChange?: (value: T[keyof T]) => void;
}

interface DebugButton {
  folder: string;
  label: string;
  onClick: () => void;
}

interface DebugColor {
  folder: string;
  label: string;
  initialColor: THREE.Color; // ← now accepts Color directly
  onChange: (color: THREE.Color) => void;
}

interface DebugMonitor<T extends Bindable> {
  folder: string;
  object: T;
  key: keyof T & string;
  options?: BindingParams;
}

// ── singleton debug class ─────────────────────────────────────────────────────

export class Debug {
  private static instance: Debug | null = null;

  private pane!: Pane;
  private folders: Map<string, FolderApi> = new Map();
  private enabled: boolean;

  private constructor() {
    this.enabled = import.meta.env.DEV;
    if (!this.enabled) return;

    this.pane = new Pane({ title: "Debug", expanded: true });

    window.addEventListener("keydown", (e) => {
      if (e.key === "h") this.toggle();
    });
  }

  static getInstance(): Debug {
    if (!Debug.instance) {
      Debug.instance = new Debug();
    }
    return Debug.instance;
  }

  private getOrCreateFolder(name: string): FolderApi {
    if (this.folders.has(name)) return this.folders.get(name)!;
    const folder = this.pane.addFolder({ title: name, expanded: true });
    this.folders.set(name, folder);
    return folder;
  }

  add<T extends Bindable>({
    folder,
    object,
    key,
    options,
    onChange,
  }: DebugBinding<T>) {
    if (!this.enabled) return this;

    const f = this.getOrCreateFolder(folder);
    const binding = f.addBinding(object, key, options || undefined);

    if (onChange) {
      binding.on("change", (e) => onChange(e.value as T[keyof T]));
    }

    return this;
  }

  monitor<T extends Bindable>({
    folder,
    object,
    key,
    options,
  }: DebugMonitor<T>) {
    if (!this.enabled) return this;

    const f = this.getOrCreateFolder(folder);
    f.addBinding(object, key, { ...options, readonly: true } as never);

    return this;
  }

  button({ folder, label, onClick }: DebugButton) {
    if (!this.enabled) return this;

    const f = this.getOrCreateFolder(folder);
    f.addButton({ title: label }).on("click", onClick);

    return this;
  }

  addColor({ folder, label, initialColor, onChange }: DebugColor) {
    if (!this.enabled) return this;

    const f = this.getOrCreateFolder(folder);

    // use r,g,b directly from THREE.Color — no conversion needed
    const proxy: Record<string, { r: number; g: number; b: number }> = {
      [label]: { r: initialColor.r, g: initialColor.g, b: initialColor.b },
    };

    f.addBinding(proxy, label, { color: { type: "float" } }).on(
      "change",
      (e) => {
        const val = e.value as { r: number; g: number; b: number };
        // mutate the original color in place — keeps the reference alive
        initialColor.setRGB(val.r, val.g, val.b);
        onChange(initialColor);
      },
    );

    return this;
  }

  separator(folder: string) {
    if (!this.enabled) return this;
    this.getOrCreateFolder(folder).addBlade({ view: "separator" });
    return this;
  }

  toggle() {
    if (!this.enabled) return;
    const el = this.pane.element.parentElement;
    if (el) el.style.display = el.style.display === "none" ? "" : "none";
  }

  dispose() {
    if (!this.enabled) return;
    this.pane.dispose();
    this.folders.clear();
    Debug.instance = null;
  }
}
