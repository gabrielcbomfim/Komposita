class WordList {
	constructor({ container, getName, onSelect, onDragStart }) {
		this.container = container;
		this.getName = getName;
		this.onSelect = onSelect;
		this.onDragStart = onDragStart;
		this.items = [];
	}

	add(element) {
		if (!this.items.some((item) => item.word === element.word)) this.items.push(element);
	}

	clear() {
		this.items = [];
	}

	remove(element) {
		this.items = this.items.filter((item) => item.word !== element.word);
		this.render();
	}

	filter(query, category) {
		return this.items.filter((element) =>
			this.getName(element).toLowerCase().includes(query) &&
			(category === "all" || element.partOfSpeech === category));
	}

	render(elements = this.items) {
		this.container.innerHTML = "";
		elements.forEach((element) => this.renderElement(element));
	}

	renderElement(element) {
		const name = this.getName(element);
		const item = document.createElement("div");
		item.className = "element-item";

		const button = document.createElement("button");
		button.className = "element-button";
		button.type = "button";
		button.draggable = true;
		const emojiDisplay = document.createElement("div");
		emojiDisplay.className = "element-emoji";
		emojiDisplay.textContent = element.emoji || "❓";
		button.append(emojiDisplay);
		button.addEventListener("click", () => this.onSelect(element));
		button.addEventListener("dragstart", (event) => this.onDragStart(event, element));

		const label = document.createElement("span");
		label.className = "element-name";
		label.textContent = name;

		const removeButton = document.createElement("button");
		removeButton.className = "element-remove";
		removeButton.type = "button";
		removeButton.setAttribute("aria-label", `Remove ${name}`);
		removeButton.textContent = "×";
		removeButton.addEventListener("click", () => this.remove(element));

		item.append(button, label, removeButton);
		this.container.append(item);
	}
}
