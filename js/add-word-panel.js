class AddWordPanel {
	constructor({ toggle, closeButton, panel, input, suggestions, categoryToggle, categoryField, categoryFilter, onQuery, onAdd, getName, onClose, onOpen }) {
		this.toggle = toggle;
		this.closeButton = closeButton;
		this.panel = panel;
		this.input = input;
		this.suggestions = suggestions;
		this.categoryToggle = categoryToggle;
		this.categoryField = categoryField;
		this.categoryFilter = categoryFilter;
		this.onQuery = onQuery;
		this.onAdd = onAdd;
		this.getName = getName;
		this.onClose = onClose;
		this.onOpen = onOpen;
		this.bindEvents();
	}

	bindEvents() {
		this.toggle.addEventListener("click", () => this.open());
		this.closeButton.addEventListener("click", () => this.close());
		this.input.addEventListener("input", () => this.onQuery(this.input.value, this.categoryFilter.value));
		this.input.addEventListener("keydown", (event) => {
			if (event.key !== "Enter") return;
			event.preventDefault();
			this.onAdd(this.input.value);
		});
		this.categoryToggle.addEventListener("click", () => this.toggleCategory());
		this.categoryFilter.addEventListener("change", () => this.onQuery(this.input.value, this.categoryFilter.value));
	}

	open() {
		this.onOpen();
		this.toggle.hidden = true;
		this.closeButton.hidden = false;
		this.panel.hidden = false;
		this.input.value = "";
		this.input.focus();
		this.onQuery("", this.categoryFilter.value);
	}

	close() {
		this.panel.hidden = true;
		this.toggle.hidden = false;
		this.closeButton.hidden = true;
		this.reset();
		this.onClose();
	}

	reset() {
		this.input.value = "";
		this.suggestions.innerHTML = "";
		this.categoryFilter.value = "all";
		this.categoryField.hidden = true;
		this.categoryToggle.setAttribute("aria-expanded", "false");
	}
	
	renderSuggestions(elements) {
		this.suggestions.innerHTML = "";
		elements.forEach((element) => {
			const suggestion = document.createElement("button");
			suggestion.className = "add-suggestion";
			suggestion.type = "button";
			suggestion.setAttribute("role", "option");
			suggestion.textContent = this.getName(element);
			suggestion.addEventListener("click", () => this.onAdd(element.word));
			this.suggestions.append(suggestion);
		});
	}

	toggleCategory() {
		const isOpen = !this.categoryField.hidden;
		this.categoryField.hidden = isOpen;
		this.categoryToggle.setAttribute("aria-expanded", String(!isOpen));
	}
}
