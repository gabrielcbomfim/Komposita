class CleanUpListButton extends ActionButton {
	// onConfirm only runs after the user confirms in the dialog
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
		// focus starts on "Cancel" so pressing Enter doesn't clear the list by accident
		const cancel = this.createButton("Cancel", () => this.closeWindow(), { autofocus: true });
		const confirm = this.createButton("Clean up", () => {
			this.closeWindow();
			this.onConfirm();
		}, { danger: true });
		actions.append(cancel, confirm);

		container.append(message, actions);
	}
}
