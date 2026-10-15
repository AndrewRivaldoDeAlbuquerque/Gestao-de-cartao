import { Parcela, ParcelaStatus, Cartao, Compra, Categoria, Pessoa, PessoaCompra } from './types'

/**
 * Converte valor float em centavos inteiros para evitar qualquer erro de ponto flutuante
 */
export function toCents(val: number): number {
  return Math.round(val * 100)
}

/**
 * Converte centavos inteiros de volta para float com 2 casas decimais
 */
export function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Formata valor monetário no padrão brasileiro R$ 1.234,56
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

/**
 * Formata data no formato brasileiro dd/mm/aaaa (sem hora)
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return ''
  // Remove qualquer parte de hora caso venha no formato ISO (ex: "2026-07-15T03:00:00.000Z")
  const dateOnly = String(dateStr).split('T')[0]
  const parts = dateOnly.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('pt-BR')
}

/**
 * Obtém a data de hoje no formato yyyy-mm-dd
 */
export function getTodayString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Regra bancária de cálculo da data de vencimento da 1ª parcela e subsequentes:
 * Se data_compra <= dia_fechamento -> entra na fatura atual (ciclo do mês da compra).
 * Se data_compra > dia_fechamento  -> pula para o próximo ciclo (mês seguinte).
 * 
 * Se o dia de vencimento for menor que o dia de fechamento (ex: fecha dia 25 e vence dia 05 do mês seguinte),
 * a fatura fecha em um mês e vence no mês civil subsequente.
 */
export function calcularVencimentos(
  dataCompraStr: string,
  cartao: Pick<Cartao, 'dia_fechamento' | 'dia_vencimento'>,
  totalParcelas: number
): string[] {
  const [cYear, cMonth, cDay] = dataCompraStr.split('-').map(Number)
  const diaCompra = cDay
  const diaFechamento = cartao.dia_fechamento || 15
  const diaVencimento = cartao.dia_vencimento || 20

  // Determinar o mês/ano de fechamento da 1ª parcela
  let faturaYear = cYear
  let faturaMonth = cMonth // 1-12

  if (diaCompra > diaFechamento) {
    // Pula para o ciclo do próximo mês
    faturaMonth += 1
    if (faturaMonth > 12) {
      faturaMonth = 1
      faturaYear += 1
    }
  }

  // Se o dia de vencimento for numericamente menor ou igual ao fechamento (ex: fecha 25 e vence 05),
  // o vencimento efetivo é no mês posterior ao mês de referência do fechamento
  let shiftVencimento = 0
  if (diaVencimento <= diaFechamento) {
    shiftVencimento = 1
  }

  const vencimentos: string[] = []

  for (let i = 0; i < totalParcelas; i++) {
    let pMonth = faturaMonth + shiftVencimento + i
    let pYear = faturaYear

    while (pMonth > 12) {
      pMonth -= 12
      pYear += 1
    }

    // Ajusta para o último dia do mês caso o mês tenha menos dias (ex: fevereiro dia 30 -> dia 28/29)
    const ultimoDiaDoMes = new Date(pYear, pMonth, 0).getDate()
    const diaEfetivo = Math.min(diaVencimento, ultimoDiaDoMes)

    const yStr = String(pYear)
    const mStr = String(pMonth).padStart(2, '0')
    const dStr = String(diaEfetivo).padStart(2, '0')

    vencimentos.push(`${yStr}-${mStr}-${dStr}`)
  }

  return vencimentos
}

/**
 * Formata ano-mes (ex: "2026-08" ou "2026-08-15") para texto legível em português (ex: "Agosto/2026")
 */
export function formatarMesAno(dateStr: string): string {
  if (!dateStr) return ''
  const partes = dateStr.split('-')
  if (partes.length < 2) return dateStr
  const ano = partes[0]
  const mesNum = parseInt(partes[1], 10)
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const nomeMes = meses[mesNum - 1] || partes[1]
  return `${nomeMes}/${ano}`
}

/**
 * Identifica se uma compra é fixa/recorrente (assinatura)
 */
export function isCompraFixa(
  compra?: Pick<Compra, 'fixa' | 'categoria_id'> | null,
  categoria?: Pick<Categoria, 'id' | 'nome'> | null
): boolean {
  if (!compra) return false
  if (compra.fixa) return true
  if (categoria && categoria.nome && categoria.nome.toLowerCase() === 'assinaturas') return true
  return false
}

/**
 * Gera parcelas dividindo o valor total em centavos,
 * garantindo que a última parcela absorva a diferença dos centavos.
 * Se autoQuitarAnteriores for true, parcelas de meses anteriores ao mês atual já nascem como pagas.
 * Se isFixa for true, cada parcela terá o valor integral da mensalidade (recorrente).
 */
export function gerarParcelas(
  compraId: string,
  valorTotal: number,
  totalParcelas: number,
  vencimentos: string[],
  autoQuitarAnteriores = false,
  isFixa = false
): Parcela[] {
  const totalCents = toCents(valorTotal)
  const baseCents = isFixa ? totalCents : Math.floor(totalCents / totalParcelas)
  let acumulado = 0
  const parcelas: Parcela[] = []

  const hoje = new Date()
  const mesAnoAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  for (let i = 1; i <= totalParcelas; i++) {
    const isUltima = i === totalParcelas
    const valorParcelaCents = isFixa ? totalCents : (isUltima ? totalCents - acumulado : baseCents)
    acumulado += valorParcelaCents
    const dataVenc = vencimentos[i - 1] || getTodayString()

    // Se o vencimento é de um mês civil anterior ao mês atual e autoQuitar foi solicitado
    const isPassada = dataVenc.slice(0, 7) < mesAnoAtualStr
    const jaPaga = autoQuitarAnteriores && isPassada

    parcelas.push({
      id: crypto.randomUUID(),
      compra_id: compraId,
      numero_parcela: i,
      valor: fromCents(valorParcelaCents),
      data_vencimento: dataVenc,
      paga: jaPaga,
    })
  }

  return parcelas
}

/**
 * Retorna as informações da parcela atual em relação ao mês corrente (ou mês de referência):
 * - numeroParcelaAtual: número da parcela que vence no mês atual
 * - parcelaAtual: objeto da parcela do mês
 * - totalParcelas: total de parcelas
 * - totalPagas: quantas parcelas já foram pagas
 * - statusTexto: representação amigável (ex: "3ª de 5", ou "Fixa")
 */
export function getInfoParcelaMesAtual(
  parcelas: Parcela[],
  dataRef = new Date(),
  isFixa = false,
  encerradaEm?: string | null
): {
  numeroParcelaAtual: number | null
  parcelaAtual: Parcela | null
  totalParcelas: number
  totalPagas: number
  statusTexto: string
} {
  if (!parcelas || parcelas.length === 0) {
    if (isFixa) {
      return {
        numeroParcelaAtual: null,
        parcelaAtual: null,
        totalParcelas: 1,
        totalPagas: 0,
        statusTexto: encerradaEm ? 'Encerrada' : 'Fixa',
      }
    }
    return { numeroParcelaAtual: null, parcelaAtual: null, totalParcelas: 0, totalPagas: 0, statusTexto: '—' }
  }

  const prefixoMes = `${dataRef.getFullYear()}-${String(dataRef.getMonth() + 1).padStart(2, '0')}`
  const ordenadas = [...parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela)
  const totalParcelas = ordenadas.length
  const totalPagas = ordenadas.filter((p) => p.paga).length

  // Tenta encontrar a parcela do mês atual
  const parcelaMes = ordenadas.find((p) => p.data_vencimento.startsWith(prefixoMes))

  if (isFixa) {
    return {
      numeroParcelaAtual: parcelaMes?.numero_parcela ?? null,
      parcelaAtual: parcelaMes ?? null,
      totalParcelas,
      totalPagas,
      statusTexto: encerradaEm ? 'Encerrada' : 'Fixa',
    }
  }

  if (parcelaMes) {
    return {
      numeroParcelaAtual: parcelaMes.numero_parcela,
      parcelaAtual: parcelaMes,
      totalParcelas,
      totalPagas,
      statusTexto: `${parcelaMes.numero_parcela}ª de ${totalParcelas}`,
    }
  }

  // Se o mês atual for anterior à primeira parcela:
  const primeira = ordenadas[0]
  if (primeira && prefixoMes < primeira.data_vencimento.slice(0, 7)) {
    return {
      numeroParcelaAtual: 1,
      parcelaAtual: primeira,
      totalParcelas,
      totalPagas,
      statusTexto: `Inicia em ${formatarMesAno(primeira.data_vencimento)}`,
    }
  }

  // Se o mês atual for posterior à última parcela:
  const ultima = ordenadas[ordenadas.length - 1]
  if (ultima && prefixoMes > ultima.data_vencimento.slice(0, 7)) {
    return {
      numeroParcelaAtual: totalParcelas,
      parcelaAtual: ultima,
      totalParcelas,
      totalPagas,
      statusTexto: totalPagas === totalParcelas ? 'Quitada' : 'Finalizada',
    }
  }

  // Se todas as parcelas já foram pagas:
  if (totalPagas === totalParcelas && totalParcelas > 0) {
    return {
      numeroParcelaAtual: totalParcelas,
      parcelaAtual: ultima,
      totalParcelas,
      totalPagas,
      statusTexto: 'Quitada',
    }
  }

  // Se está entre a primeira e a última parcela mas não há parcela com prefixo exato deste mês,
  // encontra a próxima parcela não paga ou a mais próxima cronologicamente
  const proximaNaoPaga =
    ordenadas.find((p) => !p.paga && p.data_vencimento.slice(0, 7) >= prefixoMes) ||
    ordenadas.find((p) => !p.paga) ||
    ordenadas.find((p) => p.data_vencimento.slice(0, 7) >= prefixoMes) ||
    ultima

  if (proximaNaoPaga) {
    return {
      numeroParcelaAtual: proximaNaoPaga.numero_parcela,
      parcelaAtual: proximaNaoPaga,
      totalParcelas,
      totalPagas,
      statusTexto: `${proximaNaoPaga.numero_parcela}ª de ${totalParcelas}`,
    }
  }

  return {
    numeroParcelaAtual: null,
    parcelaAtual: null,
    totalParcelas,
    totalPagas,
    statusTexto: `${totalParcelas}x`,
  }
}

/**
 * Calcula o status de uma parcela conforme os requisitos:
 * - Paga: se flag paga = true
 * - Última parcela: se numero_parcela = parcelas_totais (e não paga e não fixa)
 * - Vencida: data_vencimento < hoje
 * - Vence em breve: vence nos próximos 7 dias (inclusive hoje)
 * - A vencer: data_vencimento > 7 dias
 */
export function calcularStatusParcela(
  parcela: Parcela,
  parcelasTotais: number,
  hojeStr: string = getTodayString(),
  isFixa: boolean = false
): ParcelaStatus {
  if (parcela.paga) return 'paga'
  if (!isFixa && parcela.numero_parcela === parcelasTotais) return 'ultima_parcela'

  const hoje = new Date(hojeStr + 'T00:00:00')
  const venc = new Date(parcela.data_vencimento + 'T00:00:00')

  const diffTime = venc.getTime() - hoje.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'vencida'
  if (diffDays <= 7) return 'vence_em_breve'
  return 'a_vencer'
}

export function getStatusBadgeInfo(status: ParcelaStatus): {
  label: string
  bg: string
  color: string
} {
  switch (status) {
    case 'paga':
      return { label: 'Paga', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }
    case 'ultima_parcela':
      return { label: 'Última parcela', bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }
    case 'vencida':
      return { label: 'Vencida', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
    case 'vence_em_breve':
      return { label: 'Vence em breve (7d)', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }
    case 'a_vencer':
    default:
      return { label: 'A vencer', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }
  }
}

/**
 * Gera mensagem formatada para WhatsApp de fechamento de acertos
 */
export function gerarMensagemWhatsApp(
  mesAnoStr: string,
  totaisPorPessoa: { nome: string; contato?: string | null; valor: number }[]
): string {
  let msg = `💳 *Fechamento de Cartão - ${mesAnoStr}*\n\n`
  msg += `Olá! Segue o resumo das faturas e divisões do mês:\n\n`

  totaisPorPessoa.forEach((p) => {
    if (p.nome.toLowerCase() !== 'eu') {
      msg += `👤 *${p.nome}*: ${formatCurrency(p.valor)}\n`
    }
  })

  const totalGeralOutros = totaisPorPessoa
    .filter((p) => p.nome.toLowerCase() !== 'eu')
    .reduce((acc, curr) => acc + curr.valor, 0)

  msg += `\n💰 *Total a receber:* ${formatCurrency(totalGeralOutros)}\n`
  msg += `\nPor favor, confirme após efetuar o Pix! Obrigado!`

  return msg
}

/**
 * Gera mensagem formatada para WhatsApp de fechamento de acerto individual de uma pessoa
 */
export function gerarMensagemWhatsAppPessoa(
  nomePessoa: string,
  mesAnoStr: string,
  itens: Array<{
    descricao: string
    numeroParcela: number
    totalParcelas: number
    cartaoNome: string
    valor: number
    vencimento?: string
  }>,
  totalDevido: number
): string {
  let msg = `💳 *Fechamento de Acerto - ${mesAnoStr}*\n`
  msg += `👤 *Pessoa:* ${nomePessoa}\n\n`
  msg += `Olá, ${nomePessoa}! Segue o detalhamento das suas despesas no cartão para ${mesAnoStr}:\n\n`

  itens.forEach((it) => {
    msg += `• *${it.descricao}* (${it.numeroParcela}/${it.totalParcelas} - ${it.cartaoNome}): ${formatCurrency(it.valor)}\n`
  })

  msg += `\n💰 *Total a acertar:* ${formatCurrency(totalDevido)}\n`
  msg += `\nPor favor, confirme após efetuar o Pix! Obrigado!`

  return msg
}

/**
 * Exporta dados da fatura para CSV
 */
export function exportarFaturaCSV(
  mesAnoStr: string,
  linhas: Array<{
    descricao: string
    cartao: string
    categoria: string
    parcela: string
    vencimento: string
    pessoas: string
    valor: number
    status: string
  }>
) {
  const cabecalho = ['Descrição', 'Cartão', 'Categoria', 'Parcela', 'Vencimento', 'Pessoas', 'Valor', 'Status']
  const rows = linhas.map((l) => [
    `"${l.descricao.replace(/"/g, '""')}"`,
    `"${l.cartao}"`,
    `"${l.categoria}"`,
    `"${l.parcela}"`,
    `"${formatDateBR(l.vencimento)}"`,
    `"${l.pessoas}"`,
    `"${l.valor.toFixed(2).replace('.', ',')}"`,
    `"${l.status}"`,
  ])

  const csvContent = '\uFEFF' + [cabecalho.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `fatura_${mesAnoStr.replace('/', '_')}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
