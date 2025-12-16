import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const contentDir = path.join(process.cwd(), 'src/content/guide');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slugParam = searchParams.get('slug');

  if (!slugParam) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  const slugPath = slugParam.split('/').filter(Boolean);

  // Try different file paths
  const possiblePaths = [
    path.join(contentDir, ...slugPath) + '.md',
    path.join(contentDir, ...slugPath, 'index.md'),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { content, data } = matter(fileContent);
      return NextResponse.json({
        content,
        frontmatter: data,
        slug: slugPath,
      });
    }
  }

  return NextResponse.json({ error: 'Content not found' }, { status: 404 });
}
