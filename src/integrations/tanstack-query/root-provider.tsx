import { QueryClient } from "@tanstack/react-query";

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			// Most queries hit the local PGlite worker: they must run offline.
			queries: { networkMode: "offlineFirst", refetchOnWindowFocus: false },
			mutations: { networkMode: "always" },
		},
	});

	return {
		queryClient,
	};
}
