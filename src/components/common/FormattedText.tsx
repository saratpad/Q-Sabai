import React from 'react'

export interface FormattedTextProps {
  text?: string | null
  className?: string
  style?: React.CSSProperties
}

/**
 * Renders text with:
 * - Preserved line breaks and paragraph spacing (white-space: pre-wrap)
 * - Safe markdown formatting: **bold**, *italic*
 * - Markdown links [text](https://...) and raw URLs (https://...)
 */
export const FormattedText: React.FC<FormattedTextProps> = ({ text, className, style }) => {
  if (!text) return null

  // Tokenize string: Markdown links, bare URLs, bold, italic
  const tokenRegex = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<]+|\*\*[^*]+?\*\*|\*[^*]+?\*)/g

  const renderInline = (content: string, keyPrefix: string): React.ReactNode[] => {
    const parts = content.split(tokenRegex)
    return parts.map((part, i) => {
      const key = `${keyPrefix}-${i}`
      if (!part) return null

      // Markdown link: [text](https://...)
      const mdLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
      if (mdLinkMatch) {
        return (
          <a
            key={key}
            href={mdLinkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              wordBreak: 'break-all',
            }}
            onClick={e => e.stopPropagation()}
          >
            {mdLinkMatch[1]}
          </a>
        )
      }

      // Bare URL: https://...
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={key}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              wordBreak: 'break-all',
            }}
            onClick={e => e.stopPropagation()}
          >
            {part}
          </a>
        )
      }

      // Bold: **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={key} style={{ fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        )
      }

      // Italic: *text*
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={key} style={{ fontStyle: 'italic' }}>
            {part.slice(1, -1)}
          </em>
        )
      }

      return part
    })
  }

  return (
    <span
      className={className}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...style,
      }}
    >
      {renderInline(text, 'txt')}
    </span>
  )
}
