import { createFileRoute } from "@tanstack/react-router";

/** Liveness + readiness probe for the host (Railway healthcheckPath). */
export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () => {
				let db = "ok";
				try {
					const { repo } = await import("#/server/repo");
					repo.ping();
				} catch (e) {
					db = e instanceof Error ? e.message : String(e);
				}
				return Response.json(
					{
						ok: db === "ok",
						version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
						uptime: Math.round(process.uptime()),
						db,
					},
					{
						status: db === "ok" ? 200 : 503,
						headers: { "cache-control": "no-store" },
					},
				);
			},
		},
	},
});
