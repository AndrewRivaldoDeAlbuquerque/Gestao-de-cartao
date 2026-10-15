'use client'

import { useState, useMemo } from 'react'
import { Compra, Cartao, Categoria, Pessoa } from '@/lib/types'
import { formatCurrency, formatDateBR, getInfoParcelaMesAtual, isCompraFixa } from '@/lib/finance-utils'
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  Repeat,
  Ban,
  PlayCircle,
} from 'lucide-react'

interface ComprasViewProps {
  compras: Compra[]
  cartoes: Cartao[]
  categorias: Categoria[]
  pessoas: Pessoa[]
  onNovaCompra: () => void
  onEditarCompra: (compra: Compra) => void
  onSoftDelete: (id: string) => Promise<void>
  onRestore: (id: string) => Promise<void>
  onDeletePermanente: (id: string) => Promise<void>
  onNotifyToast: (msg: string) => void
  onEncerrarAssinatura?: (id: string) => Promise<void>
  onReativarAssinatura?: (id: string) => Promise<void>
}

const ITENS_POR_PAGINA = 8

export function ComprasView({
  compras,
  cartoes,
  categorias,
  pessoas,
  onNovaCompra,
  onEditarCompra,
  onSoftDelete,
  onRestore,
  onDeletePermanente,
  onNotifyToast,
  onEncerrarAssinatura,
  onReativarAssinatura,
}: ComprasViewProps) {
  const [busca, setBusca] = useState('')
  const [filtroCartao, setFiltroCartao] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroPessoa, setFiltroPessoa] = useState('todas')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_aberto' | 'quitada'>('todos')
  const [ordenacao, setOrdenacao] = useState<'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'>('data_desc')
  const [pagina, setPagina] = useState(1)
  const [exibindoLixeira, setExibindoLixeira] = useState(false)

  // Separa compras ativas de deletadas
  const comprasAtivas = useMemo(() => compras.filter((c) => !c.deletado_em), [compras])
  const comprasDeletadas = useMemo(() => compras.filter((c) => !!c.deletado_em), [compras])

  const listaBase = exibindoLixeira ? comprasDeletadas : comprasAtivas

  // Filtragem
  const comprasFiltradas = useMemo(() => {
    return listaBase
      .filter((c) => {
        // Busca textual
        if (busca.trim()) {
          const termo = busca.toLowerCase()
          const matchesDesc = c.descricao.toLowerCase().includes(termo)
          if (!matchesDesc) return false
        }

        // Filtro por cartão
        if (filtroCartao !== 'todos' && c.cartao_id !== filtroCartao) return false

        // Filtro por categoria
        if (filtroCategoria !== 'todas' && c.categoria_id !== filtroCategoria) return false

        // Filtro por pessoa
        if (filtroPessoa !== 'todas') {
          const temPessoa = (c.pessoas_compras || []).some((pc) => pc.pessoa_id === filtroPessoa)
          if (!temPessoa) return false
        }

        // Filtro por status de pagamento das parcelas
        if (filtroStatus !== 'todos') {
          const todasPagas = (c.parcelas || []).length > 0 && (c.parcelas || []).every((p) => p.paga)
          if (filtroStatus === 'quitada' && !todasPagas) return false
          if (filtroStatus === 'em_aberto' && todasPagas) return false
        }

        return true
      })
      .sort((a, b) => {
        if (ordenacao === 'data_desc') return b.data_compra.localeCompare(a.data_compra)
        if (ordenacao === 'data_asc') return a.data_compra.localeCompare(b.data_compra)
        if (ordenacao === 'valor_desc') return b.valor_integral - a.valor_integral
        if (ordenacao === 'valor_asc') return a.valor_integral - b.valor_integral
        return 0
      })
  }, [listaBase, busca, filtroCartao, filtroCategoria, filtroPessoa, filtroStatus, ordenacao])

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(comprasFiltradas.length / ITENS_POR_PAGINA))
  const comprasPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA
    return comprasFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [comprasFiltradas, pagina])

  const handleExcluir = async (id: string) => {
    if (confirm('Deseja mover esta compra para a lixeira?')) {
      await onSoftDelete(id)
      onNotifyToast('Compra movida para a lixeira.')
    }
  }

  const handleRestaurar = async (id: string) => {
    await onRestore(id)
    onNotifyToast('Compra restaurada com sucesso.')
  }

  const handleExcluirPermanente = async (id: string) => {
    if (confirm('Atenção: A exclusão permanente não pode ser desfeita. Confirmar?')) {
      await onDeletePermanente(id)
      onNotifyToast('Compra excluída permanentemente.')
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LANÇAMENTOS E DESPESAS</p>
          <h1>{exibindoLixeira ? 'Lixeira de Compras' : 'Histórico de Compras'}</h1>
          <p className="subheading">
            {exibindoLixeira
              ? 'Compras removidas temporariamente que podem ser recuperadas.'
              : 'Gerencie todas as despesas lançadas, filtre e acompanhe status.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setExibindoLixeira(!exibindoLixeira)
              setPagina(1)
            }}
            className={exibindoLixeira ? 'button-primary' : 'button-secondary'}
            style={{ gap: '6px' }}
          >
            <Trash2 size={15} />
            {exibindoLixeira ? 'Voltar para Ativas' : `Lixeira (${comprasDeletadas.length})`}
          </button>

          {!exibindoLixeira && (
            <button onClick={onNovaCompra} className="button-primary" style={{ gap: '6px' }}>
              <Plus size={16} /> Nova compra
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="panel" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr', gap: '10px' }}>
          {/* Busca */}
          <div className="search-box">
            <Search size={15} />
            <input
              placeholder="Buscar por descrição..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setPagina(1)
              }}
            />
          </div>

          {/* Filtro Cartão */}
          <select
            value={filtroCartao}
            onChange={(e) => {
              setFiltroCartao(e.target.value)
              setPagina(1)
            }}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '12px',
            }}
          >
            <option value="todos">Todos os cartões</option>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          {/* Filtro Categoria */}
          <select
            value={filtroCategoria}
            onChange={(e) => {
              setFiltroCategoria(e.target.value)
              setPagina(1)
            }}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '12px',
            }}
          >
            <option value="todas">Todas categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          {/* Filtro Pessoa */}
          <select
            value={filtroPessoa}
            onChange={(e) => {
              setFiltroPessoa(e.target.value)
              setPagina(1)
            }}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '12px',
            }}
          >
            <option value="todas">Todas as pessoas</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          {/* Ordenação */}
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as any)}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '12px',
            }}
          >
            <option value="data_desc">Data (mais recentes)</option>
            <option value="data_asc">Data (mais antigas)</option>
            <option value="valor_desc">Valor (maior primeiro)</option>
            <option value="valor_asc">Valor (menor primeiro)</option>
          </select>
        </div>
      </div>

      {/* Tabela de Compras */}
      <div className="panel data-panel">
        <div className="data-table">
          <div
            className="data-head"
            style={{
              gridTemplateColumns: '1.8fr 1fr 0.9fr 0.9fr 1.2fr 1.2fr 1.1fr 0.8fr',
            }}
          >
            <span>Descrição / Data</span>
            <span>Cartão</span>
            <span>Categoria</span>
            <span>Parcelas</span>
            <span>Divisão (Pessoas)</span>
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Valor Parcela</span>
            <span>Valor Total</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>

          {comprasPaginadas.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <p style={{ margin: 0, fontSize: '14px' }}>Nenhuma compra encontrada com os filtros selecionados.</p>
            </div>
          ) : (
            comprasPaginadas.map((compra) => {
              const cartao = cartoes.find((c) => c.id === compra.cartao_id)
              const categoria = categorias.find((c) => c.id === compra.categoria_id)
              const divisores = (compra.pessoas_compras || [])
                .map((pc) => pessoas.find((p) => p.id === pc.pessoa_id)?.nome)
                .filter(Boolean)
                .join(', ')

              const isFixa = isCompraFixa(compra, categoria)
              const parcelasPagas = (compra.parcelas || []).filter((p) => p.paga).length
              const totalParcelas = compra.parcelas_totais
              const infoParcela = getInfoParcelaMesAtual(compra.parcelas || [], new Date(), isFixa, compra.encerrada_em)

              return (
                <div
                  key={compra.id}
                  className="data-row"
                  style={{
                    gridTemplateColumns: '1.8fr 1fr 0.9fr 0.9fr 1.2fr 1.2fr 1.1fr 0.8fr',
                  }}
                >
                  <div>
                    <strong>{compra.descricao}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>
                      {formatDateBR(compra.data_compra)}
                    </span>
                  </div>

                  <span>{cartao?.nome || '—'}</span>

                  <span>{categoria?.nome || 'Outros'}</span>

                  <div>
                    {isFixa ? (
                      <>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: compra.encerrada_em ? 'var(--muted)' : '#06b6d4',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Repeat size={13} /> {compra.encerrada_em ? 'Encerrada' : 'Fixa'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>
                          {compra.encerrada_em ? `Encerrada em ${formatDateBR(compra.encerrada_em)}` : 'Assinatura mensal'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: infoParcela.numeroParcelaAtual ? 'var(--lime)' : 'var(--foreground)',
                          }}
                        >
                          {infoParcela.statusTexto}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>
                          {parcelasPagas} de {totalParcelas} pagas
                        </span>
                      </>
                    )}
                  </div>

                  <span style={{ fontSize: '11px' }}>{divisores || 'Eu'}</span>

                  {/* COLUNA: VALOR DA PARCELA EM VERDE NEON */}
                  <div>
                    <strong
                      style={{
                        fontSize: '13px',
                        fontWeight: 650,
                        color: 'var(--lime)',
                        display: 'block',
                      }}
                    >
                      {formatCurrency(compra.parcelas?.[0]?.valor || compra.valor_integral / (compra.parcelas_totais || 1))}
                    </strong>
                  </div>

                  {/* VALOR TOTAL */}
                  <span style={{ fontSize: '13px', color: 'var(--muted)'}}>{formatCurrency(compra.valor_integral)}</span>

                  {/* Botões de Ação */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    {exibindoLixeira ? (
                      <>
                        <button
                          onClick={() => handleRestaurar(compra.id)}
                          className="icon-button"
                          title="Restaurar compra"
                        >
                          <RotateCcw size={16} color="#10b981" />
                        </button>
                        <button
                          onClick={() => handleExcluirPermanente(compra.id)}
                          className="icon-button"
                          title="Excluir permanentemente"
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </button>
                      </>
                    ) : (
                      <>
                        {isFixa && (
                          compra.encerrada_em ? (
                            <button
                              onClick={() => onReativarAssinatura?.(compra.id)}
                              className="icon-button"
                              title="Reativar assinatura (retomar cobrança mensal)"
                            >
                              <PlayCircle size={15} color="#06b6d4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onEncerrarAssinatura?.(compra.id)}
                              className="icon-button"
                              title="Encerrar assinatura (interrompe cobranças futuras)"
                            >
                              <Ban size={15} color="#f59e0b" />
                            </button>
                          )
                        )}
                        <button
                          onClick={() => onEditarCompra(compra)}
                          className="icon-button"
                          title="Editar compra"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleExcluir(compra.id)}
                          className="icon-button"
                          title="Mover para lixeira"
                        >
                          <Trash2 size={15} color="#ef4444" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            <span>
              Página {pagina} de {totalPaginas} ({comprasFiltradas.length} total)
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
                className="icon-button"
                style={{ opacity: pagina === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={pagina === totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="icon-button"
                style={{ opacity: pagina === totalPaginas ? 0.4 : 1 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
