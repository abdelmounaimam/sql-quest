import { Link } from "@tanstack/react-router";
import {
	Flame,
	Map as MapIcon,
	Settings,
	User,
	Volume2,
	VolumeX,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { levelFromXp } from "#/engine/adaptive";
import { type EngineStatus, sqlClient } from "#/engine/sql/client";
import { useGame } from "#/game/progress";
import { gameActions } from "#/game/store";
import { cn } from "#/lib/utils";
import { Logo } from "./logo";

function useEngineStatus(): EngineStatus {
	const [s, setS] = useState<EngineStatus>("idle");
	useEffect(() => sqlClient().subscribe(setS), []);
	return s;
}

function useOnline() {
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

export function XpBar({ className }: { className?: string }) {
	const xp = useGame((s) => s.xp);
	const lv = levelFromXp(xp);
	return (
		<div className={cn("flex items-center gap-2", className)}>
			<motion.div
				key={lv.level}
				initial={{ scale: 1.6, rotate: -12 }}
				animate={{ scale: 1, rotate: 0 }}
				transition={{ type: "spring", stiffness: 300, damping: 12 }}
				className="grid size-9 place-items-center rounded-xl bg-reward font-display text-sm text-reward-foreground shadow-[0_0_16px_var(--reward-glow)]"
				title={`Level ${lv.level}`}
			>
				{lv.level}
			</motion.div>
			<div className="min-w-0 flex-1">
				<div className="relative h-2.5 overflow-hidden rounded-full bg-secondary">
					<motion.div
						className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-reward to-[color-mix(in_oklab,var(--reward)_60%,var(--destructive))]"
						initial={false}
						animate={{ width: `${Math.max(3, lv.progress * 100)}%` }}
						transition={{ type: "spring", stiffness: 120, damping: 20 }}
					/>
				</div>
				<div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
					{lv.current}/{lv.needed} XP
				</div>
			</div>
		</div>
	);
}

export function Hud() {
	const streak = useGame((s) => s.streak);
	const combo = useGame((s) => s.combo);
	const sound = useGame((s) => s.settings.sound);
	const profile = useGame((s) => s.profile);
	const engine = useEngineStatus();
	const online = useOnline();

	return (
		<header className="sticky top-0 z-40 border-b border-border bg-[color-mix(in_oklab,var(--background)_82%,transparent)] backdrop-blur-md">
			<div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
				<Link to="/" className="shrink-0" aria-label="World map">
					<Logo className="hidden sm:inline-flex" />
					<Logo compact className="sm:hidden" />
				</Link>
				<XpBar className="w-28 sm:w-44" />
				<div
					className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-sm font-bold"
					title={`${streak} day streak`}
				>
					<Flame
						className={cn(
							"size-4",
							streak > 0 ? "text-destructive" : "text-muted-foreground",
						)}
						fill={streak > 0 ? "currentColor" : "none"}
					/>
					<span className="tabular-nums">{streak}</span>
				</div>
				<AnimatePresence>
					{combo >= 2 ? (
						<motion.div
							key={combo}
							initial={{ scale: 0.4, opacity: 0, y: -8 }}
							animate={{ scale: 1, opacity: 1, y: 0 }}
							exit={{ scale: 0.4, opacity: 0 }}
							className="hidden items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--info)_18%,var(--card))] px-2.5 py-1 font-display text-xs text-info sm:flex"
							title="Consecutive first-try solves"
						>
							<Zap className="size-3.5" fill="currentColor" />x{combo} combo
						</motion.div>
					) : null}
				</AnimatePresence>
				<div className="flex-1" />
				<span
					className={cn(
						"hidden items-center gap-1.5 text-xs text-muted-foreground md:flex",
					)}
					title="SQL engine (PGlite in a Web Worker)"
				>
					<span
						className={cn(
							"size-2 rounded-full",
							engine === "idle" && "bg-success",
							engine === "busy" && "animate-pulse bg-info",
							engine === "booting" && "animate-pulse bg-reward",
							engine === "restarting" && "animate-pulse bg-destructive",
						)}
					/>
					{engine === "booting"
						? "Booting Postgres"
						: engine === "restarting"
							? "Restarting engine"
							: "Postgres 18 · TZ GMT"}
					{online ? null : (
						<span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase">
							offline
						</span>
					)}
				</span>
				<nav className="flex items-center gap-1" aria-label="Main">
					<HudLink to="/" label="Map" icon={<MapIcon className="size-4" />} />
					<HudLink
						to="/profile"
						label={profile?.name ?? "Profile"}
						icon={
							profile ? (
								<span className="text-base leading-none">{profile.avatar}</span>
							) : (
								<User className="size-4" />
							)
						}
					/>
					<HudLink
						to="/settings"
						label="Settings"
						icon={<Settings className="size-4" />}
					/>
					<button
						type="button"
						onClick={() => gameActions.updateSettings({ sound: !sound })}
						className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
						aria-label={sound ? "Mute sounds" : "Unmute sounds"}
						aria-pressed={!sound}
					>
						{sound ? (
							<Volume2 className="size-4" />
						) : (
							<VolumeX className="size-4" />
						)}
					</button>
				</nav>
			</div>
		</header>
	);
}

function HudLink({
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
			className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:bg-card hover:text-foreground data-[status=active]:bg-card data-[status=active]:text-foreground"
			activeOptions={{ exact: to === "/" }}
			aria-label={label}
		>
			{icon}
			<span className="hidden max-w-24 truncate lg:inline">{label}</span>
		</Link>
	);
}
