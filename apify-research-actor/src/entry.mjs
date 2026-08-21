import { Actor } from 'apify';
import { runResearch } from './main.mjs';

console.log(JSON.stringify({ event: 'entrypoint_started', at: new Date().toISOString() }));
await Actor.init();

try {
  const input = await Actor.getInput();
  const inputShape = {
    mode: input?.mode ?? null,
    targetCompanyCount: Array.isArray(input?.targetCompanies) ? input.targetCompanies.length : 0,
    startUrlCount: Array.isArray(input?.startUrls) ? input.startUrls.length : 0,
    hasTailMarker: Boolean(input?.tailMarker)
  };
  console.log(JSON.stringify({ event: 'input_received', ...inputShape }));
  await Actor.setValue('RUN_SUMMARY', { phase: 'input_received', ...inputShape });

  const result = await runResearch(input);
  console.log(JSON.stringify({ event: 'research_summary', pages: result.pages, items: result.records.length, diagnostics: result.diagnostics }));
  for (const record of result.records) await Actor.pushData(record);

  const summary = {
    phase: 'completed',
    mode: 'research',
    pages: result.pages,
    items: result.records.length,
    diagnostics: result.diagnostics,
    tailMarker: result.tailMarker,
    safeguards: ['public_https_only', 'no_private_contacts', 'no_consent_inference', 'no_outreach']
  };
  await Actor.setValue('RUN_SUMMARY', summary);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ event: 'research_error', message }));
  await Actor.setValue('RUN_SUMMARY', { phase: 'error', message }).catch(() => {});
  throw error;
} finally {
  await Actor.exit();
}

