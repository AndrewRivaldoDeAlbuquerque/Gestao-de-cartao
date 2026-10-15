import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { parcelaId, parcelaIds, paga } = body

    if (Array.isArray(parcelaIds) && parcelaIds.length > 0) {
      await query(
        'UPDATE public.parcelas SET paga = $1 WHERE id = ANY($2::uuid[])',
        [paga ?? true, parcelaIds]
      )
      return NextResponse.json({ ok: true, total: parcelaIds.length })
    }

    if (parcelaId) {
      await query(
        'UPDATE public.parcelas SET paga = $1 WHERE id = $2',
        [paga ?? true, parcelaId]
      )
      return NextResponse.json({ ok: true, parcelaId })
    }

    return NextResponse.json({ error: 'Nenhum ID de parcela informado' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
