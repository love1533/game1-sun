'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Character {
  name: string;
  color: string;
  emoji: string;
  heart: string;
}

interface Note {
  id: number;
  lane: number;       // 0=left, 1=center, 2=right
  y: number;          // current y position
  speed: number;
  hitTime: number;    // when this note should be at hit zone (ms from start)
  hit: boolean;
  missed: boolean;
  symbol: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'sparkle' | 'heart' | 'burst';
}

interface JudgeEffect {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

interface LaneGlow {
  lane: number;
  life: number;
  maxLife: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const CHARACTERS: Character[] = [
  { name: '수현', color: '#E74C3C', emoji: '🧢', heart: '❤️' },
  { name: '이현', color: '#FF69B4', emoji: '👸', heart: '💗' },
  { name: '은영', color: '#FF6B9D', emoji: '🌸', heart: '🌸' },
  { name: '민구', color: '#F39C12', emoji: '🏴‍☠️', heart: '🧡' },
];

// Pastel lane colors: pink, mint, lavender
const LANE_COLORS = ['#FFB3C6', '#B3F0DC', '#C9B3F5'];
const LANE_GLOW_COLORS = ['#FF6B9D', '#4ECDC4', '#9B59B6'];
const NOTE_COLORS = ['#FF8FAB', '#5CE1C0', '#B48EF7'];

const TIMING = { PERFECT: 60, GREAT: 120, GOOD: 200 };
const TIMING_SCORES = { PERFECT: 300, GREAT: 200, GOOD: 100 };
const TIMING_HEALTH = { PERFECT: 2, GREAT: 0, GOOD: 0, MISS: -15 };

const NOTE_SYMBOLS = ['♪', '♫', '🎵', '♩', '♬'];

// Pentatonic scale frequencies (C major pentatonic)
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
// Each lane maps to a chord
const LANE_NOTES = [
  [261.63, 329.63, 392.0],   // C E G
  [293.66, 369.99, 440.0],   // D F# A
  [329.63, 415.3, 493.88],   // E G# B
];

const SONG_DURATION = 60000; // 60 seconds
const HIT_ZONE_Y_RATIO = 0.82; // hit zone at 82% from top
const NOTE_TRAVEL_TIME = 2200; // ms for note to fall from top to hit zone (easy = slow)
const HEALTH_MAX = 100;

// ─── Note sequence generator ─────────────────────────────────────────────────
function generateNotes(): Note[] {
  const notes: Note[] = [];
  let id = 0;

  // Pattern intervals (ms between note groups)
  // Easy: ~80 notes total across 60s = avg 750ms apart
  const patterns = [
    // intro: single notes, spaced out
    { start: 2000, interval: 900, count: 8, pattern: 'single' },
    // verse 1: pairs
    { start: 9500, interval: 700, count: 12, pattern: 'pair' },
    // build-up
    { start: 18500, interval: 600, count: 10, pattern: 'single' },
    // chorus 1: busier
    { start: 25000, interval: 550, count: 14, pattern: 'pair' },
    // break
    { start: 34000, interval: 900, count: 8, pattern: 'single' },
    // verse 2
    { start: 42000, interval: 650, count: 10, pattern: 'pair' },
    // final chorus
    { start: 50000, interval: 500, count: 12, pattern: 'pair' },
    // outro
    { start: 57000, interval: 800, count: 4, pattern: 'single' },
  ];

  const laneSeq = [0, 1, 2, 1, 0, 2, 1, 0, 2, 0, 1, 2, 2, 0, 1];
  let seqIdx = 0;

  for (const section of patterns) {
    for (let i = 0; i < section.count; i++) {
      const hitTime = section.start + i * section.interval;
      const lane = laneSeq[seqIdx % laneSeq.length];
      seqIdx++;

      notes.push({
        id: id++,
        lane,
        y: -60,
        speed: 0,
        hitTime,
        hit: false,
        missed: false,
        symbol: NOTE_SYMBOLS[id % NOTE_SYMBOLS.length],
      });

      if (section.pattern === 'pair' && i % 3 === 1) {
        // add a second note in a different lane shortly after
        const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
        notes.push({
          id: id++,
          lane: lane2,
          y: -60,
          speed: 0,
          hitTime: hitTime + 180,
          hit: false,
          missed: false,
          symbol: NOTE_SYMBOLS[(id + 2) % NOTE_SYMBOLS.length],
        });
      }
    }
  }

  return notes.sort((a, b) => a.hitTime - b.hitTime);
}

// ─── Audio helpers ────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playHitSound(lane: number, grade: 'PERFECT' | 'GREAT' | 'GOOD') {
  try {
    const ctx = getAudioCtx();
    const freqs = LANE_NOTES[lane];
    const baseFreq = freqs[0];
    const now = ctx.currentTime;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.18, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    gainNode.connect(ctx.destination);

    // Play chord-like sound
    const noteCount = grade === 'PERFECT' ? 3 : grade === 'GREAT' ? 2 : 1;
    for (let i = 0; i < noteCount; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i], now);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (_) { /* ignore */ }
}

function playMissSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    gainNode.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (_) { /* ignore */ }
}

function playSelectSound(idx: number) {
  try {
    const ctx = getAudioCtx();
    const freq = PENTATONIC[idx % PENTATONIC.length];
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    gainNode.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (_) { /* ignore */ }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RhythmPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<'select' | 'playing' | 'result'>('select');
  const charRef = useRef<Character>(CHARACTERS[0]);
  const [phase, setPhase] = useState<'select' | 'playing' | 'result'>('select');
  const [selectedChar, setSelectedChar] = useState<Character>(CHARACTERS[0]);

  // Game state stored in refs for RAF loop
  const notesRef = useRef<Note[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const judgeEffectsRef = useRef<JudgeEffect[]>([]);
  const laneGlowsRef = useRef<LaneGlow[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const healthRef = useRef(HEALTH_MAX);
  const startTimeRef = useRef(0);
  const gameOverRef = useRef(false);
  const hitZoneGlowRef = useRef(0);
  const countPerfectRef = useRef(0);
  const countGreatRef = useRef(0);
  const countGoodRef = useRef(0);
  const countMissRef = useRef(0);
  const rafRef = useRef<number>(0);
  const canvasSizeRef = useRef({ w: 375, h: 812 });

  // Result state (written at end, read for render)
  const [resultData, setResultData] = useState({
    score: 0, maxCombo: 0, perfect: 0, great: 0, good: 0, miss: 0, grade: 'C',
  });

  // ── Derived layout values ─────────────────────────────────────────
  const getLayout = useCallback((w: number, h: number) => {
    const laneWidth = w / 3;
    const hitZoneY = h * HIT_ZONE_Y_RATIO;
    const noteRadius = Math.min(laneWidth * 0.28, 28);
    return { laneWidth, hitZoneY, noteRadius };
  }, []);

  // ── Spawn particles (sparkles on perfect) ─────────────────────────
  const spawnSparkles = useCallback((x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 2.5 + Math.random() * 3.5;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 45 + Math.random() * 20,
        maxLife: 65,
        color,
        size: 4 + Math.random() * 5,
        type: 'sparkle',
      });
    }
  }, []);

  const spawnBurst = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * 4.5,
        vy: Math.sin(angle) * 4.5,
        life: 30,
        maxLife: 30,
        color,
        size: 8,
        type: 'burst',
      });
    }
  }, []);

  // ── Judge a tap ───────────────────────────────────────────────────
  const judgeTap = useCallback((lane: number) => {
    const { h } = canvasSizeRef.current;
    const { hitZoneY } = getLayout(canvasSizeRef.current.w, h);
    const elapsed = performance.now() - startTimeRef.current;

    let bestNote: Note | null = null;
    let bestDelta = Infinity;

    for (const note of notesRef.current) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const delta = Math.abs(elapsed - note.hitTime);
      if (delta < bestDelta && delta <= TIMING.GOOD + 50) {
        bestDelta = delta;
        bestNote = note;
      }
    }

    const { w } = canvasSizeRef.current;
    const { laneWidth } = getLayout(w, h);
    const laneX = lane * laneWidth + laneWidth / 2;
    const laneColor = LANE_GLOW_COLORS[lane];

    laneGlowsRef.current.push({ lane, life: 18, maxLife: 18 });

    if (!bestNote) {
      // tapped but no note near — no penalty for empty tap, just glow
      return;
    }

    bestNote.hit = true;
    let grade: 'PERFECT' | 'GREAT' | 'GOOD';

    if (bestDelta <= TIMING.PERFECT) {
      grade = 'PERFECT';
      countPerfectRef.current++;
      scoreRef.current += TIMING_SCORES.PERFECT * Math.max(1, Math.floor(comboRef.current / 10) + 1);
      healthRef.current = Math.min(HEALTH_MAX, healthRef.current + TIMING_HEALTH.PERFECT);
      spawnSparkles(laneX, hitZoneY, laneColor, 14);
      spawnBurst(laneX, hitZoneY, '#FFD700');
      judgeEffectsRef.current.push({ text: 'PERFECT ✨', x: laneX, y: hitZoneY - 30, life: 55, maxLife: 55, color: '#FFD700' });
    } else if (bestDelta <= TIMING.GREAT) {
      grade = 'GREAT';
      countGreatRef.current++;
      scoreRef.current += TIMING_SCORES.GREAT * Math.max(1, Math.floor(comboRef.current / 10) + 1);
      spawnSparkles(laneX, hitZoneY, laneColor, 7);
      judgeEffectsRef.current.push({ text: 'GREAT 💫', x: laneX, y: hitZoneY - 30, life: 50, maxLife: 50, color: '#A8E6CF' });
    } else {
      grade = 'GOOD';
      countGoodRef.current++;
      scoreRef.current += TIMING_SCORES.GOOD;
      judgeEffectsRef.current.push({ text: 'GOOD 🎶', x: laneX, y: hitZoneY - 30, life: 45, maxLife: 45, color: '#DDA0DD' });
    }

    comboRef.current++;
    if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
    hitZoneGlowRef.current = 20;

    playHitSound(lane, grade);
  }, [getLayout, spawnSparkles, spawnBurst]);

  // ── Draw frame ────────────────────────────────────────────────────
  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, timestamp: number) => {
    const w = canvasSizeRef.current.w;
    const h = canvasSizeRef.current.h;
    const { laneWidth, hitZoneY, noteRadius } = getLayout(w, h);
    const elapsed = timestamp - startTimeRef.current;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1A0A2E');
    bg.addColorStop(0.5, '#16213E');
    bg.addColorStop(1, '#0F3460');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Star field
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 35; i++) {
      const sx = ((i * 137.5 + elapsed * 0.003) % w);
      const sy = ((i * 79.3 + elapsed * 0.001) % h);
      const sr = 0.5 + (i % 3) * 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lane backgrounds + glow
    const laneGlows = laneGlowsRef.current;
    for (let i = 0; i < 3; i++) {
      const lx = i * laneWidth;
      const activeGlow = laneGlows.find(g => g.lane === i);
      const glowAlpha = activeGlow ? (activeGlow.life / activeGlow.maxLife) * 0.25 : 0;

      const laneBg = ctx.createLinearGradient(lx, 0, lx + laneWidth, 0);
      laneBg.addColorStop(0, `rgba(255,255,255,${0.02 + glowAlpha})`);
      laneBg.addColorStop(0.5, `rgba(255,255,255,${0.05 + glowAlpha})`);
      laneBg.addColorStop(1, `rgba(255,255,255,${0.02 + glowAlpha})`);
      ctx.fillStyle = laneBg;
      ctx.fillRect(lx, 0, laneWidth, h);

      if (activeGlow && glowAlpha > 0) {
        const gGrad = ctx.createRadialGradient(lx + laneWidth / 2, hitZoneY, 0, lx + laneWidth / 2, hitZoneY, laneWidth * 0.9);
        gGrad.addColorStop(0, `${LANE_GLOW_COLORS[i]}60`);
        gGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = gGrad;
        ctx.fillRect(lx, hitZoneY - laneWidth, laneWidth, laneWidth * 2);
      }
    }

    // Lane dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, h);
      ctx.stroke();
    }

    // Hit zone line + pulse
    const hzGlow = hitZoneGlowRef.current;
    const hzAlpha = 0.6 + (hzGlow / 20) * 0.4;
    ctx.strokeStyle = `rgba(255,255,255,${hzAlpha})`;
    ctx.lineWidth = 2 + (hzGlow / 20) * 2;
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 8 + hzGlow * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, hitZoneY);
    ctx.lineTo(w, hitZoneY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Hit zone circles (tap targets)
    for (let i = 0; i < 3; i++) {
      const cx = i * laneWidth + laneWidth / 2;
      const activeGlow = laneGlows.find(g => g.lane === i);
      const ga = activeGlow ? activeGlow.life / activeGlow.maxLife : 0;
      const r = noteRadius * 1.15 + ga * 8;

      ctx.beginPath();
      ctx.arc(cx, hitZoneY, r, 0, Math.PI * 2);
      ctx.strokeStyle = LANE_COLORS[i] + 'CC';
      ctx.lineWidth = 2 + ga * 2;
      ctx.shadowColor = LANE_GLOW_COLORS[i];
      ctx.shadowBlur = 8 + ga * 16;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner fill
      ctx.beginPath();
      ctx.arc(cx, hitZoneY, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = LANE_COLORS[i] + Math.round(30 + ga * 50).toString(16).padStart(2, '0');
      ctx.fill();
    }

    // Notes
    const notes = notesRef.current;
    for (const note of notes) {
      if (note.hit || note.missed) continue;

      // Calculate current y from hitTime
      const timeUntilHit = note.hitTime - elapsed;
      const noteY = hitZoneY - (timeUntilHit / NOTE_TRAVEL_TIME) * hitZoneY;

      if (noteY < -noteRadius * 2 || noteY > h + noteRadius) continue;

      note.y = noteY;

      const cx = note.lane * laneWidth + laneWidth / 2;
      const color = NOTE_COLORS[note.lane];

      // Note glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      // Note circle
      const grad = ctx.createRadialGradient(cx - noteRadius * 0.3, noteY - noteRadius * 0.3, 1, cx, noteY, noteRadius);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.4, color + 'EE');
      grad.addColorStop(1, color + '99');
      ctx.beginPath();
      ctx.arc(cx, noteY, noteRadius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.shadowBlur = 0;

      // Note symbol
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${noteRadius * 0.85}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const sym = note.symbol === '🎵' ? '♪' : note.symbol;
      ctx.fillText(sym, cx, noteY);

      // Check auto-miss (note passed hit zone by more than GOOD window)
      if (elapsed - note.hitTime > TIMING.GOOD + 80) {
        note.missed = true;
        comboRef.current = 0;
        countMissRef.current++;
        healthRef.current = Math.max(0, healthRef.current + TIMING_HEALTH.MISS);
        const mx = note.lane * laneWidth + laneWidth / 2;
        judgeEffectsRef.current.push({ text: 'MISS 💔', x: mx, y: hitZoneY - 30, life: 40, maxLife: 40, color: '#FF6B6B' });
        playMissSound();
      }
    }

    // Particles
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life--;
      const alpha = p.life / p.maxLife;
      if (p.life <= 0) { particles.splice(i, 1); continue; }

      ctx.globalAlpha = alpha;
      if (p.type === 'sparkle') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        // Star shape
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Judge effects
    const effects = judgeEffectsRef.current;
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.life--;
      e.y -= 0.8;
      const alpha = Math.min(1, (e.life / e.maxLife) * 2);
      if (e.life <= 0) { effects.splice(i, 1); continue; }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 10;
      ctx.font = `bold ${Math.min(w * 0.048, 18)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.text, e.x, e.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Tick lane glows
    for (let i = laneGlows.length - 1; i >= 0; i--) {
      laneGlows[i].life--;
      if (laneGlows[i].life <= 0) laneGlows.splice(i, 1);
    }
    if (hitZoneGlowRef.current > 0) hitZoneGlowRef.current--;

    // HUD: score
    const score = scoreRef.current;
    const combo = comboRef.current;
    const health = healthRef.current;

    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h * 0.085);

    // Character name + emoji
    ctx.font = `bold ${Math.min(w * 0.05, 18)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = charRef.current.color;
    ctx.shadowColor = charRef.current.color;
    ctx.shadowBlur = 6;
    ctx.fillText(`${charRef.current.emoji} ${charRef.current.name}`, 12, h * 0.043);
    ctx.shadowBlur = 0;

    // Score
    ctx.font = `bold ${Math.min(w * 0.055, 22)}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(score.toLocaleString(), w - 12, h * 0.043);
    ctx.textAlign = 'left';

    // Combo
    if (combo >= 2) {
      const comboSize = Math.min(24 + combo * 0.2, 32);
      ctx.font = `bold ${comboSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 10;
      ctx.fillText(`${combo}x COMBO`, w / 2, h * 0.12);
      ctx.shadowBlur = 0;
    }

    // Health bar
    const hbW = w * 0.45;
    const hbH = 7;
    const hbX = (w - hbW) / 2;
    const hbY = h * 0.065;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(hbX, hbY, hbW, hbH, 4);
    ctx.fill();

    const hpRatio = health / HEALTH_MAX;
    const hpColor = hpRatio > 0.6 ? '#5CE1C0' : hpRatio > 0.3 ? '#FFD700' : '#FF6B6B';
    ctx.fillStyle = hpColor;
    ctx.shadowColor = hpColor;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.roundRect(hbX, hbY, hbW * hpRatio, hbH, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Progress bar at very top
    const progress = Math.min(1, elapsed / SONG_DURATION);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, w, 3);
    const progGrad = ctx.createLinearGradient(0, 0, w * progress, 0);
    progGrad.addColorStop(0, '#C9B3F5');
    progGrad.addColorStop(1, '#FFB3C6');
    ctx.fillStyle = progGrad;
    ctx.fillRect(0, 0, w * progress, 3);

    // Lane labels
    const laneLabels = ['LEFT', 'CENTER', 'RIGHT'];
    for (let i = 0; i < 3; i++) {
      const cx2 = i * laneWidth + laneWidth / 2;
      ctx.font = `${Math.min(w * 0.028, 11)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = LANE_COLORS[i] + '99';
      ctx.fillText(laneLabels[i], cx2, hitZoneY + noteRadius * 1.8);
    }

    // Game over if health hits 0
    if (health <= 0 && !gameOverRef.current) {
      gameOverRef.current = true;
    }

    // Song end check
    if ((elapsed >= SONG_DURATION || gameOverRef.current) && stateRef.current === 'playing') {
      // Final check: any remaining notes that passed are miss
      for (const note of notes) {
        if (!note.hit && !note.missed) {
          note.missed = true;
          countMissRef.current++;
        }
      }
      endGame();
    }
  }, [getLayout]);

  const endGame = useCallback(() => {
    stateRef.current = 'result';

    const total = countPerfectRef.current + countGreatRef.current + countGoodRef.current + countMissRef.current;
    const accuracy = total > 0 ? (countPerfectRef.current * 300 + countGreatRef.current * 200 + countGoodRef.current * 100) / (total * 300) : 0;
    let grade = 'C';
    if (accuracy >= 0.95) grade = 'S';
    else if (accuracy >= 0.85) grade = 'A';
    else if (accuracy >= 0.70) grade = 'B';

    setResultData({
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfect: countPerfectRef.current,
      great: countGreatRef.current,
      good: countGoodRef.current,
      miss: countMissRef.current,
      grade,
    });
    setPhase('result');
  }, []);

  // ── Game loop ─────────────────────────────────────────────────────
  const gameLoop = useCallback((timestamp: number) => {
    if (stateRef.current !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawFrame(ctx, timestamp);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [drawFrame]);

  // ── Start game ────────────────────────────────────────────────────
  const startGame = useCallback((char: Character) => {
    charRef.current = char;
    notesRef.current = generateNotes();
    particlesRef.current = [];
    judgeEffectsRef.current = [];
    laneGlowsRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    healthRef.current = HEALTH_MAX;
    gameOverRef.current = false;
    countPerfectRef.current = 0;
    countGreatRef.current = 0;
    countGoodRef.current = 0;
    countMissRef.current = 0;
    hitZoneGlowRef.current = 0;
    stateRef.current = 'playing';
    setPhase('playing');
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // ── Canvas resize ──────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      canvasSizeRef.current = { w, h };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── Touch / click handling ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      const { w } = canvasSizeRef.current;
      const laneWidth = w / 3;
      for (let t = 0; t < e.changedTouches.length; t++) {
        const touch = e.changedTouches[t];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const lane = Math.floor(x / laneWidth);
        if (lane >= 0 && lane <= 2) judgeTap(lane);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const { w } = canvasSizeRef.current;
      const laneWidth = w / 3;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const lane = Math.floor(x / laneWidth);
      if (lane >= 0 && lane <= 2) judgeTap(lane);
    };

    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('click', handleClick);
    return () => {
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('click', handleClick);
    };
  }, [phase, judgeTap]);

  // ── Cleanup RAF on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Draw select screen via canvas ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'select') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    let animFrame: number;
    let tick = 0;

    const drawSelect = () => {
      tick++;
      ctx.clearRect(0, 0, w, h);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#1A0A2E');
      bg.addColorStop(1, '#0F3460');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 137.5 + tick * 0.05) % w;
        const sy = (i * 79.3 + tick * 0.03) % h;
        const sr = 0.5 + (i % 3) * 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Title
      ctx.font = `bold ${Math.min(w * 0.1, 38)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#C9B3F5';
      ctx.shadowBlur = 18;
      ctx.fillText('🎵 리듬게임', w / 2, h * 0.1);
      ctx.shadowBlur = 0;

      ctx.font = `${Math.min(w * 0.042, 16)}px sans-serif`;
      ctx.fillStyle = '#C9B3F5';
      ctx.fillText('캐릭터를 선택하세요!', w / 2, h * 0.165);

      // Character cards
      const cardW = Math.min(w * 0.38, 145);
      const cardH = cardW * 1.35;
      const cols = 2;
      const rows = 2;
      const gridW = cols * cardW + (cols - 1) * 16;
      const gridX = (w - gridW) / 2;
      const gridY = h * 0.22;

      CHARACTERS.forEach((char, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = gridX + col * (cardW + 16);
        const cy = gridY + row * (cardH + 16);
        const isSelected = char.name === selectedChar.name;
        const pulse = Math.sin(tick * 0.06 + idx) * 0.5 + 0.5;

        // Card background
        const cardGrad = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
        cardGrad.addColorStop(0, char.color + '30');
        cardGrad.addColorStop(1, char.color + '15');
        ctx.fillStyle = isSelected ? char.color + '50' : cardGrad;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 16);
        ctx.fill();

        // Border
        ctx.strokeStyle = isSelected ? char.color : char.color + '70';
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.shadowColor = char.color;
        ctx.shadowBlur = isSelected ? 16 + pulse * 8 : 4;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 16);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Emoji
        const emojiSize = Math.min(cardW * 0.38, 52);
        ctx.font = `${emojiSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char.emoji, cx + cardW / 2, cy + cardH * 0.38);

        // Name
        ctx.font = `bold ${Math.min(cardW * 0.2, 24)}px sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = char.color;
        ctx.shadowBlur = 6;
        ctx.fillText(char.name, cx + cardW / 2, cy + cardH * 0.66);
        ctx.shadowBlur = 0;

        // Heart
        ctx.font = `${Math.min(cardW * 0.15, 18)}px serif`;
        ctx.fillText(char.heart, cx + cardW / 2, cy + cardH * 0.82);

        // Selected check
        if (isSelected) {
          ctx.font = `${Math.min(cardW * 0.18, 22)}px sans-serif`;
          ctx.fillStyle = '#FFD700';
          ctx.fillText('✓ 선택됨', cx + cardW / 2, cy + cardH * 0.94);
        }
      });

      // Start button
      const btnY = gridY + rows * (cardH + 16) + 20;
      const btnW = Math.min(w * 0.6, 220);
      const btnH = 56;
      const btnX = (w - btnW) / 2;
      const btnPulse = Math.sin(tick * 0.08) * 3;

      const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
      btnGrad.addColorStop(0, '#FF6B9D');
      btnGrad.addColorStop(1, '#C9B3F5');
      ctx.fillStyle = btnGrad;
      ctx.shadowColor = '#FF6B9D';
      ctx.shadowBlur = 14 + btnPulse;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, btnH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = `bold ${Math.min(w * 0.06, 22)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('🎮 게임 시작!', (w / 2), btnY + btnH / 2);

      animFrame = requestAnimationFrame(drawSelect);
    };

    animFrame = requestAnimationFrame(drawSelect);

    // Touch to select / start
    const handleSelectTouch = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      const tx = touch.clientX - rect.left;
      const ty = touch.clientY - rect.top;
      handleSelectInput(tx, ty);
    };

    const handleSelectClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      handleSelectInput(e.clientX - rect.left, e.clientY - rect.top);
    };

    const handleSelectInput = (tx: number, ty: number) => {
      const cardW = Math.min(w * 0.38, 145);
      const cardH = cardW * 1.35;
      const cols = 2;
      const rows = 2;
      const gridW = cols * cardW + (cols - 1) * 16;
      const gridX = (w - gridW) / 2;
      const gridY = h * 0.22;

      // Check character cards
      for (let idx = 0; idx < CHARACTERS.length; idx++) {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = gridX + col * (cardW + 16);
        const cy = gridY + row * (cardH + 16);
        if (tx >= cx && tx <= cx + cardW && ty >= cy && ty <= cy + cardH) {
          setSelectedChar(CHARACTERS[idx]);
          playSelectSound(idx);
          return;
        }
      }

      // Check start button
      const btnY = gridY + rows * (cardH + 16) + 20;
      const btnW = Math.min(w * 0.6, 220);
      const btnH = 56;
      const btnX = (w - btnW) / 2;
      if (tx >= btnX && tx <= btnX + btnW && ty >= btnY && ty <= btnY + btnH) {
        cancelAnimationFrame(animFrame);
        startGame(selectedChar);
      }
    };

    canvas.addEventListener('touchstart', handleSelectTouch, { passive: false });
    canvas.addEventListener('click', handleSelectClick);

    return () => {
      cancelAnimationFrame(animFrame);
      canvas.removeEventListener('touchstart', handleSelectTouch);
      canvas.removeEventListener('click', handleSelectClick);
    };
  }, [phase, selectedChar, startGame]);

  // ── Result screen ─────────────────────────────────────────────────
  const gradeColors: Record<string, string> = {
    S: '#FFD700', A: '#5CE1C0', B: '#C9B3F5', C: '#FFB3C6',
  };
  const gradeLabels: Record<string, string> = {
    S: 'S 랭크 - 완벽해요! ✨', A: 'A 랭크 - 훌륭해요! 🌟', B: 'B 랭크 - 잘했어요! 💫', C: 'C 랭크 - 다시 도전! 💪',
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden', background: '#1A0A2E' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      />

      {/* Result overlay */}
      {phase === 'result' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,10,30,0.92)',
          padding: '24px 20px',
        }}>
          {/* Grade */}
          <div style={{
            fontSize: 'clamp(64px, 20vw, 96px)',
            fontWeight: 900,
            color: gradeColors[resultData.grade] ?? '#fff',
            textShadow: `0 0 30px ${gradeColors[resultData.grade] ?? '#fff'}`,
            lineHeight: 1,
            marginBottom: 4,
          }}>
            {resultData.grade}
          </div>
          <div style={{ color: gradeColors[resultData.grade], fontSize: 'clamp(14px,4vw,18px)', marginBottom: 24, fontWeight: 700 }}>
            {gradeLabels[resultData.grade]}
          </div>

          {/* Character */}
          <div style={{ fontSize: 'clamp(32px,10vw,48px)', marginBottom: 16 }}>
            {charRef.current.emoji} {charRef.current.name}
          </div>

          {/* Stats */}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 20,
            padding: '20px 28px',
            width: '100%',
            maxWidth: 320,
            marginBottom: 28,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <StatRow label="SCORE" value={resultData.score.toLocaleString()} color="#FFFFFF" />
            <StatRow label="MAX COMBO" value={`${resultData.maxCombo}x`} color="#FFD700" />
            <StatRow label="PERFECT ✨" value={String(resultData.perfect)} color="#FFD700" />
            <StatRow label="GREAT 💫" value={String(resultData.great)} color="#5CE1C0" />
            <StatRow label="GOOD 🎶" value={String(resultData.good)} color="#C9B3F5" />
            <StatRow label="MISS 💔" value={String(resultData.miss)} color="#FF6B6B" />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 14, width: '100%', maxWidth: 320 }}>
            <button
              onClick={() => {
                stateRef.current = 'select';
                setPhase('select');
              }}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 30,
                background: 'linear-gradient(135deg,#FF6B9D,#C9B3F5)',
                color: '#fff', fontWeight: 800, fontSize: 'clamp(13px,3.5vw,16px)',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(255,107,157,0.4)',
              }}
            >
              🔄 다시 하기
            </button>
            <a
              href="/"
              style={{
                flex: 1, padding: '14px 0', borderRadius: 30,
                background: 'rgba(255,255,255,0.12)',
                color: '#C9B3F5', fontWeight: 700, fontSize: 'clamp(13px,3.5vw,16px)',
                border: '1px solid rgba(201,179,245,0.3)',
                textDecoration: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              🏠 홈으로
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'clamp(12px,3.2vw,14px)', fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontSize: 'clamp(14px,3.8vw,17px)', fontWeight: 800 }}>{value}</span>
    </div>
  );
}
