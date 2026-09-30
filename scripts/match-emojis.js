// Gera a tabela palavra -> emoji com um LLM (OpenRouter), em lotes, com retomada.
// Uso:
//   export OPENROUTER_API_KEY=sk-or-...        (NÃO coloque a chave em arquivo servido pelo site)
//   node generate-emojis-ai.js [entrada.jsonl] [saida.jsonl] [limite]
// Saída: uma linha por palavra: {"word":"Hund","emoji":"🐕"} ; emoji null = sem emoji adequado.
const fs = require("node:fs");
const readline = require("node:readline");

const inputPath = process.argv[2] || "data/german-words.jsonl";
const outputPath = process.argv[3] || "data/german-words-with-emojis-ai.jsonl";
const limit = Number(process.argv[4]) || Infinity;
const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.EMOJI_MODEL || "poolside/laguna-s-2.1:free";
const BATCH = 50;

if (!apiKey) { console.error("Defina OPENROUTER_API_KEY."); process.exit(1); }

const SYSTEM = `Você recebe uma lista JSON de palavras alemãs (com classe gramatical).
Para cada uma, escolha UM emoji que represente bem o significado. Se a palavra for abstrata
demais para ter um emoji claro (ex.: preposições, pronomes, conceitos abstratos), use null.
Responda SOMENTE com um objeto JSON {"palavra": "emoji ou null", ...}, sem texto extra nem markdown.`;

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
			if (i >= tries) { console.warn("Lote ignorado:", error.message); return {}; }
			await new Promise((r) => setTimeout(r, 2000 * i));
		}
	}
}

async function main() {
	// retomada: pula palavras que já estão na saída
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
			if (!(e.word in result)) continue; // resposta faltou: tenta de novo numa próxima execução
			const emoji = typeof result[e.word] === "string" ? [...result[e.word].trim()].length ? result[e.word].trim() : null : null;
			out.write(JSON.stringify({ word: e.word, emoji }) + "\n");
		}
		processed += batch.length;
		console.log(`${processed} palavras processadas`);
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