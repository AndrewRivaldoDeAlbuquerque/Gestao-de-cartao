'use client'

import { useState, useMemo, useEffect } from 'react'
import { HistoricoAlteracao } from '@/lib/types'
import { StorageService } from '@/lib/storage-service'
import { formatDateBR } from '@/lib/finance-utils'
import {
  History,
  RotateCcw,
  Filter,
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react'

interface HistoricoViewProps {
  onRestaurarSucesso: () => Promise<void>
  onNotifyToast: (msg: string) => void
}

export function HistoricoView({ onRestaurarSucesso, onNotifyToast }: HistoricoViewProps) {
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEntidade, setFiltroEntidade] = useState<string>('todas')
  const [filtroAcao, setFiltroAcao] = useState<string>('todas')

  const carregarHistorico = async () => {
    setLoading(true)
    const list = await StorageService.getHistoricoAlteracoes()
    setHistorico(list)
    setLoading(false)
  }

  useEffect(() => {
    carregarHistorico()
  }, [])

  const filtrados = useMemo(() => {
    return historico.filter((h) => {
      if (filtroEntidade !== 'todas' && h.entidade !== filtroEntidade) return false
      if (filtroAcao !== 'todas' && h.acao !== filtroAcao) return false
      return true
    })
  }, [historico, filtroEntidade, filtroAcao])

  const handleRestaurar = async (item: HistoricoAlteracao) => {
    if (confirm(`Deseja restaurar este item (${item.entidade})?`)) {
      const ok = await StorageService.restaurarItemHistorico(item)
      if (ok) {
        onNotifyToast('Item restaurado com sucesso!')
        await carregarHistorico()
        await onRestaurarSucesso()
      } else {
        onNotifyToast('A restauração direta está disponível para compras excluídas.')
      }
    }
  }

  const getAcaoBadge = (acao: string) => {
    switch (acao) {
      case 'criacao':
        return { label: 'Criação', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', Icon: PlusCircle }
      case 'edicao':
        return { label: 'Edição', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', Icon: Edit }
      case 'exclusao':
        return { label: 'Exclusão', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', Icon: Trash2 }
      case 'restauracao':
        return { label: 'Restauração', bg: 'rgba(200, 241, 105, 0.15)', color: 'var(--lime)', Icon: RotateCcw }
      default:
        return { label: acao, bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', Icon: History }
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">AUDITORIA E RASTREABILIDADE</p>
          <h1>Histórico de Alterações</h1>
          <p className="subheading">
            Registro cronológico de todas as criações, modificações e exclusões, com suporte a restauração.
          </p>
        </div>

        <button onClick={carregarHistorico} className="button-secondary" style={{ gap: '6px' }}>
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="panel" style={{ padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Filtro Entidade */}
          <select
            value={filtroEntidade}
            onChange={(e) => setFiltroEntidade(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '12px',
            }}
          >
            <option value="todas">Todas as entidades</option>
            <option value="compra">Compras</option>
            <option value="pessoa">Pessoas</option>
            <option value="cartao">Cartões</option>
            <option value="categoria">Categorias</option>
          </select>

          {/* Filtro Ação */}
          <select
            value={filtroAcao}
            onChange={(e) => setFiltroAcao(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '12px',
            }}
          >
            <option value="todas">Todas as ações</option>
            <option value="criacao">Criação</option>
            <option value="edicao">Edição</option>
            <option value="exclusao">Exclusão</option>
            <option value="restauracao">Restauração</option>
          </select>
        </div>
      </div>

      {/* Tabela de Auditoria */}
      <div className="panel data-panel">
        <div className="data-table">
          <div
            className="data-head"
            style={{
              gridTemplateColumns: '1.4fr 1.2fr 2fr 1.2fr auto',
            }}
          >
            <span>Data / Hora</span>
            <span>Ação</span>
            <span>Entidade / Detalhes</span>
            <span>ID do Registro</span>
            <span style={{ textAlign: 'right' }}>Ação</span>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
              Carregando histórico...
            </div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
              Nenhum registro encontrado no histórico.
            </div>
          ) : (
            filtrados.map((item) => {
              const badge = getAcaoBadge(item.acao)
              const BadgeIcon = badge.Icon
              const dataFormatada = new Date(item.criado_em).toLocaleString('pt-BR')

              return (
                <div
                  key={item.id}
                  className="data-row"
                  style={{
                    gridTemplateColumns: '1.4fr 1.2fr 2fr 1.2fr auto',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{dataFormatada}</span>

                  <div>
                    <span
                      className="status-tag"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        gap: '4px',
                      }}
                    >
                      <BadgeIcon size={12} /> {badge.label}
                    </span>
                  </div>

                  <div>
                    <strong style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                      {item.entidade}
                    </strong>
                    {item.dados_depois?.descricao && (
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                        "{item.dados_depois.descricao}"
                      </span>
                    )}
                    {item.dados_antes?.descricao && item.acao === 'exclusao' && (
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                        "{item.dados_antes.descricao}"
                      </span>
                    )}
                  </div>

                  <code style={{ fontSize: '10px', color: 'var(--muted)' }}>
                    {item.entidade_id.slice(0, 8)}...
                  </code>

                  <div style={{ textAlign: 'right' }}>
                    {item.acao === 'exclusao' && item.entidade === 'compra' && (
                      <button
                        onClick={() => handleRestaurar(item)}
                        className="button-secondary"
                        style={{ fontSize: '11px', padding: '4px 8px', gap: '4px' }}
                        title="Restaurar este item"
                      >
                        <RotateCcw size={12} /> Restaurar
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
