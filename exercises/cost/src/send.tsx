export function SendBox({
  value,
  onChange,
  onSend,
  busy,
  placeholder,
  rows = 2,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  busy: boolean
  placeholder: string
  rows?: number
}) {
  return (
    <form
      className="cost-send"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy && value.trim()) onSend()
      }}
    >
      <textarea
        className="fb-big"
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) return
          event.preventDefault()
          if (!busy && value.trim()) onSend()
        }}
      />
      <button type="submit" className="primary" disabled={busy || !value.trim()}>
        {busy ? '…' : 'Send ➤'}
      </button>
    </form>
  )
}
