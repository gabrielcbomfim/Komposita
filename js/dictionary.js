// Loads the word list built by scripts/build-dictionary.js (one JSON entry per line).
class Dictionary {
	constructor(url = "data/german-words.jsonl") {
		this.url = url;
		this.items = [];
	}

	async load() {
		const response = await fetch(this.url);
		if (!response.ok) throw new Error(`Could not load the word list (${response.status}).`);
		const text = await response.text();
		this.items = text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
		return this.items;
	}

	getName(element) {
		return element.partOfSpeech === "noun" && element.article ? `${element.article} ${element.word}` : element.word;
	}

	getSearchName(element) {
		return this.getName(element).toLowerCase();
	}

	// Case matters in German (die Orange vs orange, Sonne vs sonne), so an exact
	// match wins; "die orange" also resolves to the noun via its article.
	find(value) {
		const exact = value.trim();
		const query = exact.toLowerCase();
		return this.items.find((element) => element.word === exact) ||
			this.items.find((element) => this.getSearchName(element) === query) ||
			this.items.find((element) => element.word.toLowerCase() === query);
	}

	getDiscovered() {
		return this.items
			.filter((element) => element.discovered && !element.isBase)
			.sort((a, b) => a.word.localeCompare(b.word, "de"));
	}

	suggest(query, category = "all", limit = 6) {
		const normalizedQuery = query.trim().toLowerCase();
		return this.items.filter((element) => {
			return (!normalizedQuery || this.getSearchName(element).includes(normalizedQuery)) &&
				(category === "all" || element.partOfSpeech === category);
		}).slice(0, limit);
	}
}
