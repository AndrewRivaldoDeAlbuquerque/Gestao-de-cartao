-- ===================================================================
-- SCHEMA: Gestão de Cartão (Banco: gestao)
-- ===================================================================

-- Habilitar extensão para geração de UUID
create extension if not exists "pgcrypto";

-- 1. TABELA DE PESSOAS
create table if not exists public.pessoas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  cor text not null default '#3b82f6',
  contato text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. TABELA DE CARTÕES
create table if not exists public.cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  cor text not null default '#8b5cf6',
  limite numeric(12, 2),
  dia_fechamento integer not null check (dia_fechamento between 1 and 31),
  dia_vencimento integer not null check (dia_vencimento between 1 and 31),
  created_at timestamptz not null default now()
);

-- 3. TABELA DE CATEGORIAS
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  cor text not null default '#10b981',
  icone text not null default 'Tag',
  created_at timestamptz not null default now()
);

-- 4. TABELA DE COMPRAS
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  descricao text not null,
  valor_integral numeric(12, 2) not null check (valor_integral > 0),
  parcelas_totais integer not null default 1 check (parcelas_totais >= 1),
  data_compra date not null default current_date,
  cartao_id uuid references public.cartoes(id) on delete set null,
  categoria_id uuid references public.categorias(id) on delete set null,
  deletado_em timestamptz default null,
  created_at timestamptz not null default now()
);

-- 5. TABELA DE DIVISÃO ENTRE PESSOAS (PESSOAS_COMPRAS)
create table if not exists public.pessoas_compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  pessoa_id uuid references public.pessoas(id) on delete cascade not null,
  compra_id uuid references public.compras(id) on delete cascade not null,
  tipo_divisao text not null check (tipo_divisao in ('igualitaria', 'percentual', 'valor_fixo')),
  percentual numeric(5, 2),
  valor numeric(12, 2) not null check (valor >= 0),
  created_at timestamptz not null default now()
);

-- 6. TABELA DE PARCELAS
create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  compra_id uuid references public.compras(id) on delete cascade not null,
  numero_parcela integer not null check (numero_parcela >= 1),
  valor numeric(12, 2) not null check (valor > 0),
  data_vencimento date not null,
  paga boolean not null default false,
  created_at timestamptz not null default now()
);

-- Índices de performance
create index if not exists idx_compras_user_cartao on public.compras(user_id, cartao_id);
create index if not exists idx_compras_deletado on public.compras(deletado_em);
create index if not exists idx_parcelas_vencimento on public.parcelas(data_vencimento, paga);
create index if_not_exists idx_pessoas_compras_compra on public.pessoas_compras(compra_id);

-- ===================================================================
-- ROW LEVEL SECURITY (RLS) - ISOLAMENTO POR auth.uid() = user_id
-- ===================================================================

alter table public.pessoas enable row level security;
alter table public.cartoes enable row level security;
alter table public.categorias enable row level security;
alter table public.compras enable row level security;
alter table public.pessoas_compras enable row level security;
alter table public.parcelas enable row level security;

-- Políticas para pessoas
drop policy if exists "Acesso_Pessoas_User" on public.pessoas;
create policy "Acesso_Pessoas_User" on public.pessoas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Políticas para cartões
drop policy if exists "Acesso_Cartoes_User" on public.cartoes;
create policy "Acesso_Cartoes_User" on public.cartoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Políticas para categorias
drop policy if exists "Acesso_Categorias_User" on public.categorias;
create policy "Acesso_Categorias_User" on public.categorias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Políticas para compras
drop policy if exists "Acesso_Compras_User" on public.compras;
create policy "Acesso_Compras_User" on public.compras
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Políticas para pessoas_compras
drop policy if exists "Acesso_PessoasCompras_User" on public.pessoas_compras;
create policy "Acesso_PessoasCompras_User" on public.pessoas_compras
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Políticas para parcelas
drop policy if exists "Acesso_Parcelas_User" on public.parcelas;
create policy "Acesso_Parcelas_User" on public.parcelas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===================================================================
-- SEED AUTOMÁTICO DE USUÁRIO (TRIGGER: "Eu" + Categorias padrão)
-- ===================================================================
create or replace function public.handle_new_user_setup()
returns trigger as $$
begin
  -- 1. Cria a pessoa padrão "Eu"
  insert into public.pessoas (user_id, nome, cor, ativo)
  values (new.id, 'Eu', '#10b981', true);

  -- 2. Cria as categorias padrão
  insert into public.categorias (user_id, nome, cor, icone) values
    (new.id, 'Alimentação', '#f59e0b', 'Utensils'),
    (new.id, 'Transporte', '#3b82f6', 'Car'),
    (new.id, 'Lazer', '#ec4899', 'PartyPopper'),
    (new.id, 'Saúde', '#ef4444', 'HeartPulse'),
    (new.id, 'Moradia', '#8b5cf6', 'Home'),
    (new.id, 'Compras', '#6366f1', 'ShoppingBag'),
    (new.id, 'Assinaturas', '#06b6d4', 'Tv'),
    (new.id, 'Educação', '#14b8a6', 'GraduationCap'),
    (new.id, 'Outros', '#64748b', 'Tag');

  return new;
end;
$$ language plpgsql security definer;

-- Trigger para auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_setup();

-- ===================================================================
-- 7. TABELA DE REGRAS DE CATEGORIZAÇÃO AUTOMÁTICA
-- ===================================================================
create table if not exists public.regras_categorizacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  termo text not null,
  categoria_id uuid references public.categorias(id) on delete cascade not null,
  created_at timestamptz not null default now()
);

-- ===================================================================
-- 8. TABELA DE IMPORTAÇÕES (CSV / PDF)
-- ===================================================================
create table if not exists public.importacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  arquivo text not null,
  tipo text not null check (tipo in ('csv', 'pdf')),
  status text not null check (status in ('concluido', 'pendente', 'erro')),
  total_itens integer default 0,
  created_at timestamptz not null default now()
);

-- ===================================================================
-- 9. TABELA DE HISTÓRICO DE ALTERAÇÕES (AUDITORIA / RESTAURAÇÃO)
-- ===================================================================
create table if not exists public.historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entidade text not null check (entidade in ('compra', 'pessoa', 'cartao', 'categoria')),
  entidade_id uuid not null,
  acao text not null check (acao in ('criacao', 'edicao', 'exclusao', 'restauracao')),
  dados_antes jsonb,
  dados_depois jsonb,
  criado_em timestamptz not null default now()
);

-- Índices adicionais
create index if not exists idx_regras_user on public.regras_categorizacao(user_id);
create index if not exists idx_importacoes_user on public.importacoes(user_id);
create index if not exists idx_historico_user_entidade on public.historico_alteracoes(user_id, entidade, criado_em desc);

-- RLS para as novas tabelas
alter table public.regras_categorizacao enable row level security;
alter table public.importacoes enable row level security;
alter table public.historico_alteracoes enable row level security;

drop policy if exists "Acesso_Regras_User" on public.regras_categorizacao;
create policy "Acesso_Regras_User" on public.regras_categorizacao
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Acesso_Importacoes_User" on public.importacoes;
create policy "Acesso_Importacoes_User" on public.importacoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Acesso_Historico_User" on public.historico_alteracoes;
create policy "Acesso_Historico_User" on public.historico_alteracoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

