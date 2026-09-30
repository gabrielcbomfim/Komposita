const fs = require("node:fs");
const readline = require("node:readline");
const path = require("node:path");
const emojiDataDe = require("emojibase-data/de/data.json"); // nomes/tags Unicode em alemão
const emojiDataEn = require("emojibase-data/en/data.json"); // nomes/tags Unicode em inglês

const inputPath = process.argv[2] || "kaikki.org-dictionary-German-words.jsonl";
const outputPath = process.argv[3] || "data/german-words.jsonl";
const LIMIT = Number(process.env.LIMIT) || Infinity; // ex.: LIMIT=300 node build-dictionary.js

const allowedPartsOfSpeech = new Set([
  "noun",
  "verb",
  "adj",
  "adv",
  "prep",
  "pron",
  "prefix",
  "suffix",
]);

const normalizedPartsOfSpeech = {
  noun: "noun",
  verb: "verb",
  adj: "adjective",
  adv: "adverb",
  prep: "preposition",
  pron: "pronoun",
  prefix: "prefix",
  suffix: "suffix",
};

const wordPattern = /^[A-Za-zÄÖÜäöüẞßÀ-ÿ]+$/;
const DEFAULT_EMOJI = "✨";
const excludedTags = new Set([]);

// === CONFIGURAÇÃO DO EMO ===
const EMO_THRESHOLD = 0.5;       // confiança "boa" do Emo
const EMO_GUESS_THRESHOLD = 0;   // último recurso: aceita o melhor palpite, por mais fraco que seja
const MAX_CANDIDATES = 5;  // quantas glosses em inglês testar por palavra
const BAD_GLOSS = /^(alternative|obsolete|dated|archaic|misspelling|abbreviation|initialism|contraction|synonym of|superseded|eye dialect)/i;

function getArticle(entry) {
    const tags = (entry.senses || []).flatMap((sense) => sense.tags || []);
    if (tags.includes("masculine")) return "der";
    if (tags.includes("feminine")) return "die";
    if (tags.includes("neuter")) return "das";

    for (const tpl of entry.head_templates || []) {
        const args = tpl.args || {};
        const g = args.g || args["1"];
        if (g === "m") return "der";
        if (g === "f") return "die";
        if (g === "n") return "das";
    }

    return null;
}

function hasExcludedTag(entry) {
    const tags = getEntryTags(entry);
    return tags.some((tag) => excludedTags.has(tag));
}

function getEntryTags(entry) {
    return [
        ...(entry.tags || []),
        ...(entry.senses || []).flatMap((sense) => sense.tags || [])
    ];
}

function isCanonicalEntry(entry) {
    return !getEntryTags(entry).includes("form-of");
}

// === EXTRATOR DE COMPÓSITOS ===
function analyzeCompound(entry) {
    let isCompound = false;
    let components = [];
    const compoundTemplates = ["compound", "com", "compound+", "com+", "univerbation", "affix", "af", "affix+", "af+", "prefix", "pre", "suffix", "suf", "surf", "surface analysis"];

    if (Array.isArray(entry.etymology_templates)) {
        for (const tpl of entry.etymology_templates) {
            if (compoundTemplates.includes(tpl.name)) {
                const args = tpl.args || {};
                let i = 2;
                let tempComponents = [];

                while (args[i.toString()]) {
                    let part = args[i.toString()].replace(/<[^>]+>/g, '').trim();
                    if (part.length > 0) tempComponents.push(part);
                    i++;
                }

                if (tempComponents.length > 1) {
                    isCompound = true;
                    components = tempComponents;
                    break;
                }
            }
        }
    }

    if (!isCompound && typeof entry.etymology_text === "string") {
        // O Wiktionary põe marcas invisíveis (U+200E) depois do "+", o que quebra o \s da regex
        const etymText = entry.etymology_text.replace(/[\u200e\u200f\u200b]/g, "");
        const match = etymText.match(/([A-ZÄÖÜäöüßa-z-]+)\s*\+\s*([A-ZÄÖÜäöüßa-z-]+)/);
        if (match) {
            isCompound = true;
            components = [match[1], match[2]];
        }
    }

    if (!isCompound && Array.isArray(entry.categories)) {
        if (entry.categories.some(cat => cat && typeof cat.name === "string" && cat.name.toLowerCase().includes("compound"))) {
            isCompound = true;
        }
    }

    if (!isCompound && entry.word && entry.word.includes("-") && !entry.word.startsWith("-") && !entry.word.endsWith("-")) {
        isCompound = true;
        components = entry.word.split("-");
    }

    return { isCompound, components };
}
// =========================================

function toCleanEntry(entry) {
    const partOfSpeech = normalizedPartsOfSpeech[entry.pos];
    // Só substantivos podem ser compostos (o jogo só forma substantivos por composição)
    const compoundData = partOfSpeech === "noun"
        ? analyzeCompound(entry)
        : { isCompound: false, components: [] };

    const cleanEntry = {
        word: entry.word,
        partOfSpeech,
        article: partOfSpeech === "noun" ? getArticle(entry) : null,
        isCompound: compoundData.isCompound,
        emoji: DEFAULT_EMOJI // Vai ser substituído na geração
    };

    if (compoundData.isCompound && compoundData.components.length > 0) {
        cleanEntry.components = compoundData.components;
    }

    return cleanEntry;
}

// === GERAÇÃO DE EMOJI ===

// "(anatomy) to eat, to devour" -> "eat"
function cleanGloss(gloss) {
    return gloss
        .replace(/\([^)]*\)/g, " ")       // remove "(anatomy)", "(figuratively)"...
        .split(/[;,]/)[0]                 // fica só com a primeira alternativa
        .replace(/^to\s+/i, "")           // "to eat" -> "eat"
        .replace(/^(a|an|the)\s+/i, "")   // tira artigos em inglês
        .replace(/\s+/g, " ")
        .trim();
}

// Extrai glosses em inglês limpas: ["man", "male"...]
function getEnglishGlosses(entry) {
    const glosses = [];
    for (const sense of entry.senses || []) {
        const list = sense.glosses || [];
        const gloss = list[list.length - 1]; // o mais específico
        if (typeof gloss !== "string" || BAD_GLOSS.test(gloss)) continue;

        const cleaned = cleanGloss(gloss);
        if (cleaned && cleaned.length <= 40 && !glosses.includes(cleaned)) {
            glosses.push(cleaned);
        }
        if (glosses.length >= MAX_CANDIDATES) break;
    }
    return glosses;
}

// Textos enviados ao Emo: glosses em inglês + a própria palavra (empréstimos: Pizza, Taxi...)
function getQueryCandidates(entry) {
    return [...getEnglishGlosses(entry), entry.word];
}

// === BUSCA DIRETA NO DICIONÁRIO UNICODE (CLDR) ===
// Índice: texto em minúsculas -> emoji. "labels" (nomes) têm prioridade sobre "tags".
function buildLookup(data) {
    const labels = new Map();
    const tagCounts = new Map(); // tag -> Set de emojis
    for (const e of data) {
        if (e.group === undefined || e.group === 2) continue; // ignora componentes
        const label = (e.label || "").toLowerCase();
        if (label && !labels.has(label)) labels.set(label, e.emoji);
        for (const tag of e.tags || []) {
            const t = tag.toLowerCase();
            if (!tagCounts.has(t)) tagCounts.set(t, new Set());
            tagCounts.get(t).add(e.emoji);
        }
    }
    // tag só vale se apontar para UM emoji (evita ambiguidade)
    const uniqueTags = new Map();
    for (const [t, set] of tagCounts) if (set.size === 1) uniqueTags.set(t, [...set][0]);
    return { labels, uniqueTags };
}

const lookupDe = buildLookup(emojiDataDe);
const lookupEn = buildLookup(emojiDataEn);

function findInLookup(lookup, text) {
    const t = text.toLowerCase();
    return lookup.labels.get(t) || lookup.uniqueTags.get(t) || null;
}

// 1º a palavra alemã ("Mann" -> 👨), 2º as glosses em inglês ("man" -> 👨)
function getEmojiFromUnicode(entry) {
    return (
        findInLookup(lookupDe, entry.word) ||
        getEnglishGlosses(entry).map((g) => findInLookup(lookupEn, g)).find(Boolean) ||
        null
    );
}

// Testa todos os candidatos e fica com o emoji de maior confiança
async function getEmojiFromEmo(emo, candidates, threshold = EMO_THRESHOLD) {
    let best = null;
    for (const text of candidates) {
        try {
            const suggestions = await emo.suggestions(text, { limit: 1 });
            const top = suggestions?.[0];
            if (top?.emoji && top.confidence >= threshold &&
                (!best || top.confidence > best.confidence)) {
                best = top;
            }
        } catch {
            // ignora erros para não interromper o processamento em massa
        }
    }
    return best ? best.emoji : null;
}

// === SEGUNDA PASSADA: compostos que a etimologia do Wiktionary não registrou ===
// Para cada substantivo ainda não marcado como composto, tenta dividi-lo em
// [modificador] + [núcleo substantivo], onde tudo EXISTE no próprio dicionário:
//   Feuerzeug = Feuer + Zeug
//   Bahnhofstraße = Bahnhof + Straße            (elemento de ligação "s")
//   Ultraleichtflugzeug = ultra + leicht + Flugzeug  (modificador com várias partes)
const LINKING_ELEMENTS = ["", "s", "n", "en", "e", "er", "es"];
const MIN_PART = 3;

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function markCompoundsByDecomposition(entries) {
    // minúsculas -> palavra real do dicionário (substantivos têm prioridade)
    const known = new Map();
    const nouns = new Set();
    for (const e of entries.values()) {
        const lower = e.word.toLowerCase();
        if (e.partOfSpeech === "noun") {
            nouns.add(e.word);
            known.set(lower, e.word);
        } else if (!known.has(lower)) {
            known.set(lower, e.word);
        }
    }

    // Decompõe o modificador em palavras existentes: "ultraleicht" -> ["ultra", "leicht"]
    const memo = new Map();
    function splitModifier(lower) {
        if (known.has(lower)) return [known.get(lower)];
        if (memo.has(lower)) return memo.get(lower);
        memo.set(lower, null); // evita recursão infinita
        let result = null;
        for (let i = MIN_PART; i <= lower.length - MIN_PART && !result; i++) {
            const first = lower.slice(0, i);
            if (!known.has(first)) continue;
            for (const link of LINKING_ELEMENTS) {
                if (!lower.startsWith(link, i)) continue;
                const rest = lower.slice(i + link.length);
                if (rest.length < MIN_PART) continue;
                const restParts = splitModifier(rest);
                if (restParts) {
                    result = [known.get(first), ...restParts];
                    break;
                }
            }
        }
        memo.set(lower, result);
        return result;
    }

    const found = [];
    for (const e of entries.values()) {
        if (e.partOfSpeech !== "noun" || e.isCompound) continue;
        const word = e.word;

        let best = null;
        for (let i = MIN_PART; i <= word.length - MIN_PART; i++) {
            const modifier = word.slice(0, i);
            const modParts = splitModifier(modifier.toLowerCase());
            if (!modParts) continue;

            for (const link of LINKING_ELEMENTS) {
                if (!word.startsWith(link, i)) continue;
                const head = capitalize(word.slice(i + link.length));
                if (head.length < MIN_PART || !nouns.has(head)) continue;

                // prefere divisões equilibradas (Bahnhof+Straße, não Bahn+Hofstraße)
                // e modificadores que sejam substantivos
                const score = Math.min(modifier.length, head.length) + (nouns.has(modifier) ? 100 : 0);
                if (!best || score > best.score) best = { modParts, head, score };
            }
        }

        if (best) {
            e.isCompound = true;
            e.components = [...best.modParts, best.head];
            e.compoundSource = "decomposition";
            found.push(e);
        }
    }
    return found;
}

// Cadeia de decisão. Devolve { emoji, source } ou null.
async function resolveEmoji(emo, entry, cleanEntry) {
    const candidates = getQueryCandidates(entry);

    // 1) Dicionário Unicode (exato)
    let emoji = getEmojiFromUnicode(entry);
    if (emoji) return { emoji, source: "unicode" };

    // 2) Emo com confiança boa
    emoji = await getEmojiFromEmo(emo, candidates, EMO_THRESHOLD);
    if (emoji) return { emoji, source: "emo" };

    // 3) Compostos: o núcleo é o último componente (Handschuh -> Schuh)
    const parts = (cleanEntry.components || []).filter((c) => wordPattern.test(c));
    if (parts.length > 0) {
        const head = parts[parts.length - 1];
        emoji =
            getEmojiFromUnicode({ word: head, senses: [] }) ||
            (await getEmojiFromEmo(emo, [head], EMO_GUESS_THRESHOLD));
        if (emoji) return { emoji, source: "component" };
    }

    // 4) Palpite: aceita o melhor candidato do Emo, mesmo com pouca confiança
    emoji = await getEmojiFromEmo(emo, candidates, EMO_GUESS_THRESHOLD);
    if (emoji) return { emoji, source: "guess" };

    return null;
}

async function main() {
    console.log("A carregar modelo Emo localmente (~11MB)...");
    const { Emo } = await import("@desert-ant-labs/emo/native");
    const emo = await Emo.load();
    console.log("✅ Emo carregado. A iniciar processamento do dicionário...\n");

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const entries = new Map();
    const input = fs.createReadStream(inputPath, { encoding: "utf8" });
    const reader = readline.createInterface({ input, crlfDelay: Infinity });

    let read = 0;
    let kept = 0;
    let compoundCount = 0;
    const stats = { unicode: 0, emo: 0, component: 0, guess: 0, default: 0 };

    for await (const line of reader) {
        if (!line.trim()) continue;
        read += 1;
        let entry;
        try {
            entry = JSON.parse(line);
        } catch {
            continue;
        }

        if (
            entry.lang_code !== "de" ||
            !allowedPartsOfSpeech.has(entry.pos) ||
            !isCanonicalEntry(entry) ||
            typeof entry.word !== "string" ||
            !wordPattern.test(entry.word) ||
            hasExcludedTag(entry)
        ) continue;

        const cleanEntry = toCleanEntry(entry);
        const key = `${cleanEntry.word.toLocaleLowerCase("de-DE")}::${cleanEntry.partOfSpeech}`;

        if (!entries.has(key)) {
            // Prefixos e sufixos não têm um emoji que faça sentido
            const isAffix = entry.pos === "prefix" || entry.pos === "suffix";
            // Passa o objeto cru do Kaikki (tem os "senses" com as glosses em inglês)
            const result = isAffix ? null : await resolveEmoji(emo, entry, cleanEntry);

            if (result) {
                cleanEntry.emoji = result.emoji;
                cleanEntry.emojiSource = result.source; // unicode | emo | component | guess
                stats[result.source] = (stats[result.source] || 0) + 1;
            } else {
                cleanEntry.emoji = DEFAULT_EMOJI;
                stats.default += 1;
            }

            entries.set(key, cleanEntry);
            kept += 1;

            if (cleanEntry.isCompound && cleanEntry.components) {
                compoundCount += 1;
            }

            // Log de progresso a cada 1000 palavras guardadas
            if (kept % 1000 === 0) {
                console.log(`Progresso: ${kept} palavras guardadas (Última: ${cleanEntry.word} ${cleanEntry.emoji})`);
            }

            // Limite opcional para testar numa amostra pequena
            if (kept >= LIMIT) break;
        }
    }

    // Segunda passada: acha compostos que a etimologia não registrou
    const decomposed = markCompoundsByDecomposition(entries);
    console.log(`\nSegunda passada: ${decomposed.length} compostos adicionais encontrados por decomposição.`);
    console.log("Amostra (confira se fazem sentido):");
    for (const e of decomposed.slice(0, 25)) console.log(`  ${e.word} = ${e.components.join(" + ")}`);
    compoundCount += decomposed.length;

    console.log("\nProcessamento concluído. A gravar no disco...");

    const output = fs.createWriteStream(outputPath, { encoding: "utf8" });
    for (const entry of entries.values()) {
        output.write(`${JSON.stringify(entry)}\n`);
    }

    await new Promise((resolve, reject) => {
        output.on("finish", resolve);
        output.on("error", reject);
        output.end();
    });

    console.log(`Leitura: ${read} entradas | Salvas: ${kept} entradas válidas.`);
    console.log(`Total de palavras compostas identificadas: ${compoundCount}`);
    console.log("Origem dos emojis:", stats);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});