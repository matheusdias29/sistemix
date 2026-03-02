
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, writeBatch, query, where, limit, startAfter } from 'firebase/firestore';
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
console.log(`Usando Firestore databaseId: ${dbId}`);
const auth = getAuth(app);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log("=== Corretor de Clientes (nameLower) ===");
  console.log("Este script irá adicionar o campo 'nameLower' em todos os clientes que não o possuem.");

  try {
    console.log("Autenticando...");
    await signInAnonymously(auth);
    console.log("Autenticado com sucesso.");
  } catch (error) {
    console.error("Erro na autenticação:", error.message);
    process.exit(1);
  }

  // Listar Lojas
  console.log("\nBuscando lojas...");
  const storesSnapshot = await getDocs(collection(db, "stores"));
  const stores = [];
  storesSnapshot.forEach(doc => {
    stores.push({ id: doc.id, ...doc.data() });
  });

  if (stores.length === 0) {
    console.log("Nenhuma loja encontrada.");
    process.exit(1);
  }

  console.log("\nLojas disponíveis:");
  stores.forEach((store, index) => {
    console.log(`${index + 1}. ${store.name} (ID: ${store.id})`);
  });

  const storeIndex = await question("\nSelecione o número da loja para corrigir (ou 0 para sair): ");
  const idx = parseInt(storeIndex);
  
  if (idx === 0 || isNaN(idx)) {
    console.log("Saindo...");
    process.exit(0);
  }

  const selectedStore = stores[idx - 1];
  if (!selectedStore) {
    console.log("Loja inválida.");
    process.exit(1);
  }

  console.log(`\nIniciando correção para a loja: ${selectedStore.name} (${selectedStore.id})`);
  
  const colRef = collection(db, 'clients');
  let lastDoc = null;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let hasMore = true;
  const BATCH_SIZE = 500; // Leitura em chunks

  while (hasMore) {
    let q = query(colRef, where('storeId', '==', selectedStore.id), limit(BATCH_SIZE));
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    process.stdout.write(`Buscando lote de clientes... `);
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log("Fim da lista de clientes.");
      hasMore = false;
      break;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const name = (data.name || '').trim();
      const expectedLower = name.toLowerCase();
      
      // Se não tem nameLower OU se nameLower é diferente do esperado
      if (!data.nameLower || data.nameLower !== expectedLower) {
        const ref = doc(db, 'clients', docSnap.id);
        batch.update(ref, { nameLower: expectedLower });
        batchCount++;
        totalUpdated++;
      }
      totalProcessed++;
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`Lote processado: ${snapshot.size}. Atualizados: ${batchCount}. (Total acumulado: ${totalUpdated})`);
    } else {
      console.log(`Lote processado: ${snapshot.size}. Nenhum precisou de atualização.`);
    }
  }

  console.log(`\n=== CONCLUÍDO ===`);
  console.log(`Total de clientes verificados: ${totalProcessed}`);
  console.log(`Total de clientes corrigidos: ${totalUpdated}`);
  
  process.exit(0);
}

main().catch(console.error);
