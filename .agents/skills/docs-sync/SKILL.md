---
name: docs-sync
description: Optional documentation workflow - handles on-demand Tech Doc and RFC updates in Strand/Docmost via MCP only when requested by the user with specified Space and target doc/URL.
---

# Docs Sync (Optional / On-Demand)

This skill governs **when and how** documentation is created or updated in Strand / Docmost. The content format adheres strictly to `tech-doc-generator` (Tech Docs) and `docmost-rfc-generator` (RFCs).

> [!NOTE]
> **Optional Workflow:** Dokumentasi ke Strand / Docmost bersifat **opsional**. Agent tidak boleh memaksakan atau menjalankan pembaruan dokumentasi secara otomatis tanpa persetujuan eksplisit dari user.

> [!IMPORTANT]
> **User Input Required:** Ketika user memilih untuk memperbarui dokumentasi, user **WAJIB memberikan**:
> 1. **Nama Space** di Strand / Docmost.
> 2. **Nama dokumen** atau **link URL Strand** dari dokumen yang ingin di-update.
> 
> **Language Mandate:** Seluruh penulisan dokumentasi (Tech Docs, RFCs, dan Changelogs) yang dipublikasikan ke Strand/Docmost via MCP **wajib ditulis dalam Bahasa Inggris (English)**.

## A. Post-Plan Offer & Decision Flow
Pada setiap akhir penyusunan Implementation Plan atau sebelum fase rilis, tawarkan ke user:
> *"Apakah Tech Doc atau RFC terkait pada Strand Docmost MCP mau di-update? Jika ya, mohon berikan nama Space dan nama dokumen (atau link URL Strand) yang ingin di-update."*

| Keputusan User | Tindakan |
|---|---|
| **Tidak / Skip / Ga Perlu** | Lewati seluruh proses pembuatan/update Docmost. Catat di brief/report: `Docs skipped per user decision`. Lanjutkan langsung ke fase berikutnya. |
| **Ya (beserta Space & Doc/URL)** | Lanjutkan proses draft Tech Doc atau RFC sesuai spesifikasi di bawah. |
| **Ya, tapi belum sebut Space/Doc** | Minta user menyebutkan nama Space dan nama dokumen/URL Strand sebelum memanggil MCP. Dilarang menebak Space atau dokumen secara acak. |

---

## B. RFC (Opsional - Desain Inisiatif Baru)
1. Dilakukan hanya jika disetujui user dan mencakup fitur baru.
2. Gunakan `search_pages` pada Space yang diinformasikan user untuk memeriksa apakah RFC serupa sudah pernah dibuat.
3. Jika membuat RFC baru: ikuti `docmost-rfc-generator` dalam Bahasa Inggris (Mermaid code blocks, tabel GFM, format `RFC-YYYY-NNN`).
4. Dilarang mengarang detail RFC; tulis `Needs confirmation` bila terdapat parameter yang belum diketahui.

---

## C. Tech Doc (Opsional - Living Technical Reference)
1. **Verifikasi Target:** Pastikan target Space dan ID halaman induk telah diverifikasi berdasarkan input Space dan URL/nama doc dari user.
2. **Klasifikasi Perubahan:** Petakan perubahan dari `git diff` ke tipe komponen (Controller -> API Contract, Business Logic, Kafka, RabbitMQ, Hangfire -> Background Process, Entity/Migration -> Data Model, Refit -> Integration, AppConfig -> Config).
3. **Drafting:** Tulis draft entri dalam Bahasa Inggris ke `.office/tasks/<id>/docs-draft.md` mengikuti template komponen terkait.
4. **Review (Gate 2):** Tampilkan draft bersama review diff dan test report.
5. **Write ke MCP:** Setelah disetujui, update dokumen target di Strand MCP menggunakan `update_page` atau `create_page_from_template`.

---

## D. Failure Conditions & Guardrails
- Jika MCP tidak dapat diakses atau gagal terhubung: catat status blocked dan laporkan ke user tanpa menghentikan penyelesaian task kode.
- Dilarang mempublikasikan secret, connection string, password, token, atau data personal (PII) ke Docmost.
- Seluruh konten halaman di Strand Docmost tetap wajib ditulis dalam Bahasa Inggris.
