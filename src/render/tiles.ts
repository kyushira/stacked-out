import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Level, TileKind } from '../game/level';
import type { FloodedTile } from '../game/sim';
import { PALETTE } from './palette';

/**
 * One InstancedMesh per visual tile kind. World space: tile (c, r) is centred at
 * (c + 0.5, -(r + 0.5)), so row numbers grow downward on screen like the sim.
 */
export interface TileSet {
  group: THREE.Group;
  /** Tints flood-able tiles blue while the sim has them flooded. No-op when unchanged. */
  setFlooded(flooded: readonly FloodedTile[]): void;
  dispose(): void;
}

type Kind = 'wall' | 'floor' | 'creak' | 'flood' | 'start';
const KINDS: readonly Kind[] = ['wall', 'floor', 'creak', 'flood', 'start'];

const KIND_COLOUR: Record<Kind, string> = {
  wall: PALETTE.wall,
  floor: PALETTE.floor,
  creak: PALETTE.creak,
  flood: PALETTE.floorFlood,
  start: PALETTE.start,
};

/** Spots and waypoints look like plain floor; the artifact and guardian are drawn separately. */
function kindOf(t: TileKind): Kind {
  switch (t) {
    case 'wall':
    case 'creak':
    case 'flood':
    case 'start':
      return t;
    default:
      return 'floor';
  }
}

export function buildTileSet(level: Level): TileSet {
  const byKind = new Map<Kind, number[]>(KINDS.map((k) => [k, []]));
  level.tiles.forEach((t, i) => byKind.get(kindOf(t))!.push(i));

  const geometry = new THREE.PlaneGeometry(1, 1);
  const group = new THREE.Group();
  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(CONFIG.tileInset, CONFIG.tileInset, 1);
  const dry = new THREE.Color(PALETTE.floorFlood);
  const wet = new THREE.Color(PALETTE.flooded);

  const materials: THREE.Material[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  let floodMesh: THREE.InstancedMesh | null = null;
  const floodSlot = new Map<number, number>(); // tile index -> instance index

  for (const kind of KINDS) {
    const tiles = byKind.get(kind)!;
    if (tiles.length === 0) continue;
    const mat = new THREE.MeshBasicMaterial({ color: KIND_COLOUR[kind] });
    const mesh = new THREE.InstancedMesh(geometry, mat, tiles.length);
    tiles.forEach((tile, n) => {
      pos.set((tile % level.width) + 0.5, -(Math.floor(tile / level.width) + 0.5), 0);
      matrix.compose(pos, quat, scale);
      mesh.setMatrixAt(n, matrix);
      if (kind === 'flood') {
        mesh.setColorAt(n, dry);
        floodSlot.set(tile, n);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (kind === 'flood') {
      floodMesh = mesh;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    materials.push(mat);
    meshes.push(mesh);
    group.add(mesh);
  }

  let lastKey = '';
  return {
    group,
    setFlooded(flooded) {
      if (!floodMesh) return;
      const key = flooded.map((f) => `${f.c},${f.r}`).sort().join(';');
      if (key === lastKey) return;
      lastKey = key;
      floodSlot.forEach((slot) => floodMesh!.setColorAt(slot, dry));
      for (const f of flooded) {
        const slot = floodSlot.get(f.r * level.width + f.c);
        if (slot !== undefined) floodMesh!.setColorAt(slot, wet);
      }
      if (floodMesh.instanceColor) floodMesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      for (const m of materials) m.dispose();
      for (const m of meshes) m.dispose();
    },
  };
}
