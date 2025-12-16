import { NextRequest, NextResponse } from 'next/server';
import guideContent from '@/lib/generated/guide-content.json';

// Type for the generated content
interface GuideEntry {
  content: string;
  frontmatter: {
    title?: string;
    description?: string;
    order?: number;
  };
}

const content = guideContent as Record<string, GuideEntry>;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slugParam = searchParams.get('slug');

  if (!slugParam) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  // Normalize the slug (remove trailing slashes, etc.)
  const slug = slugParam.split('/').filter(Boolean).join('/');

  // Look up the content
  const entry = content[slug];

  if (entry) {
    return NextResponse.json({
      content: entry.content,
      frontmatter: entry.frontmatter,
      slug: slug.split('/'),
    });
  }

  return NextResponse.json({ error: 'Content not found' }, { status: 404 });
}
