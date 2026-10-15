import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()
    const rows = await query('SELECT * FROM public.categorias ORDER BY nome ASC')
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { id, nome, cor, icone } = body

    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const catId = id || crypto.randomUUID()
    const rows = await query(
      `
      INSERT INTO public.categorias (id, user_id, nome, cor, icone)
      VALUES ($1, 'admin', $2, $3, $4)
      ON CONFLICT (id) DO UPDATE
      SET nome = EXCLUDED.nome,
          cor = EXCLUDED.cor,
          icone = EXCLUDED.icone
      RETURNING *
      `,
      [catId, nome.trim(), cor || '#10b981', icone || 'Tag']
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

    await query('DELETE FROM public.categorias WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
