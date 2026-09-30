class WordList {
	constructor({ container, imageUrl, getImageUrl, onSelect, onDragStart }) {
		this.container = container;
		this.imageUrl = imageUrl;
		this.getImageUrl = getImageUrl;
		this.onSelect = onSelect;
		this.onDragStart = onDragStart;
		this.items = [];
	}

	getElementName(element) {
		return element.partOfSpeech === "noun" && element.article ? `${element.article} ${element.word}` : element.word;
	}

	getSearchName(element) {
		return this.getElementName(element).toLowerCase();
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
		return this.items.filter((element) => this.getSearchName(element).includes(query) && (category === "all" || element.partOfSpeech === category));
	}

	render(elements = this.items) {
		this.container.innerHTML = "";
		elements.forEach((element) => this.renderElement(element));
	}

	renderElement(element) {
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
		item.append(button);
		const name = document.createElement("span");
		name.className = "element-name";
		name.textContent = this.getElementName(element);
		item.append(name);
		const removeButton = document.createElement("button");
		removeButton.className = "element-remove";
		removeButton.type = "button";
		removeButton.setAttribute("aria-label", `Remove ${this.getElementName(element)}`);
		removeButton.textContent = "×";
		removeButton.addEventListener("click", () => this.remove(element));
		item.append(removeButton);
		this.container.append(item);
	}
}
