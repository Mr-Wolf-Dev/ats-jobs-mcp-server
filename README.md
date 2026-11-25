# Tech & Startup Jobs Scraper (Greenhouse, Lever, Ashby, SmartRecruiters + MCP)

[![Mr-Wolf-Dev/ats-jobs-mcp-server MCP server](https://glama.ai/mcp/servers/Mr-Wolf-Dev/ats-jobs-mcp-server/badges/score.svg)](https://glama.ai/mcp/servers/Mr-Wolf-Dev/ats-jobs-mcp-server)

Extract, filter, and normalize **live tech & startup job postings**, **salary ranges**, **remote roles**, and **B2B hiring intent signals** directly from **Greenhouse**, **Lever**, **Ashby**, and **SmartRecruiters** — available both as an **HTTP-only Apify Actor** and as a **Standby MCP Server** for AI agents.

Designed for **Pay-Per-Event (PPE)** cost efficiency with **zero headless browsers** and **no proxies required** (runs smoothly on **256 MB RAM**).

---

## Why Use This Multi-ATS Scraper & MCP Server?

- **4 Major ATS Platforms, 1 Unified Schema:** Query **Greenhouse**, **Lever**, **Ashby**, and **SmartRecruiters** public JSON APIs in a single run.
- **Zero Headless Browsers:** Pure HTTP/JSON (`got-scraping`) — sub-second board fetches, 256 MB RAM, maximum PPE margin.
- **Automatic Salary & Seniority Extraction:** Reads structured compensation (Ashby `summaryComponents`) and parses salary ranges from job text (Lever/Greenhouse), plus infers `seniority` (`intern` → `executive`) and `workplaceType` (`remote` / `hybrid` / `onsite`).
- **B2B Hiring Intent Signals (`detect_hiring_signals`):** Spot which target accounts are scaling Engineering, AI, or Sales teams in real time.
- **Fault-Isolated Batching:** A 404 or typo on one board never aborts the remaining company boards.
- **Dual Mode (Batch + Standby MCP):** Export JSON/CSV datasets for **n8n** and **Make**, or connect **Claude Desktop** and **Cursor** directly via Streamable HTTP MCP.

---

## Supported Board Formats (`boards`)

Pass either `provider:slug` or the full public ATS board URL:

| ATS | `provider:slug` Example | Supported URL Example |
| --- | --- | --- |
| Greenhouse | `greenhouse:stripe` | `https://boards.greenhouse.io/stripe` |
| Lever | `lever:spotify` | `https://jobs.lever.co/spotify` |
| Ashby | `ashby:openai` | `https://jobs.ashbyhq.com/openai` |
| SmartRecruiters | `smartrecruiters:BoschGroup` | `https://jobs.smartrecruiters.com/BoschGroup` |

---

## Input Examples (Copy-Paste)

### 1. Remote AI & Engineering Roles Across Top Tech Companies
```json
{
  "boards": ["greenhouse:stripe", "lever:spotify", "ashby:openai"],
  "keywords": ["AI", "Infrastructure", "Engineer"],
  "remoteOnly": true,
  "maxItems": 50
}
```

### 2. B2B Sales Hiring Signals (Lead Generation Trigger)
```json
{
  "boards": ["greenhouse:stripe", "ashby:openai", "smartrecruiters:BoschGroup"],
  "keywords": ["Account Executive", "Head of Sales", "Solutions"],
  "postedAfter": "2026-11-01",
  "maxItems": 100
}
```

---

## Standby MCP Server for AI Agents

Connect **Cursor**, **Claude Desktop**, or any Streamable HTTP MCP client to:

```text
https://mr-wolf-1--ats-jobs-mcp-server.apify.actor/mcp
```

### Exposed MCP Tools
- `search_ats_jobs(boards, keywords, locations, departments, remoteOnly, postedAfter, includeDescription, maxItems)`
- `get_company_jobs(board, remoteOnly, includeDescription, maxItems)`
- `detect_hiring_signals(boards, keywords, postedAfter)`

See [`docs/integrations/mcp-clients.md`](./docs/integrations/mcp-clients.md) for client configuration snippets.

---

## Automation Integrations (n8n & Make)

- **n8n workflow template:** [`docs/integrations/n8n-workflow.json`](./docs/integrations/n8n-workflow.json)
- **Make.com scenario blueprint:** [`docs/integrations/make-scenario.json`](./docs/integrations/make-scenario.json)

---

## Pay-Per-Event (PPE) Pricing

- `apify-actor-start`: Standard Actor startup event.
- `job-extracted`: Charged once per normalized job pushed to the dataset in batch mode.
- `mcp-query`: Charged once per MCP tool invocation in Standby mode.

---

## Local Development

```bash
npm run typecheck && npm run lint && npm test && npm run build
apify run --purge
```

---

## Frequently Asked Questions (FAQ)

**Does this ATS Jobs Scraper require proxies or a headless browser?**
No. It queries the official public JSON APIs of **Greenhouse**, **Lever**, **Ashby**, and **SmartRecruiters** directly over HTTP (`256 MB` RAM), keeping execution times fast and Pay-Per-Event (PPE) margins high.

**How do I extract B2B hiring intent signals for lead generation?**
Pass your target accounts in `boards` (e.g. `["greenhouse:stripe", "ashby:openai"]`), filter by `keywords` such as `["Head of Sales", "Account Executive", "DevOps"]` and `postedAfter`, or call the `detect_hiring_signals` MCP tool from Claude Desktop or Cursor.

**Does it extract salaries and remote status automatically?**
Yes. It reads structured compensation from Ashby (`summaryComponents`), parses salary ranges from Lever and Greenhouse job descriptions, normalizes `workplaceType` (`remote`, `hybrid`, `onsite`), and infers `seniority` (`intern` to `executive`).

**Can I use this with n8n, Make, or AI Agents (MCP)?**
Yes. Use batch mode via the Apify API / n8n / Make blueprints, or connect any Streamable HTTP MCP client to `https://mr-wolf-1--ats-jobs-mcp-server.apify.actor/mcp`.


---

## Related Actors by mrWolf

- **[B2B Domain Intelligence & Email Verifier + MCP](https://apify.com/mr.wolf/domain-intel-mcp-server)** — Enrich hiring companies with tech stack, DNS/MX/SPF/DMARC email readiness, and contact pages.
- **[EU Public Tenders & Grants Monitor (TED Europa + MCP)](https://apify.com/mr.wolf/eu-tenders-mcp-server)** — Extract and filter active European public procurement notices.
- **[SAM.gov US Federal Contracts & Grants + MCP](https://apify.com/mr.wolf/us-sam-tenders-mcp-server)** — Keyless US federal contract opportunities, NAICS codes, and contracting officer contacts.

---

## Quick REST API Call

```bash
curl -X POST "https://api.apify.com/v2/acts/mr.wolf~ats-jobs-mcp-server/run-sync-get-dataset-items?token=YOUR_APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d {}
```

## Related HTTP-Only MCP Actors by Mr. Wolf

All Actors run HTTP-only (< 512 MB RAM, zero headless browsers) with Pay-Per-Event pricing and Streamable HTTP Standby MCP endpoints:

| Actor | Use Case | Apify Store | Source |
| --- | --- | --- | --- |
| **Shopify Store Intel, Apps & Catalog** | Themes, 28+ apps & pixels, BNPL payments, /products.json | [Apify Store](https://apify.com/mr.wolf/shopify-store-intel-mcp-server) | [GitHub](https://github.com/Mr-Wolf-Dev/shopify-store-intel-mcp-server) |
| **Global KYB Entity, LEI & EU VAT** | GLEIF LEI parent trees, EU VIES VAT, French SIRENE | [Apify Store](https://apify.com/mr.wolf/global-kyb-entity-mcp-server) | [GitHub](https://github.com/Mr-Wolf-Dev/global-kyb-entity-mcp-server) |
| **FDA Recalls, 510(k) & Clinical Trials** | openFDA recalls, 510(k) clearances, ClinicalTrials.gov v2 | [Apify Store](https://apify.com/mr.wolf/pharma-regulatory-mcp-server) | [GitHub](https://github.com/Mr-Wolf-Dev/pharma-regulatory-mcp-server) |
| **SEC EDGAR Filings & XBRL Financials** | 10-K, 10-Q, 8-K, Form 4 & US-GAAP XBRL metrics | [Apify Store](https://apify.com/mr.wolf/sec-edgar-mcp-server) | [GitHub](https://github.com/Mr-Wolf-Dev/sec-edgar-mcp-server) |
| **B2B Domain Intel & Email Verifier** | DNS/MX/SPF/DMARC deliverability, tech stack & contacts | [Apify Store](https://apify.com/mr.wolf/domain-intel-mcp-server) | [GitHub](https://github.com/Mr-Wolf-Dev/domain-intel-mcp-server) |
| **EU Public Tenders & Grants (TED Europa)** | European procurement notices by CPV, country & budget | [Apify Store](https://apify.com/mr.wolf/eu-tenders-mcp-server) | [GitHub](https://github.com/Mr-Wolf-Dev/eu-tenders-mcp-server) |
| **SAM.gov US Federal Contracts** | Keyless US federal RFPs, NAICS & contracting officers | [Apify Store](https://apify.com/mr.wolf/us-sam-tenders-mcp-server) | [GitHub](https://github.com/Mr-Wolf-Dev/us-sam-tenders-mcp-server) |
