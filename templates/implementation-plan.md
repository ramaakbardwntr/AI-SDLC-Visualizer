# Implementation Plan - <judul task>

- Task ID: <id> | Proyek: <project> (<tfm>) | Mode: A/B | Branch: <nama> (baru/sudah ada, base <main|master>)
- Estimasi total (rekomendasi): <x> manday (1 manday = 9 jam)

## 1. Ringkasan task
<satu paragraf, kata-kata sendiri>

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
**Test existing terdampak**
| Test class | Penyesuaian |
|---|---|

**Skenario test baru**
| Function | Skenario | Data seed | Tabel.field yang di-assert | Response | Mock (external client) |
|---|---|---|---|---|---|

## 7. Dampak Dokumentasi
| Halaman Tech Doc | Entri | Perubahan |
|---|---|---|
Feature baru: ya/tidak -> RFC: <status>

## 8. Pertanyaan terbuka dan asumsi
- 

## 9. Keputusan yang dibutuhkan
Balas: `approve opsi A` / `approve opsi B` / minta revisi (sebutkan bagian) / batal.
