import type { Ctx } from './art';
import type { Game } from './engine';
import { CENTER, SAFE_RADIUS, WORLD } from './world';
import { RES, RES_ORDER, type ResId } from './items';
import { AMMO, type AmmoType } from './weapons';
import { sfx } from './audio';

export type CrateKind = 'wood' | 'metal' | 'medical' | 'military' | 'tools';

export interface LootCrate {
  id: number;
  x: number;
  y: number;
  kind: CrateKind;
  opened: boolean;
  prog: number;
  rot: number;
}

export const CRATE_NAMES: Record<CrateKind, string> = {
  wood: 'Деревянный ящик',
  metal: 'Металлический сейф',
  medical: 'Медицинский ящик',
  military: 'Армейский ящик',
  tools: 'Ящик с инструментами',
};

const OPEN_TIME = 1.2;

const ri = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));

/** Ночь: расставляем зомби по городу и ящики с ресурсами. */
export function spawnExpedition(g: Game) {
  g.crates = [];
  const spots = g.world.lootSpots.filter((s) => Math.hypot(s.x - CENTER.x, s.y - CENTER.y) > SAFE_RADIUS + 220);
  // перемешиваем
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const kinds: CrateKind[] = ['wood', 'wood', 'metal', 'metal', 'medical', 'military', 'tools', 'tools'];
  const n = Math.min(spots.length, 22 + Math.min(10, g.day * 2));
  for (let i = 0; i < n; i++) {
    const s = spots[i];
    g.crates.push({ id: g.nextId++, x: s.x, y: s.y, kind: kinds[Math.floor(Math.random() * kinds.length)], opened: false, prog: 0, rot: (Math.random() - 0.5) * 0.8 });
  }
  // зомби — бродят, пока не заметят игрока
  const count = Math.min(70, 28 + g.day * 5);
  let placed = 0;
  for (let k = 0; k < count * 12 && placed < count; k++) {
    const x = 90 + Math.random() * (WORLD - 180);
    const y = 90 + Math.random() * (WORLD - 180);
    if (Math.hypot(x - CENTER.x, y - CENTER.y) < SAFE_RADIUS + 420) continue;
    if (g.world.grid.circleBlocked(x, y, 28)) continue;
    const type = g.rollType();
    const e = g.spawnOne(type, x, y, true);
    e.wander = true;
    e.wa = Math.random() * 6.28;
    placed++;
  }
}

export function clearExpedition(g: Game) {
  g.crates = [];
  g.enemies = g.enemies.filter(() => false);
  g.bullets = [];
  g.bossRef = null;
}

export function nearestCrate(g: Game): LootCrate | null {
  const p = g.player;
  let best: LootCrate | null = null;
  let bd = 58;
  for (const c of g.crates) {
    if (c.opened) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

function openCrate(g: Game, c: LootCrate) {
  c.opened = true;
  const gain: Partial<Record<ResId, number>> = {};
  const add = (r: ResId, a: number, b: number) => {
    const n = ri(a, b);
    if (n > 0) gain[r] = (gain[r] ?? 0) + n;
  };
  const bonus = Math.min(3, Math.floor(g.day / 2));
  switch (c.kind) {
    case 'wood':
      add('wood', 2 + bonus, 5 + bonus);
      add('cloth', 0, 2);
      add('scrap', 0, 1);
      break;
    case 'metal':
      add('scrap', 3, 7 + bonus);
      add('parts', 0, 2);
      add('powder', 0, 1);
      break;
    case 'medical':
      add('cloth', 2, 4);
      add('parts', 0, 1);
      if (Math.random() < 0.65) g.pickups.push({ x: c.x + 14, y: c.y + 6, kind: 'medkit', amount: 40, life: 90 });
      break;
    case 'military':
      add('powder', 2, 5 + bonus);
      add('scrap', 1, 3);
      add('parts', 0, 1);
      {
        const types = (Object.keys(AMMO) as AmmoType[]).filter((t) => AMMO[t].price > 0);
        const t = types[Math.floor(Math.random() * types.length)];
        g.pickups.push({ x: c.x - 14, y: c.y + 6, kind: 'ammo', ammo: t, amount: Math.ceil(AMMO[t].pack * 0.8), life: 90 });
      }
      break;
    case 'tools':
      add('parts', 1, 3 + bonus);
      add('scrap', 2, 4);
      break;
  }
  if (Math.random() < 0.45) g.pickups.push({ x: c.x + 2, y: c.y - 14, kind: 'cash', amount: ri(25, 90) * (1 + g.day * 0.15) | 0, life: 90 });
  // шанс редкого ресурса в любом ящике
  if (Math.random() < 0.3) add(RES_ORDER[Math.floor(Math.random() * RES_ORDER.length)], 1, 2);
  const parts: string[] = [];
  for (const r of RES_ORDER) {
    const n = gain[r];
    if (n) {
      g.res[r] += n;
      parts.push(`${RES[r].icon}${n}`);
    }
  }
  g.toast(`${CRATE_NAMES[c.kind]}: ${parts.join(' ') || 'пусто'}`, 'good');
  sfx.pickup();
  for (let i = 0; i < 8; i++) g.addParticle({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, life: 0.5, max: 0.5, size: 2, color: '#e8c070', kind: 'spark', rot: 0 });
  // шум привлекает зомби поблизости
  g.alertEnemies(c.x, c.y, 330);
}

/** Удержание E рядом с ящиком */
export function updateCrates(g: Game, dt: number) {
  const near = nearestCrate(g);
  for (const c of g.crates) {
    if (c !== near && c.prog > 0) c.prog = Math.max(0, c.prog - dt * 2);
  }
  if (!near) return;
  if (g.keys.has('KeyE') && !g.shopOpen && !g.craftOpen) {
    near.prog += dt / OPEN_TIME;
    if (Math.random() < dt * 12) sfx.clang();
    if (near.prog >= 1) openCrate(g, near);
  } else near.prog = Math.max(0, near.prog - dt * 2);
}

const COLORS: Record<CrateKind, [string, string, string]> = {
  wood: ['#8a6234', '#6a4a26', '#a47a44'],
  metal: ['#5a6068', '#3e4348', '#7e858d'],
  medical: ['#d8d6cc', '#a8a69c', '#f0eee6'],
  military: ['#59603f', '#3f452c', '#7a8258'],
  tools: ['#a8392a', '#7a281e', '#d06a52'],
};

export function drawCrates(g: Game, ctx: Ctx, inView: (x: number, y: number) => boolean) {
  for (const c of g.crates) {
    if (!inView(c.x, c.y)) continue;
    const [base, dark, light] = COLORS[c.kind];
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    if (!c.opened) {
      const pulse = 0.14 + 0.1 * Math.sin(g.time * 3 + c.id);
      ctx.fillStyle = `rgba(255,220,130,${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(-14, -9, 30, 22);
    ctx.fillStyle = c.opened ? dark : base;
    ctx.fillRect(-15, -11, 30, 22);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-15, -11, 30, 22);
    ctx.fillStyle = c.opened ? 'rgba(0,0,0,0.35)' : light;
    ctx.fillRect(-13, -9, 26, 3);
    if (c.kind === 'wood') {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1;
      for (let i = -9; i <= 9; i += 6) {
        ctx.beginPath();
        ctx.moveTo(-15, i);
        ctx.lineTo(15, i);
        ctx.stroke();
      }
      ctx.fillStyle = '#4a4d50';
      ctx.fillRect(-15, -11, 4, 22);
      ctx.fillRect(11, -11, 4, 22);
    } else if (c.kind === 'metal') {
      ctx.fillStyle = '#2a2d31';
      ctx.fillRect(-11, -3, 22, 6);
      ctx.fillStyle = '#d8b44a';
      ctx.fillRect(-2, -2, 4, 4);
    } else if (c.kind === 'medical') {
      ctx.fillStyle = '#b0302c';
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
    } else if (c.kind === 'military') {
      ctx.fillStyle = '#d8d070';
      ctx.fillRect(-9, -2, 18, 2);
      ctx.fillRect(-9, 2, 12, 1.5);
      ctx.fillStyle = '#2a2d1f';
      ctx.fillRect(-15, -11, 3, 22);
      ctx.fillRect(12, -11, 3, 22);
    } else {
      ctx.fillStyle = '#d8d6cc';
      ctx.fillRect(-4, -14, 8, 4);
      ctx.fillStyle = '#2a2d31';
      ctx.fillRect(-11, -1, 22, 2);
    }
    ctx.restore();
    if (c.prog > 0 && !c.opened) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(c.x - 20, c.y - 26, 40, 5);
      ctx.fillStyle = '#e8b84a';
      ctx.fillRect(c.x - 19, c.y - 25, 38 * Math.min(1, c.prog), 3);
    }
  }
}

export function drawResPickup(ctx: Ctx, res: ResId, t: number) {
  const pulse = 0.18 + 0.1 * Math.sin(t * 4);
  ctx.fillStyle = `rgba(230,225,190,${pulse})`;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-7, -4, 16, 11);
  switch (res) {
    case 'scrap':
      ctx.fillStyle = '#8a9096';
      ctx.fillRect(-7, -5, 9, 6);
      ctx.fillStyle = '#6a6f74';
      ctx.fillRect(-2, 0, 9, 5);
      ctx.fillStyle = '#b0b6bc';
      ctx.fillRect(-7, -5, 9, 1.5);
      break;
    case 'wood':
      ctx.fillStyle = '#9a6e3a';
      ctx.fillRect(-8, -5, 16, 4);
      ctx.fillStyle = '#7a5428';
      ctx.fillRect(-8, 0, 16, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-3, -5, 1, 9);
      break;
    case 'cloth':
      ctx.fillStyle = '#c9b8a0';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a7a64';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, -1);
      ctx.quadraticCurveTo(0, 3, 5, -1);
      ctx.stroke();
      break;
    case 'powder':
      ctx.fillStyle = '#5f6234';
      ctx.fillRect(-6, -5, 12, 10);
      ctx.fillStyle = '#d8a548';
      ctx.fillRect(-4, -3, 8, 3);
      ctx.fillStyle = '#2a2c18';
      ctx.fillRect(-6, 2, 12, 3);
      break;
    default:
      ctx.fillStyle = '#1f6a4a';
      ctx.fillRect(-7, -5, 14, 10);
      ctx.fillStyle = '#6fd0e8';
      ctx.fillRect(-4, -2, 3, 3);
      ctx.fillRect(1, -2, 3, 3);
      ctx.fillStyle = '#d8b44a';
      ctx.fillRect(-7, 5, 14, 1.5);
  }
}
