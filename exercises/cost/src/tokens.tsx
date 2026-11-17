import { Fragment, useEffect, useState } from 'react'

type Codec = { encode: (text: string) => number[]; decode: (ids: number[]) => string }

let pending: Promise<Codec> | null = null

function loadO200k() {
  pending ??= import('gpt-tokenizer/encoding/o200k_base').then((codec) => ({ encode: codec.encode, decode: codec.decode }))
  return pending
}

export function useCodec() {
  const [codec, setCodec] = useState<Codec | null>(null)
  useEffect(() => {
    let cancel = false
    void loadO200k().then((loaded) => {
      if (!cancel) setCodec(loaded)
    })
    return () => {
      cancel = true
    }
  }, [])
  return codec
}

export type Piece = { text: string; id: number }

const COLORS = ['#f6d3c4', '#cfe4e2', '#f3e2a8', '#ddd6f6', '#f7c9d4', '#d7e4c2']

export function pieces(codec: Codec | null, text: string): Piece[] {
  if (!codec || !text) return []
  const ids = codec.encode(text)
  const out: Piece[] = []
  let prev = ''
  for (let index = 0; index < ids.length; index += 1) {
    const sofar = codec.decode(ids.slice(0, index + 1))
    if (!sofar.startsWith(prev)) return ids.map((id) => ({ id, text: codec.decode([id]) }))
    out.push({ id: ids[index], text: sofar.slice(prev.length) })
    prev = sofar
  }
  return out
}

export function Blocks({ items, extra }: { items: Piece[]; extra?: number }) {
  return (
    <p className="fb-blocks cost-chips">
      {items.map((piece, index) => (
        <Fragment key={index}>
          <span style={{ background: COLORS[index % COLORS.length] }}>
            {/^[ \t]+$/.test(piece.text) ? '␣' : piece.text.replaceAll('\n', '↵')}
            <small>{piece.id}</small>
          </span>
          {piece.text.includes('\n') && <i className="cost-break" />}
        </Fragment>
      ))}
      {extra !== undefined && extra > 0 && (
        <span className="env">
          chat
          <small>+{extra}</small>
        </span>
      )}
    </p>
  )
}
