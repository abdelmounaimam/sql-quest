import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import appCss from "../styles.css?url";

interface RouterContext {
	queryClient: QueryClient;
}

const Devtools = import.meta.env.DEV
	? lazy(() => import("#/integrations/devtools"))
	: () => null;

/** Runs before paint: applies the saved theme so there is no flash. */
const THEME_BOOT = `(function(){try{var s=JSON.parse(localStorage.getItem('sqlq-game')||'{}').settings||{};var t=s.theme||'dark';if(t==='system'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t;if(s.reducedMotion==='reduce')d.classList.add('reduce-motion')}catch(e){}})()`;

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content:
					"width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
			},
			{ title: "SQL Quest: level up your PostgreSQL" },
			{
				name: "description",
				content:
					"A game that teaches SQL and PostgreSQL level by level, right in your browser.",
			},
			{ name: "theme-color", content: "#09090b" },
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "mobile-web-app-capable", content: "yes" },
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "black-translucent",
			},
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "manifest", href: "/manifest.webmanifest" },
			{ rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
			{ rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
		],
		scripts: [{ children: THEME_BOOT }],
	}),
	shellComponent: RootDocument,
	component: () => <Outlet />,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-dvh">
				{children}
				{import.meta.env.DEV ? (
					<Suspense>
						<Devtools />
					</Suspense>
				) : null}
				<Scripts />
			</body>
		</html>
	);
}
