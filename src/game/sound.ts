import { gameStore } from "./store";

/**
 * WebAudio sound palette (design-direction §8). No assets: every sound is
 * synthesized. Master chain: voice gain → master 0.6 → compressor → out.
 * Melodic sounds use C major pentatonic so overlaps never clash.
 */

export type Sfx =
	| "tap"
	| "run"
	| "success"
	| "fail"
	| "hint"
	| "star"
	| "levelup"
	| "boss"
	| "unlock"
	| "combo"
	| "achievement"
	| "streak";

const N = {
	A3: 220,
	C4: 261.63,
	E4: 329.63,
	C5: 523.25,
	D5: 587.33,
	E5: 659.25,
	G5: 783.99,
	A5: 880,
	C6: 1046.5,
	D6: 1174.66,
	E6: 1318.51,
	G6: 1567.98,
	C7: 2093,
};
const PENTA = [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.D6, N.E6, N.G6];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!ctx) {
		const Ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!Ctor) return null;
		ctx = new Ctor();
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -18;
		comp.ratio.value = 4;
		master = ctx.createGain();
		master.gain.value = 0.6;
		master.connect(comp).connect(ctx.destination);
	}
	if (ctx.state === "suspended") void ctx.resume();
	return ctx;
}

interface ToneOpts {
	type?: OscillatorType;
	gain?: number;
	slideTo?: number;
	attack?: number;
	filter?: { type: BiquadFilterType; freq: number; q?: number };
}

function tone(freq: number, start: number, dur: number, o: ToneOpts = {}) {
	const ac = audio();
	if (!ac || !master) return;
	const t0 = ac.currentTime + start;
	const osc = ac.createOscillator();
	const g = ac.createGain();
	osc.type = o.type ?? "triangle";
	osc.frequency.setValueAtTime(freq, t0);
	if (o.slideTo)
		osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
	const peak = o.gain ?? 0.1;
	g.gain.setValueAtTime(0.0001, t0);
	g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.008));
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	let node: AudioNode = osc;
	if (o.filter) {
		const f = ac.createBiquadFilter();
		f.type = o.filter.type;
		f.frequency.value = o.filter.freq;
		if (o.filter.q) f.Q.value = o.filter.q;
		node = osc.connect(f);
	}
	node.connect(g).connect(master);
	osc.start(t0);
	osc.stop(t0 + dur + 0.03);
}

function noise(
	start: number,
	dur: number,
	gain: number,
	filter: { type: BiquadFilterType; freq: number; q?: number },
) {
	const ac = audio();
	if (!ac || !master) return;
	const len = Math.max(1, Math.floor(ac.sampleRate * dur));
	const buf = ac.createBuffer(1, len, ac.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < len; i++)
		data[i] = (Math.random() * 2 - 1) * (1 - i / len);
	const src = ac.createBufferSource();
	src.buffer = buf;
	const f = ac.createBiquadFilter();
	f.type = filter.type;
	f.frequency.value = filter.freq;
	if (filter.q) f.Q.value = filter.q;
	const g = ac.createGain();
	g.gain.value = gain;
	src.connect(f).connect(g).connect(master);
	src.start(ac.currentTime + start);
}

/** Play a sound. `step` picks the pitch for star (0..2) and combo (count). */
export function sfx(name: Sfx, step = 0) {
	if (!gameStore.state.settings.sound) return;
	try {
		switch (name) {
			case "tap":
				tone(880, 0, 0.04, {
					type: "sine",
					gain: 0.04,
					slideTo: 660,
					attack: 0.005,
				});
				break;
			case "run":
				tone(330, 0, 0.12, { type: "triangle", gain: 0.07, slideTo: 660 });
				noise(0, 0.15, 0.05, { type: "bandpass", freq: 2000, q: 1.2 });
				break;
			case "success":
				tone(N.E5, 0, 0.08, { gain: 0.11 });
				tone(N.C6, 0.08, 0.22, { gain: 0.11 });
				tone(N.C7, 0.08, 0.3, { type: "sine", gain: 0.02 });
				break;
			case "fail":
				tone(196, 0, 0.18, {
					type: "square",
					gain: 0.05,
					slideTo: 123,
					filter: { type: "lowpass", freq: 900 },
				});
				noise(0, 0.06, 0.04, { type: "lowpass", freq: 900 });
				break;
			case "hint":
				tone(N.G5, 0, 0.3, { type: "sine", gain: 0.06 });
				tone(N.D6, 0.09, 0.3, { type: "sine", gain: 0.05 });
				break;
			case "star": {
				const f = [N.C6, N.E6, N.G6][Math.min(2, step)];
				tone(f, 0, 0.26, { gain: 0.09, attack: 0.01 });
				tone(f * 2, 0, 0.2, { type: "sine", gain: 0.027 });
				break;
			}
			case "combo":
				tone(
					PENTA[Math.min(PENTA.length - 1, Math.max(0, step - 1))],
					0,
					0.09,
					{ gain: 0.05 },
				);
				break;
			case "levelup":
				[N.C5, N.E5, N.G5].forEach((f, i) => {
					tone(f, i * 0.07, 0.12, { gain: 0.08 });
				});
				tone(N.C6, 0.21, 0.45, { gain: 0.09 });
				tone(N.C5, 0.21, 0.6, { type: "sine", gain: 0.03, attack: 0.08 });
				break;
			case "unlock":
				noise(0, 0.005, 0.08, { type: "highpass", freq: 3000 });
				tone(N.C6, 0, 0.25, { type: "sine", gain: 0.08 });
				tone(N.C5, 0, 0.25, { type: "sine", gain: 0.04 });
				break;
			case "boss":
				tone(65, 0, 0.4, { type: "sine", gain: 0.22, slideTo: 55 });
				noise(0, 0.3, 0.12, { type: "lowpass", freq: 300 });
				[N.A3, N.C4, N.E4].forEach((f) => {
					tone(f, 0.42, 0.2, {
						type: "sawtooth",
						gain: 0.04,
						filter: { type: "lowpass", freq: 1200 },
					});
				});
				break;
			case "achievement":
				[N.G5, N.A5, N.C6, N.D6, N.G6].forEach((f, i) => {
					tone(f, i * 0.04, 0.3, { type: "sine", gain: 0.05 });
				});
				break;
			case "streak":
				for (let i = 0; i < 3; i++)
					noise(i * 0.05, 0.02, 0.06, { type: "bandpass", freq: 3000 });
				tone(N.C5, 0.15, 0.15, { gain: 0.06 });
				tone(N.E5, 0.25, 0.2, { gain: 0.06 });
				break;
		}
	} catch {
		// audio is best effort
	}
}

/** Haptics (Android Chrome; iOS ignores vibrate). Never on typing or scrolling. */
export const HAPTICS = {
	correct: 15,
	wrong: [30, 50, 30],
	star: 10,
	levelComplete: [20, 40, 20, 40, 60],
	unlock: 25,
	boss: [60, 40, 120],
	achievement: [15, 30, 15],
} as const;

export function haptic(name: keyof typeof HAPTICS) {
	if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
	if (!gameStore.state.settings.haptics) return;
	try {
		navigator.vibrate(HAPTICS[name] as number | number[]);
	} catch {
		// ignore
	}
}
