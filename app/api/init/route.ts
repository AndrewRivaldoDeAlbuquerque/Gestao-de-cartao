import { NextResponse } from 'next/server'
import { initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()
    return NextResponse.json({ ok: true, message: 'Banco PostgreSQL gestao conectado e inicializado.' })
  } catch (err: any) {
    console.error('Erro ao conectar ao PostgreSQL:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Falha na conexão com o PostgreSQL' },
      { status: 500 }
    )
  }
}
