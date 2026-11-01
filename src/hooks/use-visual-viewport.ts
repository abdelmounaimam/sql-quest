import { useEffect } from "react";

/** Below this, a visual/layout viewport gap is browser chrome, not a keyboard. */
const KEYBOARD_MIN = 80;

/**
 * Tracks the on-screen keyboard through visualViewport and publishes it as
 * --kb-inset (px) plus data-kb="open" on <html>.
 *
 * - Android Chrome honours `interactive-widget=resizes-content` (root meta):
 *   the layout viewport shrinks with the keyboard, the gap stays 0, nothing moves.
 * - iOS Safari overlays the keyboard on the layout viewport: the gap is the
 *   keyboard height, and `.bottom-bar` uses it to keep Cast / Next above it.
 *   data-kb="open" also drops --safe-bottom to 0 (the home indicator is hidden).
 */
export function useVisualViewportInsets() {
	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const root = document.documentElement;
		let raf = 0;
		const update = () => {
			raf = 0;
			// Pinch zoom also shrinks the visual viewport: not a keyboard.
			const zoomed = vv.scale > 1.01;
			const gap = Math.round(window.innerHeight - vv.height - vv.offsetTop);
			const open = !zoomed && gap > KEYBOARD_MIN;
			root.style.setProperty("--kb-inset", open ? `${gap}px` : "0px");
			// The visible area itself, for screens that must fit above the keyboard.
			root.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
			root.style.setProperty("--vv-h", `${Math.round(vv.height)}px`);
			if (open) root.dataset.kb = "open";
			else delete root.dataset.kb;
		};
		const schedule = () => {
			if (!raf) raf = requestAnimationFrame(update);
		};
		vv.addEventListener("resize", schedule);
		vv.addEventListener("scroll", schedule);
		update();
		return () => {
			vv.removeEventListener("resize", schedule);
			vv.removeEventListener("scroll", schedule);
			if (raf) cancelAnimationFrame(raf);
			root.style.removeProperty("--kb-inset");
			root.style.removeProperty("--vv-top");
			root.style.removeProperty("--vv-h");
			delete root.dataset.kb;
		};
	}, []);
}
