'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';

interface DocRendererProps {
  content: string;
  title?: string;
  description?: string;
}

export function DocRenderer({ content, title, description }: DocRendererProps) {
  return (
    <article className="prose prose-gray max-w-none">
      {/* Header */}
      {title && (
        <header className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">{title}</h1>
          {description && (
            <p className="text-lg text-gray-600">{description}</p>
          )}
        </header>
      )}

      {/* Content */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom heading styles
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">
              {children}
            </h3>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-gray-700 leading-relaxed mb-4">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-700">{children}</li>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-gray-700 border-t border-gray-100">
              {children}
            </td>
          ),

          // Blockquotes (for tips/notes)
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 py-3 pr-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg text-gray-700">
              {children}
            </blockquote>
          ),

          // Code
          code: ({ className, children }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4">
                  <code className={className}>{children}</code>
                </pre>
              );
            }
            return (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm">
                {children}
              </code>
            );
          },

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),

          // Images
          img: ({ src, alt }) => {
            if (!src) return null;
            // Handle relative paths for screenshots
            const imageSrc = src.startsWith('/') ? src : `/docs/screenshots/${src}`;
            return (
              <figure className="my-6">
                <div className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                  <Image
                    src={imageSrc}
                    alt={alt || 'Documentation screenshot'}
                    width={800}
                    height={450}
                    className="w-full h-auto"
                    unoptimized // For dynamic paths
                  />
                </div>
                {alt && (
                  <figcaption className="mt-2 text-sm text-gray-500 text-center">
                    {alt}
                  </figcaption>
                )}
              </figure>
            );
          },

          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),

          // Horizontal rule
          hr: () => <hr className="my-8 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

export default DocRenderer;
