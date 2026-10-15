import {
  Pessoa,
  Cartao,
  Categoria,
  Compra,
  Parcela,
  PessoaCompra,
  DivisaoPessoaInput,
  RegraCategorizacao,
  Importacao,
  HistoricoAlteracao,
} from './types'
import { calcularVencimentos, gerarParcelas, toCents, fromCents } from './finance-utils'

const STORAGE_KEYS = {
  PESSOAS: 'gc_pessoas',
  CARTOES: 'gc_cartoes',
  CATEGORIAS: 'gc_categorias',
  COMPRAS: 'gc_compras',
  PARCELAS: 'gc_parcelas',
  PESSOAS_COMPRAS: 'gc_pessoas_compras',
  REGRAS: 'gc_regras_categorizacao',
  IMPORTACOES: 'gc_importacoes',
  HISTORICO: 'gc_historico_alteracoes',
}

export const CATEGORIAS_PADRAO: Array<Omit<Categoria, 'id'>> = [
  { nome: 'Alimentação', cor: '#f59e0b', icone: 'Utensils' },
  { nome: 'Transporte', cor: '#3b82f6', icone: 'Car' },
  { nome: 'Lazer', cor: '#ec4899', icone: 'PartyPopper' },
  { nome: 'Saúde', cor: '#ef4444', icone: 'HeartPulse' },
  { nome: 'Moradia', cor: '#8b5cf6', icone: 'Home' },
  { nome: 'Compras', cor: '#6366f1', icone: 'ShoppingBag' },
  { nome: 'Assinaturas', cor: '#06b6d4', icone: 'Tv' },
  { nome: 'Educação', cor: '#14b8a6', icone: 'GraduationCap' },
  { nome: 'Outros', cor: '#64748b', icone: 'Tag' },
]

export const CARTOES_EXEMPLO: Array<Omit<Cartao, 'id'>> = [
  { nome: 'Nubank', cor: '#8b5cf6', dia_fechamento: 15, dia_vencimento: 20, limite: 6000 },
  { nome: 'Inter', cor: '#f97316', dia_fechamento: 8, dia_vencimento: 15, limite: 4000 },
]

export const PESSOAS_EXEMPLO: Array<Omit<Pessoa, 'id'>> = [
  { nome: 'Eu', cor: '#10b981', contato: '', ativo: true },
  { nome: 'Marina', cor: '#ec4899', contato: '(11) 98765-4321', ativo: true },
  { nome: 'Lucas', cor: '#3b82f6', contato: 'lucas@email.com', ativo: true },
]

function getLocal<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : defaultValue
  } catch {
    return defaultValue
  }
}

function setLocal<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Erro ao salvar no localStorage', e)
  }
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => null)
      if (options?.method && options.method !== 'GET') {
        throw new Error(errData?.error || `Erro ${res.status} ao processar requisição`)
      }
      return null
    }
    return (await res.json()) as T
  } catch (err: any) {
    if (options?.method && options.method !== 'GET') {
      throw err
    }
    return null
  }
}

export class StorageService {
  // ==========================================
  // INICIALIZAÇÃO / SEED
  // ==========================================
  public static async inicializarDados(): Promise<void> {
    const res = await apiFetch<{ ok: boolean }>('/api/init')
    if (res?.ok) return

    // Modo Local caso Postgres não esteja rodando
    let pessoas = getLocal<Pessoa[]>(STORAGE_KEYS.PESSOAS, [])
    if (pessoas.length === 0) {
      pessoas = PESSOAS_EXEMPLO.map((p) => ({ ...p, id: crypto.randomUUID() }))
      setLocal(STORAGE_KEYS.PESSOAS, pessoas)
    }

    let cartoes = getLocal<Cartao[]>(STORAGE_KEYS.CARTOES, [])
    if (cartoes.length === 0) {
      cartoes = CARTOES_EXEMPLO.map((c) => ({ ...c, id: crypto.randomUUID() }))
      setLocal(STORAGE_KEYS.CARTOES, cartoes)
    }

    let categorias = getLocal<Categoria[]>(STORAGE_KEYS.CATEGORIAS, [])
    if (categorias.length === 0) {
      categorias = CATEGORIAS_PADRAO.map((c) => ({ ...c, id: crypto.randomUUID() }))
      setLocal(STORAGE_KEYS.CATEGORIAS, categorias)
    }
  }

  public static async popularDadosExemplo(): Promise<void> {
    await this.inicializarDados()
    const pessoas = await this.getPessoas()
    const cartoes = await this.getCartoes()
    const categorias = await this.getCategorias()

    const eu = pessoas.find((p) => p.nome.toLowerCase() === 'eu') || pessoas[0]
    const marina = pessoas.find((p) => p.nome.toLowerCase() === 'marina') || pessoas[1] || eu
    const lucas = pessoas.find((p) => p.nome.toLowerCase() === 'lucas') || pessoas[2] || eu

    const nubank = cartoes[0]
    const inter = cartoes[1] || cartoes[0]

    const catAlim = categorias.find((c) => c.nome === 'Alimentação') || categorias[0]
    const catTransp = categorias.find((c) => c.nome === 'Transporte') || categorias[0]
    const catCompras = categorias.find((c) => c.nome === 'Compras') || categorias[0]
    const catLazer = categorias.find((c) => c.nome === 'Lazer') || categorias[0]

    const hoje = new Date()
    const dataHoje = hoje.toISOString().split('T')[0]

    // 1. Supermercado
    await this.saveCompra(
      {
        descricao: 'Supermercado Pão de Açúcar',
        valor_integral: 654.8,
        parcelas_totais: 2,
        data_compra: dataHoje,
        cartao_id: nubank?.id,
        categoria_id: catAlim?.id,
      },
      [
        { pessoa_id: eu.id, tipo_divisao: 'igualitaria', valor: 327.4 },
        { pessoa_id: marina.id, tipo_divisao: 'igualitaria', valor: 327.4 },
      ],
      nubank
    )

    // 2. Passagens Aéreas
    await this.saveCompra(
      {
        descricao: 'Passagens Aéreas Latam',
        valor_integral: 1200.0,
        parcelas_totais: 3,
        data_compra: dataHoje,
        cartao_id: nubank?.id,
        categoria_id: catTransp?.id,
      },
      [
        { pessoa_id: eu.id, tipo_divisao: 'percentual', percentual: 50, valor: 600.0 },
        { pessoa_id: lucas.id, tipo_divisao: 'percentual', percentual: 50, valor: 600.0 },
      ],
      nubank
    )

    // 3. Jantar Especial
    await this.saveCompra(
      {
        descricao: 'Restaurante Família Mancini',
        valor_integral: 280.0,
        parcelas_totais: 1,
        data_compra: dataHoje,
        cartao_id: inter?.id,
        categoria_id: catLazer?.id,
      },
      [
        { pessoa_id: eu.id, tipo_divisao: 'valor_fixo', valor: 180.0 },
        { pessoa_id: marina.id, tipo_divisao: 'valor_fixo', valor: 100.0 },
      ],
      inter
    )

    // 4. Amazon Eletrônicos
    await this.saveCompra(
      {
        descricao: 'Fone de Ouvido Bluetooth (Amazon)',
        valor_integral: 349.9,
        parcelas_totais: 4,
        data_compra: dataHoje,
        cartao_id: inter?.id,
        categoria_id: catCompras?.id,
      },
      [{ pessoa_id: eu.id, tipo_divisao: 'igualitaria', valor: 349.9 }],
      inter
    )
  }

  // ==========================================
  // PESSOAS
  // ==========================================
  public static async getPessoas(): Promise<Pessoa[]> {
    const data = await apiFetch<Pessoa[]>('/api/pessoas')
    if (data) return data
    return getLocal<Pessoa[]>(STORAGE_KEYS.PESSOAS, [])
  }

  public static async savePessoa(pessoa: Omit<Pessoa, 'id'> & { id?: string }): Promise<Pessoa> {
    const res = await apiFetch<Pessoa>('/api/pessoas', {
      method: 'POST',
      body: JSON.stringify(pessoa),
    })
    if (res) return res

    // Fallback Local
    const id = pessoa.id || crypto.randomUUID()
    const record: Pessoa = {
      id,
      nome: pessoa.nome.trim(),
      cor: pessoa.cor || '#3b82f6',
      contato: pessoa.contato?.trim() || null,
      ativo: pessoa.ativo ?? true,
    }
    const list = getLocal<Pessoa[]>(STORAGE_KEYS.PESSOAS, [])
    const index = list.findIndex((p) => p.id === id)
    if (index >= 0) list[index] = record
    else list.push(record)
    setLocal(STORAGE_KEYS.PESSOAS, list)
    return record
  }

  public static async inativarOuExcluirPessoa(id: string): Promise<{ action: 'deleted' | 'inactivated' }> {
    const res = await apiFetch<{ action: 'deleted' | 'inactivated' }>(`/api/pessoas?id=${id}`, {
      method: 'DELETE',
    })
    if (res) return res

    // Fallback Local
    const temCompras = await this.verificarPessoaTemCompras(id)
    if (temCompras) {
      await this.savePessoa({ ...(await this.getPessoas()).find((p) => p.id === id)!, id, ativo: false })
      return { action: 'inactivated' }
    }
    const list = getLocal<Pessoa[]>(STORAGE_KEYS.PESSOAS, []).filter((p) => p.id !== id)
    setLocal(STORAGE_KEYS.PESSOAS, list)
    return { action: 'deleted' }
  }

  public static async verificarPessoaTemCompras(pessoaId: string): Promise<boolean> {
    const pcList = getLocal<PessoaCompra[]>(STORAGE_KEYS.PESSOAS_COMPRAS, [])
    return pcList.some((pc) => pc.pessoa_id === pessoaId)
  }

  // ==========================================
  // CARTÕES
  // ==========================================
  public static async getCartoes(): Promise<Cartao[]> {
    const data = await apiFetch<Cartao[]>('/api/cartoes')
    if (data) return data
    return getLocal<Cartao[]>(STORAGE_KEYS.CARTOES, [])
  }

  public static async saveCartao(cartao: Omit<Cartao, 'id'> & { id?: string }): Promise<Cartao> {
    const res = await apiFetch<Cartao>('/api/cartoes', {
      method: 'POST',
      body: JSON.stringify(cartao),
    })
    if (res) return res

    const id = cartao.id || crypto.randomUUID()
    const record: Cartao = {
      id,
      nome: cartao.nome.trim(),
      cor: cartao.cor || '#8b5cf6',
      limite: cartao.limite ? Number(cartao.limite) : null,
      dia_fechamento: Number(cartao.dia_fechamento) || 15,
      dia_vencimento: Number(cartao.dia_vencimento) || 20,
    }
    const list = getLocal<Cartao[]>(STORAGE_KEYS.CARTOES, [])
    const index = list.findIndex((c) => c.id === id)
    if (index >= 0) list[index] = record
    else list.push(record)
    setLocal(STORAGE_KEYS.CARTOES, list)
    return record
  }

  public static async deleteCartao(id: string): Promise<void> {
    await apiFetch(`/api/cartoes?id=${id}`, { method: 'DELETE' })
    const list = getLocal<Cartao[]>(STORAGE_KEYS.CARTOES, []).filter((c) => c.id !== id)
    setLocal(STORAGE_KEYS.CARTOES, list)
  }

  // ==========================================
  // CATEGORIAS
  // ==========================================
  public static async getCategorias(): Promise<Categoria[]> {
    const data = await apiFetch<Categoria[]>('/api/categorias')
    if (data) return data
    return getLocal<Categoria[]>(STORAGE_KEYS.CATEGORIAS, [])
  }

  public static async saveCategoria(categoria: Omit<Categoria, 'id'> & { id?: string }): Promise<Categoria> {
    const res = await apiFetch<Categoria>('/api/categorias', {
      method: 'POST',
      body: JSON.stringify(categoria),
    })
    if (res) return res

    const id = categoria.id || crypto.randomUUID()
    const record: Categoria = {
      id,
      nome: categoria.nome.trim(),
      cor: categoria.cor || '#10b981',
      icone: categoria.icone || 'Tag',
    }
    const list = getLocal<Categoria[]>(STORAGE_KEYS.CATEGORIAS, [])
    const index = list.findIndex((c) => c.id === id)
    if (index >= 0) list[index] = record
    else list.push(record)
    setLocal(STORAGE_KEYS.CATEGORIAS, list)
    return record
  }

  public static async deleteCategoria(id: string): Promise<void> {
    await apiFetch(`/api/categorias?id=${id}`, { method: 'DELETE' })
    const list = getLocal<Categoria[]>(STORAGE_KEYS.CATEGORIAS, []).filter((c) => c.id !== id)
    setLocal(STORAGE_KEYS.CATEGORIAS, list)
  }

  // ==========================================
  // COMPRAS & PARCELAS & DIVISÕES
  // ==========================================
  public static async getCompras(incluirDeletadas = false): Promise<Compra[]> {
    const data = await apiFetch<Compra[]>(`/api/compras?incluirDeletadas=${incluirDeletadas}`)
    if (data) return data

    const compras = getLocal<Compra[]>(STORAGE_KEYS.COMPRAS, [])
    const pessoasCompras = getLocal<PessoaCompra[]>(STORAGE_KEYS.PESSOAS_COMPRAS, [])
    const parcelas = getLocal<Parcela[]>(STORAGE_KEYS.PARCELAS, [])

    return compras
      .filter((c) => (incluirDeletadas ? true : !c.deletado_em))
      .map((c) => ({
        ...c,
        pessoas_compras: pessoasCompras.filter((pc) => pc.compra_id === c.id),
        parcelas: parcelas.filter((p) => p.compra_id === c.id),
      }))
      .sort((a, b) => b.data_compra.localeCompare(a.data_compra))
  }

  public static async saveCompra(
    compraData: Omit<Compra, 'id' | 'deletado_em'> & { id?: string },
    divisoes: DivisaoPessoaInput[],
    cartaoRef?: Cartao,
    autoQuitarAnteriores = true
  ): Promise<Compra> {
    const res = await apiFetch<{ ok: boolean; id: string }>('/api/compras', {
      method: 'POST',
      body: JSON.stringify({ compra: compraData, divisoes, cartaoRef, autoQuitarAnteriores }),
    })

    const id = compraData.id || res?.id || crypto.randomUUID()
    const compraRecord: Compra = {
      id,
      descricao: compraData.descricao.trim(),
      valor_integral: Number(compraData.valor_integral),
      parcelas_totais: Number(compraData.parcelas_totais) || 1,
      data_compra: compraData.data_compra,
      cartao_id: compraData.cartao_id || null,
      categoria_id: compraData.categoria_id || null,
      deletado_em: null,
      fixa: compraData.fixa,
      encerrada_em: compraData.encerrada_em || null,
    }

    // Calcula parcelas locais para fallback
    const cartaoInfo = cartaoRef || { dia_fechamento: 15, dia_vencimento: 20 }
    const totalParcelas = compraRecord.fixa ? 24 : compraRecord.parcelas_totais
    const vencimentos = calcularVencimentos(compraRecord.data_compra, cartaoInfo, totalParcelas)
    const parcelasNovas = gerarParcelas(
      id,
      compraRecord.valor_integral,
      totalParcelas,
      vencimentos,
      autoQuitarAnteriores,
      compraRecord.fixa
    )

    const pessoasComprasNovas: PessoaCompra[] = divisoes.map((d) => ({
      id: crypto.randomUUID(),
      compra_id: id,
      pessoa_id: d.pessoa_id,
      tipo_divisao: d.tipo_divisao,
      percentual: d.percentual || null,
      valor: d.valor || 0,
    }))

    const comprasLocais = getLocal<Compra[]>(STORAGE_KEYS.COMPRAS, [])
    const indexC = comprasLocais.findIndex((c) => c.id === id)
    if (indexC >= 0) comprasLocais[indexC] = compraRecord
    else comprasLocais.push(compraRecord)
    setLocal(STORAGE_KEYS.COMPRAS, comprasLocais)

    const pcLocais = getLocal<PessoaCompra[]>(STORAGE_KEYS.PESSOAS_COMPRAS, []).filter((pc) => pc.compra_id !== id)
    setLocal(STORAGE_KEYS.PESSOAS_COMPRAS, [...pcLocais, ...pessoasComprasNovas])

    const pLocais = getLocal<Parcela[]>(STORAGE_KEYS.PARCELAS, []).filter((p) => p.compra_id !== id)
    setLocal(STORAGE_KEYS.PARCELAS, [...pLocais, ...parcelasNovas])

    return {
      ...compraRecord,
      pessoas_compras: pessoasComprasNovas,
      parcelas: parcelasNovas,
    }
  }

  public static async softDeleteCompra(id: string): Promise<void> {
    await apiFetch('/api/compras', {
      method: 'PATCH',
      body: JSON.stringify({ id, acao: 'soft_delete' }),
    })
    const list = getLocal<Compra[]>(STORAGE_KEYS.COMPRAS, [])
    const target = list.find((c) => c.id === id)
    if (target) {
      target.deletado_em = new Date().toISOString()
      setLocal(STORAGE_KEYS.COMPRAS, list)
    }
  }

  public static async restoreCompra(id: string): Promise<void> {
    await apiFetch('/api/compras', {
      method: 'PATCH',
      body: JSON.stringify({ id, acao: 'restore' }),
    })
    const list = getLocal<Compra[]>(STORAGE_KEYS.COMPRAS, [])
    const target = list.find((c) => c.id === id)
    if (target) {
      target.deletado_em = null
      setLocal(STORAGE_KEYS.COMPRAS, list)
    }
  }

  public static async encerrarAssinatura(id: string, dataEncerramento?: string): Promise<void> {
    await apiFetch('/api/compras', {
      method: 'PATCH',
      body: JSON.stringify({ id, acao: 'encerrar_assinatura', data_encerramento: dataEncerramento }),
    })
    const list = getLocal<Compra[]>(STORAGE_KEYS.COMPRAS, [])
    const target = list.find((c) => c.id === id)
    if (target) {
      target.encerrada_em = dataEncerramento || new Date().toISOString().slice(0, 10)
      setLocal(STORAGE_KEYS.COMPRAS, list)
    }
  }

  public static async reativarAssinatura(id: string): Promise<void> {
    await apiFetch('/api/compras', {
      method: 'PATCH',
      body: JSON.stringify({ id, acao: 'reativar_assinatura' }),
    })
    const list = getLocal<Compra[]>(STORAGE_KEYS.COMPRAS, [])
    const target = list.find((c) => c.id === id)
    if (target) {
      target.encerrada_em = null
      setLocal(STORAGE_KEYS.COMPRAS, list)
    }
  }

  public static async deletePermanenteCompra(id: string): Promise<void> {
    await apiFetch(`/api/compras?id=${id}`, { method: 'DELETE' })
    setLocal(STORAGE_KEYS.COMPRAS, getLocal<Compra[]>(STORAGE_KEYS.COMPRAS, []).filter((c) => c.id !== id))
    setLocal(STORAGE_KEYS.PARCELAS, getLocal<Parcela[]>(STORAGE_KEYS.PARCELAS, []).filter((p) => p.compra_id !== id))
    setLocal(STORAGE_KEYS.PESSOAS_COMPRAS, getLocal<PessoaCompra[]>(STORAGE_KEYS.PESSOAS_COMPRAS, []).filter((pc) => pc.compra_id !== id))
  }

  // ==========================================
  // PARCELAS
  // ==========================================
  public static async togglePagaParcela(parcelaId: string, paga: boolean): Promise<void> {
    await apiFetch('/api/parcelas', {
      method: 'PATCH',
      body: JSON.stringify({ parcelaId, paga }),
    })
    const list = getLocal<Parcela[]>(STORAGE_KEYS.PARCELAS, [])
    const target = list.find((p) => p.id === parcelaId)
    if (target) {
      target.paga = paga
      setLocal(STORAGE_KEYS.PARCELAS, list)
    }
  }

  public static async marcarParcelasPagasEmLote(parcelaIds: string[], paga: boolean): Promise<void> {
    await apiFetch('/api/parcelas', {
      method: 'PATCH',
      body: JSON.stringify({ parcelaIds, paga }),
    })
    const list = getLocal<Parcela[]>(STORAGE_KEYS.PARCELAS, [])
    list.forEach((p) => {
      if (parcelaIds.includes(p.id)) p.paga = paga
    })
    setLocal(STORAGE_KEYS.PARCELAS, list)
  }

  // ==========================================
  // REGRAS DE CATEGORIZAÇÃO
  // ==========================================
  public static async getRegrasCategorizacao(): Promise<RegraCategorizacao[]> {
    const data = await apiFetch<RegraCategorizacao[]>('/api/regras')
    if (data) return data
    return getLocal<RegraCategorizacao[]>(STORAGE_KEYS.REGRAS, [
      { id: '1', termo: 'UBER', categoria_id: '', created_at: new Date().toISOString() },
      { id: '2', termo: 'MERCADO', categoria_id: '', created_at: new Date().toISOString() },
      { id: '3', termo: 'IFOOD', categoria_id: '', created_at: new Date().toISOString() },
    ])
  }

  public static async saveRegraCategorizacao(termo: string, categoria_id: string): Promise<RegraCategorizacao> {
    const res = await apiFetch<RegraCategorizacao>('/api/regras', {
      method: 'POST',
      body: JSON.stringify({ termo, categoria_id }),
    })
    if (res) return res

    const id = crypto.randomUUID()
    const regra: RegraCategorizacao = { id, termo: termo.trim().toUpperCase(), categoria_id }
    const lista = getLocal<RegraCategorizacao[]>(STORAGE_KEYS.REGRAS, [])
    setLocal(STORAGE_KEYS.REGRAS, [regra, ...lista.filter((r) => r.termo !== regra.termo)])
    return regra
  }

  public static async deleteRegraCategorizacao(id: string): Promise<void> {
    await apiFetch(`/api/regras?id=${id}`, { method: 'DELETE' })
    const lista = getLocal<RegraCategorizacao[]>(STORAGE_KEYS.REGRAS, []).filter((r) => r.id !== id)
    setLocal(STORAGE_KEYS.REGRAS, lista)
  }

  public static async sugerirCategoriaPorDescricao(descricao: string): Promise<string | null> {
    if (!descricao || !descricao.trim()) return null
    const termoUpper = descricao.trim().toUpperCase()

    const regras = await this.getRegrasCategorizacao()
    for (const r of regras) {
      if (r.termo && r.categoria_id && termoUpper.includes(r.termo)) {
        return r.categoria_id
      }
    }

    const compras = await this.getCompras(true)
    const matches: Record<string, number> = {}

    for (const c of compras) {
      if (!c.categoria_id) continue
      const cUpper = c.descricao.toUpperCase()
      if (cUpper.includes(termoUpper) || termoUpper.includes(cUpper)) {
        matches[c.categoria_id] = (matches[c.categoria_id] || 0) + 3
      } else {
        const palavras = termoUpper.split(/\s+/)
        for (const p of palavras) {
          if (p.length > 3 && cUpper.includes(p)) {
            matches[c.categoria_id] = (matches[c.categoria_id] || 0) + 1
          }
        }
      }
    }

    let melhorId: string | null = null
    let maiorScore = 0
    for (const [catId, score] of Object.entries(matches)) {
      if (score > maiorScore) {
        maiorScore = score
        melhorId = catId
      }
    }
    return melhorId
  }

  // ==========================================
  // IMPORTAÇÕES
  // ==========================================
  public static async getImportacoes(): Promise<Importacao[]> {
    const data = await apiFetch<Importacao[]>('/api/importacoes')
    if (data) return data
    return getLocal<Importacao[]>(STORAGE_KEYS.IMPORTACOES, [])
  }

  public static async salvarRegistroImportacao(
    arquivo: string,
    tipo: 'csv' | 'pdf',
    status: 'concluido' | 'pendente' | 'erro',
    total_itens: number = 0
  ): Promise<Importacao> {
    const res = await apiFetch<Importacao>('/api/importacoes', {
      method: 'POST',
      body: JSON.stringify({ arquivo, tipo, status, total_itens }),
    })
    if (res) return res

    const reg: Importacao = { id: crypto.randomUUID(), arquivo, tipo, status, total_itens }
    const list = getLocal<Importacao[]>(STORAGE_KEYS.IMPORTACOES, [])
    setLocal(STORAGE_KEYS.IMPORTACOES, [reg, ...list])
    return reg
  }

  // ==========================================
  // HISTÓRICO DE ALTERAÇÕES
  // ==========================================
  public static async getHistoricoAlteracoes(): Promise<HistoricoAlteracao[]> {
    const data = await apiFetch<HistoricoAlteracao[]>('/api/historico')
    if (data) return data
    return getLocal<HistoricoAlteracao[]>(STORAGE_KEYS.HISTORICO, [])
  }

  public static async restaurarItemHistorico(item: HistoricoAlteracao): Promise<boolean> {
    const res = await apiFetch<{ ok: boolean }>('/api/historico', {
      method: 'PATCH',
      body: JSON.stringify({ item }),
    })
    if (res?.ok) return true

    if (item.entidade === 'compra') {
      await this.restoreCompra(item.entidade_id)
      return true
    }
    return false
  }
}
