import { Store } from "@tanstack/react-store";
import { dayKey, streakUpdate } from "#/engine/adaptive";

/**
 * Game meta state (TanStack Store): profile, XP, combo, streak, settings,
 * unlocked achievements. Persisted to localStorage on the client.
 * Attempt history lives in TanStack DB collections (see collections.ts).
 */

export type ThemePref = "dark" | "light" | "system";
export type MotionPref = "system" | "reduce" | "full";

export interface Settings {
	autocomplete: boolean;
	sound: boolean;
	haptics: boolean;
	reducedMotion: MotionPref;
	theme: ThemePref;
	bossTimer: boolean;
	/** How SQL is entered: word bank tiles, keyboard, or tiles on touch screens. */
	composer: "auto" | "tiles" | "keyboard";
}

export interface Profile {
	id: string;
	name: string;
	avatar: string;
	createdAt: number;
}

export interface GameState {
	version: 1;
	profile: Profile | null;
	xp: number;
	combo: number;
	bestCombo: number;
	streak: number;
	lastActiveDay: string | null;
	/** achievement id -> unlocked at (ms). */
	achievements: Record<string, number>;
	settings: Settings;
	lastSyncAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
	autocomplete: true,
	sound: true,
	haptics: true,
	reducedMotion: "system",
	theme: "dark",
	bossTimer: true,
	composer: "auto",
};

const STORAGE_KEY = "sqlq-game";

const initial: GameState = {
	version: 1,
	profile: null,
	xp: 0,
	combo: 0,
	bestCombo: 0,
	streak: 0,
	lastActiveDay: null,
	achievements: {},
	settings: DEFAULT_SETTINGS,
	lastSyncAt: null,
};

function load(): GameState {
	if (typeof window === "undefined") return initial;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return initial;
		const parsed = JSON.parse(raw) as Partial<GameState>;
		return {
			...initial,
			...parsed,
			settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
		};
	} catch {
		return initial;
	}
}

export const gameStore = new Store<GameState>(load());

if (typeof window !== "undefined") {
	gameStore.subscribe((s) => {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
		} catch {
			// storage full or blocked: the game still works for this session
		}
	});
}

export function newId(prefix = ""): string {
	const c = globalThis.crypto;
	const id =
		c && "randomUUID" in c
			? c.randomUUID()
			: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
	return prefix + id;
}

export const gameActions = {
	createProfile(name: string, avatar: string) {
		gameStore.setState((s) => ({
			...s,
			profile: {
				id: s.profile?.id ?? newId("p-"),
				name: name.trim() || "Query Cadet",
				avatar,
				createdAt: s.profile?.createdAt ?? Date.now(),
			},
		}));
	},
	updateSettings(patch: Partial<Settings>) {
		gameStore.setState((s) => ({
			...s,
			settings: { ...s.settings, ...patch },
		}));
	},
	/** Apply the result of an attempt: xp, combo, streak. */
	applyReward(xp: number, combo: number) {
		gameStore.setState((s) => {
			const today = dayKey(new Date());
			const st = streakUpdate(s.lastActiveDay, today, s.streak);
			return {
				...s,
				xp: s.xp + xp,
				combo,
				bestCombo: Math.max(s.bestCombo, combo),
				streak: st.streak,
				lastActiveDay: st.lastActiveDay,
			};
		});
	},
	unlockAchievements(ids: string[]): string[] {
		const fresh = ids.filter((id) => !gameStore.state.achievements[id]);
		if (fresh.length === 0) return [];
		const now = Date.now();
		gameStore.setState((s) => ({
			...s,
			achievements: {
				...s.achievements,
				...Object.fromEntries(fresh.map((id) => [id, now])),
			},
		}));
		return fresh;
	},
	markSynced(at: number, serverXp?: number) {
		gameStore.setState((s) => ({
			...s,
			lastSyncAt: at,
			xp: Math.max(s.xp, serverXp ?? 0),
		}));
	},
	resetAll() {
		gameStore.setState(() => ({ ...initial, profile: null }));
	},
};
