const fs = require("node:fs");
const readline = require("node:readline");
const path = require("node:path");

const inputPath = path.join(__dirname, "..", "data", "german-words.jsonl");

// Função recursiva que desce na árvore até encontrar as raízes primitivas de uma palavra
function extrairPrimitivos(palavra, dicionarioBase, visitados = new Set()) {
    const palavraMin = palavra.toLowerCase();
    
    // Evita loops infinitos caso o dicionário tenha referências circulares
    if (visitados.has(palavraMin)) return [palavraMin];
    visitados.add(palavraMin);

    const entry = dicionarioBase.get(palavraMin);

    // Se a palavra não for composta ou não tiver componentes válidos, ela é uma "Raiz Primitiva"
    if (!entry || !entry.isCompound || !entry.components) {
        return [palavraMin];
    }

    // Limpa os componentes (tira hifens)
    const partesLimpas = entry.components
        .filter(c => !c.includes("-"))
        .map(c => c.toLowerCase());

    // Se alguma parte não existe no dicionário, consideramos a palavra atual como primitiva para evitar erros
    if (!partesLimpas.every(p => dicionarioBase.has(p))) {
        return [palavraMin];
    }

    // A MÁGICA: Recursividade! Quebra os componentes em componentes menores até sobrar só a raiz
    return partesLimpas.flatMap(p => extrairPrimitivos(p, dicionarioBase, visitados));
}

async function carregarMotorLittleAlchemy() {
    const mapaCombinacoes = new Map();
    const dicionarioBase = new Map();
    const entries = [];
    
    if (!fs.existsSync(inputPath)) {
        console.error(`Arquivo não encontrado: ${inputPath}`);
        return { mapaCombinacoes, dicionarioBase };
    }

    const fileStream = fs.createReadStream(inputPath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    // PASSO 1: Carregar vocabulário
    for await (const line of rl) {
        if (!line.trim() || !line.startsWith("{")) continue; 
        try {
            const entry = JSON.parse(line);
            entries.push(entry);
            dicionarioBase.set(entry.word.toLowerCase(), entry);
        } catch (e) {
            continue;
        }
    }

    // PASSO 2: Criar o Mapa Universal baseado nas Raízes Primitivas
    for (const entry of entries) {
        if (!entry.isCompound || !entry.components) continue;

        const primitivos = extrairPrimitivos(entry.word, dicionarioBase);
        
        // Só salva se a palavra for formada por 2 ou mais elementos primitivos
        if (primitivos.length >= 2) {
            const chaveUniversal = primitivos.join("|");
            
            // Salva a chave "passagier|flug|zeug" apontando para "Passagierflugzeug"
            mapaCombinacoes.set(chaveUniversal, entry.word);
        }
    }
    
    return { mapaCombinacoes, dicionarioBase };
}

// O motor de Crafting que vai rodar no seu jogo
function tentarCrafting(ingredientes, mapaCombinacoes, dicionarioBase) {
    // 1. Quebra todos os ingredientes do jogador até as raízes primitivas
    const raizes = ingredientes.flatMap(item => extrairPrimitivos(item, dicionarioBase));
    
    // 2. Junta as raízes na ordem que foram colocadas para formar a chave de busca
    const chaveDeBusca = raizes.join("|");
    
    // 3. Testa se existe algo que nasce dessa combinação
    if (mapaCombinacoes.has(chaveDeBusca)) {
        return mapaCombinacoes.get(chaveDeBusca);
    }
    return null;
}

// === TESTE DA NOVA ARQUITETURA ===
async function iniciar() {
    console.log("Iniciando a Engine do Little Alchemy...\n");
    const { mapaCombinacoes, dicionarioBase } = await carregarMotorLittleAlchemy();
    
    if (dicionarioBase.size === 0) return;

    // Para fins de teste manual da arquitetura, vamos inserir falsamente o Passagierflugzeug 
    // caso ele não esteja no seu arquivo JSONL para garantir que o teste rode.
    dicionarioBase.set("passagier", { word: "Passagier", isCompound: false });
    dicionarioBase.set("flugzeug", { word: "Flugzeug", isCompound: true, components: ["Flug", "Zeug"] });
    dicionarioBase.set("passagierflugzeug", { word: "Passagierflugzeug", isCompound: true, components: ["Passagier", "Flugzeug"] });
    // Força o registro no mapa
    mapaCombinacoes.set("passagier|flug|zeug", "Passagierflugzeug");
    mapaCombinacoes.set("flug|zeug", "Flugzeug");

    console.log("--- TESTANDO AS MÚLTIPLAS COMBINAÇÕES ---");

    const tentativasDoJogador = [
        ["Flug", "Zeug"],                           // Combinação básica
        ["Passagier", "Flug", "Zeug"],              // Combinação de 3 raízes puras
        ["Passagier", "Flugzeug"],                  // Misturando Raiz + Composto
        ["Passagierflug", "Zeug"],                  // Misturando Composto Alternativo + Raiz
        ["Rausch", "Mittel"]                        // Teste padrão
    ];

    for (const tentativa of tentativasDoJogador) {
        const representacaoVisual = tentativa.join(" + ");
        const resultado = tentarCrafting(tentativa, mapaCombinacoes, dicionarioBase);
        
        if (resultado) {
            console.log(`✅ CRAFT SUCESSO: ${representacaoVisual}  =>  ${resultado}`);
        } else {
            console.log(`❌ CRAFT FALHOU:  ${representacaoVisual}`);
        }
    }
}

iniciar().catch(console.error);