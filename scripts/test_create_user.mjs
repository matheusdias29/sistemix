
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Configuração do Firebase (Sixtemix)
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
// Tenta conectar no banco de dados específico "sistemix"
const db = getFirestore(app, "sistemix");
const auth = getAuth(app);

async function createTestUser() {
  console.log("=== Teste de Criação de Usuário (Firestore) ===");
  
  // 1. Autenticação (Necessária para a maioria das regras de segurança)
  try {
    console.log("Tentando autenticação anônima...");
    await signInAnonymously(auth);
    console.log("✅ Autenticado como Anônimo:", auth.currentUser.uid);
  } catch (error) {
    console.error("❌ Falha na autenticação:", error.code, error.message);
    if (error.code === 'auth/admin-restricted-operation') {
      console.log("\n⚠️ AÇÃO NECESSÁRIA: O login Anônimo está DESATIVADO no painel do Firebase.");
      console.log("   Vá em Authentication -> Sign-in method -> Anonymous -> Ativar.");
      process.exit(1); // Sai pois não conseguirá escrever sem auth (provavelmente)
    }
    // Tenta continuar mesmo sem auth, caso as regras permitam escrita pública (inseguro, mas possível para teste)
  }

  // 2. Tentar Criar Usuário
  const testUser = {
    name: "Usuário Teste Script",
    email: `teste_${Date.now()}@exemplo.com`,
    role: "test_user",
    createdAt: serverTimestamp(),
    active: true,
    origin: "script_teste"
  };

  console.log("\nTentando criar documento na coleção 'users'...");
  try {
    const docRef = await addDoc(collection(db, "users"), testUser);
    console.log("✅ SUCESSO! Usuário criado com ID:", docRef.id);
    console.log("O banco de dados está respondendo corretamente a gravações.");
  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error.code, error.message);
    if (error.code === 'permission-denied') {
      console.log("   Motivo: Permissão negada. Provavelmente você não está autenticado ou as regras de segurança bloqueiam.");
    } else if (error.code === 'unavailable') {
      console.log("   Motivo: Serviço indisponível. Verifique sua conexão ou se o Firestore está ativo.");
    }
  }

  process.exit(0);
}

createTestUser();
