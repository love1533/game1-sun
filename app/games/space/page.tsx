'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Character {
  name: string;
  color: string;
  emoji: string;
  heart: string;
  desc: string;
}

interface Obstacle {
  x: number;
  y: number;
  type: 'asteroid' | 'rock' | 'comet';
  radius: number;
  speedY: number;
  rotation: number;
  rotSpeed: number;
  passed: boolean;
}

interface Collectible {
  x: number;
  y: number;
  type: 'star' | 'bigstar' | 'gem' | 'ufo';
  radius: number;
  points: number;
  collected: boolean;
  bobOffset: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface TwinkleStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  alphaSpeed: number;
  color: string;
}

interface Planet {
  x: number;
  y: number;
  radius: number;
  color: string;
  ringColor: string | null;
  speed: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  vy: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHARACTERS: Character[] = [
  { name: '수현', color: '#E74C3C', emoji: '🧢', heart: '❤️', desc: '용감한 탐험가!' },
  { name: '이현', color: '#FF69B4', emoji: '👸', heart: '💗', desc: '핑크 우주인!' },
  { name: '은영', color: '#FF6B9D', emoji: '🌸', heart: '🌸', desc: '꽃별 항해사!' },
  { name: '민구', color: '#F39C12', emoji: '🏴‍☠️', heart: '🧡', desc: '우주 해적왕!' },
];

const PASTEL_COLORS = [
  '#FFB3C6', '#FFC8E8', '#B3D4FF', '#C8B3FF',
  '#B3FFD4', '#FFE4B3', '#FFB3FF', '#B3FFFF',
];

// ─── Sound Manager ────────────────────────────────────────────────────────────

class SoundManager {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  collect(type: 'star' | 'bigstar' | 'gem' | 'ufo') {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const freqMap = { star: [800, 1200], bigstar: [900, 1400], gem: [1000, 1600], ufo: [600, 1800] };
      const [f1, f2] = freqMap[type];
      osc.frequency.setValueAtTime(f1, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch { /* ignore */ }
  }

  hit() {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore */ }
  }

  whoosh() {
    try {
      const ctx = this.getCtx();
      const bufLen = ctx.sampleRate * 0.12;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch { /* ignore */ }
  }

  gameOver() {
    try {
      const ctx = this.getCtx();
      const freqs = [400, 300, 200, 150];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } catch { /* ignore */ }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpaceGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedChar, setSelectedChar] = useState<number | null>(null);
  const [gameState, setGameState] = useState<'select' | 'playing' | 'over'>('select');
  const [finalScore, setFinalScore] = useState(0);
  const [finalDistance, setFinalDistance] = useState(0);

  const startGame = useCallback((charIndex: number) => {
    setSelectedChar(charIndex);
    setGameState('playing');
  }, []);

  const restartGame = useCallback(() => {
    if (selectedChar !== null) {
      setGameState('playing');
    }
  }, [selectedChar]);

  // ─── Game Loop ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameState !== 'playing' || selectedChar === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sound = new SoundManager();
    let animId: number;
    let destroyed = false;

    // Resize
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const char = CHARACTERS[selectedChar];

    // ── Twinkle stars (background) ──────────────────────────────────────────
    const twinkleStars: TwinkleStar[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.5 + 0.5,
      alpha: Math.random(),
      alphaSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() < 0.5 ? 1 : -1),
      color: PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)],
    }));

    // ── Background planets ───────────────────────────────────────────────────
    const planets: Planet[] = [
      { x: canvas.width * 0.8, y: canvas.height * 0.15, radius: 32, color: '#FFDDE1', ringColor: '#FFB3C6', speed: 0.15 },
      { x: canvas.width * 0.15, y: canvas.height * 0.35, radius: 22, color: '#D4F1F4', ringColor: null, speed: 0.2 },
      { x: canvas.width * 0.65, y: canvas.height * 0.7, radius: 18, color: '#E8D5FF', ringColor: '#C8B3FF', speed: 0.12 },
    ];

    // ── Player ───────────────────────────────────────────────────────────────
    const ROCKET_W = 44;
    const ROCKET_H = 58;
    const HITBOX_RATIO = 0.5; // forgiving hitbox

    const player = {
      x: canvas.width * 0.2,
      y: canvas.height * 0.5,
      targetX: canvas.width * 0.2,
      targetY: canvas.height * 0.5,
      vx: 0,
      vy: 0,
      invincible: 0,
      hearts: 3,
    };

    // ── Touch input ──────────────────────────────────────────────────────────
    let touching = false;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      touching = true;
      const t = e.touches[0];
      player.targetX = t.clientX;
      player.targetY = t.clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!touching) return;
      const t = e.touches[0];
      player.targetX = t.clientX;
      player.targetY = t.clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      touching = false;
    };
    const onMouseDown = (e: MouseEvent) => {
      touching = true;
      player.targetX = e.clientX;
      player.targetY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!touching) return;
      player.targetX = e.clientX;
      player.targetY = e.clientY;
    };
    const onMouseUp = () => { touching = false; };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);

    // ── Game state vars ──────────────────────────────────────────────────────
    let obstacles: Obstacle[] = [];
    let collectibles: Collectible[] = [];
    let particles: Particle[] = [];
    let floatingTexts: FloatingText[] = [];
    let score = 0;
    let distance = 0;
    let speed = 2.8;
    let frame = 0;
    let lastObstacleX = canvas.width + 200;
    let lastCollectibleX = canvas.width + 100;
    const MIN_OBSTACLE_GAP = 420;
    const MIN_COLLECTIBLE_GAP = 200;

    // ── Spawn helpers ────────────────────────────────────────────────────────
    const spawnObstacle = () => {
      const types: Obstacle['type'][] = ['asteroid', 'rock', 'comet'];
      const type = types[Math.floor(Math.random() * types.length)];
      const radius = type === 'asteroid' ? 22 + Math.random() * 12
                   : type === 'rock' ? 16 + Math.random() * 8
                   : 14 + Math.random() * 6;
      obstacles.push({
        x: canvas.width + radius + 20,
        y: canvas.height * 0.12 + Math.random() * canvas.height * 0.76,
        type,
        radius,
        speedY: (Math.random() - 0.5) * 0.8,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
        passed: false,
      });
      lastObstacleX = canvas.width + radius + 20;
    };

    const spawnCollectible = () => {
      const roll = Math.random();
      let type: Collectible['type'];
      let points: number;
      if (roll < 0.45) { type = 'star'; points = 10; }
      else if (roll < 0.72) { type = 'bigstar'; points = 30; }
      else if (roll < 0.90) { type = 'gem'; points = 50; }
      else { type = 'ufo'; points = 100; }
      collectibles.push({
        x: canvas.width + 20,
        y: canvas.height * 0.1 + Math.random() * canvas.height * 0.8,
        type,
        radius: type === 'ufo' ? 20 : type === 'gem' ? 14 : 12,
        points,
        collected: false,
        bobOffset: Math.random() * Math.PI * 2,
      });
      lastCollectibleX = canvas.width + 20;
    };

    // ── Particle helpers ─────────────────────────────────────────────────────
    const spawnTrailParticle = () => {
      const colors = ['#FFB3C6', '#FFC8E8', '#E8C4FF', '#C4E8FF', '#FFFACD'];
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: player.x - ROCKET_W * 0.15 + (Math.random() - 0.5) * 8,
          y: player.y + ROCKET_H * 0.42 + (Math.random() - 0.5) * 6,
          vx: -(Math.random() * 1.5 + 0.5),
          vy: (Math.random() - 0.5) * 1.2,
          life: 1,
          maxLife: 1,
          size: Math.random() * 5 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const spawnCollectParticles = (x: number, y: number, color: string) => {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        particles.push({
          x, y,
          vx: Math.cos(angle) * (Math.random() * 3 + 1),
          vy: Math.sin(angle) * (Math.random() * 3 + 1),
          life: 1,
          maxLife: 1,
          size: Math.random() * 5 + 2,
          color,
        });
      }
    };

    // ── Draw helpers ─────────────────────────────────────────────────────────
    const drawBackground = () => {
      // Gradient sky
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#E8D5FF');
      grad.addColorStop(0.4, '#D4E8FF');
      grad.addColorStop(0.75, '#FFD4EC');
      grad.addColorStop(1, '#FFF0D4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const drawTwinkleStars = () => {
      twinkleStars.forEach(s => {
        s.alpha += s.alphaSpeed;
        if (s.alpha > 1) { s.alpha = 1; s.alphaSpeed *= -1; }
        if (s.alpha < 0.1) { s.alpha = 0.1; s.alphaSpeed *= -1; }
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const drawPlanet = (p: Planet) => {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      // Sheen
      const sheen = ctx.createRadialGradient(p.x - p.radius * 0.3, p.y - p.radius * 0.3, 1, p.x, p.y, p.radius);
      sheen.addColorStop(0, 'rgba(255,255,255,0.5)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      // Ring (Saturn style)
      if (p.ringColor) {
        ctx.strokeStyle = p.ringColor;
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.radius * 1.7, p.radius * 0.4, Math.PI * 0.15, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawRocket = () => {
      const x = player.x;
      const y = player.y;
      const w = ROCKET_W;
      const h = ROCKET_H;
      const inv = player.invincible > 0;

      ctx.save();
      if (inv && Math.floor(frame / 4) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      // Rocket body
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = char.color + '80';

      // Body shape
      ctx.beginPath();
      ctx.moveTo(x, y - h / 2); // nose tip
      ctx.bezierCurveTo(x + w * 0.55, y - h * 0.1, x + w * 0.55, y + h * 0.25, x + w * 0.3, y + h * 0.5);
      ctx.lineTo(x - w * 0.3, y + h * 0.5);
      ctx.bezierCurveTo(x - w * 0.55, y + h * 0.25, x - w * 0.55, y - h * 0.1, x, y - h / 2);
      ctx.fillStyle = char.color;
      ctx.fill();

      // Window circle
      const winGrad = ctx.createRadialGradient(x, y - h * 0.05, 2, x, y - h * 0.05, w * 0.28);
      winGrad.addColorStop(0, '#FFFFFF');
      winGrad.addColorStop(0.6, '#E0F4FF');
      winGrad.addColorStop(1, '#B3D4FF');
      ctx.beginPath();
      ctx.arc(x, y - h * 0.05, w * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = winGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // Fins
      ctx.fillStyle = char.color;
      ctx.globalAlpha = (ctx.globalAlpha * 0.85);
      // Left fin
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, y + h * 0.3);
      ctx.lineTo(x - w * 0.65, y + h * 0.52);
      ctx.lineTo(x - w * 0.28, y + h * 0.5);
      ctx.closePath();
      ctx.fill();
      // Right fin
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + h * 0.3);
      ctx.lineTo(x + w * 0.65, y + h * 0.52);
      ctx.lineTo(x + w * 0.28, y + h * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Character emoji in window
      ctx.save();
      if (inv && Math.floor(frame / 4) % 2 === 0) ctx.globalAlpha = 0.4;
      ctx.font = `${w * 0.38}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char.emoji, x, y - h * 0.05);
      ctx.restore();

      // Flame
      const flameY = y + h * 0.5;
      ctx.save();
      const flameH = 18 + Math.sin(frame * 0.3) * 6;
      const flameGrad = ctx.createLinearGradient(x, flameY, x, flameY + flameH);
      flameGrad.addColorStop(0, '#FFE566');
      flameGrad.addColorStop(0.5, '#FF9933');
      flameGrad.addColorStop(1, 'rgba(255,100,50,0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.22, flameY);
      ctx.quadraticCurveTo(x, flameY + flameH * 1.2, x + w * 0.22, flameY);
      ctx.fill();
      ctx.restore();
    };

    const drawObstacle = (o: Obstacle) => {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rotation);
      ctx.font = `${o.radius * 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (o.type === 'asteroid') ctx.fillText('🌑', 0, 0);
      else if (o.type === 'rock') ctx.fillText('🪨', 0, 0);
      else ctx.fillText('☄️', 0, 0);
      ctx.restore();
    };

    const drawCollectible = (c: Collectible) => {
      if (c.collected) return;
      const bobY = c.y + Math.sin(frame * 0.05 + c.bobOffset) * 5;
      ctx.save();
      ctx.font = `${c.radius * 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Glow
      ctx.shadowBlur = 12;
      ctx.shadowColor = c.type === 'gem' ? '#B3D4FF'
                      : c.type === 'ufo' ? '#C8B3FF'
                      : '#FFFACD';
      if (c.type === 'star') ctx.fillText('⭐', c.x, bobY);
      else if (c.type === 'bigstar') ctx.fillText('🌟', c.x, bobY);
      else if (c.type === 'gem') ctx.fillText('💎', c.x, bobY);
      else ctx.fillText('🛸', c.x, bobY);
      ctx.restore();
    };

    const drawParticles = () => {
      particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const drawFloatingTexts = () => {
      floatingTexts.forEach(t => {
        const alpha = t.life / t.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = t.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = t.color;
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      });
    };

    const drawHUD = () => {
      // Hearts
      const heartSize = 22;
      for (let i = 0; i < 3; i++) {
        ctx.font = `${heartSize}px serif`;
        ctx.textBaseline = 'top';
        ctx.globalAlpha = i < player.hearts ? 1 : 0.2;
        ctx.fillText(char.heart, 14 + i * (heartSize + 4), 14);
      }
      ctx.globalAlpha = 1;

      // Score
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#7B5EA7';
      ctx.shadowBlur = 0;
      ctx.fillText(`⭐ ${score}`, canvas.width - 14, 16);

      // Distance
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#9B7EBD';
      ctx.fillText(`${Math.floor(distance)}m`, canvas.width - 14, 36);
      ctx.textAlign = 'left';
    };

    // ── Main loop ────────────────────────────────────────────────────────────
    const loop = () => {
      if (destroyed) return;
      frame++;

      // Speed ramp (very slow)
      speed = 2.8 + Math.min(distance * 0.003, 3.5);

      // Move planets slowly
      planets.forEach(p => { p.x -= p.speed; if (p.x + p.radius * 2 < 0) p.x = canvas.width + p.radius * 2; });

      // Player movement (smooth follow)
      if (touching) {
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        player.vx = dx * 0.14;
        player.vy = dy * 0.14;
        // Whoosh on big move
        if (Math.abs(dx) > 80 || Math.abs(dy) > 80) {
          if (frame % 20 === 0) sound.whoosh();
        }
      } else {
        player.vx *= 0.88;
        player.vy *= 0.88;
      }
      player.x += player.vx;
      player.y += player.vy;

      // Clamp player
      const pad = ROCKET_W * 0.6;
      player.x = Math.max(pad, Math.min(canvas.width - pad, player.x));
      player.y = Math.max(ROCKET_H * 0.6, Math.min(canvas.height - ROCKET_H * 0.6, player.y));

      // Distance
      distance += speed * 0.04;

      // Trail particles
      if (frame % 2 === 0) spawnTrailParticle();

      // Spawn obstacles
      if (canvas.width - lastObstacleX + (obstacles.length > 0 ? 0 : 100) > MIN_OBSTACLE_GAP || obstacles.length === 0) {
        if (frame > 60) spawnObstacle();
      }

      // Spawn collectibles
      if (canvas.width - lastCollectibleX + (collectibles.length > 0 ? 0 : 50) > MIN_COLLECTIBLE_GAP || collectibles.length === 0) {
        spawnCollectible();
      }

      // Update obstacles
      obstacles.forEach(o => {
        o.x -= speed;
        o.y += o.speedY;
        o.rotation += o.rotSpeed;
        // Bounce off top/bottom
        if (o.y - o.radius < canvas.height * 0.08 || o.y + o.radius > canvas.height * 0.92) {
          o.speedY *= -1;
        }

        // Collision with player (forgiving hitbox)
        if (!o.passed && player.invincible <= 0) {
          const hbR = (ROCKET_W * HITBOX_RATIO * 0.5 + o.radius * 0.55);
          const dx = player.x - o.x;
          const dy = player.y - o.y;
          if (dx * dx + dy * dy < hbR * hbR) {
            player.hearts--;
            player.invincible = 120;
            sound.hit();
            // Hit particles
            for (let i = 0; i < 10; i++) {
              const angle = Math.random() * Math.PI * 2;
              particles.push({
                x: player.x, y: player.y,
                vx: Math.cos(angle) * (Math.random() * 4 + 1),
                vy: Math.sin(angle) * (Math.random() * 4 + 1),
                life: 1, maxLife: 1, size: Math.random() * 6 + 3,
                color: '#FF9999',
              });
            }
            floatingTexts.push({ x: player.x, y: player.y - 30, text: '💥', life: 60, maxLife: 60, color: '#FF6B6B', vy: -1.5 });
            if (player.hearts <= 0) {
              setFinalScore(score);
              setFinalDistance(Math.floor(distance));
              setGameState('over');
              sound.gameOver();
              destroyed = true;
              return;
            }
          }
        }
      });
      obstacles = obstacles.filter(o => o.x + o.radius > -50);

      // Update collectibles
      collectibles.forEach(c => {
        c.x -= speed;
        if (c.collected) return;
        const hbR = ROCKET_W * 0.5 + c.radius * 0.6;
        const dx = player.x - c.x;
        const dy = player.y - c.y;
        if (dx * dx + dy * dy < hbR * hbR) {
          c.collected = true;
          score += c.points;
          sound.collect(c.type);
          spawnCollectParticles(c.x, c.y, c.type === 'gem' ? '#B3D4FF' : c.type === 'ufo' ? '#C8B3FF' : '#FFE566');
          const labels: Record<Collectible['type'], string> = { star: '+10', bigstar: '+30', gem: '+50', ufo: '+100 🛸' };
          floatingTexts.push({ x: c.x, y: c.y - 20, text: labels[c.type], life: 70, maxLife: 70, color: '#7B5EA7', vy: -1.2 });
        }
      });
      collectibles = collectibles.filter(c => c.x + c.radius > -50 && !c.collected);

      // Invincibility countdown
      if (player.invincible > 0) player.invincible--;

      // Update particles
      const PARTICLE_DECAY = 0.028;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life -= PARTICLE_DECAY;
        p.size *= 0.97;
      });
      particles = particles.filter(p => p.life > 0 && p.size > 0.5);

      // Update floating texts
      floatingTexts.forEach(t => { t.y += t.vy; t.life--; });
      floatingTexts = floatingTexts.filter(t => t.life > 0);

      // ─── Draw ──────────────────────────────────────────────────────────────
      drawBackground();
      drawTwinkleStars();
      planets.forEach(drawPlanet);
      drawParticles();
      collectibles.forEach(drawCollectible);
      obstacles.forEach(drawObstacle);
      drawRocket();
      drawFloatingTexts();
      drawHUD();

      if (!destroyed) animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
    };
  }, [gameState, selectedChar]);

  // ─── Select Screen ──────────────────────────────────────────────────────────

  if (gameState === 'select') {
    return (
      <>
        <style>{`
          @keyframes float-char { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-8px) scale(1.04)} }
          @keyframes twinkle { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
          @keyframes drift { 0%{transform:translateX(0)} 100%{transform:translateX(-5px)} }
          .char-btn { transition: transform 0.15s, box-shadow 0.15s; }
          .char-btn:active { transform: scale(0.93); }
        `}</style>

        <div style={{
          minHeight: '100dvh',
          background: 'linear-gradient(160deg, #E8D5FF 0%, #D4E8FF 45%, #FFD4EC 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '24px 20px', position: 'relative', overflow: 'hidden',
        }}>
          {/* Floating decorations */}
          {['⭐', '🌟', '🌙', '✨', '💫', '🪐'].map((s, i) => (
            <span key={i} style={{
              position: 'absolute', fontSize: '20px', opacity: 0.55,
              top: `${10 + i * 14}%`, left: i % 2 === 0 ? `${4 + i * 3}%` : `${80 - i * 4}%`,
              animation: `twinkle ${2 + i * 0.4}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
              userSelect: 'none', pointerEvents: 'none',
            }}>{s}</span>
          ))}

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🚀</div>
            <h1 style={{
              fontSize: '26px', fontWeight: 900,
              background: 'linear-gradient(135deg, #9B5EA7, #5E7EBF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              margin: 0, letterSpacing: '-0.5px',
            }}>우주탐험</h1>
            <p style={{ color: '#AA77CC', fontSize: '13px', marginTop: '6px', fontWeight: 600 }}>
              누구랑 우주로 날아갈까? 🌟
            </p>
          </div>

          {/* Character buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '320px' }}>
            {CHARACTERS.map((c, i) => (
              <button
                key={c.name}
                className="char-btn"
                onClick={() => startGame(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  background: 'rgba(255,255,255,0.75)',
                  border: `2.5px solid ${c.color}40`,
                  borderRadius: '20px', padding: '14px 18px',
                  cursor: 'pointer', boxShadow: `0 4px 18px ${c.color}25`,
                  backdropFilter: 'blur(8px)',
                  animation: `float-char ${2.2 + i * 0.2}s ease-in-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${c.color}33, ${c.color}66)`,
                  border: `3px solid ${c.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', flexShrink: 0,
                }}>
                  {c.emoji}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#5A3A7A', lineHeight: 1.2 }}>{c.name}</div>
                  <div style={{ fontSize: '12px', color: '#9B77C0', marginTop: '3px' }}>{c.desc}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '18px', color: `${c.color}AA` }}>▶</div>
              </button>
            ))}
          </div>

          {/* Hint */}
          <p style={{ color: '#BB99DD', fontSize: '11px', marginTop: '24px', textAlign: 'center', lineHeight: 1.6 }}>
            손가락으로 드래그해서 로켓을 조종해요!<br />
            별과 보석을 모으고 장애물을 피하세요 🌠
          </p>

          {/* Back */}
          <Link href="/" style={{
            marginTop: '16px', color: '#AA88CC', fontSize: '13px',
            textDecoration: 'none', fontWeight: 600, opacity: 0.8,
          }}>← 홈으로</Link>
        </div>
      </>
    );
  }

  // ─── Game Over Screen ───────────────────────────────────────────────────────

  if (gameState === 'over') {
    const char = CHARACTERS[selectedChar!];
    return (
      <>
        <style>{`
          @keyframes pop-in { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
          @keyframes float-icon { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        `}</style>
        <div style={{
          minHeight: '100dvh',
          background: 'linear-gradient(160deg, #E8D5FF 0%, #D4E8FF 45%, #FFD4EC 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '24px', textAlign: 'center',
        }}>
          <div style={{ animation: 'pop-in 0.5s ease-out forwards' }}>
            <div style={{ fontSize: '64px', marginBottom: '8px', animation: 'float-icon 2s ease-in-out infinite' }}>🚀</div>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#7B5EA7', margin: '0 0 6px' }}>우주여행 끝!</h2>
            <p style={{ color: '#AA88CC', fontSize: '14px', margin: '0 0 24px' }}>{char.name}이(가) 돌아왔어요 {char.heart}</p>

            <div style={{
              background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
              borderRadius: '24px', padding: '22px 32px', marginBottom: '24px',
              boxShadow: '0 6px 24px rgba(155,94,167,0.15)', border: '2px solid rgba(255,255,255,0.8)',
            }}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', color: '#BB99DD', fontWeight: 600 }}>비행 거리</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#7B5EA7', lineHeight: 1.2 }}>{finalDistance}m</div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#BB99DD', fontWeight: 600 }}>수집 점수</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#F39C12', lineHeight: 1.2 }}>⭐ {finalScore}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '260px' }}>
              <button
                onClick={restartGame}
                style={{
                  background: `linear-gradient(135deg, ${char.color}, ${char.color}BB)`,
                  color: 'white', border: 'none', borderRadius: '16px',
                  padding: '16px 24px', fontSize: '17px', fontWeight: 800,
                  cursor: 'pointer', boxShadow: `0 4px 16px ${char.color}44`,
                  letterSpacing: '0.3px',
                }}
              >
                🚀 다시 탐험!
              </button>
              <button
                onClick={() => setGameState('select')}
                style={{
                  background: 'rgba(255,255,255,0.8)', color: '#9B77C0',
                  border: '2px solid #D4B3FF', borderRadius: '16px',
                  padding: '14px 24px', fontSize: '15px', fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                👾 캐릭터 바꾸기
              </button>
              <Link href="/" style={{
                color: '#AA88CC', fontSize: '13px', textDecoration: 'none',
                fontWeight: 600, marginTop: '4px',
              }}>← 홈으로 돌아가기</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Playing ────────────────────────────────────────────────────────────────

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100vw',
        height: '100dvh',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: 'none',
      }}
    />
  );
}
