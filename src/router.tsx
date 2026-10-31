import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { Splash } from "./components/game/splash";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const context = getContext();

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultPendingComponent: Splash,
		defaultPendingMs: 0,
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
