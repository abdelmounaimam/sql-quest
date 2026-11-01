import { useEffect } from "react";
import { toast } from "sonner";
import { useGame } from "#/game/progress";
import { haptic, sfx } from "#/game/sound";
import { useUpdateCheck } from "#/hooks/use-update-check";
import { useVisualViewportInsets } from "#/hooks/use-visual-viewport";
import { GameIcon } from "./icons";

/**
 * Applies theme + reduced motion classes, tracks the on-screen keyboard
 * (--kb-inset), registers the service worker and offers a reload after a deploy.
 */
export function AppEffects() {
	useVisualViewportInsets();
	useUpdateCheck();
	const theme = useGame((s) => s.settings.theme);
	const motion = useGame((s) => s.settings.reducedMotion);

	useEffect(() => {
		const root = document.documentElement;
		const mq = window.matchMedia("(prefers-color-scheme: light)");
		const apply = () => {
			const t = theme === "system" ? (mq.matches ? "light" : "dark") : theme;
			root.classList.toggle("dark", t === "dark");
			root.style.colorScheme = t;
			for (const m of document.querySelectorAll('meta[name="theme-color"]'))
				m.setAttribute("content", t === "dark" ? "#0E1424" : "#FBF5E9");
			// Read by iOS when the installed app launches (see THEME_BOOT in
			// __root.tsx): Day gets the light status bar with a dark clock.
			for (const m of document.querySelectorAll(
				'meta[name="apple-mobile-web-app-status-bar-style"]',
			))
				m.setAttribute(
					"content",
					t === "dark" ? "black-translucent" : "default",
				);
		};
		apply();
		mq.addEventListener("change", apply);
		return () => mq.removeEventListener("change", apply);
	}, [theme]);

	useEffect(() => {
		document.documentElement.classList.toggle(
			"reduce-motion",
			motion === "reduce",
		);
	}, [motion]);

	useEffect(() => {
		if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
		navigator.serviceWorker.register("/sw.js").catch((e) => {
			console.warn("[sw] registration failed", e);
		});
	}, []);

	return null;
}

// ───────────────────────────── achievement toasts

export interface AchievementNotice {
	name: string;
	description: string;
	emoji?: string;
}

const achievementQueue: AchievementNotice[] = [];
let achievementShowing = false;
/** Gap between two achievements, so each one is read on its own. */
const ACHIEVEMENT_GAP_MS = 300;
const ACHIEVEMENT_MS = 4000;

/**
 * Achievement toast: star-gold medallion flips in, a sheen sweeps once.
 * Queued: several unlocks at once ("On Fire" + "First Blood") show one after
 * the other instead of stacking on the same spot, and none starts while the
 * learner is typing in the full screen composer (it would cover the query).
 */
export function achievementToast(a: AchievementNotice) {
	achievementQueue.push(a);
	showNextAchievement();
}

function showNextAchievement() {
	if (achievementShowing || typeof document === "undefined") return;
	const a = achievementQueue[0];
	if (!a) return;
	if (document.documentElement.hasAttribute("data-composing")) {
		window.setTimeout(showNextAchievement, 1000);
		return;
	}
	achievementQueue.shift();
	achievementShowing = true;
	const done = () => {
		if (!achievementShowing) return;
		achievementShowing = false;
		window.setTimeout(showNextAchievement, ACHIEVEMENT_GAP_MS);
	};
	sfx("achievement");
	haptic("achievement");
	toast.custom(
		() => (
			<div className="achievement-toast toast-shine flex w-[356px] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-[18px] border-2 border-border bg-popover p-3 text-popover-foreground shadow-[0_4px_0_var(--ledge),0_12px_24px_-12px_var(--ink-shadow)]">
				<span className="toast-medal achv">
					<GameIcon name="trophy" />
				</span>
				<span className="min-w-0">
					<b className="block text-[15px]">Achievement · {a.name}</b>
					<span className="text-[13px] text-muted-foreground">
						{a.description}
					</span>
				</span>
			</div>
		),
		{ duration: ACHIEVEMENT_MS, onDismiss: done, onAutoClose: done },
	);
}
