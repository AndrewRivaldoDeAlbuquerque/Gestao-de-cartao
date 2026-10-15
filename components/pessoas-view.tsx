'use client'

import { useState, useMemo } from 'react'
import { Pessoa, Compra } from '@/lib/types'
import { formatCurrency } from '@/lib/finance-utils'
import { Search, Plus, User, Edit2, Trash2, PowerOff, CheckCircle2 } from 'lucide-react'

interface PessoasViewProps {
  pessoas: Pessoa[]
  compras: Compra[]
  onNovaPessoa: () => void
  onEditarPessoa: (pessoa: Pessoa) => void
  onSelectPessoa: (pessoa: Pessoa) => void
  onExcluirOuInativar: (id: string) => Promise<void>
  onToggleAtivo: (pessoa: Pessoa) => Promise<void>
  onNotifyToast: (msg: string) => void
}

export function PessoasView({
  pessoas,
  compras,
  onNovaPessoa,
  onEditarPessoa,
  onSelectPessoa,
  onExcluirOuInativar,
  onToggleAtivo,
  onNotifyToast,
}: PessoasViewProps) {

  const [busca, setBusca] = useState('')

  // Calcula total gasto acumulado por pessoa em todas as compras ativas
  const totaisAcumulados = useMemo(() => {
    const mapa: Record<string, number> = {}
    pessoas.forEach((p) => {
      mapa[p.id] = 0
    })

    compras
      .filter((c) => !c.deletado_em)
      .forEach((c) => {
        ;(c.pessoas_compras || []).forEach((pc) => {
          if (mapa[pc.pessoa_id] !== undefined) {
            mapa[pc.pessoa_id] += pc.valor
          }
        })
      })

    return mapa
  }, [pessoas, compras])

  const pessoasFiltradas = useMemo(() => {
    return pessoas.filter((p) => {
      if (!busca.trim()) return true
      const termo = busca.toLowerCase()
      return (
        p.nome.toLowerCase().includes(termo) ||
        (p.contato && p.contato.toLowerCase().includes(termo))
      )
    })
  }, [pessoas, busca])

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DIVISÃO DE DESPESAS</p>
          <h1>Pessoas</h1>
          <p className="subheading">
            Cadastre as pessoas com quem você divide compras. Pessoas inativas não aparecem em novos lançamentos.
          </p>
        </div>

        <button onClick={onNovaPessoa} className="button-primary" style={{ gap: '6px' }}>
          <Plus size={16} /> Nova pessoa
        </button>
      </div>

      {/* Busca */}
      <div className="panel" style={{ padding: '14px', marginBottom: '16px' }}>
        <div className="search-box">
          <Search size={15} />
          <input
            placeholder="Buscar por nome ou contato..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* Grid de Pessoas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {pessoasFiltradas.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            Nenhuma pessoa encontrada.
          </div>
        ) : (
          pessoasFiltradas.map((pessoa) => {
            const totalGasto = totaisAcumulados[pessoa.id] || 0
            const isEu = pessoa.nome.toLowerCase() === 'eu'

            return (
              <div
                key={pessoa.id}
                className="panel"
                style={{
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  opacity: pessoa.ativo ? 1 : 0.6,
                }}
              >
                <div
                  onClick={() => onSelectPessoa(pessoa)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  title="Clique para ver compras e total do mês"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: pessoa.cor,
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}
                    >
                      {pessoa.nome.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '15px' }}>{pessoa.nome}</strong>
                        {isEu && (
                          <span
                            style={{
                              fontSize: '9px',
                              background: 'var(--lime)',
                              color: '#162217',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            Você
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {pessoa.contato || 'Sem contato cadastrado'}
                      </span>
                    </div>
                  </div>

                  <span
                    className="status-tag"
                    style={{
                      background: pessoa.ativo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                      color: pessoa.ativo ? '#10b981' : '#64748b',
                    }}
                  >
                    {pessoa.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <div
                  onClick={() => onSelectPessoa(pessoa)}
                  style={{
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    cursor: 'pointer',
                  }}
                  title="Clique para ver detalhes do mês"
                >
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Total acumulado:</span>
                  <strong style={{ fontSize: '16px' }}>{formatCurrency(totalGasto)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                  <button
                    onClick={() => onSelectPessoa(pessoa)}
                    className="button-secondary"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                  >
                    Ver compras do mês →
                  </button>

                  <div style={{ display: 'flex', gap: '4px' }}>

                  <button
                    onClick={() => onToggleAtivo(pessoa)}
                    className="icon-button"
                    title={pessoa.ativo ? 'Inativar pessoa' : 'Reativar pessoa'}
                  >
                    <PowerOff size={15} color={pessoa.ativo ? 'var(--muted)' : '#10b981'} />
                  </button>

                  <button
                    onClick={() => onEditarPessoa(pessoa)}
                    className="icon-button"
                    title="Editar pessoa"
                  >
                    <Edit2 size={15} />
                  </button>

                  {!isEu && (
                    <button
                      onClick={() => onExcluirOuInativar(pessoa.id)}
                      className="icon-button"
                      title="Excluir ou inativar"
                    >
                      <Trash2 size={15} color="#ef4444" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })

        )}
      </div>
    </div>
  )
}
