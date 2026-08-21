import { Actor } from 'apify';
import { runResearch } from './main.mjs';

await Actor.init();
try {
  const input = await Actor.getInput();
  const result = await runResearch(input);
  console.log(JSON.stringify({ event: 'research_summary', pages: result.pages, items: result.records.length, diagnostics: result.diagnostics }));
  for (const record of result.records) await Actor.pushData(record);
  await Actor.setValue('RUN_SUMMARY', {
    mode: 'research',
    pages: result.pages,
    items: result.records.length,
    tailMarker: result.tailMarker,
    safeguards: ['public_https_only', 'no_private_contacts', 'no_consent_inference', 'no_outreach']
  });
} finally {
  await Actor.exit();
}
