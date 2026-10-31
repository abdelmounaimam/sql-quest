import { Link } from "@tanstack/react-router";
import { Map as MapIcon, Settings, User, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { levelFromXp } from "#/engine/adaptive";
import { type EngineStatus, sqlClient } from "#/engine/sql/client";
import { useGame } from "#/game/progress";
import { gameActions } from "#/game/store";
import { cn } from "#/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { GameIcon, Wick } from "./icons";

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
			className="hidden items-center gap-1.5 text-xs font-bold text-muted-foreground lg:flex"
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
			{engine === "booting"
				? "Lighting the lantern"
				: engine === "restarting"
					? "Relighting"
					: "Postgres 18 · TZ GMT"}
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
			className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
			aria-label={sound ? "Mute sounds" : "Unmute sounds"}
			aria-pressed={!sound}
		>
			{sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
		</button>
	);
}

export function Brand({ compact }: { compact?: boolean }) {
	return (
		<span className="flex items-center gap-2">
			<Wick className="h-9 w-[30px]" />
			{compact ? null : (
				<span className="font-display text-[22px] leading-none tracking-[0.02em] text-foreground">
					SQL Quest
				</span>
			)}
		</span>
	);
}

const NAV = [
	{ to: "/", label: "Map", icon: MapIcon },
	{ to: "/profile", label: "Profile", icon: User },
	{ to: "/settings", label: "Settings", icon: Settings },
] as const;

/** Global top bar (map, profile, settings). The level screen has its own HUD. */
export function Hud() {
	return (
		<header className="safe-top sticky top-0 z-40 border-b-2 border-border bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-[10px]">
			<div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 md:px-8">
				<Link to="/" aria-label="World map" className="shrink-0">
					<span className="hidden sm:block">
						<Brand />
					</span>
					<span className="sm:hidden">
						<Brand compact />
					</span>
				</Link>
				<XpBar className="w-32 sm:w-44" />
				<StreakStat />
				<ComboChip />
				<AetherStat className="hidden sm:inline-flex" />
				<div className="flex-1" />
				<EngineDot />
				<nav className="hidden items-center gap-1 md:flex" aria-label="Main">
					{NAV.map(({ to, label, icon: Icon }) => (
						<Link
							key={to}
							to={to}
							activeOptions={{ exact: to === "/" }}
							className="flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-extrabold text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
						>
							<Icon className="size-4" />
							{label}
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
			className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card md:hidden"
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
