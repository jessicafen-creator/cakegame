import React, { useEffect, useRef } from 'react';
import { BakeryAudioEngine } from './audioEngine';
import {
  CAKE_LAYERS,
  drawCakeBlock,
  drawCakePedestal,
  pickLayerForFloor,
} from './cakeRoster';
import {
  CakeLayerDef,
  CakeLayerId,
  FallingSlice,
  FloatingCallout,
  GameState,
  HudSnapshot,
  Particle,
  StackedBlock,
} from './types';

interface CakeStackCanvasProps {
  gameState: GameState;
  runId: number;
  audio: BakeryAudioEngine;
  bestScore: number;
  bestFloors: number;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onGameOver: (finalSnapshot: HudSnapshot) => void;
}

const INITIAL_CAKE_WIDTH = 194;
const MAX_EXPANDED_WIDTH = INITIAL_CAKE_WIDTH + 46;
const CAKE_HEIGHT = 42;
const ROPE_LENGTH = 205;
const MAX_SWING_ANGLE = 0.58;
const GRAVITY = 2650;
const PARTICLE_POOL_SIZE = 120;
const INITIAL_SHIELDS = 1;
const MAX_SHIELDS = 2;

type DropPhase = 'swing' | 'dropping' | 'missing' | 'ended';

interface EngineState {
  phase: DropPhase;
  blocks: StackedBlock[];
  slices: FallingSlice[];
  particles: Particle[];
  callouts: FloatingCallout[];
  nextId: number;

  // Pendulum & active falling cake
  swingPhase: number;
  swingAngle: number;
  activeCakeX: number;
  activeCakeY: number;
  activeCakeTilt: number;
  dropVy: number;
  activeWidth: number;
  currentLayer: CakeLayerDef;
  nextLayer: CakeLayerDef;

  // Score & progression
  score: number;
  floors: number;
  combo: number;
  maxCombo: number;
  shields: number;
  stackedFlavorIds: Set<CakeLayerId>;
  isNewRecord: boolean;

  // Camera & juice
  cameraY: number;
  targetCameraY: number;
  shakeTime: number;
  shakeMag: number;
  hitstopTimer: number;
  missTimer: number;
  perfectFlashAlpha: number;
  perfectFlashY: number;
  shieldFlashAlpha: number;
  shieldFlashY: number;
  ropeSnapRecoil: number;
  releaseLockTimer: number;
}

function createParticlePool(): Particle[] {
  return Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 4,
    color: '#F5B52E',
    alpha: 1,
    life: 0,
    maxLife: 0.6,
    shape: 'circle',
    rotation: 0,
    rotSpeed: 0,
  }));
}

export const CakeStackCanvas: React.FC<CakeStackCanvasProps> = ({
  gameState,
  runId,
  audio,
  bestScore,
  bestFloors,
  onHudUpdate,
  onGameOver,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const bestRef = useRef({ score: bestScore, floors: bestFloors });
  const callbacksRef = useRef({ onHudUpdate, onGameOver });

  gameStateRef.current = gameState;
  bestRef.current = { score: bestScore, floors: bestFloors };
  callbacksRef.current = { onHudUpdate, onGameOver };

  const engineRef = useRef<EngineState | null>(null);

  const buildInitialEngine = (): EngineState => {
    const baseLayer = CAKE_LAYERS.chocolate_cream;
    const floor1Layer = pickLayerForFloor(1, baseLayer.id);
    const floor2Layer = pickLayerForFloor(2, floor1Layer.id);

    const baseBlock: StackedBlock = {
      id: 1,
      x: 0,
      y: 0,
      width: INITIAL_CAKE_WIDTH,
      height: CAKE_HEIGHT + 4,
      layer: baseLayer,
      squashTime: 0,
      isPerfect: false,
      isBase: true,
    };

    return {
      phase: 'swing',
      blocks: [baseBlock],
      slices: [],
      particles: createParticlePool(),
      callouts: [],
      nextId: 2,
      swingPhase: -Math.PI * 0.35,
      swingAngle: 0,
      activeCakeX: 0,
      activeCakeY: 400,
      activeCakeTilt: 0,
      dropVy: 0,
      activeWidth: INITIAL_CAKE_WIDTH,
      currentLayer: floor1Layer,
      nextLayer: floor2Layer,
      score: 0,
      floors: 0,
      combo: 0,
      maxCombo: 0,
      shields: INITIAL_SHIELDS,
      stackedFlavorIds: new Set<CakeLayerId>(),
      isNewRecord: false,
      cameraY: 0,
      targetCameraY: 0,
      shakeTime: 0,
      shakeMag: 0,
      hitstopTimer: 0,
      missTimer: 0,
      perfectFlashAlpha: 0,
      perfectFlashY: 0,
      shieldFlashAlpha: 0,
      shieldFlashY: 0,
      ropeSnapRecoil: 0,
      releaseLockTimer: 0.12,
    };
  };

  // Emit HUD snapshot helper
  const emitHud = (eng: EngineState) => {
    const newRec =
      eng.score > bestRef.current.score || eng.floors > bestRef.current.floors;
    if (newRec) eng.isNewRecord = true;

    callbacksRef.current.onHudUpdate({
      score: eng.score,
      floors: eng.floors,
      combo: eng.combo,
      maxCombo: eng.maxCombo,
      bestScore: Math.max(bestRef.current.score, eng.score),
      bestFloors: Math.max(bestRef.current.floors, eng.floors),
      widthPercent: Math.round((eng.activeWidth / INITIAL_CAKE_WIDTH) * 100),
      shields: eng.shields,
      maxShields: MAX_SHIELDS,
      nextExpandIn: 3 - (eng.floors % 3),
      currentLayer: eng.currentLayer,
      nextLayer: eng.nextLayer,
      stackedFlavorIds: Array.from(eng.stackedFlavorIds),
      isNewRecord: eng.isNewRecord,
    });
  };

  // Reset engine on new runId
  useEffect(() => {
    const fresh = buildInitialEngine();
    engineRef.current = fresh;
    emitHud(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // Trigger drop action
  const triggerDrop = () => {
    const eng = engineRef.current;
    if (!eng) return;
    if (gameStateRef.current !== 'PLAYING') return;
    if (eng.phase !== 'swing' || eng.releaseLockTimer > 0) return;

    eng.phase = 'dropping';
    eng.dropVy = -110;
    eng.ropeSnapRecoil = 1;
    audio.playRelease();
  };

  // Keyboard bindings (Space / Enter to drop during PLAYING)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (
        gameStateRef.current === 'PLAYING' &&
        (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown')
      ) {
        e.preventDefault();
        triggerDrop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main 60fps simulation & render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!engineRef.current) {
      engineRef.current = buildInitialEngine();
    }

    let animationFrameId = 0;
    let lastTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (
        canvas.width !== Math.floor(width * dpr) ||
        canvas.height !== Math.floor(height * dpr)
      ) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const spawnParticles = (
      eng: EngineState,
      x: number,
      y: number,
      count: number,
      color: string,
      shape: 'circle' | 'sparkle' | 'crumb',
      speedScale = 1
    ) => {
      let spawned = 0;
      for (let i = 0; i < eng.particles.length && spawned < count; i++) {
        const p = eng.particles[i];
        if (!p.active) {
          p.active = true;
          p.x = x + (Math.random() - 0.5) * 26;
          p.y = y + (Math.random() - 0.5) * 8;
          const angle = Math.random() * Math.PI;
          const speed = (60 + Math.random() * 170) * speedScale;
          p.vx = Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1);
          p.vy = Math.sin(angle) * speed + 40;
          p.size = shape === 'sparkle' ? 4 + Math.random() * 4.5 : 3 + Math.random() * 3.5;
          p.color = color;
          p.alpha = 1;
          p.life = 0;
          p.maxLife = 0.45 + Math.random() * 0.4;
          p.shape = shape;
          p.rotation = Math.random() * Math.PI * 2;
          p.rotSpeed = (Math.random() - 0.5) * 9;
          spawned++;
        }
      }
    };

    const getViewportMetrics = (w: number, h: number) => {
      const worldScale = Math.max(
        0.74,
        Math.min(1.16, Math.min(w / 400, h / 740))
      );
      const groundScreenY = h * 0.80;
      const pivotScreenY = Math.max(10, 14 * worldScale);
      return { worldScale, groundScreenY, pivotScreenY };
    };

    const handleLanding = (eng: EngineState) => {
      const topBlock = eng.blocks[eng.blocks.length - 1];
      const topSurfaceY = topBlock.y + topBlock.height;
      const deltaX = eng.activeCakeX - topBlock.x;
      const absDelta = Math.abs(deltaX);

      const perfectTolerance = Math.max(
        5.5,
        Math.min(9.5, topBlock.width * 0.055)
      );

      // Compute overlap interval
      const fallLeft = eng.activeCakeX - eng.activeWidth / 2;
      const fallRight = eng.activeCakeX + eng.activeWidth / 2;
      const prevLeft = topBlock.x - topBlock.width / 2;
      const prevRight = topBlock.x + topBlock.width / 2;

      const overlapLeft = Math.max(fallLeft, prevLeft);
      const overlapRight = Math.min(fallRight, prevRight);
      const overlapWidth = overlapRight - overlapLeft;

      // Case 1: Complete Miss -> Shield prevents Game Over, otherwise Game Over
      if (overlapWidth <= 5) {
        if (eng.shields > 0) {
          eng.shields -= 1;
          eng.combo = 0;
          eng.shieldFlashAlpha = 1;
          eng.shieldFlashY = topSurfaceY;
          eng.shakeTime = 0.18;
          eng.shakeMag = 4.2;

          spawnParticles(
            eng,
            eng.activeCakeX,
            topSurfaceY + 8,
            18,
            '#38BDF8',
            'sparkle',
            1.15
          );
          eng.callouts.push({
            id: eng.nextId++,
            text: '防護盾發動！',
            subtext: '擋下失誤 · 繼續疊高',
            x: topBlock.x,
            y: topSurfaceY + CAKE_HEIGHT + 22,
            life: 0,
            maxLife: 1.1,
            color: '#0284C7',
          });

          audio.playShieldBlock();
          eng.phase = 'swing';
          eng.releaseLockTimer = 0.22;
          emitHud(eng);
          return;
        }

        eng.phase = 'missing';
        eng.missTimer = 0.52;
        eng.shakeTime = 0.28;
        eng.shakeMag = 7.5;
        eng.slices.push({
          x: eng.activeCakeX,
          y: topSurfaceY,
          width: eng.activeWidth,
          height: CAKE_HEIGHT,
          vx: deltaX >= 0 ? 65 : -65,
          vy: -140,
          angle: deltaX >= 0 ? 0.12 : -0.12,
          angularVel: deltaX >= 0 ? 3.4 : -3.4,
          layer: eng.currentLayer,
          alpha: 1,
        });
        audio.playGameOver();
        return;
      }

      let landedX = (overlapLeft + overlapRight) / 2;
      let landedWidth = overlapWidth;
      let isPerfect = false;

      if (absDelta <= perfectTolerance) {
        // Case 2: Perfect Alignment!
        isPerfect = true;
        landedX = topBlock.x;
        landedWidth = topBlock.width;
        eng.combo += 1;
        eng.maxCombo = Math.max(eng.maxCombo, eng.combo);

        let recovered = false;
        if (eng.combo >= 3 && landedWidth < INITIAL_CAKE_WIDTH) {
          const boost = Math.min(12, INITIAL_CAKE_WIDTH - landedWidth);
          landedWidth += boost;
          recovered = boost > 0.5;
        }

        const gained = 100 + eng.combo * 35;
        eng.score += gained;
        eng.hitstopTimer = 0.038;
        eng.perfectFlashAlpha = 1;
        eng.perfectFlashY = topSurfaceY + CAKE_HEIGHT * 0.5;

        if (recovered) {
          audio.playWidthRecover();
          eng.callouts.push({
            id: eng.nextId++,
            text: `完美連擊 ×${eng.combo}`,
            subtext: '蛋糕微幅回寬！',
            x: landedX,
            y: topSurfaceY + CAKE_HEIGHT + 18,
            life: 0,
            maxLife: 1.05,
            color: '#D97706',
          });
          spawnParticles(eng, landedX, topSurfaceY + 12, 22, '#FBBF24', 'sparkle', 1.3);
        } else {
          audio.playLand(eng.currentLayer.textureType, true, eng.combo);
          eng.callouts.push({
            id: eng.nextId++,
            text: eng.combo >= 2 ? `完美連擊 ×${eng.combo}` : '完美對齊！',
            subtext: `+${gained}`,
            x: landedX,
            y: topSurfaceY + CAKE_HEIGHT + 16,
            life: 0,
            maxLife: 0.9,
            color: '#C26A0A',
          });
          spawnParticles(eng, landedX, topSurfaceY + 10, 16, '#F59E0B', 'sparkle', 1.1);
        }
      } else {
        // Case 3: Partial overlap -> Slice overhang!
        eng.combo = 0;
        const ratio = landedWidth / topBlock.width;
        const gained = Math.max(20, Math.round(70 * ratio));
        eng.score += gained;
        eng.shakeTime = 0.14;
        eng.shakeMag = 3.2;

        // Spawn sliced piece falling off edge
        if (fallLeft < prevLeft) {
          const cutWidth = prevLeft - fallLeft;
          const cutCenter = (fallLeft + prevLeft) / 2;
          eng.slices.push({
            x: cutCenter,
            y: topSurfaceY,
            width: cutWidth,
            height: CAKE_HEIGHT,
            vx: -78 - Math.random() * 40,
            vy: 45,
            angle: -0.05,
            angularVel: -3.2 - Math.random() * 1.6,
            layer: eng.currentLayer,
            alpha: 1,
          });
          spawnParticles(
            eng,
            prevLeft,
            topSurfaceY + CAKE_HEIGHT * 0.4,
            10,
            eng.currentLayer.particleColor,
            'crumb',
            0.9
          );
        }
        if (fallRight > prevRight) {
          const cutWidth = fallRight - prevRight;
          const cutCenter = (prevRight + fallRight) / 2;
          eng.slices.push({
            x: cutCenter,
            y: topSurfaceY,
            width: cutWidth,
            height: CAKE_HEIGHT,
            vx: 78 + Math.random() * 40,
            vy: 45,
            angle: 0.05,
            angularVel: 3.2 + Math.random() * 1.6,
            layer: eng.currentLayer,
            alpha: 1,
          });
          spawnParticles(
            eng,
            prevRight,
            topSurfaceY + CAKE_HEIGHT * 0.4,
            10,
            eng.currentLayer.particleColor,
            'crumb',
            0.9
          );
        }

        audio.playLand(eng.currentLayer.textureType, false, 0);
        audio.playSlice();

        eng.callouts.push({
          id: eng.nextId++,
          text: `+${gained}`,
          x: landedX,
          y: topSurfaceY + CAKE_HEIGHT + 12,
          life: 0,
          maxLife: 0.65,
          color: '#5C3422',
        });
      }

      eng.floors += 1;
      eng.stackedFlavorIds.add(eng.currentLayer.id);

      // Every 3 completed layers, automatically widen the supporting lower layer
      let finalTargetWidth = landedWidth;
      if (eng.floors % 3 === 0) {
        const expanded = Math.min(MAX_EXPANDED_WIDTH, landedWidth + 26);
        if (expanded > landedWidth + 0.5) {
          finalTargetWidth = expanded;
          audio.playWidthRecover();
          spawnParticles(
            eng,
            landedX - expanded / 2,
            topSurfaceY + CAKE_HEIGHT * 0.5,
            10,
            '#FBBF24',
            'sparkle',
            1.1
          );
          spawnParticles(
            eng,
            landedX + expanded / 2,
            topSurfaceY + CAKE_HEIGHT * 0.5,
            10,
            '#FBBF24',
            'sparkle',
            1.1
          );
          eng.callouts.push({
            id: eng.nextId++,
            text: `完成 ${eng.floors} 層！`,
            subtext: '下層自動增加寬度',
            x: landedX,
            y: topSurfaceY + CAKE_HEIGHT + 36,
            life: 0,
            maxLife: 1.15,
            color: '#B45309',
          });
        }
      }

      // Replenish 1 shield every 6 floors (up to MAX_SHIELDS)
      if (eng.floors % 6 === 0 && eng.shields < MAX_SHIELDS) {
        eng.shields += 1;
        eng.callouts.push({
          id: eng.nextId++,
          text: '獲得防護盾 +1',
          x: landedX,
          y: topSurfaceY + CAKE_HEIGHT + 58,
          life: 0,
          maxLife: 1.15,
          color: '#0284C7',
        });
      }

      // Push landed block (width smoothly animates to targetWidth if expanded)
      eng.blocks.push({
        id: eng.nextId++,
        x: landedX,
        y: topSurfaceY,
        width: landedWidth,
        targetWidth: finalTargetWidth,
        height: CAKE_HEIGHT,
        layer: eng.currentLayer,
        squashTime: 0.24,
        isPerfect,
      });

      eng.activeWidth = finalTargetWidth;

      // Advance to next layer flavor
      const upcomingFloor = eng.floors + 2;
      eng.currentLayer = eng.nextLayer;
      eng.nextLayer = pickLayerForFloor(upcomingFloor, eng.currentLayer.id);

      eng.phase = 'swing';
      eng.releaseLockTimer = 0.16;

      emitHud(eng);
    };

    const stepPhysics = (dt: number, w: number, h: number) => {
      const eng = engineRef.current;
      if (!eng) return;

      const { worldScale, groundScreenY, pivotScreenY } = getViewportMetrics(w, h);

      // Always keep targetCameraY anchored smoothly above the top block
      const topBlock = eng.blocks[eng.blocks.length - 1];
      const topWorldY = topBlock.y + topBlock.height;
      const desiredTopScreenY = h * 0.61;
      const neededCamY =
        topWorldY - (groundScreenY - desiredTopScreenY) / worldScale;
      eng.targetCameraY = Math.max(0, neededCamY);
      eng.cameraY += (eng.targetCameraY - eng.cameraY) * Math.min(1, dt * 5.8);

      // Update hitstop
      if (eng.hitstopTimer > 0) {
        eng.hitstopTimer = Math.max(0, eng.hitstopTimer - dt);
        return;
      }

      if (eng.releaseLockTimer > 0) {
        eng.releaseLockTimer = Math.max(0, eng.releaseLockTimer - dt);
      }

      if (eng.shakeTime > 0) {
        eng.shakeTime = Math.max(0, eng.shakeTime - dt);
      }

      if (eng.perfectFlashAlpha > 0) {
        eng.perfectFlashAlpha = Math.max(0, eng.perfectFlashAlpha - dt * 2.4);
      }

      if (eng.shieldFlashAlpha > 0) {
        eng.shieldFlashAlpha = Math.max(0, eng.shieldFlashAlpha - dt * 1.9);
      }

      if (eng.ropeSnapRecoil > 0) {
        eng.ropeSnapRecoil = Math.max(0, eng.ropeSnapRecoil - dt * 4.5);
      }

      // Compute world position of ceiling pivot
      const pivotWorldY =
        eng.cameraY + (groundScreenY - pivotScreenY) / worldScale;

      // Pendulum oscillation — hanging cake ALWAYS remains strictly horizontal (tilt = 0)
      if (eng.phase === 'swing') {
        const omega = 1.92 + Math.min(2.15, eng.floors * 0.068);
        eng.swingPhase += omega * dt;
        eng.swingAngle = MAX_SWING_ANGLE * Math.sin(eng.swingPhase);
        eng.activeCakeX = ROPE_LENGTH * Math.sin(eng.swingAngle);
        eng.activeCakeY =
          pivotWorldY - ROPE_LENGTH * Math.cos(eng.swingAngle) - CAKE_HEIGHT * 0.5;
        eng.activeCakeTilt = 0;
      } else if (eng.phase === 'dropping') {
        eng.dropVy -= GRAVITY * dt;
        eng.activeCakeY += eng.dropVy * dt;
        eng.activeCakeTilt = 0;

        const targetSurfaceY = topBlock.y + topBlock.height;
        if (eng.activeCakeY <= targetSurfaceY) {
          eng.activeCakeY = targetSurfaceY;
          handleLanding(eng);
        }
      } else if (eng.phase === 'missing') {
        eng.missTimer -= dt;
        if (eng.missTimer <= 0) {
          eng.phase = 'ended';
          const newRec =
            eng.score > bestRef.current.score ||
            eng.floors > bestRef.current.floors;
          if (newRec) eng.isNewRecord = true;

          callbacksRef.current.onGameOver({
            score: eng.score,
            floors: eng.floors,
            combo: eng.combo,
            maxCombo: eng.maxCombo,
            bestScore: Math.max(bestRef.current.score, eng.score),
            bestFloors: Math.max(bestRef.current.floors, eng.floors),
            widthPercent: Math.round(
              (eng.activeWidth / INITIAL_CAKE_WIDTH) * 100
            ),
            shields: eng.shields,
            maxShields: MAX_SHIELDS,
            nextExpandIn: 3 - (eng.floors % 3),
            currentLayer: eng.currentLayer,
            nextLayer: eng.nextLayer,
            stackedFlavorIds: Array.from(eng.stackedFlavorIds),
            isNewRecord: eng.isNewRecord,
          });
        }
      }

      // Animate block squash bounce and 3-layer automatic width expansion
      for (let i = Math.max(0, eng.blocks.length - 4); i < eng.blocks.length; i++) {
        const blk = eng.blocks[i];
        if (blk.squashTime > 0) {
          blk.squashTime = Math.max(0, blk.squashTime - dt);
        }
        if (blk.targetWidth !== undefined && blk.width < blk.targetWidth) {
          blk.width += (blk.targetWidth - blk.width) * Math.min(1, dt * 10);
          if (Math.abs(blk.targetWidth - blk.width) < 0.4) {
            blk.width = blk.targetWidth;
          }
        }
      }

      // Update falling sliced pieces
      for (let i = eng.slices.length - 1; i >= 0; i--) {
        const s = eng.slices[i];
        s.vy -= GRAVITY * 0.85 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.angle += s.angularVel * dt;
        if (s.y < eng.cameraY - 350) {
          eng.slices.splice(i, 1);
        }
      }

      // Update pooled particles
      for (let i = 0; i < eng.particles.length; i++) {
        const p = eng.particles[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.vy -= 540 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotSpeed * dt;
        p.alpha = 1 - p.life / p.maxLife;
      }

      // Update floating callouts
      for (let i = eng.callouts.length - 1; i >= 0; i--) {
        const c = eng.callouts[i];
        c.life += dt;
        c.y += 38 * dt;
        if (c.life >= c.maxLife) {
          eng.callouts.splice(i, 1);
        }
      }
    };

    const drawBakeryEnvironment = (
      w: number,
      h: number,
      cameraY: number,
      worldScale: number,
      groundScreenY: number
    ) => {
      // Sky / bakery wall shift as tower rises
      const altitudeRatio = Math.min(1, cameraY / 1100);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);

      if (altitudeRatio < 0.5) {
        const t = altitudeRatio * 2;
        skyGrad.addColorStop(0, lerpColor('#FAF3E8', '#F2DFC6', t));
        skyGrad.addColorStop(0.65, lerpColor('#F5E8D5', '#E8CEAE', t));
        skyGrad.addColorStop(1, lerpColor('#ECD8BE', '#DFBE98', t));
      } else {
        const t = (altitudeRatio - 0.5) * 2;
        skyGrad.addColorStop(0, lerpColor('#F2DFC6', '#4E3F5E', t));
        skyGrad.addColorStop(0.55, lerpColor('#E8CEAE', '#B68A7C', t));
        skyGrad.addColorStop(1, lerpColor('#DFBE98', '#E4BC93', t));
      }

      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Soft twinkling stars when reaching rooftop twilight
      if (altitudeRatio > 0.55) {
        const starAlpha = (altitudeRatio - 0.55) / 0.45;
        ctx.save();
        ctx.fillStyle = `rgba(255, 248, 224, ${starAlpha * 0.65})`;
        for (let i = 0; i < 24; i++) {
          const sx = ((i * 197 + 43) % 1000) * 0.001 * w;
          const sy = ((i * 113 + 29) % 450) * 0.001 * h;
          const r = (i % 3) * 0.7 + 1.0;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Parallax wooden bakery windows & shelves in lower floors
      const parallaxY = cameraY * worldScale * 0.45;
      const counterScreenY = groundScreenY + 48 * worldScale + parallaxY * 0.35;

      // Soft sunlight diagonal rays from bakery window
      if (altitudeRatio < 0.7) {
        ctx.save();
        const rayAlpha = (1 - altitudeRatio / 0.7) * 0.16;
        const rayGrad = ctx.createLinearGradient(0, 0, w * 0.75, h * 0.8);
        rayGrad.addColorStop(0, `rgba(255, 246, 214, ${rayAlpha})`);
        rayGrad.addColorStop(1, 'rgba(255, 246, 214, 0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w * 0.45, 0);
        ctx.lineTo(w * 0.95, h);
        ctx.lineTo(w * 0.15, h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Subtle framed bakery wall shelves on wider screens (non-cluttering)
      if (w >= 640 && parallaxY < h * 1.2) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - parallaxY / (h * 0.9));
        const leftShelfX = Math.max(28, w * 0.5 - 380 * worldScale);
        const shelfY = h * 0.44 + parallaxY * 0.5;
        ctx.fillStyle = '#B88963';
        ctx.beginPath();
        ctx.roundRect(leftShelfX, shelfY, 130 * worldScale, 8, 3);
        ctx.fill();

        // Two small glass ingredient jars on shelf
        ctx.fillStyle = 'rgba(255, 252, 245, 0.75)';
        ctx.strokeStyle = 'rgba(110, 68, 43, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(leftShelfX + 18, shelfY - 34, 24, 34, 5);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.roundRect(leftShelfX + 54, shelfY - 28, 22, 28, 5);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Warm teak bakery counter surface near ground
      if (counterScreenY < h + 60) {
        const tableTopY = Math.max(groundScreenY + 46 * worldScale, counterScreenY);
        const tableGrad = ctx.createLinearGradient(0, tableTopY, 0, h);
        tableGrad.addColorStop(0, '#8A583B');
        tableGrad.addColorStop(0.14, '#6E4229');
        tableGrad.addColorStop(1, '#4B2B1A');
        ctx.fillStyle = tableGrad;
        ctx.fillRect(0, tableTopY, w, h - tableTopY + 100);

        // Counter edge highlight
        ctx.fillStyle = 'rgba(255, 226, 190, 0.28)';
        ctx.fillRect(0, tableTopY, w, 3);
      }
    };

    const render = () => {
      const eng = engineRef.current;
      if (!eng) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      const { worldScale, groundScreenY, pivotScreenY } = getViewportMetrics(w, h);

      // Camera shake offset
      let shakeX = 0;
      let shakeY = 0;
      if (eng.shakeTime > 0) {
        const intensity = (eng.shakeTime / 0.28) * eng.shakeMag;
        shakeX = (Math.random() - 0.5) * 2 * intensity;
        shakeY = (Math.random() - 0.5) * 2 * intensity;
      }

      const toScreenX = (wx: number) => w * 0.5 + wx * worldScale + shakeX;
      const toScreenY = (wy: number) =>
        groundScreenY - (wy - eng.cameraY) * worldScale + shakeY;

      // 1. Background Bakery Environment
      drawBakeryEnvironment(w, h, eng.cameraY, worldScale, groundScreenY);

      // 2. Wooden Cake Pedestal
      const pedestalScreenY = toScreenY(0);
      if (pedestalScreenY < h + 100) {
        drawCakePedestal(
          ctx,
          toScreenX(0),
          pedestalScreenY,
          INITIAL_CAKE_WIDTH * worldScale
        );
      }

      // 3. Stacked Cake Blocks (cull blocks far below screen)
      for (let i = 0; i < eng.blocks.length; i++) {
        const b = eng.blocks[i];
        const bBottomScreenY = toScreenY(b.y);
        if (bBottomScreenY - b.height * worldScale > h + 40) continue;

        let sqX = 1;
        let sqY = 1;
        if (b.squashTime > 0) {
          const t = b.squashTime / 0.24;
          const wave = Math.sin(t * Math.PI * 2.2) * t;
          sqY = 1 - 0.16 * wave;
          sqX = 1 + 0.11 * wave;
        }

        drawCakeBlock(
          ctx,
          toScreenX(b.x),
          bBottomScreenY,
          b.width * worldScale,
          b.height * worldScale,
          b.layer,
          {
            squashX: sqX,
            squashY: sqY,
            isBase: b.isBase,
          }
        );
      }

      // 4. Perfect Alignment Golden Halo Flash
      if (eng.perfectFlashAlpha > 0) {
        const topB = eng.blocks[eng.blocks.length - 1];
        const fx = toScreenX(topB.x);
        const fy = toScreenY(eng.perfectFlashY);
        ctx.save();
        ctx.strokeStyle = `rgba(245, 158, 11, ${eng.perfectFlashAlpha * 0.85})`;
        ctx.lineWidth = 3;
        const expand = (1 - eng.perfectFlashAlpha) * 26 * worldScale;
        ctx.beginPath();
        ctx.roundRect(
          fx - (topB.width * worldScale) / 2 - expand,
          fy - (CAKE_HEIGHT * worldScale) / 2 - expand * 0.35,
          topB.width * worldScale + expand * 2,
          CAKE_HEIGHT * worldScale + expand * 0.7,
          10
        );
        ctx.stroke();
        ctx.restore();
      }

      // 4b. Protective Shield Aura (active when shields > 0) & Shield Block Flash
      const topB = eng.blocks[eng.blocks.length - 1];
      if (eng.shields > 0 && gameStateRef.current === 'PLAYING') {
        const sx = toScreenX(topB.x);
        const sy = toScreenY(topB.y + topB.height);
        const auraW = topB.width * worldScale + 22 * worldScale;
        ctx.save();
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.38)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(sx - auraW / 2, sy + 2);
        ctx.lineTo(sx + auraW / 2, sy + 2);
        ctx.stroke();
        ctx.restore();
      }

      if (eng.shieldFlashAlpha > 0) {
        const sx = toScreenX(topB.x);
        const sy = toScreenY(eng.shieldFlashY);
        const radius = (topB.width * 0.65 + (1 - eng.shieldFlashAlpha) * 32) * worldScale;
        ctx.save();
        ctx.strokeStyle = `rgba(14, 165, 233, ${eng.shieldFlashAlpha * 0.9})`;
        ctx.fillStyle = `rgba(56, 189, 248, ${eng.shieldFlashAlpha * 0.16})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, radius, 22 * worldScale, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 5. Falling Sliced Overhangs
      for (let i = 0; i < eng.slices.length; i++) {
        const s = eng.slices[i];
        drawCakeBlock(
          ctx,
          toScreenX(s.x),
          toScreenY(s.y),
          s.width * worldScale,
          s.height * worldScale,
          s.layer,
          {
            rotation: s.angle,
            alpha: s.alpha,
          }
        );
      }

      // 6. Ceiling Hook, Pendulum Rope & Hanging / Dropping Cake (always strictly horizontal)
      const pivotSX = toScreenX(0);
      const pivotSY = pivotScreenY + shakeY;

      // Brass ceiling pulley / hook
      ctx.save();
      ctx.fillStyle = '#B88332';
      ctx.beginPath();
      ctx.arc(pivotSX, pivotSY, 7 * worldScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6B4414';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      if (eng.phase === 'swing') {
        const cakeTopCenterSX = toScreenX(eng.activeCakeX);
        const cakeTopCenterSY =
          toScreenY(eng.activeCakeY + CAKE_HEIGHT);

        // Warm baker's twine rope
        ctx.save();
        ctx.strokeStyle = '#8C6239';
        ctx.lineWidth = 2.4 * worldScale;
        ctx.beginPath();
        ctx.moveTo(pivotSX, pivotSY);
        ctx.lineTo(cakeTopCenterSX, cakeTopCenterSY);
        ctx.stroke();

        // Little wooden cake clasp at top of cake
        ctx.fillStyle = '#D99B52';
        ctx.beginPath();
        ctx.arc(cakeTopCenterSX, cakeTopCenterSY, 4.5 * worldScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        drawCakeBlock(
          ctx,
          toScreenX(eng.activeCakeX),
          toScreenY(eng.activeCakeY),
          eng.activeWidth * worldScale,
          CAKE_HEIGHT * worldScale,
          eng.currentLayer,
          { rotation: 0 }
        );
      } else if (eng.phase === 'dropping') {
        // Recoiling cut twine hanging briefly at top
        if (eng.ropeSnapRecoil > 0.05) {
          const stubLen = 64 * worldScale * eng.ropeSnapRecoil;
          ctx.save();
          ctx.strokeStyle = `rgba(140, 98, 57, ${eng.ropeSnapRecoil})`;
          ctx.lineWidth = 2 * worldScale;
          ctx.beginPath();
          ctx.moveTo(pivotSX, pivotSY);
          ctx.lineTo(
            pivotSX + Math.sin(eng.swingAngle) * stubLen,
            pivotSY + Math.cos(eng.swingAngle) * stubLen
          );
          ctx.stroke();
          ctx.restore();
        }

        drawCakeBlock(
          ctx,
          toScreenX(eng.activeCakeX),
          toScreenY(eng.activeCakeY),
          eng.activeWidth * worldScale,
          CAKE_HEIGHT * worldScale,
          eng.currentLayer,
          { rotation: 0 }
        );
      }

      // 7. Pooled Particles
      for (let i = 0; i < eng.particles.length; i++) {
        const p = eng.particles[i];
        if (!p.active) continue;
        const px = toScreenX(p.x);
        const py = toScreenY(p.y);
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(px, py);
        ctx.rotate(p.rotation);

        if (p.shape === 'sparkle') {
          const r = p.size * worldScale;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r * 0.3, -r * 0.3);
          ctx.lineTo(r, 0);
          ctx.lineTo(r * 0.3, r * 0.3);
          ctx.lineTo(0, r);
          ctx.lineTo(-r * 0.3, r * 0.3);
          ctx.lineTo(-r, 0);
          ctx.lineTo(-r * 0.3, -r * 0.3);
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'crumb') {
          const s = p.size * worldScale;
          ctx.fillRect(-s / 2, -s / 2, s, s * 0.8);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.5 * worldScale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 8. Floating Combo / Score Callouts
      for (let i = 0; i < eng.callouts.length; i++) {
        const c = eng.callouts[i];
        const alpha = Math.max(0, 1 - c.life / c.maxLife);
        const cx = toScreenX(c.x);
        const cy = toScreenY(c.y);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${Math.round(16 * worldScale)}px "Noto Sans TC", sans-serif`;
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = 'rgba(255, 253, 249, 0.9)';
        ctx.lineWidth = 4;
        ctx.strokeText(c.text, cx, cy);
        ctx.fillStyle = c.color;
        ctx.fillText(c.text, cx, cy);

        if (c.subtext) {
          ctx.font = `600 ${Math.round(12 * worldScale)}px "Noto Sans TC", sans-serif`;
          ctx.strokeText(c.subtext, cx, cy + 18 * worldScale);
          ctx.fillStyle = '#7C3F19';
          ctx.fillText(c.subtext, cx, cy + 18 * worldScale);
        }
        ctx.restore();
      }

      ctx.restore();
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      resize();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      if (gameStateRef.current === 'PLAYING') {
        stepPhysics(dt, w, h);
      } else if (gameStateRef.current === 'TITLE_MENU') {
        // Gentle idle swing preview behind title scrim
        const eng = engineRef.current;
        if (eng) {
          const { worldScale, groundScreenY, pivotScreenY } = getViewportMetrics(w, h);
          const pivotWorldY =
            eng.cameraY + (groundScreenY - pivotScreenY) / worldScale;
          eng.swingPhase += 1.45 * dt;
          eng.swingAngle = 0.42 * Math.sin(eng.swingPhase);
          eng.activeCakeX = ROPE_LENGTH * Math.sin(eng.swingAngle);
          eng.activeCakeY =
            pivotWorldY - ROPE_LENGTH * Math.cos(eng.swingAngle) - CAKE_HEIGHT * 0.5;
          eng.activeCakeTilt = 0;
        }
      }

      render();
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        if (gameStateRef.current !== 'PLAYING') return;
        e.preventDefault();
        audio.unlock();
        triggerDrop();
      }}
      className="block w-full h-full cursor-pointer touch-manipulation"
      aria-label="可可台灣千層疊疊樂遊戲畫布"
    />
  );
};

function lerpColor(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const rr = Math.round(ar + (br - ar) * clamped);
  const rg = Math.round(ag + (bg - ag) * clamped);
  const rb = Math.round(ab + (bb - ab) * clamped);
  return `rgb(${rr}, ${rg}, ${rb})`;
}
