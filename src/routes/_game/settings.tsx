import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ProfileFields } from "#/components/game/onboarding";
import { Button } from "#/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "#/components/ui/field";
import { Switch } from "#/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { useGame } from "#/game/progress";
import { sfx } from "#/game/sound";
import {
	gameActions,
	gameStore,
	type MotionPref,
	type ThemePref,
} from "#/game/store";
import { syncNow } from "#/game/sync";

export const Route = createFileRoute("/_game/settings")({
	ssr: false,
	component: SettingsPage,
});

function SettingsPage() {
	const settings = useGame((s) => s.settings);
	const profile = useGame((s) => s.profile);

	const form = useForm({
		defaultValues: {
			name: profile?.name ?? "",
			avatar: profile?.avatar ?? "🦊",
		},
		onSubmit: async ({ value }) => {
			gameActions.createProfile(value.name, value.avatar);
			sfx("unlock");
			toast.success("Profile saved");
			try {
				await syncNow(true);
			} catch {
				// offline: will sync later
			}
		},
	});

	return (
		<div className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-6 pb-16">
			<h1 className="font-display text-3xl text-foreground">Settings</h1>
			<motion.form
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="panel space-y-4 p-5"
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
			>
				<h2 className="font-display text-lg text-foreground">Profile</h2>
				<ProfileFields form={form} />
				<form.Subscribe selector={(s) => [s.canSubmit, s.isDirty] as const}>
					{([canSubmit, dirty]) => (
						<Button
							type="submit"
							variant="default"
							size="lg"
							disabled={!canSubmit || !dirty}
						>
							Save profile
						</Button>
					)}
				</form.Subscribe>
				<p className="font-mono text-[11px] text-muted-foreground">
					Profile id: {profile?.id}
				</p>
			</motion.form>

			<section className="panel divide-y divide-border p-2">
				<Toggle
					label="SQL autocomplete"
					description="Suggest tables, columns and functions from the live catalog while you type."
					checked={settings.autocomplete}
					onChange={(v) => gameActions.updateSettings({ autocomplete: v })}
				/>
				<Toggle
					label="Sound effects"
					description="Little synth blips for runs, wins and boss fights."
					checked={settings.sound}
					onChange={(v) => {
						gameActions.updateSettings({ sound: v });
						if (v) sfx("success");
					}}
				/>
				<Toggle
					label="Boss timer"
					description="Boss fights run against the clock."
					checked={settings.bossTimer}
					onChange={(v) => gameActions.updateSettings({ bossTimer: v })}
				/>
				<Choice<MotionPref>
					label="Motion"
					value={settings.reducedMotion}
					options={[
						["system", "System"],
						["reduce", "Reduced"],
						["full", "Full"],
					]}
					onChange={(v) => gameActions.updateSettings({ reducedMotion: v })}
				/>
				<Choice<ThemePref>
					label="Theme"
					value={settings.theme}
					options={[
						["dark", "Night"],
						["light", "Day"],
						["system", "System"],
					]}
					onChange={(v) => gameActions.updateSettings({ theme: v })}
				/>
			</section>

			<section className="panel space-y-2 p-5">
				<h2 className="font-display text-lg text-destructive">Danger zone</h2>
				<p className="text-sm text-muted-foreground">
					Erase local progress on this device. Synced data stays on the server.
				</p>
				<Button
					type="button"
					variant="destructive"
					size="lg"
					onClick={() => {
						if (!window.confirm("Erase all local progress?")) return;
						for (const k of Object.keys(localStorage))
							if (k.startsWith("sqlq-")) localStorage.removeItem(k);
						gameStore.setState((s) => ({ ...s }));
						window.location.href = "/";
					}}
				>
					Reset local progress
				</Button>
			</section>
		</div>
	);
}

function Toggle({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	const id = `setting-${label.toLowerCase().replace(/\W+/g, "-")}`;
	return (
		<Field orientation="horizontal" className="p-3">
			<FieldContent>
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				<FieldDescription>{description}</FieldDescription>
			</FieldContent>
			<Switch id={id} checked={checked} onCheckedChange={onChange} />
		</Field>
	);
}

function Choice<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: [T, string][];
	onChange: (v: T) => void;
}) {
	return (
		<Field orientation="horizontal" className="p-3">
			<FieldLabel>{label}</FieldLabel>
			<ToggleGroup
				type="single"
				variant="outline"
				value={value}
				onValueChange={(v) => v && onChange(v as T)}
				aria-label={label}
			>
				{options.map(([v, l]) => (
					<ToggleGroupItem key={v} value={v}>
						{l}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</Field>
	);
}
