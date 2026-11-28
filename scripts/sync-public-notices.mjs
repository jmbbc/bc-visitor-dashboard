import {writeFile} from 'node:fs/promises';
import {NOTICE_SCRIPT_URL} from '../js/notice-store.mjs';

const destination = process.argv[2];
if (!destination) throw new Error('Provide the output path for public-notices.json.');

const callback = 'publicNoticeSnapshot';
const response = await fetch(NOTICE_SCRIPT_URL + '?' + new URLSearchParams({callback}), {
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error('Notice feed returned HTTP ' + response.status);

const text = (await response.text()).trim();
const prefix = callback + '(';
if (!text.startsWith(prefix) || !text.endsWith(');')) throw new Error('Unexpected notice feed format');
const result = JSON.parse(text.slice(prefix.length, -2));
if (result.ok !== true || !Array.isArray(result.data)) throw new Error('Notice feed rejected the request');

const notices = result.data.filter(notice => notice.status === 'published').map(notice => ({
  id: notice.id,
  title: notice.title,
  category: notice.category,
  body: notice.body,
  startsAt: notice.startsAt,
  endsAt: notice.endsAt,
  location: notice.location,
  imageUrl: notice.imageUrl,
  attachmentUrl: notice.attachmentUrl,
  status: 'published',
  pinned: notice.pinned === true,
  inFeed: notice.inFeed === true,
  createdAt: notice.createdAt,
  updatedAt: notice.updatedAt,
  publishedAt: notice.publishedAt,
}));
if (notices.some(notice => typeof notice.id !== 'string' || !notice.id || typeof notice.title !== 'string')) {
  throw new Error('A published notice is missing its ID or title.');
}
await writeFile(destination, JSON.stringify(notices) + '\n');
console.log('Prepared ' + notices.length + ' published notices.');
