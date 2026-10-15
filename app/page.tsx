'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Pessoa,
  Cartao,
  Categoria,
  Compra,
  DivisaoPessoaInput,
} from '@/lib/types'
import { StorageService } from '@/lib/storage-service'
import { DashboardView } from '@/components/dashboard-view'
import { FaturaMes } from '@/components/fatura-mes'
import { ComprasView } from '@/components/compras-view'
import { PessoasView } from '@/components/pessoas-view'
import { CartoesView } from '@/components/cartoes-view'
import { CategoriasView } from '@/components/categorias-view'
import { ImportacaoView } from '@/components/importacao-view'
import { HistoricoView } from '@/components/historico-view'
import { ConfiguracoesView } from '@/components/configuracoes-view'
import { ModalCompra } from '@/components/modal-compra'
import { ModalPessoa } from '@/components/modal-pessoa'
import { ModalCartao } from '@/components/modal-cartao'
import { ModalCategoria } from '@/components/modal-categoria'
import { ModalPessoaDetalhes } from '@/components/modal-pessoa-detalhes'
import { RegrasCategorizacaoModal } from '@/components/regras-categorizacao-modal'
import { AuthModal } from '@/components/auth-modal'
import {
  WalletCards,
  LayoutDashboard,
  Receipt,
  ShoppingBag,
  Users,
  CreditCard,
  Tags,
  Upload,
  History,
  Settings,
  Sun,
  Moon,
  Check,
  LogIn,
  LogOut,
  RefreshCw,
  Plus,
} from 'lucide-react'

type TabNav =
  | 'Dashboard'
  | 'Fatura do mês'
  | 'Compras'
  | 'Pessoas'
  | 'Cartões'
  | 'Categorias'
  | 'Importação'
  | 'Histórico'
  | 'Configurações'

const NAV_ITEMS: Array<[TabNav, any]> = [
  ['Dashboard', LayoutDashboard],
  ['Fatura do mês', Receipt],
  ['Compras', ShoppingBag],
  ['Pessoas', Users],
  ['Cartões', CreditCard],
  ['Categorias', Tags],
  ['Importação', Upload],
  ['Histórico', History],
  ['Configurações', Settings],
]

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabNav>('Dashboard')
  const [dark, setDark] = useState(true)
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Autenticação
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  // Dados do sistema
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [compras, setCompras] = useState<Compra[]>([])

  // Modais de Formulários
  const [modalCompraOpen, setModalCompraOpen] = useState(false)
  const [compraEmEdicao, setCompraEmEdicao] = useState<Compra | null>(null)

  const [modalPessoaOpen, setModalPessoaOpen] = useState(false)
  const [pessoaEmEdicao, setPessoaEmEdicao] = useState<Pessoa | null>(null)

  const [modalCartaoOpen, setModalCartaoOpen] = useState(false)
  const [cartaoEmEdicao, setCartaoEmEdicao] = useState<Cartao | null>(null)

  const [modalCategoriaOpen, setModalCategoriaOpen] = useState(false)
  const [categoriaEmEdicao, setCategoriaEmEdicao] = useState<Categoria | null>(null)

  // Detalhes da Pessoa (clique na pessoa)
  const [pessoaSelecionadaDetalhes, setPessoaSelecionadaDetalhes] = useState<Pessoa | null>(null)
  const [modalDetalhesPessoaOpen, setModalDetalhesPessoaOpen] = useState(false)

  // Regras de Categorização
  const [modalRegrasOpen, setModalRegrasOpen] = useState(false)

  const notifyToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current))
    }, 3000)
  }, [])

  // Carregamento inicial de dados
  const carregarDados = useCallback(async () => {
    try {
      setLoading(true)
      await StorageService.inicializarDados()

      // Verifica usuário autenticado no PostgreSQL
      try {
        const authRes = await fetch('/api/auth')
        if (authRes.ok) {
          const authData = await authRes.json()
          if (authData?.user?.email) {
            setUserEmail(authData.user.email)
          }
        }
      } catch {
        // Modo local
      }

      const [pData, cData, catData, compData] = await Promise.all([
        StorageService.getPessoas(),
        StorageService.getCartoes(),
        StorageService.getCategorias(),
        StorageService.getCompras(true), // Carrega ativas e da lixeira
      ])

      setPessoas(pData)
      setCartoes(cData)
      setCategorias(catData)
      setCompras(compData)
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err)
      notifyToast('Erro ao sincronizar dados.')
    } finally {
      setLoading(false)
    }
  }, [notifyToast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Deslogar
  const handleLogout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
      setUserEmail(null)
      notifyToast('Desconectado com sucesso.')
      await carregarDados()
    } catch {
      notifyToast('Falha ao desconectar.')
    }
  }

  // ==========================================
  // HANDLERS DE PESSOAS
  // ==========================================
  const handleSalvarPessoa = async (pessoaData: Omit<Pessoa, 'id'> & { id?: string }) => {
    await StorageService.savePessoa(pessoaData)
    const atualizadas = await StorageService.getPessoas()
    setPessoas(atualizadas)
    notifyToast(pessoaData.id ? 'Pessoa atualizada!' : 'Pessoa criada com sucesso!')
  }

  const handleExcluirOuInativarPessoa = async (id: string) => {
    const res = await StorageService.inativarOuExcluirPessoa(id)
    const atualizadas = await StorageService.getPessoas()
    setPessoas(atualizadas)
    if (res.action === 'inactivated') {
      notifyToast('Pessoa possui compras vinculadas e foi inativada para manter o histórico.')
    } else {
      notifyToast('Pessoa excluída com sucesso.')
    }
  }

  const handleToggleAtivoPessoa = async (pessoa: Pessoa) => {
    await StorageService.savePessoa({ ...pessoa, ativo: !pessoa.ativo })
    const atualizadas = await StorageService.getPessoas()
    setPessoas(atualizadas)
    notifyToast(`Pessoa ${pessoa.ativo ? 'inativada' : 'reativada'}.`)
  }

  // ==========================================
  // HANDLERS DE CARTÕES
  // ==========================================
  const handleSalvarCartao = async (cartaoData: Omit<Cartao, 'id'> & { id?: string }) => {
    await StorageService.saveCartao(cartaoData)
    const atualizados = await StorageService.getCartoes()
    setCartoes(atualizados)
    notifyToast(cartaoData.id ? 'Cartão atualizado!' : 'Cartão criado com sucesso!')
  }

  const handleExcluirCartao = async (id: string) => {
    await StorageService.deleteCartao(id)
    const atualizados = await StorageService.getCartoes()
    setCartoes(atualizados)
    notifyToast('Cartão excluído com sucesso.')
  }

  // ==========================================
  // HANDLERS DE CATEGORIAS
  // ==========================================
  const handleSalvarCategoria = async (catData: Omit<Categoria, 'id'> & { id?: string }) => {
    await StorageService.saveCategoria(catData)
    const atualizadas = await StorageService.getCategorias()
    setCategorias(atualizadas)
    notifyToast(catData.id ? 'Categoria atualizada!' : 'Categoria criada com sucesso!')
  }

  const handleExcluirCategoria = async (id: string) => {
    await StorageService.deleteCategoria(id)
    const atualizadas = await StorageService.getCategorias()
    setCategorias(atualizadas)
    notifyToast('Categoria excluída com sucesso.')
  }

  // ==========================================
  // HANDLERS DE COMPRAS & PARCELAS
  // ==========================================
  const handleSalvarCompra = async (
    compraData: Omit<Compra, 'id' | 'deletado_em'> & { id?: string },
    divisoes: DivisaoPessoaInput[],
    cartaoRef?: Cartao,
    autoQuitarAnteriores?: boolean
  ) => {
    await StorageService.saveCompra(compraData, divisoes, cartaoRef, autoQuitarAnteriores)
    const atualizadas = await StorageService.getCompras(true)
    setCompras(atualizadas)
    notifyToast(compraData.id ? 'Compra e parcelas atualizadas!' : 'Nova compra registrada!')
  }

  const handleSoftDeleteCompra = async (id: string) => {
    await StorageService.softDeleteCompra(id)
    const atualizadas = await StorageService.getCompras(true)
    setCompras(atualizadas)
  }

  const handleRestoreCompra = async (id: string) => {
    await StorageService.restoreCompra(id)
    const atualizadas = await StorageService.getCompras(true)
    setCompras(atualizadas)
  }

  const handleDeletePermanenteCompra = async (id: string) => {
    await StorageService.deletePermanenteCompra(id)
    const atualizadas = await StorageService.getCompras(true)
    setCompras(atualizadas)
  }

  const handleEncerrarAssinatura = async (id: string) => {
    await StorageService.encerrarAssinatura(id)
    const atualizadas = await StorageService.getCompras(true)
    setCompras(atualizadas)
    notifyToast('Assinatura encerrada. Cobranças futuras foram interrompidas.')
  }

  const handleReativarAssinatura = async (id: string) => {
    await StorageService.reativarAssinatura(id)
    const atualizadas = await StorageService.getCompras(true)
    setCompras(atualizadas)
    notifyToast('Assinatura reativada com sucesso!')
  }

  const handleTogglePagaParcela = async (parcelaId: string, paga: boolean) => {
    await StorageService.togglePagaParcela(parcelaId, paga)
    const atualizadas = await StorageService.getCompras(true)
    setCompras(atualizadas)
    notifyToast(paga ? 'Parcela marcada como paga.' : 'Pagamento desmarcado.')
  }

  const handleMarcarLotePagas = async (parcelaIds: string[], paga: boolean) => {
    await StorageService.marcarParcelasPagasEmLote(parcelaIds, paga)
    const atualizadas = await StorageService.getCompras(true)
    setCompras(atualizadas)
  }

  const handlePopularDadosExemplo = async () => {
    await StorageService.popularDadosExemplo()
    await carregarDados()
  }

  return (
    <main className={dark ? 'app-shell dark-mode' : 'app-shell'}>
      {/* SIDEBAR DESKTOP */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <WalletCards size={18} />
          </div>
          <span>Gestão de Cartão</span>
        </div>

        {/* Status / Workspace */}
        <div
          className="workspace-switcher"
          onClick={() => (!userEmail ? setAuthModalOpen(true) : null)}
          style={{ cursor: !userEmail ? 'pointer' : 'default' }}
          title={userEmail ? `Logado como ${userEmail}` : 'Clique para fazer login'}
        >
          <div className="workspace-avatar">
            {userEmail ? userEmail.slice(0, 2).toUpperCase() : 'GC'}
          </div>
          <div>
            <strong>{userEmail ? 'PostgreSQL (gestao)' : 'Modo Local'}</strong>
            <span>{userEmail ? userEmail : 'Toque para conectar'}</span>
          </div>
          {!userEmail && <LogIn size={14} color="var(--lime)" />}
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <nav className="nav-list">
          <p className="nav-label">MENU PRINCIPAL</p>
          {NAV_ITEMS.map(([label, Icon]) => {
            const isActive = activeTab === label
            return (
              <button
                key={label}
                className={isActive ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveTab(label)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* RODAPÉ DO SIDEBAR */}
        <div className="sidebar-footer">
          <div className="user-avatar">
            {userEmail ? userEmail.slice(0, 2).toUpperCase() : 'EU'}
          </div>
          <div>
            <strong>{userEmail || 'Usuário Local'}</strong>
            <span>{userEmail ? 'Conectado (RLS)' : 'Demonstração'}</span>
          </div>
          {userEmail ? (
            <button
              onClick={handleLogout}
              className="icon-button"
              title="Sair do Supabase"
            >
              <LogOut size={16} />
            </button>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="icon-button"
              title="Fazer Login"
            >
              <LogIn size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <section className="content-area">
        {/* BARRA SUPERIOR (TOPBAR) */}
        <header className="topbar">
          <div className="mobile-brand">
            <WalletCards size={18} />
            <span>Gestão de Cartão</span>
          </div>

          <div className="breadcrumb">
            <span>Visão geral</span>
            <span>/</span>
            <strong>{activeTab}</strong>
          </div>

          <div className="top-actions">
            {/* Botão de Ação Rápida */}
            <button
              onClick={() => {
                setCompraEmEdicao(null)
                setModalCompraOpen(true)
              }}
              className="button-primary"
              style={{ fontSize: '12px', padding: '7px 12px', gap: '6px' }}
            >
              <Plus size={15} /> Nova compra
            </button>

            {/* Alternar Tema */}
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label="Alternar modo de cor"
              title={dark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Login / Avatar */}
            {userEmail ? (
              <button
                className="top-avatar"
                title={`Logado como ${userEmail}`}
                onClick={() => setActiveTab('Configurações')}
              >
                {userEmail.slice(0, 2).toUpperCase()}
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="button-secondary"
                style={{ fontSize: '11px', padding: '6px 10px', gap: '4px' }}
              >
                <LogIn size={14} /> Entrar
              </button>
            )}
          </div>
        </header>

        {/* CONTEÚDO DINÂMICO DA PÁGINA */}
        <div className="page-content">
          {loading ? (
            <div
              style={{
                minHeight: '300px',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--muted)',
                gap: '12px',
              }}
            >
              <RefreshCw className="animate-spin" size={24} />
              <span style={{ fontSize: '13px' }}>Carregando dados da aplicação...</span>
            </div>
          ) : (
            <>
              {activeTab === 'Dashboard' && (
                <DashboardView
                  compras={compras}
                  cartoes={cartoes}
                  categorias={categorias}
                  pessoas={pessoas}
                  onSelectPessoa={(pessoa) => {
                    setPessoaSelecionadaDetalhes(pessoa)
                    setModalDetalhesPessoaOpen(true)
                  }}
                />
              )}

              {activeTab === 'Fatura do mês' && (
                <FaturaMes
                  compras={compras.filter((c) => !c.deletado_em)}
                  cartoes={cartoes}
                  categorias={categorias}
                  pessoas={pessoas}
                  onTogglePaga={handleTogglePagaParcela}
                  onMarcarLotePagas={handleMarcarLotePagas}
                  onNotifyToast={notifyToast}
                />
              )}

              {activeTab === 'Compras' && (
                <ComprasView
                  compras={compras}
                  cartoes={cartoes}
                  categorias={categorias}
                  pessoas={pessoas}
                  onNovaCompra={() => {
                    setCompraEmEdicao(null)
                    setModalCompraOpen(true)
                  }}
                  onEditarCompra={(compra) => {
                    setCompraEmEdicao(compra)
                    setModalCompraOpen(true)
                  }}
                  onSoftDelete={handleSoftDeleteCompra}
                  onRestore={handleRestoreCompra}
                  onDeletePermanente={handleDeletePermanenteCompra}
                  onEncerrarAssinatura={handleEncerrarAssinatura}
                  onReativarAssinatura={handleReativarAssinatura}
                  onNotifyToast={notifyToast}
                />
              )}

              {activeTab === 'Pessoas' && (
                <PessoasView
                  pessoas={pessoas}
                  compras={compras}
                  onNovaPessoa={() => {
                    setPessoaEmEdicao(null)
                    setModalPessoaOpen(true)
                  }}
                  onEditarPessoa={(pessoa) => {
                    setPessoaEmEdicao(pessoa)
                    setModalPessoaOpen(true)
                  }}
                  onSelectPessoa={(pessoa) => {
                    setPessoaSelecionadaDetalhes(pessoa)
                    setModalDetalhesPessoaOpen(true)
                  }}
                  onExcluirOuInativar={handleExcluirOuInativarPessoa}
                  onToggleAtivo={handleToggleAtivoPessoa}
                  onNotifyToast={notifyToast}
                />
              )}

              {activeTab === 'Cartões' && (
                <CartoesView
                  cartoes={cartoes}
                  onNovoCartao={() => {
                    setCartaoEmEdicao(null)
                    setModalCartaoOpen(true)
                  }}
                  onEditarCartao={(cartao) => {
                    setCartaoEmEdicao(cartao)
                    setModalCartaoOpen(true)
                  }}
                  onExcluirCartao={handleExcluirCartao}
                />
              )}

              {activeTab === 'Categorias' && (
                <CategoriasView
                  categorias={categorias}
                  onNovaCategoria={() => {
                    setCategoriaEmEdicao(null)
                    setModalCategoriaOpen(true)
                  }}
                  onEditarCategoria={(cat) => {
                    setCategoriaEmEdicao(cat)
                    setModalCategoriaOpen(true)
                  }}
                  onExcluirCategoria={handleExcluirCategoria}
                  onAbrirRegras={() => setModalRegrasOpen(true)}
                />
              )}

              {activeTab === 'Importação' && (
                <ImportacaoView
                  cartoes={cartoes}
                  categorias={categorias}
                  pessoas={pessoas}
                  onImportacaoSucesso={carregarDados}
                  onNotifyToast={notifyToast}
                />
              )}

              {activeTab === 'Histórico' && (
                <HistoricoView
                  onRestaurarSucesso={carregarDados}
                  onNotifyToast={notifyToast}
                />
              )}

              {activeTab === 'Configurações' && (
                <ConfiguracoesView
                  dark={dark}
                  onToggleTheme={() => setDark(!dark)}
                  userEmail={userEmail}
                  onOpenLogin={() => setAuthModalOpen(true)}
                  onLogout={handleLogout}
                  onPopularDadosExemplo={handlePopularDadosExemplo}
                  onNotifyToast={notifyToast}
                />
              )}
            </>
          )}
        </div>
      </section>

      {/* TOAST FLUTUANTE DE CONFIRMAÇÃO */}
      {toastMessage && (
        <div className="toast">
          <Check size={16} color="var(--lime)" />
          {toastMessage}
        </div>
      )}

      {/* MODAL DE COMPRAS */}
      <ModalCompra
        isOpen={modalCompraOpen}
        onClose={() => {
          setModalCompraOpen(false)
          setCompraEmEdicao(null)
        }}
        onSave={handleSalvarCompra}
        initialData={compraEmEdicao}
        cartoes={cartoes}
        categorias={categorias}
        pessoas={pessoas}
      />

      {/* MODAL DE PESSOAS */}
      <ModalPessoa
        isOpen={modalPessoaOpen}
        onClose={() => {
          setModalPessoaOpen(false)
          setPessoaEmEdicao(null)
        }}
        onSave={handleSalvarPessoa}
        initialData={pessoaEmEdicao}
      />

      {/* MODAL DE CARTÕES */}
      <ModalCartao
        isOpen={modalCartaoOpen}
        onClose={() => {
          setModalCartaoOpen(false)
          setCartaoEmEdicao(null)
        }}
        onSave={handleSalvarCartao}
        initialData={cartaoEmEdicao}
      />

      {/* MODAL DE CATEGORIAS */}
      <ModalCategoria
        isOpen={modalCategoriaOpen}
        onClose={() => {
          setModalCategoriaOpen(false)
          setCategoriaEmEdicao(null)
        }}
        onSave={handleSalvarCategoria}
        initialData={categoriaEmEdicao}
      />

      {/* MODAL DETALHES DA PESSOA (COMPRAS DO MÊS E HISTÓRICO) */}
      <ModalPessoaDetalhes
        isOpen={modalDetalhesPessoaOpen}
        onClose={() => {
          setModalDetalhesPessoaOpen(false)
          setPessoaSelecionadaDetalhes(null)
        }}
        pessoa={pessoaSelecionadaDetalhes}
        compras={compras}
        cartoes={cartoes}
        onNotifyToast={notifyToast}
      />

      {/* MODAL DE REGRAS DE CATEGORIZAÇÃO AUTOMÁTICA */}
      <RegrasCategorizacaoModal
        isOpen={modalRegrasOpen}
        onClose={() => setModalRegrasOpen(false)}
        categorias={categorias}
        onNotifyToast={notifyToast}
      />

      {/* MODAL DE AUTENTICAÇÃO */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(email) => {
          setUserEmail(email)
          notifyToast(`Autenticado com sucesso como ${email}!`)
          carregarDados()
        }}
      />
    </main>
  )
}
