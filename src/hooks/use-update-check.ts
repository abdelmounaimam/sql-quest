import { useEffect } from "react";
import { toast } from "sonner";

const EVERY_MS = 5 * 60_000;
const TOAST_ID = "app-update";

async function reload() {
	try {
		// Fetch the new service worker (it activates at once) so the reload
		// is served the new files, then restart the page.
		const reg = await navigator.serviceWorker?.getRegistration();
		await reg?.update();
	} catch {
		// reload anyway
	}
	window.location.reload();
}

/**
 * After a deploy, tells the open app a new version is live: checks
 * /api/version when the app comes back to the foreground, when the network
 * returns, and every 5 minutes while visible. Never reloads by itself.
 * A dismissed banner comes back the next time the app returns to the
 * foreground, so an installed PWA left open for days still updates.
 */
export function useUpdateCheck() {
	useEffect(() => {
		if (import.meta.env.DEV) return;
		let found = false;
		let snoozed = false;
		let busy = false;
		const check = async () => {
			if (found || snoozed || busy || document.visibilityState !== "visible")
				return;
			busy = true;
			try {
				const res = await fetch("/api/version", { cache: "no-store" });
				if (!res.ok) return;
				const { build } = (await res.json()) as { build?: string };
				if (!build || build === __BUILD_ID__) return;
				found = true;
				// Start downloading the new files while the banner shows.
				void navigator.serviceWorker
					?.getRegistration()
					.then((r) => r?.update())
					.catch(() => {});
				toast("New version available", {
					id: TOAST_ID,
					description:
						"Reload to get the latest SQL Quest. Your work is saved.",
					duration: Number.POSITIVE_INFINITY,
					dismissible: true,
					action: { label: "Reload", onClick: () => void reload() },
					onDismiss: () => {
						found = false;
						snoozed = true;
					},
					classNames: {
						actionButton:
							"!h-11 !rounded-xl !bg-primary !px-4 !text-sm !font-extrabold !text-primary-foreground",
					},
				});
			} catch {
				// offline: try again later
			} finally {
				busy = false;
			}
		};
		const onVisible = () => {
			if (document.visibilityState === "hidden") snoozed = false;
			else void check();
		};
		const first = setTimeout(check, 5_000);
		const timer = setInterval(check, EVERY_MS);
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("online", check);
		window.addEventListener("focus", check);
		return () => {
			clearTimeout(first);
			clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisible);
			window.removeEventListener("online", check);
			window.removeEventListener("focus", check);
		};
	}, []);
}
