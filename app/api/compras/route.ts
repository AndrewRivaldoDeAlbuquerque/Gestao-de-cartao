import { NextRequest, NextResponse } from 'next/server'
import { query, pool, initDb } from '@/lib/db'
import { calcularVencimentos, gerarParcelas } from '@/lib/finance-utils'

export async function GET(req: NextRequest) {
  try {
    await initDb()
    const { searchParams } = new URL(req.url)
    const incluirDeletadas = searchParams.get('incluirDeletadas') === 'true'

    const sqlCompras = incluirDeletadas
      ? 'SELECT * FROM public.compras ORDER BY data_compra DESC, created_at DESC'
      : 'SELECT * FROM public.compras WHERE deletado_em IS NULL ORDER BY data_compra DESC, created_at DESC'

    const compras = await query(sqlCompras)
    const pessoasCompras = await query('SELECT * FROM public.pessoas_compras')
    const parcelas = await query('SELECT * FROM public.parcelas ORDER BY numero_parcela ASC')

    const resultado = compras.map((c) => ({
      ...c,
      valor_integral: Number(c.valor_integral),
      data_compra: c.data_compra instanceof Date
        ? c.data_compra.toISOString().split('T')[0]
        : String(c.data_compra).split('T')[0],
      encerrada_em: c.encerrada_em
        ? (c.encerrada_em instanceof Date ? c.encerrada_em.toISOString().split('T')[0] : String(c.encerrada_em).split('T')[0])
        : null,
      fixa: Boolean(c.fixa),
      pessoas_compras: pessoasCompras
        .filter((pc) => pc.compra_id === c.id)
        .map((pc) => ({ ...pc, valor: Number(pc.valor), percentual: pc.percentual ? Number(pc.percentual) : null })),
      parcelas: parcelas
        .filter((p) => p.compra_id === c.id)
        .map((p) => ({
          ...p,
          valor: Number(p.valor),
          data_vencimento: p.data_vencimento instanceof Date
            ? p.data_vencimento.toISOString().split('T')[0]
            : String(p.data_vencimento).split('T')[0],
        })),
    }))

    return NextResponse.json(resultado)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    await initDb()
    await client.query('BEGIN')

    const body = await req.json()
    const { compra, divisoes, cartaoRef, autoQuitarAnteriores = true } = body

    if (!compra || !compra.descricao) {
      return NextResponse.json({ error: 'Dados da compra são obrigatórios' }, { status: 400 })
    }

    const id = compra.id || crypto.randomUUID()
    const isEdicao = !!compra.id

    // Verificar se categoria é 'Assinaturas' ou compra.fixa
    let isFixa = Boolean(compra.fixa)
    if (!isFixa && compra.categoria_id) {
      const catRes = await client.query('SELECT nome FROM public.categorias WHERE id = $1', [compra.categoria_id])
      if (catRes.rows.length > 0 && catRes.rows[0].nome.toLowerCase() === 'assinaturas') {
        isFixa = true
      }
    }

    // 1. Upsert da Compra
    await client.query(
      `
      INSERT INTO public.compras (id, user_id, descricao, valor_integral, parcelas_totais, data_compra, cartao_id, categoria_id, fixa, encerrada_em, deletado_em)
      VALUES ($1, 'admin', $2, $3, $4, $5, $6, $7, $8, $9, NULL)
      ON CONFLICT (id) DO UPDATE
      SET descricao = EXCLUDED.descricao,
          valor_integral = EXCLUDED.valor_integral,
          parcelas_totais = EXCLUDED.parcelas_totais,
          data_compra = EXCLUDED.data_compra,
          cartao_id = EXCLUDED.cartao_id,
          categoria_id = EXCLUDED.categoria_id,
          fixa = EXCLUDED.fixa,
          encerrada_em = EXCLUDED.encerrada_em,
          deletado_em = NULL
      `,
      [
        id,
        compra.descricao.trim(),
        Number(compra.valor_integral),
        isFixa ? 1 : (Number(compra.parcelas_totais) || 1),
        compra.data_compra,
        compra.cartao_id || null,
        compra.categoria_id || null,
        isFixa,
        compra.encerrada_em || null,
      ]
    )

    // 2. Substituir pessoas_compras
    await client.query('DELETE FROM public.pessoas_compras WHERE compra_id = $1', [id])
    if (Array.isArray(divisoes)) {
      for (const d of divisoes) {
        await client.query(
          `
          INSERT INTO public.pessoas_compras (id, user_id, pessoa_id, compra_id, tipo_divisao, percentual, valor)
          VALUES ($1, 'admin', $2, $3, $4, $5, $6)
          `,
          [
            crypto.randomUUID(),
            d.pessoa_id,
            id,
            d.tipo_divisao,
            d.percentual ? Number(d.percentual) : null,
            Number(d.valor) || 0,
          ]
        )
      }
    }

    // 3. Gerar Parcelas (para compras fixas/assinaturas gera 24 meses como horizonte contínuo)
    let cartaoInfo = cartaoRef
    if ((!cartaoInfo || !cartaoInfo.dia_fechamento) && compra.cartao_id) {
      const cRes = await client.query('SELECT dia_fechamento, dia_vencimento FROM public.cartoes WHERE id = $1', [compra.cartao_id])
      if (cRes.rows.length > 0) {
        cartaoInfo = cRes.rows[0]
      }
    }
    if (!cartaoInfo) {
      cartaoInfo = { dia_fechamento: 15, dia_vencimento: 20 }
    }

    const totalParcelasParaGerar = isFixa ? 24 : (Number(compra.parcelas_totais) || 1)
    const vencimentos = calcularVencimentos(compra.data_compra, cartaoInfo, totalParcelasParaGerar)
    let novasParcelas = gerarParcelas(
      id,
      Number(compra.valor_integral),
      totalParcelasParaGerar,
      vencimentos,
      autoQuitarAnteriores !== false,
      isFixa
    )

    // Se a compra fixa tiver data de encerramento, não gera além dela
    if (isFixa && compra.encerrada_em) {
      novasParcelas = novasParcelas.filter((p) => p.data_vencimento.slice(0, 7) <= String(compra.encerrada_em).slice(0, 7))
    }

    if (isEdicao) {
      // Pega parcelas pagas existentes para manter status de pagamento se aplicável
      const resPagas = await client.query('SELECT * FROM public.parcelas WHERE compra_id = $1 AND paga = true', [id])
      const mesesPagos = new Set(
        resPagas.rows.map((p) => {
          const d = p.data_vencimento instanceof Date ? p.data_vencimento.toISOString() : String(p.data_vencimento)
          return d.slice(0, 7)
        })
      )

      // Remove todas as parcelas existentes da compra para recriar o cronograma completo e consistente
      await client.query('DELETE FROM public.parcelas WHERE compra_id = $1', [id])

      // Insere as novas parcelas com datas e valores recalculados
      for (const p of novasParcelas) {
        const mesParcela = p.data_vencimento.slice(0, 7)
        const estaPaga = p.paga || mesesPagos.has(mesParcela)

        await client.query(
          `
          INSERT INTO public.parcelas (id, user_id, compra_id, numero_parcela, valor, data_vencimento, paga)
          VALUES ($1, 'admin', $2, $3, $4, $5, $6)
          `,
          [p.id, id, p.numero_parcela, p.valor, p.data_vencimento, estaPaga]
        )
      }
    } else {
      for (const p of novasParcelas) {
        await client.query(
          `
          INSERT INTO public.parcelas (id, user_id, compra_id, numero_parcela, valor, data_vencimento, paga)
          VALUES ($1, 'admin', $2, $3, $4, $5, $6)
          `,
          [p.id, id, p.numero_parcela, p.valor, p.data_vencimento, p.paga]
        )
      }
    }

    // 4. Registro no Histórico de Alterações
    await client.query(
      `
      INSERT INTO public.historico_alteracoes (id, user_id, entidade, entidade_id, acao, dados_antes, dados_depois)
      VALUES ($1, 'admin', 'compra', $2, $3, NULL, $4)
      `,
      [
        crypto.randomUUID(),
        id,
        isEdicao ? 'edicao' : 'criacao',
        JSON.stringify({ descricao: compra.descricao, valor: compra.valor_integral, fixa: isFixa }),
      ]
    )

    await client.query('COMMIT')
    return NextResponse.json({ ok: true, id, fixa: isFixa })
  } catch (err: any) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: err?.message }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { id, acao } = body
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    if (acao === 'soft_delete') {
      await query('UPDATE public.compras SET deletado_em = now() WHERE id = $1', [id])
      await query(
        `INSERT INTO public.historico_alteracoes (id, user_id, entidade, entidade_id, acao, dados_depois)
         VALUES ($1, 'admin', 'compra', $2, 'exclusao', $3)`,
        [crypto.randomUUID(), id, JSON.stringify({ deletado_em: new Date().toISOString() })]
      )
      return NextResponse.json({ ok: true, acao: 'soft_delete' })
    }

    if (acao === 'restore') {
      await query('UPDATE public.compras SET deletado_em = NULL WHERE id = $1', [id])
      await query(
        `INSERT INTO public.historico_alteracoes (id, user_id, entidade, entidade_id, acao, dados_depois)
         VALUES ($1, 'admin', 'compra', $2, 'restauracao', $3)`,
        [crypto.randomUUID(), id, JSON.stringify({ restaurado: true })]
      )
      return NextResponse.json({ ok: true, acao: 'restore' })
    }

    if (acao === 'encerrar_assinatura') {
      const dataFim = body.data_encerramento || new Date().toISOString().slice(0, 10)
      await query('UPDATE public.compras SET encerrada_em = $1 WHERE id = $2', [dataFim, id])
      // Remove parcelas futuras não pagas após a data de encerramento
      await query('DELETE FROM public.parcelas WHERE compra_id = $1 AND data_vencimento > $2 AND paga = false', [id, dataFim])
      await query(
        `INSERT INTO public.historico_alteracoes (id, user_id, entidade, entidade_id, acao, dados_depois)
         VALUES ($1, 'admin', 'compra', $2, 'edicao', $3)`,
        [crypto.randomUUID(), id, JSON.stringify({ encerrada_em: dataFim })]
      )
      return NextResponse.json({ ok: true, acao: 'encerrar_assinatura', encerrada_em: dataFim })
    }

    if (acao === 'reativar_assinatura') {
      await query('UPDATE public.compras SET encerrada_em = NULL WHERE id = $1', [id])
      
      const compRes = await query('SELECT * FROM public.compras WHERE id = $1', [id])
      if (compRes.length > 0) {
        const c = compRes[0]
        const cartaoRes = await query('SELECT dia_fechamento, dia_vencimento FROM public.cartoes WHERE id = $1', [c.cartao_id])
        const cartaoInfo = cartaoRes[0] || { dia_fechamento: 15, dia_vencimento: 20 }
        const dataCompraStr = (c.data_compra instanceof Date ? c.data_compra.toISOString() : String(c.data_compra)).slice(0, 10)
        const vencimentos = calcularVencimentos(dataCompraStr, cartaoInfo, 24)
        const parcelasNovas = gerarParcelas(id, Number(c.valor_integral), 24, vencimentos, true, true)
        
        const existentes = await query('SELECT data_vencimento FROM public.parcelas WHERE compra_id = $1', [id])
        const datasExistentes = new Set(existentes.map((e) => {
          const d = e.data_vencimento instanceof Date ? e.data_vencimento.toISOString() : String(e.data_vencimento)
          return d.slice(0, 10)
        }))

        for (const p of parcelasNovas) {
          if (!datasExistentes.has(p.data_vencimento)) {
            await query(
              `INSERT INTO public.parcelas (id, user_id, compra_id, numero_parcela, valor, data_vencimento, paga)
               VALUES ($1, 'admin', $2, $3, $4, $5, $6)`,
              [p.id, id, p.numero_parcela, p.valor, p.data_vencimento, p.paga]
            )
          }
        }
      }

      await query(
        `INSERT INTO public.historico_alteracoes (id, user_id, entidade, entidade_id, acao, dados_depois)
         VALUES ($1, 'admin', 'compra', $2, 'edicao', $3)`,
        [crypto.randomUUID(), id, JSON.stringify({ reativada: true })]
      )
      return NextResponse.json({ ok: true, acao: 'reativar_assinatura' })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
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

    await query('DELETE FROM public.compras WHERE id = $1', [id])
    return NextResponse.json({ ok: true, acao: 'deleted_permanente' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
