import { Pool } from 'pg'

// Configuração do pool de conexões com PostgreSQL
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'gestao'}`

// Singleton do Pool para evitar múltiplas conexões em desenvolvimento com hot-reload
declare global {
  var _pgPool: Pool | undefined
}

export const pool: Pool =
  global._pgPool ||
  new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect()
  try {
    const res = await client.query(text, params)
    return res.rows as T[]
  } finally {
    client.release()
  }
}

/**
 * Criação automática das tabelas e seeds no PostgreSQL (banco: gestao)
 */
export async function initDb(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Extensão pgcrypto para gen_random_uuid()
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    // 1. USUÁRIO ÚNICO / SESSÃO
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.usuarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        senha_hash TEXT NOT NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 2. PESSOAS
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.pessoas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'admin',
        nome TEXT NOT NULL,
        cor TEXT NOT NULL DEFAULT '#3b82f6',
        contato TEXT,
        ativo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 3. CARTÕES
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cartoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'admin',
        nome TEXT NOT NULL,
        cor TEXT NOT NULL DEFAULT '#8b5cf6',
        limite NUMERIC(12, 2),
        dia_fechamento INTEGER NOT NULL,
        dia_vencimento INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 4. CATEGORIAS
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.categorias (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'admin',
        nome TEXT NOT NULL,
        cor TEXT NOT NULL DEFAULT '#10b981',
        icone TEXT NOT NULL DEFAULT 'Tag',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 5. COMPRAS
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.compras (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'admin',
        descricao TEXT NOT NULL,
        valor_integral NUMERIC(12, 2) NOT NULL,
        parcelas_totais INTEGER NOT NULL DEFAULT 1,
        data_compra DATE NOT NULL DEFAULT current_date,
        cartao_id UUID REFERENCES public.cartoes(id) ON DELETE SET NULL,
        categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
        deletado_em TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 6. PESSOAS_COMPRAS
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.pessoas_compras (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'admin',
        pessoa_id UUID REFERENCES public.pessoas(id) ON DELETE CASCADE NOT NULL,
        compra_id UUID REFERENCES public.compras(id) ON DELETE CASCADE NOT NULL,
        tipo_divisao TEXT NOT NULL,
        percentual NUMERIC(5, 2),
        valor NUMERIC(12, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 7. PARCELAS
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.parcelas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'admin',
        compra_id UUID REFERENCES public.compras(id) ON DELETE CASCADE NOT NULL,
        numero_parcela INTEGER NOT NULL,
        valor NUMERIC(12, 2) NOT NULL,
        data_vencimento DATE NOT NULL,
        paga BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 8. REGRAS DE CATEGORIZAÇÃO
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.regras_categorizacao (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'admin',
        termo TEXT NOT NULL,
        categoria_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 9. IMPORTAÇÕES
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.importacoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'admin',
        arquivo TEXT NOT NULL,
        tipo TEXT NOT NULL,
        status TEXT NOT NULL,
        total_itens INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 10. HISTÓRICO DE ALTERAÇÕES
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.historico_alteracoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'admin',
        entidade TEXT NOT NULL,
        entidade_id UUID NOT NULL,
        acao TEXT NOT NULL,
        dados_antes JSONB,
        dados_depois JSONB,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // Seeds padrão se estiver vazio
    const resPessoas = await client.query('SELECT count(*) FROM public.pessoas WHERE nome = $1', ['Eu'])
    if (parseInt(resPessoas.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO public.pessoas (user_id, nome, cor, ativo)
        VALUES ('admin', 'Eu', '#10b981', true)
      `)
    }

    const resCats = await client.query('SELECT count(*) FROM public.categorias')
    if (parseInt(resCats.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO public.categorias (user_id, nome, cor, icone) VALUES
          ('admin', 'Alimentação', '#f59e0b', 'Utensils'),
          ('admin', 'Transporte', '#3b82f6', 'Car'),
          ('admin', 'Lazer', '#ec4899', 'PartyPopper'),
          ('admin', 'Saúde', '#ef4444', 'HeartPulse'),
          ('admin', 'Moradia', '#8b5cf6', 'Home'),
          ('admin', 'Compras', '#6366f1', 'ShoppingBag'),
          ('admin', 'Assinaturas', '#06b6d4', 'Tv'),
          ('admin', 'Educação', '#14b8a6', 'GraduationCap'),
          ('admin', 'Outros', '#64748b', 'Tag');
      `)
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
