import { gameStore } from "./store";

/**
 * Tiny WebAudio synth for game feedback. No audio assets: every sound is
 * generated on the fly. Respects the mute setting.
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
	| "combo";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!ctx) {
		const Ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!Ctor) return null;
		ctx = new Ctor();
	}
	if (ctx.state === "suspended") void ctx.resume();
	return ctx;
}

function tone(
	freq: number,
	start: number,
	dur: number,
	opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {},
) {
	const ac = audio();
	if (!ac) return;
	const t0 = ac.currentTime + start;
	const osc = ac.createOscillator();
	const g = ac.createGain();
	osc.type = opts.type ?? "triangle";
	osc.frequency.setValueAtTime(freq, t0);
	if (opts.slideTo)
		osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
	const peak = opts.gain ?? 0.12;
	g.gain.setValueAtTime(0.0001, t0);
	g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	osc.connect(g).connect(ac.destination);
	osc.start(t0);
	osc.stop(t0 + dur + 0.02);
}

function noise(start: number, dur: number, gain = 0.08) {
	const ac = audio();
	if (!ac) return;
	const len = Math.floor(ac.sampleRate * dur);
	const buf = ac.createBuffer(1, len, ac.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < len; i++)
		data[i] = (Math.random() * 2 - 1) * (1 - i / len);
	const src = ac.createBufferSource();
	src.buffer = buf;
	const g = ac.createGain();
	g.gain.value = gain;
	const f = ac.createBiquadFilter();
	f.type = "lowpass";
	f.frequency.value = 900;
	src.connect(f).connect(g).connect(ac.destination);
	src.start(ac.currentTime + start);
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export function sfx(name: Sfx) {
	if (!gameStore.state.settings.sound) return;
	try {
		switch (name) {
			case "tap":
				tone(880, 0, 0.05, { type: "square", gain: 0.03 });
				break;
			case "run":
				tone(320, 0, 0.09, { type: "square", gain: 0.05, slideTo: 640 });
				break;
			case "success":
				tone(C5, 0, 0.12);
				tone(E5, 0.08, 0.12);
				tone(G5, 0.16, 0.12);
				tone(C6, 0.24, 0.3, { gain: 0.14 });
				break;
			case "fail":
				tone(220, 0, 0.16, { type: "sawtooth", gain: 0.06, slideTo: 140 });
				tone(150, 0.12, 0.22, { type: "sawtooth", gain: 0.05, slideTo: 90 });
				break;
			case "hint":
				tone(1200, 0, 0.08, { type: "sine", gain: 0.06 });
				tone(1600, 0.06, 0.12, { type: "sine", gain: 0.05 });
				break;
			case "star":
				tone(1318, 0, 0.18, { type: "sine", gain: 0.1, slideTo: 1760 });
				break;
			case "combo":
				tone(660, 0, 0.07, { type: "square", gain: 0.05 });
				tone(990, 0.06, 0.1, { type: "square", gain: 0.05 });
				break;
			case "levelup":
				[C5, E5, G5, C6, G5, C6].forEach((f, i) => {
					tone(f, i * 0.09, 0.16, { type: "square", gain: 0.06 });
				});
				break;
			case "unlock":
				tone(440, 0, 0.1, { type: "triangle" });
				tone(880, 0.1, 0.25, { type: "triangle" });
				break;
			case "boss":
				noise(0, 0.6, 0.12);
				tone(55, 0, 0.9, { type: "sawtooth", gain: 0.12, slideTo: 41 });
				tone(82, 0.25, 0.7, { type: "sawtooth", gain: 0.08, slideTo: 61 });
				break;
		}
	} catch {
		// audio is best effort
	}
}
