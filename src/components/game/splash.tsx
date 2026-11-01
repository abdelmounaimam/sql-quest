import { LogoMark, Wordmark } from "./logo";

/** Loading screen: the lockup with a gently bobbing mark and a lantern glow. */
export function Splash({ label = "Starting Postgres" }: { label?: string }) {
	return (
		<div
			className="grid min-h-dvh place-items-center"
			style={{
				background:
					"radial-gradient(40% 35% at 50% 45%, color-mix(in oklab, var(--lantern) 18%, transparent), transparent 70%)",
			}}
		>
			<div className="flex flex-col items-center gap-5">
				<div className="flex items-center gap-2">
					<LogoMark className="size-16 animate-bob" />
					<Wordmark className="h-11 w-auto" />
				</div>
				<div className="flex items-center gap-1.5" aria-live="polite">
					<span className="text-sm font-bold text-muted-foreground">
						{label}
					</span>
					{[0, 1, 2].map((i) => (
						<span
							key={i}
							className="size-1.5 rounded-full bg-lantern"
							style={{
								animation: "pulse 1s ease-in-out infinite",
								animationDelay: `${i * 0.15}s`,
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
