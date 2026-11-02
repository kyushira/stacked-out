import { Canvas, useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CONFIG } from '../config';
import { playEvents, setHeartbeatNoise } from '../audio';
import { LEVEL } from '../game/level';
import { advanceRun, type RunController } from '../ui/controller';
import { PALETTE } from './palette';
import { buildTileSet } from './tiles';

/**
 * Top-down orthographic view of the run. The sim is advanced inside useFrame on a fixed
 * timestep (advanceRun), then the meshes are synced from it. Nothing here mutates sim state.
 * Memoised: the HUD re-renders at ~10 Hz and must not re-reconcile the canvas each time.
 */
export const RunScene = memo(function RunScene({ ctrl }: { ctrl: RunController }) {
  return (
    <div className="play-canvas" aria-hidden="true">
      <Canvas orthographic dpr={[1, 2]} camera={{ position: [0, 0, 10], zoom: 30, near: 0.1, far: 100 }}>
        <color attach="background" args={[PALETTE.background]} />
        <World ctrl={ctrl} />
      </Canvas>
    </div>
  );
});

function World({ ctrl }: { ctrl: RunController }) {
  const tiles = useMemo(() => buildTileSet(LEVEL), []);
  useEffect(() => () => tiles.dispose(), [tiles]);

  const playerRef = useRef<THREE.Mesh>(null);
  const playerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const guardRef = useRef<THREE.Group>(null);
  const guardBodyRef = useRef<THREE.Mesh>(null);
  const guardMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const detectRef = useRef<THREE.Group>(null);
  const detectMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const artRef = useRef<THREE.Group>(null);
  const artMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef({ carry: false, chase: false });

  const start = LEVEL.start;
  const startX = start.c + 0.5;
  const startY = -(start.r + 0.5);

  useFrame((state, delta) => {
    advanceRun(ctrl, delta, playEvents);
    const s = ctrl.state;
    setHeartbeatNoise(s.noise);
    tiles.setFlooded(s.flooded);

    const px = s.player.x;
    const py = -s.player.y;
    const cam = state.camera as THREE.OrthographicCamera;
    cam.position.set(px, py, 10);
    const zoom = Math.min(state.size.width / CONFIG.cameraTilesWide, state.size.height / CONFIG.cameraTilesTall);
    if (zoom > 0 && cam.zoom !== zoom) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }

    playerRef.current?.position.set(px, py, 0.4);
    if (s.artifact.held !== shown.current.carry && playerMatRef.current) {
      shown.current.carry = s.artifact.held;
      playerMatRef.current.color.set(s.artifact.held ? PALETTE.playerCarry : PALETTE.player);
    }

    const chase = s.guardian.mode === 'chase';
    guardRef.current?.position.set(s.guardian.x, -s.guardian.y, 0.3);
    if (guardBodyRef.current) guardBodyRef.current.rotation.z = chase ? Math.PI / 4 : 0;
    if (chase !== shown.current.chase && guardMatRef.current && detectMatRef.current) {
      shown.current.chase = chase;
      guardMatRef.current.color.set(chase ? PALETTE.guardChase : PALETTE.guardPatrol);
      detectMatRef.current.color.set(chase ? PALETTE.detectChase : PALETTE.detectPatrol);
      detectMatRef.current.opacity = chase ? 0.16 : 0.07;
    }
    detectRef.current?.position.set(s.guardian.x, -s.guardian.y, 0.1);
    detectRef.current?.scale.setScalar(Math.max(0.01, s.detectRadius));

    const a = s.artifact;
    if (artRef.current) {
      artRef.current.visible = !a.held;
      artRef.current.position.set(a.c + 0.5, -(a.r + 0.5), 0.2);
    }
    if (artMatRef.current) artMatRef.current.opacity = 0.5 + 0.3 * Math.sin(state.clock.elapsedTime * 3);
  });

  return (
    <>
      <primitive object={tiles.group} />
      <mesh position={[startX, startY, 0.05]}>
        <ringGeometry args={[CONFIG.exitRadius * 0.7, CONFIG.exitRadius, 40]} />
        <meshBasicMaterial color={PALETTE.exit} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <group ref={artRef}>
        <mesh renderOrder={2}>
          <circleGeometry args={[CONFIG.artifactSize, 32]} />
          <meshBasicMaterial ref={artMatRef} color={PALETTE.artifact} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.36, 0.36]} />
          <meshBasicMaterial color={PALETTE.artifact} />
        </mesh>
      </group>
      <group ref={detectRef}>
        <mesh renderOrder={1}>
          <circleGeometry args={[1, 48]} />
          <meshBasicMaterial ref={detectMatRef} color={PALETTE.detectPatrol} transparent opacity={0.07} depthWrite={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.97, 1, 64]} />
          <meshBasicMaterial color={PALETTE.detectPatrol} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      </group>
      <group ref={guardRef}>
        <mesh ref={guardBodyRef}>
          <planeGeometry args={[CONFIG.guardianSize, CONFIG.guardianSize]} />
          <meshBasicMaterial ref={guardMatRef} color={PALETTE.guardPatrol} />
        </mesh>
      </group>
      <mesh ref={playerRef} renderOrder={3}>
        <circleGeometry args={[CONFIG.playerRadius, 28]} />
        <meshBasicMaterial ref={playerMatRef} color={PALETTE.player} />
      </mesh>
    </>
  );
}
