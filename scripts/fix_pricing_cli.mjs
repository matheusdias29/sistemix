
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, writeBatch, query, where, limit, startAfter, orderBy } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import readline from 'readline';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDm61fcXbemFSUIiTEATy47SBD5PvsCpaI",
  authDomain: "sixtemix.firebaseapp.com",
  projectId: "sixtemix",
  storageBucket: "sixtemix.firebasestorage.app",
  messagingSenderId: "322849102175",
  appId: "1:322849102175:web:a3aef88707c94ff257beea",
  measurementId: "G-W3XDS34DZ8"
};

const app = initializeApp(firebaseConfig);
const dbId = process.env.FIRESTORE_DB_ID || 'sistemix';
const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, dbId);
const auth = getAuth(app);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log("=== Corretor de Precificação de Produtos via CLI ===");
  console.log("Este script irá zerar as precificações 2, 3 e 4 de todos os produtos da loja selecionada.");

  // 1. Autenticação
  try {
    await signInAnonymously(auth);
    console.log("✔ Autenticado.");
  } catch (error) {
    console.error("❌ Falha na autenticação:", error.code);
    process.exit(1);
  }

  // 2. Selecionar Loja
  const storesSnapshot = await getDocs(collection(db, "stores"));
  const stores = storesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  if (stores.length === 0) {
    console.log("❌ Nenhuma loja encontrada.");
    process.exit(1);
  }

  console.log("\nLojas disponíveis:");
  stores.forEach((store, index) => console.log(`${index + 1}. ${store.name}`));
  const storeIndex = await question("\nSelecione a loja para corrigir (número): ");
  const selectedStore = stores[parseInt(storeIndex) - 1];

  if (!selectedStore) {
    console.log("❌ Loja inválida.");
    process.exit(1);
  }
  console.log(`✔ Loja selecionada: ${selectedStore.name}`);

  const confirm = await question(`\nATENÇÃO: Isso irá alterar TODOS os produtos da loja ${selectedStore.name}. Deseja continuar? (s/n): `);
  if (confirm.toLowerCase() !== 's') {
    console.log("Cancelado.");
    process.exit(0);
  }

  // 3. Processamento em Lotes
  console.log("\n🔄 Iniciando correção...");
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  let lastDoc = null;
  const BATCH_SIZE = 400;

  while (true) {
    let q = query(
      collection(db, 'products'), 
      where('storeId', '==', selectedStore.id),
      // orderBy removido para usar índice padrão (__name__)
      limit(BATCH_SIZE)
    );

    if (lastDoc) {
      q = query(
        collection(db, 'products'), 
        where('storeId', '==', selectedStore.id),
        // orderBy removido
        startAfter(lastDoc),
        limit(BATCH_SIZE)
      );
    }

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      break;
    }

    const batch = writeBatch(db);
    let batchCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      totalProcessed++;

      // Verificar se precisa corrigir
      if (Array.isArray(data.variationsData) && data.variationsData.length > 1) {
        let needsUpdate = false;
        const newVariations = data.variationsData.map((v, index) => {
          // Pular o primeiro item (índice 0 = P1)
          if (index === 0) return v;

          // Se for índice > 0 e tiver valor > 0, zera e marca update
          if (v.salePrice > 0 || v.cost > 0) {
            needsUpdate = true;
            return {
              ...v,
              salePrice: 0,
              cost: 0,
              stock: 0, // Garantir estoque zero nas variações secundárias
              stockMin: 0
            };
          }
          return v;
        });

        if (needsUpdate) {
          batch.update(doc.ref, { 
            variationsData: newVariations,
            updatedAt: new Date() // Atualiza timestamp também
          });
          batchCount++;
          totalUpdated++;
        }
      }
    });

    if (batchCount > 0) {
      await batch.commit();
      process.stdout.write(`\rProcessados: ${totalProcessed} | Atualizados: ${totalUpdated}`);
    } else {
        process.stdout.write(`\rProcessados: ${totalProcessed} | Atualizados: ${totalUpdated}`);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    // Pequena pausa para não estourar rate limits se houver muitos writes
    if (batchCount > 300) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n\n✅ Correção Finalizada!`);
  console.log(`Total de Produtos Verificados: ${totalProcessed}`);
  console.log(`Total de Produtos Corrigidos: ${totalUpdated}`);

  rl.close();
  setTimeout(() => process.exit(0), 1000);
}

main().catch(e => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
