// Fonte única de verdade das regras de acesso às páginas.
// Usada pela Sidebar (o que exibir) e pelo App (qual a página inicial do funcionário).

// Verifica o acesso apenas pelo papel/permissões do usuário.
export function isPageAllowedByRole(user, key){
  if (!user) return false
  if (!user.memberId) return true // dono tem acesso a todas as páginas
  const perms = user.permissions || {}

  if (key === 'marketplace' || key.startsWith('marketplace-')) {
    return perms.marketplace?.view || perms.marketplace?.view === undefined
  }

  switch (key) {
    case 'inicio': return perms.home?.view !== false
    case 'termos': return !!(perms.terms?.view || perms.terms?.edit)
    case 'catalogo': return perms.catalog?.view || perms.catalog?.view === undefined
    case 'clientes': return !!(perms.clients?.view || perms.clients?.create || perms.clients?.edit || perms.clients?.delete)
    case 'produtos': return !!(perms.products?.view || perms.products?.create || perms.products?.edit || perms.products?.delete || perms.sales?.viewAll || perms.sales?.finalize)
    case 'vendas': return !!(perms.sales?.viewAll || perms.sales?.finalize || perms.sales?.edit)
    case 'caixa': return !!(perms.cash?.view || perms.cash?.open || perms.cash?.close)
    case 'notas': return false
    case 'os': return !!(perms.serviceOrders?.view || perms.serviceOrders?.create || perms.serviceOrders?.edit || perms.serviceOrders?.delete || perms.serviceOrders?.changeStatus)
    case 'areaTecnico': return !!user.isTech
    case 'cpagar': return !!(perms.payables?.view || perms.payables?.create || perms.payables?.edit)
    case 'creceber': return !!(perms.receivables?.view || perms.receivables?.create || perms.receivables?.edit)
    case 'estatisticas': return !!perms.statistics?.view
    default: return false
  }
}

// Aplica também o filtro de páginas liberadas pela loja (store.sidebarPages).
// 'caixa' é obrigatório em todas as lojas.
export function isPageAllowed(user, key, allowedPages){
  if (!isPageAllowedByRole(user, key)) return false
  if (allowedPages && typeof allowedPages === 'object' && Object.keys(allowedPages).length > 0) {
    if (key === 'caixa') return true
    if (allowedPages[key] === false) return false
  }
  return true
}

// Ordem de prioridade para definir a página inicial de um funcionário.
const LANDING_PRIORITY = [
  'inicio', 'vendas', 'caixa', 'clientes', 'produtos', 'os',
  'creceber', 'cpagar', 'estatisticas', 'catalogo', 'areaTecnico',
  'marketplace', 'termos',
]

// Primeira página que o usuário pode acessar (fallback: 'inicio').
export function getFirstAllowedPage(user, allowedPages){
  for (const key of LANDING_PRIORITY) {
    if (isPageAllowed(user, key, allowedPages)) return key
  }
  return 'inicio'
}
