# Implementation Plan - <judul task>

- Task ID: <id> | Proyek: <project> (<tfm>) | Mode: A/B | Branch: <nama> (baru/sudah ada, base <main|master>)
- Estimasi total (rekomendasi): <x> manday (1 manday = 9 jam)

## 1. Ringkasan task
<satu paragraf deskriptif dalam kata-kata sendiri>

## 2. Temuan
**Alur saat ini**
1. ...

**Root cause / gap**
- Fakta: ... (`path/File.cs:120`)
- Hipotesis: ... (keyakinan: tinggi/sedang/rendah)

## 3. Scope perubahan
| File | Class/Method | Jenis | Alasan |
|---|---|---|---|
| | | ubah/tambah/hapus | |

## 4. Opsi solusi
### Opsi A - <nama> (rekomendasi)
- Pendekatan:
- Pros:
- Cons:
- Risiko:
- Estimasi: <x> manday

### Opsi B - <nama>
- Pendekatan:
- Pros:
- Cons:
- Risiko:
- Estimasi: <x> manday

### Opsi C - <nama> (alternatif lain jika ada)
- Pendekatan:
- Pros:
- Cons:
- Risiko:
- Estimasi: <x> manday

**Rekomendasi:** Opsi <A> karena ...

## 5. Dampak
| Area | Dampak |
|---|---|
| Database (entity/kolom/index/migration) | |
| API contract (breaking?) | |
| Messaging (Kafka/RabbitMQ) | |
| Background job | |
| Config / env var | |
| Performa / backward compat | |

## 6. Dampak Unit Test
**Audit & Evaluasi Test Namespace Terkait**
*(Wajib membaca seluruh test case dalam namespace/class terkait sebelum menyusun rencana test)*
| Test Class / Method | Aksi (Pertahankan / Gabungkan / Hapus) | Alasan / Eliminasi Redundansi |
|---|---|---|
| | | |

**Skenario Test (100% Meaningful Coverage - Tanpa Over-Engineering)**
| Function | Skenario Business Flow | Data Seed | Tabel.Field yang Di-assert | Response | Mock (External Client Saja) |
|---|---|---|---|---|---|
| | | | | | |

*Catatan: Pastikan struktur, seeder, cleanup, dan code style unit test mengikuti konvensi test project existing.*

## 7. Dampak Dokumentasi (Opsional)
| Halaman Tech Doc | Entri | Perubahan |
|---|---|---|
Feature baru: ya/tidak -> RFC: <status>
*(Dokumentasi Strand Docmost bersifat opsional berdasarkan persetujuan user).*

## 8. Pertanyaan terbuka dan asumsi
- Perlu konfirmasi: ...

## 9. Penawaran Lanjutan (Post-Plan Offers - Wajib Ditawarkan)
- **a. Update Strand Docmost MCP (Opsional):** Apakah Tech Doc atau RFC terkait pada Strand Docmost MCP ingin sekalian di-update? Jika ya, mohon sebutkan **nama Space** dan **nama dokumen (atau link URL Strand)** yang ingin di-update.
- **b. Pembuatan Pull Request ke GitHub:** *(Cek terlebih dahulu via `gh pr list --head <branch>`)* Apakah branch `<branch>` ingin sekalian dibuatkan Pull Request ke GitHub?

## 10. Keputusan yang dibutuhkan
Balas: `approve opsi A` / `approve opsi B` / `approve opsi C` / minta revisi (sebutkan bagian) / batal.
