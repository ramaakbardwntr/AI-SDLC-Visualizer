---
name: implementation-plan
description: Author an Implementation Plan for .NET engineering tasks in standard format (findings, affected files, multi-option solutions with pros/cons/recommendation, unit test namespace audit and meaningful coverage, and optional docs/PR offers) in Indonesian by default for user review and approval prior to coding.
---

# Implementation Plan

The plan is a basis for discussion and decision-making, not a mere formality. The user makes decisions based on this document, so it must be honest, specific, and traceable to the codebase. Use `templates/implementation-plan.md` as the skeleton and persist it at `.office/tasks/<id>/plan.md`.

> [!IMPORTANT]
> **Language Mandate:** Seluruh hasil dokumen Implementation Plan (`plan.md` / `implementation_plan.md`) **wajib ditulis dalam Bahasa Indonesia secara default**. Istilah teknis software engineering tetap dipertahankan dalam Bahasa Inggris (mis. Controller, Service, Repository, Migration, DbContext, Mock, Seeder, DTO, Payload, Event Consumer, dll.).

## Known Files Approach (Mode A)
1. Read the files referenced by the user. Trace callers and dependencies (`grep` class/method names) to surface unmentioned impacts.
2. Restate the task in your own words (one concise paragraph in Indonesian) so misunderstandings are caught early.

## Business Flow / Trace Issue (Mode B)
1. Identify the entry point (endpoint, message consumer, background job). Trace execution flow down to Services, Repositories, and database tables.
2. Gather evidence in `path:line` format. Strictly separate **Facts** from **Hypotheses**; assign confidence levels (high/medium/low).
3. If root cause cannot yet be determined with certainty, state so clearly and propose verification steps (logs, read-only queries, reproduction test). Do not force a solution on top of unverified assumptions.

## Plan Structure (Fixed Order)

1. **Ringkasan Task (Task Summary):** Satu paragraf deskriptif dalam kata-kata sendiri mengenai tujuan, konteks masalah, dan batasan scope.
2. **Temuan (Findings):** Alur kerja saat ini, root cause atau architectural gap, bukti konkret file dan baris kode (`path/File.cs:123`), pemisahan fakta vs hipotesis.
3. **Scope Perubahan (Scope of Changes):** Tabel terstruktur `File | Class/Method | Jenis (ubah/tambah/hapus) | Alasan`.
4. **Opsi Solusi (Solution Options - Multi-Options):**
   - Sajikan beberapa alternatif pendekatan teknis (`Opsi A`, `Opsi B`, `Opsi C`, dst.) apabila terdapat variasi desain arsitektur yang valid.
   - Setiap opsi wajib memuat: **Pendekatan Teknis**, **Pros**, **Cons**, **Risiko**, dan **Estimasi Manday** (kelipatan 0.25; 1 manday = 9 jam kerja, selaras dengan `jira-task-generator`).
   - Wajib menyertakan **Rekomendasi** yang tegas (menunjuk 1 opsi terbaik beserta alasan pertimbangan bisnis & teknisnya).
5. **Dampak (Impacts):**
   - Database: entitas, kolom, index, migrasi (apakah perlu *Database Changes Query* di PR), kompatibilitas data existing.
   - API contract (breaking change?), messaging (Kafka/RabbitMQ), background job, configuration / environment variable, performa, backward compatibility.
6. **Dampak Unit Test (Unit Test Impact):**
   - **Audit Test Namespace Terkait:** Sebelum merancang skenario, wajib membaca seluruh test case existing yang berada di namespace/class terkait dengan function yang diubah.
   - **Konsolidasi & Eliminasi Redundansi:** Periksa test case existing; jika ditemukan test case yang redundant, tumpang tindih (*overlapping*), atau tidak relevan, rencanakan untuk dihapus atau disatukan agar test suite tetap ramping.
   - **100% Meaningful Coverage (Except Mocks):** Pastikan test case yang ada tetap meng-cover 100% branch/logic dari function yang diubah (**kecuali dependensi eksternal yang di-mock**). Test case wajib **meaningful untuk business flow nyata**—dilarang membuat test yang *over-tested* (banyak test untuk hal trivial yang sama) atau *over-engineering*.
   - **Patuhi Struktur Proyek Existing:** Ikuti struktur test project, pola seeder, cleanup, factory, helper, naming convention, dan code style unit test yang sudah berlaku di repositori tersebut.
   - Jika belum ada test project: informasikan secara eksplisit dan tanyakan apakah ingin disiapkan.
7. **Dampak Dokumentasi (Opsional):**
   - Bersifat **opsional**. Dokumentasi Tech Doc / RFC hanya diperbarui jika user mengonfirmasi kebutuhan update docs.
8. **Branch:** Nama branch (wajib dari user), status (baru / sudah ada), base branch (`main` / `master`).
9. **Pertanyaan Terbuka & Asumsi:** Catat detail yang belum pasti atau asumsi yang digunakan (`Perlu konfirmasi: ...`).
10. **Penawaran Lanjutan (Post-Plan Offers - Wajib Ditawarkan):**
    Setiap selesai menyusun implementation plan, tawarkan dua hal berikut kepada user:
    - **a. Update Strand Docmost MCP (Opsional):**
      Tawarkan apakah Tech Doc atau RFC terkait pada Strand Docmost MCP mau di-update. Tegaskan bahwa user wajib memberikan **nama Space** dan **nama dokumen (atau link URL Strand)** yang ingin di-update.
    - **b. Pembuatan Pull Request ke GitHub:**
      Tawarkan pembuatan PR ke GitHub, namun **wajib cek terlebih dahulu** apakah branch aktif sudah memiliki Pull Request terbuka (`gh pr list --head <branch>`). Jika belum ada PR, baru tawarkan kepada user; jika sudah ada, tampilkan info PR existing tersebut.
11. **Keputusan yang Dibutuhkan:** Prompt keputusan aksi yang jelas, misalnya: `Balas: "approve opsi A" / minta revisi / batal`.

---

## Quality Guidelines (Merged from CLAUDE.md)

Pedoman perilaku berikut wajib dipatuhi selama penyusunan rencana dan eksekusi untuk mencegah kesalahan implementasi:

### 1. Think Before Coding
- **Jangan berasumsi dan jangan sembunyikan keraguan.**
- Nyatakan asumsi secara eksplisit. Jika ada hal yang belum pasti, berhenti dan tanyakan ke user (`Perlu konfirmasi: ...`).
- Jika terdapat beberapa interpretasi atau alternatif solusi, sajikan seluruhnya—jangan memilih secara diam-diam.
- Jika terdapat pendekatan yang lebih sederhana, sampaikan secara terbuka dan berikan masukan (*push back*) bila rencana yang diminta terlalu kompleks.

### 2. Simplicity First
- **Kode minimum yang menyelesaikan masalah. Tanpa kode spekulatif.**
- Tidak merencanakan fitur di luar yang diminta.
- Tidak membuat abstraksi untuk kode sekali pakai (*single-use code*).
- Tidak menambahkan fleksibilitas, konfigurasi berlebihan, atau penanganan error untuk skenario yang mustahil terjadi.
- Tanyakan pada diri sendiri: *"Apakah senior engineer akan menilai solusi ini overcomplicated?"* Jika ya, sederhanakan.

### 3. Surgical Changes
- **Sentuh hanya yang wajib. Bersihkan hanya jejak sendiri.**
- Jangan "memperbaiki" kode, komentar, atau formatting di sekitar area perubahan yang tidak rusak.
- Jangan merefaktor kode yang berfungsi normal.
- Ikuti *style* dan struktur kode existing proyek, meskipun kamu memiliki preferensi berbeda.
- Jika menemukan *dead code* yang tidak terkait dengan task, sebutkan sebagai temuan—jangan dihapus kecuali diminta.
- Bersihkan *orphan code* (import, variabel, method) yang menjadi tidak terpakai akibat perubahan yang kamu buat sendiri. Setiap baris perubahan harus dapat ditelusuri langsung ke permintaan user.

### 4. Goal-Driven Execution
- **Definisikan kriteria sukses yang dapat diverifikasi secara mandiri.**
- Ubah task menjadi tujuan yang terukur:
  - *"Tambah validasi"* $\rightarrow$ *"Tulis test case untuk input tidak valid, lalu buat test lulus."*
  - *"Perbaiki bug"* $\rightarrow$ *"Tulis test yang mereproduksi bug, lalu buat lulus."*
- Untuk langkah berurutan, nyatakan verifikasinya:
  ```
  1. [Langkah] -> verify: [cara verifikasi / filter test]
  2. [Langkah] -> verify: [cara verifikasi / filter test]
  ```
- Rincikan **Cons** secara jujur, termasuk untuk opsi yang direkomendasikan.
- **Dilarang mulai memodifikasi kode sumber sebelum rencana disetujui (Gate 1).** Rencana adalah satu-satunya output pada fase ini.
