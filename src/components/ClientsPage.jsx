import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getClientsByPage, searchClientsByPage, getTotalClientsCount, getTotalActiveClientsCount, removeClient, getAllClients, getActiveClients } from '../services/clients'
import { getClientOrderHistory } from '../services/orders'
import NewClientModal from './NewClientModal'
import ClientsFilterModal from './ClientsFilterModal'

// ===========================================================================
// CONFIGURAÇÃO CENTRAL DE CACHE PERSISTENTE
// ===========================================================================
// --- CONFIG CENTRAL DO SMART CACHE PERSISTENTE ---
// Para VOLTAR ao comportamento original (cache só em memória, sem disco):
// 1. Mude a linha abaixo para: false
// 2. Salve o arquivo. Fim! Nenhuma outra alteração é necessária.
const PERSISTENT_CACHE_ENABLED = true

// Versão de schema do cache: altere este número para 3, 4, etc. SEMPRE que mudar
// a estrutura de dados dos clientes (ex: novo campo, mudança no tipo). Todo cache
// com VERSÃO DIFERENTE é APAGADO imediatamente, sem validação.
// Atual p/ 2: corrige bug "82/22k clientes" (orderBy __name__, requer totalCount salvo)
// Atual p/ 3: Estratégia "só ativos no cache inicial". Novo campo includesInactive.
const CACHE_SCHEMA_VERSION = 3

// Tempo que o cache salvo no disco é considerado "fresco" antes de recarregar
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora

// Tamanho máximo para usar localStorage; acima disso, tenta IndexedDB
const LOCALSTORAGE_MAX_BYTES = 4 * 1024 * 1024 // 4 MB

// Prefixo único da chave por (USUÁRIO + loja) — evita cache compartilhado entre contas
// Importante: usuário A NÃO PODE ver o cache do usuário B, mesmo na mesma loja (permissões diferentes, segurança).
const cacheKey = (storeId, userId) => `sistemix:clients:u${String(userId || 'anon')}:s${String(storeId || 'default')}`

// Helper GLOBAL para limpar TODO o cache de clientes de um usuário (usado no logout / troca de conta)
// Basta importar { clearAllClientsCacheForUser } de './ClientsPage.jsx' onde tiver o botão Sair
const CLIENT_CACHE_KEY_REGEX = /^sistemix:clients:u([^:]+):s(.+)$/
export const clearAllClientsCacheForUser = async (userId) => {
  const uid = String(userId || 'anon')
  // 1. Limpa localStorage
  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k.startsWith(`sistemix:clients:u${uid}:`)) keysToRemove.push(k)
      // Chaves antigas (sem userId) — limpeza migração: remove tudo
      if (k.startsWith('sistemix:clients:') && !k.includes(':u')) keysToRemove.push(k)
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } catch {}
  // 2. Limpa IndexedDB (pode haver entradas grandes lá)
  try {
    if (typeof indexedDB !== 'undefined') {
      const req = indexedDB.open('sistemix_cache', 1)
      req.onupgradeneeded = () => { try { req.result.createObjectStore('kv') } catch {} }
      req.onsuccess = () => {
        const db = req.result
        try {
          const tx = db.transaction('kv', 'readwrite')
          const store = tx.objectStore('kv')
          const cursorReq = store.openCursor()
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result
            if (!cursor) return
            const k = String(cursor.key || '')
            const matchOld = k.startsWith('sistemix:clients:') && !k.includes(':u')
            const matchUid = k.startsWith(`sistemix:clients:u${uid}:`)
            if (matchOld || matchUid) cursor.delete()
            cursor.continue()
          }
        } catch {}
      }
    }
  } catch {}
  console.log(`[Clientes] Cache de clientes limpo para usuário ${uid} (logout / troca de conta).`)
  return true
}

// Helper: remove 1 única chave de cache (storeId + userId) — usado ao trocar de loja
const clearOneClientsCache = async (storeId, userId) => {
  const k = cacheKey(storeId, userId)
  try { localStorage.removeItem(k) } catch {}
  try {
    if (typeof indexedDB !== 'undefined') {
      const db = await openIDB()
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('kv', 'readwrite')
          const req = tx.objectStore('kv').delete(k)
          tx.oncomplete = () => resolve(true)
          req.onerror = () => resolve(false)
        } catch { resolve(false) }
      })
    }
  } catch { return false }
}

// ---- Wrapper de Storage (localStorage → IndexedDB fallback, auto) ----
// IndexedDB super-simples inline (NÃO PRECISA INSTALAR NENHUMA LIB)
let __idbPromise = null
const openIDB = () => {
  if (__idbPromise) return __idbPromise
  __idbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('sistemix_cache', 1)
      req.onupgradeneeded = () => {
        try { req.result.createObjectStore('kv') } catch {}
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    } catch (e) { reject(e) }
  })
  return __idbPromise
}
const idbGet = async (key) => {
  try {
    const db = await openIDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly')
      const req = tx.objectStore('kv').get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch { return null }
}
const idbSet = async (key, value) => {
  try {
    const db = await openIDB()
    return new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite')
      tx.objectStore('kv').put(value, key)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch { return false }
}
const storageSet = async (k, value) => {
  try {
    const json = JSON.stringify(value)
    if (json.length < LOCALSTORAGE_MAX_BYTES / 2) {
      localStorage.setItem(k, json)
      return true
    }
  } catch {}
  return idbSet(k, value)
}
const storageGet = async (k) => {
  try {
    const raw = localStorage.getItem(k)
    if (raw) return JSON.parse(raw)
  } catch {}
  return idbGet(k)
}

export default function ClientsPage({ storeId, addNewSignal, user }){
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}

  if (!isOwner && !perms.clients?.view && !perms.clients?.create && !perms.clients?.edit && !perms.clients?.delete) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p>Você não tem permissão para visualizar clientes.</p>
        </div>
    )
  }

  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  
  // Smart Cache
  const [cachedClients, setCachedClients] = useState(null)
  const [isCaching, setIsCaching] = useState(false)

  // Cache Persistente UI state
  const [cacheLoadedFromDisk, setCacheLoadedFromDisk] = useState(false)
  const [cacheSyncing, setCacheSyncing] = useState(false)
  const [cacheLastUpdate, setCacheLastUpdate] = useState(null) // Date | null
  const [cacheForceMissNonce, setCacheForceMissNonce] = useState(0) // +1 = invalida tudo
  const [cacheIncludesInactive, setCacheIncludesInactive] = useState(false) // true = cache tem inativos (todos baixados); false = SÓ ATIVOS (estratégia padrão, economia)

  // (Sem cache global; carregamento ocorre somente dentro da página)
  
  // Paginação
  const PAGE_SIZE = 30
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [totalResults, setTotalResults] = useState(0)
  
  // Menu e Ações
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [confirmRemoveClient, setConfirmRemoveClient] = useState(null)
  const [savingAction, setSavingAction] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyClient, setHistoryClient] = useState(null)
  const [historyItems, setHistoryItems] = useState([])
  
  // Filtros
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState({}) // { status: 'active'|'inactive', credit: 'allowed'|'denied', birthday: boolean }

  const initialAddSignal = useRef(addNewSignal)
  const uid = user?.id || user?.uid || user?.memberId || 'anon'
  const prevContextRef = useRef(null) // { storeId, uid } — contexto anterior para invalidar cache

  // Refs para evitar que useEffect de on-demand (baixar inativos) dispare
  // PREMATURAMENTE (antes de ler o disco / terminar boot).
  // Bug que estava acontecendo:
  //   - filters.status inicial = 'active' (padrao) OU ja vem 'inactive'/'' do
  //     estado salvo de sessao anterior.
  //   - cacheIncludesInactive inicial = false (padrao) / cachedClients = null
  //   - useEffect on-demand RODA ANTES do boot ler o disco e setar os valores.
  //   - Resultado: baixava TUDO (incluindo inativos) VOLTANDO DE OUTRA PAGINA,
  //     mostrava chip "Sincronizando" sem usuario ter clicado em NADA.
  const prevFilterStatusRef = useRef(null) // null = ainda nao temos valor valido apos boot
  const bootFinishedRef = useRef(false) // true = boot principal (B) terminou (hit ou miss)

  // ============================================================
  // HELPER: SALVA CACHE ATUALIZADO NO DISCO (IMEDIATAMENTE APÓS CRUD)
  // Responde a pergunta do usuário: "ao fazer alteração envia automaticamente p/ banco? SIM,
  // Firestore SIM sempre. E AGORA o cache persistente no DISCO também é atualizado na hora,
  // para não perder a alteração ao recarregar a página antes do background sync (1h/10min)."
  // ============================================================
  const persistCacheToDisk = (newData, includesInactiveNow) => {
    if (!PERSISTENT_CACHE_ENABLED) return
    if (!Array.isArray(newData)) return
    try {
      const k = cacheKey(storeId, uid)
      const entry = {
        schemaVersion: CACHE_SCHEMA_VERSION,
        data: newData,
        savedAt: Date.now(),
        totalCount: newData.length,
        includesInactive: includesInactiveNow === true,
      }
      // Fire and forget: não await (não bloqueia a UI). Disco salva em ~1ms.
      storageSet(k, entry).then(() => {
        setCacheLastUpdate(new Date())
      })
    } catch {}
  }

  // ============================================================
  // INVALIDAÇÃO AUTOMÁTICA DE CACHE AO TROCAR CONTA / LOJA
  // ============================================================
  // Observa quando user.id OU storeId mudar (ex: saiu da conta e entrou em outra,
  // ou trocou de loja no seletor) e:
  //  - reseta TODOS os estados de cache na tela (cachedClients, totalResults...)
  //  - apaga do localStorage/indexedDB o cache do CONTEXTO ANTERIOR
  //  - o próximo useEffect de boot() vai carregar tudo NOVAMENTE do zero
  useEffect(() => {
    if (!PERSISTENT_CACHE_ENABLED) return
    const currentCtx = { storeId: String(storeId || ''), uid: String(uid || '') }
    const prev = prevContextRef.current
    prevContextRef.current = currentCtx

    // Primeira renderização — não limpa nada
    if (!prev) return

    // Troca de usuário OU troca de loja → limpa estado + cache do contexto anterior
    if (prev.uid !== currentCtx.uid || prev.storeId !== currentCtx.storeId) {
      console.log(`[Clientes] Contexto alterado ${prev.uid}@${prev.storeId} → ${currentCtx.uid}@${currentCtx.storeId}. Invalidando cache.`)
      // Reseta estado em memória imediatamente (evita mostrar dados antigos na tela)
      setCachedClients(null)
      setClients([])
      setTotalResults(0)
      setCacheLoadedFromDisk(false)
      setCacheSyncing(false)
      setCacheLastUpdate(null)
      setCacheIncludesInactive(false) // Ao trocar contexto, SÓ ATIVOS no primeiro boot
      setPage(1)
      setLoading(false)
      // Reseta refs de proteção on-demand para o NOVO contexto (nova loja/usuario)
      bootFinishedRef.current = false
      prevFilterStatusRef.current = null
      // Limpa armazenamento em disco do contexto ANTERIOR (async, não trava UI)
      clearOneClientsCache(prev.storeId, prev.uid).catch(() => {})
    }
  }, [storeId, uid])

  const handleClearAllPersistentCache = async () => {
    try {
      await clearOneClientsCache(storeId, uid)
      console.log('[Clientes] Botão: cache apagado manualmente.')
      // Reseta estado em memória
      setCachedClients(null)
      setClients([])
      setTotalResults(0)
      setCacheLoadedFromDisk(false)
      setCacheLastUpdate(null)
      setPage(1)
    } catch (e) {
      console.error('[Clientes] Erro ao apagar cache manualmente:', e)
    }
    // Incrementa nonce: força o useEffect boot a rodar MESMO que storeId/uid sejam iguais
    setCacheForceMissNonce(n => n + 1)
  }

  const handleForceRefresh = () => {
    const includeInactive = cacheIncludesInactive === true
    refreshCacheFromServer(false, null, includeInactive).catch(() => {})
  }

  // includeInactive:
  //   false (padrão) => baixa SÓ CLIENTES ATIVOS via getActiveClients() — economia de leitura.
  //   true => baixa TODOS os clientes (incluindo inativos) via getAllClients() — só se o usuário
  //           explicitamente clicar em Filtros e pedir status=inactive/todos.
  const refreshCacheFromServer = async (silent = true, knownTotal = null, includeInactive = false) => {
    try {
      if (!silent) setCacheSyncing(true)
      setIsCaching(true)
      setCacheIncludesInactive(!!includeInactive)
      // Se ainda não sabemos o total real, busca 1 vez ANTES de baixar tudo
      // (usado para validação de integridade do cache depois)
      let totalCountServer = knownTotal
      if (typeof totalCountServer !== 'number') {
        try {
          totalCountServer = includeInactive
            ? await getTotalClientsCount(storeId)
            : await getTotalActiveClientsCount(storeId)
        } catch { totalCountServer = null }
      }

      const all = includeInactive
        ? await getAllClients(storeId)
        : await getActiveClients(storeId)

      const savedAt = Date.now()
      const downloaded = all.length

      // 1) Validação de INTEGRIDADE: se sabemos o total real do servidor
      //    e veio MENOS que o esperado → NÃO SALVAMOS cache incompleto (evita bug 81 vs 22k!)
      if (typeof totalCountServer === 'number' && downloaded < totalCountServer * 0.995) {
        const pct = Math.round((downloaded / totalCountServer) * 100)
        console.warn(`[Clientes] Cache incompleto! includeInactive=${includeInactive} Downloaded=${downloaded} vs ServerTotal=${totalCountServer} (${pct}%). Tentando 2x...`)
        const all2 = includeInactive ? await getAllClients(storeId) : await getActiveClients(storeId)
        if (all2.length >= downloaded && all2.length >= totalCountServer * 0.995) {
          const cacheEntry = { schemaVersion: CACHE_SCHEMA_VERSION, includesInactive: !!includeInactive, data: all2, savedAt, totalCount: totalCountServer }
          await storageSet(cacheKey(storeId, uid), cacheEntry)
          setCachedClients(all2)
          setTotalResults(all2.length)
          setCacheLastUpdate(new Date(savedAt))
          console.log(`[Clientes] 2ª tentativa OK: ${all2.length} (includesInactive=${includeInactive}). Salvando cache schema=${CACHE_SCHEMA_VERSION}.`)
        } else {
          setCachedClients(all2.length > downloaded ? all2 : all)
          setTotalResults((all2.length > downloaded ? all2.length : downloaded))
          setCacheLastUpdate(new Date(savedAt))
          console.warn(`[Clientes] Mesmo na 2ª tentativa ficou incompleto (${all2.length > downloaded ? all2.length : downloaded}). Mostrando em memória, SEM salvar em disco.`)
        }
        return
      }

      // 2) Cache íntegro → salva normalmente
      const cacheEntry = {
        schemaVersion: CACHE_SCHEMA_VERSION,
        includesInactive: !!includeInactive,
        data: all,
        savedAt,
        totalCount: typeof totalCountServer === 'number' ? totalCountServer : downloaded
      }
      await storageSet(cacheKey(storeId, uid), cacheEntry)
      setCachedClients(all)
      setTotalResults(all.length)
      setCacheLastUpdate(new Date(savedAt))
      if (typeof totalCountServer === 'number') {
        console.log(`[Clientes] Cache salvo OK: ${downloaded}/${totalCountServer} (schema=${CACHE_SCHEMA_VERSION}, includesInactive=${includeInactive}).`)
      } else {
        console.log(`[Clientes] Cache salvo OK: ${downloaded} (schema=${CACHE_SCHEMA_VERSION}, includesInactive=${includeInactive}).`)
      }
    } catch (err) {
      console.error('Erro ao recarregar cache do servidor:', err)
    } finally {
      setIsCaching(false)
      setCacheSyncing(false)
    }
  }

  // Carrega contagem total inicial e inicia Cache Inteligente
  // ESTRATÉGIA (NOVO, schema 3):
  //  - BOOT INICIAL: baixa SÓ CLIENTES ATIVOS (getActiveClients, includeInactive=false)
  //     economia TOTAL de reads em clientes inativos (que quase ninguém usa)
  //  - SÓ BAIXA INATIVOS: se o usuário EXPLICITAMENTE abrir Filtros e selecionar
  //     status="inactive" ou status="" (todos). (controlado por OUTRO useEffect)
  // BOOT PRINCIPAL do Smart Cache: LER DISCO PRIMEIRO (0ms), servidor PARALELO (background)
  //
  // CORREÇÃO CRÍTICA: ClientsPage é DESMONTADO ao navegar p/ outra página (Produtos/Vendas)
  // e REMONTADO ao voltar. cachedClients = null no remontar.
  // ANTES: Ordem = 1) AWAIT getTotalActiveClientsCount (servidor 200-500ms)
  //                  2) storageGet (disco 0ms)
  //        Resultado: ao voltar da página, usuário via "Carregando..." por ~300ms
  //                   até ler o disco.
  // AGORA: Ordem = 1) storageGet (disco 0ms) → EXIBE NA TELA IMEDIATAMENTE
  //                2) Servidor consulta em PARALELO → atualiza no background se precisar.
  //        Resultado: UI INSTANTÂNEA ao voltar (não carrega de novo, lê do disco!).
  useEffect(() => {
    if (!storeId) return
    let cancelled = false

    if (!PERSISTENT_CACHE_ENABLED) {
      // --- COMPORTAMENTO ORIGINAL (cache só em memória) ---
      // Default: só ativos (economia). Se filtro pedir inativo/todos, o outro useEffect baixa.
      getTotalActiveClientsCount(storeId).then(count => {
        if (cancelled) return
        if (!query.trim() && !cachedClients) setTotalResults(count)
      }).catch(console.error)

      if (!cachedClients && !isCaching) {
        setIsCaching(true)
        setCacheIncludesInactive(false)
        console.log('[Clientes] Smart Cache (memória) iniciando SÓ ATIVOS...')
        getActiveClients(storeId).then(all => {
          if (cancelled) return
          console.log(`[Clientes] Smart Cache memória OK (SÓ ATIVOS): ${all.length} clientes.`)
          setCachedClients(all)
          setTotalResults(all.length)
          setIsCaching(false)
          setCacheLastUpdate(new Date())
        }).catch(err => {
          console.error('Erro no Smart Cache clientes ativos:', err)
          if (!cancelled) setIsCaching(false)
        })
      }
      return
    }

    // --- NOVO COMPORTAMENTO (CACHE PERSISTENTE) ---
    const boot = async () => {
      if (cachedClients || isCaching) return

      // ============================================================
      // 0) LER DISCO PRIMEIRO (0ms!) — ANTES DE TUDO, ATÉ ANTES DO
      //    isCaching=true!
      //
      //    ESTRATÉGIA ECONOMIA TOTAL (solicitação do usuário):
      //    SE cache VÁLIDO (schema certo + array dados), EXIBE NA TELA
      //    AGORA E NÃO FAZ NENHUMA CHAMADA AO FIRESTORE NESSE BOOT.
      //
      //    SÓ CHAMAMOS O SERVIDOR EM 4 CASOS EXPLÍCITOS:
      //      a) Cache vazio / schema diferente (MISS do zero)
      //      b) Cache tem MAIS DE 1 HORA (TTL) → baixa tudo
      //      c) Cache tem ENTRE 10min e 1h → 1 getCountFromServer leve
      //         (0 reads cobrados, só 1 req HTTP) só para VER se mudou
      //         contagem > 1%; se não mudou, 0 downloads.
      //      d) Usuário clicou no botão 🔄 Atualizar (force miss).
      // ============================================================
      const key = cacheKey(storeId, uid)
      let hit = null
      try { hit = await storageGet(key) } catch (e) { hit = null; console.warn('[Clientes] storageGet falhou:', e) }

      const now = Date.now()
      const ageMs = hit ? (now - Number(hit?.savedAt || 0)) : Infinity
      const dataLen = Array.isArray(hit?.data) ? hit.data.length : 0
      const hasSchemaVersion = typeof hit?.schemaVersion === 'number'
      const schemaValid = hasSchemaVersion && hit.schemaVersion === CACHE_SCHEMA_VERSION
      const hitIncludesInactive = hit?.includesInactive === true
      const discoTemDadosValidos = (hit && Array.isArray(hit.data) && schemaValid)

      // ====================================================================
      // CASO 1: DISCO VÁLIDO (schema bate). Exibe NA HORA e decide servidor.
      // ====================================================================
      if (discoTemDadosValidos) {
        const ageMin = Math.round(ageMs / 60000)
        const fresh10m = ageMs < 10 * 60 * 1000   // <10min: ZERO chamadas!
        const expired1h = ageMs >= CACHE_TTL_MS    // >=1h: TTL → baixa tudo

        // ✅ EXIBE NA TELA AGORA (0ms). NÃO SETA isCaching=true →
        //    "Carregando..." NUNCA APARECE nesse fluxo!
        console.log(`[Clientes] ✅ DISCO VÁLIDO: ${dataLen} clientes, salvo há ${ageMin}min (schema=${hit.schemaVersion}, includesInactive=${hitIncludesInactive}). Exibindo NA HORA.`)
        if (!cancelled) {
          setCachedClients(hit.data)
          setTotalResults(dataLen)
          setCacheLastUpdate(new Date(Number(hit.savedAt)))
          setCacheLoadedFromDisk(true)
          setCacheIncludesInactive(!!hitIncludesInactive)
          setIsCaching(false)
        }
        // Boot (B) CASO 1 concluído: marca como finalizado + memoriza status atual do filtro.
        bootFinishedRef.current = true
        prevFilterStatusRef.current = (filters && 'status' in filters) ? String(filters.status) : '__unset__'

        // Força miss = botão 🔄 Atualizar clicado. SEMPRE baixa do zero.
        if (cacheForceMissNonce > 0) {
          console.log(`[Clientes] Forçando refresh via botão (nonce=${cacheForceMissNonce}). Apagando cache...`)
          try { await clearOneClientsCache(storeId, uid) } catch {}
          setCachedClients(null)
          setIsCaching(true)
          setCacheSyncing(true)
          setCacheLoadedFromDisk(false)
          setCacheIncludesInactive(false)
          const totalServer = await getTotalActiveClientsCount(storeId).catch(() => null)
          await refreshCacheFromServer(true, totalServer, false)
          return
        }

        // ECONOMIA TOTAL: < 10 min → NENHUMA chamada ao Firestore!
        if (fresh10m) {
          console.log(`[Clientes] ⏱️ Cache tem ${ageMin}min (<10min). NENHUMA CHAMADA AO FIRESTORE (economia total!)`)
          return
        }

        // ============================================================
        // Chegamos aqui: >= 10 min (entre 10 e 60, ou >= 60)
        // ============================================================
        if (expired1h) {
          console.log(`[Clientes] ⏰ Cache TEM MAIS DE 1 HORA (TTL expirado). Baixando do servidor para garantir integridade...`)
          setCacheSyncing(true)
          setIsCaching(true)
          let totalServer = null
          try {
            totalServer = hitIncludesInactive
              ? await getTotalClientsCount(storeId)
              : await getTotalActiveClientsCount(storeId)
          } catch {}
          await refreshCacheFromServer(true, totalServer, hitIncludesInactive)
          return
        }

        // Entre 10 e 60 minutos: 1 chamada leve getCount (verifica mudou >1%)
        setCacheSyncing(true)
        let totalServer = null
        try {
          totalServer = hitIncludesInactive
            ? await getTotalClientsCount(storeId)
            : await getTotalActiveClientsCount(storeId)
          console.log(`[Clientes] Checagem 10min: servidor=${totalServer}, disco=${dataLen}.`)
        } catch (e) {
          console.warn('[Clientes] Erro pegando contagem do servidor 10min:', e)
          setCacheSyncing(false)
          return
        }

        const serverChanged = typeof totalServer === 'number' && Math.abs(totalServer - dataLen) > Math.max(3, dataLen * 0.01)
        if (serverChanged) {
          console.log(`[Clientes] ⚠️ Contagem mudou > 1%. Atualizando cache em background...`)
          setIsCaching(true)
          await refreshCacheFromServer(true, totalServer, hitIncludesInactive)
        } else {
          console.log(`[Clientes] ✔️ Contagem igual no servidor. Tudo atualizado, sem download!`)
          setCacheSyncing(false)
        }
        return
      }

      // CASO 2: MISS (sem cache / corrompido / schema diferente)
      //         AQUI SIM setamos isCaching=true e baixamos do servidor.
      // ====================================================================
      setIsCaching(true)
      setCacheLoadedFromDisk(false)
      setCacheIncludesInactive(false)
      const reasonMiss = !hit ? 'cache vazio / nunca carregou antes' :
                         (!Array.isArray(hit.data)) ? 'data não é array (corrompido)' :
                         `schema INVALIDO (esperado=${CACHE_SCHEMA_VERSION}, atual=${hasSchemaVersion ? hit.schemaVersion : 'ausente'})`
      console.log(`[Clientes] MISS: ${reasonMiss}. Baixando SÓ ATIVOS do servidor (economia default)...`)
      if (hit) { try { await clearOneClientsCache(storeId, uid) } catch {} }
      setCacheSyncing(true)
      let totalServer = null
      try { totalServer = await getTotalActiveClientsCount(storeId) } catch {}
      await refreshCacheFromServer(true, totalServer, false)
      // Boot (B) CASO 2 concluído: marca como finalizado + memoriza status do filtro.
      bootFinishedRef.current = true
      prevFilterStatusRef.current = (filters && 'status' in filters) ? String(filters.status) : '__unset__'
    }
    boot().catch(err => console.error('[Clientes] BOOT falhou:', err)).finally(() => {
      if (!cancelled) { setIsCaching(false); setCacheSyncing(false) }
    })

    return () => { cancelled = true }
  }, [storeId, uid, cacheForceMissNonce])

  // ==========================================================================
  // ESTRATÉGIA SMART DE DOWNLOAD DE INATIVOS (ON-DEMAND):
  // Monitora filters.status. POR PADRÃO, o cache baixa SÓ ATIVOS (includesInactive=false).
  //
  // REGRAS ESTRITAS (para NÃO baixar inativos sem o usuário realmente pedir):
  //   1) BOOT PRINCIPAL (B) deve ter TERMINADO (bootFinishedRef.current === true).
  //      → NÃO roda antes de ler o disco / antes da tela aparecer. (BUG FIX!)
  //   2) O status do filtro DEVE ter MUDADO de (ativo) → (inativo/todos) APÓS O BOOT.
  //      → Não dispara se filters.status já veio "inativo"/"" de sessão anterior/salvo.
  //   3) E cacheIncludesInactive ainda é false (ainda não baixamos tudo).
  //
  // SÓ QUANDO TODAS AS 3 CONDIÇÕES ACONTECEM, dispara download COMPLETO
  // (getAllClients) agora, salva no cache com includesInactive=true.
  // Isso evita baixar milhares de inativos que o usuário quase nunca consulta.
  // ==========================================================================
  useEffect(() => {
    if (!storeId) return

    // 1) ESPERA O BOOT PRINCIPAL TERMINAR (ler disco OU miss com download concluído)
    if (!bootFinishedRef.current) return

    const statusFilter = filters?.status
    const normalizedStatus = ('status' in (filters || {})) ? String(statusFilter ?? '') : '__unset__'
    const prevStatus = prevFilterStatusRef.current

    // 2) SÓ DISPARA SE STATUS MUDOU DEPOIS DO BOOT (nao usa o valor inicial default!)
    if (prevStatus === null || prevStatus === normalizedStatus) {
      prevFilterStatusRef.current = normalizedStatus
      return
    }
    prevFilterStatusRef.current = normalizedStatus

    const wantsAll = statusFilter === '' || statusFilter == null
    const wantsInactive = statusFilter === 'inactive'
    const needsInactiveData = wantsAll || wantsInactive
    if (!needsInactiveData) return

    if (cacheIncludesInactive === true) {
      // Cache JÁ tem inativos (tudo baixado). Nada a fazer, filtro local cuida do resto.
      return
    }

    if (isCaching || cacheSyncing) return // não roda duplo

    // Usuário MUDOU o filtro DEPOIS do boot para status que pede inativos.
    console.log(`[Clientes] ⚙️ Usuário MUDOU filtro status='${statusFilter}'. Cache SÓ tem ativos (${cachedClients?.length ?? 0}). Baixando TODOS (incluindo inativos)...`)
    // Setamos flag includesInactive=true ANTES para não disparar 2x
    setCacheIncludesInactive(true)
    const run = async () => {
      setCacheSyncing(true)
      setIsCaching(true)
      let totalCountServer = null
      try { totalCountServer = await getTotalClientsCount(storeId) } catch {}
      await refreshCacheFromServer(true, totalCountServer, true)
      console.log(`[Clientes] Concluído on-demand: agora cache tem todos os clientes (includesInactive=true).`)
      setCacheSyncing(false)
      setIsCaching(false)
    }
    run().catch(err => { console.error('Erro ao baixar inativos on-demand:', err); setCacheSyncing(false); setIsCaching(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.status, isCaching, cacheSyncing])

  // Lógica principal de exibição (Híbrida: Servidor ou Cache Local)
  useEffect(() => {
    let isMounted = true

    const load = async () => {
      // Se já temos cache, usamos ele (Instantâneo!)
      if (cachedClients) {
          // Filtra localmente
          let result = cachedClients
          
          if (query.trim()) {
              const lower = query.trim().toLowerCase()
              result = result.filter(c => 
                  (c.nameLower && c.nameLower.includes(lower)) ||
                  (c.phoneDigits && c.phoneDigits.includes(lower)) ||
                  (c.whatsappDigits && c.whatsappDigits.includes(lower)) ||
                  (c.cpfDigits && c.cpfDigits.includes(lower)) ||
                  (String(c.code || '').toLowerCase().includes(lower)) ||
                  (c.name && c.name.toLowerCase().includes(lower)) // fallback
              )
          }

          // ORDENAÇÃO LOCAL OBRIGATÓRIA (nameLower ASC)
          // Isso garante que o cache exiba na ordem correta, independente de como veio do servidor
          result.sort((a, b) => {
              const na = a.nameLower || a.name?.toLowerCase() || ''
              const nb = b.nameLower || b.name?.toLowerCase() || ''
              if (na < nb) return -1
              if (na > nb) return 1
              return 0
          })

          // Atualiza total
          if (isMounted) setTotalResults(result.length)

          // Pagina localmente
          const start = (page - 1) * PAGE_SIZE
          const end = start + PAGE_SIZE
          const pageData = result.slice(start, end)
          
          if (isMounted) {
              setClients(pageData)
              setLoading(false)
          }
          return
      }

      // Se não temos cache, vai no servidor (Legado/Fallback enquanto carrega)
      // Mantém loading true para evitar "Nenhum cliente encontrado"
      setLoading(true)
      try {
        if (query.trim()) {
           const { clients: newClients, total } = await searchClientsByPage(storeId, query, page, PAGE_SIZE)
           if(isMounted) {
             setClients(newClients)
             setTotalResults(total)
           }
        } else {
           // Modo Paginação Normal
           const newClients = await getClientsByPage(storeId, page, PAGE_SIZE)
           
           if(isMounted) {
             setClients(newClients)
             // Atualiza total apenas se for página 1
             if (page === 1) {
                getTotalClientsCount(storeId).then(c => isMounted && setTotalResults(c))
             }
           }
        }
      } catch (err) {
        console.error(err)
      } finally {
        if(isMounted) setLoading(false)
      }
    }

    // Debounce apenas se for busca no servidor (sem cache)
    // Com cache é instantâneo, mas um pequeno debounce de 50ms evita travamento na digitação se tiver 50k items
    const delay = (cachedClients) ? 50 : (query.trim() ? 300 : 0)

    const timeoutId = setTimeout(() => {
        load()
    }, delay)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [storeId, page, query, cachedClients]) // Re-roda quando cachedClients mudar

  // Reset paginação ao mudar query
  useEffect(() => {
     setPage(1)
  }, [storeId, query])

  // Abre modal de novo cliente somente quando o sinal mudar (ignora montagem inicial)
  useEffect(() => {
    if (addNewSignal !== initialAddSignal.current) {
      setModalOpen(true)
    }
  }, [addNewSignal])

  const filtered = useMemo(() => {
    // A filtragem principal agora é feita no useEffect (load),
    // mas mantemos filtros de status/crédito no cliente sobre a página atual
    const arr = clients.filter(c => {
      // Filtro de Status
      if(filters.status === 'active' && c.active === false) return false
      if(filters.status === 'inactive' && c.active !== false) return false

      // Filtro de Crédito
      if(filters.credit === 'allowed' && !c.allowCredit) return false
      if(filters.credit === 'denied' && c.allowCredit) return false

      // Filtro de Aniversariantes
      if(filters.birthday) {
        if(!c.birthDate) return false
        const today = new Date()
        const currentMonth = today.getMonth() + 1 // 1-12
        const [_, month] = c.birthDate.split('-') // YYYY-MM-DD
        if(parseInt(month) !== currentMonth) return false
      }

      return true
    })
    return arr.slice().sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'pt-BR', { sensitivity:'base' }))
  }, [clients, filters])

  const startEdit = async (c) => {
    if(!isOwner && !perms.clients?.edit) return
    try {
      const mod = await (async () => {
        const m = await import('../services/clients')
        return m
      })()
      const full = await mod.getClientById(c.id)
      setEditingClient(full || c)
    } catch {
      setEditingClient(c)
    }
    setEditOpen(true)
    setOpenMenuId(null)
  }

  const openConfirmRemove = (c) => {
    if(!isOwner && !perms.clients?.delete) return
    setConfirmRemoveClient(c)
    setConfirmRemoveOpen(true)
    setOpenMenuId(null)
  }

  const openHistory = async (client) => {
    setHistoryClient(client)
    setHistoryItems([])
    setHistoryLoading(true)
    setHistoryOpen(true)
    setOpenMenuId(null)
    try {
      const items = await getClientOrderHistory(storeId, client)
      setHistoryItems(items)
    } catch (e) {
      console.error(e)
      alert('Erro ao carregar histórico do cliente.')
      setHistoryOpen(false)
    } finally {
      setHistoryLoading(false)
    }
  }

  const closeHistory = () => {
    setHistoryOpen(false)
    setHistoryLoading(false)
    setHistoryClient(null)
    setHistoryItems([])
  }

  const confirmRemove = async () => {
    if(!confirmRemoveClient) return
    setSavingAction(true)
    try {
      await removeClient(confirmRemoveClient.id)
      setConfirmRemoveOpen(false)
      setConfirmRemoveClient(null)
      
      // Atualiza Cache Local se existir
      if (cachedClients) {
          const newCache = cachedClients.filter(c => c.id !== confirmRemoveClient.id)
          setCachedClients(newCache)
          setTotalResults(prev => Math.max(0, prev - 1))
          // ✅ NOVO: Persiste imediatamente no DISCO (não espera background sync)
          persistCacheToDisk(newCache, cacheIncludesInactive)
      } else {
          // Recarrega do servidor
          const newClients = await getClientsByPage(storeId, page, PAGE_SIZE)
          setClients(newClients)
          getTotalClientsCount(storeId).then(setTotalResults)
      }
    } catch(e) {
      console.error(e)
      alert('Erro ao remover cliente')
    } finally {
      setSavingAction(false)
    }
  }

  // Helper para atualizar cache após Edição/Criação
  const handleClientSave = (clientData) => {
    if (cachedClients) {
      const index = cachedClients.findIndex(c => c.id === clientData.id)
      let newCache
      if (index !== -1) {
        // Update
        newCache = [...cachedClients]
        newCache[index] = { ...newCache[index], ...clientData }
      } else {
        // New
        newCache = [clientData, ...cachedClients]
        setTotalResults(prevTotal => prevTotal + 1)
      }
      setCachedClients(newCache)
      // ✅ NOVO: Persiste imediatamente no DISCO (não espera background sync 1h/10min)
      persistCacheToDisk(newCache, cacheIncludesInactive)
    } else {
      // Se não tem cache, recarrega a página atual
      getTotalClientsCount(storeId).then(setTotalResults)
      getClientsByPage(storeId, page, PAGE_SIZE).then(setClients)
    }
  }

  const formatDateTime = (value) => {
    if (!value) return '—'
    const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Componente de Paginação Numérica
  const Pagination = () => {
    const totalPages = Math.ceil(totalResults / PAGE_SIZE) || 1
    if (totalPages <= 1) return null

    const renderPageNumbers = () => {
        const pages = []
        const maxVisible = 5 // Quantos números mostrar
        
        // Sempre mostra página 1
        pages.push(
            <button
                key={1}
                onClick={() => setPage(1)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    page === 1 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
                1
            </button>
        )

        // Lógica para intervalo intermediário
        let start = Math.max(2, page - 1)
        let end = Math.min(totalPages - 1, page + 1)
        
        // Ajuste para mostrar mais se estiver perto do início ou fim
        if (page <= 3) {
            end = Math.min(totalPages - 1, 4)
        }
        if (page >= totalPages - 2) {
            start = Math.max(2, totalPages - 3)
        }

        if (start > 2) {
            pages.push(<span key="dots1" className="text-gray-400 px-1">...</span>)
        }

        for (let i = start; i <= end; i++) {
            pages.push(
                <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        page === i 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    {i}
                </button>
            )
        }

        if (end < totalPages - 1) {
            pages.push(<span key="dots2" className="text-gray-400 px-1">...</span>)
        }

        // Sempre mostra última página se > 1
        if (totalPages > 1) {
            pages.push(
                <button
                    key={totalPages}
                    onClick={() => setPage(totalPages)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        page === totalPages 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    {totalPages}
                </button>
            )
        }

        return pages
    }

    return (
        <div className="flex items-center justify-center gap-2 py-4">
            <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
            >
                &lt;
            </button>
            
            <div className="flex items-center gap-1">
                {renderPageNumbers()}
            </div>

            <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
            >
                &gt;
            </button>
        </div>
    )
  }

  return (
    <div>
      {/* Overlay para fechar menu ao clicar fora */}
      {openMenuId && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={()=>setOpenMenuId(null)}
        ></div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           {/* Esquerda: Pesquisa + Filtros */}
           <div className="flex items-center gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1 max-w-md">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                 <input 
                   value={query} 
                   onChange={e=>setQuery(e.target.value)} 
                   placeholder="Pesquisar nome, telefone..." 
                   className="w-full pl-9 pr-3 py-2 border dark:border-gray-700 rounded-md text-sm bg-gray-50 dark:bg-gray-700 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:ring-1 focus:ring-green-500 outline-none" 
                 />
              </div>
              <button 
                onClick={()=>setFilterOpen(true)} 
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <span>⚙️</span> Filtros
              </button>
           </div>

           {/* Direita: Opções + Novo */}
           <div className="flex items-center gap-3 flex-wrap justify-end">
              {PERSISTENT_CACHE_ENABLED && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {cacheSyncing || isCaching ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
                      <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                      {cacheLoadedFromDisk ? 'Sincronizando…' : 'Baixando clientes…'}
                    </span>
                  ) : cacheLoadedFromDisk ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[11px] font-medium">
                      <span>●</span>
                      Cache local
                      {cacheLastUpdate && (
                        <span className="opacity-80 ml-0.5">
                          · Atualizado {cacheLastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </span>
                  ) : cachedClients ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                      <span>●</span>
                      Carregado
                    </span>
                  ) : null}

                  {PERSISTENT_CACHE_ENABLED && (
                    <button
                      onClick={handleClearAllPersistentCache}
                      disabled={cacheSyncing || isCaching}
                      title="Apaga todo o cache salvo no dispositivo e baixa tudo do zero (Limpar Cache)"
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-md border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-[11px] font-medium disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      <span className="hidden sm:inline">Limpar Cache</span>
                    </button>
                  )}
                  {PERSISTENT_CACHE_ENABLED && (
                    <button
                      onClick={handleForceRefresh}
                      disabled={cacheSyncing || isCaching}
                      title="Forçar atualização do servidor (Atualizar)"
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-[11px] font-medium disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
                      <span className="hidden sm:inline">Atualizar</span>
                    </button>
                  )}
                </div>
              )}

              {loading && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-300 text-sm">
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                  <span>Carregando…</span>
                </div>
              )}
              <button className="hidden md:inline-flex px-4 py-2 border border-green-600 text-green-600 dark:text-green-400 dark:border-green-400 rounded-md text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/30">
                Opções
              </button>
              {(isOwner || perms.clients?.create) && (
              <button onClick={()=>setModalOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center gap-1">
                <span>+</span> Novo
              </button>
              )}
           </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-visible">
        {/* Cabeçalho (apenas desktop) */}
        <div className="hidden md:grid grid-cols-[1fr_6rem_5.5rem_3.5rem_1fr_12rem_6rem_2rem] gap-x-4 items-center px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-bold border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div>Clientes ({totalResults})</div>
          <div>Código</div>
          <div className="text-center">Atualizado</div>
          <div className="text-center">Hora</div>
          <div className="text-center">Funcionário</div>
          <div className="text-left">Whatsapp</div>
          <div className="text-right">Status</div>
          <div></div>
        </div>

        {filtered.map((c, index) => {
          // Só abre para cima se estiver no final da lista E não for um dos primeiros itens (para não cortar no topo)
          const isLast = index >= 2 && index >= filtered.length - 2
          return (
          <React.Fragment key={c.id}>
            {/* Linha mobile: apenas código + nome */}
            <div
              className="md:hidden px-4 py-3 border-b dark:border-gray-700 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium flex items-center gap-2 truncate text-gray-800 dark:text-gray-100">
                  <span className="truncate">{c.name}</span>
                  {c.code ? (<span className="text-gray-500 text-xs shrink-0">#{c.code}</span>) : null}
                </div>
                
                <div className="relative">
                   <button 
                     className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative z-20"
                     onClick={(e)=>{ e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id) }}
                   >
                     <span className="text-gray-500 text-lg font-bold px-2">⋯</span>
                   </button>
                   {openMenuId === c.id && (
                     <div className={`absolute right-0 ${isLast ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white dark:bg-gray-800 rounded shadow-xl border dark:border-gray-700 z-30 py-1`}>
                      <button type="button" className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2" onClick={()=> openHistory(c)}>
                        <span>🕘</span>
                        <span>Historico</span>
                      </button>
                      {(isOwner || perms.clients?.edit) && (
                      <button type="button" className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2" onClick={()=> startEdit(c)}>
                        <span>✏️</span>
                        <span>Editar</span>
                      </button>
                      )}
                      {(isOwner || perms.clients?.delete) && (
                      <button type="button" className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400" onClick={()=> openConfirmRemove(c)}>
                         <span>🗑️</span>
                         <span>Remover cliente</span>
                       </button>
                      )}
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* Linha desktop completa */}
            <div className="hidden md:grid grid-cols-[1fr_6rem_5.5rem_3.5rem_1fr_12rem_6rem_2rem] gap-x-4 items-center px-4 py-3 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <div className="text-sm text-gray-800 dark:text-gray-200">
                <div className="uppercase">
                  {c.name}
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {c.code || '-'}
              </div>
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                {(() => {
                  if (!c.updatedAt) return '—';
                  const d = c.updatedAt.seconds ? new Date(c.updatedAt.seconds * 1000) : new Date(c.updatedAt);
                  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
                })()}
              </div>
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                {(() => {
                  if (!c.updatedAt) return '—';
                  const d = c.updatedAt.seconds ? new Date(c.updatedAt.seconds * 1000) : new Date(c.updatedAt);
                  return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                })()}
              </div>
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 truncate px-2" title={c.lastEditedBy || c.createdBy || ''}>
                {c.lastEditedBy || c.createdBy || '—'}
              </div>
              <div className="text-left text-sm text-gray-500 dark:text-gray-400">
                {c.whatsapp ? (
                  (() => {
                    const raw = String(c.whatsapp || '')
                    const digits = raw.replace(/\D/g, '')
                    const withCountry = digits.startsWith('55') ? digits : `55${digits}`
                    const url = `https://wa.me/${withCountry}`
                    return (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 dark:text-green-400 hover:underline"
                        title="Abrir conversa no WhatsApp"
                        onClick={(e)=> e.stopPropagation()}
                      >
                        {c.whatsapp}
                      </a>
                    )
                  })()
                ) : (
                  (c.phone || '-')
                )}
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.active !== false ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {c.active !== false ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="relative text-right">
                   <button 
                     className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative z-20"
                     onClick={(e)=>{ e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id) }}
                   >
                     <span className="text-gray-500 text-lg font-bold px-2">⋯</span>
                   </button>
                   {openMenuId === c.id && (
                     <div className={`absolute right-0 ${isLast ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white dark:bg-gray-800 rounded shadow-xl border dark:border-gray-700 z-30 py-1 text-left`}>
                      <button type="button" className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2" onClick={()=> openHistory(c)}>
                        <span>🕘</span>
                        <span>Historico</span>
                      </button>
                      {(isOwner || perms.clients?.edit) && (
                      <button type="button" className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2" onClick={()=> startEdit(c)}>
                        <span>✏️</span>
                        <span>Editar</span>
                      </button>
                      )}
                      {(isOwner || perms.clients?.delete) && (
                      <button type="button" className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400" onClick={()=> openConfirmRemove(c)}>
                         <span>🗑️</span>
                         <span>Remover cliente</span>
                       </button>
                      )}
                     </div>
                   )}
              </div>
            </div>
          </React.Fragment>
          )
        })}

        {/* Loading Skeleton */}
        {loading && (
          <div className="divide-y dark:divide-gray-700">
            {Array.from({length: 8}).map((_, i) => (
              <div key={`cli-sk-${i}`} className="px-4 py-3 animate-pulse">
                <div className="hidden md:grid grid-cols-[1fr_6rem_5.5rem_3.5rem_1fr_12rem_6rem_2rem] gap-x-4 items-center">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 justify-self-center"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-10 justify-self-center"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16 justify-self-end"></div>
                  <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded-full justify-self-end"></div>
                </div>
                <div className="md:hidden flex items-center justify-between">
                  <div className="space-y-2 w-2/3">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500">
                Nenhum cliente encontrado.
            </div>
        )}
        
        {/* Paginação Numérica */}
        <Pagination />

      </div>

      <NewClientModal 
        open={modalOpen} 
        onClose={()=>setModalOpen(false)} 
        storeId={storeId}
        user={user}
        onSuccess={(newClient) => {
            setModalOpen(false)
            handleClientSave(newClient)
        }}
      />

      {editOpen && editingClient && (
        <NewClientModal 
          open={editOpen} 
          onClose={()=>{setEditOpen(false); setEditingClient(null)}} 
          storeId={storeId}
          isEdit={true}
          client={editingClient}
          user={user}
          onSuccess={(updatedClient) => {
              setEditOpen(false)
              setEditingClient(null)
              handleClientSave(updatedClient)
          }}
        />
      )}

      {/* Modal Filtros */}
      <ClientsFilterModal
        open={filterOpen}
        onClose={()=>setFilterOpen(false)}
        initialFilters={filters}
        onApply={setFilters}
      />

      {historyOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b dark:border-gray-700 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Historico do cliente</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {historyClient?.name || 'Cliente'} - compras em vendas e O.S
                </p>
              </div>
              <button
                type="button"
                onClick={closeHistory}
                className="px-3 py-1.5 rounded border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>

            <div className="p-5 overflow-auto">
              {historyLoading ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando historico...</div>
              ) : historyItems.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                  Nenhuma compra encontrada para este cliente.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyItems.map(item => {
                    const isSale = item.type === 'sale'
                    const primaryDate = item.createdAt || item.updatedAt || item.dateIn
                    return (
                      <div key={item.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/20">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isSale ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                {isSale ? 'Venda' : 'O.S'}
                              </span>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {item.number || 'Sem numero'}
                              </span>
                              {item.status ? (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Status: {item.status}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              Data: {formatDateTime(primaryDate)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              {isSale ? `Vendedor: ${item.attendant || '—'}` : `Atendente: ${item.attendant || '—'} | Tecnico: ${item.technician || '—'}`}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              {isSale ? `Itens: ${item.productsCount}` : `Produtos: ${item.productsCount} | Servicos: ${item.servicesCount}`}
                            </div>
                          </div>
                          <div className="text-left md:text-right">
                            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {Number(item.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação Remoção */}
      {confirmRemoveOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2 dark:text-white">Remover Cliente</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Tem certeza que deseja remover <b>{confirmRemoveClient?.name}</b>?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={()=>setConfirmRemoveOpen(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                disabled={savingAction}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmRemove}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2"
                disabled={savingAction}
              >
                {savingAction ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
