import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()
    const rows = await query('SELECT * FROM public.importacoes ORDER BY created_at DESC')
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { arquivo, tipo, status, total_itens } = body

    const rows = await query(
      `
      INSERT INTO public.importacoes (id, user_id, arquivo, tipo, status, total_itens)
      VALUES ($1, 'admin', $2, $3, $4, $5)
      RETURNING *
      `,
      [crypto.randomUUID(), arquivo, tipo, status || 'concluido', Number(total_itens) || 0]
    )

    return NextResponse.json(rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
