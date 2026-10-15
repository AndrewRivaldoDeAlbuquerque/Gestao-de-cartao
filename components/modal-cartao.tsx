'use client'

import { useState, useEffect } from 'react'
import { Cartao } from '@/lib/types'
import { X, CreditCard, Check } from 'lucide-react'

interface ModalCartaoProps {
  isOpen: boolean
  onClose: () => void
  onSave: (cartao: Omit<Cartao, 'id'> & { id?: string }) => Promise<void>
  initialData?: Cartao | null
}

const PRESET_CARD_COLORS = [
  '#8b5cf6', // Roxo (Nubank)
  '#f97316', // Laranja (Inter)
  '#0284c7', // Azul Claro (Itaú / Bradesco)
  '#e11d48', // Vermelho (Santander)
  '#10b981', // Verde (C6 / Sicredi)
  '#1e293b', // Preto (Black)
  '#eab308', // Dourado (Gold)
]

export function ModalCartao({ isOpen, onClose, onSave, initialData }: ModalCartaoProps) {
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#8b5cf6')
  const [limite, setLimite] = useState('')
  const [fechamento, setFechamento] = useState('15')
  const [vencimento, setVencimento] = useState('20')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialData) {
      setNome(initialData.nome)
      setCor(initialData.cor || '#8b5cf6')
      setLimite(initialData.limite ? String(initialData.limite) : '')
      setFechamento(String(initialData.dia_fechamento || 15))
      setVencimento(String(initialData.dia_vencimento || 20))
    } else {
      setNome('')
      setCor(PRESET_CARD_COLORS[0])
      setLimite('')
      setFechamento('15')
      setVencimento('20')
    }
    setError('')
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setError('Por favor, informe o nome do cartão.')
      return
    }

    const diaF = parseInt(fechamento, 10)
    const diaV = parseInt(vencimento, 10)
    if (isNaN(diaF) || diaF < 1 || diaF > 31) {
      setError('Dia de fechamento deve ser entre 1 e 31.')
      return
    }
    if (isNaN(diaV) || diaV < 1 || diaV > 31) {
      setError('Dia de vencimento deve ser entre 1 e 31.')
      return
    }

    setLoading(true)
    try {
      await onSave({
        id: initialData?.id,
        nome: nome.trim(),
        cor,
        limite: limite ? parseFloat(limite.replace(',', '.')) : null,
        dia_fechamento: diaF,
        dia_vencimento: diaV,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar cartão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: cor,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <CreditCard size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {initialData ? 'Editar Cartão' : 'Novo Cartão'}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Configuração de datas e limite de crédito
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
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
              Nome do Cartão *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Nubank Mastercard ou Inter Black"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
                Dia de Fechamento *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={fechamento}
                onChange={(e) => setFechamento(e.target.value)}
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
              <span style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                Corta compras da fatura
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
                Dia de Vencimento *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
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
              <span style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                Vencimento do boleto
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
              Limite de Crédito R$ (opcional)
            </label>
            <input
              type="text"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              placeholder="Ex.: 5000.00"
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

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
              Cor do Cartão
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_CARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: c,
                    border: cor === c ? '2px solid var(--foreground)' : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    transform: cor === c ? 'scale(1.15)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  {cor === c && <Check size={14} color="#fff" />}
                </button>
              ))}
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                style={{
                  width: '28px',
                  height: '28px',
                  padding: 0,
                  border: 0,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="button-primary">
              {loading ? 'Salvando...' : 'Salvar Cartão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
