# T88R Public Research Actor

This is a **separate** Apify Actor package for organization T88R. It is not the existing Telegram Virtual Sales Agent and does not import or invoke its sales, buyer, negotiation, viewing, handoff, Telegram, Supabase, OpenRouter, WhatsApp, or Make.com paths.

## Purpose

The Actor accepts bounded public HTTPS source pages for Malaysia and Singapore hyperscalers and infrastructure operators. It extracts only publicly disclosed professional names, roles, company affiliations, explicit intermediary categories, source evidence, locations, confidence, and timestamps. It writes structured review rows to the default dataset and a small run summary to the key-value store.

## Safety boundary

The Actor rejects non-HTTPS sources and requires `mode=research`. It does not accept authenticated cookies, login URLs, private profiles, contact lists, phone numbers, or email lists. It redacts phone numbers and email addresses from page text before evidence generation. It never sends messages, creates leads, infers consent, schedules viewings, or performs outreach. Intermediary status is `not_stated` unless a public page explicitly uses a consultant, broker, adviser, arranger, agency, or equivalent term.

## Pilot limits

The input schema caps the run at 20 pages, 50 dataset items, link depth 1, and 120 seconds. For the approved round, invoke the Actor with an Apify-side `callOptions.maxTotalChargeUsd` of **2.50** where supported, and also use a small source list and item cap. The platform-level spend cap is not enforceable by JavaScript alone; do not run without the external call cap and operator approval.

## Local validation

```bash
npm install
npm test
```

The tests exercise HTTPS-only validation, research-mode separation, bounded limits, tail-marker requirements, identity extraction, and contact redaction. The tests do not call external websites.

## Deployment under T88R

Create a **new Actor** under organization T88R from this package or its Git repository. Do not overwrite `t88r-vsa/virtual-sales-agent`. Confirm that Standby mode is disabled for this research Actor unless a future requirement explicitly needs it; the research workflow is intended for manual runs. Review the input and dataset schemas in the Apify Console. Deployment is a separate approval step from running.

## First-run proposal

Use a small set of official or high-quality public source URLs, `mode=research`, the target company list, `maxPages` no higher than 10, `maxItems` no higher than 20, `maxDepth=0`, a 120-second timeout, and a fresh ISO timestamp tail marker. Run synchronously only after confirming the revised Actor build, then review every dataset row before writing to PropertySignal Malaysia or exporting Excel.

`TAIL_MARKER: 2026-08-20T03:40:40Z | PACKAGE_STATUS: SOURCE_READY | DEPLOYMENT: NOT_STARTED | ACTOR_RUN: NOT_STARTED`
