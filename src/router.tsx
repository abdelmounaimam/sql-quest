import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { Splash } from "./components/game/splash";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

const TAB_PATHS = new Set(["/", "/profile", "/settings"]);

export function getRouter() {
	const context = getContext();

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		// Tab screens (map, profile, settings) keep one scroll position each, so
		// Map > Profile > Map lands back where the learner was on the map. Other
		// screens keep the default per history entry behaviour.
		getScrollRestorationKey: (location) =>
			TAB_PATHS.has(location.pathname)
				? location.pathname
				: (location.state.__TSR_key ?? location.href),
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// The splash is for cold boots. In-app moves load a small chunk: keep the
		// current screen up meanwhile instead of flashing the splash, and if the
		// load is slow, keep the splash long enough not to flicker.
		defaultPendingComponent: Splash,
		defaultPendingMs: 500,
		defaultPendingMinMs: 300,
		defaultNotFoundComponent: () => (
			<div className="grid min-h-dvh place-items-center p-10 text-center text-muted-foreground">
				<div>
					<p className="text-lg font-semibold text-foreground">
						Lost in the void
					</p>
					<a href="/" className="text-sm underline">
						Back to the world map
					</a>
				</div>
			</div>
		),
	});

	setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
