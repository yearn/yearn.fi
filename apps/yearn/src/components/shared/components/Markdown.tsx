import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'

type TMarkdownProps = {
  content: string
  className?: string
}

export function Markdown({ content, className }: TMarkdownProps): ReactElement {
  return (
    <div className={className}>
      <ReactMarkdown
        skipHtml
        components={{
          a: ({ node: _node, className: linkClassName, children, ...props }) => (
            <a
              {...props}
              className={cl('text-text-primary underline', linkClassName)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
              <span className={'sr-only'}>{' (opens in new tab)'}</span>
            </a>
          ),
          strong: ({ node: _node, className: strongClassName, ...props }) => (
            <strong {...props} className={cl('font-bold', strongClassName)} />
          ),
          del: ({ node: _node, className: delClassName, ...props }) => (
            <del {...props} className={cl('line-through', delClassName)} />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
