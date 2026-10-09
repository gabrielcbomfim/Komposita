class CleanUpTableButton extends ActionButton {
	constructor(element, onActivate) {
		super(element, onActivate);
		this.actionName = "clean-up-table";
	}

	// clearing the tableau is cheap to redo, so it acts immediately without a dialog
	openWindow() {}
}
