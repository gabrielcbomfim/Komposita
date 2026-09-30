class Crafting {
	constructor(dictionary) {
		this.dictionary = dictionary;
		this.byWord = new Map();  // "apfel" -> entrada
		this.recipes = new Map(); // "apfel|baum" -> entrada de Apfelbaum
	}

	build() {
		this.byWord.clear();
		this.recipes.clear();
		for (const entry of this.dictionary.items) this.byWord.set(entry.word.toLowerCase(), entry);
		for (const entry of this.dictionary.items) {
			const roots = entry.isCompound && entry.components ? this.roots(entry.word) : [entry.word.toLowerCase()];
			entry.isBase = roots.length < 2; // palavra nuclear (sem composição)
			if (!entry.isBase) {
				this.recipes.set(roots.join("|"), entry);
				entry.discovered = entry.discovered === true; // mantém o que veio salvo, senão false
			} else {
				entry.discovered = true; // palavra base já nasce descoberta
			}
		}
	}

	roots(word, path = []) {
		const key = word.toLowerCase();
		if (path.includes(key)) return [key];
		const entry = this.byWord.get(key);
		if (!entry || !entry.isCompound || !entry.components) return [key];
		const parts = entry.components.filter((c) => !c.includes("-")).map((c) => c.toLowerCase());
		if (!parts.length || !parts.every((p) => this.byWord.has(p))) return [key];
		return parts.flatMap((p) => this.roots(p, [...path, key]));
	}

	combine(elements) {
		const key = elements.flatMap((e) => this.roots(e.word)).join("|");
		return this.recipes.get(key) || null;
	}
}