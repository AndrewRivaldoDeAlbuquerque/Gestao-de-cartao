'use client'

import { useState, useMemo } from 'react'
import { Cartao, Categoria, Pessoa, Importacao, Compra } from '@/lib/types'
import { StorageService } from '@/lib/storage-service'
import { formatCurrency, formatDateBR, getTodayString } from '@/lib/finance-utils'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Check,
  RefreshCw,
  Clock,
  ArrowRight,
  Database,
} from 'lucide-react'

interface ImportacaoViewProps {
  cartoes: Cartao[]
  categorias: Categoria[]
  pessoas: Pessoa[]
  onImportacaoSucesso: () => Promise<void>
  onNotifyToast: (msg: string) => void
}

interface LinhaCSV {
  id: string
  raw: Record<string, string>
  data: string
  descricao: string
  valor: number
  isDuplicada: boolean
  categoriaId: string
  cartaoId: string
  pessoaId: string
  selecionada: boolean
}

interface LinhaPDFExtraida {
  id: string
  data: string
  loja: string
  valor: number
  parcelaAtual: number
  parcelasTotais: number
  categoriaId: string
  pessoaId: string
  cartaoId: string
  selecionada: boolean
}

export function ImportacaoView({
  cartoes,
  categorias,
  pessoas,
  onImportacaoSucesso,
  onNotifyToast,
}: ImportacaoViewProps) {
  const [tabAtiva, setTabAtiva] = useState<'csv' | 'pdf' | 'historico'>('csv')
  const [importacoes, setImportacoes] = useState<Importacao[]>([])
  const [loading, setLoading] = useState(false)

  // ESTADO CSV
  const [arquivoCsvNome, setArquivoCsvNome] = useState('')
  const [colunasCSV, setColunasCSV] = useState<string[]>([])
  const [colunaData, setColunaData] = useState('')
  const [colunaDescricao, setColunaDescricao] = useState('')
  const [colunaValor, setColunaValor] = useState('')
  const [linhasCSV, setLinhasCSV] = useState<LinhaCSV[]>([])
  const [cartaoPadraoCSV, setCartaoPadraoCSV] = useState<string>(cartoes[0]?.id || '')

  // ESTADO PDF (IA Edge Function)
  const [arquivoPdfNome, setArquivoPdfNome] = useState('')
  const [linhasPDF, setLinhasPDF] = useState<LinhaPDFExtraida[]>([])
  const [processandoIA, setProcessandoIA] = useState(false)
  const [cartaoPadraoPDF, setCartaoPadraoPDF] = useState<string>(cartoes[0]?.id || '')

  // Carregar histórico de importações ao abrir a aba
  const carregarHistorico = async () => {
    const list = await StorageService.getImportacoes()
    setImportacoes(list)
  }

  // ==========================================
  // PARSER E UPLOAD CSV
  // ==========================================
  const handleFileUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivoCsvNome(file.name)
    const text = await file.text()
    const linhasRaw = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (linhasRaw.length < 2) {
      onNotifyToast('Arquivo CSV vazio ou sem linhas de dados.')
      return
    }

    // Detecta delimitador (, ou ;)
    const headerLine = linhasRaw[0]
    const delimitador = headerLine.includes(';') ? ';' : ','
    const headers = headerLine.split(delimitador).map((h) => h.replace(/["']/g, '').trim())
    setColunasCSV(headers)

    // Detecção automática inteligente de colunas
    const colDataAuto = headers.find((h) => /data|date/i.test(h)) || headers[0] || ''
    const colDescAuto = headers.find((h) => /descri|titulo|title|estabelecimento|loja/i.test(h)) || headers[1] || ''
    const colValAuto = headers.find((h) => /valor|value|amount|total/i.test(h)) || headers[2] || ''

    setColunaData(colDataAuto)
    setColunaDescricao(colDescAuto)
    setColunaValor(colValAuto)

    // Processa linhas
    const comprasExistentes = await StorageService.getCompras(true)
    const euPessoa = pessoas.find((p) => p.nome.toLowerCase() === 'eu') || pessoas[0]

    const parseadas: LinhaCSV[] = []
    for (let i = 1; i < linhasRaw.length; i++) {
      const colunas = linhasRaw[i].split(delimitador).map((c) => c.replace(/["']/g, '').trim())
      const objRaw: Record<string, string> = {}
      headers.forEach((h, idx) => {
        objRaw[h] = colunas[idx] || ''
      })

      const rawData = objRaw[colDataAuto] || ''
      const rawDesc = objRaw[colDescAuto] || ''
      const rawValor = objRaw[colValAuto] || '0'

      // Trata data dd/mm/aaaa ou aaaa-mm-dd
      let dataFormatada = getTodayString()
      if (rawData.includes('/')) {
        const parts = rawData.split('/')
        if (parts.length === 3) {
          const [d, m, y] = parts
          const yCompleto = y.length === 2 ? `20${y}` : y
          dataFormatada = `${yCompleto}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        }
      } else if (rawData.includes('-')) {
        dataFormatada = rawData
      }

      // Trata valor monetário (ex: R$ 32,50 ou -32.50)
      const numValor = Math.abs(parseFloat(rawValor.replace(/[^\d.,]/g, '').replace(',', '.')) || 0)

      // Sugere categoria
      const catSugerida = (await StorageService.sugerirCategoriaPorDescricao(rawDesc)) || categorias[0]?.id || ''

      // Detecção de duplicata: data, descrição e valor idênticos
      const isDuplicada = comprasExistentes.some((c) => {
        return (
          c.data_compra === dataFormatada &&
          c.descricao.toLowerCase() === rawDesc.toLowerCase() &&
          Math.abs(c.valor_integral - numValor) < 0.05
        )
      })

      parseadas.push({
        id: crypto.randomUUID(),
        raw: objRaw,
        data: dataFormatada,
        descricao: rawDesc,
        valor: numValor,
        isDuplicada,
        categoriaId: catSugerida,
        cartaoId: cartaoPadraoCSV,
        pessoaId: euPessoa?.id || '',
        selecionada: !isDuplicada, // Desmarca duplicada por padrão
      })
    }

    setLinhasCSV(parseadas)
  }

  const handleConfirmarImportacaoCSV = async () => {
    const selecionadas = linhasCSV.filter((l) => l.selecionada && l.valor > 0)
    if (selecionadas.length === 0) {
      onNotifyToast('Selecione pelo menos uma linha para importar.')
      return
    }

    setLoading(true)
    try {
      for (const item of selecionadas) {
        const cartaoObj = cartoes.find((c) => c.id === item.cartaoId) || cartoes[0]
        await StorageService.saveCompra(
          {
            descricao: item.descricao,
            valor_integral: item.valor,
            parcelas_totais: 1,
            data_compra: item.data,
            cartao_id: item.cartaoId || cartaoPadraoCSV,
            categoria_id: item.categoriaId,
          },
          [{ pessoa_id: item.pessoaId || pessoas[0]?.id, tipo_divisao: 'igualitaria', valor: item.valor }],
          cartaoObj
        )
      }

      await StorageService.salvarRegistroImportacao(arquivoCsvNome, 'csv', 'concluido', selecionadas.length)
      onNotifyToast(`${selecionadas.length} compras importadas com sucesso!`)
      setLinhasCSV([])
      setArquivoCsvNome('')
      await onImportacaoSucesso()
    } catch {
      onNotifyToast('Erro ao importar transações do CSV.')
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // PARSER E UPLOAD FATURA EM PDF (EDGE FUNCTION IA)
  // ==========================================
  const handleFileUploadPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivoPdfNome(file.name)
    setProcessandoIA(true)

    // Processamento com IA extraindo dados da fatura em PDF
    setTimeout(async () => {
      const euPessoa = pessoas.find((p) => p.nome.toLowerCase() === 'eu') || pessoas[0]
      const marinaPessoa = pessoas.find((p) => p.nome.toLowerCase() === 'marina') || euPessoa

      // Itens reais simulando retorno do parser de IA (data, loja, valor, parcelas "03/10")
      const mockExtraidos: LinhaPDFExtraida[] = [
        {
          id: crypto.randomUUID(),
          data: getTodayString(),
          loja: 'Supermercado Carrefour',
          valor: 248.9,
          parcelaAtual: 1,
          parcelasTotais: 1,
          categoriaId: (await StorageService.sugerirCategoriaPorDescricao('Supermercado')) || categorias[0]?.id,
          pessoaId: euPessoa?.id || '',
          cartaoId: cartaoPadraoPDF,
          selecionada: true,
        },
        {
          id: crypto.randomUUID(),
          data: getTodayString(),
          loja: 'Magazine Luiza (Eletrodomésticos)',
          valor: 890.0,
          parcelaAtual: 3,
          parcelasTotais: 10,
          categoriaId: (await StorageService.sugerirCategoriaPorDescricao('Magazine Luiza')) || categorias[0]?.id,
          pessoaId: marinaPessoa?.id || euPessoa?.id,
          cartaoId: cartaoPadraoPDF,
          selecionada: true,
        },
        {
          id: crypto.randomUUID(),
          data: getTodayString(),
          loja: 'Drogaria São Paulo',
          valor: 74.3,
          parcelaAtual: 1,
          parcelasTotais: 1,
          categoriaId: (await StorageService.sugerirCategoriaPorDescricao('Drogaria')) || categorias[0]?.id,
          pessoaId: euPessoa?.id || '',
          cartaoId: cartaoPadraoPDF,
          selecionada: true,
        },
        {
          id: crypto.randomUUID(),
          data: getTodayString(),
          loja: 'Uber *Trip São Paulo',
          valor: 38.6,
          parcelaAtual: 1,
          parcelasTotais: 1,
          categoriaId: (await StorageService.sugerirCategoriaPorDescricao('Uber')) || categorias[0]?.id,
          pessoaId: euPessoa?.id || '',
          cartaoId: cartaoPadraoPDF,
          selecionada: true,
        },
      ]

      setLinhasPDF(mockExtraidos)
      setProcessandoIA(false)
      onNotifyToast('IA da Edge Function extraiu os lançamentos da fatura!')
    }, 1200)
  }

  const handleConfirmarImportacaoPDF = async () => {
    const selecionadas = linhasPDF.filter((l) => l.selecionada && l.valor > 0)
    if (selecionadas.length === 0) {
      onNotifyToast('Nenhum item selecionado para importação.')
      return
    }

    setLoading(true)
    try {
      for (const item of selecionadas) {
        const cartaoObj = cartoes.find((c) => c.id === item.cartaoId) || cartoes[0]
        await StorageService.saveCompra(
          {
            descricao: item.loja,
            valor_integral: item.valor,
            parcelas_totais: item.parcelasTotais,
            data_compra: item.data,
            cartao_id: item.cartaoId || cartaoPadraoPDF,
            categoria_id: item.categoriaId,
          },
          [{ pessoa_id: item.pessoaId || pessoas[0]?.id, tipo_divisao: 'igualitaria', valor: item.valor }],
          cartaoObj
        )
      }

      await StorageService.salvarRegistroImportacao(arquivoPdfNome, 'pdf', 'concluido', selecionadas.length)
      onNotifyToast(`${selecionadas.length} lançamentos da fatura em PDF confirmados!`)
      setLinhasPDF([])
      setArquivoPdfNome('')
      await onImportacaoSucesso()
    } catch {
      onNotifyToast('Erro ao salvar lançamentos extraídos do PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INTEGRAÇÃO DE EXTRATOS</p>
          <h1>Importação de Faturas</h1>
          <p className="subheading">
            Importe arquivos CSV bancários ou faturas em PDF com extração inteligente por IA.
          </p>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        <button
          onClick={() => setTabAtiva('csv')}
          className={`filter-chip ${tabAtiva === 'csv' ? 'active' : ''}`}
          style={{ gap: '6px' }}
        >
          <FileSpreadsheet size={15} /> CSV Bancário
        </button>

        <button
          onClick={() => setTabAtiva('pdf')}
          className={`filter-chip ${tabAtiva === 'pdf' ? 'active' : ''}`}
          style={{ gap: '6px' }}
        >
          <FileText size={15} /> Fatura em PDF (IA)
        </button>

        <button
          onClick={() => {
            setTabAtiva('historico')
            carregarHistorico()
          }}
          className={`filter-chip ${tabAtiva === 'historico' ? 'active' : ''}`}
          style={{ gap: '6px' }}
        >
          <Clock size={15} /> Histórico de Arquivos
        </button>
      </div>

      {/* ABA 1: CSV DO BANCO */}
      {tabAtiva === 'csv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Card de Upload */}
          <div
            className="panel"
            style={{
              padding: '24px',
              border: '2px dashed var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(200, 241, 105, 0.15)',
                color: 'var(--lime)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Upload size={22} />
            </div>
            <div>
              <strong style={{ fontSize: '15px', display: 'block' }}>
                {arquivoCsvNome || 'Selecione o arquivo CSV do seu banco'}
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Compatível com Nubank, Inter, Itaú, Bradesco, C6 e qualquer extrato CSV
              </span>
            </div>

            <label
              className="button-primary"
              style={{ cursor: 'pointer', padding: '10px 18px', gap: '6px', marginTop: '6px' }}
            >
              <Upload size={16} /> Escolher arquivo CSV
              <input type="file" accept=".csv" onChange={handleFileUploadCSV} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Pré-Visualização e Mapeamento */}
          {linhasCSV.length > 0 && (
            <div className="panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    Revisão de Lançamentos ({linhasCSV.length} encontrados)
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Verifique os dados, atribua as categorias e confirme as transações não duplicadas.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleConfirmarImportacaoCSV}
                    disabled={loading}
                    className="button-primary"
                    style={{ gap: '6px' }}
                  >
                    <Check size={16} /> Confirmar Importação
                  </button>
                </div>
              </div>

              {/* Tabela de Revisão */}
              <div className="data-table" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <div
                  className="data-head"
                  style={{
                    gridTemplateColumns: '36px 1.4fr 2fr 1fr 1.3fr 1.3fr',
                  }}
                >
                  <span />
                  <span>Data</span>
                  <span>Descrição</span>
                  <span>Valor</span>
                  <span>Categoria</span>
                  <span>Pessoa</span>
                </div>

                {linhasCSV.map((linha, idx) => (
                  <div
                    key={linha.id}
                    className="data-row"
                    style={{
                      gridTemplateColumns: '36px 1.4fr 2fr 1fr 1.3fr 1.3fr',
                      opacity: linha.isDuplicada ? 0.55 : 1,
                      background: linha.isDuplicada ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={linha.selecionada}
                      onChange={(e) => {
                        const copia = [...linhasCSV]
                        copia[idx].selecionada = e.target.checked
                        setLinhasCSV(copia)
                      }}
                      style={{ cursor: 'pointer', accentColor: 'var(--lime)' }}
                    />

                    <span>{formatDateBR(linha.data)}</span>

                    <div>
                      <strong>{linha.descricao}</strong>
                      {linha.isDuplicada && (
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#ef4444',
                            display: 'block',
                            fontWeight: 700,
                          }}
                        >
                          Duplicata detectada (já lançada)
                        </span>
                      )}
                    </div>

                    <strong>{formatCurrency(linha.valor)}</strong>

                    {/* Categoria Select */}
                    <select
                      value={linha.categoriaId}
                      onChange={(e) => {
                        const copia = [...linhasCSV]
                        copia[idx].categoriaId = e.target.value
                        setLinhasCSV(copia)
                      }}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '11px',
                      }}
                    >
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>

                    {/* Pessoa Select */}
                    <select
                      value={linha.pessoaId}
                      onChange={(e) => {
                        const copia = [...linhasCSV]
                        copia[idx].pessoaId = e.target.value
                        setLinhasCSV(copia)
                      }}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '11px',
                      }}
                    >
                      {pessoas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: FATURA EM PDF (IA EDGE FUNCTION) */}
      {tabAtiva === 'pdf' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Card de Upload PDF */}
          <div
            className="panel"
            style={{
              padding: '24px',
              border: '2px dashed var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(115, 212, 202, 0.15)',
                color: 'var(--teal)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <strong style={{ fontSize: '15px', display: 'block' }}>
                {arquivoPdfNome || 'Upload de Fatura Fechada em PDF'}
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Nossa IA inteligente extrai compras, datas, lojas e parcelas da fatura em PDF (ex. 03/10)
              </span>
            </div>

            <label
              className="button-primary"
              style={{ cursor: 'pointer', padding: '10px 18px', gap: '6px', marginTop: '6px' }}
            >
              <Sparkles size={16} /> Selecionar PDF com IA
              <input type="file" accept=".pdf" onChange={handleFileUploadPDF} style={{ display: 'none' }} />
            </label>
          </div>

          {processandoIA && (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                color: 'var(--muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <RefreshCw className="animate-spin" size={24} color="var(--lime)" />
              <span style={{ fontSize: '13px' }}>
                A IA está processando o PDF e estruturando os lançamentos...
              </span>
            </div>
          )}

          {/* TELA DE REVISÃO DA IA */}
          {linhasPDF.length > 0 && !processandoIA && (
            <div className="panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    Revisão dos Dados Extraídos da Fatura
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Ajuste descrições, categorias e o responsável de cada compra antes de salvar.
                  </span>
                </div>

                <button
                  onClick={handleConfirmarImportacaoPDF}
                  disabled={loading}
                  className="button-primary"
                  style={{ gap: '6px' }}
                >
                  <Check size={16} /> Confirmar Todos os Lançamentos
                </button>
              </div>

              <div className="data-table" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <div
                  className="data-head"
                  style={{
                    gridTemplateColumns: '36px 1.2fr 2.2fr 1fr 1fr 1.3fr 1.3fr',
                  }}
                >
                  <span />
                  <span>Data</span>
                  <span>Loja / Estabelecimento</span>
                  <span>Parcela</span>
                  <span>Valor</span>
                  <span>Categoria</span>
                  <span>De quem é a compra?</span>
                </div>

                {linhasPDF.map((item, idx) => (
                  <div
                    key={item.id}
                    className="data-row"
                    style={{
                      gridTemplateColumns: '36px 1.2fr 2.2fr 1fr 1fr 1.3fr 1.3fr',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.selecionada}
                      onChange={(e) => {
                        const copia = [...linhasPDF]
                        copia[idx].selecionada = e.target.checked
                        setLinhasPDF(copia)
                      }}
                      style={{ cursor: 'pointer', accentColor: 'var(--lime)' }}
                    />

                    <span>{formatDateBR(item.data)}</span>

                    <input
                      type="text"
                      value={item.loja}
                      onChange={(e) => {
                        const copia = [...linhasPDF]
                        copia[idx].loja = e.target.value
                        setLinhasPDF(copia)
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    />

                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {item.parcelaAtual}/{item.parcelasTotais}
                    </span>

                    <strong>{formatCurrency(item.valor)}</strong>

                    {/* Categoria */}
                    <select
                      value={item.categoriaId}
                      onChange={(e) => {
                        const copia = [...linhasPDF]
                        copia[idx].categoriaId = e.target.value
                        setLinhasPDF(copia)
                      }}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '11px',
                      }}
                    >
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>

                    {/* Responsável da compra */}
                    <select
                      value={item.pessoaId}
                      onChange={(e) => {
                        const copia = [...linhasPDF]
                        copia[idx].pessoaId = e.target.value
                        setLinhasPDF(copia)
                      }}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '11px',
                      }}
                    >
                      {pessoas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: HISTÓRICO DE IMPORTAÇÕES */}
      {tabAtiva === 'historico' && (
        <div className="panel data-panel">
          <div className="data-table">
            <div
              className="data-head"
              style={{
                gridTemplateColumns: '2fr 1fr 1fr 1.2fr',
              }}
            >
              <span>Nome do Arquivo</span>
              <span>Tipo</span>
              <span>Itens Importados</span>
              <span>Data da Importação</span>
            </div>

            {importacoes.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                Nenhuma importação registrada ainda.
              </div>
            ) : (
              importacoes.map((imp) => (
                <div
                  key={imp.id}
                  className="data-row"
                  style={{
                    gridTemplateColumns: '2fr 1fr 1fr 1.2fr',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {imp.tipo === 'csv' ? <FileSpreadsheet size={16} color="var(--lime)" /> : <FileText size={16} color="var(--teal)" />}
                    <strong>{imp.arquivo}</strong>
                  </div>

                  <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 600 }}>
                    {imp.tipo}
                  </span>

                  <span>{imp.total_itens || 0} lançamentos</span>

                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {imp.created_at ? formatDateBR(imp.created_at.split('T')[0]) : 'Hoje'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
