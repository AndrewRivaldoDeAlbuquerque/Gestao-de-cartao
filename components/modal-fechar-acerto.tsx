'use client'

import { useState } from 'react'
import { formatCurrency, gerarMensagemWhatsApp } from '@/lib/finance-utils'
import { X, Copy, Check, MessageSquare, Printer, CheckCircle } from 'lucide-react'

interface AcertoPessoa {
  id: string
  nome: string
  cor: string
  contato?: string | null
  totalDevido: number
  comprasCount: number
}

interface ModalFecharAcertoProps {
  isOpen: boolean
  onClose: () => void
  mesAnoStr: string
  acertos: AcertoPessoa[]
  onNotifyToast: (msg: string) => void
}

export function ModalFecharAcerto({
  isOpen,
  onClose,
  mesAnoStr,
  acertos,
  onNotifyToast,
}: ModalFecharAcertoProps) {
  const [copiado, setCopiado] = useState(false)

  if (!isOpen) return null

  // Filtra as pessoas excluindo "Eu" (já que o objetivo do acerto é receber de terceiros)
  const devedores = acertos.filter((a) => a.nome.toLowerCase() !== 'eu')
  const totalAReceber = devedores.reduce((acc, curr) => acc + curr.totalDevido, 0)

  const handleCopiarWhatsApp = () => {
    const texto = gerarMensagemWhatsApp(
      mesAnoStr,
      devedores.map((d) => ({ nome: d.nome, contato: d.contato, valor: d.totalDevido }))
    )
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    onNotifyToast('Resumo copiado para o WhatsApp com sucesso!')
    setTimeout(() => setCopiado(false), 2500)
  }

  const handleImprimir = () => {
    window.print()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
              FECHAMENTO DE ACERTOS
            </span>
            <h2 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 700 }}>
              Fatura de {mesAnoStr}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Card de Resumo Geral a Receber */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(200, 241, 105, 0.15), rgba(115, 212, 202, 0.1))',
            border: '1px solid rgba(200, 241, 105, 0.3)',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>
              Total a receber de terceiros
            </span>
            <strong style={{ fontSize: '24px', letterSpacing: '-0.03em', color: 'var(--lime)' }}>
              {formatCurrency(totalAReceber)}
            </strong>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--muted)' }}>
            <span>{devedores.length} {devedores.length === 1 ? 'pessoa com débitos' : 'pessoas com débitos'}</span>
          </div>
        </div>

        {/* Lista de Pessoas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
          {devedores.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              Nenhuma pessoa com valores a acertar nesta fatura.
            </div>
          ) : (
            devedores.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: d.cor,
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: '12px',
                    }}
                  >
                    {d.nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block' }}>{d.nome}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {d.contato || `${d.comprasCount} despesas vinculadas`}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '15px', color: 'var(--foreground)', display: 'block' }}>
                    {formatCurrency(d.totalDevido)}
                  </strong>
                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>a acertar</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopiarWhatsApp}
            disabled={devedores.length === 0}
            className="button-primary"
            style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
          >
            {copiado ? (
              <>
                <Check size={16} /> Resumo Copiado!
              </>
            ) : (
              <>
                <MessageSquare size={16} /> Copiar para WhatsApp
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleImprimir}
            className="button-secondary"
            style={{ padding: '12px 16px' }}
            title="Exportar PDF / Imprimir"
          >
            <Printer size={16} /> PDF
          </button>
        </div>
      </div>
    </div>
  )
}
