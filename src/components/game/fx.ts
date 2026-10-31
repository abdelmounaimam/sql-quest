import confetti from "canvas-confetti";
import { gameStore } from "#/game/store";

export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	const pref = gameStore.state.settings.reducedMotion;
	if (pref === "reduce") return true;
	if (pref === "full") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Confetti colors come from the theme tokens (canvas converts any CSS color to sRGB). */
function themeColors(): string[] {
	const css = getComputedStyle(document.documentElement);
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 1;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return ["#f59e0b"];
	return ["--reward", "--success", "--info", "--destructive", "--special"].map(
		(v) => {
			ctx.clearRect(0, 0, 1, 1);
			ctx.fillStyle = css.getPropertyValue(v).trim() || "#f59e0b";
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
			return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
		},
	);
}

export function burst(kind: "small" | "big" | "boss" = "small") {
	if (prefersReducedMotion()) return;
	if (kind === "small") {
		void confetti({
			particleCount: 60,
			spread: 70,
			startVelocity: 38,
			origin: { y: 0.7 },
			colors: themeColors(),
			scalar: 0.9,
		});
		return;
	}
	const end = Date.now() + (kind === "boss" ? 1800 : 900);
	const frame = () => {
		void confetti({
			particleCount: 5,
			angle: 60,
			spread: 60,
			origin: { x: 0, y: 0.7 },
			colors: themeColors(),
		});
		void confetti({
			particleCount: 5,
			angle: 120,
			spread: 60,
			origin: { x: 1, y: 0.7 },
			colors: themeColors(),
		});
		if (Date.now() < end) requestAnimationFrame(frame);
	};
	frame();
}
