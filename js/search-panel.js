class SearchPanel {
	constructor({ toggle, closeButton, panel, input, categoryToggle, categoryField, categoryFilter, onQuery, onClose, onOpen }) {
		this.toggle = toggle;
		this.closeButton = closeButton;
		this.panel = panel;
		this.input = input;
		this.categoryToggle = categoryToggle;
		this.categoryField = categoryField;
		this.categoryFilter = categoryFilter;
		this.onQuery = onQuery;
		this.onClose = onClose;
		this.onOpen = onOpen;
		this.bindEvents();
	}

	bindEvents() {
		this.toggle.addEventListener("click", () => this.open());
		this.closeButton.addEventListener("click", () => this.close());
		this.input.addEventListener("input", () => this.onQuery(this.input.value, this.categoryFilter.value));
		this.categoryFilter.addEventListener("change", () => this.onQuery(this.input.value, this.categoryFilter.value));
		this.categoryToggle.addEventListener("click", () => this.toggleCategory());
	}

	open() {
		this.onOpen();
		this.toggle.hidden = true;
		this.closeButton.hidden = false;
		this.panel.hidden = false;
		this.input.value = "";
		this.input.focus();
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
		this.categoryFilter.value = "all";
		this.categoryField.hidden = true;
		this.categoryToggle.setAttribute("aria-expanded", "false");
	}

	toggleCategory() {
		const isOpen = !this.categoryField.hidden;
		this.categoryField.hidden = isOpen;
		this.categoryToggle.setAttribute("aria-expanded", String(!isOpen));
	}
}
