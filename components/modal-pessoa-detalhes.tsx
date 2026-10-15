'use client'

import { useState, useMemo } from 'react'
import { Pessoa, Compra, Cartao } from '@/lib/types'
import { formatCurrency, formatDateBR, calcularStatusParcela, getStatusBadgeInfo } from '@/lib/finance-utils'
import {
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Receipt,
  CreditCard,
  ShoppingBag,
  Clock,
  Printer,
} from 'lucide-react'
import { ItemAcertoPessoa, imprimirAcertoPessoa } from './modal-fechar-acerto-pessoa'

interface ModalPessoaDetalhesProps {
  isOpen: boolean
  onClose: () => void
  pessoa: Pessoa | null
  compras: Compra[]
  cartoes: Cartao[]
  onNotifyToast?: (msg: string) => void
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export function ModalPessoaDetalhes({
  isOpen,
  onClose,
  pessoa,
  compras,
  cartoes,
  onNotifyToast,
}: ModalPessoaDetalhesProps) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1) // 1 a 12

  const mesAnoFormatado = `${ano}-${String(mes).padStart(2, '0')}`
  const mesNomeAno = `${MESES[mes - 1]} de ${ano}`

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

  const handleMesAtual = () => {
    setMes(hoje.getMonth() + 1)
    setAno(hoje.getFullYear())
  }

  // Compras ativas que envolvem esta pessoa
  const comprasDaPessoa = useMemo(() => {
    if (!pessoa) return []
    return compras.filter((c) => {
      if (c.deletado_em) return false
      return (c.pessoas_compras || []).some((pc) => pc.pessoa_id === pessoa.id)
    })
  }, [compras, pessoa])

  // Lançamentos/Parcelas da pessoa no mês selecionado
  const lancamentosDoMes = useMemo(() => {
    if (!pessoa) return []
    const itens: Array<{
      compra: Compra
      numeroParcela: number
      totalParcelas: number
      vencimento: string
      valorPessoa: number
      paga: boolean
      cartao?: Cartao
      status: ReturnType<typeof calcularStatusParcela>
    }> = []

    comprasDaPessoa.forEach((compra) => {
      const divisao = (compra.pessoas_compras || []).find((pc) => pc.pessoa_id === pessoa.id)
      if (!divisao) return

      const cartao = cartoes.find((c) => c.id === compra.cartao_id)
      const proporcao = compra.valor_integral > 0 ? divisao.valor / compra.valor_integral : 1

      ;(compra.parcelas || []).forEach((p) => {
        if (p.data_vencimento.startsWith(mesAnoFormatado)) {
          const valorDaPessoaNaParcela = p.valor * proporcao
          const status = calcularStatusParcela(p, compra.parcelas_totais)
          itens.push({
            compra,
            numeroParcela: p.numero_parcela,
            totalParcelas: compra.parcelas_totais,
            vencimento: p.data_vencimento,
            valorPessoa: valorDaPessoaNaParcela,
            paga: p.paga,
            cartao,
            status,
          })
        }
      })
    })

    return itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  }, [comprasDaPessoa, pessoa, cartoes, mesAnoFormatado])

  // Total do mês
  const totalMes = useMemo(() => {
    return lancamentosDoMes.reduce((acc, item) => acc + item.valorPessoa, 0)
  }, [lancamentosDoMes])

  // Total acumulado em todos os meses
  const totalAcumuladoGeral = useMemo(() => {
    if (!pessoa) return 0
    return comprasDaPessoa.reduce((acc, compra) => {
      const divisao = (compra.pessoas_compras || []).find((pc) => pc.pessoa_id === pessoa.id)
      return acc + (divisao ? divisao.valor : 0)
    }, 0)
  }, [comprasDaPessoa, pessoa])

  // Itens formatados para o fechamento de acerto
  const itensParaAcerto: ItemAcertoPessoa[] = useMemo(() => {
    return lancamentosDoMes.map((item) => {
      const badge = getStatusBadgeInfo(item.status)
      return {
        compraId: item.compra.id,
        descricao: item.compra.descricao,
        numeroParcela: item.numeroParcela,
        totalParcelas: item.totalParcelas,
        cartaoNome: item.cartao?.nome || 'Cartão',
        vencimento: item.vencimento,
        valor: item.valorPessoa,
        paga: item.paga,
        statusLabel: badge.label,
        statusColor: badge.color,
        statusBg: badge.bg,
      }
    })
  }, [lancamentosDoMes])

  // Renderização condicional APÓS todos os hooks
  if (!isOpen || !pessoa) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: pessoa.cor,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: '16px',
              }}
            >
              {pessoa.nome.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{pessoa.nome}</h2>
                <span
                  className="status-tag"
                  style={{
                    background: pessoa.ativo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    color: pessoa.ativo ? '#10b981' : '#64748b',
                    fontSize: '10px',
                  }}
                >
                  {pessoa.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {pessoa.contato || 'Sem contato cadastrado'}
              </span>
            </div>
          </div>

          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Seletor de Mês/Ano */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '8px 12px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={handleMesAnterior} className="icon-button" title="Mês anterior">
              <ChevronLeft size={16} />
            </button>
            <strong style={{ fontSize: '14px', minWidth: '140px', textAlign: 'center' }}>
              {mesNomeAno}
            </strong>
            <button onClick={handleProximoMes} className="icon-button" title="Próximo mês">
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleMesAtual}
              className="button-secondary"
              style={{ fontSize: '11px', padding: '5px 10px' }}
            >
              Mês atual
            </button>
            <button
              onClick={() => imprimirAcertoPessoa(pessoa, mesNomeAno, itensParaAcerto, totalMes)}
              className="button-primary"
              style={{ fontSize: '11px', padding: '5px 10px', gap: '5px' }}
              disabled={lancamentosDoMes.length === 0}
              title="Gerar PDF com o resumo e detalhamento de compras deste mês"
            >
              <Printer size={14} /> PDF
            </button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(200, 241, 105, 0.12), rgba(115, 212, 202, 0.08))',
              border: '1px solid rgba(200, 241, 105, 0.25)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
              Total em {MESES[mes - 1].slice(0, 3)}/{ano}
            </span>
            <strong style={{ fontSize: '22px', color: 'var(--lime)', display: 'block', margin: '4px 0' }}>
              {formatCurrency(totalMes)}
            </strong>
            <small style={{ fontSize: '10px', color: 'var(--muted)' }}>
              {lancamentosDoMes.length} parcela(s) no período
            </small>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
              Total Acumulado Geral
            </span>
            <strong style={{ fontSize: '22px', display: 'block', margin: '4px 0' }}>
              {formatCurrency(totalAcumuladoGeral)}
            </strong>
            <small style={{ fontSize: '10px', color: 'var(--muted)' }}>
              Em {comprasDaPessoa.length} compras vinculadas
            </small>
          </div>
        </div>

        {/* Lista de Compras do Mês */}
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '10px' }}>
            Lançamentos de {pessoa.nome} em {mesNomeAno}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {lancamentosDoMes.length === 0 ? (
              <div
                style={{
                  padding: '30px',
                  textAlign: 'center',
                  background: 'var(--background)',
                  borderRadius: '10px',
                  border: '1px dashed var(--border)',
                  color: 'var(--muted)',
                  fontSize: '12px',
                }}
              >
                Nenhum lançamento ou parcela para {pessoa.nome} neste mês.
              </div>
            ) : (
              lancamentosDoMes.map((item, idx) => {
                const badge = getStatusBadgeInfo(item.status)

                return (
                  <div
                    key={`${item.compra.id}-${item.numeroParcela}-${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '13px', display: 'block' }}>
                        {item.compra.descricao}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', fontSize: '11px', color: 'var(--muted)' }}>
                        <span>
                          Parcela {item.numeroParcela}/{item.totalParcelas}
                        </span>
                        <span>·</span>
                        <span>{item.cartao?.nome || 'Cartão'}</span>
                        <span>·</span>
                        <span>Venc.: {formatDateBR(item.vencimento)}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '14px', display: 'block' }}>
                        {formatCurrency(item.valorPessoa)}
                      </strong>
                      <span
                        className="status-tag"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          marginTop: '4px',
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Rodapé com Fechar e PDF */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            {lancamentosDoMes.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Total do mês: <strong style={{ color: 'var(--lime)', fontSize: '13px' }}>{formatCurrency(totalMes)}</strong>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="button-primary"
              style={{ gap: '6px' }}
              disabled={lancamentosDoMes.length === 0}
              onClick={() => imprimirAcertoPessoa(pessoa, mesNomeAno, itensParaAcerto, totalMes)}
              title="Gerar PDF com o resumo das compras do mês"
            >
              <Printer size={16} /> PDF
            </button>
            <button type="button" className="button-secondary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
