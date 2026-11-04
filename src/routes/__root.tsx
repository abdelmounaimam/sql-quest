import lilitaUrl from "@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2?url";
import atkinsonUrl from "@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url";
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

const DESCRIPTION =
	"A game that teaches SQL and PostgreSQL level by level: 43 levels, 11 worlds, a real Postgres 18 engine in your browser.";

/**
 * Runs before paint: applies the saved theme so there is no flash. It also
 * picks the installed iPhone app's status bar for that theme: Night keeps
 * black-translucent (page drawn under a white clock, hidden by the night
 * strip in styles.css), Day asks for the default light bar with a dark clock,
 * so no navy band sits above parchment (the inset is then 0, the strip too).
 * iOS reads this when the app launches, so a theme change applies on the
 * next launch; meanwhile the night strip keeps the clock readable.
 */
const THEME_BOOT = `(function(){try{var s=JSON.parse(localStorage.getItem('sqlq-game')||'{}').settings||{};var t=s.theme||'dark';if(t==='system'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t;if(s.reducedMotion==='reduce')d.classList.add('reduce-motion');var m=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(m)m.setAttribute('content',t==='dark'?'black-translucent':'default');document.querySelectorAll('meta[name="theme-color"]').forEach(function(c){c.setAttribute('content',t==='dark'?'#0E1424':'#FBF5E9')})}catch(e){}})()`;

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
			{ name: "description", content: DESCRIPTION },
			{ name: "application-name", content: "SQL Quest" },
			{ name: "apple-mobile-web-app-title", content: "SQL Quest" },
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: "SQL Quest" },
			{ property: "og:title", content: "SQL Quest: level up your PostgreSQL" },
			{ property: "og:description", content: DESCRIPTION },
			{
				property: "og:image",
				content: "https://sql-quest.up.railway.app/brand/og-image.png",
			},
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{
				property: "og:image:alt",
				content:
					"SQL Quest: Wick the lantern flame next to the SQL Quest wordmark",
			},
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: "SQL Quest: level up your PostgreSQL" },
			{ name: "twitter:description", content: DESCRIPTION },
			{
				name: "twitter:image",
				content: "https://sql-quest.up.railway.app/brand/og-image.png",
			},
			{
				name: "theme-color",
				content: "#FBF5E9",
				media: "(prefers-color-scheme: light)",
			},
			{
				name: "theme-color",
				content: "#0E1424",
				media: "(prefers-color-scheme: dark)",
			},
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "mobile-web-app-capable", content: "yes" },
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "black-translucent",
			},
		],
		links: [
			{
				rel: "preload",
				href: lilitaUrl,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous",
			},
			{
				rel: "preload",
				href: atkinsonUrl,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous",
			},
			{ rel: "stylesheet", href: appCss },
			{ rel: "manifest", href: "/manifest.webmanifest" },
			{ rel: "icon", href: "/favicon.ico", sizes: "48x48" },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			{ rel: "icon", href: "/favicon.png", type: "image/png", sizes: "48x48" },
			{
				rel: "apple-touch-icon",
				href: "/icons/apple-touch-icon.png",
				sizes: "180x180",
			},
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
