import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()
    const rows = await query('SELECT * FROM public.historico_alteracoes ORDER BY criado_em DESC LIMIT 100')
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { entidade, entidade_id, acao, dados_antes, dados_depois } = body

    const rows = await query(
      `
      INSERT INTO public.historico_alteracoes (id, user_id, entidade, entidade_id, acao, dados_antes, dados_depois)
      VALUES ($1, 'admin', $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        crypto.randomUUID(),
        entidade,
        entidade_id,
        acao,
        dados_antes ? JSON.stringify(dados_antes) : null,
        dados_depois ? JSON.stringify(dados_depois) : null,
      ]
    )

    return NextResponse.json(rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { item } = body

    if (item && item.entidade === 'compra' && item.entidade_id) {
      await query('UPDATE public.compras SET deletado_em = NULL WHERE id = $1', [item.entidade_id])
      await query(
        `
        INSERT INTO public.historico_alteracoes (id, user_id, entidade, entidade_id, acao, dados_depois)
        VALUES ($1, 'admin', 'compra', $2, 'restauracao', $3)
        `,
        [crypto.randomUUID(), item.entidade_id, JSON.stringify({ restaurado: true })]
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Restauração não suportada para este tipo de item' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
