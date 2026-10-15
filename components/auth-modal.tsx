'use client'

import { useState } from 'react'
import { Lock, Mail, ArrowRight, RefreshCw, KeyRound, ShieldCheck, X } from 'lucide-react'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (email: string) => void
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isRecovering, setIsRecovering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  if (!isOpen) return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        setMessage({ text: data.error || 'Falha ao autenticar.', type: 'error' })
        return
      }

      if (data.user) {
        onSuccess(data.user.email || email)
        onClose()
      }
    } catch {
      setMessage({
        text: 'Não foi possível conectar ao banco PostgreSQL. Verifique se o servidor está ativo.',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setMessage({ text: 'Informe seu e-mail cadastrado.', type: 'error' })
      return
    }
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recovery',
          email: email.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        setMessage({ text: data.error || 'Erro ao solicitar recuperação.', type: 'error' })
        return
      }

      setMessage({
        text: data.message || 'Instruções de recuperação enviadas para o seu e-mail!',
        type: 'success',
      })
    } catch {
      setMessage({ text: 'Falha ao enviar e-mail de recuperação.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {isRecovering ? 'Recuperar Senha' : 'Acesso ao Sistema'}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Gestão de Cartão · Usuário Único
              </span>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '18px', lineHeight: 1.5 }}>
          {isRecovering
            ? 'Digite seu e-mail para receber o link de redefinição de senha.'
            : 'Faça login com sua conta configurada. Todos os dados são sincronizados diretamente com o PostgreSQL (banco: gestao).'}
        </p>

        {message && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '16px',
              background: message.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: message.type === 'error' ? '#ef4444' : '#10b981',
              border: `1px solid ${message.type === 'error' ? '#ef444444' : '#10b98144'}`,
            }}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={isRecovering ? handleRecovery : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
              E-mail
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px', background: 'var(--background)' }}>
              <Mail size={16} color="var(--muted)" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@dominio.com"
                style={{ width: '100%', border: 0, outline: 0, background: 'transparent', padding: '10px', fontSize: '13px', color: 'var(--foreground)' }}
              />
            </div>
          </div>

          {!isRecovering && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
                Senha
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px', background: 'var(--background)' }}>
                <Lock size={16} color="var(--muted)" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', border: 0, outline: 0, background: 'transparent', padding: '10px', fontSize: '13px', color: 'var(--foreground)' }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => {
                setIsRecovering(!isRecovering)
                setMessage(null)
              }}
              style={{ background: 'transparent', border: 0, color: 'var(--muted)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRecovering ? 'Voltar para Login' : 'Esqueceu a senha?'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '10px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : isRecovering ? (
              <>
                <KeyRound size={16} /> Enviar link
              </>
            ) : (
              <>
                <ArrowRight size={16} /> Entrar no sistema
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--muted)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Continuar no Modo Local (demonstração)
          </button>
        </div>
      </div>
    </div>
  )
}
