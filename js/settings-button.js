class SettingsButton extends ActionButton {
	constructor(element, { audio, contactGithub, thanks }) {
		super(element);
		this.actionName = "settings";
		this.audio = audio;
		this.contactGithub = contactGithub;
		this.thanks = thanks;
	}

	getWindowTitle() {
		return "Settings";
	}

	renderContent(container) {
		container.append(
			this.createSetting("Sound effects", "effects", "effectsVolume", true),
			this.createSetting("Music", "music", "musicVolume", false),
			this.createContact()
		);
	}

	// uma linha com checkbox (liga/desliga) e slider de volume
	createSetting(labelText, enabledKey, volumeKey, previewSound) {
		const row = document.createElement("div");
		row.className = "setting-row";

		const label = document.createElement("label");
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = this.audio.settings[enabledKey];
		checkbox.addEventListener("change", () => {
			this.audio.set(enabledKey, checkbox.checked);
			if (previewSound) this.audio.play("place");
		});
		label.append(checkbox, ` ${labelText}`);

		const slider = document.createElement("input");
		slider.type = "range";
		slider.min = "0";
		slider.max = "1";
		slider.step = "0.05";
		slider.value = this.audio.settings[volumeKey];
		slider.setAttribute("aria-label", `${labelText} volume`);
		slider.addEventListener("input", () => this.audio.set(volumeKey, Number(slider.value)));
		// só toca o exemplo quando o usuário solta o slider
		if (previewSound) slider.addEventListener("change", () => this.audio.play("place"));

		row.append(label, slider);
		return row;
	}

	createContact() {
		const section = document.createElement("div");
		section.className = "contact-section";

		const info = document.createElement("div");
		info.className = "contact-info";
		info.hidden = true;
		const githubLine = document.createElement("p");
		const link = document.createElement("a");
		link.href = `https://github.com/${this.contactGithub}`;
		link.target = "_blank";
		link.rel = "noopener noreferrer";
		link.textContent = this.contactGithub;
		githubLine.append("GitHub: ", link);
		const thanks = document.createElement("p");
		thanks.textContent = this.thanks;
		info.append(githubLine, thanks);

		const toggle = this.createButton("Contact", () => {
			info.hidden = !info.hidden;
		});

		section.append(toggle, info);
		return section;
	}
}
