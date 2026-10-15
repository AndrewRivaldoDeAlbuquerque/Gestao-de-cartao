'use client'

import { useState, useEffect } from 'react'
import { Categoria } from '@/lib/types'
import {
  X,
  Tag,
  Utensils,
  Car,
  PartyPopper,
  HeartPulse,
  Home,
  ShoppingBag,
  Tv,
  GraduationCap,
  Coffee,
  Plane,
  Smartphone,
  Gift,
  Check,
} from 'lucide-react'

interface ModalCategoriaProps {
  isOpen: boolean
  onClose: () => void
  onSave: (categoria: Omit<Categoria, 'id'> & { id?: string }) => Promise<void>
  initialData?: Categoria | null
}

const AVAILABLE_ICONS = [
  { name: 'Utensils', label: 'Alimentação', Icon: Utensils },
  { name: 'Car', label: 'Transporte', Icon: Car },
  { name: 'PartyPopper', label: 'Lazer', Icon: PartyPopper },
  { name: 'HeartPulse', label: 'Saúde', Icon: HeartPulse },
  { name: 'Home', label: 'Moradia', Icon: Home },
  { name: 'ShoppingBag', label: 'Compras', Icon: ShoppingBag },
  { name: 'Tv', label: 'Assinaturas', Icon: Tv },
  { name: 'GraduationCap', label: 'Educação', Icon: GraduationCap },
  { name: 'Coffee', label: 'Café / Bar', Icon: Coffee },
  { name: 'Plane', label: 'Viagem', Icon: Plane },
  { name: 'Smartphone', label: 'Tecnologia', Icon: Smartphone },
  { name: 'Gift', label: 'Presentes', Icon: Gift },
  { name: 'Tag', label: 'Outros', Icon: Tag },
]

const PRESET_CAT_COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#ec4899',
  '#ef4444',
  '#8b5cf6',
  '#6366f1',
  '#06b6d4',
  '#14b8a6',
  '#10b981',
  '#64748b',
]

export function ModalCategoria({ isOpen, onClose, onSave, initialData }: ModalCategoriaProps) {
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#10b981')
  const [icone, setIcone] = useState('Tag')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialData) {
      setNome(initialData.nome)
      setCor(initialData.cor || '#10b981')
      setIcone(initialData.icone || 'Tag')
    } else {
      setNome('')
      setCor(PRESET_CAT_COLORS[0])
      setIcone('Tag')
    }
    setError('')
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setError('Por favor, informe o nome da categoria.')
      return
    }

    setLoading(true)
    try {
      await onSave({
        id: initialData?.id,
        nome: nome.trim(),
        cor,
        icone,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar categoria.')
    } finally {
      setLoading(false)
    }
  }

  const CurrentIcon = AVAILABLE_ICONS.find((i) => i.name === icone)?.Icon || Tag

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
              }}
            >
              <CurrentIcon size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {initialData ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Classificação visual de despesas
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
              Nome da Categoria *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Alimentação ou Moradia"
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
              Ícone
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px',
                maxHeight: '130px',
                overflowY: 'auto',
                padding: '4px',
              }}
            >
              {AVAILABLE_ICONS.map(({ name, Icon, label }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcone(name)}
                  title={label}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: icone === name ? '2px solid var(--lime)' : '1px solid var(--border)',
                    background: icone === name ? 'rgba(200, 241, 105, 0.15)' : 'var(--background)',
                    color: icone === name ? 'var(--lime)' : 'var(--muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
              Cor
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_CAT_COLORS.map((c) => (
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
              {loading ? 'Salvando...' : 'Salvar Categoria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
