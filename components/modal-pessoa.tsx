'use client'

import { useState, useEffect } from 'react'
import { Pessoa } from '@/lib/types'
import { X, User, Check, Palette } from 'lucide-react'

interface ModalPessoaProps {
  isOpen: boolean
  onClose: () => void
  onSave: (pessoa: Omit<Pessoa, 'id'> & { id?: string }) => Promise<void>
  initialData?: Pessoa | null
}

const PRESET_COLORS = [
  '#10b981', // Verde
  '#3b82f6', // Azul
  '#ec4899', // Rosa
  '#8b5cf6', // Roxo
  '#f59e0b', // Âmbar
  '#06b6d4', // Ciano
  '#ef4444', // Vermelho
  '#64748b', // Slate
]

export function ModalPessoa({ isOpen, onClose, onSave, initialData }: ModalPessoaProps) {
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#10b981')
  const [contato, setContato] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialData) {
      setNome(initialData.nome)
      setCor(initialData.cor || '#10b981')
      setContato(initialData.contato || '')
      setAtivo(initialData.ativo ?? true)
    } else {
      setNome('')
      setCor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
      setContato('')
      setAtivo(true)
    }
    setError('')
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setError('Por favor, informe o nome da pessoa.')
      return
    }

    setLoading(true)
    try {
      await onSave({
        id: initialData?.id,
        nome: nome.trim(),
        cor,
        contato: contato.trim() || undefined,
        ativo,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar pessoa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
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
                fontWeight: 700,
              }}
            >
              <User size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {initialData ? 'Editar Pessoa' : 'Nova Pessoa'}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {initialData?.nome === 'Eu' ? 'Você (titular padrão)' : 'Pessoa para divisão de despesas'}
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
              Nome completo ou apelido *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Marina ou Eu"
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
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
              Contato (WhatsApp, telefone ou e-mail - opcional)
            </label>
            <input
              type="text"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Ex.: (11) 99999-9999 ou marina@email.com"
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
              Cor de identificação
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
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
                  borderRadius: '50%',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
                title="Personalizar cor"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--lime)', cursor: 'pointer' }}
              />
              Pessoa ativa (aparece na seleção de novas compras)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="button-primary">
              {loading ? 'Salvando...' : 'Salvar Pessoa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
