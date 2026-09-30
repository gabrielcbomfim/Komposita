// Troque pelos seus dados reais
const CONTACT_GITHUB = "gabrielcbomfim/Komposita";
const THANKS = "Thank you for playing Komposita! Suggestions and contributions are welcome on GitHub.";

class KompositaApp {
	constructor() {
		this.simpleImageUrl = "data/simple-image.svg";
		this.elements = [];
		this.searchMode = "search";
		this.cacheElements();
		this.dictionary = new Dictionary();
		this.crafting = new Crafting(this.dictionary);
		this.imageGenerator = new EmojiImageGenerator();
		this.audio = new GameAudio();
		this.wordList = new WordList({
			container: this.elementList,
			imageUrl: this.simpleImageUrl,
			getImageUrl: (element) => this.imageGenerator.getImageUrl(element),
			onSelect: (element) => this.setStatus(`${element.word} selected.`),
			onDragStart: (event, element) => {
				event.dataTransfer.setData("application/json", JSON.stringify(element));
				event.dataTransfer.effectAllowed = "copy";
				this.imageGenerator.setEmojiDragImage(event, element.emoji || "❓");
			}
		});
		this.workspace = new Workspace({
			container: this.workspaceElement,
			imageUrl: this.simpleImageUrl,
			getImageUrl: (element) => this.imageGenerator.getImageUrl(element),
			setDragImage: (event, emoji) => this.imageGenerator.setEmojiDragImage(event, emoji),
			onCombine: (elements) => this.combine(elements),
			onSelect: (element) => this.setStatus(`${element.word} selected.`),
			onStatus: (message) => this.setStatus(message),
			onSound: (name) => this.audio.play(name)
		});
		this.searchPanelController = new SearchPanel({
			toggle: this.searchToggle,
			closeButton: this.searchCloseButton,
			panel: this.searchPanel,
			input: this.elementSearch,
			categoryToggle: this.categoryToggle,
			categoryField: this.categoryField,
			categoryFilter: this.categoryFilter,
			onQuery: (query, category) => this.filterElements(query, category),
			onClose: () => this.wordList.render(),
			onOpen: () => this.addWordPanel?.close()
		});
		this.addWordPanel = new AddWordPanel({
			toggle: this.addWordButton,
			closeButton: this.addCloseButton,
			panel: this.addPanel,
			input: this.addWordSearch,
			suggestions: this.addSuggestions,
			categoryToggle: this.addCategoryToggle,
			categoryField: this.addCategoryField,
			categoryFilter: this.addCategoryFilter,
			onQuery: (query, category) => this.renderAddSuggestions(query, category),
			onAdd: (value) => this.addWordToList(value),
			getName: (element) => this.getElementName(element),
			onClose: () => this.wordList.render(),
			onOpen: () => {
				this.searchPanelController?.close();
				this.setStatus("Type a word and press Enter to add it.");
			}
		});
		this.bindEvents();
		this.loadElements();
	}

	cacheElements() {
		this.elementList = document.querySelector("#element-list");
		this.elementSearch = document.querySelector("#element-search");
		this.resultText = document.querySelector("#result-text");
		this.searchToggle = document.querySelector("#search-toggle");
		this.searchCloseButton = document.querySelector("#search-close-button");
		this.addWordButton = document.querySelector("#add-word-button");
		this.addCloseButton = document.querySelector("#add-close-button");
		this.searchPanel = document.querySelector("#search-panel");
		this.addPanel = document.querySelector("#add-panel");
		this.addWordSearch = document.querySelector("#add-word-search");
		this.addSuggestions = document.querySelector("#add-suggestions");
		this.addCategoryToggle = document.querySelector("#add-category-toggle");
		this.addCategoryField = document.querySelector("#add-category-field");
		this.addCategoryFilter = document.querySelector("#add-category-filter");
		this.categoryToggle = document.querySelector("#category-toggle");
		this.categoryField = document.querySelector("#category-field");
		this.categoryFilter = document.querySelector("#category-filter");
		this.workspaceElement = document.querySelector("#workspace");
	}

	bindEvents() {
		new CleanUpTableButton(document.querySelector("#clean-up-table-button"), () => {
			this.workspace.clear();
			this.setStatus("Workspace cleaned up.");
		});
		// só limpa depois que o usuário confirma na janela
		new CleanUpListButton(document.querySelector("#clean-up-list-button"), () => this.clearList());
		new SettingsButton(document.querySelector("#settings-button"), {
			audio: this.audio,
			contactGithub: CONTACT_GITHUB,
			thanks: THANKS
		});
		new DictionaryButton(document.querySelector("#encyclopedia-button"), {
			getWords: () => this.dictionary.getDiscovered(),
			getName: (element) => this.getElementName(element)
		});
	}

	async loadElements() {
		try {
			this.elements = await this.dictionary.load();
			this.crafting.build();
			this.wordList.render();
		} catch (error) {
			this.setStatus("Could not load the word list.");
			console.error(error);
		}
	}

	combine(elements) {
		const result = this.crafting.combine(elements);
		if (!result) return null;
		result.discovered = true;
		this.wordList.add(result);
		this.wordList.render();
		this.audio.play("discover");
		this.setStatus(`${elements.map((e) => e.word).join(" + ")} = ${this.getElementName(result)}`);
		this.imageGenerator.resolveEmoji(result)
			.then(() => {
				this.wordList.render();
				this.workspace.refreshEmoji(result);
			})
			.catch((error) => console.warn("Could not generate emoji.", error));
		return result;
	}

	getElementName(element) {
		return this.dictionary.getName(element);
	}

	getSearchName(element) {
		return this.dictionary.getSearchName(element);
	}

	setStatus(message) {
		this.resultText.textContent = message;
	}

async addWordToList(value) {
		const word = value.trim().replace(/[<>]/g, "");
		if (!word) return;
		const match = this.dictionary.find(word);
		if (!match) {
			this.setStatus(`${word} does not exist in the dictionary.`);
			return;
		}

		match.discovered = true;

		try {
			await this.imageGenerator.resolveEmoji(match);
		} catch (error) {
			console.warn("Could not generate emoji; using local fallback.", error);
		}
		this.wordList.add(match);
		this.addWordSearch.value = "";
		this.addSuggestions.innerHTML = "";
		this.wordList.render();
		this.setStatus(`${match.word} added to the word list.`);
	}

	renderAddSuggestions(query = "", category = this.addCategoryFilter?.value || "all") {
		const suggestions = this.dictionary.suggest(query, category);
		this.addWordPanel.renderSuggestions(suggestions);
	}
	
	filterElements(query = this.elementSearch.value, category = this.categoryFilter.value) {
		query = query.trim().toLowerCase();
		const matches = this.wordList.filter(query, category);
		this.wordList.render(matches);
		this.setStatus(query ? `${matches.length} name(s) found.` : "Ready.");
	}

	clearList() {
		this.wordList.clear();
		this.wordList.render();
		this.setStatus("Word list cleaned up.");
	}
}

new KompositaApp();
