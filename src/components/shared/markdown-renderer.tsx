'use client';

import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
}) => {
  return (
    <div className={cn('prose prose-sm max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义标题样式
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold text-gray-900 mb-3 mt-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-gray-900 mb-2 mt-4 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-gray-900 mb-2 mt-3 first:mt-0">
              {children}
            </h3>
          ),

          // 自定义段落样式
          p: ({ children }) => (
            <p className="text-sm text-gray-700 mb-3 leading-relaxed last:mb-0">
              {children}
            </p>
          ),

          // 自定义列表样式
          ul: ({ children }) => (
            <ul className="text-sm text-gray-700 mb-3 ml-4 space-y-1 list-disc">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm text-gray-700 mb-3 ml-4 space-y-1 list-decimal">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-gray-700 leading-relaxed">
              {children}
            </li>
          ),

          // 自定义强调样式
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-800">{children}</em>
          ),

          // 自定义代码样式
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-gray-100 text-gray-800 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                {children}
              </code>
            );
          },

          // 自定义引用样式
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-200 bg-blue-50 pl-4 py-2 mb-3 text-sm text-blue-800 italic">
              {children}
            </blockquote>
          ),

          // 自定义链接样式
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-500 transition-colors"
            >
              {children}
            </a>
          ),

          // 自定义分隔线样式
          hr: () => <hr className="border-t border-gray-200 my-4" />,

          // 自定义表格样式
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border border-gray-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-200">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-gray-50">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-b border-gray-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-sm text-gray-700 border-b border-gray-200">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
