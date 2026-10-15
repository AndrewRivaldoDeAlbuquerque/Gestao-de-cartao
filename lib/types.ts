export type TipoDivisao = 'igualitaria' | 'percentual' | 'valor_fixo'

export type ParcelaStatus = 'paga' | 'ultima_parcela' | 'vence_em_breve' | 'vencida' | 'a_vencer'

export interface Pessoa {
  id: string
  user_id?: string
  nome: string
  cor: string
  contato?: string | null
  ativo: boolean
  created_at?: string
}

export interface Cartao {
  id: string
  user_id?: string
  nome: string
  cor: string
  limite?: number | null
  dia_fechamento: number
  dia_vencimento: number
  created_at?: string
}

export interface Categoria {
  id: string
  user_id?: string
  nome: string
  cor: string
  icone: string
  created_at?: string
}

export interface PessoaCompra {
  id: string
  user_id?: string
  pessoa_id: string
  compra_id: string
  tipo_divisao: TipoDivisao
  percentual?: number | null
  valor: number // em reais com centavos ex: 45.50
  created_at?: string
}

export interface Parcela {
  id: string
  user_id?: string
  compra_id: string
  numero_parcela: number
  valor: number
  data_vencimento: string // yyyy-mm-dd
  paga: boolean
  created_at?: string
}

export interface Compra {
  id: string
  user_id?: string
  descricao: string
  valor_integral: number
  parcelas_totais: number
  data_compra: string // yyyy-mm-dd
  cartao_id?: string | null
  categoria_id?: string | null
  deletado_em?: string | null
  created_at?: string
  fixa?: boolean
  encerrada_em?: string | null
  // Relações opcionais expandidas
  pessoas_compras?: PessoaCompra[]
  parcelas?: Parcela[]
}

export interface DivisaoPessoaInput {
  pessoa_id: string
  tipo_divisao: TipoDivisao
  percentual?: number
  valor?: number
}

export interface RegraCategorizacao {
  id: string
  user_id?: string
  termo: string
  categoria_id: string
  created_at?: string
}

export interface Importacao {
  id: string
  user_id?: string
  arquivo: string
  tipo: 'csv' | 'pdf'
  status: 'concluido' | 'pendente' | 'erro'
  total_itens?: number
  created_at?: string
}

export interface HistoricoAlteracao {
  id: string
  user_id?: string
  entidade: 'compra' | 'pessoa' | 'cartao' | 'categoria'
  entidade_id: string
  acao: 'criacao' | 'edicao' | 'exclusao' | 'restauracao'
  dados_antes?: any
  dados_depois?: any
  criado_em: string
}

