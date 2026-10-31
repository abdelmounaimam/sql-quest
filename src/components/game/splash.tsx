import { Logo } from "./logo";

export function Splash({ label = "Loading the map" }: { label?: string }) {
	return (
		<div className="grid min-h-dvh place-items-center">
			<div className="flex flex-col items-center gap-5">
				<div className="animate-bounce">
					<Logo />
				</div>
				<div className="flex items-center gap-1.5" aria-live="polite">
					<span className="text-sm text-muted-foreground">{label}</span>
					{[0, 1, 2].map((i) => (
						<span
							key={i}
							className="size-1.5 rounded-full bg-reward"
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
