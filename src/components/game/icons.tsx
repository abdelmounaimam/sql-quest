import type { SVGProps } from "react";
import { cn } from "#/lib/utils";

/**
 * Lantern Atlas icon set (from docs/design/preview.html): one inline SVG
 * sprite rendered once by the game layout, referenced with <use>.
 * Stroke icons use .icon-stroke, filled glyphs .icon-solid.
 */

export type GameIconName =
	| "lock"
	| "check"
	| "x"
	| "star"
	| "crown"
	| "skull"
	| "play"
	| "zap"
	| "flame"
	| "gem"
	| "gem-lines"
	| "heart"
	| "key"
	| "link"
	| "bulb"
	| "chest"
	| "wand"
	| "table"
	| "scroll"
	| "dumbbell"
	| "moon"
	| "sun"
	| "rewind"
	| "sparkle"
	| "trophy"
	| "clock"
	| "target";
export type WorldGlyphName =
	| "mug"
	| "coin"
	| "bridge"
	| "arch"
	| "scope"
	| "anvil"
	| "tower"
	| "flask"
	| "book"
	| "gear"
	| "spire";

export function IconSprite() {
	return (
		<svg
			width="0"
			height="0"
			style={{ position: "absolute" }}
			aria-hidden="true"
		>
			<defs>
				<symbol id="i-lock" viewBox="0 0 24 24">
					<rect x="5" y="11" width="14" height="10" rx="2.5" />
					<path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
				</symbol>
				<symbol id="i-check" viewBox="0 0 24 24">
					<path d="M5 12.5l4.5 4.5L19 7.5" />
				</symbol>
				<symbol id="i-x" viewBox="0 0 24 24">
					<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
				</symbol>
				<symbol id="i-star" viewBox="0 0 24 24">
					<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
				</symbol>
				<symbol id="i-crown" viewBox="0 0 24 24">
					<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
				</symbol>
				<symbol id="i-skull" viewBox="0 0 24 24">
					<path d="M12 3a8 8 0 0 0-8 8c0 2.9 1.4 4.6 3 5.6V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.4c1.6-1 3-2.7 3-5.6a8 8 0 0 0-8-8z" />
					<circle cx="9" cy="11.5" r="1.6" />
					<circle cx="15" cy="11.5" r="1.6" />
					<path d="M10.5 21v-2.5M13.5 21v-2.5" />
				</symbol>
				<symbol id="i-play" viewBox="0 0 24 24">
					<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" />
				</symbol>
				<symbol id="i-zap" viewBox="0 0 24 24">
					<path d="M13.5 2L4 13.5h7l-1 8.5L20 10h-7z" />
				</symbol>
				<symbol id="i-flame" viewBox="0 0 24 24">
					<path d="M12 2c.8 3.2 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4.2 2.4-5.3-.1 2.2.9 3.5 2.3 3.6C11 8 10 5.6 12 2z" />
				</symbol>
				<symbol id="i-gem" viewBox="0 0 24 24">
					<path d="M6.5 3h11l4 6-9.5 12L2.5 9z" />
				</symbol>
				<symbol id="i-gem-lines" viewBox="0 0 24 24">
					<path d="M2.5 9h19M12 21L8.5 9l2-6M12 21l3.5-12-2-6" />
				</symbol>
				<symbol id="i-heart" viewBox="0 0 24 24">
					<path d="M12 20.5s-8.5-5-8.5-11A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.9c0 6-8.5 11-8.5 11z" />
				</symbol>
				<symbol id="i-key" viewBox="0 0 24 24">
					<circle cx="8" cy="15" r="4.5" />
					<path d="M11.2 11.8L20 3M16.5 6.5l3 3M14 9l2.5 2.5" />
				</symbol>
				<symbol id="i-link" viewBox="0 0 24 24">
					<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
				</symbol>
				<symbol id="i-bulb" viewBox="0 0 24 24">
					<path d="M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.3 1 2.4h6c0-1.1.3-1.8 1-2.4a6.5 6.5 0 0 0-4-11.6z" />
				</symbol>
				<symbol id="i-chest" viewBox="0 0 24 24">
					<path d="M3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z" />
					<path d="M3 12h18" />
					<rect x="10" y="10" width="4" height="5" rx="1.2" />
				</symbol>
				<symbol id="i-wand" viewBox="0 0 24 24">
					<path d="M4 20l10-10M15 3v2.5M15 12.5V15M8.5 8.5h2.5M19 8.5h2.5M18.2 5.3l1.6-1.6M18.2 11.7l1.6 1.6M11.8 5.3l-1.6-1.6" />
				</symbol>
				<symbol id="i-table" viewBox="0 0 24 24">
					<rect x="3" y="4" width="18" height="16" rx="2.5" />
					<path d="M3 10h18M9.5 10v10" />
				</symbol>
				<symbol id="i-scroll" viewBox="0 0 24 24">
					<path d="M8 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v12" />
					<path d="M5 17a2 2 0 1 0 0 4h3v-4zM9 8h7M9 12h7" />
				</symbol>
				<symbol id="i-dumbbell" viewBox="0 0 24 24">
					<path d="M6.5 6v12M17.5 6v12M3.5 9v6M20.5 9v6M6.5 12h11" />
				</symbol>
				<symbol id="i-moon" viewBox="0 0 24 24">
					<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z" />
				</symbol>
				<symbol id="i-sun" viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="4.5" />
					<path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
				</symbol>
				<symbol id="i-rewind" viewBox="0 0 24 24">
					<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
					<path d="M3 3v5h5" />
				</symbol>
				<symbol id="i-sparkle" viewBox="0 0 24 24">
					<path d="M12 2.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z" />
				</symbol>
				<symbol id="i-trophy" viewBox="0 0 24 24">
					<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
					<path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5A2.5 2.5 0 0 1 17 10" />
				</symbol>
				<symbol id="i-clock" viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="9" />
					<path d="M12 7v5l3 2" />
				</symbol>
				<symbol id="i-target" viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="9" />
					<circle cx="12" cy="12" r="5" />
					<circle cx="12" cy="12" r="1.5" />
				</symbol>
				<symbol id="w-mug" viewBox="0 0 24 24">
					<path d="M5 9h10v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" />
					<path d="M15 11h2a3 3 0 0 1 0 6h-2M7.5 5c0 1 1 1.3 1 2.5M11 3.5c0 1 1 1.3 1 2.5" />
				</symbol>
				<symbol id="w-coin" viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="8.5" />
					<path d="M12 7v10M14.5 9.5h-3.5a1.75 1.75 0 0 0 0 3.5h2a1.75 1.75 0 0 1 0 3.5H9.5" />
				</symbol>
				<symbol id="w-bridge" viewBox="0 0 24 24">
					<path d="M1.5 9h21M3 9v3M21 9v3M4 21v-4a8 6.5 0 0 1 16 0v4M8 9v3.6M12 9v2.4M16 9v3.6M2 21h20" />
				</symbol>
				<symbol id="w-arch" viewBox="0 0 24 24">
					<path d="M4 21V11a8 8 0 0 1 16 0v10" />
					<path d="M8 21v-9a4 4 0 0 1 8 0v9M2.5 21h19" />
				</symbol>
				<symbol id="w-scope" viewBox="0 0 24 24">
					<path d="M3.5 14.5l12-6 2 4-12 6zM17.5 6.5l2-1 2 4-2 1M10 16l-3 5.5M11.5 15.5l3 5.5" />
				</symbol>
				<symbol id="w-anvil" viewBox="0 0 24 24">
					<path d="M3 7h13a5 5 0 0 1-5 5H10v3h3l2 5H5l2-5h2v-3C5.5 12 3 10 3 7zM16 7h5" />
				</symbol>
				<symbol id="w-tower" viewBox="0 0 24 24">
					<path d="M7 21V9h10v12M5.5 9h13M7 9V4.5h2v2h2v-2h2v2h2v-2h2V9M10 21v-4a2 2 0 0 1 4 0v4M4 21h16" />
				</symbol>
				<symbol id="w-flask" viewBox="0 0 24 24">
					<path d="M9 3h6M10 3v6L4.6 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.4-2.5L14 9V3M7 15h10" />
				</symbol>
				<symbol id="w-book" viewBox="0 0 24 24">
					<path d="M12 6.5C10 4.8 7 4.5 3 5v14c4-.5 7-.2 9 1.5 2-1.7 5-2 9-1.5V5c-4-.5-7-.2-9 1.5zM12 6.5v14" />
				</symbol>
				<symbol id="w-gear" viewBox="0 0 24 24">
					<circle
						cx="12"
						cy="12"
						r="7"
						strokeDasharray="3.1 2.4"
						strokeWidth="4"
					/>
					<circle cx="12" cy="12" r="3" />
				</symbol>
				<symbol id="w-spire" viewBox="0 0 24 24">
					<path d="M12 2l3 7.5V21H9V9.5zM9 14h6M5 21h14M19 4l.7 1.6 1.6.7-1.6.7L19 8.6l-.7-1.6-1.6-.7 1.6-.7z" />
				</symbol>
			</defs>
		</svg>
	);
}

const SOLID = new Set<GameIconName>([
	"star",
	"crown",
	"skull",
	"play",
	"zap",
	"flame",
	"gem",
	"heart",
	"sparkle",
]);

export function GameIcon({
	name,
	solid,
	className,
	...rest
}: { name: GameIconName; solid?: boolean } & SVGProps<SVGSVGElement>) {
	const isSolid = solid ?? SOLID.has(name);
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className={cn(
				"size-5 shrink-0",
				isSolid ? "icon-solid" : "icon-stroke",
				className,
			)}
			{...rest}
		>
			<use href={`#i-${name}`} />
		</svg>
	);
}

export function WorldGlyph({
	name,
	className,
}: {
	name: WorldGlyphName;
	className?: string;
}) {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className={cn("icon-stroke", className)}
			style={{ strokeWidth: 1.8 }}
		>
			<use href={`#w-${name}`} />
		</svg>
	);
}

/** Filled star with an edge stroke (the candy star). */
export function StarGlyph({
	filled,
	className,
}: {
	filled: boolean;
	className?: string;
}) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
			<use
				href="#i-star"
				fill={filled ? "var(--star)" : "var(--star-empty)"}
				stroke={filled ? "var(--star-edge)" : "var(--border)"}
				strokeWidth="1.6"
			/>
		</svg>
	);
}

export type WickMood =
	| "idle"
	| "thinking"
	| "happy"
	| "sad"
	| "sleeping"
	| "cheering";

/** Wick, the lantern flame mascot. */
export function Wick({
	mood = "idle",
	className,
	title,
}: {
	mood?: WickMood;
	className?: string;
	title?: string;
}) {
	return (
		<svg
			viewBox="0 0 100 120"
			className={cn("wick-svg", className)}
			data-mood={mood}
			role={title ? "img" : undefined}
			aria-label={title}
			aria-hidden={title ? undefined : true}
		>
			<ellipse cx="50" cy="114" rx="24" ry="5" fill="rgb(0 0 0 / .18)" />
			<g className="flame">
				<path
					d="M50 6 C60 26 84 42 84 72 A34 34 0 0 1 16 72 C16 52 30 44 36 30 C40 40 44 42 47 42 C44 30 44 18 50 6 Z"
					fill="#FFB020"
					stroke="#CC8000"
					strokeWidth="3"
					strokeLinejoin="round"
				/>
				<path
					d="M50 40 C56 52 70 60 70 78 A20 20 0 0 1 30 78 C30 64 42 56 50 40 Z"
					fill="#FFD23F"
				/>
				<path
					d="M38 60 C36 66 36 70 37 74"
					stroke="#FFF3C4"
					strokeWidth="4"
					strokeLinecap="round"
					fill="none"
				/>
				<g className="eyes">
					<ellipse cx="41" cy="78" rx="4.6" ry="6.2" fill="#3B2600" />
					<ellipse cx="59" cy="78" rx="4.6" ry="6.2" fill="#3B2600" />
					<circle cx="42.6" cy="75.6" r="1.7" fill="#fff" />
					<circle cx="60.6" cy="75.6" r="1.7" fill="#fff" />
				</g>
				<ellipse cx="33" cy="87" rx="5" ry="3" fill="#FF7A59" opacity=".55" />
				<ellipse cx="67" cy="87" rx="5" ry="3" fill="#FF7A59" opacity=".55" />
				<path
					d="M45 89 Q50 94 55 89"
					stroke="#3B2600"
					strokeWidth="3"
					strokeLinecap="round"
					fill="none"
				/>
			</g>
		</svg>
	);
}
