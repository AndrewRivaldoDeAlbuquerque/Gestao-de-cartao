'use client'

import { Categoria } from '@/lib/types'
import {
  Plus,
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
  Edit2,
  Trash2,
  Sparkles,
} from 'lucide-react'

interface CategoriasViewProps {
  categorias: Categoria[]
  onNovaCategoria: () => void
  onEditarCategoria: (categoria: Categoria) => void
  onExcluirCategoria: (id: string) => Promise<void>
  onAbrirRegras: () => void
}

const ICON_MAP: Record<string, any> = {
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
  Tag,
}

export function CategoriasView({
  categorias,
  onNovaCategoria,
  onEditarCategoria,
  onExcluirCategoria,
  onAbrirRegras,
}: CategoriasViewProps) {
  const handleExcluir = async (id: string, nome: string) => {
    if (confirm(`Deseja excluir a categoria "${nome}"?`)) {
      await onExcluirCategoria(id)
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ORGANIZAÇÃO</p>
          <h1>Categorias</h1>
          <p className="subheading">
            Classifique suas despesas para acompanhar onde o dinheiro é gasto mês a mês.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onAbrirRegras} className="button-secondary" style={{ gap: '6px' }}>
            <Sparkles size={16} color="var(--lime)" /> Regras automáticas
          </button>
          <button onClick={onNovaCategoria} className="button-primary" style={{ gap: '6px' }}>
            <Plus size={16} /> Nova categoria
          </button>
        </div>
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
        {categorias.map((cat) => {
          const IconComp = ICON_MAP[cat.icone] || Tag

          return (
            <div
              key={cat.id}
              className="panel"
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: `${cat.cor}22`,
                    color: cat.cor,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <IconComp size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '14px', display: 'block' }}>{cat.nome}</strong>
                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Ativa</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => onEditarCategoria(cat)}
                  className="icon-button"
                  title="Editar categoria"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleExcluir(cat.id, cat.nome)}
                  className="icon-button"
                  title="Excluir categoria"
                >
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
