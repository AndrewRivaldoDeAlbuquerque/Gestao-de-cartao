'use client'

import { useState, useEffect, useMemo } from 'react'
import { Compra, Cartao, Categoria, Pessoa, TipoDivisao, DivisaoPessoaInput } from '@/lib/types'
import { toCents, fromCents, formatCurrency, getTodayString, calcularVencimentos, formatarMesAno } from '@/lib/finance-utils'
import { StorageService } from '@/lib/storage-service'
import { X, ShoppingBag, Plus, Trash2, AlertCircle, CheckCircle2, Sparkles, CalendarClock, Repeat } from 'lucide-react'

interface ModalCompraProps {
  isOpen: boolean
  onClose: () => void
  onSave: (
    compraData: Omit<Compra, 'id' | 'deletado_em'> & { id?: string },
    divisoes: DivisaoPessoaInput[],
    cartaoRef?: Cartao,
    autoQuitarAnteriores?: boolean
  ) => Promise<void>
  initialData?: Compra | null
  cartoes: Cartao[]
  categorias: Categoria[]
  pessoas: Pessoa[]
}

export function ModalCompra({
  isOpen,
  onClose,
  onSave,
  initialData,
  cartoes,
  categorias,
  pessoas,
}: ModalCompraProps) {
  const [descricao, setDescricao] = useState('')
  const [valorTotalStr, setValorTotalStr] = useState('')
  const [parcelasTotais, setParcelasTotais] = useState('1')
  const [dataCompra, setDataCompra] = useState(getTodayString())
  const [cartaoId, setCartaoId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [tipoDivisao, setTipoDivisao] = useState<TipoDivisao>('igualitaria')
  const [sugestaoBadge, setSugestaoBadge] = useState<string | null>(null)
  const [autoQuitarAnteriores, setAutoQuitarAnteriores] = useState(true)


  // Pessoas selecionadas para a compra e suas proporções/valores
  const [selectedPessoas, setSelectedPessoas] = useState<
    Array<{ pessoa_id: string; percentual: number; valor: number }>
  >([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Pessoas disponíveis (somente ativas se for nova compra; inclui as já selecionadas se for edição)
  const pessoasDisponiveis = useMemo(() => {
    if (!initialData) return pessoas.filter((p) => p.ativo)
    const selecionadasIds = (initialData.pessoas_compras || []).map((pc) => pc.pessoa_id)
    return pessoas.filter((p) => p.ativo || selecionadasIds.includes(p.id))
  }, [pessoas, initialData])

  // Inicialização ao abrir modal
  useEffect(() => {
    if (initialData) {
      setDescricao(initialData.descricao)
      setValorTotalStr(String(initialData.valor_integral))
      setParcelasTotais(String(initialData.parcelas_totais || 1))
      setDataCompra(initialData.data_compra || getTodayString())
      setCartaoId(initialData.cartao_id || (cartoes[0]?.id ?? ''))
      setCategoriaId(initialData.categoria_id || (categorias[0]?.id ?? ''))

      if (initialData.pessoas_compras && initialData.pessoas_compras.length > 0) {
        setTipoDivisao(initialData.pessoas_compras[0].tipo_divisao)
        setSelectedPessoas(
          initialData.pessoas_compras.map((pc) => ({
            pessoa_id: pc.pessoa_id,
            percentual: pc.percentual || 0,
            valor: pc.valor || 0,
          }))
        )
      } else {
        const eu = pessoas.find((p) => p.nome.toLowerCase() === 'eu') || pessoas[0]
        setTipoDivisao('igualitaria')
        setSelectedPessoas(eu ? [{ pessoa_id: eu.id, percentual: 100, valor: initialData.valor_integral }] : [])
      }
    } else {
      setDescricao('')
      setValorTotalStr('')
      setParcelasTotais('1')
      setDataCompra(getTodayString())
      setCartaoId(cartoes[0]?.id ?? '')
      setCategoriaId(categorias[0]?.id ?? '')
      setTipoDivisao('igualitaria')

      // Por padrão, seleciona a pessoa "Eu"
      const eu = pessoas.find((p) => p.nome.toLowerCase() === 'eu') || pessoas[0]
      setSelectedPessoas(eu ? [{ pessoa_id: eu.id, percentual: 100, valor: 0 }] : [])
    }
    setError('')
    setSugestaoBadge(null)
  }, [initialData, isOpen, cartoes, categorias, pessoas])

  // Sugestão de categoria aprendendo com histórico e regras
  useEffect(() => {
    if (!descricao.trim() || initialData) return
    const timer = setTimeout(async () => {
      const sugeridaId = await StorageService.sugerirCategoriaPorDescricao(descricao)
      if (sugeridaId) {
        setCategoriaId(sugeridaId)
        const catObj = categorias.find((c) => c.id === sugeridaId)
        if (catObj) {
          setSugestaoBadge(`Sugerido: ${catObj.nome}`)
        }
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [descricao, initialData, categorias])

  const valorTotalNum = useMemo(() => {
    const val = parseFloat(valorTotalStr.replace(/[^\d.,]/g, '').replace(',', '.'))
    return isNaN(val) ? 0 : val
  }, [valorTotalStr])

  const isAssinatura = useMemo(() => {
    const cat = categorias.find((c) => c.id === categoriaId)
    return cat?.nome.toLowerCase() === 'assinaturas'
  }, [categorias, categoriaId])

  // Cálculo de ciclo retroativo em tempo real
  const cicloRetroativo = useMemo(() => {
    const parcelas = parseInt(parcelasTotais, 10)
    if (isNaN(parcelas) || parcelas < 1 || !dataCompra) return null
    const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId) || cartoes[0]
    if (!cartaoSelecionado) return null

    const vencimentos = calcularVencimentos(dataCompra, cartaoSelecionado, parcelas)
    const hoje = new Date()
    const mesAnoAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

    const parcelasAnteriores = vencimentos.filter((v) => v.slice(0, 7) < mesAnoAtualStr).length
    const indexAtual = vencimentos.findIndex((v) => v.slice(0, 7) === mesAnoAtualStr)
    const parcelaMesAtual = indexAtual >= 0 ? indexAtual + 1 : null

    if (parcelasAnteriores === 0 && !parcelaMesAtual) return null

    return {
      vencimentos,
      parcelasAnteriores,
      parcelaMesAtual,
      mesCompraFormatado: formatarMesAno(dataCompra),
      mesAtualFormatado: formatarMesAno(mesAnoAtualStr),
    }
  }, [dataCompra, parcelasTotais, cartaoId, cartoes])


  // Recalcula divisões quando o valor total, tipo de divisão ou pessoas mudam
  useEffect(() => {
    if (selectedPessoas.length === 0) return

    if (tipoDivisao === 'igualitaria') {
      const count = selectedPessoas.length
      const totalCents = toCents(valorTotalNum)
      const baseCents = Math.floor(totalCents / count)
      setSelectedPessoas((prev) => {
        let acc = 0
        return prev.map((item, index) => {
          const isLast = index === count - 1
          const itemCents = isLast ? totalCents - acc : baseCents
          acc += itemCents
          return {
            ...item,
            percentual: count > 0 ? Number((100 / count).toFixed(2)) : 0,
            valor: fromCents(itemCents),
          }
        })
      })
    } else if (tipoDivisao === 'percentual') {
      setSelectedPessoas((prev) =>
        prev.map((item) => ({
          ...item,
          valor: fromCents(Math.round(toCents(valorTotalNum) * ((item.percentual || 0) / 100))),
        }))
      )
    }
  }, [valorTotalNum, tipoDivisao, selectedPessoas.length])

  // Cálculo de validação e saldo em tempo real
  const validacaoDivisao = useMemo(() => {
    if (selectedPessoas.length === 0) {
      return { valido: false, mensagem: 'Selecione pelo menos uma pessoa para a divisão.' }
    }

    if (tipoDivisao === 'igualitaria') {
      return { valido: true, mensagem: 'Divisão igualitária automática calculada com precisão de centavos.' }
    }

    if (tipoDivisao === 'percentual') {
      const somaPerc = selectedPessoas.reduce((acc, curr) => acc + (curr.percentual || 0), 0)
      const diff = Math.round((100 - somaPerc) * 100) / 100

      if (Math.abs(diff) < 0.01) {
        return { valido: true, mensagem: 'Soma dos percentuais: 100% (correto)' }
      }
      if (diff > 0) {
        return { valido: false, mensagem: `Faltam ${diff.toFixed(2)}% para completar 100%` }
      }
      return { valido: false, mensagem: `Excedeu ${Math.abs(diff).toFixed(2)}% acima de 100%` }
    }

    if (tipoDivisao === 'valor_fixo') {
      const somaValoresCents = selectedPessoas.reduce((acc, curr) => acc + toCents(curr.valor || 0), 0)
      const totalCents = toCents(valorTotalNum)
      const diffCents = totalCents - somaValoresCents

      if (diffCents === 0) {
        return { valido: true, mensagem: 'Soma dos valores confere com o total da compra.' }
      }
      if (diffCents > 0) {
        return { valido: false, mensagem: `Faltam ${formatCurrency(fromCents(diffCents))} para atingir o total` }
      }
      return { valido: false, mensagem: `Excedeu ${formatCurrency(fromCents(Math.abs(diffCents)))} acima do total` }
    }

    return { valido: true, mensagem: '' }
  }, [selectedPessoas, tipoDivisao, valorTotalNum])

  const togglePessoa = (pessoaId: string) => {
    const exists = selectedPessoas.find((p) => p.pessoa_id === pessoaId)
    if (exists) {
      if (selectedPessoas.length === 1) {
        setError('A compra deve ter pelo menos uma pessoa.')
        return
      }
      setSelectedPessoas(selectedPessoas.filter((p) => p.pessoa_id !== pessoaId))
    } else {
      setSelectedPessoas([...selectedPessoas, { pessoa_id: pessoaId, percentual: 0, valor: 0 }])
    }
  }

  const updatePercentual = (pessoaId: string, novoPerc: number) => {
    setSelectedPessoas((prev) =>
      prev.map((item) => {
        if (item.pessoa_id === pessoaId) {
          const perc = isNaN(novoPerc) ? 0 : novoPerc
          const valor = fromCents(Math.round(toCents(valorTotalNum) * (perc / 100)))
          return { ...item, percentual: perc, valor }
        }
        return item
      })
    )
  }

  const updateValorFixo = (pessoaId: string, novoValor: number) => {
    setSelectedPessoas((prev) =>
      prev.map((item) => {
        if (item.pessoa_id === pessoaId) {
          const val = isNaN(novoValor) ? 0 : novoValor
          return { ...item, valor: val }
        }
        return item
      })
    )
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!descricao.trim()) {
      setError('Por favor, informe a descrição da compra.')
      return
    }
    if (valorTotalNum <= 0) {
      setError('O valor total da compra deve ser maior que R$ 0,00.')
      return
    }
    const parcelas = parseInt(parcelasTotais, 10)
    if (isNaN(parcelas) || parcelas < 1) {
      setError('Número de parcelas deve ser no mínimo 1.')
      return
    }
    if (!validacaoDivisao.valido) {
      setError(validacaoDivisao.mensagem)
      return
    }

    const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId)

    setLoading(true)
    try {
      const divisoes: DivisaoPessoaInput[] = selectedPessoas.map((p) => ({
        pessoa_id: p.pessoa_id,
        tipo_divisao: tipoDivisao,
        percentual: tipoDivisao === 'percentual' ? p.percentual : undefined,
        valor: p.valor,
      }))

      await onSave(
        {
          id: initialData?.id,
          descricao: descricao.trim(),
          valor_integral: valorTotalNum,
          parcelas_totais: isAssinatura ? 1 : parcelas,
          data_compra: dataCompra,
          cartao_id: cartaoId || null,
          categoria_id: categoriaId || null,
          fixa: isAssinatura,
          encerrada_em: initialData?.encerrada_em || null,
        },
        divisoes,
        cartaoSelecionado,
        autoQuitarAnteriores
      )
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar compra.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--lime)',
                color: '#162217',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <ShoppingBag size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {initialData ? 'Editar Compra' : 'Nova Compra'}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Lançamento com divisão e geração automática de parcelas
              </span>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              fontSize: '12px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
              Descrição da Compra *
            </label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Supermercado Pão de Açúcar, Passagens Aéreas..."
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px',
                background: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: '13px',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
                {isAssinatura ? 'Valor Mensal (R$) *' : 'Valor Total (R$) *'}
              </label>
              <input
                type="text"
                required
                value={valorTotalStr}
                onChange={(e) => setValorTotalStr(e.target.value)}
                placeholder="R$ 0,00"
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
                {isAssinatura ? 'Tipo de Cobrança' : 'Nº de Parcelas *'}
              </label>
              {isAssinatura ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    background: 'rgba(6, 182, 212, 0.08)',
                    color: '#06b6d4',
                    fontSize: '12px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                  title="Cobrança fixa todo mês até você cancelar"
                >
                  <Repeat size={14} /> Fixa (Mensal)
                </div>
              ) : (
                <input
                  type="number"
                  min="1"
                  max="72"
                  required
                  value={parcelasTotais}
                  onChange={(e) => setParcelasTotais(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '10px',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: '13px',
                  }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
                Data da Compra *
              </label>
              <input
                type="date"
                required
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
                Cartão de Crédito
              </label>
              <select
                value={cartaoId}
                onChange={(e) => setCartaoId(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '13px',
                }}
              >
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} (Fecha dia {c.dia_fechamento} · Vence dia {c.dia_vencimento})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)' }}>
                  Categoria
                </label>
                {sugestaoBadge && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--lime)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontWeight: 600,
                    }}
                  >
                    <Sparkles size={11} /> {sugestaoBadge}
                  </span>
                )}
              </div>
              <select
                value={categoriaId}
                onChange={(e) => {
                  setCategoriaId(e.target.value)
                  setSugestaoBadge(null)
                }}

                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '13px',
                }}
              >
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Banner informativo de compra retroativa */}
          {cicloRetroativo && cicloRetroativo.parcelasAnteriores > 0 && (
            <div
              style={{
                marginTop: '2px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(200, 241, 105, 0.08)',
                border: '1px solid rgba(200, 241, 105, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CalendarClock size={16} color="var(--lime)" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--lime)' }}>
                  Compra Retroativa ({cicloRetroativo.mesCompraFormatado})
                </span>
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--foreground)', lineHeight: 1.4 }}>
                {cicloRetroativo.parcelaMesAtual ? (
                  <>
                    No mês atual (<strong>{cicloRetroativo.mesAtualFormatado}</strong>), esta despesa já está na{' '}
                    <strong style={{ color: 'var(--lime)' }}>
                      {cicloRetroativo.parcelaMesAtual}ª parcela de {parcelasTotais}
                    </strong>.
                  </>
                ) : (
                  <>As parcelas desta despesa iniciaram em faturas anteriores ao mês atual.</>
                )}
              </p>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: 'var(--foreground)',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoQuitarAnteriores}
                  onChange={(e) => setAutoQuitarAnteriores(e.target.checked)}
                  style={{ accentColor: 'var(--lime)', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>Marcar automaticamente as {cicloRetroativo.parcelasAnteriores} parcelas anteriores como pagas</span>
              </label>
            </div>
          )}

          {/* DIVISÃO ENTRE PESSOAS */}
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '14px',
              background: 'color-mix(in srgb, var(--background) 70%, transparent)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>Divisão entre Pessoas</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['igualitaria', 'percentual', 'valor_fixo'] as TipoDivisao[]).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoDivisao(tipo)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 600,
                      border: tipoDivisao === tipo ? '1px solid var(--lime)' : '1px solid var(--border)',
                      background: tipoDivisao === tipo ? 'var(--lime)' : 'transparent',
                      color: tipoDivisao === tipo ? '#142015' : 'var(--muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {tipo === 'igualitaria' ? 'Igualitária' : tipo === 'percentual' ? 'Percentual' : 'Valor Fixo'}
                  </button>
                ))}
              </div>
            </div>

            {/* Chips de seleção de pessoas */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {pessoasDisponiveis.map((p) => {
                const isSelected = selectedPessoas.some((sp) => sp.pessoa_id === p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePessoa(p.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: isSelected ? `2px solid ${p.cor}` : '1px solid var(--border)',
                      background: isSelected ? `${p.cor}22` : 'var(--panel)',
                      color: isSelected ? p.cor : 'var(--muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: p.cor,
                      }}
                    />
                    {p.nome}
                    {isSelected && ' ✓'}
                  </button>
                )
              })}
            </div>

            {/* Tabela de valores por pessoa */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedPessoas.map((item) => {
                const pessoa = pessoas.find((p) => p.id === item.pessoa_id)
                if (!pessoa) return null
                return (
                  <div
                    key={item.pessoa_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 1fr auto',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--panel)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: pessoa.cor }}>
                      {pessoa.nome}
                    </span>

                    {tipoDivisao === 'percentual' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.percentual}
                          onChange={(e) => updatePercentual(item.pessoa_id, parseFloat(e.target.value))}
                          style={{
                            width: '70px',
                            padding: '4px 6px',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            background: 'var(--background)',
                            color: 'var(--foreground)',
                            fontSize: '12px',
                          }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>%</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {tipoDivisao === 'igualitaria'
                          ? `${(100 / selectedPessoas.length).toFixed(1)}%`
                          : 'Fixo'}
                      </span>
                    )}

                    {tipoDivisao === 'valor_fixo' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.valor}
                          onChange={(e) => updateValorFixo(item.pessoa_id, parseFloat(e.target.value))}
                          style={{
                            width: '90px',
                            padding: '4px 6px',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            background: 'var(--background)',
                            color: 'var(--foreground)',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', fontWeight: 700, textAlign: 'right' }}>
                        {formatCurrency(item.valor)}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => togglePessoa(item.pessoa_id)}
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Remover pessoa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Alerta de validação em tempo real */}
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: validacaoDivisao.valido ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: validacaoDivisao.valido ? '#10b981' : '#ef4444',
              }}
            >
              {validacaoDivisao.valido ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {validacaoDivisao.mensagem}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !validacaoDivisao.valido}
              className="button-primary"
              style={{ opacity: !validacaoDivisao.valido ? 0.6 : 1 }}
            >
              {loading ? 'Salvando...' : initialData ? 'Atualizar Compra' : 'Salvar Compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
