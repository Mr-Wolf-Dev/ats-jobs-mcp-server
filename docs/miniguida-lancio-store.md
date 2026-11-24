# Miniguida Operativa: Lancio & SEO su Apify Store — `ats-jobs-mcp-server`

Guida rapida per configurare **Publication**, **Icona**, **256 MB RAM** e **Pay-Per-Event (PPE)** su Apify Console per `mr.wolf/ats-jobs-mcp-server`.

---

## 1. Configurazione `Publication` (SEO Apify Store)

- **Title (SEO):**
  ```text
  Tech & Startup Jobs Scraper (Greenhouse, Lever, Ashby, SmartRecruiters + MCP)
  ```
- **Short description:**
  ```text
  Extract normalized tech jobs, salaries, remote roles & B2B hiring signals from Greenhouse, Lever, Ashby & SmartRecruiters JSON APIs. 256 MB HTTP-only Actor + Standby MCP Server for AI agents, n8n & Make.
  ```
- **Categories:** `Jobs`, `Lead generation`, `AI`
- **Icona:** carica `assets/actor-icon.png` (alto contrasto, leggibile a 48×48 px).
- **Visibility:** `Public`

---

## 2. Default Run Options (Massimo Margine PPE)

- **Memory:** `256 MB`
- **Timeout:** `120` secondi
- **Build tag:** `latest`

---

## 3. Monetizzazione Pay-Per-Event (PPE)

1. Mantieni `apify-actor-start` (`$0.00005`).
2. Rimuovi `apify-default-dataset-item` (`Result`).
3. Configura gli eventi custom:
   - `job-extracted` — *Title:* `Job extracted` — *Description:* `Single normalized job posting extracted from Greenhouse, Lever, Ashby, or SmartRecruiters.` — *Price:* `$0.003` – `$0.008`
   - `mcp-query` — *Title:* `MCP tool query` — *Description:* `Single MCP tool invocation (search_ats_jobs, get_company_jobs, or detect_hiring_signals) in Standby mode.` — *Price:* `$0.02`
4. Attiva gli sconti automatici Store (`Bronze` / `Silver` / `Gold`).
5. **Primary event:** `job-extracted`.
