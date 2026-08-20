import test from 'node:test';
import assert from 'node:assert/strict';
import { runResearch } from '../src/main.mjs';

const html = `<!doctype html><html><head><title>Example Malaysia project</title></head><body>
  <h1>Example Malaysia project</h1>
  <p>Jane Doe is the Regional Director for Example Infrastructure Operator in Johor.</p>
  <p>Contact jane.doe@example.com or +60 12 345 6789.</p>
</body></html>`;

const fetchMock = async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });

const baseInput = {
  mode: 'research',
  markets: ['Malaysia', 'Singapore'],
  targetCompanies: ['Example Infrastructure Operator'],
  startUrls: [{ url: 'https://example.test/public-project', label: 'Example public project' }],
  locations: ['Johor'],
  maxPages: 20,
  maxItems: 50,
  maxDepth: 1,
  timeoutSeconds: 120,
  tailMarker: '2026-08-20T00:00:00Z'
};

test('extracts public professional identity fields and redacts contact data', async () => {
  const result = await runResearch(baseInput, fetchMock, new Date('2026-08-20T00:00:00Z'));
  assert.equal(result.pages, 1);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].personName, 'Jane Doe');
  assert.equal(result.records[0].role, 'Regional Director for Example Infrastructure Operator in Johor');
  assert.equal(result.records[0].companyName, 'Example Infrastructure Operator');
  assert.equal(result.records[0].location, 'Johor');
  assert.equal(result.records[0].tailMarker, '2026-08-20T00:00:00Z');
  assert.equal(result.records[0].evidenceSummary.includes('jane.doe@example.com'), false);
  assert.equal(result.records[0].evidenceSummary.includes('+60'), false);
});

test('rejects non-research mode and non-HTTPS sources', async () => {
  await assert.rejects(() => runResearch({ ...baseInput, mode: 'sales' }, fetchMock), /Only mode=research/);
  await assert.rejects(() => runResearch({ ...baseInput, startUrls: [{ url: 'http://example.test' }] }, fetchMock), /Only public HTTPS/);
});

test('enforces bounded page and item limits', async () => {
  const result = await runResearch({ ...baseInput, maxPages: 999, maxItems: 1 }, fetchMock);
  assert.equal(result.records.length, 1);
});

test('requires a tail marker and target company', async () => {
  await assert.rejects(() => runResearch({ ...baseInput, tailMarker: '' }, fetchMock), /tailMarker/);
  await assert.rejects(() => runResearch({ ...baseInput, targetCompanies: [] }, fetchMock), /target company/);
});
