// Characters Windows, macOS and Linux variously refuse in a file name.
// Spaces are legal and are left alone.
const ILLEGAL = /[\\/:*?"<>|]/g

export function cleanFileName(raw: string) {
  const trimmed = raw.replace(ILLEGAL, '-').replace(/\.pdf$/i, '').trim()
  return trimmed || 'document'
}

/**
 * Names the file before it is saved. The extension is shown but not editable —
 * the output is always a PDF, and letting someone type ".docx" would only
 * produce a PDF that lies about itself.
 */
export function FileNameField({
  value,
  onChange,
  label = 'Save as',
}: {
  value: string
  onChange: (next: string) => void
  label?: string
}) {
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="label shrink-0">{label}</span>
      <span className="flex min-w-0 items-center rounded-control border border-hairline bg-surface focus-within:border-violet">
        <input
          value={value}
          // Illegal characters are stripped as they are typed, so the field
          // shows the name you will actually get. The rest of the tidying
          // (trimming, dropping a typed .pdf) waits until you leave the field,
          // and the download re-cleans regardless.
          onChange={(e) => onChange(e.target.value.replace(ILLEGAL, '-'))}
          onBlur={(e) => onChange(cleanFileName(e.target.value))}
          spellCheck={false}
          aria-label="File name"
          className="w-[10rem] min-w-0 bg-transparent px-2.5 py-1.5 text-[13px] outline-none"
        />
        <span className="shrink-0 pr-2.5 text-[13px] text-muted">.pdf</span>
      </span>
    </label>
  )
}
