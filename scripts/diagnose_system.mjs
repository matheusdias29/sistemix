
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import { fileURLToPath } from 'url';
import path from 'path';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDm61fcXbemFSUIiTEATy47SBD5PvsCpaI",
  authDomain: "sixtemix.firebaseapp.com",
  projectId: "sixtemix",
  storageBucket: "sixtemix.firebasestorage.app",
  messagingSenderId: "322849102175",
  appId: "1:322849102175:web:fe6b351b3f99a98a57beea",
  measurementId: "G-Y81FPL8XTT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  console.log("=== Diagnóstico do Sistema Sistemix ===");
  console.log(`Project ID: ${firebaseConfig.projectId}`);
  console.log(`Auth Domain: ${firebaseConfig.authDomain}`);
  console.log("------------------------------------------------");

  // 1. Tentar Login Anônimo para ler dados públicos
  try {
    console.log("Tentando autenticação anônima para leitura...");
    await signInAnonymously(auth);
    console.log("✅ Login anônimo realizado com sucesso.");
  } catch (error) {
    console.log("⚠️ Falha no login anônimo:", error.code);
    console.log("   (Isso é normal se o projeto não permitir login anônimo)");
  }

  // 2. Tentar ler coleção de Usuários (Firestore)
  console.log("\n--- Inspecionando Coleção 'users' (Firestore) ---");
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    console.log(`Encontrados ${usersSnapshot.size} documentos na coleção 'users'.`);
    
    if (usersSnapshot.size > 0) {
      console.log("Lista de usuários cadastrados no Banco de Dados (não necessariamente no Auth):");
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Email: ${data.email || '(sem email)'}`);
        console.log(`  Nome: ${data.name || '(sem nome)'}`);
        console.log(`  Perfil: ${data.ownerId === doc.id ? 'Dono' : 'Membro'}`);
        console.log("  ---");
      });
    } else {
        console.log("Nenhum usuário encontrado na coleção 'users'.");
    }
  } catch (error) {
    console.error("❌ Erro ao ler coleção 'users':", error.code);
    if (error.code === 'permission-denied') {
        console.log("   Motivo: As regras de segurança do Firestore impedem leitura sem login de admin.");
    }
  }

  // 3. Tentar ler coleção de Lojas
  console.log("\n--- Inspecionando Coleção 'stores' (Firestore) ---");
  try {
    const storesSnapshot = await getDocs(collection(db, "stores"));
    console.log(`Encontrados ${storesSnapshot.size} lojas.`);
    storesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- Loja: ${data.name} (ID: ${doc.id})`);
    });
  } catch (error) {
    console.error("❌ Erro ao ler coleção 'stores':", error.code);
  }

  process.exit(0);
}

main();
