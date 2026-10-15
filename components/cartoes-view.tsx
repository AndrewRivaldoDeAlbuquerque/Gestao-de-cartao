'use client'

import { Cartao } from '@/lib/types'
import { formatCurrency } from '@/lib/finance-utils'
import { Plus, CreditCard, Edit2, Trash2, Calendar, ShieldCheck } from 'lucide-react'

interface CartoesViewProps {
  cartoes: Cartao[]
  onNovoCartao: () => void
  onEditarCartao: (cartao: Cartao) => void
  onExcluirCartao: (id: string) => Promise<void>
}

export function CartoesView({
  cartoes,
  onNovoCartao,
  onEditarCartao,
  onExcluirCartao,
}: CartoesViewProps) {
  const handleExcluir = async (id: string, nome: string) => {
    if (confirm(`Deseja realmente excluir o cartão "${nome}"?`)) {
      await onExcluirCartao(id)
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MEUS CARTÕES</p>
          <h1>Cartões de Crédito</h1>
          <p className="subheading">
            Gerencie os cartões utilizados para compras, suas datas de fechamento e vencimento.
          </p>
        </div>

        <button onClick={onNovoCartao} className="button-primary" style={{ gap: '6px' }}>
          <Plus size={16} /> Novo cartão
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {cartoes.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            Nenhum cartão cadastrado. Clique no botão acima para adicionar.
          </div>
        ) : (
          cartoes.map((cartao) => (
            <div
              key={cartao.id}
              className="panel"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                borderTop: `4px solid ${cartao.cor}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: cartao.cor,
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: '16px', display: 'block' }}>{cartao.nome}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Cartão de Crédito</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => onEditarCartao(cartao)}
                    className="icon-button"
                    title="Editar cartão"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleExcluir(cartao.id, cartao.nome)}
                    className="icon-button"
                    title="Excluir cartão"
                  >
                    <Trash2 size={15} color="#ef4444" />
                  </button>
                </div>
              </div>

              {/* Informações de Vencimento e Limite */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  background: 'var(--background)',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>
                    Fechamento
                  </span>
                  <strong style={{ fontSize: '14px' }}>Dia {cartao.dia_fechamento}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>
                    Vencimento
                  </span>
                  <strong style={{ fontSize: '14px' }}>Dia {cartao.dia_vencimento}</strong>
                </div>
              </div>

              {cartao.limite !== undefined && cartao.limite !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: 'var(--muted)' }}>Limite cadastrado:</span>
                  <strong>{formatCurrency(cartao.limite)}</strong>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
