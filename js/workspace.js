const SVG_NS = "http://www.w3.org/2000/svg";

class Workspace {
	constructor({ container, imageUrl, getImageUrl, setDragImage, onCombine, onSelect, onStatus, onSound }) {
		this.container = container;
		this.imageUrl = imageUrl;
		this.getImageUrl = getImageUrl;
		this.setDragImage = setDragImage;
		this.onCombine = onCombine;
		this.onSelect = onSelect;
		this.onStatus = onStatus;
		this.onSound = onSound || (() => {});
		this.nextTokenId = 0;
		this.tokens = new Map(); // tokenId -> { id, element, node, dot, links:Set }
		this.links = [];         // { a, b, line }
		this.createLayer();
		this.bindEvents();
	}

	createLayer() {
		this.svg = document.createElementNS(SVG_NS, "svg");
		this.svg.setAttribute("class", "workspace-links");
		this.container.append(this.svg);
	}

	bindEvents() {
		// o drag nativo serve só para vir da lista de palavras
		this.container.addEventListener("dragover", (event) => {
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		});
		this.container.addEventListener("drop", (event) => this.handleDrop(event));
	}

	handleDrop(event) {
		event.preventDefault();
		const raw = event.dataTransfer.getData("application/json");
		if (!raw) return;
		const element = JSON.parse(raw);
		const { x, y } = this.toPercent(event.clientX, event.clientY);
		this.place(element, x, y);
		this.onSound("place");
		this.onStatus(`${element.word} placed on the tableau.`);
	}

	toPercent(clientX, clientY) {
		const b = this.container.getBoundingClientRect();
		return {
			x: Math.max(4, Math.min(96, ((clientX - b.left) / b.width) * 100)),
			y: Math.max(6, Math.min(94, ((clientY - b.top) / b.height) * 100))
		};
	}

	// ---------- tokens ----------

	place(element, x, y) {
		const id = String(++this.nextTokenId);
		const node = document.createElement("div");
		node.className = "workspace-token";
		node.dataset.tokenId = id;
		node.title = element.word;
		node.style.left = `${x}%`;
		node.style.top = `${y}%`;
		
		node.style.setProperty("opacity", "1", "important");
		node.style.setProperty("visibility", "visible", "important");

		const emojiDisplay = document.createElement("div");
		emojiDisplay.className = "element-emoji";
		emojiDisplay.textContent = element.emoji || "❓";
		const label = document.createElement("span");
		label.className = "workspace-label";
		label.textContent = element.article && element.partOfSpeech === "noun" ? `${element.article} ${element.word}` : element.word;
		const dot = document.createElement("span");
		dot.className = "workspace-dot";
		dot.title = "Arraste até outra palavra para ligar";
		node.append(emojiDisplay, label, dot);

		const item = { id, element, node, dot, links: new Set() };
		this.tokens.set(id, item);

		node.addEventListener("dragstart", (e) => e.preventDefault());
		node.addEventListener("click", () => this.onSelect(element));
		node.addEventListener("pointerdown", (event) => {
			if (event.target === dot) return;
			this.startMove(event, item);
		});
		dot.addEventListener("pointerdown", (event) => this.startLink(event, item));

		this.container.append(node);
		return item;
	}

	startMove(event, item) {
		event.preventDefault();
		const node = item.node;
		node.setPointerCapture(event.pointerId);
		node.classList.add("is-dragging");
		const move = (e) => {
			const { x, y } = this.toPercent(e.clientX, e.clientY);
			node.style.left = `${x}%`;
			node.style.top = `${y}%`;
			this.updateLinks();
		};
		const end = () => {
			node.removeEventListener("pointermove", move);
			node.removeEventListener("pointerup", end);
			node.removeEventListener("pointercancel", end);
			node.classList.remove("is-dragging");
			if (item.links.size && this.tokens.has(item.id)) this.tryCombine(item, false);
		};
		node.addEventListener("pointermove", move);
		node.addEventListener("pointerup", end);
		node.addEventListener("pointercancel", end);
	}

	removeToken(item) {
		[...item.links].forEach((link) => this.unlink(link));
		item.node.remove();
		this.tokens.delete(item.id);
	}

	// ---------- links ----------

	dotCenter(item) {
		const c = this.container.getBoundingClientRect();
		const r = item.dot.getBoundingClientRect();
		return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
	}

	setLine(line, p1, p2) {
		line.setAttribute("x1", p1.x);
		line.setAttribute("y1", p1.y);
		line.setAttribute("x2", p2.x);
		line.setAttribute("y2", p2.y);
	}

	createLine() {
		const line = document.createElementNS(SVG_NS, "line");
		this.svg.append(line);
		return line;
	}

	updateLinks() {
		for (const link of this.links) this.setLine(link.line, this.dotCenter(link.a), this.dotCenter(link.b));
	}

	startLink(event, item) {
		event.preventDefault();
		event.stopPropagation();
		const line = this.createLine();
		line.classList.add("is-temp");
		const from = this.dotCenter(item);
		const move = (e) => {
			const c = this.container.getBoundingClientRect();
			this.setLine(line, from, { x: e.clientX - c.left, y: e.clientY - c.top });
		};
		const up = (e) => {
			document.removeEventListener("pointermove", move);
			document.removeEventListener("pointerup", up);
			document.removeEventListener("pointercancel", up);
			line.remove();
			const dotEl = document.elementFromPoint(e.clientX, e.clientY)?.closest(".workspace-dot");
			const id = dotEl?.closest(".workspace-token")?.dataset.tokenId;
			const target = id && this.tokens.get(id);
			if (target && target !== item) this.link(item, target);
		};
		document.addEventListener("pointermove", move);
		document.addEventListener("pointerup", up);
		document.addEventListener("pointercancel", up);
	}

	link(a, b) {
		if ([...a.links].some((l) => l.a === b || l.b === b)) return; // já ligados
		const line = this.createLine();
		const link = { a, b, line };
		line.addEventListener("dblclick", () => { this.unlink(link); this.onSound("unlink"); });
		a.links.add(link);
		b.links.add(link);
		this.links.push(link);
		this.updateLinks();
		this.onSound("link");
		this.tryCombine(a, true);
	}

	unlink(link) {
		link.line.remove();
		link.a.links.delete(link);
		link.b.links.delete(link);
		this.links = this.links.filter((l) => l !== link);
	}

	// grupo conectado, ordenado da esquerda para a direita (como o alemão é lido)
	getGroup(item) {
		const seen = new Set([item]);
		const stack = [item];
		while (stack.length) {
			const cur = stack.pop();
			for (const link of cur.links) {
				const other = link.a === cur ? link.b : link.a;
				if (!seen.has(other)) {
					seen.add(other);
					stack.push(other);
				}
			}
		}
		const centerX = (t) => {
			const r = t.node.getBoundingClientRect();
			return r.left + r.width / 2;
		};
		return [...seen].sort((p, q) => centerX(p) - centerX(q) || Number(p.id) - Number(q.id));
	}

	tryCombine(item, announce = true) {
		const group = this.getGroup(item);
		if (group.length < 2) return;
		const words = group.map((t) => t.element.word).join(" + ");
		const result = this.onCombine(group.map((t) => t.element));
		if (!result) {
			if (announce) this.onStatus(`${words}: ligados, mas ainda não formam uma palavra.`);
			return;
		}
		const x = group.reduce((s, t) => s + parseFloat(t.node.style.left), 0) / group.length;
		const y = group.reduce((s, t) => s + parseFloat(t.node.style.top), 0) / group.length;
		group.forEach((t) => this.removeToken(t));
		this.place(result, x, y);
	}

	refreshEmoji(element) {
		for (const { element: placed, node } of this.tokens.values()) {
			if (placed.word === element.word) node.querySelector(".element-emoji").textContent = element.emoji || "❓";
		}
	}

	clear() {
		for (const item of [...this.tokens.values()]) item.node.remove();
		this.tokens.clear();
		this.links.forEach((l) => l.line.remove());
		this.links = [];
	}
}