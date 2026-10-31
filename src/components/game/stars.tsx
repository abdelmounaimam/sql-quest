import { motion } from "motion/react";
import { cn } from "#/lib/utils";

export function StarIcon({
	filled,
	className,
}: {
	filled: boolean;
	className?: string;
}) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={cn("size-4", className)}
			aria-hidden="true"
		>
			<path
				d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"
				fill={filled ? "var(--reward)" : "transparent"}
				stroke={filled ? "var(--reward)" : "currentColor"}
				strokeWidth="1.6"
				strokeLinejoin="round"
				opacity={filled ? 1 : 0.35}
			/>
		</svg>
	);
}

export function StarRow({
	stars,
	className,
	size = "size-4",
}: {
	stars: number;
	className?: string;
	size?: string;
}) {
	return (
		<span
			className={cn("inline-flex items-center gap-0.5", className)}
			role="img"
			aria-label={`${stars} of 3 stars`}
		>
			{[0, 1, 2].map((i) => (
				<StarIcon key={i} filled={i < stars} className={size} />
			))}
		</span>
	);
}

/** Big stars that pop in one by one. */
export function StarBurst({
	stars,
	onStar,
}: {
	stars: number;
	onStar?: (i: number) => void;
}) {
	return (
		<div
			className="flex items-end justify-center gap-3"
			role="img"
			aria-label={`${stars} of 3 stars`}
		>
			{[0, 1, 2].map((i) => (
				<motion.div
					key={i}
					initial={{ scale: 0, rotate: -40, opacity: 0 }}
					animate={{ scale: 1, rotate: 0, opacity: 1 }}
					transition={{
						delay: 0.25 + i * 0.28,
						type: "spring",
						stiffness: 380,
						damping: 14,
					}}
					onAnimationComplete={() => i < stars && onStar?.(i)}
					className={cn(
						i === 1 ? "-translate-y-3" : "",
						i < stars ? "drop-shadow-[0_0_18px_var(--reward-glow)]" : "",
					)}
				>
					<StarIcon
						filled={i < stars}
						className={i === 1 ? "size-20" : "size-14"}
					/>
				</motion.div>
			))}
		</div>
	);
}
