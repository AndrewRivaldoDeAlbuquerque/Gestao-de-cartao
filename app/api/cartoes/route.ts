import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()
    const rows = await query('SELECT * FROM public.cartoes ORDER BY nome ASC')
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { id, nome, cor, limite, dia_fechamento, dia_vencimento } = body

    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const cartaoId = id || crypto.randomUUID()
    const rows = await query(
      `
      INSERT INTO public.cartoes (id, user_id, nome, cor, limite, dia_fechamento, dia_vencimento)
      VALUES ($1, 'admin', $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE
      SET nome = EXCLUDED.nome,
          cor = EXCLUDED.cor,
          limite = EXCLUDED.limite,
          dia_fechamento = EXCLUDED.dia_fechamento,
          dia_vencimento = EXCLUDED.dia_vencimento
      RETURNING *
      `,
      [
        cartaoId,
        nome.trim(),
        cor || '#8b5cf6',
        limite ? Number(limite) : null,
        Number(dia_fechamento) || 15,
        Number(dia_vencimento) || 20,
      ]
    )

    return NextResponse.json(rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await initDb()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    await query('DELETE FROM public.cartoes WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
