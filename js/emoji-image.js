class EmojiImageGenerator {
	constructor() {
		this.cache = new Map();
		this.emojiByWord = {};
	}

	getImageUrl(element) {
		const key = `${element.partOfSpeech}:${element.word.toLowerCase()}`;
		if (!this.cache.has(key)) this.cache.set(key, this.createImage(element.emoji || this.findEmoji(element.word)));
		return this.cache.get(key);
	}

	setEmojiDragImage(event, emoji, size = 64) {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size * 2; // 2x para ficar nítido em telas retina
		canvas.style.cssText = `position:fixed;top:-1000px;left:-1000px;width:${size}px;height:${size}px;`;
		const ctx = canvas.getContext("2d");
		ctx.font = `${size * 1.5}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(emoji, size, size);
		document.body.append(canvas); // precisa estar no DOM para o navegador capturar
		event.dataTransfer.setDragImage(canvas, size / 2, size / 2);
		setTimeout(() => canvas.remove(), 0);
	}
	
	createImage(emoji) {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="18" fill="#e5ddd0"/><text x="80" y="102" text-anchor="middle" font-size="72" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${emoji}</text></svg>`;
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	}

	// Pede o emoji ao servidor local (server.js), que chama a IA e grava no banco.
	async resolveEmoji(element) {
		if (element.aiProcessed && element.emoji) return element.emoji;
		const response = await fetch("/api/resolve-emoji", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ word: element.word, partOfSpeech: element.partOfSpeech })
		});
		if (!response.ok) throw new Error(`Emoji server failed (${response.status}).`);
		const { emoji, aiProcessed } = await response.json();
		element.emoji = emoji;
		element.aiProcessed = aiProcessed;
		this.cache.set(`${element.partOfSpeech}:${element.word.toLowerCase()}`, this.createImage(emoji));
		return emoji;
	}

	findEmoji(word) {
		const normalizedWord = word.toLowerCase();
		const matches = Object.keys(this.emojiByWord).filter((knownWord) => normalizedWord.includes(knownWord));
		if (matches.length) {
			const closestWord = matches.sort((first, second) => second.length - first.length)[0];
			return this.emojiByWord[closestWord];
		}
		return "✨";
	}
}
