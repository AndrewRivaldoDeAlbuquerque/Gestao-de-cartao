'use client'

import { useState, useEffect } from 'react'
import { RegraCategorizacao, Categoria } from '@/lib/types'
import { StorageService } from '@/lib/storage-service'
import { X, Sparkles, Plus, Trash2, CheckCircle2, Search } from 'lucide-react'

interface RegrasCategorizacaoModalProps {
  isOpen: boolean
  onClose: () => void
  categorias: Categoria[]
  onNotifyToast: (msg: string) => void
}

export function RegrasCategorizacaoModal({
  isOpen,
  onClose,
  categorias,
  onNotifyToast,
}: RegrasCategorizacaoModalProps) {
  const [regras, setRegras] = useState<RegraCategorizacao[]>([])
  const [novoTermo, setNovoTermo] = useState('')
  const [novaCategoriaId, setNovaCategoriaId] = useState('')
  const [termoTeste, setTermoTeste] = useState('')
  const [sugestaoResultado, setSugestaoResultado] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const carregarRegras = async () => {
    const list = await StorageService.getRegrasCategorizacao()
    setRegras(list)
    if (categorias.length > 0 && !novaCategoriaId) {
      setNovaCategoriaId(categorias[0].id)
    }
  }

  useEffect(() => {
    if (isOpen) {
      carregarRegras()
      setTermoTeste('')
      setSugestaoResultado(null)
    }
  }, [isOpen])

  // Testador em tempo real
  useEffect(() => {
    if (!termoTeste.trim()) {
      setSugestaoResultado(null)
      return
    }

    const timer = setTimeout(async () => {
      const catId = await StorageService.sugerirCategoriaPorDescricao(termoTeste)
      if (catId) {
        const cat = categorias.find((c) => c.id === catId)
        setSugestaoResultado(cat ? cat.nome : 'Categoria desconhecida')
      } else {
        setSugestaoResultado('Nenhuma categoria sugerida')
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [termoTeste, categorias, regras])

  if (!isOpen) return null

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoTermo.trim()) return

    setLoading(true)
    try {
      await StorageService.saveRegraCategorizacao(novoTermo, novaCategoriaId || categorias[0]?.id)
      setNovoTermo('')
      await carregarRegras()
      onNotifyToast('Regra de categorização adicionada!')
    } finally {
      setLoading(false)
    }
  }

  const handleExcluir = async (id: string) => {
    await StorageService.deleteRegraCategorizacao(id)
    await carregarRegras()
    onNotifyToast('Regra removida.')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(200, 241, 105, 0.15)',
                color: 'var(--lime)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Regras de Categorização Automática
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Regras por palavra-chave e aprendizado por inteligência histórica
              </span>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Formulário para Nova Regra */}
        <form
          onSubmit={handleAdicionar}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1.2fr auto',
            gap: '8px',
            alignItems: 'end',
            padding: '14px',
            background: 'var(--background)',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            marginBottom: '16px',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>
              Se a descrição contiver:
            </label>
            <input
              type="text"
              required
              placeholder="Ex.: UBER, IFOOD, POSTO..."
              value={novoTermo}
              onChange={(e) => setNovoTermo(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--foreground)',
                fontSize: '12px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>
              Atribuir categoria:
            </label>
            <select
              value={novaCategoriaId}
              onChange={(e) => setNovaCategoriaId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--foreground)',
                fontSize: '12px',
              }}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button-primary"
            style={{ padding: '8px 12px', height: '36px' }}
          >
            <Plus size={15} />
          </button>
        </form>

        {/* Testador em Tempo Real */}
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'color-mix(in srgb, var(--panel) 80%, transparent)',
            border: '1px dashed var(--border)',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
            Testar sugestão inteligente:
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: 1 }}>
              <Search size={14} />
              <input
                placeholder="Digite ex: 'Corrida de Uber ao aeroporto'..."
                value={termoTeste}
                onChange={(e) => setTermoTeste(e.target.value)}
                style={{ fontSize: '11px' }}
              />
            </div>
            {sugestaoResultado && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--lime)',
                  background: 'rgba(200, 241, 105, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                }}
              >
                Sugestão: {sugestaoResultado}
              </span>
            )}
          </div>
        </div>

        {/* Lista de Regras Existentes */}
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
            Regras cadastradas ({regras.length})
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
            {regras.map((r) => {
              const cat = categorias.find((c) => c.id === r.categoria_id)
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ background: 'var(--background)', padding: '2px 6px', borderRadius: '4px' }}>
                      {r.termo}
                    </code>
                    <span>→</span>
                    <strong>{cat?.nome || 'Categoria removida'}</strong>
                  </div>

                  <button
                    onClick={() => handleExcluir(r.id)}
                    className="icon-button"
                    title="Excluir regra"
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" className="button-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
