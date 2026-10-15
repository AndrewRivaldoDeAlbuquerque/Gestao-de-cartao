'use client'

import { useState, useMemo } from 'react'
import { Compra, Cartao, Categoria, Pessoa } from '@/lib/types'
import { formatCurrency } from '@/lib/finance-utils'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  LayoutDashboard,
  Filter,
  CreditCard,
  PieChart as PieIcon,
  TrendingUp,
  Users,
  Calendar,
  AlertCircle,
} from 'lucide-react'

interface DashboardViewProps {
  compras: Compra[]
  cartoes: Cartao[]
  categorias: Categoria[]
  pessoas: Pessoa[]
  onSelectPessoa?: (pessoa: Pessoa) => void
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function DashboardView({
  compras,
  cartoes,
  categorias,
  pessoas,
  onSelectPessoa,
}: DashboardViewProps) {
  // Filtros globais
  const [periodoFiltro, setPeriodoFiltro] = useState<'12m' | '6m' | '3m'>('12m')
  const [cartaoFiltro, setCartaoFiltro] = useState<string>('todos')
  const [pessoaFiltro, setPessoaFiltro] = useState<string>('todas')

  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1 // 1 a 12

  // Filtragem básica das compras (ignora soft deleted)
  const comprasValidas = useMemo(() => {
    return compras.filter((c) => {
      if (c.deletado_em) return false
      if (cartaoFiltro !== 'todos' && c.cartao_id !== cartaoFiltro) return false
      if (pessoaFiltro !== 'todas') {
        const temPessoa = (c.pessoas_compras || []).some((pc) => pc.pessoa_id === pessoaFiltro)
        if (!temPessoa) return false
      }
      return true
    })
  }, [compras, cartaoFiltro, pessoaFiltro])

  // ==========================================
  // 1. GASTOS POR MÊS E EVOLUÇÃO (ÚLTIMOS 12 MESES)
  // ==========================================
  const mesesHistorico = useMemo(() => {
    const totalMeses = periodoFiltro === '3m' ? 3 : periodoFiltro === '6m' ? 6 : 12
    const listaMeses: Array<{ chave: string; label: string; valor: number }> = []

    for (let i = totalMeses - 1; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - 1 - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const chave = `${y}-${String(m).padStart(2, '0')}`
      const label = `${MESES_ABREV[m - 1]}/${String(y).slice(2)}`
      listaMeses.push({ chave, label, valor: 0 })
    }

    comprasValidas.forEach((c) => {
      const divisaoPessoa = pessoaFiltro !== 'todas'
        ? (c.pessoas_compras || []).find((pc) => pc.pessoa_id === pessoaFiltro)
        : null

      const proporcao = divisaoPessoa && c.valor_integral > 0
        ? divisaoPessoa.valor / c.valor_integral
        : 1

      ;(c.parcelas || []).forEach((p) => {
        const itemMes = listaMeses.find((item) => p.data_vencimento.startsWith(item.chave))
        if (itemMes) {
          itemMes.valor += p.valor * proporcao
        }
      })
    })

    return listaMeses
  }, [comprasValidas, anoAtual, mesAtual, periodoFiltro, pessoaFiltro])

  // ==========================================
  // 2. GASTOS POR CATEGORIA (DONUT)
  // ==========================================
  const gastosPorCategoria = useMemo(() => {
    const mapa: Record<string, { name: string; value: number; color: string }> = {}

    comprasValidas.forEach((c) => {
      const cat = categorias.find((cat) => cat.id === c.categoria_id)
      const catNome = cat?.nome || 'Outros'
      const catCor = cat?.cor || '#64748b'

      const divisaoPessoa = pessoaFiltro !== 'todas'
        ? (c.pessoas_compras || []).find((pc) => pc.pessoa_id === pessoaFiltro)
        : null

      const valorEfetivo = divisaoPessoa ? divisaoPessoa.valor : c.valor_integral

      if (!mapa[catNome]) {
        mapa[catNome] = { name: catNome, value: 0, color: catCor }
      }
      mapa[catNome].value += valorEfetivo
    })

    return Object.values(mapa).filter((c) => c.value > 0)
  }, [comprasValidas, categorias, pessoaFiltro])

  // ==========================================
  // 3. POR PESSOA (BARRAS EMPILHADAS POR MÊS)
  // ==========================================
  const gastosPorPessoaMensal = useMemo(() => {
    const totalMeses = 6 // Últimos 6 meses para visualização despoluída
    const listaMeses: Array<Record<string, any>> = []

    for (let i = totalMeses - 1; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - 1 - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const chave = `${y}-${String(m).padStart(2, '0')}`
      const mesObj: Record<string, any> = {
        label: `${MESES_ABREV[m - 1]}/${String(y).slice(2)}`,
        chave,
      }
      pessoas.forEach((p) => {
        mesObj[p.nome] = 0
      })
      listaMeses.push(mesObj)
    }

    comprasValidas.forEach((c) => {
      const divisores = c.pessoas_compras || []
      const compraTotal = c.valor_integral || 1

      ;(c.parcelas || []).forEach((p) => {
        const itemMes = listaMeses.find((item) => p.data_vencimento.startsWith(item.chave))
        if (!itemMes) return

        const proporcao = p.valor / compraTotal
        divisores.forEach((d) => {
          const pessoaObj = pessoas.find((pes) => pes.id === d.pessoa_id)
          if (pessoaObj && itemMes[pessoaObj.nome] !== undefined) {
            itemMes[pessoaObj.nome] += d.valor * proporcao
          }
        })
      })
    })

    return listaMeses
  }, [comprasValidas, anoAtual, mesAtual, pessoas])

  // ==========================================
  // 4. POR CARTÃO COM USO DO LIMITE
  // ==========================================
  const usoCartoes = useMemo(() => {
    return cartoes.map((cartao) => {
      // Soma todas as parcelas não pagas deste cartão
      let totalComprometido = 0
      compras
        .filter((c) => !c.deletado_em && c.cartao_id === cartao.id)
        .forEach((c) => {
          ;(c.parcelas || []).forEach((p) => {
            if (!p.paga) {
              totalComprometido += p.valor
            }
          })
        })

      const limite = cartao.limite || 0
      const percentual = limite > 0 ? Math.min(100, Math.round((totalComprometido / limite) * 100)) : 0
      const disponivel = Math.max(0, limite - totalComprometido)

      return {
        cartao,
        totalComprometido,
        limite,
        disponivel,
        percentual,
      }
    })
  }, [cartoes, compras])

  // ==========================================
  // 5. PROJEÇÃO DE PARCELAS (PRÓXIMOS 12 MESES)
  // ==========================================
  const projecaoFutura = useMemo(() => {
    const listaFutura: Array<{ chave: string; label: string; valor: number }> = []

    for (let i = 0; i < 12; i++) {
      const d = new Date(anoAtual, mesAtual - 1 + i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const chave = `${y}-${String(m).padStart(2, '0')}`
      const label = `${MESES_ABREV[m - 1]}/${String(y).slice(2)}`
      listaFutura.push({ chave, label, valor: 0 })
    }

    comprasValidas.forEach((c) => {
      const divisaoPessoa = pessoaFiltro !== 'todas'
        ? (c.pessoas_compras || []).find((pc) => pc.pessoa_id === pessoaFiltro)
        : null

      const proporcao = divisaoPessoa && c.valor_integral > 0
        ? divisaoPessoa.valor / c.valor_integral
        : 1

      ;(c.parcelas || []).forEach((p) => {
        const itemMes = listaFutura.find((item) => p.data_vencimento.startsWith(item.chave))
        if (itemMes) {
          itemMes.valor += p.valor * proporcao
        }
      })
    })

    return listaFutura
  }, [comprasValidas, anoAtual, mesAtual, pessoaFiltro])

  return (
    <div>
      {/* Título e Filtros Globais */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">INTELIGÊNCIA FINANCEIRA</p>
          <h1>Dashboard Geral</h1>
          <p className="subheading">
            Evolução histórica, divisão por categorias, pessoas, uso do limite e compromissos futuros.
          </p>
        </div>

        {/* Filtros Globais */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Período */}
          <select
            value={periodoFiltro}
            onChange={(e) => setPeriodoFiltro(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--panel)',
              color: 'var(--foreground)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <option value="12m">Últimos 12 meses</option>
            <option value="6m">Últimos 6 meses</option>
            <option value="3m">Últimos 3 meses</option>
          </select>

          {/* Cartão */}
          <select
            value={cartaoFiltro}
            onChange={(e) => setCartaoFiltro(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--panel)',
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

          {/* Pessoa */}
          <select
            value={pessoaFiltro}
            onChange={(e) => setPessoaFiltro(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--panel)',
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
        </div>
      </div>

      {/* Grid Superior: Evolução e Categorias */}
      <div className="dashboard-grid" style={{ marginBottom: '20px' }}>
        {/* Evolução Histórica (AreaChart) */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Evolução de Gastos por Mês</h2>
              <p>Histórico consolidado de faturas ({periodoFiltro})</p>
            </div>
            <TrendingUp size={18} color="var(--lime)" />
          </div>

          <div style={{ width: '100%', height: '220px', marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mesesHistorico}>
                <defs>
                  <linearGradient id="corEvolucao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--lime)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--lime)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" fontSize={11} stroke="var(--muted)" />
                <YAxis fontSize={10} stroke="var(--muted)" tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val)), 'Total']}
                  contentStyle={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke="var(--lime)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#corEvolucao)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Gastos por Categoria (Donut) */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Gastos por Categoria</h2>
              <p>Distribuição do montante geral</p>
            </div>
            <PieIcon size={18} color="var(--teal)" />
          </div>

          {gastosPorCategoria.length === 0 ? (
            <div style={{ height: '220px', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '12px' }}>
              Nenhum gasto categorizado no filtro atual.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', height: '220px' }}>
              <div style={{ width: '150px', height: '150px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={gastosPorCategoria}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {gastosPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), 'Total']}
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

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                {gastosPorCategoria.map((c) => (
                  <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.color }} />
                      <span>{c.name}</span>
                    </div>
                    <strong>{formatCurrency(c.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>

      {/* Grid Médio: Por Pessoa (Barras Empilhadas) e Uso de Limite de Cartões */}
      <div className="dashboard-grid" style={{ marginBottom: '20px' }}>
        {/* Gastos por Pessoa (Stacked BarChart) */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Gastos por Pessoa por Mês</h2>
              <p>Evolução mensal empilhada dos últimos 6 meses</p>
            </div>
            <Users size={18} color="#3b82f6" />
          </div>

          <div style={{ width: '100%', height: '240px', marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gastosPorPessoaMensal}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" fontSize={11} stroke="var(--muted)" />
                <YAxis fontSize={10} stroke="var(--muted)" tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(val: any, name: any) => [formatCurrency(Number(val)), name]}
                  contentStyle={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {pessoas.map((p) => (
                  <Bar key={p.id} dataKey={p.nome} stackId="a" fill={p.cor} radius={[0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Uso de Limite por Cartão */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Uso do Limite por Cartão</h2>
              <p>Comprometimento atual com parcelas em aberto</p>
            </div>
            <CreditCard size={18} color="#8b5cf6" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            {usoCartoes.length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Nenhum cartão cadastrado.</span>
            ) : (
              usoCartoes.map(({ cartao, totalComprometido, limite, disponivel, percentual }) => (
                <div
                  key={cartao.id}
                  style={{
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    background: 'var(--background)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: cartao.cor }} />
                      <strong style={{ fontSize: '13px' }}>{cartao.nome}</strong>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: percentual > 80 ? '#ef4444' : percentual > 50 ? '#f59e0b' : 'var(--lime)' }}>
                      {percentual}% do limite
                    </span>
                  </div>

                  {/* Barra de progresso */}
                  <div
                    style={{
                      height: '7px',
                      background: 'color-mix(in srgb, var(--border) 60%, transparent)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginBottom: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: `${percentual}%`,
                        height: '100%',
                        background: percentual > 80 ? '#ef4444' : percentual > 50 ? '#f59e0b' : cartao.cor,
                        borderRadius: '4px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted)' }}>
                    <span>Comprometido: <b>{formatCurrency(totalComprometido)}</b></span>
                    <span>Disponível: <b>{limite > 0 ? formatCurrency(disponivel) : 'Sem limite'}</b></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      {/* Grid Inferior: Projeção de Parcelas nos Próximos 12 Meses */}
      <article className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <h2>Projeção das Parcelas dos Próximos 12 Meses</h2>
            <p>Compromissos futuros já lançados para planejamento de fluxo de caixa</p>
          </div>
          <Calendar size={18} color="var(--orange)" />
        </div>

        <div style={{ width: '100%', height: '240px', marginTop: '16px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projecaoFutura}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" fontSize={11} stroke="var(--muted)" />
              <YAxis fontSize={10} stroke="var(--muted)" tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Fatura Futura']}
                contentStyle={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="valor" fill="var(--teal)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  )
}
