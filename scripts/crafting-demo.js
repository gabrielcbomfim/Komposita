// Command-line demo of the crafting engine used by the game (js/crafting.js).
//
// Every compound is reduced recursively to its primitive roots, and the recipe
// key is the ordered list of those roots. That way the player can build a word
// at any level of decomposition:
//   Haus + Tür + Schlüssel  ->  "haus|tür|schlüssel"  ->  Haustürschlüssel
//   Haustür + Schlüssel     ->  "haus|tür|schlüssel"  ->  Haustürschlüssel
//
// Usage: node scripts/crafting-demo.js [Word Word ...]
const fs = require("node:fs");
const readline = require("node:readline");
const path = require("node:path");

const inputPath = path.join(__dirname, "..", "data", "german-words.jsonl");

// Walks down the compound tree until it reaches the primitive roots of a word
function extractRoots(word, dictionary, visited = new Set()) {
    const key = word.toLowerCase();

    // guard against circular references in the data
    if (visited.has(key)) return [key];
    visited.add(key);

    const entry = dictionary.get(key);

    // not a compound (or no usable components): it is a primitive root
    if (!entry || !entry.isCompound || !entry.components) {
        return [key];
    }

    // drop linking elements such as "-s-" or "-n-" (Fugenelemente)
    const parts = entry.components
        .filter((c) => !c.includes("-"))
        .map((c) => c.toLowerCase());

    // if any part is missing from the dictionary, treat the word itself as primitive
    if (!parts.every((p) => dictionary.has(p))) {
        return [key];
    }

    return parts.flatMap((p) => extractRoots(p, dictionary, visited));
}

async function loadCraftingEngine() {
    const recipes = new Map();
    const dictionary = new Map();
    const entries = [];

    if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        return { recipes, dictionary };
    }

    const fileStream = fs.createReadStream(inputPath, { encoding: "utf8" });
    const reader = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    // Step 1: load the vocabulary
    for await (const line of reader) {
        if (!line.trim() || !line.startsWith("{")) continue;
        try {
            const entry = JSON.parse(line);
            entries.push(entry);
            dictionary.set(entry.word.toLowerCase(), entry);
        } catch {
            continue;
        }
    }

    // Step 2: index every compound by its ordered primitive roots
    for (const entry of entries) {
        if (!entry.isCompound || !entry.components) continue;

        const roots = extractRoots(entry.word, dictionary);
        if (roots.length >= 2) {
            // e.g. "passagier|flug|zeug" -> "Passagierflugzeug"
            recipes.set(roots.join("|"), entry.word);
        }
    }

    return { recipes, dictionary };
}

function tryCrafting(ingredients, recipes, dictionary) {
    // 1. break every ingredient down to its primitive roots
    const roots = ingredients.flatMap((item) => extractRoots(item, dictionary));
    // 2. join them in the order they were placed: German compounds are head-final, order matters
    const key = roots.join("|");
    // 3. look the key up
    return recipes.get(key) || null;
}

async function main() {
    console.log("Loading the dictionary...\n");
    const { recipes, dictionary } = await loadCraftingEngine();
    if (dictionary.size === 0) return;
    console.log(`${dictionary.size} words, ${recipes.size} recipes.\n`);

    const fromArgs = process.argv.slice(2);
    const attempts = fromArgs.length ? [fromArgs] : [
        ["Flug", "Zeug"],                // two roots
        ["Zeug", "Flug"],                // same roots, wrong order
        ["Haus", "Tür", "Schlüssel"],    // three roots
        ["Haustür", "Schlüssel"],        // compound + root
        ["Wort", "Buch"],                // linking element: Wort + -er- + Buch
        ["Sonne", "Blume"]               // linking element: Sonne + -n- + Blume
    ];

    for (const attempt of attempts) {
        const label = attempt.join(" + ");
        const result = tryCrafting(attempt, recipes, dictionary);
        console.log(result ? `✅ ${label}  =>  ${result}` : `❌ ${label}`);
    }
}

main().catch(console.error);
