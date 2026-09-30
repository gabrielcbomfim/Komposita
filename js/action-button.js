class ActionButton {
	constructor(element, onActivate = () => {}) {
		this.element = element;
		this.onActivate = onActivate;
		this.window = null;
		this.bindEvents();
	}

	bindEvents() {
		this.element.addEventListener("click", () => {
			this.openWindow();
			this.onActivate();
		});
	}

	openWindow() {
		this.closeWindow();
		const overlay = document.createElement("div");
		overlay.className = "action-window-overlay";
		overlay.addEventListener("click", (event) => {
			if (event.target === overlay) this.closeWindow();
		});

		const dialog = document.createElement("section");
		dialog.className = "action-window";
		dialog.setAttribute("role", "dialog");
		dialog.setAttribute("aria-modal", "true");
		dialog.setAttribute("aria-labelledby", `${this.actionName}-window-title`);

		const header = document.createElement("header");
		header.className = "action-window-header";
		const title = document.createElement("h2");
		title.id = `${this.actionName}-window-title`;
		title.textContent = this.getWindowTitle();
		const closeButton = document.createElement("button");
		closeButton.className = "action-window-close";
		closeButton.type = "button";
		closeButton.setAttribute("aria-label", "Close window");
		closeButton.textContent = "×";
		closeButton.addEventListener("click", () => this.closeWindow());
		header.append(title, closeButton);

		// o corpo da janela agora é montado por renderContent(),
		// que cada botão filho pode sobrescrever
		const content = document.createElement("div");
		content.className = "action-window-content";
		this.renderContent(content);
		dialog.append(header, content);
		overlay.append(dialog);
		document.body.append(overlay);
		this.window = overlay;
		(content.querySelector("[data-autofocus]") || closeButton).focus();
		this.handleEscape = (event) => {
			if (event.key === "Escape") this.closeWindow();
		};
		document.addEventListener("keydown", this.handleEscape);
	}

	closeWindow() {
		if (!this.window) return;
		this.window.remove();
		document.removeEventListener("keydown", this.handleEscape);
		this.window = null;
	}

	// cria um botão padrão para as janelas
	createButton(text, onClick, { danger = false, autofocus = false } = {}) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "action-window-button" + (danger ? " is-danger" : "");
		button.textContent = text;
		if (autofocus) button.dataset.autofocus = "true";
		button.addEventListener("click", onClick);
		return button;
	}

	getWindowTitle() {
		return "Action";
	}

	getWindowMessage() {
		return "This window is ready for its content.";
	}

	renderContent(container) {
		const message = document.createElement("p");
		message.textContent = this.getWindowMessage();
		container.append(message);
	}
}
