import { createFileRoute } from "@tanstack/react-router";

/** The build this server runs; the open app polls it to offer a reload after a deploy. */
export const Route = createFileRoute("/api/version")({
	server: {
		handlers: {
			GET: () =>
				Response.json(
					{ build: __BUILD_ID__ },
					{ headers: { "cache-control": "no-store" } },
				),
		},
	},
});
