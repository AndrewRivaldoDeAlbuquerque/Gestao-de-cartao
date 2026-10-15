'use client'

import { useState } from 'react'
import {
  Moon,
  Sun,
  ShieldCheck,
  Database,
  LogOut,
  LogIn,
  RotateCcw,
  Sparkles,
  CheckCircle,
} from 'lucide-react'

interface ConfiguracoesViewProps {
  dark: boolean
  onToggleTheme: () => void
  userEmail: string | null
  onOpenLogin: () => void
  onLogout: () => void
  onPopularDadosExemplo: () => Promise<void>
  onNotifyToast: (msg: string) => void
}

export function ConfiguracoesView({
  dark,
  onToggleTheme,
  userEmail,
  onOpenLogin,
  onLogout,
  onPopularDadosExemplo,
  onNotifyToast,
}: ConfiguracoesViewProps) {
  const [loadingExemplo, setLoadingExemplo] = useState(false)

  const handleCarregarExemplos = async () => {
    if (confirm('Deseja carregar dados de exemplo com compras e faturas de teste?')) {
      setLoadingExemplo(true)
      await onPopularDadosExemplo()
      setLoadingExemplo(false)
      onNotifyToast('Dados de exemplo carregados com sucesso!')
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PREFERÊNCIAS E SISTEMA</p>
          <h1>Configurações</h1>
          <p className="subheading">
            Gerencie o tema, o status da conexão com o banco PostgreSQL e utilitários.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
        {/* Painel de Autenticação / PostgreSQL */}
        <div className="panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: userEmail ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: userEmail ? '#10b981' : '#3b82f6',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <ShieldCheck size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '15px', display: 'block' }}>
                  {userEmail ? 'Conectado ao PostgreSQL (banco: gestao)' : 'Modo Local (Offline)'}
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {userEmail
                    ? `Usuário ativo: ${userEmail} · Banco PostgreSQL "gestao"`
                    : 'Armazenamento no navegador. Faça login para sincronizar no PostgreSQL.'}
                </span>
              </div>
            </div>

            {userEmail ? (
              <button onClick={onLogout} className="button-secondary" style={{ gap: '6px' }}>
                <LogOut size={15} /> Desconectar
              </button>
            ) : (
              <button onClick={onOpenLogin} className="button-primary" style={{ gap: '6px' }}>
                <LogIn size={15} /> Conectar ao Banco
              </button>
            )}
          </div>
        </div>

        {/* Aparência e Tema */}
        <div className="panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(200, 241, 105, 0.15)',
                  color: 'var(--lime)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {dark ? <Moon size={20} /> : <Sun size={20} />}
              </div>
              <div>
                <strong style={{ fontSize: '15px', display: 'block' }}>Aparência do Aplicativo</strong>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Tema atual: {dark ? 'Modo Escuro (Dark)' : 'Modo Claro (Light)'}
                </span>
              </div>
            </div>

            <button onClick={onToggleTheme} className="button-secondary" style={{ gap: '6px' }}>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
              Alternar para {dark ? 'Claro' : 'Escuro'}
            </button>
          </div>
        </div>

        {/* Dados de Exemplo / Demonstração */}
        <div className="panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Sparkles size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '15px', display: 'block' }}>Dados de Exemplo Opcionais</strong>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Carregue transações e parcelas demonstrativas para testar a fatura e acertos.
                </span>
              </div>
            </div>

            <button
              onClick={handleCarregarExemplos}
              disabled={loadingExemplo}
              className="button-secondary"
              style={{ gap: '6px' }}
            >
              <RotateCcw size={15} /> Carregar dados demo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
