
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, writeBatch, serverTimestamp, addDoc, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do Firebase (copiada do .env.local)
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
  console.log("=== Importador de Clientes via CLI ===");

  // 1. Autenticação Automática (Anônima)
  try {
    console.log("Autenticando...");
    await signInAnonymously(auth);
    console.log("Autenticado como convidado (Anônimo).");
  } catch (error) {
    console.warn("Aviso: Autenticação anônima falhou ou não está habilitada.", error.code);
    console.log("Tentando prosseguir sem autenticação...");
  }

  // 2. Listar Lojas
  console.log("\nBuscando lojas...");
  const storesSnapshot = await getDocs(collection(db, "stores"));
  const stores = [];
  storesSnapshot.forEach(doc => {
    stores.push({ id: doc.id, ...doc.data() });
  });

  if (stores.length === 0) {
    console.log("Nenhuma loja encontrada. Vamos criar uma loja rapidamente.");
    const name = await question("Nome da loja: ");
    const ownerEmail = await question("E-mail do dono (opcional): ");
    let ownerId = null;
    try {
      if (ownerEmail && ownerEmail.trim()) {
        const usersQ = query(collection(db, "users"), where("email","==", ownerEmail.trim()));
        const usersSnap = await getDocs(usersQ);
        if (!usersSnap.empty) {
          ownerId = usersSnap.docs[0].id;
          console.log(`Dono encontrado: ${ownerEmail} (id ${ownerId})`);
        } else {
          console.log("Nenhum usuário com esse e-mail foi encontrado; criando loja sem ownerId.");
        }
      }
    } catch (e) {
      console.log("Falha ao buscar dono por e-mail; prosseguindo sem ownerId.");
    }
    const data = {
      name: name?.trim() || "Nova Loja",
      ownerId: ownerId || null,
      adminId: ownerId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const res = await addDoc(collection(db, "stores"), data);
    const created = { id: res.id, ...data };
    console.log(`Loja criada: ${created.name} (ID: ${created.id})`);
    stores.push(created);
  }

  console.log("\nLojas disponíveis:");
  stores.forEach((store, index) => {
    console.log(`${index + 1}. ${store.name} (ID: ${store.id})`);
  });

  const storeIndex = await question("\nSelecione o número da loja para importar: ");
  let selectedStore = stores[parseInt(storeIndex) - 1];


  if (!selectedStore) {
    console.log("Loja inválida.");
    rl.close();
    setTimeout(() => process.exit(1), 100);
    return;
  }

  console.log(`\nLoja selecionada: ${selectedStore.name}`);

  // 3. Ler Arquivo Excel
  const excelPath = path.resolve(__dirname, '../src/assets/clientes.xlsx');
  console.log(`Lendo arquivo: ${excelPath}`);
  
  try {
    // Correção para leitura de arquivo em ESM
    // Em alguns ambientes ESM, a função readFile pode não estar disponível diretamente no export default
    // Alternativa: ler o arquivo como buffer e usar XLSX.read
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    console.log(`Encontrados ${data.length} registros.`);

    // 4. Processar e Importar
    const confirm = await question(`Deseja importar ${data.length} clientes para ${selectedStore.name}? (s/n): `);
    if (confirm.toLowerCase() !== 's') {
      console.log("Cancelado.");
      rl.close();
      setTimeout(() => process.exit(0), 100);
      return;
    }

    let batch = writeBatch(db);
    let count = 0;
    let totalImported = 0;

    const str = (val) => val ? String(val).trim() : '';

    for (const row of data) {
      let city = str(row['CIDADE']);
      let neighborhood = str(row['BAIRRO']);
      
      // Correção de bairro/cidade (mesma lógica do frontend)
      const knownCities = ['BIRIGUI', 'ARAÇATUBA', 'CLEMENTINA', 'GABRIEL MONTEIRO', 'BILAC', 'COROADOS'];
      if (!city && neighborhood && knownCities.includes(neighborhood.toUpperCase())) {
        city = neighborhood;
      }

      const clientData = {
        storeId: selectedStore.id,
        name: str(row['NOME']) || 'Cliente Importado',
        whatsapp: str(row['WHATSAPP']),
        phone: str(row['TELEFONE']),
        cpf: str(row['CPF']),
        city,
        neighborhood,
        address: str(row['ENDEREÇO']) || str(row['ENDERECO']) || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = doc(collection(db, "clients"));
      batch.set(docRef, clientData);
      count++;
      totalImported++;

      // Firestore batch limit is 500
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
        console.log(`Progresso: ${totalImported} clientes processados...`);
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    console.log(`\nSucesso! ${totalImported} clientes importados para ${selectedStore.name}.`);

  } catch (error) {
    console.error("Erro ao processar arquivo ou importar:", error);
  } finally {
    rl.close();
    setTimeout(() => process.exit(0), 100);
  }
}

main();
