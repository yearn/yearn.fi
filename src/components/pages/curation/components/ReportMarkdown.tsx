import type { ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'

type TReportMarkdownProps = {
  content: string
}

export function ReportMarkdown({ content }: TReportMarkdownProps): ReactElement {
  return (
    <div className={'curation-prose'}>
      <ReactMarkdown
        skipHtml
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target={'_blank'} rel={'noopener noreferrer'} />,
          code: ({ node: _node, className, children, ...props }) => (
            <code {...props} className={className}>
              {children}
            </code>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
