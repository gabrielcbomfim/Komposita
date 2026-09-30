// Efeitos: sintetizados pelo navegador (não precisa de arquivos).
// Música: toca o arquivo data/music.mp3 em loop (coloque o seu lá).
const SOUNDS = {
	place: [[440, 0, 0.08]],
	link: [[520, 0, 0.08], [660, 0.07, 0.1]],
	unlink: [[330, 0, 0.1]],
	discover: [[523, 0, 0.15], [659, 0.12, 0.15], [784, 0.24, 0.3]]
};

class GameAudio {
	constructor(musicUrl = "data/music.mp3") {
		this.storageKey = "komposita-audio";
		this.settings = { effects: true, effectsVolume: 0.6, music: true, musicVolume: 0.4, ...this.load() };
		this.ctx = null;
		this.music = new Audio(musicUrl);
		this.music.loop = true;
		this.apply();
		// navegadores só liberam áudio depois de um gesto do usuário
		document.addEventListener("pointerdown", () => this.startMusic(), { once: true });
	}

	load() {
		try {
			return JSON.parse(localStorage.getItem(this.storageKey)) || {};
		} catch {
			return {};
		}
	}

	save() {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
		} catch {
			// sem localStorage: as configurações valem só nesta sessão
		}
	}

	set(key, value) {
		this.settings[key] = value;
		this.save();
		this.apply();
	}

	apply() {
		this.music.volume = this.settings.musicVolume;
		if (this.settings.music) this.startMusic();
		else this.music.pause();
	}

	startMusic() {
		if (!this.settings.music) return;
		this.music.play().catch(() => {}); // sem gesto ainda, ou arquivo ausente
	}

	getContext() {
		this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
		if (this.ctx.state === "suspended") this.ctx.resume();
		return this.ctx;
	}

	tone(frequency, start, duration) {
		const ctx = this.getContext();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		const t = ctx.currentTime + start;
		osc.type = "sine";
		osc.frequency.value = frequency;
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(this.settings.effectsVolume * 0.3, t + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		osc.connect(gain).connect(ctx.destination);
		osc.start(t);
		osc.stop(t + duration + 0.05);
	}

	play(name) {
		if (!this.settings.effects || this.settings.effectsVolume <= 0) return;
		(SOUNDS[name] || []).forEach(([frequency, start, duration]) => this.tone(frequency, start, duration));
	}
}
