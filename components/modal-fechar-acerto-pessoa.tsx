'use client'

import { useState } from 'react'
import { formatCurrency, formatDateBR, gerarMensagemWhatsAppPessoa } from '@/lib/finance-utils'
import { Pessoa } from '@/lib/types'
import { X, Check, MessageSquare, Printer } from 'lucide-react'

export interface ItemAcertoPessoa {
  compraId: string
  descricao: string
  numeroParcela: number
  totalParcelas: number
  cartaoNome: string
  vencimento: string
  valor: number
  paga: boolean
  statusLabel?: string
  statusColor?: string
  statusBg?: string
}

interface ModalFecharAcertoPessoaProps {
  isOpen: boolean
  onClose: () => void
  pessoa: Pessoa
  mesAnoStr: string
  itens: ItemAcertoPessoa[]
  totalDevido: number
  onNotifyToast?: (msg: string) => void
}

/**
 * Função utilitária para gerar e imprimir o PDF com o detalhamento das compras do mês da pessoa
 */
export function imprimirAcertoPessoa(
  pessoa: Pessoa,
  mesAnoStr: string,
  itens: ItemAcertoPessoa[],
  totalDevido: number
) {
  const dataEmissao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const linhasHtml = itens
    .map(
      (it, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #4b5563; white-space: nowrap;">
          ${formatDateBR(it.vencimento)}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827;">
          ${it.descricao}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
          ${it.cartaoNome}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #4b5563; white-space: nowrap;">
          ${it.numeroParcela} / ${it.totalParcelas}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: ${it.paga ? '#166534' : '#b45309'}; white-space: nowrap;">
          ${it.statusLabel || (it.paga ? 'Paga' : 'Em aberto')}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: #111827; text-align: right; white-space: nowrap;">
          ${formatCurrency(it.valor)}
        </td>
      </tr>
    `
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Extrato de Acerto - ${pessoa.nome} - ${mesAnoStr}</title>
  <style>
    @page {
      margin: 12mm 15mm 15mm 15mm;
      size: A4 portrait;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .header-bar {
      border-bottom: 2px solid #111827;
      padding-bottom: 14px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .badge-sub {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .doc-title {
      margin: 4px 0 0;
      font-size: 22px;
      font-weight: 800;
      color: #111827;
      letter-spacing: -0.03em;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #4b5563;
      line-height: 1.6;
    }
    .summary-grid {
      display: table;
      width: 100%;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .summary-col {
      display: table-cell;
      vertical-align: middle;
    }
    .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      display: block;
    }
    .name-val {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-top: 3px;
      display: block;
    }
    .contact-val {
      font-size: 12px;
      color: #4b5563;
      margin-top: 2px;
      display: block;
    }
    .total-val {
      font-size: 24px;
      font-weight: 800;
      color: #166534;
      margin-top: 2px;
      display: block;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    th {
      background: #f3f4f6;
      border-bottom: 2px solid #d1d5db;
      padding: 10px;
      text-align: left;
      font-weight: 700;
      font-size: 11px;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .tfoot-total td {
      border-top: 2px solid #111827;
      background: #f9fafb;
      padding: 12px 10px;
      font-weight: 800;
    }
    .doc-footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #6b7280;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <span class="badge-sub">Sistema de Gestão de Cartões</span>
      <h1 class="doc-title">Extrato de Fechamento de Acerto</h1>
    </div>
    <div class="meta-box">
      <div>Emissão: <strong>${dataEmissao}</strong></div>
      <div>Referência: <strong>${mesAnoStr}</strong></div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-col" style="width: 45%;">
      <span class="label">Pessoa / Favorecido</span>
      <span class="name-val">${pessoa.nome}</span>
      ${pessoa.contato ? `<span class="contact-val">Contato: ${pessoa.contato}</span>` : ''}
    </div>
    <div class="summary-col" style="width: 25%;">
      <span class="label">Mês de Referência</span>
      <span style="font-size: 15px; font-weight: 700; color: #111827; display: block; margin-top: 3px;">${mesAnoStr}</span>
      <span style="font-size: 11px; color: #6b7280; display: block; margin-top: 2px;">${itens.length} ${itens.length === 1 ? 'despesa vinculada' : 'despesas vinculadas'}</span>
    </div>
    <div class="summary-col" style="width: 30%; text-align: right;">
      <span class="label">Total a Acertar</span>
      <span class="total-val">${formatCurrency(totalDevido)}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Vencimento</th>
        <th style="width: 35%;">Descrição da Compra</th>
        <th style="width: 20%;">Cartão</th>
        <th style="width: 10%;">Parcela</th>
        <th style="width: 10%;">Status</th>
        <th style="width: 10%; text-align: right;">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${linhasHtml}
    </tbody>
    <tfoot>
      <tr class="tfoot-total">
        <td colspan="5" style="text-align: right; font-size: 13px; color: #111827;">TOTAL GERAL A ACERTAR:</td>
        <td style="text-align: right; font-size: 15px; color: #166534; white-space: nowrap;">${formatCurrency(totalDevido)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="doc-footer">
    <span>Por favor, efetue o acerto e confirme o envio do comprovante. Obrigado!</span>
    <span>Documento gerado pelo Gestão de Cartões</span>
  </div>
</body>
</html>`

  // 1. Abre em uma janela dedicada para renderização direta do documento
  const printWindow = window.open('', '_blank', 'width=900,height=750')
  if (printWindow) {
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()

    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 350)
    return
  }

  // 2. Fallback caso popups estejam bloqueados no navegador
  let iframe = document.getElementById('iframe-impressao-acerto') as HTMLIFrameElement
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = 'iframe-impressao-acerto'
    iframe.style.position = 'fixed'
    iframe.style.top = '-9999px'
    iframe.style.left = '-9999px'
    iframe.style.width = '900px'
    iframe.style.height = '1000px'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
  }

  const doc = iframe.contentWindow?.document
  if (!doc) return

  doc.open()
  doc.write(html)
  doc.close()

  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }, 400)
}

export function ModalFecharAcertoPessoa({
  isOpen,
  onClose,
  pessoa,
  mesAnoStr,
  itens,
  totalDevido,
  onNotifyToast,
}: ModalFecharAcertoPessoaProps) {
  const [copiado, setCopiado] = useState(false)

  if (!isOpen) return null

  const handleCopiarWhatsApp = () => {
    const texto = gerarMensagemWhatsAppPessoa(
      pessoa.nome,
      mesAnoStr,
      itens.map((it) => ({
        descricao: it.descricao,
        numeroParcela: it.numeroParcela,
        totalParcelas: it.totalParcelas,
        cartaoNome: it.cartaoNome,
        valor: it.valor,
        vencimento: it.vencimento,
      })),
      totalDevido
    )

    navigator.clipboard.writeText(texto)
    setCopiado(true)
    if (onNotifyToast) {
      onNotifyToast(`Resumo de ${pessoa.nome} copiado para o WhatsApp!`)
    }
    setTimeout(() => setCopiado(false), 2500)
  }

  const handleImprimir = () => {
    imprimirAcertoPessoa(pessoa, mesAnoStr, itens, totalDevido)
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: pessoa.cor || 'var(--lime)',
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
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
                FECHAMENTO DE ACERTO INDIVIDUAL
              </span>
              <h2 style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 700 }}>
                {pessoa.nome} · {mesAnoStr}
              </h2>
            </div>
          </div>

          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Card Resumo do Valor */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(200, 241, 105, 0.15), rgba(115, 212, 202, 0.1))',
            border: '1px solid rgba(200, 241, 105, 0.3)',
            borderRadius: '12px',
            padding: '16px 18px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>
              Total a acertar neste mês
            </span>
            <strong style={{ fontSize: '26px', letterSpacing: '-0.03em', color: 'var(--lime)' }}>
              {formatCurrency(totalDevido)}
            </strong>
          </div>

          <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--muted)' }}>
            <div>{itens.length} {itens.length === 1 ? 'despesa vinculada' : 'despesas vinculadas'}</div>
            {pessoa.contato && (
              <div style={{ marginTop: '3px', fontSize: '11px', color: 'var(--foreground)' }}>
                {pessoa.contato}
              </div>
            )}
          </div>
        </div>

        {/* Lista Detalhada das Compras */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
            Detalhamento dos Lançamentos ({itens.length})
          </span>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {itens.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                Nenhuma despesa para acertar neste mês.
              </div>
            ) : (
              itens.map((item, idx) => (
                <div
                  key={`${item.compraId}-${item.numeroParcela}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block' }}>{item.descricao}</strong>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        color: 'var(--muted)',
                        marginTop: '2px',
                      }}
                    >
                      <span>Parc. {item.numeroParcela}/{item.totalParcelas}</span>
                      <span>·</span>
                      <span>{item.cartaoNome}</span>
                      <span>·</span>
                      <span>Venc.: {formatDateBR(item.vencimento)}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--foreground)', display: 'block' }}>
                      {formatCurrency(item.valor)}
                    </strong>
                    {item.statusLabel && (
                      <span
                        className="status-tag"
                        style={{
                          background: item.statusBg || 'rgba(100, 116, 139, 0.15)',
                          color: item.statusColor || 'var(--muted)',
                          fontSize: '9px',
                          marginTop: '2px',
                        }}
                      >
                        {item.statusLabel}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopiarWhatsApp}
            disabled={itens.length === 0}
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
            disabled={itens.length === 0}
            className="button-secondary"
            style={{ padding: '12px 18px', gap: '8px' }}
            title="Gerar PDF ou Imprimir extrato de acerto"
          >
            <Printer size={16} /> PDF / Imprimir
          </button>

          <button
            type="button"
            onClick={onClose}
            className="button-secondary"
            style={{ padding: '12px 16px' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
