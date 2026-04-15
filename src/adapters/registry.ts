import type { Adapter } from "./types.js";

const adapters = new Map<string, Adapter>();

export function registerAdapter(adapter: Adapter): void {
  adapters.set(adapter.name, adapter);
}

export function getAdapter(name: string): Adapter {
  const adapter = adapters.get(name);
  if (!adapter) {
    throw new Error(`Adapter "${name}" not registered. Available: ${[...adapters.keys()].join(", ")}`);
  }
  return adapter;
}

export function listAdapters(): string[] {
  return [...adapters.keys()];
}
