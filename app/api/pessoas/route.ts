import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()
    const rows = await query('SELECT * FROM public.pessoas ORDER BY nome ASC')
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { id, nome, cor, contato, ativo } = body

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const pessoaId = id || crypto.randomUUID()
    const rows = await query(
      `
      INSERT INTO public.pessoas (id, user_id, nome, cor, contato, ativo)
      VALUES ($1, 'admin', $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE
      SET nome = EXCLUDED.nome,
          cor = EXCLUDED.cor,
          contato = EXCLUDED.contato,
          ativo = EXCLUDED.ativo
      RETURNING *
      `,
      [pessoaId, nome.trim(), cor || '#3b82f6', contato?.trim() || null, ativo ?? true]
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

    // Verifica se possui compras
    const countRes = await query(
      'SELECT count(*) FROM public.pessoas_compras WHERE pessoa_id = $1',
      [id]
    )
    const totalCompras = parseInt(countRes[0].count)

    if (totalCompras > 0) {
      // Inativa em vez de excluir
      await query('UPDATE public.pessoas SET ativo = false WHERE id = $1', [id])
      return NextResponse.json({ action: 'inactivated' })
    } else {
      await query('DELETE FROM public.pessoas WHERE id = $1', [id])
      return NextResponse.json({ action: 'deleted' })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
