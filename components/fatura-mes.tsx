'use client'

import { useState, useMemo } from 'react'
import { Compra, Cartao, Categoria, Pessoa, Parcela } from '@/lib/types'
import {
  formatCurrency,
  formatDateBR,
  calcularStatusParcela,
  getStatusBadgeInfo,
  exportarFaturaCSV,
  isCompraFixa,
  getTodayString,
} from '@/lib/finance-utils'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  Receipt,
  CheckCircle2,
  Circle,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Filter,
  CheckCheck,
  Repeat,
} from 'lucide-react'
import { ModalFecharAcerto } from './modal-fechar-acerto'

interface FaturaMesProps {
  compras: Compra[]
  cartoes: Cartao[]
  categorias: Categoria[]
  pessoas: Pessoa[]
  onTogglePaga: (parcelaId: string, paga: boolean) => Promise<void>
  onMarcarLotePagas: (parcelaIds: string[], paga: boolean) => Promise<void>
  onNotifyToast: (msg: string) => void
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export function FaturaMes({
  compras,
  cartoes,
  categorias,
  pessoas,
  onTogglePaga,
  onMarcarLotePagas,
  onNotifyToast,
}: FaturaMesProps) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1) // 1 a 12
  const [cartaoFiltro, setCartaoFiltro] = useState<string>('todos')
  const [modalAcertoOpen, setModalAcertoOpen] = useState(false)
  const [selecionadas, setSelecionadas] = useState<string[]>([])

  const mesAnoFormatado = `${String(mes).padStart(2, '0')}/${ano}`
  const mesNomeAno = `${MESES[mes - 1]} de ${ano}`

  // Navegação entre meses
  const handleMesAnterior = () => {
    if (mes === 1) {
      setMes(12)
      setAno((a) => a - 1)
    } else {
      setMes((m) => m - 1)
    }
  }

  const handleProximoMes = () => {
    if (mes === 12) {
      setMes(1)
      setAno((a) => a + 1)
    } else {
      setMes((m) => m + 1)
    }
  }

  // Coleta todas as parcelas pertencentes a este mês/ano
  const parcelasDoMes = useMemo(() => {
    const prefixo = `${ano}-${String(mes).padStart(2, '0')}`
    const itens: Array<{
      parcela: Parcela
      compra: Compra
      cartao?: Cartao
      categoria?: Categoria
      status: ReturnType<typeof calcularStatusParcela>
      isFixa: boolean
    }> = []

    compras.forEach((c) => {
      if (cartaoFiltro !== 'todos' && c.cartao_id !== cartaoFiltro) return

      const cartao = cartoes.find((card) => card.id === c.cartao_id)
      const categoria = categorias.find((cat) => cat.id === c.categoria_id)

      ;(c.parcelas || []).forEach((p) => {
        if (p.data_vencimento.startsWith(prefixo)) {
          const isFixa = isCompraFixa(c, categoria)
          const status = calcularStatusParcela(p, c.parcelas_totais, getTodayString(), isFixa)
          itens.push({
            parcela: p,
            compra: c,
            cartao,
            categoria,
            status,
            isFixa,
          })
        }
      })
    })

    return itens.sort((a, b) => a.parcela.data_vencimento.localeCompare(b.parcela.data_vencimento))
  }, [compras, cartoes, categorias, ano, mes, cartaoFiltro])

  // Cálculos de totais
  const totalGeral = useMemo(() => {
    return parcelasDoMes.reduce((acc, item) => acc + item.parcela.valor, 0)
  }, [parcelasDoMes])

  const totalPago = useMemo(() => {
    return parcelasDoMes.filter((item) => item.parcela.paga).reduce((acc, item) => acc + item.parcela.valor, 0)
  }, [parcelasDoMes])

  const totalEmAberto = totalGeral - totalPago

  // Totais por pessoa neste mês
  const totaisPorPessoa = useMemo(() => {
    const mapa: Record<string, { nome: string; cor: string; contato?: string | null; valor: number; count: number }> = {}

    pessoas.forEach((p) => {
      mapa[p.id] = { nome: p.nome, cor: p.cor, contato: p.contato, valor: 0, count: 0 }
    })

    parcelasDoMes.forEach(({ parcela, compra }) => {
      const divisores = compra.pessoas_compras || []
      if (divisores.length === 0) return

      const compraTotal = compra.valor_integral || 1
      const proporcaoParcela = parcela.valor / compraTotal

      divisores.forEach((d) => {
        if (mapa[d.pessoa_id]) {
          mapa[d.pessoa_id].valor += d.valor * proporcaoParcela
          mapa[d.pessoa_id].count += 1
        }
      })
    })

    return Object.entries(mapa)
      .map(([id, val]) => ({ id, ...val, totalDevido: val.valor, comprasCount: val.count }))
      .filter((p) => p.valor > 0)
  }, [parcelasDoMes, pessoas])

  // Dados para gráfico Recharts (por categoria)
  const chartData = useMemo(() => {
    const mapa: Record<string, { name: string; value: number; color: string }> = {}

    parcelasDoMes.forEach((item) => {
      const catNome = item.categoria?.nome || 'Outros'
      const catCor = item.categoria?.cor || '#64748b'
      if (!mapa[catNome]) {
        mapa[catNome] = { name: catNome, value: 0, color: catCor }
      }
      mapa[catNome].value += item.parcela.valor
    })

    return Object.values(mapa)
  }, [parcelasDoMes])

  // Ações em lote
  const handleToggleSelecao = (id: string) => {
    setSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleSelecionarTodas = () => {
    if (selecionadas.length === parcelasDoMes.length) {
      setSelecionadas([])
    } else {
      setSelecionadas(parcelasDoMes.map((p) => p.parcela.id))
    }
  }

  const handleMarcarSelecionadasComoPagas = async () => {
    if (selecionadas.length === 0) return
    await onMarcarLotePagas(selecionadas, true)
    setSelecionadas([])
    onNotifyToast(`${selecionadas.length} parcelas marcadas como pagas!`)
  }

  const handleExportarCSV = () => {
    const linhas = parcelasDoMes.map((item) => {
      const nomesPessoas = (item.compra.pessoas_compras || [])
        .map((pc) => pessoas.find((p) => p.id === pc.pessoa_id)?.nome)
        .filter(Boolean)
        .join(', ')

      const badge = getStatusBadgeInfo(item.status)

      return {
        descricao: item.compra.descricao,
        cartao: item.cartao?.nome || 'Sem cartão',
        categoria: item.categoria?.nome || 'Geral',
        parcela: `${item.parcela.numero_parcela}/${item.compra.parcelas_totais}`,
        vencimento: item.parcela.data_vencimento,
        pessoas: nomesPessoas || 'Eu',
        valor: item.parcela.valor,
        status: badge.label,
      }
    })

    exportarFaturaCSV(mesAnoFormatado, linhas)
    onNotifyToast('Relatório CSV baixado com sucesso!')
  }

  return (
    <>
      {/* Cabeçalho da Fatura com Seletor de Período e Exportações */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONTROLE DE FATURAS</p>
          <h1>Fatura de {mesNomeAno}</h1>
          <p className="subheading">
            Consolidação mensal com marcação de pagamentos e divisão por pessoa.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Seletor Mês/Ano */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--panel)',
              padding: '2px',
            }}
          >
            <button
              onClick={handleMesAnterior}
              className="icon-button"
              title="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '13px', fontWeight: 600, padding: '0 8px' }}>
              {MESES[mes - 1].slice(0, 3)}/{ano}
            </span>
            <button
              onClick={handleProximoMes}
              className="icon-button"
              title="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => setModalAcertoOpen(true)}
            className="button-primary"
            style={{ gap: '6px' }}
          >
            <Calculator size={16} /> Fechar acerto
          </button>

          <button
            onClick={handleExportarCSV}
            className="button-secondary"
            title="Exportar CSV"
          >
            <FileSpreadsheet size={16} /> CSV
          </button>

          <button
            onClick={() => window.print()}
            className="button-secondary"
            title="Exportar PDF"
          >
            <Printer size={16} /> PDF
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <span>Total da fatura</span>
            <Receipt size={17} />
          </div>
          <strong>{formatCurrency(totalGeral)}</strong>
          <small>{parcelasDoMes.length} lançamentos neste mês</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>Total pago</span>
            <CheckCircle2 size={17} color="#10b981" />
          </div>
          <strong style={{ color: '#10b981' }}>{formatCurrency(totalPago)}</strong>
          <small>
            {totalGeral > 0 ? `${((totalPago / totalGeral) * 100).toFixed(0)}% liquidado` : '0% pago'}
          </small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>Total em aberto</span>
            <Circle size={17} color="#f59e0b" />
          </div>
          <strong style={{ color: '#f59e0b' }}>{formatCurrency(totalEmAberto)}</strong>
          <small>Pendente de pagamento</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>A receber de outros</span>
            <Calculator size={17} color="#3b82f6" />
          </div>
          <strong style={{ color: '#3b82f6' }}>
            {formatCurrency(
              totaisPorPessoa
                .filter((p) => p.nome.toLowerCase() !== 'eu')
                .reduce((acc, curr) => acc + curr.totalDevido, 0)
            )}
          </strong>
          <small>
            De {totaisPorPessoa.filter((p) => p.nome.toLowerCase() !== 'eu').length} pessoas
          </small>
        </article>
      </div>

      {/* Seção com Gráfico e Divisão por Pessoa */}
      <div className="dashboard-grid" style={{ marginBottom: '22px' }}>
        {/* Painel de Categorias (Recharts) */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Distribuição por Categoria</h2>
              <p>Valores das compras deste mês por segmento</p>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div style={{ height: '180px', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '12px' }}>
              Nenhuma despesa para exibir no gráfico neste período.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minHeight: '180px' }}>
              <div style={{ width: '160px', height: '160px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), 'Valor']}
                      contentStyle={{
                        background: 'var(--panel)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {chartData.map((c) => (
                  <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color }} />
                      <span>{c.name}</span>
                    </div>
                    <strong>{formatCurrency(c.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Resumo por Pessoa */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Gastos por Pessoa no Mês</h2>
              <p>Participação de cada um no fechamento</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            {totaisPorPessoa.length === 0 ? (
              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Nenhum lançamento no mês.</span>
            ) : (
              totaisPorPessoa.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    background: 'var(--background)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.cor }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{p.nome}</span>
                  </div>
                  <strong style={{ fontSize: '13px' }}>{formatCurrency(p.valor)}</strong>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      {/* Toolbar da Tabela: Filtros de Cartão e Ações em Lote */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        {/* Filtro por cartão */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setCartaoFiltro('todos')}
            className={`filter-chip ${cartaoFiltro === 'todos' ? 'active' : ''}`}
          >
            Todos os cartões
          </button>
          {cartoes.map((card) => (
            <button
              key={card.id}
              onClick={() => setCartaoFiltro(card.id)}
              className={`filter-chip ${cartaoFiltro === card.id ? 'active' : ''}`}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: card.cor, display: 'inline-block', marginRight: '6px' }} />
              {card.nome}
            </button>
          ))}
        </div>

        {/* Ação em lote */}
        {selecionadas.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {selecionadas.length} selecionadas
            </span>
            <button
              onClick={handleMarcarSelecionadasComoPagas}
              className="button-primary"
              style={{ fontSize: '11px', padding: '6px 10px', gap: '4px' }}
            >
              <CheckCheck size={14} /> Marcar como pagas
            </button>
          </div>
        )}
      </div>

      {/* Tabela de Lançamentos do Mês */}
      <div className="panel data-panel">
        <div className="data-table">
          <div
            className="data-head"
            style={{
              gridTemplateColumns: '36px 2.2fr 1.2fr 1fr 1fr 1.4fr 1.1fr 1.3fr',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="checkbox"
                checked={selecionadas.length > 0 && selecionadas.length === parcelasDoMes.length}
                onChange={handleSelecionarTodas}
                style={{ cursor: 'pointer', accentColor: 'var(--lime)' }}
                title="Selecionar todas"
              />
            </div>
            <span>Descrição</span>
            <span>Cartão</span>
            <span>Categoria</span>
            <span>Parcela</span>
            <span>Pessoas</span>
            <span>Valor</span>
            <span>Status / Ação</span>
          </div>

          {parcelasDoMes.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <p style={{ margin: 0, fontSize: '14px' }}>Nenhum lançamento encontrado nesta fatura.</p>
              <span style={{ fontSize: '12px' }}>Clique em "+ Nova compra" para adicionar despesas.</span>
            </div>
          ) : (
            parcelasDoMes.map(({ parcela, compra, cartao, categoria, status, isFixa }) => {
              const badge = getStatusBadgeInfo(status)
              const nomesPessoas = (compra.pessoas_compras || [])
                .map((pc) => pessoas.find((p) => p.id === pc.pessoa_id)?.nome)
                .filter(Boolean)
                .join(', ')

              const isChecked = selecionadas.includes(parcela.id)

              return (
                <div
                  key={parcela.id}
                  className="data-row"
                  style={{
                    gridTemplateColumns: '36px 2.2fr 1.2fr 1fr 1fr 1.4fr 1.1fr 1.3fr',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelecao(parcela.id)}
                      style={{ cursor: 'pointer', accentColor: 'var(--lime)' }}
                    />
                  </div>

                  <div>
                    <strong>{compra.descricao}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      Vence em {formatDateBR(parcela.data_vencimento)}
                    </span>
                  </div>

                  <span>{cartao?.nome || '—'}</span>

                  <span>{categoria?.nome || 'Outros'}</span>

                  <span>
                    {isFixa ? (
                      <span
                        className="status-tag"
                        style={{
                          background: 'rgba(6, 182, 212, 0.12)',
                          color: '#06b6d4',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 650,
                          padding: '3px 7px',
                          borderRadius: '6px',
                        }}
                        title="Despesa fixa recorrente (Assinatura)"
                      >
                        <Repeat size={11} /> Fixa
                      </span>
                    ) : (
                      `${parcela.numero_parcela}/${compra.parcelas_totais}`
                    )}
                  </span>

                  <span style={{ fontSize: '11px' }}>{nomesPessoas || 'Eu'}</span>

                  <strong>{formatCurrency(parcela.valor)}</strong>

                  {/* Status e Ação rápida de 1 clique */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className="status-tag"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>

                    <button
                      onClick={() => onTogglePaga(parcela.id, !parcela.paga)}
                      style={{
                        background: 'transparent',
                        border: 0,
                        cursor: 'pointer',
                        padding: '4px',
                        color: parcela.paga ? '#10b981' : 'var(--muted)',
                      }}
                      title={parcela.paga ? 'Desmarcar pagamento' : 'Marcar como paga'}
                    >
                      {parcela.paga ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal Fechar Acerto */}
      <ModalFecharAcerto
        isOpen={modalAcertoOpen}
        onClose={() => setModalAcertoOpen(false)}
        mesAnoStr={mesNomeAno}
        acertos={totaisPorPessoa}
        onNotifyToast={onNotifyToast}
      />
    </>
  )
}
