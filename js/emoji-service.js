class EmojiService {
	// serverUrl: optional endpoint that picks a better emoji for a word on demand
	// (POST { word, partOfSpeech } -> { emoji, aiProcessed }). Without it, the
	// emoji stored in the dictionary is used as-is, so the game runs on any static host.
	constructor({ serverUrl = null } = {}) {
		this.serverUrl = serverUrl;
	}

	setDragImage(event, emoji, size = 64) {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size * 2; // 2x so it stays sharp on retina screens
		canvas.style.cssText = `position:fixed;top:-1000px;left:-1000px;width:${size}px;height:${size}px;`;
		const ctx = canvas.getContext("2d");
		ctx.font = `${size * 1.5}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(emoji, size, size);
		document.body.append(canvas); // must be in the DOM for the browser to capture it
		event.dataTransfer.setDragImage(canvas, size / 2, size / 2);
		setTimeout(() => canvas.remove(), 0);
	}

	async resolveEmoji(element) {
		if (!this.serverUrl || (element.aiProcessed && element.emoji)) return element.emoji;
		const response = await fetch(this.serverUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ word: element.word, partOfSpeech: element.partOfSpeech })
		});
		if (!response.ok) throw new Error(`Emoji server failed (${response.status}).`);
		const { emoji, aiProcessed } = await response.json();
		element.emoji = emoji;
		element.aiProcessed = aiProcessed;
		return emoji;
	}
}
