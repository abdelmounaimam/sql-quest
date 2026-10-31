import { useEffect } from "react";
import { useGame } from "#/game/progress";
import { useVisualViewportInsets } from "#/hooks/use-visual-viewport";

/**
 * Applies theme + reduced motion classes, tracks the on-screen keyboard
 * (--kb-inset) and registers the service worker.
 */
export function AppEffects() {
	useVisualViewportInsets();
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
