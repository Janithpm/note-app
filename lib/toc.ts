import GithubSlugger from "github-slugger";

import { type TocHeading } from "@/components/note-toc";

/**
 * Extracts a table of contents (h1–h3) from Markdown, assigning each heading the
 * same slug `rehype-slug` produces, so TOC anchors line up with rendered IDs.
 * Skips headings inside fenced code blocks.
 */
export function extractTOC(content: string): TocHeading[] {
  const slugger = new GithubSlugger();
  const headings: TocHeading[] = [];
  const lines = content.split("\n");

  const headingRegex = /^(#{1,3})\s+(.+)$/;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(headingRegex);
    if (match) {
      const depth = match[1].length;
      const text = match[2];
      const id = slugger.slug(text);
      headings.push({ id, text, depth });
    }
  }
  return headings;
}
