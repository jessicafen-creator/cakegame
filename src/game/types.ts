export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type CakeLayerId =
  | 'chocolate_cream'
  | 'passionfruit_jelly'
  | 'lychee_jelly'
  | 'pineapple_fruit'
  | 'irwin_mango'
  | 'dajia_taro'
  | 'sun_moon_tea';

export type TextureType = 'cream' | 'jelly' | 'fruit' | 'paste';

export interface CakeLayerDef {
  id: CakeLayerId;
  nameZh: string;
  originZh: string;
  nameEn: string;
  textureType: TextureType;
  spongeColor: string;
  spongeShade: string;
  fillingColor: string;
  fillingHighlight: string;
  glazeColor: string;
  accentColor: string;
  particleColor: string;
}

export interface StackedBlock {
  id: number;
  x: number; // Center X in world space (0 = center of cake stand)
  y: number; // Bottom Y in world space (0 = top of cake stand, grows upward)
  width: number;
  targetWidth?: number;
  height: number;
  layer: CakeLayerDef;
  squashTime: number;
  isPerfect: boolean;
  isBase?: boolean;
}

export interface FallingSlice {
  x: number; // Center X in world space
  y: number; // Bottom Y in world space
  width: number;
  height: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  layer: CakeLayerDef;
  alpha: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'sparkle' | 'crumb';
  rotation: number;
  rotSpeed: number;
}

export interface FloatingCallout {
  id: number;
  text: string;
  subtext?: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface HudSnapshot {
  score: number;
  floors: number;
  combo: number;
  maxCombo: number;
  bestScore: number;
  bestFloors: number;
  widthPercent: number;
  shields: number;
  maxShields: number;
  nextExpandIn: number;
  currentLayer: CakeLayerDef;
  nextLayer: CakeLayerDef;
  stackedFlavorIds: CakeLayerId[];
  isNewRecord: boolean;
}
