import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export interface ScoreEntry {
  playerName: string;
  score: number;
  date: string;
  gameId: string;
}

const COLLECTION = "rankings_sun";

// ── Save ─────────────────────────────────────────────────────────────────────

export function saveScore(
  gameId: string,
  playerName: string,
  score: number
): void {
  if (score <= 0) return;

  const entry: ScoreEntry = {
    playerName,
    score,
    date: new Date().toISOString(),
    gameId,
  };

  // Firestore (fire-and-forget)
  addDoc(collection(db, COLLECTION), {
    ...entry,
    createdAt: serverTimestamp(),
  })
    .then(() => console.log("✅ Score saved to Firestore:", gameId, playerName, score))
    .catch((err) => console.error("❌ Firestore save failed:", err));

  // localStorage backup
  _localSave(entry);
}

// ── Read (simple queries - no composite index needed) ────────────────────────

export async function getGameRankings(gameId: string): Promise<ScoreEntry[]> {
  try {
    // Fetch all, filter client-side (avoids composite index requirement)
    const q = query(
      collection(db, COLLECTION),
      orderBy("score", "desc"),
      limit(200)
    );
    const snap = await getDocs(q);
    const entries: ScoreEntry[] = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.gameId === gameId) {
        entries.push({
          playerName: d.playerName,
          score: d.score,
          date: d.date,
          gameId: d.gameId,
        });
      }
      if (entries.length >= 10) break;
    }
    // Merge: Firestore results + localStorage (deduped, in case save was delayed)
    const local = _localGetGame(gameId);
    const merged = _mergeEntries(entries, local);
    return merged.slice(0, 10);
  } catch (err) {
    console.error("❌ Firestore read failed:", err);
    return _localGetGame(gameId);
  }
}

export async function getAllRankings(): Promise<ScoreEntry[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy("score", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);
    const firestoreEntries = snap.docs.map((d) => {
      const data = d.data();
      return {
        playerName: data.playerName,
        score: data.score,
        date: data.date,
        gameId: data.gameId,
      } as ScoreEntry;
    });
    const local = _localGetAll();
    return _mergeEntries(firestoreEntries, local).slice(0, 50);
  } catch (err) {
    console.error("❌ Firestore read failed:", err);
    return _localGetAll();
  }
}

export async function getPlayerBest(
  playerName: string
): Promise<Record<string, number>> {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy("score", "desc"),
      limit(500)
    );
    const snap = await getDocs(q);
    const best: Record<string, number> = {};
    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.playerName === playerName) {
        if (!(d.gameId in best) || d.score > best[d.gameId]) {
          best[d.gameId] = d.score;
        }
      }
    }
    // Merge with localStorage
    const localBest = _localGetPlayerBest(playerName);
    for (const [gid, sc] of Object.entries(localBest)) {
      if (!(gid in best) || sc > best[gid]) {
        best[gid] = sc;
      }
    }
    return best;
  } catch (err) {
    console.error("❌ Firestore read failed:", err);
    return _localGetPlayerBest(playerName);
  }
}

export function clearRankings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("game-rankings-sun");
}

// ── Merge helper (dedup Firestore + localStorage) ───────────────────────────

function _mergeEntries(a: ScoreEntry[], b: ScoreEntry[]): ScoreEntry[] {
  const seen = new Set<string>();
  const result: ScoreEntry[] = [];
  for (const entry of [...a, ...b]) {
    const key = `${entry.playerName}|${entry.gameId}|${entry.score}|${entry.date}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }
  return result.sort((x, y) => y.score - x.score);
}

// ── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = "game-rankings-sun";
const MAX_PER_GAME = 100;

function _localLoadAll(): ScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScoreEntry[];
  } catch {
    return [];
  }
}

function _localSaveAll(entries: ScoreEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* */ }
}

function _localSave(entry: ScoreEntry): void {
  const all = _localLoadAll();
  all.push(entry);
  const game = all
    .filter((e) => e.gameId === entry.gameId)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PER_GAME);
  const others = all.filter((e) => e.gameId !== entry.gameId);
  _localSaveAll([...others, ...game]);
}

function _localGetGame(gameId: string): ScoreEntry[] {
  return _localLoadAll()
    .filter((e) => e.gameId === gameId)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function _localGetAll(): ScoreEntry[] {
  return _localLoadAll()
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

function _localGetPlayerBest(playerName: string): Record<string, number> {
  const all = _localLoadAll().filter((e) => e.playerName === playerName);
  const best: Record<string, number> = {};
  for (const entry of all) {
    if (!(entry.gameId in best) || entry.score > best[entry.gameId]) {
      best[entry.gameId] = entry.score;
    }
  }
  return best;
}
