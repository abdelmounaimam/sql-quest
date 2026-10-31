import { Link } from "@tanstack/react-router";
import {
	Dumbbell,
	Map as MapIcon,
	Settings,
	User,
	Volume2,
	VolumeX,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { levelFromXp } from "#/engine/adaptive";
import { type EngineStatus, sqlClient } from "#/engine/sql/client";
import { useGame } from "#/game/progress";
import { gameActions } from "#/game/store";
import { cn } from "#/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { GameIcon } from "./icons";
import { Logo } from "./logo";

export function useEngineStatus(): EngineStatus {
	const [s, setS] = useState<EngineStatus>("idle");
	useEffect(() => sqlClient().subscribe(setS), []);
	return s;
}

export function useOnline() {
	const [on, setOn] = useState(true);
	useEffect(() => {
		setOn(navigator.onLine);
		const a = () => setOn(true);
		const b = () => setOn(false);
		window.addEventListener("online", a);
		window.addEventListener("offline", b);
		return () => {
			window.removeEventListener("online", a);
			window.removeEventListener("offline", b);
		};
	}, []);
	return on;
}

const fmt = new Intl.NumberFormat("en-US");

/** Level pip + Aether bar. The bar fills with transform: scaleX (composited). */
export function XpBar({ className }: { className?: string }) {
	const xp = useGame((s) => s.xp);
	const lv = levelFromXp(xp);
	return (
		<div className={cn("flex min-w-0 items-center gap-2", className)}>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="level-pip tabular" data-hud-level>
						{lv.level}
					</span>
				</TooltipTrigger>
				<TooltipContent>Level {lv.level}</TooltipContent>
			</Tooltip>
			<div className="min-w-0 flex-1">
				<div className="xp-track">
					<i style={{ transform: `scaleX(${Math.max(0.03, lv.progress)})` }} />
				</div>
				<div className="mt-0.5 font-mono text-[11px] font-bold text-xp-text tabular">
					{fmt.format(lv.current)} / {fmt.format(lv.needed)} aether
				</div>
			</div>
		</div>
	);
}

export function StreakStat({ className }: { className?: string }) {
	const streak = useGame((s) => s.streak);
	return (
		<span
			className={cn("stat streak", streak === 0 && "opacity-60", className)}
			title={`Hearth: ${streak} day streak`}
		>
			<GameIcon name="flame" />
			{streak}
		</span>
	);
}

export function AetherStat({ className }: { className?: string }) {
	const xp = useGame((s) => s.xp);
	return (
		<span
			className={cn("stat xp", className)}
			title="Aether (XP)"
			data-hud-aether
		>
			<GameIcon name="zap" />
			{fmt.format(xp)}
		</span>
	);
}

/** Combo chip: the number rolls and the chip bumps on each increment. */
export function ComboChip() {
	const combo = useGame((s) => s.combo);
	return (
		<AnimatePresence>
			{combo >= 2 ? (
				<motion.span
					key="combo"
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.9 }}
					transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
					className="combo-chip bumped"
					title="Consecutive first-try casts"
				>
					<GameIcon name="flame" className="size-4" />
					<span className="relative inline-flex h-5 overflow-hidden">
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.span
								key={combo}
								initial={{ y: "100%" }}
								animate={{ y: 0 }}
								exit={{ y: "-100%" }}
								transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
								className="tabular"
							>
								x{combo}
							</motion.span>
						</AnimatePresence>
					</span>
				</motion.span>
			) : null}
		</AnimatePresence>
	);
}

function EngineDot() {
	const engine = useEngineStatus();
	const online = useOnline();
	return (
		<span
			className="hidden shrink-0 items-center gap-1.5 text-xs font-bold text-muted-foreground md:flex lg:hidden"
			title="SQL engine: PGlite (PostgreSQL 18) in a Web Worker"
		>
			<span
				className={cn(
					"size-2 rounded-full",
					engine === "idle" && "bg-success",
					engine === "busy" && "animate-pulse bg-info",
					engine === "booting" && "animate-pulse bg-lantern",
					engine === "restarting" && "animate-pulse bg-destructive",
				)}
			/>
			{/* Status lives in the dot (and title); the label is too wide for this bar. */}
			<span className="sr-only">
				{engine === "booting"
					? "Lighting the lantern"
					: engine === "restarting"
						? "Relighting"
						: "Postgres 18 · TZ GMT"}
			</span>
			{online ? null : (
				<span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase">
					offline
				</span>
			)}
		</span>
	);
}

function SoundToggle() {
	const sound = useGame((s) => s.settings.sound);
	return (
		<button
			type="button"
			onClick={() => gameActions.updateSettings({ sound: !sound })}
			className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
			aria-label={sound ? "Mute sounds" : "Unmute sounds"}
			aria-pressed={!sound}
		>
			{sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
		</button>
	);
}

export function Brand({ compact }: { compact?: boolean }) {
	return <Logo compact={compact} size="sm" />;
}

const NAV = [
	{ to: "/", label: "Map", icon: MapIcon },
	{ to: "/profile", label: "Profile", icon: User },
	{ to: "/settings", label: "Settings", icon: Settings },
] as const;

/** Global top bar (map, profile, settings). The level screen has its own HUD. */
export function Hud() {
	return (
		<header className="sticky top-0 z-40 pt-safe border-b-2 border-border bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-[10px]">
			<div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 md:px-8">
				<Link to="/" aria-label="World map" className="tap-target shrink-0">
					{/* Full wordmark only where the bar has room (tablet landscape and phones
					    in landscape get the compact flame, like portrait phones). */}
					<span className="hidden lg:block">
						<Brand />
					</span>
					<span className="lg:hidden">
						<Brand compact />
					</span>
				</Link>
				<XpBar className="w-32 shrink-0 sm:w-44 md:w-36 xl:w-44" />
				<StreakStat />
				<ComboChip />
				<AetherStat className="hidden sm:inline-flex" />
				<div className="flex-1" />
				<EngineDot />
				<nav
					className="hidden items-center gap-1 md:flex lg:hidden"
					aria-label="Main"
				>
					{NAV.map(({ to, label, icon: Icon }) => (
						<Link
							key={to}
							to={to}
							activeOptions={{ exact: to === "/" }}
							aria-label={label}
							className="flex size-11 items-center justify-center rounded-md text-sm font-extrabold text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
						>
							{/* md..lg only: icons, so the bar fits a phone in landscape. */}
							<Icon className="size-5" />
						</Link>
					))}
				</nav>
				<SoundToggle />
			</div>
		</header>
	);
}

/** Mobile bottom tab bar: 64px + safe area, amber active tab. */
export function TabBar() {
	return (
		<nav
			className="bottom-bar z-40 border-t-2 border-border bg-card px-safe pb-safe md:hidden"
			aria-label="Main"
		>
			<div className="tabbar">
				{NAV.map(({ to, label, icon: Icon }) => (
					<Link key={to} to={to} activeOptions={{ exact: to === "/" }}>
						<Icon strokeWidth={2.25} />
						{label}
					</Link>
				))}
			</div>
		</nav>
	);
}

/**
 * Desktop left rail (lg+): Map, Practice, Profile, Settings. The top bar keeps
 * the brand and stats; its nav hides at lg so the rail is the one navigation.
 */
export function LeftRail({ practice }: { practice?: React.ReactNode }) {
	return (
		<aside
			className="sticky top-[calc(3.5rem+var(--safe-top))] hidden h-[calc(100dvh-3.5rem-var(--safe-top))] flex-col gap-2 border-r-2 border-border px-4 py-6 lg:flex"
			aria-label="Main"
		>
			{NAV.slice(0, 1).map(({ to, label, icon: Icon }) => (
				<RailLink
					key={to}
					to={to}
					label={label}
					icon={<Icon strokeWidth={2.25} />}
				/>
			))}
			{practice ?? (
				<span
					className="flex h-12 items-center gap-3 rounded-lg px-4 text-[15px] font-extrabold text-muted-foreground opacity-60"
					title="No drill or review due right now"
				>
					<Dumbbell strokeWidth={2.25} className="size-5" /> Practice
				</span>
			)}
			{NAV.slice(1).map(({ to, label, icon: Icon }) => (
				<RailLink
					key={to}
					to={to}
					label={label}
					icon={<Icon strokeWidth={2.25} />}
				/>
			))}
			<div className="mt-auto">
				<EngineDotRail />
			</div>
		</aside>
	);
}

function RailLink({
	to,
	label,
	icon,
}: {
	to: "/" | "/profile" | "/settings";
	label: string;
	icon: React.ReactNode;
}) {
	return (
		<Link
			to={to}
			activeOptions={{ exact: to === "/" }}
			className="flex h-12 items-center gap-3 rounded-lg border-2 border-transparent px-4 text-[15px] font-extrabold text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:border-border data-[status=active]:bg-card data-[status=active]:text-(--syn-keyword) data-[status=active]:shadow-[0_3px_0_var(--ledge)] [&_svg]:size-5"
		>
			{icon}
			{label}
		</Link>
	);
}

function EngineDotRail() {
	const engine = useEngineStatus();
	return (
		<span
			className="flex items-center gap-2 text-xs font-bold text-muted-foreground"
			title="SQL engine: PGlite (PostgreSQL 18) in a Web Worker"
		>
			<span
				className={cn(
					"size-2 rounded-full",
					engine === "idle" ? "bg-success" : "animate-pulse bg-lantern",
				)}
			/>
			Postgres 18 · TZ GMT
		</span>
	);
}
