class CleanUpListButton extends ActionButton {
	// onConfirm só roda depois que o usuário confirma na janela
	constructor(element, onConfirm) {
		super(element);
		this.actionName = "clean-up-list";
		this.onConfirm = onConfirm;
	}

	getWindowTitle() {
		return "Clean up list";
	}

	renderContent(container) {
		const message = document.createElement("p");
		message.textContent = "Remove every word from the list? Your tableau remains unchanged.";

		const actions = document.createElement("div");
		actions.className = "action-window-actions";
		// o foco começa em "Cancel" para evitar limpar sem querer com Enter
		const cancel = this.createButton("Cancel", () => this.closeWindow(), { autofocus: true });
		const confirm = this.createButton("Clean up", () => {
			this.closeWindow();
			this.onConfirm();
		}, { danger: true });
		actions.append(cancel, confirm);

		container.append(message, actions);
	}
}
