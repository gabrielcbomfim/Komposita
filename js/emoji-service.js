class EmojiService {
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
}
