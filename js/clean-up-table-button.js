class CleanUpTableButton extends ActionButton {
	constructor(element, onActivate) {
		super(element, onActivate);
		this.actionName = "clean-up-table";
	}

	openWindow() {}

	getWindowTitle() {
		return "Clean up table";
	}

	getWindowMessage() {
		return "The tableau is ready to be cleaned up. You can use this space for the next composition.";
	}
}
