import { useForm } from "@tanstack/react-form";
import { motion } from "motion/react";
import { Button } from "#/components/ui/button";
import { sfx } from "#/game/sound";
import { gameActions } from "#/game/store";
import { cn } from "#/lib/utils";
import { Logo } from "./logo";

export const AVATARS = [
	"🦊",
	"🐙",
	"🦉",
	"🐉",
	"🤖",
	"🧙",
	"🦄",
	"🐼",
	"👾",
	"🚀",
	"🐸",
	"🦖",
];

export function ProfileFields({
	form,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: shared between two forms with the same shape
	form: any;
}) {
	return (
		<>
			<form.Field
				name="name"
				validators={{
					onChange: ({ value }: { value: string }) =>
						value.trim().length < 2
							? "At least 2 characters"
							: value.length > 24
								? "24 characters max"
								: undefined,
				}}
			>
				{(field: {
					name: string;
					state: { value: string; meta: { errors: string[] } };
					handleChange: (v: string) => void;
					handleBlur: () => void;
				}) => (
					<label className="block">
						<span className="mb-1.5 block text-sm font-semibold text-foreground">
							Explorer name
						</span>
						<input
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-foreground placeholder:text-muted-foreground focus:border-info focus:outline-none"
							placeholder="e.g. Ada Lovequery"
							autoComplete="nickname"
						/>
						{field.state.meta.errors.length ? (
							<span className="mt-1 block text-xs text-destructive">
								{field.state.meta.errors.join(", ")}
							</span>
						) : null}
					</label>
				)}
			</form.Field>
			<form.Field name="avatar">
				{(field: {
					state: { value: string };
					handleChange: (v: string) => void;
				}) => (
					<fieldset>
						<legend className="mb-1.5 text-sm font-semibold text-foreground">
							Avatar
						</legend>
						<div className="grid grid-cols-6 gap-2">
							{AVATARS.map((a) => (
								<button
									key={a}
									type="button"
									onClick={() => {
										sfx("tap");
										field.handleChange(a);
									}}
									aria-pressed={field.state.value === a}
									aria-label={`Avatar ${a}`}
									className={cn(
										"grid aspect-square place-items-center rounded-xl border text-2xl transition",
										field.state.value === a
											? "scale-105 border-reward bg-[color-mix(in_oklab,var(--reward)_18%,var(--card))] shadow-[0_0_14px_var(--reward-glow)]"
											: "border-border bg-muted hover:border-text-lo",
									)}
								>
									{a}
								</button>
							))}
						</div>
					</fieldset>
				)}
			</form.Field>
		</>
	);
}

/** First visit: create the anonymous profile (TanStack Form). */
export function Onboarding() {
	const form = useForm({
		defaultValues: { name: "", avatar: AVATARS[0] },
		onSubmit: ({ value }) => {
			gameActions.createProfile(value.name, value.avatar);
			sfx("unlock");
		},
	});

	return (
		<div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[color-mix(in_oklab,var(--background)_70%,transparent)] p-4 backdrop-blur-md">
			<motion.form
				initial={{ y: 40, opacity: 0, scale: 0.96 }}
				animate={{ y: 0, opacity: 1, scale: 1 }}
				transition={{ type: "spring", stiffness: 220, damping: 22 }}
				className="panel w-full max-w-md space-y-5 p-6"
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
				aria-labelledby="onboarding-title"
			>
				<Logo size="lg" />
				<div>
					<h1
						id="onboarding-title"
						className="font-display text-2xl text-foreground"
					>
						Welcome, explorer
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						A real PostgreSQL engine runs inside your browser. Every level
						teaches one idea, then throws missions and a boss at you. Pick a
						name and set off.
					</p>
				</div>
				<ProfileFields form={form} />
				<form.Subscribe selector={(s) => s.canSubmit}>
					{(canSubmit) => (
						<Button
							type="submit"
							variant="default"
							size="lg"
							className="w-full"
							disabled={!canSubmit}
						>
							Start the quest
						</Button>
					)}
				</form.Subscribe>
			</motion.form>
		</div>
	);
}
