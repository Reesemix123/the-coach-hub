import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DocsSidebar, DocRenderer, MobileDocNav } from '@/components/docs';
import { docsNavigation, getAllDocPaths, findSectionByPath } from '@/config/docs-navigation';

interface DocPageProps {
  params: Promise<{ slug: string[] }>;
}

// Get the content directory path
const contentDir = path.join(process.cwd(), 'src/content/guide');

// Load markdown content from file
function getDocContent(slugPath: string[]): { content: string; frontmatter: { title?: string; description?: string; order?: number } } | null {
  // Try different file paths
  const possiblePaths = [
    path.join(contentDir, ...slugPath) + '.md',
    path.join(contentDir, ...slugPath, 'index.md'),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { content, data } = matter(fileContent);
      return { content, frontmatter: data };
    }
  }

  return null;
}

// Get previous and next navigation
function getNavigation(slugPath: string[]) {
  const allPaths = getAllDocPaths();
  const currentPathStr = slugPath.join('/');
  const currentIndex = allPaths.findIndex(p => p.join('/') === currentPathStr);

  let prev = null;
  let next = null;

  if (currentIndex > 0) {
    const prevPath = allPaths[currentIndex - 1];
    const prevSection = findSectionByPath(prevPath);
    if (prevSection) {
      prev = {
        title: prevSection.title,
        href: `/guide/${prevPath.join('/')}`,
      };
    }
  }

  if (currentIndex < allPaths.length - 1 && currentIndex !== -1) {
    const nextPath = allPaths[currentIndex + 1];
    const nextSection = findSectionByPath(nextPath);
    if (nextSection) {
      next = {
        title: nextSection.title,
        href: `/guide/${nextPath.join('/')}`,
      };
    }
  }

  return { prev, next };
}

export async function generateStaticParams() {
  return getAllDocPaths().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: DocPageProps) {
  const { slug } = await params;
  const section = findSectionByPath(slug);
  const doc = getDocContent(slug);

  const title = doc?.frontmatter.title || section?.title || 'Guide';
  const description = doc?.frontmatter.description || `Learn about ${title} in Youth Coach Hub`;

  return {
    title: `${title} | Guide | Youth Coach Hub`,
    description,
  };
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const section = findSectionByPath(slug);

  if (!section) {
    notFound();
  }

  const doc = getDocContent(slug);
  const { prev, next } = getNavigation(slug);

  // Build breadcrumb
  const breadcrumbs = slug.map((part, index) => {
    const pathUpTo = slug.slice(0, index + 1);
    const sectionAtPath = findSectionByPath(pathUpTo);
    return {
      title: sectionAtPath?.title || part,
      href: `/guide/${pathUpTo.join('/')}`,
    };
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28">
              <DocsSidebar />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-3xl">
            {/* Mobile Navigation */}
            <div className="lg:hidden mb-4">
              <MobileDocNav />
            </div>

            {/* Breadcrumb - simplified to Section > Page */}
            <nav className="mb-8">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                {breadcrumbs.map((crumb, index) => (
                  <li key={crumb.href} className="flex items-center gap-2">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="text-gray-900">{crumb.title}</span>
                    ) : (
                      <Link href={crumb.href} className="hover:text-gray-700">
                        {crumb.title}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            {/* Content */}
            {doc ? (
              <DocRenderer
                content={doc.content}
                title={doc.frontmatter.title || section.title}
                description={doc.frontmatter.description}
              />
            ) : (
              // Placeholder for sections without content yet
              <div className="prose prose-gray max-w-none">
                <header className="mb-8 pb-6 border-b border-gray-200">
                  <h1 className="text-3xl font-semibold text-gray-900 mb-2">
                    {section.title}
                  </h1>
                  {section.comingSoon && (
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                      Coming Soon
                    </span>
                  )}
                </header>

                {section.children ? (
                  <div>
                    <p className="text-gray-600 mb-6">
                      Choose a topic below to learn more:
                    </p>
                    <ul className="space-y-2">
                      {section.children.map(child => (
                        <li key={child.slug}>
                          <Link
                            href={`/guide/${slug[0]}/${child.slug}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {child.title}
                            {child.comingSoon && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                Soon
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-gray-600">
                    This documentation is being written. Check back soon!
                  </p>
                )}
              </div>
            )}

            {/* Previous / Next Navigation */}
            <nav className="mt-12 pt-6 border-t border-gray-200">
              <div className="flex justify-between">
                {prev ? (
                  <Link
                    href={prev.href}
                    className="group flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <div>
                      <div className="text-xs text-gray-500">Previous</div>
                      <div className="font-medium">{prev.title}</div>
                    </div>
                  </Link>
                ) : (
                  <div />
                )}

                {next ? (
                  <Link
                    href={next.href}
                    className="group flex items-center gap-2 text-gray-600 hover:text-gray-900 text-right"
                  >
                    <div>
                      <div className="text-xs text-gray-500">Next</div>
                      <div className="font-medium">{next.title}</div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            </nav>
          </main>
        </div>
      </div>
    </div>
  );
}
