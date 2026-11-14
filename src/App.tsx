import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import landscapeBackdrop from './assets/images/bakery_title_landscape_1794635445708.jpg';
import portraitBackdrop from './assets/images/bakery_title_portrait_1794635446164.jpg';
import { BakeryAudioEngine } from './game/audioEngine';
import { CakeStackCanvas } from './game/CakeStackCanvas';
import { ALL_FLAVOR_LIST, CAKE_LAYERS } from './game/cakeRoster';
import { GameState, HudSnapshot } from './game/types';

const STORAGE_BEST_SCORE_KEY = 'cocoa_taiwan_stack_best_score_v1';
const STORAGE_BEST_FLOORS_KEY = 'cocoa_taiwan_stack_best_floors_v1';

function readStoredNumber(key: string): number {
  try {
    const val = localStorage.getItem(key);
    const num = val ? parseInt(val, 10) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

function writeStoredNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage quota errors
  }
}

export default function App() {
  const audioRef = useRef<BakeryAudioEngine | null>(null);
  if (!audioRef.current) {
    audioRef.current = new BakeryAudioEngine();
  }
  const audio = audioRef.current;

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [runId, setRunId] = useState(1);
  const [muted, setMuted] = useState(false);
  const [bestScore, setBestScore] = useState(() =>
    readStoredNumber(STORAGE_BEST_SCORE_KEY)
  );
  const [bestFloors, setBestFloors] = useState(() =>
    readStoredNumber(STORAGE_BEST_FLOORS_KEY)
  );
  const [backdropError, setBackdropError] = useState(false);

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    score: 0,
    floors: 0,
    combo: 0,
    maxCombo: 0,
    bestScore: readStoredNumber(STORAGE_BEST_SCORE_KEY),
    bestFloors: readStoredNumber(STORAGE_BEST_FLOORS_KEY),
    widthPercent: 100,
    shields: 1,
    maxShields: 2,
    nextExpandIn: 3,
    currentLayer: CAKE_LAYERS.passionfruit_jelly,
    nextLayer: CAKE_LAYERS.chocolate_cream,
    stackedFlavorIds: [],
    isNewRecord: false,
  }));

  const startNewGame = useCallback(() => {
    audio.unlock();
    audio.resetBgmPosition();
    audio.startBgm();
    setRunId((id) => id + 1);
    setGameState('PLAYING');
  }, [audio]);

  const resumeGame = useCallback(() => {
    audio.unlock();
    audio.startBgm();
    setGameState('PLAYING');
  }, [audio]);

  const pauseGame = useCallback(() => {
    audio.pauseBgm();
    setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : prev));
  }, [audio]);

  const returnToTitle = useCallback(() => {
    audio.pauseBgm();
    setRunId((id) => id + 1);
    setGameState('TITLE_MENU');
  }, [audio]);

  const toggleMute = useCallback(() => {
    audio.unlock();
    setMuted((prev) => {
      const next = !prev;
      audio.setMuted(next);
      return next;
    });
  }, [audio]);

  const handleHudUpdate = useCallback((snapshot: HudSnapshot) => {
    setHud(snapshot);
  }, []);

  const handleGameOver = useCallback(
    (finalSnapshot: HudSnapshot) => {
      audio.pauseBgm();
      setHud(finalSnapshot);

      if (finalSnapshot.score > bestScore) {
        setBestScore(finalSnapshot.score);
        writeStoredNumber(STORAGE_BEST_SCORE_KEY, finalSnapshot.score);
      }
      if (finalSnapshot.floors > bestFloors) {
        setBestFloors(finalSnapshot.floors);
        writeStoredNumber(STORAGE_BEST_FLOORS_KEY, finalSnapshot.floors);
      }
      setGameState('GAME_OVER');
    },
    [audio, bestFloors, bestScore]
  );

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      audio.dispose();
    };
  }, [audio]);

  // Auto-pause when tab loses visibility or window blurs
  useEffect(() => {
    const handleBlurOrHide = () => {
      if (document.hidden || !document.hasFocus()) {
        setGameState((prev) => {
          if (prev === 'PLAYING') {
            audio.pauseBgm();
            return 'PAUSED';
          }
          return prev;
        });
      }
    };
    document.addEventListener('visibilitychange', handleBlurOrHide);
    window.addEventListener('blur', handleBlurOrHide);
    return () => {
      document.removeEventListener('visibilitychange', handleBlurOrHide);
      window.removeEventListener('blur', handleBlurOrHide);
    };
  }, [audio]);

  // Global keyboard shortcuts (Enter/Space on menus, Esc pause, M mute)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (gameState === 'PLAYING') {
          pauseGame();
        } else if (gameState === 'PAUSED') {
          resumeGame();
        }
        return;
      }

      if (e.code === 'Enter' || e.code === 'Space') {
        if (gameState === 'TITLE_MENU' || gameState === 'GAME_OVER') {
          e.preventDefault();
          startNewGame();
        } else if (gameState === 'PAUSED') {
          e.preventDefault();
          resumeGame();
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, pauseGame, resumeGame, startNewGame, toggleMute]);

  const stackedFlavors = useMemo(
    () =>
      hud.stackedFlavorIds
        .map((id) => CAKE_LAYERS[id])
        .filter(Boolean),
    [hud.stackedFlavorIds]
  );

  return (
    <main className="relative w-screen h-[100dvh] overflow-hidden bg-[#FAF3E8] text-[#3B1E14]">
      {/* Isolated 60fps 2D Game Canvas */}
      <div className="absolute inset-0">
        <CakeStackCanvas
          gameState={gameState}
          runId={runId}
          audio={audio}
          bestScore={bestScore}
          bestFloors={bestFloors}
          onHudUpdate={handleHudUpdate}
          onGameOver={handleGameOver}
        />
      </div>

      {/* TITLE SCREEN */}
      {gameState === 'TITLE_MENU' && (
        <section
          aria-label="遊戲主畫面"
          className="absolute inset-0 z-20 flex flex-col justify-between overflow-hidden"
        >
          {/* Illustrated Key-Art Backdrop with CSS fallback */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF3E8] via-[#F2E2CC] to-[#DFC4A3]">
            {!backdropError && (
              <picture>
                <source media="(min-width: 768px)" srcSet={landscapeBackdrop} />
                <img
                  src={portraitBackdrop}
                  alt="溫暖手繪台灣烘焙坊與木質甜點吧台背景"
                  referrerPolicy="no-referrer"
                  onError={() => setBackdropError(true)}
                  className="w-full h-full object-cover object-bottom"
                />
              </picture>
            )}
            {/* Measured warm cream-to-espresso scrim for crisp contrast over the bakery counter */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(250,243,232,0.93) 0%, rgba(250,243,232,0.84) 48%, rgba(250,243,232,0.45) 66%, rgba(42,20,12,0.68) 100%)',
              }}
            />
          </div>

          {/* Top Bar Controls: Mute Toggle only */}
          <div className="relative z-10 flex items-center justify-end px-4 pt-4 sm:px-6 sm:pt-5">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? '開啟音樂與音效' : '靜音'}
              className="min-w-[44px] min-h-[44px] px-3 flex items-center justify-center gap-2 rounded-xl bg-[#FFFDF9]/90 border border-[#4A2E20]/15 text-[#3B1E14] hover:bg-[#FFFDF9] active:scale-[0.97] transition-transform cursor-pointer"
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span className="text-xs font-medium whitespace-nowrap">
                {muted ? '靜音中' : '音樂開'}
              </span>
            </button>
          </div>

          {/* Center-Upper Bespoke SVG Title Lockup over calm negative space */}
          <div className="relative z-10 flex flex-col items-center text-center px-6 pt-2 sm:pt-4 max-w-2xl mx-auto">
            <svg
              viewBox="0 0 420 148"
              className="w-full max-w-[360px] sm:max-w-[420px] h-auto drop-shadow-sm"
              role="img"
              aria-label="可可台灣 千層疊疊樂"
            >
              {/* Delicate hand-drawn cake layer emblem */}
              <g transform="translate(210, 26)">
                <rect
                  x="-34"
                  y="-14"
                  width="68"
                  height="10"
                  rx="4"
                  fill="#4A2518"
                />
                <rect
                  x="-34"
                  y="-4"
                  width="68"
                  height="8"
                  rx="2"
                  fill="#F0A518"
                />
                <rect
                  x="-34"
                  y="4"
                  width="68"
                  height="8"
                  rx="3"
                  fill="#F7E3E2"
                />
                <path
                  d="M-36 13 H36"
                  stroke="#6D432B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </g>

              {/* Editorial Serif Title */}
              <text
                x="210"
                y="84"
                textAnchor="middle"
                fill="#3B1E14"
                style={{
                  fontFamily: '"Noto Serif TC", "Fraunces", serif',
                  fontWeight: 900,
                  fontSize: '42px',
                  letterSpacing: '0.06em',
                }}
              >
                可可台灣
              </text>

              {/* Decorative cocoa divider & subtitle */}
              <line
                x1="108"
                y1="102"
                x2="312"
                y2="102"
                stroke="#8A583B"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              />
              <text
                x="210"
                y="130"
                textAnchor="middle"
                fill="#6D432B"
                style={{
                  fontFamily: '"Noto Sans TC", "Plus Jakarta Sans", sans-serif',
                  fontWeight: 700,
                  fontSize: '20px',
                  letterSpacing: '0.24em',
                }}
              >
                千層疊疊樂
              </text>
            </svg>

            <p className="mt-2 text-sm sm:text-base text-[#5C3826] max-w-md leading-relaxed">
              抓準鐘擺擺盪的節奏點擊放開，把台灣百香果、玉荷包荔枝與金鑽鳳梨巧克力的美味層層疊上雲端。
            </p>

            {/* Unboxed Flavor Lineup */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-[#4A2E20] max-w-md">
              {ALL_FLAVOR_LIST.map((f, idx) => (
                <span key={f.id} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm border border-[#3B1E14]/20"
                    style={{ backgroundColor: f.fillingColor }}
                    aria-hidden="true"
                  />
                  <span>{f.nameZh.replace('層', '')}</span>
                  {idx < ALL_FLAVOR_LIST.length - 1 && (
                    <span className="text-[#8A583B]/50 ml-1" aria-hidden="true">
                      ·
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom Start CTA & Control Hint over warm counter scrim */}
          <div className="relative z-10 flex flex-col items-center px-6 pb-8 sm:pb-10">
            {(bestFloors > 0 || bestScore > 0) && (
              <div className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-medium text-[#FFFDF9] drop-shadow-sm font-mono-num">
                <span>最高紀錄</span>
                <span aria-hidden="true">·</span>
                <span>{bestFloors} 層</span>
                <span aria-hidden="true">·</span>
                <span>{bestScore} 分</span>
              </div>
            )}

            <button
              type="button"
              onClick={startNewGame}
              className="min-h-[52px] px-10 py-3.5 rounded-2xl bg-[#3B1E14] text-[#FFFDF9] text-base sm:text-lg font-bold tracking-wider shadow-xl shadow-[#3B1E14]/30 hover:bg-[#4E2A1D] active:scale-[0.98] transition-transform whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E59A1A]"
            >
              開始疊蛋糕
            </button>

            <p className="mt-3 text-xs text-[#FFFDF9]/90 tracking-wide drop-shadow-sm text-center">
              點擊螢幕或按空白鍵放開蛋糕 · Esc 暫停 · M 靜音
            </p>
          </div>
        </section>
      )}

      {/* ACTIVE PLAYING HUD (Low-occlusion, pointer-events: none wrapper, no backdrop-filter) */}
      {gameState === 'PLAYING' && (
        <header className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
          {/* Top Row: Perimeter Status Cluster + Action Buttons */}
          <div className="flex items-start justify-between gap-4">
            {/* Top-left unboxed editorial metrics */}
            <div className="flex flex-col gap-0.5 text-[#3B1E14]">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-3xl sm:text-4xl font-black leading-none font-mono-num">
                  {hud.floors}
                </span>
                <span className="text-sm font-bold text-[#6D432B]">層</span>
                <span className="text-[#8A583B]/50" aria-hidden="true">
                  ·
                </span>
                <span className="text-base sm:text-lg font-bold font-mono-num">
                  {hud.score} 分
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6D432B] font-mono-num">
                <span>最高 {hud.bestFloors} 層</span>
                <span aria-hidden="true">·</span>
                <span>寬度 {hud.widthPercent}%</span>
                <span aria-hidden="true">·</span>
                <span>再 {hud.nextExpandIn} 層增寬</span>
              </div>

              <div className="mt-1.5 flex items-center gap-2 text-xs font-bold">
                <span
                  className={`inline-flex items-center gap-1 ${
                    hud.shields > 0 ? 'text-[#0369A1]' : 'text-[#8A583B]/80'
                  }`}
                >
                  {hud.shields > 0 ? (
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                  )}
                  <span className="font-mono-num">
                    {hud.shields > 0
                      ? `防護盾 ×${hud.shields}`
                      : '防護盾 0（每 6 層補充）'}
                  </span>
                </span>

                {hud.combo >= 1 && (
                  <>
                    <span className="text-[#8A583B]/45" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[#B45309] font-mono-num">
                      精準連擊 ×{hud.combo}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Top-right functional action buttons (>= 44x44px) */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? '開啟聲音' : '靜音'}
                className="min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center rounded-xl bg-[#FFFDF9]/92 border border-[#4A2E20]/15 text-[#3B1E14] hover:bg-[#FFFDF9] active:scale-[0.96] transition-transform cursor-pointer"
              >
                {muted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <button
                type="button"
                onClick={pauseGame}
                aria-label="暫停遊戲"
                className="min-w-[44px] min-h-[44px] px-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#FFFDF9]/92 border border-[#4A2E20]/15 text-[#3B1E14] hover:bg-[#FFFDF9] active:scale-[0.96] transition-transform cursor-pointer whitespace-nowrap shrink-0"
              >
                <Pause className="w-4 h-4" />
                <span className="text-xs font-bold">暫停</span>
              </button>
            </div>
          </div>

          {/* Bottom Flavor Queue Hint (subtle, unboxed, non-blocking) */}
          <div className="flex items-end justify-between gap-4 pb-1">
            <div className="bg-[#FFFDF9]/88 border border-[#4A2E20]/12 rounded-xl px-3 py-2 text-xs text-[#3B1E14] shadow-sm">
              <div className="flex items-center gap-2 font-bold">
                <span
                  className="inline-block w-3 h-3 rounded-sm border border-[#3B1E14]/25 shrink-0"
                  style={{ backgroundColor: hud.currentLayer.fillingColor }}
                  aria-hidden="true"
                />
                <span>{hud.currentLayer.nameZh}</span>
                <span className="text-[#8A583B] font-normal">
                  · {hud.currentLayer.originZh}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-[#6D432B]">
                下一層：{hud.nextLayer.nameZh}
              </div>
            </div>

            {hud.floors === 0 && (
              <div className="text-xs font-medium text-[#FFFDF9] drop-shadow-sm pb-1">
                輕點螢幕釋放蛋糕
              </div>
            )}
          </div>
        </header>
      )}

      {/* PAUSE MODAL */}
      {gameState === 'PAUSED' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="遊戲暫停"
          className="absolute inset-0 z-30 flex items-center justify-center bg-[#2A140C]/45 p-5"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#FFFDF9] border border-[#4A2E20]/15 p-7 shadow-2xl text-center">
            <h2 className="font-display text-2xl font-bold text-[#3B1E14]">
              甜點師小憩中
            </h2>
            <p className="mt-1.5 text-sm text-[#6D432B] font-mono-num">
              目前進度：{hud.floors} 層 · {hud.score} 分
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={resumeGame}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#3B1E14] text-[#FFFDF9] font-bold text-base flex items-center justify-center gap-2 hover:bg-[#4E2A1D] active:scale-[0.98] transition-transform whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>繼續疊蛋糕</span>
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="w-full min-h-[44px] px-6 py-2.5 rounded-xl bg-[#F5EBDC] text-[#3B1E14] font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#ECDCC5] active:scale-[0.98] transition-transform whitespace-nowrap cursor-pointer"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                <span>{muted ? '開啟音樂與音效' : '關閉音樂與音效'}</span>
              </button>

              <div className="mt-1 flex items-center justify-center gap-4 text-sm">
                <button
                  type="button"
                  onClick={startNewGame}
                  className="min-h-[44px] px-4 text-[#6D432B] hover:text-[#3B1E14] font-medium whitespace-nowrap cursor-pointer"
                >
                  重新開始
                </button>
                <span className="text-[#8A583B]/40" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={returnToTitle}
                  className="min-h-[44px] px-4 text-[#6D432B] hover:text-[#3B1E14] font-medium whitespace-nowrap cursor-pointer"
                >
                  返回首頁
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER SUMMARY MODAL */}
      {gameState === 'GAME_OVER' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="本局結算"
          className="absolute inset-0 z-30 flex items-center justify-center bg-[#2A140C]/50 p-5"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#FFFDF9] border border-[#4A2E20]/15 p-7 shadow-2xl text-center">
            {hud.isNewRecord && hud.floors > 0 && (
              <p className="text-xs font-bold tracking-widest text-[#C26A0A] mb-1">
                刷新烘焙坊最高紀錄
              </p>
            )}
            <h2 className="font-display text-2xl sm:text-3xl font-black text-[#3B1E14]">
              {hud.floors >= 15
                ? '台灣千層大師！'
                : hud.floors >= 6
                  ? '香甜蛋糕塔完成'
                  : '蛋糕差一點就疊上去了'}
            </h2>

            {/* Clean tabular numeric summary strip */}
            <div className="mt-5 grid grid-cols-3 gap-2 py-4 border-y border-[#4A2E20]/12">
              <div>
                <div className="text-xs text-[#6D432B]">疊高層數</div>
                <div className="mt-1 font-display text-2xl font-black text-[#3B1E14] font-mono-num">
                  {hud.floors}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6D432B]">總分</div>
                <div className="mt-1 font-display text-2xl font-black text-[#3B1E14] font-mono-num">
                  {hud.score}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6D432B]">最高連擊</div>
                <div className="mt-1 font-display text-2xl font-black text-[#C26A0A] font-mono-num">
                  ×{hud.maxCombo}
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-[#6D432B] font-mono-num">
              個人最佳：{hud.bestFloors} 層 · {hud.bestScore} 分
            </div>

            {/* Stacked Taiwanese flavors summary */}
            {stackedFlavors.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#4A2E20]/10">
                <div className="text-xs font-medium text-[#6D432B] mb-2">
                  本局使用的台灣食材夾層
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-xs text-[#3B1E14]">
                  {stackedFlavors.map((flavor, idx) => (
                    <span
                      key={flavor.id}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm border border-[#3B1E14]/20"
                        style={{ backgroundColor: flavor.fillingColor }}
                        aria-hidden="true"
                      />
                      <span>{flavor.nameZh}</span>
                      {idx < stackedFlavors.length - 1 && (
                        <span className="text-[#8A583B]/45 ml-1" aria-hidden="true">
                          ·
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={startNewGame}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#3B1E14] text-[#FFFDF9] font-bold text-base flex items-center justify-center gap-2 hover:bg-[#4E2A1D] active:scale-[0.98] transition-transform whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>再玩一次</span>
              </button>

              <button
                type="button"
                onClick={returnToTitle}
                className="w-full min-h-[44px] px-6 py-2.5 rounded-xl text-[#6D432B] hover:text-[#3B1E14] hover:bg-[#F5EBDC]/60 font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                返回首頁
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
