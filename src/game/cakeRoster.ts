import { CakeLayerDef, CakeLayerId } from './types';

export const CAKE_LAYERS: Record<CakeLayerId, CakeLayerDef> = {
  chocolate_cream: {
    id: 'chocolate_cream',
    nameZh: '巧克力奶油層',
    originZh: '莊園黑可可',
    nameEn: 'Dark Cocoa Cream',
    textureType: 'cream',
    spongeColor: '#4A2518',
    spongeShade: '#361A10',
    fillingColor: '#7B462E',
    fillingHighlight: '#A36345',
    glazeColor: '#2A120A',
    accentColor: '#F3DFC1',
    particleColor: '#6D3B24',
  },
  passionfruit_jelly: {
    id: 'passionfruit_jelly',
    nameZh: '百香果凍層',
    originZh: '南投埔里',
    nameEn: 'Puli Passionfruit Jelly',
    textureType: 'jelly',
    spongeColor: '#5B311E',
    spongeShade: '#422214',
    fillingColor: '#F0A518',
    fillingHighlight: '#FFD86B',
    glazeColor: '#D97B06',
    accentColor: '#3B1E14',
    particleColor: '#F5B52E',
  },
  lychee_jelly: {
    id: 'lychee_jelly',
    nameZh: '荔枝果凍層',
    originZh: '高雄大樹玉荷包',
    nameEn: 'Dashu Lychee Jelly',
    textureType: 'jelly',
    spongeColor: '#582F1E',
    spongeShade: '#402013',
    fillingColor: '#F7E3E2',
    fillingHighlight: '#FFF9F8',
    glazeColor: '#E8A5AE',
    accentColor: '#D96B7D',
    particleColor: '#F9D6DC',
  },
  pineapple_fruit: {
    id: 'pineapple_fruit',
    nameZh: '鳳梨水果層',
    originZh: '屏東金鑽鳳梨',
    nameEn: 'Golden Diamond Pineapple',
    textureType: 'fruit',
    spongeColor: '#5B321F',
    spongeShade: '#422213',
    fillingColor: '#F8D458',
    fillingHighlight: '#FFF0A8',
    glazeColor: '#E39D1E',
    accentColor: '#C46F10',
    particleColor: '#F7CE46',
  },
  irwin_mango: {
    id: 'irwin_mango',
    nameZh: '愛文芒果層',
    originZh: '屏東枋山愛文',
    nameEn: 'Fangshan Irwin Mango',
    textureType: 'fruit',
    spongeColor: '#532B19',
    spongeShade: '#3B1C0F',
    fillingColor: '#F98B25',
    fillingHighlight: '#FFC466',
    glazeColor: '#DD6112',
    accentColor: '#FFE08A',
    particleColor: '#FB9B3C',
  },
  dajia_taro: {
    id: 'dajia_taro',
    nameZh: '大甲芋泥層',
    originZh: '台中大甲',
    nameEn: 'Dajia Taro Paste',
    textureType: 'paste',
    spongeColor: '#4E291A',
    spongeShade: '#391C10',
    fillingColor: '#B89AD0',
    fillingHighlight: '#DEC9EE',
    glazeColor: '#8B6BA8',
    accentColor: '#694787',
    particleColor: '#C8AFE0',
  },
  sun_moon_tea: {
    id: 'sun_moon_tea',
    nameZh: '日月潭紅茶層',
    originZh: '南投魚池紅玉',
    nameEn: 'Sun Moon Lake Tea',
    textureType: 'cream',
    spongeColor: '#4A2618',
    spongeShade: '#34190F',
    fillingColor: '#C78556',
    fillingHighlight: '#E6B289',
    glazeColor: '#8A4924',
    accentColor: '#3B2316',
    particleColor: '#C98A5B',
  },
};

export const CORE_FLAVORS: CakeLayerId[] = [
  'passionfruit_jelly',
  'chocolate_cream',
  'lychee_jelly',
  'pineapple_fruit',
];

export const SURPRISE_FLAVORS: CakeLayerId[] = [
  'irwin_mango',
  'dajia_taro',
  'sun_moon_tea',
];

export const ALL_FLAVOR_LIST: CakeLayerDef[] = [
  CAKE_LAYERS.chocolate_cream,
  CAKE_LAYERS.passionfruit_jelly,
  CAKE_LAYERS.lychee_jelly,
  CAKE_LAYERS.pineapple_fruit,
  CAKE_LAYERS.irwin_mango,
  CAKE_LAYERS.dajia_taro,
  CAKE_LAYERS.sun_moon_tea,
];

/**
 * Generates an appetizing Taiwanese layer progression:
 * Floors 1-4 introduce the 4 core flavors requested by the user,
 * then weaves in Irwin Mango, Dajia Taro, and Sun Moon Lake Black Tea
 * with non-repeating adjacent layers.
 */
export function pickLayerForFloor(
  floorIndex: number,
  prevId?: CakeLayerId
): CakeLayerDef {
  if (floorIndex <= 4) {
    const id = CORE_FLAVORS[(floorIndex - 1) % CORE_FLAVORS.length];
    return CAKE_LAYERS[id];
  }

  const fullCycle: CakeLayerId[] = [
    'passionfruit_jelly',
    'chocolate_cream',
    'irwin_mango',
    'lychee_jelly',
    'dajia_taro',
    'pineapple_fruit',
    'sun_moon_tea',
  ];

  // Every cycle shuffles predictably with floorIndex offset while avoiding duplicates
  const idx = (floorIndex * 3 + Math.floor(floorIndex / 7)) % fullCycle.length;
  let chosen = fullCycle[idx];
  if (chosen === prevId) {
    chosen = fullCycle[(idx + 1) % fullCycle.length];
  }
  return CAKE_LAYERS[chosen];
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws a single hand-crafted Taiwanese chocolate & fruit cake layer
 * centered at (cx, cy) with given width & height in screen coordinates.
 */
export function drawCakeBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottomY: number,
  width: number,
  height: number,
  layer: CakeLayerDef,
  options?: {
    squashX?: number;
    squashY?: number;
    rotation?: number;
    alpha?: number;
    isBase?: boolean;
  }
) {
  if (width <= 1 || height <= 1) return;

  const squashX = options?.squashX ?? 1;
  const squashY = options?.squashY ?? 1;
  const rotation = options?.rotation ?? 0;
  const alpha = options?.alpha ?? 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Pivot around bottom-center for natural landing squash, or center when rotating
  if (rotation !== 0) {
    ctx.translate(cx, bottomY - height / 2);
    ctx.rotate(rotation);
    ctx.scale(squashX, squashY);
    ctx.translate(0, height / 2);
  } else {
    ctx.translate(cx, bottomY);
    ctx.scale(squashX, squashY);
  }

  const left = -width / 2;
  const top = -height;
  const cornerR = Math.min(7, width * 0.12);

  // Soft warm ambient shadow beneath cake slice
  ctx.fillStyle = 'rgba(59, 30, 20, 0.14)';
  roundedRectPath(ctx, left + 1, top + 2, width, height, cornerR);
  ctx.fill();

  // Clip main cake body
  ctx.save();
  roundedRectPath(ctx, left, top, width, height, cornerR);
  ctx.clip();

  // 1. Bottom Chocolate Sponge Bed (38% height)
  const spongeH = height * 0.38;
  ctx.fillStyle = layer.spongeColor;
  ctx.fillRect(left, -spongeH, width, spongeH);

  // Subtle sponge crumb shading at very bottom
  ctx.fillStyle = layer.spongeShade;
  ctx.fillRect(left, -spongeH * 0.32, width, spongeH * 0.32);

  // Sponge air-pocket texture dots
  ctx.fillStyle = 'rgba(255, 224, 190, 0.12)';
  const crumbStep = 14;
  for (let px = left + 7; px < left + width - 4; px += crumbStep) {
    const offset = ((Math.abs(Math.floor(px * 1.7)) % 5) - 2) * 1.6;
    ctx.beginPath();
    ctx.arc(px, -spongeH * 0.55 + offset, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Specialty Taiwanese Filling Layer (44% height)
  const fillingTop = -height + height * 0.18;
  const fillingH = height - spongeH - height * 0.18;
  const fillingGrad = ctx.createLinearGradient(0, fillingTop, 0, -spongeH);
  fillingGrad.addColorStop(0, layer.fillingHighlight);
  fillingGrad.addColorStop(0.55, layer.fillingColor);
  fillingGrad.addColorStop(1, layer.fillingColor);
  ctx.fillStyle = fillingGrad;
  ctx.fillRect(left, fillingTop, width, fillingH + 1);

  // Flavor-specific cross-section details
  drawFlavorTexture(ctx, left, fillingTop, width, fillingH, layer);

  // 3. Top Glaze / Ganache Cap (20% height + playful drips)
  const capH = height * 0.21;
  ctx.fillStyle = layer.glazeColor;
  ctx.fillRect(left, top, width, capH);

  // Glossy rim highlight on top glaze
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(left + 6, top + 2.5, Math.max(0, width - 12), 2.5);

  // Playful drip waves along top border
  const dripSpacing = 18;
  const dripCount = Math.max(2, Math.floor(width / dripSpacing));
  const actualStep = width / dripCount;
  ctx.fillStyle = layer.glazeColor;
  for (let i = 0; i < dripCount; i++) {
    const dx = left + actualStep * (i + 0.5);
    const dripDepth = ((i * 7 + 3) % 3) * 2.2 + 3.5;
    ctx.beginPath();
    ctx.arc(dx, top + capH, Math.min(actualStep * 0.36, 6.2), 0, Math.PI);
    ctx.fill();
    if (i % 2 === 0 && width > 40) {
      ctx.beginPath();
      ctx.roundRect(dx - 2.2, top + capH - 1, 4.4, dripDepth, 2.2);
      ctx.fill();
    }
  }

  // Delicate hand-drawn outline inside clip
  ctx.restore();

  ctx.strokeStyle = 'rgba(59, 30, 20, 0.28)';
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, left, top, width, height, cornerR);
  ctx.stroke();

  // Base ribbon badge detail on starting cake
  if (options?.isBase && width > 90) {
    ctx.fillStyle = '#F7EAD9';
    ctx.beginPath();
    ctx.roundRect(-36, -height * 0.56, 72, 16, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 46, 32, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#4A2E20';
    ctx.font = '600 9.5px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('可可台灣底座', 0, -height * 0.56 + 8.5);
  }

  ctx.restore();
}

function drawFlavorTexture(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  layer: CakeLayerDef
) {
  if (layer.id === 'passionfruit_jelly') {
    // Translucent glossy streak + dark passionfruit seeds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.fillRect(left + 4, top + 2.5, Math.max(0, width - 8), 3);

    const step = 17;
    for (let sx = left + 10, idx = 0; sx < left + width - 8; sx += step, idx++) {
      const sy = top + height * (idx % 2 === 0 ? 0.42 : 0.7);
      ctx.fillStyle = '#3A1D12';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 2.2, 1.4, (idx % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 240, 180, 0.55)';
      ctx.beginPath();
      ctx.arc(sx - 0.6, sy - 0.5, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (layer.id === 'lychee_jelly') {
    // Translucent frosted shimmer + pink lychee flesh flecks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.fillRect(left + 4, top + 2, Math.max(0, width - 8), 3.5);

    const step = 20;
    for (let sx = left + 11, idx = 0; sx < left + width - 9; sx += step, idx++) {
      const sy = top + height * (idx % 2 === 0 ? 0.52 : 0.68);
      ctx.fillStyle = 'rgba(217, 107, 125, 0.35)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 4.2, 2.2, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(sx + 1, sy - 0.8, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (layer.id === 'pineapple_fruit') {
    // Golden diamond pineapple chunks embedded in custard
    const step = 18;
    for (let sx = left + 9, idx = 0; sx < left + width - 10; sx += step, idx++) {
      const sy = top + height * (idx % 2 === 0 ? 0.32 : 0.48);
      ctx.fillStyle = '#E89B10';
      ctx.beginPath();
      ctx.roundRect(sx - 4, sy - 3, 8, 6, 1.5);
      ctx.fill();
      ctx.fillStyle = '#FFF5B8';
      ctx.fillRect(sx - 2.5, sy - 2, 3.5, 2);
    }
  } else if (layer.id === 'irwin_mango') {
    // Rich mango chunks with juicy orange sheen
    const step = 19;
    for (let sx = left + 10, idx = 0; sx < left + width - 10; sx += step, idx++) {
      const sy = top + height * (idx % 2 === 0 ? 0.35 : 0.52);
      ctx.fillStyle = '#FFE28A';
      ctx.beginPath();
      ctx.roundRect(sx - 4.5, sy - 3, 9, 5.5, 2);
      ctx.fill();
    }
  } else if (layer.id === 'dajia_taro') {
    // Taro paste purple speckles & velvety swirl
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left + 4, top + height * 0.45);
    ctx.lineTo(left + width - 4, top + height * 0.45);
    ctx.stroke();

    const step = 15;
    for (let sx = left + 8, idx = 0; sx < left + width - 7; sx += step, idx++) {
      const sy = top + height * (idx % 2 === 0 ? 0.38 : 0.72);
      ctx.fillStyle = '#694787';
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (layer.id === 'sun_moon_tea') {
    // Sun Moon Lake crushed red-tea leaves
    const step = 14;
    for (let sx = left + 8, idx = 0; sx < left + width - 7; sx += step, idx++) {
      const sy = top + height * (idx % 3 === 0 ? 0.35 : idx % 3 === 1 ? 0.58 : 0.75);
      ctx.fillStyle = '#3B2316';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 1.8, 0.9, idx * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (layer.id === 'chocolate_cream') {
    // Whipped cocoa cream piping ripples
    const step = 18;
    ctx.fillStyle = layer.accentColor;
    for (let sx = left + 9; sx < left + width - 8; sx += step) {
      ctx.beginPath();
      ctx.arc(sx, top + height * 0.55, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draws a warm teak wood Taiwanese patisserie cake pedestal at groundY.
 */
export function drawCakePedestal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  topWidth: number
) {
  ctx.save();

  // Doily lace paper strip on top of wood stand
  const plateW = topWidth + 36;
  ctx.fillStyle = '#FFFDF9';
  ctx.beginPath();
  ctx.roundRect(cx - plateW / 2, groundY - 4, plateW, 7, 3.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(74, 46, 32, 0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Teak wooden tray top
  const woodGrad = ctx.createLinearGradient(cx, groundY, cx, groundY + 18);
  woodGrad.addColorStop(0, '#8B5A3C');
  woodGrad.addColorStop(0.5, '#6D432B');
  woodGrad.addColorStop(1, '#4E2E1D');
  ctx.fillStyle = woodGrad;
  ctx.beginPath();
  ctx.roundRect(cx - plateW / 2 - 8, groundY + 2, plateW + 16, 15, 6);
  ctx.fill();

  // Pedestal stem
  const stemGrad = ctx.createLinearGradient(cx - 24, 0, cx + 24, 0);
  stemGrad.addColorStop(0, '#4E2E1D');
  stemGrad.addColorStop(0.4, '#7D4E34');
  stemGrad.addColorStop(1, '#3D2315');
  ctx.fillStyle = stemGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 22, groundY + 17);
  ctx.lineTo(cx + 22, groundY + 17);
  ctx.lineTo(cx + 14, groundY + 52);
  ctx.lineTo(cx - 14, groundY + 52);
  ctx.closePath();
  ctx.fill();

  // Pedestal foot
  ctx.fillStyle = '#5B3723';
  ctx.beginPath();
  ctx.roundRect(cx - 58, groundY + 50, 116, 14, 7);
  ctx.fill();

  ctx.restore();
}
