'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { saveScore } from '@/lib/ranking';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Character {
  name: string;
  color: string;
  emoji: string;
  heart: string;
}

interface BGMNote {
  freq: number;
  duration: number;
  delay: number;
}

interface Song {
  id: number;
  title: string;
  artist: string;
  bpm: number;
  difficulty: number;
  color: string;
  accentColor: string;
  lyrics: LyricLine[];
  notePattern: NoteSection[];
  waveType: OscillatorType;
  melodyNotes: number[];
  bassNote: number;
}

interface LyricLine {
  time: number;
  text: string;
  subText?: string;
}

interface NoteSection {
  start: number;
  intervalMs: number;
  count: number;
  pattern: 'single' | 'pair' | 'triple';
}

interface Note {
  id: number;
  lane: number; // 0-4
  y: number;
  hitTime: number;
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
  type: 'sparkle' | 'burst' | 'heart';
  char?: string;
}

interface JudgeEffect {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
}

interface LaneGlow {
  lane: number;
  life: number;
  maxLife: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CHARACTERS: Character[] = [
  { name: '승민', color: '#3B82F6', emoji: '🤖', heart: '💙' },
  { name: '건우', color: '#10B981', emoji: '🩺', heart: '💚' },
  { name: '강우', color: '#F59E0B', emoji: '👨‍🍳', heart: '🧡' },
  { name: '수현', color: '#EC4899', emoji: '💃', heart: '💗' },
  { name: '이현', color: '#FF69B4', emoji: '👸', heart: '💖' },
  { name: '준영', color: '#6366F1', emoji: '📚', heart: '💜' },
  { name: '준우', color: '#0EA5E9', emoji: '✈️', heart: '💎' },
];

// 5 lane colors: pink, mint, lavender, peach, sky blue
const LANE_COLORS = ['#FFB3C6', '#B3F0DC', '#C9B3F5', '#FFD4B3', '#B3D9FF'];
const LANE_GLOW_COLORS = ['#FF6B9D', '#4ECDC4', '#9B59B6', '#FF8C42', '#0EA5E9'];
const NOTE_COLORS = ['#FF8FAB', '#5CE1C0', '#B48EF7', '#FFB366', '#5BB8FF'];
const KEY_LABELS = ['D', 'F', 'J', 'K', 'L'];

const TIMING = { PERFECT: 80, GREAT: 150, GOOD: 250 };
const TIMING_SCORES = { PERFECT: 300, GREAT: 200, GOOD: 100 };
const TIMING_HEALTH = { PERFECT: 2, GREAT: 0, GOOD: 0, MISS: -15 };

const NOTE_SYMBOLS = ['♪', '♫', '♩', '♬', '♪'];

const SONG_DURATION = 50000;
const HIT_ZONE_Y_RATIO = 0.82;
const NOTE_TRAVEL_TIME = 2500;
const HEALTH_MAX = 100;
const NUM_LANES = 5;

// ─── BGM Builder helpers ───────────────────────────────────────────────────────
function buildMelodyLoop(
  notes: number[],        // frequencies in order
  noteDuration: number,   // seconds each note lasts
  totalDuration: number,  // total song duration in seconds
  startDelay = 0,
  volume = 0.12,
  type: OscillatorType = 'sine',
): BGMNote[] {
  const result: BGMNote[] = [];
  let t = startDelay;
  let idx = 0;
  while (t < totalDuration - noteDuration) {
    result.push({ freq: notes[idx % notes.length], duration: noteDuration, delay: t });
    t += noteDuration;
    idx++;
  }
  void volume; void type;
  return result;
}

function buildBassLoop(
  notes: number[],
  noteDuration: number,
  totalDuration: number,
  startDelay = 0,
): BGMNote[] {
  return buildMelodyLoop(notes.map(f => f / 2), noteDuration, totalDuration, startDelay, 0.1, 'triangle');
}

// ─── Songs ────────────────────────────────────────────────────────────────────
const SONGS: Song[] = [
  { id:0, title:'신나는 댄스', artist:'DJ 미니', bpm:128, difficulty:2, color:'#FF6B9D', accentColor:'#FF2D7B',
    waveType:'square' as OscillatorType, melodyNotes:[523,659,784,1047,784,659], bassNote:262,
    lyrics:[{time:0,text:'신나게 춤춰봐! 💃'},{time:5000,text:'리듬을 느껴봐!'},{time:10000,text:'음악이 흘러~'},{time:15000,text:'멈추지 마!'},{time:20000,text:'더 더 더!'},{time:30000,text:'끝까지 가자!'},{time:40000,text:'신나는 댄스!'}],
    notePattern:[{start:500,intervalMs:468,count:20,pattern:'single'},{start:10000,intervalMs:468,count:25,pattern:'pair'},{start:22000,intervalMs:468,count:30,pattern:'single'}] },

  { id:1, title:'달콤한 꿈', artist:'꿈나라', bpm:90, difficulty:1, color:'#A78BFA', accentColor:'#7C3AED',
    waveType:'sine' as OscillatorType, melodyNotes:[349,440,523,587,523,440,349], bassNote:175,
    lyrics:[{time:0,text:'달콤한 꿈속에서 🌙'},{time:6000,text:'구름 위를 걸어요'},{time:12000,text:'별들이 반짝여'},{time:20000,text:'잠이 솔솔~'},{time:30000,text:'좋은 꿈 꿔요'},{time:40000,text:'달콤한 꿈~ ✨'}],
    notePattern:[{start:1000,intervalMs:667,count:15,pattern:'single'},{start:12000,intervalMs:667,count:20,pattern:'single'},{start:26000,intervalMs:667,count:20,pattern:'pair'}] },

  { id:2, title:'로켓 발사', artist:'우주소년', bpm:160, difficulty:4, color:'#F97316', accentColor:'#EA580C',
    waveType:'sawtooth' as OscillatorType, melodyNotes:[220,262,294,330,392,440], bassNote:110,
    lyrics:[{time:0,text:'로켓 발사! 3,2,1! 🚀'},{time:4000,text:'하늘을 뚫고!'},{time:8000,text:'우주로 GO!'},{time:15000,text:'별들 사이를!'},{time:25000,text:'빠르게 날아!'},{time:35000,text:'끝까지!'},{time:45000,text:'도착! 🌟'}],
    notePattern:[{start:300,intervalMs:375,count:25,pattern:'single'},{start:10000,intervalMs:375,count:30,pattern:'pair'},{start:22000,intervalMs:375,count:35,pattern:'triple'}] },

  { id:3, title:'봄바람', artist:'꽃요정', bpm:110, difficulty:2, color:'#34D399', accentColor:'#059669',
    waveType:'triangle' as OscillatorType, melodyNotes:[392,494,587,659,587,494], bassNote:196,
    lyrics:[{time:0,text:'봄바람이 불어와 🌸'},{time:6000,text:'꽃잎이 날려~'},{time:12000,text:'나비가 춤춰요'},{time:20000,text:'봄이 왔어요!'},{time:30000,text:'따뜻한 바람~'},{time:40000,text:'봄바람~ 🌷'}],
    notePattern:[{start:600,intervalMs:545,count:18,pattern:'single'},{start:11000,intervalMs:545,count:22,pattern:'pair'},{start:24000,intervalMs:545,count:20,pattern:'single'}] },

  { id:4, title:'해적왕', artist:'캡틴 강', bpm:140, difficulty:3, color:'#EAB308', accentColor:'#CA8A04',
    waveType:'square' as OscillatorType, melodyNotes:[294,349,440,587,440,349,294], bassNote:147,
    lyrics:[{time:0,text:'해적왕이 되겠다! 🏴‍☠️'},{time:5000,text:'보물을 찾아서!'},{time:10000,text:'바다를 건너!'},{time:18000,text:'모험이다!'},{time:28000,text:'앞으로!'},{time:38000,text:'해적왕! 👑'}],
    notePattern:[{start:400,intervalMs:428,count:22,pattern:'single'},{start:10000,intervalMs:428,count:28,pattern:'pair'},{start:22000,intervalMs:428,count:25,pattern:'triple'}] },

  { id:5, title:'별빛 축제', artist:'스타즈', bpm:120, difficulty:2, color:'#60A5FA', accentColor:'#2563EB',
    waveType:'sine' as OscillatorType, melodyNotes:[311,392,466,523,466,392], bassNote:156,
    lyrics:[{time:0,text:'별빛이 반짝반짝 ⭐'},{time:6000,text:'축제가 시작됐어!'},{time:12000,text:'다같이 놀자!'},{time:20000,text:'불꽃놀이! 🎆'},{time:30000,text:'신나는 밤!'},{time:40000,text:'별빛 축제! ✨'}],
    notePattern:[{start:500,intervalMs:500,count:20,pattern:'single'},{start:11000,intervalMs:500,count:22,pattern:'pair'},{start:23000,intervalMs:500,count:22,pattern:'single'}] },

  { id:6, title:'쿵쿵따', artist:'MC 붐', bpm:100, difficulty:3, color:'#A3A3A3', accentColor:'#525252',
    waveType:'sawtooth' as OscillatorType, melodyNotes:[165,196,220,247,220,196], bassNote:82,
    lyrics:[{time:0,text:'쿵 쿵 따! 🎤'},{time:6000,text:'리듬을 타봐!'},{time:12000,text:'몸을 흔들어!'},{time:20000,text:'쿵쿵따!'},{time:30000,text:'다같이!'},{time:40000,text:'쿵! 쿵! 따! 🔥'}],
    notePattern:[{start:800,intervalMs:600,count:16,pattern:'single'},{start:11000,intervalMs:600,count:20,pattern:'pair'},{start:24000,intervalMs:600,count:18,pattern:'single'}] },

  { id:7, title:'무지개 달리기', artist:'해피', bpm:150, difficulty:3, color:'#FB923C', accentColor:'#EA580C',
    waveType:'triangle' as OscillatorType, melodyNotes:[466,587,698,932,698,587], bassNote:233,
    lyrics:[{time:0,text:'무지개를 따라서 🌈'},{time:4500,text:'달려라 달려!'},{time:9000,text:'빨주노초파남보!'},{time:16000,text:'더 빠르게!'},{time:26000,text:'거의 다 왔어!'},{time:36000,text:'무지개 끝! 🏆'}],
    notePattern:[{start:300,intervalMs:400,count:22,pattern:'single'},{start:9500,intervalMs:400,count:28,pattern:'pair'},{start:21000,intervalMs:400,count:30,pattern:'triple'}] },

  { id:8, title:'마법의 성', artist:'위즈', bpm:105, difficulty:2, color:'#C084FC', accentColor:'#9333EA',
    waveType:'sine' as OscillatorType, melodyNotes:[415,523,622,831,622,523,415], bassNote:208,
    lyrics:[{time:0,text:'마법의 성에서 ✨'},{time:6000,text:'요정이 춤춰요'},{time:12000,text:'마법의 주문!'},{time:20000,text:'번쩍번쩍!'},{time:30000,text:'마법 완성!'},{time:40000,text:'마법의 성! 🏰'}],
    notePattern:[{start:700,intervalMs:571,count:18,pattern:'single'},{start:11500,intervalMs:571,count:20,pattern:'pair'},{start:24000,intervalMs:571,count:18,pattern:'single'}] },

  { id:9, title:'번개 맨', artist:'썬더', bpm:170, difficulty:5, color:'#FACC15', accentColor:'#EAB308',
    waveType:'square' as OscillatorType, melodyNotes:[247,294,370,440,494], bassNote:123,
    lyrics:[{time:0,text:'번개처럼 빠르게! ⚡'},{time:3500,text:'더 빠르게!'},{time:7000,text:'멈출 수 없어!'},{time:14000,text:'번개 맨!'},{time:22000,text:'최고 속도!'},{time:32000,text:'번개! ⚡⚡⚡'},{time:42000,text:'끝이다!'}],
    notePattern:[{start:200,intervalMs:353,count:28,pattern:'single'},{start:10000,intervalMs:353,count:35,pattern:'pair'},{start:23000,intervalMs:353,count:35,pattern:'triple'}] },
];

// ─── Note generator ────────────────────────────────────────────────────────────
function generateNotesForSong(song: Song): Note[] {
  const notes: Note[] = [];
  let id = 0;
  // Distribute across 5 lanes
  const laneSeq = [0, 2, 4, 1, 3, 2, 0, 4, 1, 3, 0, 2, 4, 3, 1, 2, 0, 3, 4, 1];
  let seqIdx = 0;

  for (const section of song.notePattern) {
    for (let i = 0; i < section.count; i++) {
      const hitTime = section.start + i * section.intervalMs;
      if (hitTime > SONG_DURATION - 1000) break;

      const lane = laneSeq[seqIdx % laneSeq.length];
      seqIdx++;

      notes.push({
        id: id++,
        lane,
        y: -60,
        hitTime,
        hit: false,
        missed: false,
        symbol: NOTE_SYMBOLS[id % NOTE_SYMBOLS.length],
      });

      if (section.pattern === 'pair' && i % 2 === 1) {
        const lane2 = (lane + 2) % NUM_LANES;
        const t2 = hitTime + Math.round(section.intervalMs * 0.35);
        if (t2 < SONG_DURATION - 500) {
          notes.push({
            id: id++,
            lane: lane2,
            y: -60,
            hitTime: t2,
            hit: false,
            missed: false,
            symbol: NOTE_SYMBOLS[(id + 2) % NOTE_SYMBOLS.length],
          });
        }
      }

      if (section.pattern === 'triple' && i % 3 === 2) {
        const lane3 = (lane + 4) % NUM_LANES;
        const t3 = hitTime + Math.round(section.intervalMs * 0.5);
        if (t3 < SONG_DURATION - 500) {
          notes.push({
            id: id++,
            lane: lane3,
            y: -60,
            hitTime: t3,
            hit: false,
            missed: false,
            symbol: NOTE_SYMBOLS[(id + 1) % NOTE_SYMBOLS.length],
          });
        }
      }
    }
  }

  return notes.sort((a, b) => a.hitTime - b.hitTime);
}

// ─── Audio ────────────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function scheduleDrumBeat(ctx: AudioContext, bpm: number, totalDuration: number) {
  const beatInterval = 60 / bpm;
  for (let t = 0; t < totalDuration; t += beatInterval) {
    // Kick drum on every beat
    const kickOsc = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kickOsc.connect(kickGain);
    kickGain.connect(ctx.destination);
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(150, ctx.currentTime + t);
    kickOsc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + t + 0.1);
    kickGain.gain.setValueAtTime(0.28, ctx.currentTime + t);
    kickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.1);
    kickOsc.start(ctx.currentTime + t);
    kickOsc.stop(ctx.currentTime + t + 0.12);

    // Hi-hat on off-beats
    const halfBeat = t + beatInterval / 2;
    if (halfBeat < totalDuration) {
      const bufSize = ctx.sampleRate * 0.05;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let s = 0; s < bufSize; s++) data[s] = (Math.random() * 2 - 1);
      const source = ctx.createBufferSource();
      source.buffer = buf;
      const hihatGain = ctx.createGain();
      const hihatFilter = ctx.createBiquadFilter();
      hihatFilter.type = 'highpass';
      hihatFilter.frequency.value = 7000;
      source.connect(hihatFilter);
      hihatFilter.connect(hihatGain);
      hihatGain.connect(ctx.destination);
      hihatGain.gain.setValueAtTime(0.06, ctx.currentTime + halfBeat);
      hihatGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + halfBeat + 0.05);
      source.start(ctx.currentTime + halfBeat);
      source.stop(ctx.currentTime + halfBeat + 0.05);
    }

    // Snare on beats 2 and 4 of every bar
    const beatInBar = Math.round(t / beatInterval) % 4;
    if (beatInBar === 1 || beatInBar === 3) {
      const snareSize = ctx.sampleRate * 0.15;
      const snareBuf = ctx.createBuffer(1, snareSize, ctx.sampleRate);
      const snareData = snareBuf.getChannelData(0);
      for (let s = 0; s < snareSize; s++) snareData[s] = (Math.random() * 2 - 1) * Math.exp(-s / (snareSize * 0.3));
      const snareSource = ctx.createBufferSource();
      snareSource.buffer = snareBuf;
      const snareGain = ctx.createGain();
      snareSource.connect(snareGain);
      snareGain.connect(ctx.destination);
      snareGain.gain.setValueAtTime(0.12, ctx.currentTime + t);
      snareGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      snareSource.start(ctx.currentTime + t);
      snareSource.stop(ctx.currentTime + t + 0.15);
    }
  }
}

function playBGM(ctx: AudioContext, notes: BGMNote[], volume = 0.12, type: OscillatorType = 'sine') {
  notes.forEach(note => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime + note.delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.delay + note.duration - 0.02);
    osc.start(ctx.currentTime + note.delay);
    osc.stop(ctx.currentTime + note.delay + note.duration);
  });
}

function startBGM(song: Song) {
  try {
    const ctx = getAudioCtx();
    const durSec = SONG_DURATION / 1000;
    const beat = 60 / song.bpm;

    // Melody using song's waveType and melodyNotes
    const melodyBGM = buildMelodyLoop(song.melodyNotes, beat, durSec);
    playBGM(ctx, melodyBGM, 0.1, song.waveType);

    // Bass line using song's bassNote
    const bassNotes = [song.bassNote, song.bassNote * 1.25, song.bassNote * 1.5];
    const bassBGM = buildBassLoop(bassNotes, beat * 2, durSec);
    playBGM(ctx, bassBGM, 0.09, 'triangle');

    // Drum beat
    scheduleDrumBeat(ctx, song.bpm, durSec);

    // Pad chord layer
    const padFreqs = [song.melodyNotes[0], song.melodyNotes[2], song.melodyNotes[4] ?? song.melodyNotes[0]];
    padFreqs.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq * 0.5;
      gain.gain.setValueAtTime(0, ctx.currentTime + beat);
      gain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + beat * 2);
      gain.gain.setValueAtTime(0.025, ctx.currentTime + durSec - beat);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durSec);
      osc.start(ctx.currentTime + beat);
      osc.stop(ctx.currentTime + durSec);
    });
  } catch (_) { /* ignore */ }
}

function stopBGM() {
  try {
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close();
      audioCtx = null;
    }
  } catch (_) { /* ignore */ }
}

function playHitSound(lane: number, grade: 'PERFECT' | 'GREAT' | 'GOOD', scaleFreqs: number[]) {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const baseIdx = lane * 1;
    const freqs = [
      scaleFreqs[baseIdx % scaleFreqs.length],
      scaleFreqs[(baseIdx + 2) % scaleFreqs.length],
      scaleFreqs[(baseIdx + 4) % scaleFreqs.length],
    ];

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.22, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    gainNode.connect(ctx.destination);

    const count = grade === 'PERFECT' ? 3 : grade === 'GREAT' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i], now);
      osc.connect(gainNode);
      osc.start(now + i * 0.02);
      osc.stop(now + 0.35);
    }

    if (grade === 'PERFECT') {
      const shimmer = ctx.createOscillator();
      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(freqs[2] * 2, now);
      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(0.06, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      shimmer.connect(sGain);
      sGain.connect(ctx.destination);
      shimmer.start(now);
      shimmer.stop(now + 0.22);
    }
  } catch (_) { /* ignore */ }
}

function playMissSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    g.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch (_) { /* ignore */ }
}

function playSelectSound(freq: number) {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    g.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch (_) { /* ignore */ }
}

// ─── Main Component ───────────────────────────────────────────────────────────
type Phase = 'charSelect' | 'songSelect' | 'playing' | 'result';

export default function RhythmPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('charSelect');
  const [phase, setPhase] = useState<Phase>('charSelect');
  const charRef = useRef<Character>(CHARACTERS[0]);
  const songRef = useRef<Song>(SONGS[0]);
  const [selectedChar, setSelectedChar] = useState<Character>(CHARACTERS[0]);
  const [selectedSong, setSelectedSong] = useState<Song>(SONGS[0]);

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
  const canvasSizeRef = useRef({ w: 390, h: 844 });
  const currentLyricIdxRef = useRef(0);
  const lyricFlashRef = useRef(0);
  const bgmStartedRef = useRef(false);

  const [resultData, setResultData] = useState({
    score: 0, maxCombo: 0, perfect: 0, great: 0, good: 0, miss: 0, grade: 'C', songTitle: '',
  });

  const getLayout = useCallback((w: number, h: number) => {
    const laneWidth = w / NUM_LANES;
    const hitZoneY = h * HIT_ZONE_Y_RATIO;
    const noteRadius = Math.min(laneWidth * 0.28, 26);
    return { laneWidth, hitZoneY, noteRadius };
  }, []);

  const spawnSparkles = useCallback((x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const spd = 2 + Math.random() * 4;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 1.5,
        life: 45 + Math.random() * 20,
        maxLife: 65,
        color,
        size: 3 + Math.random() * 5,
        type: 'sparkle',
      });
    }
  }, []);

  const spawnBurst = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 7; i++) {
      const angle = (Math.PI * 2 * i) / 7;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 5,
        life: 28,
        maxLife: 28,
        color,
        size: 9,
        type: 'burst',
      });
    }
  }, []);

  const spawnHeart = useCallback((x: number, y: number, char: string) => {
    particlesRef.current.push({
      x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: -3 - Math.random() * 2,
      life: 60,
      maxLife: 60,
      color: '#FF6B9D',
      size: 18,
      type: 'heart',
      char,
    });
  }, []);

  const judgeTap = useCallback((lane: number) => {
    const { w, h } = canvasSizeRef.current;
    const { hitZoneY, laneWidth } = getLayout(w, h);
    const elapsed = performance.now() - startTimeRef.current;

    let bestNote: Note | null = null;
    let bestDelta = Infinity;
    for (const note of notesRef.current) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const delta = Math.abs(elapsed - note.hitTime);
      if (delta < bestDelta && delta <= TIMING.GOOD + 60) {
        bestDelta = delta;
        bestNote = note;
      }
    }

    const laneX = lane * laneWidth + laneWidth / 2;
    laneGlowsRef.current.push({ lane, life: 20, maxLife: 20 });

    if (!bestNote) return;

    bestNote.hit = true;
    const song = songRef.current;
    let grade: 'PERFECT' | 'GREAT' | 'GOOD';

    if (bestDelta <= TIMING.PERFECT) {
      grade = 'PERFECT';
      countPerfectRef.current++;
      const mult = Math.max(1, Math.floor(comboRef.current / 10) + 1);
      scoreRef.current += TIMING_SCORES.PERFECT * mult;
      healthRef.current = Math.min(HEALTH_MAX, healthRef.current + TIMING_HEALTH.PERFECT);
      spawnSparkles(laneX, hitZoneY, LANE_GLOW_COLORS[lane], 16);
      spawnBurst(laneX, hitZoneY, '#FFD700');
      spawnHeart(laneX, hitZoneY - 30, charRef.current.heart);
      judgeEffectsRef.current.push({
        text: 'PERFECT ✨', x: laneX, y: hitZoneY - 40,
        life: 55, maxLife: 55, color: '#FFD700', scale: 1.3,
      });
    } else if (bestDelta <= TIMING.GREAT) {
      grade = 'GREAT';
      countGreatRef.current++;
      const mult = Math.max(1, Math.floor(comboRef.current / 10) + 1);
      scoreRef.current += TIMING_SCORES.GREAT * mult;
      spawnSparkles(laneX, hitZoneY, LANE_GLOW_COLORS[lane], 8);
      judgeEffectsRef.current.push({
        text: 'GREAT 💫', x: laneX, y: hitZoneY - 40,
        life: 50, maxLife: 50, color: '#A8E6CF', scale: 1.15,
      });
    } else {
      grade = 'GOOD';
      countGoodRef.current++;
      scoreRef.current += TIMING_SCORES.GOOD;
      judgeEffectsRef.current.push({
        text: 'GOOD 🎶', x: laneX, y: hitZoneY - 40,
        life: 45, maxLife: 45, color: '#DDA0DD', scale: 1.0,
      });
    }

    comboRef.current++;
    if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
    hitZoneGlowRef.current = 22;
    playHitSound(lane, grade, song.melodyNotes);
  }, [getLayout, spawnSparkles, spawnBurst, spawnHeart]);

  const drawLyrics = useCallback((
    ctx: CanvasRenderingContext2D, w: number, elapsed: number, song: Song
  ) => {
    const lyrics = song.lyrics;
    let lyricIdx = 0;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (elapsed >= lyrics[i].time) { lyricIdx = i; break; }
    }
    if (lyricIdx !== currentLyricIdxRef.current) {
      currentLyricIdxRef.current = lyricIdx;
      lyricFlashRef.current = 30;
    }
    const lyric = lyrics[lyricIdx];
    const flashAlpha = lyricFlashRef.current > 0 ? 0.7 + (lyricFlashRef.current / 30) * 0.3 : 1.0;
    if (lyricFlashRef.current > 0) lyricFlashRef.current--;
    const nextLyric = lyrics[lyricIdx + 1];

    const panelH = 78;
    const panelY = 52;
    const panelGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
    panelGrad.addColorStop(0, song.color + '33');
    panelGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = panelGrad;
    ctx.fillRect(0, panelY, w, panelH);

    const mainFontSize = Math.min(w * 0.058, 26);
    ctx.font = `bold ${mainFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = song.color;
    ctx.shadowBlur = 18 + (lyricFlashRef.current > 0 ? 12 : 0);
    ctx.fillText(lyric.text, w / 2, panelY + 22);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (lyric.subText) {
      ctx.font = `${Math.min(w * 0.038, 15)}px sans-serif`;
      ctx.fillStyle = song.accentColor;
      ctx.globalAlpha = 0.85 * flashAlpha;
      ctx.fillText(lyric.subText, w / 2, panelY + 48);
      ctx.globalAlpha = 1;
    }

    if (nextLyric && elapsed >= nextLyric.time - 2000) {
      const timeUntilNext = nextLyric.time - elapsed;
      const previewAlpha = Math.max(0, 1 - timeUntilNext / 2000) * 0.4;
      ctx.font = `${Math.min(w * 0.034, 13)}px sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = previewAlpha;
      ctx.fillText(`▶ ${nextLyric.text}`, w / 2, panelY + 68);
      ctx.globalAlpha = 1;
    }
  }, []);

  const endGame = useCallback(() => {
    phaseRef.current = 'result';
    stopBGM();
    const total = countPerfectRef.current + countGreatRef.current + countGoodRef.current + countMissRef.current;
    const acc = total > 0
      ? (countPerfectRef.current * 300 + countGreatRef.current * 200 + countGoodRef.current * 100) / (total * 300)
      : 0;
    let grade = 'C';
    if (acc >= 0.95) grade = 'S';
    else if (acc >= 0.82) grade = 'A';
    else if (acc >= 0.65) grade = 'B';
    setResultData({
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfect: countPerfectRef.current,
      great: countGreatRef.current,
      good: countGoodRef.current,
      miss: countMissRef.current,
      grade,
      songTitle: songRef.current.title,
    });
    saveScore('rhythm', charRef.current.name, scoreRef.current);
    setPhase('result');
  }, []);

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, timestamp: number) => {
    const w = canvasSizeRef.current.w;
    const h = canvasSizeRef.current.h;
    const { laneWidth, hitZoneY, noteRadius } = getLayout(w, h);
    const elapsed = timestamp - startTimeRef.current;
    const song = songRef.current;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#12082A');
    bg.addColorStop(0.45, '#1A1040');
    bg.addColorStop(1, '#0D0822');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (let i = 0; i < 40; i++) {
      const blink = Math.sin(elapsed * 0.001 + i * 1.7) * 0.5 + 0.5;
      const sx = ((i * 137.5 + elapsed * 0.004) % (w + 10)) - 5;
      const sy = ((i * 83.1) % h);
      ctx.fillStyle = `rgba(255,255,255,${0.12 + blink * 0.3})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bottom glow
    const pulse = Math.sin(elapsed * 0.003) * 0.5 + 0.5;
    const bottomGlow = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, w * 0.85);
    const hexGlow = Math.round(25 + pulse * 18).toString(16).padStart(2, '0');
    bottomGlow.addColorStop(0, song.color + hexGlow);
    bottomGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = bottomGlow;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);

    // Lane backgrounds
    const laneGlows = laneGlowsRef.current;
    for (let i = 0; i < NUM_LANES; i++) {
      const lx = i * laneWidth;
      const activeGlow = laneGlows.find(g => g.lane === i);
      const ga = activeGlow ? activeGlow.life / activeGlow.maxLife : 0;

      ctx.fillStyle = `rgba(255,255,255,${0.018 + ga * 0.1})`;
      ctx.fillRect(lx, 0, laneWidth, h);

      if (ga > 0) {
        const gg = ctx.createRadialGradient(
          lx + laneWidth / 2, hitZoneY, 0,
          lx + laneWidth / 2, hitZoneY, laneWidth * 1.2
        );
        gg.addColorStop(0, LANE_GLOW_COLORS[i] + Math.round(ga * 90).toString(16).padStart(2, '0'));
        gg.addColorStop(1, 'transparent');
        ctx.fillStyle = gg;
        ctx.fillRect(lx, hitZoneY - laneWidth * 1.2, laneWidth, laneWidth * 2.4);
      }
    }

    // Lane dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < NUM_LANES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, h);
      ctx.stroke();
    }

    // Hit zone line
    const hzG = hitZoneGlowRef.current;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + (hzG / 22) * 0.5})`;
    ctx.lineWidth = 2 + (hzG / 22) * 2;
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 6 + hzG * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, hitZoneY);
    ctx.lineTo(w, hitZoneY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Hit zone circles per lane
    for (let i = 0; i < NUM_LANES; i++) {
      const cx = i * laneWidth + laneWidth / 2;
      const ag = laneGlows.find(g => g.lane === i);
      const ga = ag ? ag.life / ag.maxLife : 0;
      const r = noteRadius * 1.15 + ga * 7;

      ctx.beginPath();
      ctx.arc(cx, hitZoneY, r, 0, Math.PI * 2);
      ctx.strokeStyle = LANE_COLORS[i] + 'CC';
      ctx.lineWidth = 2 + ga * 2;
      ctx.shadowColor = LANE_GLOW_COLORS[i];
      ctx.shadowBlur = 10 + ga * 16;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(cx, hitZoneY, r * 0.5, 0, Math.PI * 2);
      const fillAlpha = Math.round(20 + ga * 50).toString(16).padStart(2, '0');
      ctx.fillStyle = LANE_COLORS[i] + fillAlpha;
      ctx.fill();

      // Key label below hit zone
      ctx.font = `bold ${Math.min(laneWidth * 0.28, 13)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = LANE_COLORS[i] + 'AA';
      ctx.fillText(KEY_LABELS[i], cx, hitZoneY + noteRadius * 2.2);
    }

    // Notes
    const notes = notesRef.current;
    for (const note of notes) {
      if (note.hit || note.missed) continue;

      const timeUntilHit = note.hitTime - elapsed;
      const noteY = hitZoneY - (timeUntilHit / NOTE_TRAVEL_TIME) * hitZoneY;

      if (noteY < -noteRadius * 3 || noteY > h + noteRadius) continue;
      note.y = noteY;

      const cx = note.lane * laneWidth + laneWidth / 2;
      const color = NOTE_COLORS[note.lane];

      // Trail
      const trailAlpha = Math.min(1, (noteY + noteRadius * 3) / (noteRadius * 6));
      ctx.globalAlpha = trailAlpha * 0.22;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, noteY + noteRadius * 1.1, noteRadius * 0.65, noteRadius * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Note glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 13;

      const grad = ctx.createRadialGradient(
        cx - noteRadius * 0.3, noteY - noteRadius * 0.3, 1,
        cx, noteY, noteRadius
      );
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.3, color + 'EE');
      grad.addColorStop(1, color + '88');
      ctx.beginPath();
      ctx.arc(cx, noteY, noteRadius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${noteRadius * 0.78}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(note.symbol, cx, noteY);

      // Auto miss
      if (elapsed - note.hitTime > TIMING.GOOD + 80) {
        note.missed = true;
        comboRef.current = 0;
        countMissRef.current++;
        healthRef.current = Math.max(0, healthRef.current + TIMING_HEALTH.MISS);
        judgeEffectsRef.current.push({
          text: 'MISS 💔', x: cx, y: hitZoneY - 40,
          life: 38, maxLife: 38, color: '#FF6B6B', scale: 1.0,
        });
        playMissSound();
      }
    }

    // Particles
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      if (p.type === 'heart' && p.char) {
        ctx.font = `${p.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.char, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.type === 'sparkle' ? 8 : 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }

    // Judge effects
    const effects = judgeEffectsRef.current;
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.life--;
      e.y -= 0.75;
      if (e.life <= 0) { effects.splice(i, 1); continue; }
      const alpha = Math.min(1, (e.life / e.maxLife) * 2.2);
      const scaleVal = e.scale + (1 - e.life / e.maxLife) * 0.12;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 12;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(scaleVal, scaleVal);
      ctx.font = `bold ${Math.min(w * 0.045, 17)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.text, 0, 0);
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Tick lane glows
    for (let i = laneGlows.length - 1; i >= 0; i--) {
      laneGlows[i].life--;
      if (laneGlows[i].life <= 0) laneGlows.splice(i, 1);
    }
    if (hitZoneGlowRef.current > 0) hitZoneGlowRef.current--;

    // ── HUD ───────────────────────────────────────────────────────────
    const score = scoreRef.current;
    const combo = comboRef.current;
    const health = healthRef.current;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, 52);

    ctx.font = `bold ${Math.min(w * 0.042, 16)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = charRef.current.color;
    ctx.shadowColor = charRef.current.color;
    ctx.shadowBlur = 8;
    ctx.fillText(`${charRef.current.emoji} ${charRef.current.name}`, 12, 26);
    ctx.shadowBlur = 0;

    ctx.font = `bold ${Math.min(w * 0.05, 19)}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(score.toLocaleString(), w - 12, 26);
    ctx.textAlign = 'left';

    drawLyrics(ctx, w, elapsed, song);

    if (combo >= 2) {
      const comboFontSize = Math.min(22 + combo * 0.12, 28);
      ctx.font = `bold ${comboFontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
      ctx.fillText(`${combo}x COMBO`, w / 2, 145);
      ctx.shadowBlur = 0;
    }

    // Health bar
    const hbW = w * 0.42;
    const hbH = 6;
    const hbX = (w - hbW) / 2;
    const hbY = 38;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(hbX, hbY, hbW, hbH, 3);
    ctx.fill();
    const hpRatio = health / HEALTH_MAX;
    const hpColor = hpRatio > 0.6 ? '#5CE1C0' : hpRatio > 0.3 ? '#FFD700' : '#FF6B6B';
    ctx.fillStyle = hpColor;
    ctx.shadowColor = hpColor;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.roundRect(hbX, hbY, hbW * hpRatio, hbH, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Song progress bar
    const progress = Math.min(1, elapsed / SONG_DURATION);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, 0, w, 3);
    const pGrad = ctx.createLinearGradient(0, 0, w, 0);
    pGrad.addColorStop(0, song.color);
    pGrad.addColorStop(1, song.accentColor);
    ctx.fillStyle = pGrad;
    ctx.fillRect(0, 0, w * progress, 3);

    // Character dancer at bottom center
    const danceOffset = Math.sin(elapsed * 0.004 * (song.bpm / 120)) * 4;
    const charX = w / 2;
    const charY = h * 0.925 + danceOffset;
    ctx.font = `${Math.min(w * 0.07, 28)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(charRef.current.emoji, charX, charY);

    // End check
    if (health <= 0 && !gameOverRef.current) gameOverRef.current = true;
    if ((elapsed >= SONG_DURATION || gameOverRef.current) && phaseRef.current === 'playing') {
      for (const note of notes) {
        if (!note.hit && !note.missed) {
          note.missed = true;
          countMissRef.current++;
        }
      }
      endGame();
    }
  }, [getLayout, drawLyrics, endGame]);

  const gameLoop = useCallback((ts: number) => {
    if (phaseRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, ts);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [drawFrame]);

  const startGame = useCallback((char: Character, song: Song) => {
    stopBGM();
    charRef.current = char;
    songRef.current = song;
    notesRef.current = generateNotesForSong(song);
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
    currentLyricIdxRef.current = 0;
    lyricFlashRef.current = 0;
    bgmStartedRef.current = false;
    phaseRef.current = 'playing';
    setPhase('playing');
    startTimeRef.current = performance.now();
    // Start BGM immediately
    startBGM(song);
    bgmStartedRef.current = true;
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // Canvas resize
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvasSizeRef.current = { w: window.innerWidth, h: window.innerHeight };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Keyboard input during gameplay
  useEffect(() => {
    if (phase !== 'playing') return;
    const keyMap: Record<string, number> = { d: 0, f: 1, j: 2, k: 3, l: 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
    const onKey = (e: KeyboardEvent) => {
      const lane = keyMap[e.key.toLowerCase()];
      if (lane !== undefined) judgeTap(lane);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, judgeTap]);

  // Touch/click during gameplay
  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w } = canvasSizeRef.current;
    const laneW = w / NUM_LANES;

    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      for (let t = 0; t < e.changedTouches.length; t++) {
        const touch = e.changedTouches[t];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const lane = Math.floor(x / laneW);
        if (lane >= 0 && lane < NUM_LANES) judgeTap(lane);
      }
    };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const lane = Math.floor(x / laneW);
      if (lane >= 0 && lane < NUM_LANES) judgeTap(lane);
    };

    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('click', onClick);
    return () => {
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('click', onClick);
    };
  }, [phase, judgeTap]);

  // RAF cleanup
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stopBGM();
  }, []);

  // ── Character Select ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'charSelect') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animFrame: number;
    let tick = 0;

    const draw = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#140A28');
      bg.addColorStop(1, '#0E0820');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 35; i++) {
        const blink = Math.sin(tick * 0.05 + i * 1.3) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,255,255,${0.1 + blink * 0.3})`;
        ctx.beginPath();
        ctx.arc((i * 137.5 + tick * 0.04) % w, (i * 83.1) % h, 0.6 + (i % 3) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = `bold ${Math.min(w * 0.085, 34)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#FF6B9D';
      ctx.shadowBlur = 20;
      ctx.fillText('🎵 K-POP 리듬게임', w / 2, h * 0.08);
      ctx.shadowBlur = 0;

      ctx.font = `${Math.min(w * 0.04, 15)}px sans-serif`;
      ctx.fillStyle = '#C9B3F5';
      ctx.fillText('캐릭터를 선택하세요!', w / 2, h * 0.14);

      const cols = 3;
      const cardW = Math.min((w - 48) / cols, 130);
      const cardH = cardW * 1.25;
      const gapX = (w - cols * cardW) / (cols + 1);
      const gapY = 12;
      const gridY = h * 0.18;

      CHARACTERS.forEach((char, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = gapX + col * (cardW + gapX);
        const cy = gridY + row * (cardH + gapY);
        const isSel = char.name === selectedChar.name;
        const p = Math.sin(tick * 0.06 + idx * 1.1) * 0.5 + 0.5;

        const cg = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
        cg.addColorStop(0, char.color + (isSel ? '55' : '22'));
        cg.addColorStop(1, char.color + '10');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 12);
        ctx.fill();

        ctx.strokeStyle = isSel ? char.color : char.color + '60';
        ctx.lineWidth = isSel ? 2.5 : 1.5;
        ctx.shadowColor = char.color;
        ctx.shadowBlur = isSel ? 16 + p * 8 : 4;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 12);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = `${Math.min(cardW * 0.35, 44)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char.emoji, cx + cardW / 2, cy + cardH * 0.35);

        ctx.font = `bold ${Math.min(cardW * 0.18, 20)}px sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = char.color;
        ctx.shadowBlur = 6;
        ctx.fillText(char.name, cx + cardW / 2, cy + cardH * 0.63);
        ctx.shadowBlur = 0;

        ctx.font = `${Math.min(cardW * 0.15, 18)}px serif`;
        ctx.fillText(char.heart, cx + cardW / 2, cy + cardH * 0.8);

        if (isSel) {
          ctx.font = `${Math.min(cardW * 0.14, 14)}px sans-serif`;
          ctx.fillStyle = '#FFD700';
          ctx.fillText('✓ 선택', cx + cardW / 2, cy + cardH * 0.93);
        }
      });

      const rows = Math.ceil(CHARACTERS.length / cols);
      const btnW = Math.min(w * 0.58, 210);
      const btnH = 52;
      const btnX = (w - btnW) / 2;
      const btnY = gridY + rows * (cardH + gapY) + 16;
      const bp = Math.sin(tick * 0.08) * 3;
      const bGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
      bGrad.addColorStop(0, '#FF6B9D');
      bGrad.addColorStop(1, '#C9B3F5');
      ctx.fillStyle = bGrad;
      ctx.shadowColor = '#FF6B9D';
      ctx.shadowBlur = 14 + bp;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, btnH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `bold ${Math.min(w * 0.052, 19)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFF';
      ctx.fillText('곡 선택 →', w / 2, btnY + btnH / 2);

      animFrame = requestAnimationFrame(draw);
    };
    animFrame = requestAnimationFrame(draw);

    const handleInput = (tx: number, ty: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const cols = 3;
      const cardW = Math.min((w - 48) / cols, 130);
      const cardH = cardW * 1.25;
      const gapX = (w - cols * cardW) / (cols + 1);
      const gapY = 12;
      const gridY = h * 0.18;

      for (let idx = 0; idx < CHARACTERS.length; idx++) {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = gapX + col * (cardW + gapX);
        const cy = gridY + row * (cardH + gapY);
        if (tx >= cx && tx <= cx + cardW && ty >= cy && ty <= cy + cardH) {
          setSelectedChar(CHARACTERS[idx]);
          playSelectSound(440 + idx * 110);
          return;
        }
      }

      const rows = Math.ceil(CHARACTERS.length / cols);
      const btnW = Math.min(w * 0.58, 210);
      const btnH = 52;
      const btnX = (w - btnW) / 2;
      const btnY = gridY + rows * (cardH + gapY) + 16;
      if (tx >= btnX && tx <= btnX + btnW && ty >= btnY && ty <= btnY + btnH) {
        cancelAnimationFrame(animFrame);
        phaseRef.current = 'songSelect';
        setPhase('songSelect');
      }
    };

    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      handleInput(e.changedTouches[0].clientX - rect.left, e.changedTouches[0].clientY - rect.top);
    };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      handleInput(e.clientX - rect.left, e.clientY - rect.top);
    };

    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('click', onClick);
    return () => {
      cancelAnimationFrame(animFrame);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('click', onClick);
    };
  }, [phase, selectedChar]);

  // ── Song Select ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'songSelect') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animFrame: number;
    let tick = 0;
    let scrollY = 0;           // current scroll offset (px)
    let touchStartY = 0;
    let touchStartScroll = 0;
    let isDragging = false;

    const HEADER_H = 90;       // fixed header height
    const BTN_AREA_H = 62;     // fixed bottom button area

    const draw = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#140A28');
      bg.addColorStop(1, '#0E0820');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 30; i++) {
        const blink = Math.sin(tick * 0.04 + i * 1.5) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,255,255,${0.08 + blink * 0.22})`;
        ctx.beginPath();
        ctx.arc((i * 137.5 + tick * 0.03) % w, (i * 83.1) % h, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fixed header
      ctx.fillStyle = 'rgba(20,10,40,0.92)';
      ctx.fillRect(0, 0, w, HEADER_H);
      ctx.font = `bold ${Math.min(w * 0.072, 27)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#C9B3F5';
      ctx.shadowBlur = 14;
      ctx.fillText('🎵 곡 선택', w / 2, 30);
      ctx.shadowBlur = 0;
      ctx.font = `${Math.min(w * 0.036, 13)}px sans-serif`;
      ctx.fillStyle = selectedChar.color;
      ctx.fillText(`${selectedChar.emoji} ${selectedChar.name}`, w / 2, 62);

      // Scrollable song list
      const cardW = w - 32;
      const cardH = Math.min(h * 0.115, 68);
      const cardGap = 8;
      const listAreaH = h - HEADER_H - BTN_AREA_H;
      const totalListH = SONGS.length * (cardH + cardGap);
      const maxScroll = Math.max(0, totalListH - listAreaH + 12);
      scrollY = Math.max(0, Math.min(scrollY, maxScroll));

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, HEADER_H, w, listAreaH);
      ctx.clip();

      SONGS.forEach((song, idx) => {
        const cy = HEADER_H + idx * (cardH + cardGap) - scrollY;
        if (cy + cardH < HEADER_H || cy > HEADER_H + listAreaH) return;
        const isSel = song.id === selectedSong.id;
        const p = Math.sin(tick * 0.05 + idx * 0.8) * 0.5 + 0.5;

        const sg = ctx.createLinearGradient(16, cy, 16 + cardW, cy + cardH);
        sg.addColorStop(0, song.color + (isSel ? '44' : '1A'));
        sg.addColorStop(1, song.accentColor + '0A');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.roundRect(16, cy, cardW, cardH, 11);
        ctx.fill();

        ctx.strokeStyle = isSel ? song.color : song.color + '50';
        ctx.lineWidth = isSel ? 2.5 : 1;
        ctx.shadowColor = song.color;
        ctx.shadowBlur = isSel ? 14 + p * 6 : 3;
        ctx.beginPath();
        ctx.roundRect(16, cy, cardW, cardH, 11);
        ctx.stroke();
        ctx.shadowBlur = 0;

        const textX = 28;
        const midY = cy + cardH / 2;

        const bpmBadgeW = 58;
        ctx.fillStyle = song.color + '33';
        ctx.beginPath();
        ctx.roundRect(16 + cardW - bpmBadgeW - 8, cy + 6, bpmBadgeW, 16, 8);
        ctx.fill();
        ctx.font = `bold ${Math.min(w * 0.026, 10)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = song.accentColor;
        ctx.fillText(`BPM ${song.bpm}`, 16 + cardW - bpmBadgeW / 2 - 8, cy + 6 + 8);
        ctx.textAlign = 'left';

        ctx.font = `bold ${Math.min(w * 0.05, 19)}px sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = isSel ? song.color : 'transparent';
        ctx.shadowBlur = isSel ? 8 : 0;
        ctx.fillText(song.title, textX, midY - 10);
        ctx.shadowBlur = 0;

        ctx.font = `${Math.min(w * 0.032, 12)}px sans-serif`;
        ctx.fillStyle = song.accentColor;
        ctx.fillText(song.artist, textX, midY + 7);

        ctx.font = `${Math.min(w * 0.028, 11)}px serif`;
        let starStr = '';
        for (let s = 0; s < 5; s++) starStr += s < song.difficulty ? '★' : '☆';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(starStr, textX, midY + 22);
      });

      ctx.restore();

      // Scroll indicator
      if (maxScroll > 0) {
        const trackH = listAreaH - 8;
        const thumbH = Math.max(30, (listAreaH / totalListH) * trackH);
        const thumbY = HEADER_H + 4 + (scrollY / maxScroll) * (trackH - thumbH);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.roundRect(w - 6, HEADER_H + 4, 3, trackH, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(201,179,245,0.5)';
        ctx.beginPath();
        ctx.roundRect(w - 6, thumbY, 3, thumbH, 2);
        ctx.fill();
      }

      // Fixed bottom button area
      const btnAreaY = h - BTN_AREA_H;
      ctx.fillStyle = 'rgba(20,10,40,0.92)';
      ctx.fillRect(0, btnAreaY, w, BTN_AREA_H);

      const backW = 100;
      const backH = 42;
      const btnCenterY = btnAreaY + BTN_AREA_H / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(201,179,245,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(16, btnCenterY - backH / 2, backW, backH, backH / 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `${Math.min(w * 0.038, 14)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#C9B3F5';
      ctx.fillText('← 뒤로', 16 + backW / 2, btnCenterY + 1);

      const startBtnW = Math.min(w * 0.5, 185);
      const startBtnH = 44;
      const startBtnX = w - 16 - startBtnW;
      const startBtnY = btnCenterY - startBtnH / 2;
      const bp = Math.sin(tick * 0.09) * 3;
      const sbg = ctx.createLinearGradient(startBtnX, startBtnY, startBtnX + startBtnW, startBtnY);
      sbg.addColorStop(0, selectedSong.color);
      sbg.addColorStop(1, '#C9B3F5');
      ctx.fillStyle = sbg;
      ctx.shadowColor = selectedSong.color;
      ctx.shadowBlur = 14 + bp;
      ctx.beginPath();
      ctx.roundRect(startBtnX, startBtnY, startBtnW, startBtnH, startBtnH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `bold ${Math.min(w * 0.046, 17)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFF';
      ctx.fillText('🎮 게임 시작!', startBtnX + startBtnW / 2, btnCenterY + 1);

      animFrame = requestAnimationFrame(draw);
    };
    animFrame = requestAnimationFrame(draw);

    const handleTap = (tx: number, ty: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const cardH = Math.min(h * 0.115, 68);
      const cardGap = 8;
      const listAreaH = h - HEADER_H - BTN_AREA_H;

      if (ty >= HEADER_H && ty <= HEADER_H + listAreaH) {
        for (let idx = 0; idx < SONGS.length; idx++) {
          const cy = HEADER_H + idx * (cardH + cardGap) - scrollY;
          if (tx >= 16 && tx <= w - 16 && ty >= cy && ty <= cy + cardH) {
            setSelectedSong(SONGS[idx]);
            playSelectSound(SONGS[idx].melodyNotes[0]);
            return;
          }
        }
      }

      const btnAreaY = h - BTN_AREA_H;
      const btnCenterY = btnAreaY + BTN_AREA_H / 2;
      const backH = 42;
      if (tx >= 16 && tx <= 116 && ty >= btnCenterY - backH / 2 && ty <= btnCenterY + backH / 2) {
        cancelAnimationFrame(animFrame);
        phaseRef.current = 'charSelect';
        setPhase('charSelect');
        return;
      }
      const startBtnW = Math.min(w * 0.5, 185);
      const startBtnX = w - 16 - startBtnW;
      const startBtnH = 44;
      if (tx >= startBtnX && tx <= startBtnX + startBtnW && ty >= btnCenterY - startBtnH / 2 && ty <= btnCenterY + startBtnH / 2) {
        cancelAnimationFrame(animFrame);
        startGame(selectedChar, selectedSong);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      touchStartY = e.changedTouches[0].clientY - rect.top;
      touchStartScroll = scrollY;
      isDragging = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const dy = (e.changedTouches[0].clientY - rect.top) - touchStartY;
      if (Math.abs(dy) > 5) isDragging = true;
      if (isDragging) scrollY = touchStartScroll - dy;
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDragging) {
        const rect = canvas.getBoundingClientRect();
        handleTap(e.changedTouches[0].clientX - rect.left, e.changedTouches[0].clientY - rect.top);
      }
      isDragging = false;
    };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      handleTap(e.clientX - rect.left, e.clientY - rect.top);
    };
    const onWheel = (e: WheelEvent) => { scrollY += e.deltaY; };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      cancelAnimationFrame(animFrame);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [phase, selectedChar, selectedSong, startGame]);

  // ── Result overlay ────────────────────────────────────────────────────────────
  const gradeColors: Record<string, string> = { S: '#FFD700', A: '#5CE1C0', B: '#C9B3F5', C: '#FFB3C6' };
  const gradeLabels: Record<string, string> = {
    S: 'S 랭크 - 완벽해요! ✨',
    A: 'A 랭크 - 훌륭해요! 🌟',
    B: 'B 랭크 - 잘했어요! 💫',
    C: 'C 랭크 - 다시 도전! 💪',
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden', background: '#12082A' }}>
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

      {phase === 'result' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,5,20,0.93)',
          padding: '24px 20px',
          overflowY: 'auto',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'clamp(12px,3vw,14px)', marginBottom: 6 }}>
            🎵 {resultData.songTitle}
          </div>

          <div style={{
            fontSize: 'clamp(72px, 22vw, 100px)',
            fontWeight: 900,
            color: gradeColors[resultData.grade] ?? '#fff',
            textShadow: `0 0 40px ${gradeColors[resultData.grade] ?? '#fff'}, 0 0 80px ${gradeColors[resultData.grade] ?? '#fff'}55`,
            lineHeight: 1,
            marginBottom: 4,
          }}>
            {resultData.grade}
          </div>
          <div style={{ color: gradeColors[resultData.grade], fontSize: 'clamp(13px,3.8vw,17px)', marginBottom: 20, fontWeight: 700 }}>
            {gradeLabels[resultData.grade]}
          </div>

          <div style={{ fontSize: 'clamp(28px,9vw,44px)', marginBottom: 16 }}>
            {charRef.current.emoji} {charRef.current.name}
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 20,
            padding: '18px 26px',
            width: '100%',
            maxWidth: 320,
            marginBottom: 24,
            border: '1px solid rgba(255,255,255,0.09)',
          }}>
            <StatRow label="SCORE" value={resultData.score.toLocaleString()} color="#FFFFFF" />
            <StatRow label="MAX COMBO" value={`${resultData.maxCombo}x`} color="#FFD700" />
            <StatRow label="PERFECT ✨" value={String(resultData.perfect)} color="#FFD700" />
            <StatRow label="GREAT 💫" value={String(resultData.great)} color="#5CE1C0" />
            <StatRow label="GOOD 🎶" value={String(resultData.good)} color="#C9B3F5" />
            <StatRow label="MISS 💔" value={String(resultData.miss)} color="#FF6B6B" />
          </div>

          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
            <button
              onClick={() => {
                cancelAnimationFrame(rafRef.current);
                stopBGM();
                phaseRef.current = 'songSelect';
                setPhase('songSelect');
              }}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 28,
                background: 'linear-gradient(135deg,#FF6B9D,#C9B3F5)',
                color: '#fff', fontWeight: 800, fontSize: 'clamp(12px,3.3vw,15px)',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(255,107,157,0.35)',
              }}
            >
              🔄 다시 하기
            </button>
            <a
              href="/"
              style={{
                flex: 1, padding: '13px 0', borderRadius: 28,
                background: 'rgba(255,255,255,0.1)',
                color: '#C9B3F5', fontWeight: 700, fontSize: 'clamp(12px,3.3vw,15px)',
                border: '1px solid rgba(201,179,245,0.28)',
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
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(12px,3vw,14px)', fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontSize: 'clamp(14px,3.6vw,17px)', fontWeight: 800 }}>{value}</span>
    </div>
  );
}
