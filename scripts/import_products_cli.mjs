
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// --- Helpers de Validação e Formatação ---

const normalizeString = (str) => str ? String(str).trim().replace(/\s+/g, ' ') : '';

const formatCurrency = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : parseFloat(num.toFixed(2));
};

const parseBoolean = (val) => {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return ['sim', 'yes', 'true', '1', 'ativo'].includes(s);
};

const validateNCM = (ncm) => {
  const clean = String(ncm || '').replace(/\D/g, '');
  return clean.length === 8 ? clean : null;
};

const validateCNPJ = (cnpj) => {
  const clean = String(cnpj || '').replace(/\D/g, '');
  if (clean.length !== 14) return null;
  // Validação básica de formato
  return clean;
};

// Regras de Markup para Precificações (P2, P3, P4)
// Baseado no Modal de Produtos:
// 1: P/ CLIENTE FINAL (Base do arquivo)
// 2: CARTÃO 7X-12X
// 3: CARTÃO 13X-18X
// 4: LOJISTA À VISTA
const calculateVariations = (cost, price, baseData) => {
  const p1 = price;
  
  const variations = [
    {
      name: '1 - PREÇO P/ CLIENTE FINAL',
      salePrice: formatCurrency(p1),
      cost: formatCurrency(cost),
      stock: baseData.stock,
      stockMin: baseData.stockMin,
      active: true,
      reference: baseData.reference,
      barcode: baseData.barcode
    },
    {
      name: '2 - PREÇO CARTÃO CREDITO 7X ATÉ 12X',
      salePrice: 0,
      cost: 0,
      stock: 0,
      stockMin: 0,
      active: true,
      reference: '',
      barcode: ''
    },
    {
      name: '3 - PREÇO CARTÃO CREDITO 13X ATÉ 18X',
      salePrice: 0,
      cost: 0,
      stock: 0,
      stockMin: 0,
      active: true,
      reference: '',
      barcode: ''
    },
    {
      name: '4 - PREÇO P/LOJISTA LEVAR Á VISTA',
      salePrice: 0,
      cost: 0,
      stock: 0,
      stockMin: 0,
      active: true,
      reference: '',
      barcode: ''
    }
  ];
  return variations;
};

async function main() {
  console.log("=== Importador Avançado de Produtos via CLI ===");

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
  const storeIndex = await question("\nSelecione a loja (número): ");
  const selectedStore = stores[parseInt(storeIndex) - 1];

  if (!selectedStore) {
    console.log("❌ Loja inválida.");
    process.exit(1);
  }
  console.log(`✔ Loja: ${selectedStore.name}`);

  // 3. Ler Arquivo
  const excelPath = path.resolve(__dirname, '../src/assets/produtos.xlsx');
  console.log(`\n📂 Lendo arquivo: ${excelPath}`);
  
  let dataRows = [];
  try {
    const fs = await import('fs');
    if (!fs.existsSync(excelPath)) {
      console.error("❌ Arquivo não encontrado em src/assets/produtos.xlsx");
      process.exit(1);
    }
    const fileBuffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Validar cabeçalho ou assumir posição fixa conforme script anterior
    // Linha 0 = Headers, Dados começam na 1
    dataRows = rawData.slice(1).filter(r => r.length > 0);
    console.log(`✔ ${dataRows.length} linhas encontradas.`);
  } catch (e) {
    console.error("❌ Erro ao ler arquivo:", e.message);
    process.exit(1);
  }

  // --- Fase de Pré-Processamento (Memória) ---
  console.log("\n🔄 Iniciando pré-processamento e validação...");

  const categoryMap = new Map(); // normalizedName -> originalName
  const supplierMap = new Map(); // normalizedName -> { originalName, cnpj, email }
  const productsToImport = [];
  const errors = [];

  // Estruturas de controle de duplicidade no arquivo
  const processedCategories = new Map(); // normalized -> count
  const processedSuppliers = new Map(); // normalized -> count

  // Índices (baseado no script anterior)
  // 1: Barcode, 2: Reference, 3: Name, 4: Stock, 5: StockMin, 6: Cost, 7: Price
  // 8: Supplier, 9: Category, 10: Brand, 11: Unit, 12: NCM
  // 17: Featured, 20: Status

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowIndex = i + 2; // +2 por causa do header e index 0

    const name = normalizeString(row[3]);
    if (!name) {
      errors.push(`Linha ${rowIndex}: Nome do produto ausente.`);
      continue;
    }

    // Categoria
    const catRaw = normalizeString(row[9]);
    if (catRaw) {
      const catNorm = catRaw.toLowerCase();
      if (!categoryMap.has(catNorm)) {
        categoryMap.set(catNorm, catRaw);
      }
      processedCategories.set(catNorm, (processedCategories.get(catNorm) || 0) + 1);
    }

    // Fornecedor
    const supRaw = normalizeString(row[8]);
    const supCnpj = validateCNPJ(row[13]); // Assumindo CNPJ na col 13 se existir, ou verificar mapeamento
    // Nota: O script anterior não mapeava CNPJ explicitamente do Excel. 
    // Vou assumir que o nome é a chave principal por enquanto, ou col 8.
    
    if (supRaw) {
      const supNorm = supRaw.toLowerCase();
      if (!supplierMap.has(supNorm)) {
        supplierMap.set(supNorm, { 
          name: supRaw, 
          cnpj: supCnpj,
          email: '' // Se tiver coluna de email, mapear aqui
        });
      }
      processedSuppliers.set(supNorm, (processedSuppliers.get(supNorm) || 0) + 1);
    }

    // Produto
    productsToImport.push({
      rowIndex,
      name,
      barcode: normalizeString(row[1]),
      reference: normalizeString(row[2]), // Mapeado para 'codigo' (reference no DB)
      stock: formatCurrency(row[4]),
      stockMin: formatCurrency(row[5]),
      cost: formatCurrency(row[6]),
      price: formatCurrency(row[7]),
      supplierName: supRaw,
      categoryName: catRaw,
      brand: normalizeString(row[10]),
      unit: normalizeString(row[11]) || 'UN',
      ncm: validateNCM(row[12]),
      featured: parseBoolean(row[17]),
      active: parseBoolean(row[20]),
      catalog: parseBoolean(row[16]) // Assumindo coluna catalogo
    });
  }

  console.log(`\n📊 Resumo do Pré-processamento:`);
  console.log(`- Produtos válidos: ${productsToImport.length}`);
  console.log(`- Categorias únicas identificadas: ${categoryMap.size}`);
  console.log(`- Fornecedores únicos identificados: ${supplierMap.size}`);
  console.log(`- Erros/Ignorados: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\n⚠️ Primeiros 5 erros:");
    errors.slice(0, 5).forEach(e => console.log(e));
  }

  const confirm = await question("\nDeseja prosseguir com a importação no Banco de Dados? (s/n): ");
  if (confirm.toLowerCase() !== 's') {
    console.log("Cancelado.");
    process.exit(0);
  }

  // --- Fase de Sincronização com Firestore ---

  // 1. Categorias (Busca Existentes + Cria Novas)
  console.log("\n🔄 Sincronizando Categorias...");
  const dbCategories = new Map(); // normalized -> id
  
  // Buscar todas categorias da loja
  const catsSnap = await getDocs(query(collection(db, 'categories'), where('storeId', '==', selectedStore.id)));
  catsSnap.forEach(doc => {
    const d = doc.data();
    if (d.name) dbCategories.set(d.name.trim().toLowerCase(), doc.id);
  });

  const newCatsToCreate = [];
  for (const [norm, original] of categoryMap) {
    if (!dbCategories.has(norm)) {
      newCatsToCreate.push(original);
    }
  }

  if (newCatsToCreate.length > 0) {
    console.log(`Criando ${newCatsToCreate.length} novas categorias...`);
    let batch = writeBatch(db);
    let op = 0;
    
    for (const catName of newCatsToCreate) {
      const ref = doc(collection(db, 'categories'));
      batch.set(ref, {
        name: catName,
        storeId: selectedStore.id,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      dbCategories.set(catName.trim().toLowerCase(), ref.id);
      op++;
      
      if (op >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        op = 0;
      }
    }
    if (op > 0) await batch.commit();
    console.log("✔ Categorias criadas/sincronizadas.");
  } else {
    console.log("✔ Todas categorias já existiam.");
  }

  // 2. Fornecedores
  console.log("\n🔄 Sincronizando Fornecedores...");
  const dbSuppliers = new Map(); // normalized -> id
  
  const supsSnap = await getDocs(query(collection(db, 'suppliers'), where('storeId', '==', selectedStore.id)));
  supsSnap.forEach(doc => {
    const d = doc.data();
    if (d.name) dbSuppliers.set(d.name.trim().toLowerCase(), doc.id);
  });

  const newSupsToCreate = [];
  for (const [norm, data] of supplierMap) {
    if (!dbSuppliers.has(norm)) {
      newSupsToCreate.push(data);
    }
  }

  if (newSupsToCreate.length > 0) {
    console.log(`Criando ${newSupsToCreate.length} novos fornecedores...`);
    let batch = writeBatch(db);
    let op = 0;

    for (const supData of newSupsToCreate) {
      const ref = doc(collection(db, 'suppliers'));
      batch.set(ref, {
        name: supData.name,
        cnpj: supData.cnpj || '',
        email: supData.email || '',
        storeId: selectedStore.id,
        active: true,
        isCompany: !!supData.cnpj,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      dbSuppliers.set(supData.name.trim().toLowerCase(), ref.id);
      op++;

      if (op >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        op = 0;
      }
    }
    if (op > 0) await batch.commit();
    console.log("✔ Fornecedores criados/sincronizados.");
  } else {
    console.log("✔ Todos fornecedores já existiam.");
  }

  // 3. Produtos
  console.log("\n🚀 Importando Produtos...");
  let batch = writeBatch(db);
  let count = 0;
  let successCount = 0;

  for (const p of productsToImport) {
    const catId = p.categoryName ? dbCategories.get(p.categoryName.trim().toLowerCase()) : null;
    const supId = p.supplierName ? dbSuppliers.get(p.supplierName.trim().toLowerCase()) : null;

    // Calcular variações de preço
    const variationsData = calculateVariations(p.cost, p.price, {
      stock: p.stock,
      stockMin: p.stockMin,
      reference: p.reference,
      barcode: p.barcode
    });

    const ref = doc(collection(db, 'products'));
    
    const productData = {
      storeId: selectedStore.id,
      name: p.name,
      active: p.active,
      categoryId: catId,
      supplier: p.supplierName || '', // Mantendo nome redundante para compatibilidade legada
      supplierId: supId, // Novo campo de vínculo
      
      // Dados principais (Variável 1 assume o topo)
      cost: p.cost,
      salePrice: p.price,
      priceMin: p.price, // Default
      priceMax: p.price, // Default
      
      barcode: p.barcode,
      reference: p.reference, // Campo 'codigo'
      
      stock: p.stock,
      stockInitial: p.stock,
      stockMin: p.stockMin,
      controlStock: true,
      
      featured: p.featured,
      showInCatalog: p.catalog,
      unit: p.unit,
      brand: p.brand,
      ncm: p.ncm,
      
      variationsData: variationsData,
      variations: variationsData.length,
      
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      rootId: crypto.randomUUID()
    };

    batch.set(ref, productData);
    count++;
    successCount++;

    if (count >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
      process.stdout.write(`\rProcessados: ${successCount}...`);
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`\n\n✅ Importação Finalizada!`);
  console.log(`Total de Produtos: ${successCount}`);
  console.log(`Categorias: ${dbCategories.size} (Total na loja)`);
  console.log(`Fornecedores: ${dbSuppliers.size} (Total na loja)`);

  rl.close();
  setTimeout(() => process.exit(0), 1000);
}

main().catch(e => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
