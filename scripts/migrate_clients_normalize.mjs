import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDm61fcXbemFSUIiTEATy47SBD5PvsCpaI",
  authDomain: "sixtemix.firebaseapp.com",
  projectId: "sixtemix",
  storageBucket: "sixtemix.firebasestorage.app",
  messagingSenderId: "322849102175",
  appId: "1:322849102175:web:a3aef88707c94ff257beea",
  measurementId: "G-W3XDS34DZ8"
};

function normalize(val) {
  return String(val || '').trim().toLowerCase()
}
function digits(val) {
  return String(val || '').replace(/\D/g, '')
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const dbId = process.env.FIRESTORE_DB_ID || 'sistemix';
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, dbId);
  console.log(`Usando Firestore databaseId: ${dbId}`);

  const snap = await getDocs(collection(db, 'clients'));
  console.log(`Clientes encontrados: ${snap.size}`);
  let processed = 0;
  let batch = writeBatch(db);
  let count = 0;

  for (const d of snap.docs) {
    const c = d.data();
    const ref = doc(db, 'clients', d.id);
    const normalized = {
      nameLower: normalize(c.name),
      codeLower: normalize(c.code),
      phoneDigits: digits(c.phone),
      whatsappDigits: digits(c.whatsapp),
      cpfDigits: digits(c.cpf),
      cnpjDigits: digits(c.cnpj),
    };
    batch.update(ref, normalized);
    count++;
    processed++;
    if (count >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
      console.log(`Normalizados: ${processed}`);
    }
  }
  if (count > 0) {
    await batch.commit();
  }
  console.log(`Concluído. Total normalizados: ${processed}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
