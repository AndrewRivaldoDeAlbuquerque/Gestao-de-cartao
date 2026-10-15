import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()
    const rows = await query('SELECT * FROM public.regras_categorizacao ORDER BY created_at DESC')
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { termo, categoria_id } = body

    if (!termo || !categoria_id) {
      return NextResponse.json({ error: 'Termo e categoria são obrigatórios' }, { status: 400 })
    }

    const rows = await query(
      `
      INSERT INTO public.regras_categorizacao (id, user_id, termo, categoria_id)
      VALUES ($1, 'admin', $2, $3)
      RETURNING *
      `,
      [crypto.randomUUID(), termo.trim().toUpperCase(), categoria_id]
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

    await query('DELETE FROM public.regras_categorizacao WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
