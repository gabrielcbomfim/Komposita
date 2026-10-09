// Recipe engine. Every compound is reduced to its "roots" — the non-compound
// words it is ultimately built from — so the same compound can be crafted at
// any level of decomposition:
//   Haus + Tür + Schlüssel  =  Haustür + Schlüssel  =  Haustürschlüssel
// Linking elements (Fugenelemente such as "-s-" or "-n-") are ignored.
class Crafting {
	constructor(dictionary) {
		this.dictionary = dictionary;
		this.byWord = new Map();  // "apfel" -> entry
		this.recipes = new Map(); // "apfel|baum" -> entry for Apfelbaum
	}

	build() {
		this.byWord.clear();
		this.recipes.clear();
		for (const entry of this.dictionary.items) this.byWord.set(entry.word.toLowerCase(), entry);
		for (const entry of this.dictionary.items) {
			const roots = entry.isCompound && entry.components ? this.roots(entry.word) : [entry.word.toLowerCase()];
			entry.isBase = roots.length < 2; // base word (not a compound)
			if (!entry.isBase) {
				this.recipes.set(roots.join("|"), entry);
				entry.discovered = entry.discovered === true; // keep saved state, otherwise false
			} else {
				entry.discovered = true; // base words start out discovered
			}
		}
	}

	roots(word, path = []) {
		const key = word.toLowerCase();
		if (path.includes(key)) return [key]; // guard against circular entries
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
