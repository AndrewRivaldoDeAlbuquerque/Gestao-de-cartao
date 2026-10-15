import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'
import crypto from 'crypto'

function hashSenha(senha: string): string {
  return crypto.createHash('sha256').update(senha).digest('hex')
}

export async function GET(req: NextRequest) {
  // Retorna status da sessão
  const emailCookie = req.cookies.get('gc_user_email')?.value
  return NextResponse.json({
    user: emailCookie ? { email: emailCookie } : null,
  })
}

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { action, email, password } = body

    if (action === 'logout') {
      const response = NextResponse.json({ ok: true, message: 'Desconectado com sucesso' })
      response.cookies.delete('gc_user_email')
      return response
    }

    if (action === 'recovery') {
      // Simula envio de e-mail de recuperação
      return NextResponse.json({
        ok: true,
        message: 'Instruções de recuperação enviadas para o seu e-mail!',
      })
    }

    // Login com verificação direta no PostgreSQL
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'E-mail e senha são obrigatórios' }, { status: 400 })
    }

    const emailTrim = email.trim().toLowerCase()
    const senhaHash = hashSenha(password)

    // Busca usuário existente
    const usuarios = await query('SELECT * FROM public.usuarios WHERE email = $1', [emailTrim])

    if (usuarios.length === 0) {
      // Como é app de usuário único sem auto-cadastro prévio, o primeiro login válido registra o admin no banco
      const countRes = await query('SELECT count(*) FROM public.usuarios')
      const total = parseInt(countRes[0].count)

      if (total === 0) {
        await query(
          'INSERT INTO public.usuarios (email, senha_hash) VALUES ($1, $2)',
          [emailTrim, senhaHash]
        )
      } else {
        return NextResponse.json({ ok: false, error: 'Usuário não encontrado ou senha incorreta' }, { status: 401 })
      }
    } else {
      const usuario = usuarios[0]
      if (usuario.senha_hash !== senhaHash) {
        return NextResponse.json({ ok: false, error: 'Senha incorreta' }, { status: 401 })
      }
    }

    const response = NextResponse.json({
      ok: true,
      user: { email: emailTrim },
    })

    // Define cookie de sessão simples para navegação
    response.cookies.set('gc_user_email', emailTrim, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 dias
    })

    return response
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erro de autenticação' }, { status: 500 })
  }
}
