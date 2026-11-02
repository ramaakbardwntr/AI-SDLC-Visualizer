---
name: jira-task-generator
description: Generate Jira tasks for Kanban Boards (with upfront Implementation Plan categorized by Epic/Task/Story, Jira Board URL verification, and direct push to MCP Jira at https://klgtech.atlassian.net/) based on git branch or commit inspection.
---

# Jira Task Generator (Kanban & MCP Jira)

This skill generates accurate Jira tasks by **directly inspecting branch and commit contents**, creating an **upfront Jira Implementation Plan** categorized by **Epic / Task / Story** suited for a **Kanban Board**, confirming the Jira Board URL, and pushing directly to **MCP Jira (`https://klgtech.atlassian.net/`)** upon user approval.

---

## Core Rules

1. **Wajib Buat Jira Implementation Plan Terlebih Dahulu:**
   Dilarang langsung membuat atau mem-push issue ke Jira tanpa mempresentasikan rencana breakdown tiket terlebih dahulu untuk direview dan disetujui user.
2. **Kategorisasi Kanban Board (Epic / Story / Task):**
   Jira menggunakan style **Kanban Board**. Setiap item pekerjaan wajib diklasifikasikan ke dalam kategori yang tepat:
   - **`Epic`**: Inisiatif besar atau modul fitur baru yang menaungi beberapa Story/Task lintas komponen.
   - **`Story`**: Kapabilitas fungsional atau enhancement yang memberikan *business value* langsung kepada pengguna/sistem.
   - **`Task`**: Pekerjaan teknis spesifik, chore, bug fix, refactoring, atau setup unit test/konfigurasi.
3. **Jira Base URL & Board Verification:**
   - Base URL: `https://klgtech.atlassian.net/`
   - Agent wajib mengetahui atau mengonfirmasi **URL Jira Board / Project Key** target (misal `https://klgtech.atlassian.net/jira/software/c/projects/<KEY>/boards/<BOARD_ID>` atau Project Key terkait) sebelum dispatch.
4. **Direct Push ke MCP Jira:**
   Setelah user menyetujui Jira Implementation Plan, agent langsung memanggil MCP tool Jira untuk membuat issue dan menyajikan link tiket `https://klgtech.atlassian.net/browse/<KEY>`.

---

## Workflow Steps

### Step 1 — Identifikasi Target Branch & Git Evidence
1. Periksa branch aktif dan status git:
   ```bash
   git rev-parse --abbrev-ref HEAD
   git status --short
   ```
2. Tentukan base branch (`main` / `master` / `develop`):
   ```bash
   git merge-base <base-branch> HEAD
   ```
3. Kumpulkan commit log dan diff lengkap:
   ```bash
   git log <merge-base>..HEAD --reverse --pretty=format:"%h | %an | %ad | %s" --date=iso
   git diff <merge-base>..HEAD --stat
   git diff <merge-base>..HEAD
   ```

### Step 2 — Verifikasi URL Jira Board / Project Target
Pastikan tujuan Jira diketahui:
- Base URL resmi: `https://klgtech.atlassian.net/`
- Periksa apakah URL Board atau Project Key sudah disebutkan user (misal `https://klgtech.atlassian.net/jira/software/c/projects/ABC/boards/12` $\rightarrow$ Project Key: `ABC`).
- Jika belum diketahui, tanyakan kepada user sekali: *"Mohon informasikan URL Jira Kanban Board atau Project Key target di https://klgtech.atlassian.net/"*.

### Step 3 — Susun Jira Implementation Plan (Upfront Review)
Sebelum mengeksekusi MCP, agent menyusun **Implementation Plan Jira** dalam format berikut:

```markdown
### 📋 Jira Implementation Plan (Kanban Review)

**Target Board / Project:** <URL Board atau Project Key>
**Base URL:** `https://klgtech.atlassian.net/`

#### Daftar Item yang Akan Dibuat:

| No | Tipe (Epic / Story / Task) | Summary / Title | Parent Epic | Estimasi Manday | Deskripsi Singkat |
|---|---|---|---|---|---|
| 1 | `Epic` (jika inisiatif baru) | [Service] - [Initiative Title] | - | X manday | Ringkasan inisiatif |
| 2 | `Story` | [Service] - [Capability / Feature] | <Epic Key / No> | X manday | Ringkasan flow bisnis |
| 3 | `Task` | [Service] - [Technical Chore / Fix] | <Epic/Story Key> | X manday | Detail perubahan teknis |

---

#### Rincian Tiket:

##### Tiket 1: [Tipe] [Summary]
- **Issue Type:** `Epic` | `Story` | `Task`
- **Parent:** <Parent Link bila ada>
- **Start Date:** YYYY-MM-DD
- **End Date:** YYYY-MM-DD
- **Estimate:** X manday (~X jam kerja; 1 manday = 9 jam kerja)
- **Description:**
  **Root Cause**
  ...
  **Changes**
  - ...
  **Expected**
  ...
```

### Step 4 — Standar Rincian Field per Tiket

1. **Title / Summary:**
   - Format: `[Service Name] - [Work Performed]`
   - Maksimal ~80 karakter, diawali kata kerja aksi (Fix, Add, Improve, Refactor, Implement).
2. **Description:**
   - **Root Cause**: Latar belakang requirement atau akar penyebab masalah berdasarkan bukti diff.
   - **Changes**: Poin-poin perubahan spesifik (menyebutkan Controller, Service, Entity, Table, Migration, Unit Test).
   - **Expected**: Perilaku sistem yang terverifikasi dan dapat diuji.
3. **Start Date & End Date:**
   - Format: `YYYY-MM-DD`. Berasal dari commit pertama dan terakhir pada branch (atau ditentukan user).
4. **Mandays Estimate:**
   - Unit: **1 manday = 9 jam kerja** (kelipatan 0.25).
   - Minor change: 0.25 (~2.25 jam)
   - 1 method logic + unit test: 0.5 (~4.5 jam)
   - Feature Controller + Service + Model + tests: 0.75 - 1.0 (~6.75 - 9 jam)
   - Multi-layer + DB migration: 1.5 - 2.0 mandays

### Step 5 — Direct Push ke MCP Jira (Setelah Approval)
1. Setelah user memberikan persetujuan (`"approve plan jira"` / `"approve push"`), agent memanggil tool MCP Jira untuk membuat tiket ke `https://klgtech.atlassian.net/`.
2. Urutan pembuatan:
   - Jika ada **Epic**: buat Epic terlebih dahulu untuk mendapatkan Epic Key.
   - Buat **Story** atau **Task** dan tautkan `parent` ke Epic terkait.
3. Laporkan hasil pembuatan:
   ```markdown
   ✅ Berhasil membuat issue di Jira:
   - Epic : [ABC-101](https://klgtech.atlassian.net/browse/ABC-101) - [Service] Initiative
   - Story: [ABC-102](https://klgtech.atlassian.net/browse/ABC-102) - [Service] Feature
   - Task : [ABC-103](https://klgtech.atlassian.net/browse/ABC-103) - [Service] Technical Task
   ```
