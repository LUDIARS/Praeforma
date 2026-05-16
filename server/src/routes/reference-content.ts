// reference.display_mode=markdown 用の content fetch endpoint。
//
// /api/projects/:pid/references/:rid/content
//   - kind=notion       → NOTION_INTEGRATION_TOKEN があれば API、 無ければ 501
//   - kind=google-docs  → GOOGLE_DOCS_TOKEN があれば API、 無ければ 501
//   - kind=confluence   → CONFLUENCE_TOKEN があれば API、 無ければ 501
//   - kind=web/figma/github 等 → 501 (not_supported_for_kind)
//
// レスポンス:
//   { kind, title, markdown, fetched_at }
//   または { error, fallback_url } (= link で開いてもらう)

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { references } from '../db/schema/reference.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { requireAuth } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';

const ALL_ROLES: readonly ProjectRole[] = [
  'owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer',
];

interface FetchResult {
  ok: boolean;
  markdown?: string;
  title?: string;
  errorMessage?: string;
}

async function fetchNotion(url: string): Promise<FetchResult> {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  if (!token) return { ok: false, errorMessage: 'NOTION_INTEGRATION_TOKEN not set' };
  // Notion URL から page id を抽出 (= 末尾 32 桁の hex)
  const m = url.match(/([a-f0-9]{32})/i);
  if (!m) return { ok: false, errorMessage: 'page_id not detected in URL' };
  const id = m[1]!.replace(/-/g, '');
  const formattedId = `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${formattedId}/children?page_size=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });
    if (!res.ok) return { ok: false, errorMessage: `Notion API ${res.status}` };
    const body = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const md = (body.results ?? []).map(blockToMarkdown).filter(Boolean).join('\n\n');
    return { ok: true, markdown: md, title: 'Notion document' };
  } catch (e) {
    return { ok: false, errorMessage: (e as Error).message };
  }
}

function blockToMarkdown(block: Record<string, unknown>): string {
  const type = block.type as string;
  const data = (block[type] as Record<string, unknown>) ?? {};
  const rt = (data.rich_text as Array<{ plain_text?: string }>) ?? [];
  const text = rt.map((t) => t.plain_text ?? '').join('');
  switch (type) {
    case 'heading_1':       return `# ${text}`;
    case 'heading_2':       return `## ${text}`;
    case 'heading_3':       return `### ${text}`;
    case 'bulleted_list_item': return `- ${text}`;
    case 'numbered_list_item': return `1. ${text}`;
    case 'quote':           return `> ${text}`;
    case 'code':            return '```\n' + text + '\n```';
    case 'divider':         return '---';
    case 'paragraph':       return text;
    default:                return text;
  }
}

async function fetchGoogleDocs(url: string): Promise<FetchResult> {
  const token = process.env.GOOGLE_DOCS_TOKEN;
  if (!token) return { ok: false, errorMessage: 'GOOGLE_DOCS_TOKEN not set' };
  const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return { ok: false, errorMessage: 'document_id not detected in URL' };
  const docId = m[1]!;
  try {
    const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, errorMessage: `Google Docs API ${res.status}` };
    const body = (await res.json()) as { title?: string; body?: { content?: Array<Record<string, unknown>> } };
    const elements = body.body?.content ?? [];
    const lines: string[] = [];
    for (const el of elements) {
      const para = el.paragraph as { elements?: Array<{ textRun?: { content?: string } }> } | undefined;
      if (para) {
        const text = (para.elements ?? []).map((e) => e.textRun?.content ?? '').join('');
        if (text.trim()) lines.push(text.trimEnd());
      }
    }
    return { ok: true, markdown: lines.join('\n'), title: body.title ?? 'Google Doc' };
  } catch (e) {
    return { ok: false, errorMessage: (e as Error).message };
  }
}

async function fetchConfluence(url: string): Promise<FetchResult> {
  const token = process.env.CONFLUENCE_TOKEN;
  const user = process.env.CONFLUENCE_USER;
  if (!token || !user) return { ok: false, errorMessage: 'CONFLUENCE_TOKEN/USER not set' };
  const m = url.match(/\/pages\/(\d+)/) ?? url.match(/pageId=(\d+)/);
  if (!m) return { ok: false, errorMessage: 'pageId not detected in URL' };
  const pageId = m[1]!;
  const origin = new URL(url).origin;
  try {
    const auth = Buffer.from(`${user}:${token}`).toString('base64');
    const res = await fetch(`${origin}/wiki/rest/api/content/${pageId}?expand=body.storage`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, errorMessage: `Confluence API ${res.status}` };
    const body = (await res.json()) as { title?: string; body?: { storage?: { value?: string } } };
    const html = body.body?.storage?.value ?? '';
    // 雑に HTML → text (= 真面目に変換するなら別 library)
    const text = html
      .replace(/<\/p>/g, '\n')
      .replace(/<br[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    return { ok: true, markdown: text, title: body.title ?? 'Confluence page' };
  } catch (e) {
    return { ok: false, errorMessage: (e as Error).message };
  }
}

export function makeReferenceContentRouter(): Hono {
  const r = new Hono();

  r.get('/:rid/content', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const rid = c.req.param('rid')!;
    const [ref] = await getDb()
      .select()
      .from(references)
      .where(eq(references.id, rid))
      .limit(1);
    if (!ref) throw AppError.notFound();

    let result: FetchResult;
    switch (ref.kind) {
      case 'notion':      result = await fetchNotion(ref.url); break;
      case 'google-docs': result = await fetchGoogleDocs(ref.url); break;
      case 'confluence':  result = await fetchConfluence(ref.url); break;
      default:
        return c.json({
          error: 'not_supported_for_kind',
          kind: ref.kind,
          fallback_url: ref.url,
        }, 501);
    }
    if (!result.ok) {
      return c.json({
        error: 'fetch_failed',
        message: result.errorMessage,
        fallback_url: ref.url,
      }, 502);
    }
    return c.json({
      kind: ref.kind,
      title: result.title ?? ref.title,
      markdown: result.markdown ?? '',
      url: ref.url,
      fetched_at: new Date().toISOString(),
    });
  });

  return r;
}
