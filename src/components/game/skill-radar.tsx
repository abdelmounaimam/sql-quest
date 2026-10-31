import { motion } from "motion/react";
import type { RadarPoint } from "#/engine/adaptive";

/** Personal skill radar (pure SVG). */
export function SkillRadar({
	points,
	size = 280,
	label = (a: string) => a,
}: {
	points: RadarPoint[];
	size?: number;
	label?: (axis: string) => string;
}) {
	const n = points.length;
	const c = size / 2;
	const r = size / 2 - 42;
	const at = (i: number, v: number) => {
		const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
		return [c + Math.cos(ang) * r * v, c + Math.sin(ang) * r * v] as const;
	};
	const poly = (v: (i: number) => number) =>
		points.map((_, i) => at(i, v(i)).join(",")).join(" ");
	return (
		<svg
			viewBox={`0 0 ${size} ${size}`}
			className="w-full max-w-[320px]"
			role="img"
			aria-label={`Skill radar: ${points.map((p) => `${label(p.axis)} ${Math.round(p.value * 100)}%`).join(", ")}`}
		>
			{[0.25, 0.5, 0.75, 1].map((ring) => (
				<polygon
					key={ring}
					points={poly(() => ring)}
					fill="none"
					stroke="var(--border)"
					strokeWidth={ring === 1 ? 1.5 : 1}
				/>
			))}
			{points.map((p, i) => {
				const [x, y] = at(i, 1);
				const [lx, ly] = at(i, 1.22);
				return (
					<g key={p.axis}>
						<line x1={c} y1={c} x2={x} y2={y} stroke="var(--border)" />
						<text
							x={lx}
							y={ly}
							textAnchor="middle"
							dominantBaseline="middle"
							className="fill-muted-foreground text-[10px] font-bold uppercase"
						>
							{label(p.axis)}
						</text>
					</g>
				);
			})}
			<motion.polygon
				points={poly((i) => Math.max(0.04, points[i].value))}
				fill="color-mix(in oklab, var(--reward) 28%, transparent)"
				stroke="var(--reward)"
				strokeWidth={2.5}
				strokeLinejoin="round"
				initial={{ scale: 0, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: "spring", stiffness: 120, damping: 14 }}
				style={{ transformOrigin: `${c}px ${c}px` }}
			/>
			{points.map((p, i) => {
				const [x, y] = at(i, Math.max(0.04, p.value));
				return (
					<circle key={p.axis} cx={x} cy={y} r={3.5} fill="var(--reward)" />
				);
			})}
		</svg>
	);
}
