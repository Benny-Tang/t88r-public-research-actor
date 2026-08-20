import { Actor } from 'apify';

const MAX_PAGES = 20;
const MAX_ITEMS = 50;
const MAX_DEPTH = 1;
const MAX_TIMEOUT_SECONDS = 120;
const PERSON_PATTERN = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,4})\s*,?\s+(?:is|was|serves as|joined as|appointed as|named as|appointed)\s+(?:the\s+)?([^.;\n]{2,100})/g;
const ROLE_PATTERN = /\b(?:Managing Director|Director|Chief Executive Officer|CEO|Chief Operating Officer|COO|Chief Technology Officer|CTO|Vice President|President|Country Manager|Regional Director|Project Director|Development Director|Head of [A-Z][^,.;\n]{2,80}|Partner|Managing Partner|Founder|Adviser|Advisor|Consultant|Broker)\b/gi;
const INTERMEDIARY_PATTERN = /\b(consultant|consultancy|broker|brokerage|adviser|advisor|arranger|investment bank|property agency|real estate agency)\b/gi;
const PRIVATE_DATA_PATTERN = /\b(?:\+?\d[\d\s().-]{7,}\d|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;

function clampInput(input = {}) {
  if (input.mode !== 'research') throw new Error('Only mode=research is supported.');
  const startUrls = Array.isArray(input.startUrls) ? input.startUrls.slice(0, MAX_PAGES) : [];
  if (!startUrls.length) throw new Error('At least one public HTTPS startUrl is required.');
  if (startUrls.some((entry) => !entry?.url || !/^https:\/\//i.test(entry.url))) {
    throw new Error('Only public HTTPS startUrls are accepted.');
  }
  const maxPages = Math.min(Math.max(Number(input.maxPages ?? MAX_PAGES), 1), MAX_PAGES);
  const maxItems = Math.min(Math.max(Number(input.maxItems ?? MAX_ITEMS), 1), MAX_ITEMS);
  const maxDepth = Math.min(Math.max(Number(input.maxDepth ?? 1), 0), MAX_DEPTH);
  const timeoutSeconds = Math.min(Math.max(Number(input.timeoutSeconds ?? MAX_TIMEOUT_SECONDS), 10), MAX_TIMEOUT_SECONDS);
  const markets = Array.isArray(input.markets)
  ? input.markets
      .filter((market) => ['Malaysia', 'Singapore'].includes(market))
      .slice(0, 2)
  : ['Malaysia', 'Singapore'];

if (!markets.length) {
  throw new Error('At least one allowed market is required: Malaysia or Singapore.');
}
  const targetCompanies = Array.isArray(input.targetCompanies) ? input.targetCompanies.slice(0, 50) : [];
  if (!targetCompanies.length) throw new Error('At least one target company is required.');
  if (!input.tailMarker) throw new Error('A tailMarker is required for traceability.');
  return { ...input, startUrls, maxPages, maxItems, maxDepth, timeoutSeconds, targetCompanies };
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromHtml(html, fallback) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (match?.[1] ?? fallback).replace(/\s+/g, ' ').trim().slice(0, 200);
}

function findLocation(text, locations = []) {
  const value = locations.find((location) => new RegExp(`\\b${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  return value ?? 'Malaysia or Singapore';
}

function findCompany(text, targets) {
  return targets.find((target) => text.toLowerCase().includes(String(target).toLowerCase())) ?? 'Not explicitly stated';
}

function classifyStatus(text) {
  if (/commissioned|operational|opened|in operation|completed/i.test(text)) return 'confirmed';
  if (/announced|will invest|has invested|signed|secured financing|appointed/i.test(text)) return 'announced';
  if (/proposed|planned|expected|seeking|under consideration/i.test(text)) return 'proposed';
  return 'unverified';
}

function confidenceFor(text, sourceUrl, personName) {
  if (personName !== 'Not explicitly stated' && /^https:\/\//i.test(sourceUrl) && text.length > 250) return 'medium';
  return 'low';
}

function extractRecords({ html, sourceUrl, sourceLabel, input, discoveredAt }) {
  const text = stripHtml(html).slice(0, 20000);
  const privateDataRemoved = text.replace(PRIVATE_DATA_PATTERN, '[redacted]');
  const companyName = findCompany(privateDataRemoved, input.targetCompanies);
  const location = findLocation(privateDataRemoved, input.locations ?? []);
  const status = classifyStatus(privateDataRemoved);
  const matches = [...privateDataRemoved.matchAll(PERSON_PATTERN)].slice(0, 10);
  const roleMatches = [...privateDataRemoved.matchAll(ROLE_PATTERN)].slice(0, 10);
  const intermediaryMatches = [...privateDataRemoved.matchAll(INTERMEDIARY_PATTERN)].slice(0, 5);
  const records = [];
  for (const match of matches) {
    const personName = match[1].trim();
    const role = match[2].replace(/\s+/g, ' ').trim().slice(0, 120);
    const explicitIntermediary = /consultant|broker|adviser|advisor|arranger|agency/i.test(role);
    records.push({
      companyName,
      personName,
      role,
      affiliation: companyName,
      intermediaryType: explicitIntermediary ? role.match(INTERMEDIARY_PATTERN)?.[0]?.toLowerCase() ?? 'not_stated' : 'not_stated',
      siteOrProject: 'Not explicitly stated',
      location,
      signalStatus: status,
      evidenceSummary: `Public page ${sourceLabel || sourceUrl} explicitly associates ${personName} with the role text: ${role}.`,
      sourceTitle: titleFromHtml(html, sourceLabel || sourceUrl),
      sourceUrl,
      sourceDate: 'not_stated',
      confidence: confidenceFor(privateDataRemoved, sourceUrl, personName),
      discoveredAt,
      tailMarker: input.tailMarker
    });
  }
  if (!records.length && (roleMatches.length || intermediaryMatches.length)) {
    records.push({
      companyName,
      personName: 'Not explicitly stated',
      role: roleMatches[0]?.[0] ?? intermediaryMatches[0]?.[0] ?? 'Public professional role mentioned',
      affiliation: companyName,
      intermediaryType: intermediaryMatches[0]?.[0]?.toLowerCase() ?? 'not_stated',
      siteOrProject: 'Not explicitly stated',
      location,
      signalStatus: status,
      evidenceSummary: `Public page ${sourceLabel || sourceUrl} mentions a professional role or intermediary category but does not explicitly name a person.`,
      sourceTitle: titleFromHtml(html, sourceLabel || sourceUrl),
      sourceUrl,
      sourceDate: 'not_stated',
      confidence: 'low',
      discoveredAt,
      tailMarker: input.tailMarker
    });
  }
  return records;
}

function dedupe(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = [record.sourceUrl, record.personName, record.role, record.companyName].join('|').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runResearch(input, fetchImpl = fetch, now = new Date()) {
  const safeInput = clampInput(input);
  const started = Date.now();
  const records = [];
  let pages = 0;
  for (const entry of safeInput.startUrls) {
    if (pages >= safeInput.maxPages || records.length >= safeInput.maxItems) break;
    if ((Date.now() - started) / 1000 >= safeInput.timeoutSeconds) break;
    const response = await fetchImpl(entry.url, { redirect: 'follow', signal: AbortSignal.timeout(safeInput.timeoutSeconds * 1000) });
    if (!response.ok) continue;
    const html = await response.text();
    pages += 1;
    records.push(...extractRecords({ html, sourceUrl: entry.url, sourceLabel: entry.label, input: safeInput, discoveredAt: now.toISOString() }));
  }
  return { records: dedupe(records).slice(0, safeInput.maxItems), pages, tailMarker: safeInput.tailMarker };
}

