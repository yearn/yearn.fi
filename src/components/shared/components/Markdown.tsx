import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

type TMarkdownProps = {
  content: string
  className?: string
}

export function Markdown({ content, className }: TMarkdownProps): ReactElement {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        skipHtml
        components={{
          a: ({ node: _node, className: linkClassName, ...props }) => (
            <a
              {...props}
              className={cl('text-text-primary underline', linkClassName)}
              target="_blank"
              rel="noopener noreferrer"
            />
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
