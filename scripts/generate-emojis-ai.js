// Builds a word -> emoji table with an LLM (via OpenRouter), in batches, resumable.
//
// Usage:
//   export OPENROUTER_API_KEY=sk-or-...   (never put the key in a file served by the site or committed to git)
//   node scripts/generate-emojis-ai.js [input.jsonl] [output.jsonl] [limit]
//
// Output: one line per word, e.g. {"word":"Hund","emoji":"🐕"}; emoji null = no suitable emoji.
// The game picks this file up automatically (see js/dictionary.js).
const fs = require("node:fs");
const readline = require("node:readline");

const inputPath = process.argv[2] || "data/german-words.jsonl";
const outputPath = process.argv[3] || "data/german-words-with-emojis-ai.jsonl";
const limit = Number(process.argv[4]) || Infinity;
const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.EMOJI_MODEL || "poolside/laguna-s-2.1:free";
const BATCH = 50;

if (!apiKey) { console.error("Set the OPENROUTER_API_KEY environment variable."); process.exit(1); }

const SYSTEM = `You receive a JSON list of German words (with their part of speech).
For each one, choose ONE emoji that represents its meaning well. If the word is too abstract
to have a clear emoji (e.g. prepositions, pronouns, abstract concepts), use null.
Reply ONLY with a JSON object {"word": "emoji or null", ...}, with no extra text or markdown.`;

async function ask(batch) {
	const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
		body: JSON.stringify({
			model, temperature: 0,
			messages: [
				{ role: "system", content: SYSTEM },
				{ role: "user", content: JSON.stringify(batch.map((e) => ({ word: e.word, pos: e.partOfSpeech }))) }
			]
		})
	});
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
	const data = await res.json();
	const text = data.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim();
	return JSON.parse(text);
}

async function askWithRetry(batch, tries = 3) {
	for (let i = 1; ; i++) {
		try { return await ask(batch); }
		catch (error) {
			if (i >= tries) { console.warn("Batch skipped:", error.message); return {}; }
			await new Promise((r) => setTimeout(r, 2000 * i));
		}
	}
}

async function main() {
	// resume: skip words already in the output
	const done = new Set();
	if (fs.existsSync(outputPath)) {
		for (const line of fs.readFileSync(outputPath, "utf8").split("\n").filter(Boolean)) done.add(JSON.parse(line).word);
	}
	const out = fs.createWriteStream(outputPath, { encoding: "utf8", flags: "a" });
	const reader = readline.createInterface({ input: fs.createReadStream(inputPath, "utf8"), crlfDelay: Infinity });

	let batch = [], processed = 0;
	const flush = async () => {
		if (!batch.length) return;
		const result = await askWithRetry(batch);
		for (const e of batch) {
			if (!(e.word in result)) continue; // missing from the reply: retried on the next run
			const emoji = typeof result[e.word] === "string" && result[e.word].trim() ? result[e.word].trim() : null;
			out.write(JSON.stringify({ word: e.word, emoji }) + "\n");
		}
		processed += batch.length;
		console.log(`${processed} words processed`);
		batch = [];
	};

	for await (const line of reader) {
		if (!line.trim()) continue;
		const entry = JSON.parse(line);
		if (done.has(entry.word)) continue;
		if (processed + batch.length >= limit) break;
		batch.push(entry);
		if (batch.length >= BATCH) await flush();
	}
	await flush();
	out.end();
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
