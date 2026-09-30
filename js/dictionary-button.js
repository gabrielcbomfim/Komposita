class DictionaryButton extends ActionButton {
	// getWords: devolve as palavras já descobertas; getName: "der Apfel" etc.
	constructor(element, { getWords, getName }) {
		super(element);
		this.actionName = "dictionary";
		this.getWords = getWords;
		this.getName = getName;
	}

	getWindowTitle() {
		return "Dictionary";
	}

	renderContent(container) {
		const words = this.getWords();
		if (!words.length) {
			const empty = document.createElement("p");
			empty.textContent = "No words discovered yet. Combine words on the tableau to find new ones.";
			container.append(empty);
			return;
		}

		const count = document.createElement("p");
		count.textContent = `${words.length} word${words.length === 1 ? "" : "s"} discovered`;

		const list = document.createElement("ul");
		list.className = "dictionary-list";
		words.forEach((element) => {
			const item = document.createElement("li");
			item.className = "dictionary-item";
			const emoji = document.createElement("span");
			emoji.className = "dictionary-emoji";
			emoji.textContent = element.emoji || "❓";
			const name = document.createElement("span");
			name.textContent = this.getName(element);
			item.append(emoji, name);
			list.append(item);
		});

		container.append(count, list);
	}
}
