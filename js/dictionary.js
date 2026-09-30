class Dictionary {
	constructor(url = "data/german-words.jsonl", emojiCacheUrl = "data/german-words-with-emojis-ai.jsonl") {
		this.url = url;
		this.emojiCacheUrl = emojiCacheUrl;
		this.items = [];
	}

	async load() {
		const response = await fetch(this.url);
		if (!response.ok) throw new Error(`Could not load the word list (${response.status}).`);
		const text = await response.text();
		this.items = text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
		try {
			const cacheResponse = await fetch(this.emojiCacheUrl);
			if (cacheResponse.ok) {
				const cacheText = await cacheResponse.text();
				const emojiByWord = new Map(cacheText.split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((element) => element.emoji).map((element) => [element.word, element.emoji]));
				this.items.forEach((element) => {
					if (emojiByWord.has(element.word)) element.emoji = emojiByWord.get(element.word);
				});
			}
		} catch (error) {
			console.warn("Could not load emoji cache.", error);
		}
		return this.items;
	}

	getName(element) {
		return element.partOfSpeech === "noun" && element.article ? `${element.article} ${element.word}` : element.word;
	}

	getSearchName(element) {
		return this.getName(element).toLowerCase();
	}

	find(value) {
		const query = value.trim().toLowerCase();
		return this.items.find((element) => element.word.toLowerCase() === query || this.getSearchName(element) === query);
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
