---
name: profile-<project>
description: Profil proyek <project> (<type>, <tfm>). Dibaca semua agent sebelum mengerjakan task di repo ini agar mengikuti struktur dan gaya yang ada.
project: <project>
repo: <owner/repo>
type: microservice | monolith | legacy     # perlu konfirmasi user
tfm: net6.0 | net8.0 | net10.0
lang_version: <default atau nilai di csproj>
base_branch: main | master
scanned_commit: <hash>
scanned_at: YYYY-MM-DD
status: draft | confirmed
---

# Profil Proyek: <project>

## 1. Identitas
| Item | Nilai | Bukti |
|---|---|---|
| Tipe | | |
| Solution / project utama | | |
| TFM dan LangVersion | | |
| Nullable / ImplicitUsings | | |

## 2. Peta layer
| Layer | Lokasi | Catatan |
|---|---|---|
| Controller / endpoint | | |
| Service / Business | | |
| Repository / data access | | |
| Entity / Model | | |
| DTO / Request / Response / Messages | | |
| Helper / Util | | |
| Migrations / script SQL | | |

## 3. Konvensi kode
- Penamaan dan struktur:
- Registrasi DI (file dan lifetime lazim):
- Mapping / validasi / mediator:
- Format response API dan error handling:
- Logging:
- Fitur C# yang **boleh** dipakai:
- Fitur C# yang **tidak boleh** dipakai:

## 4. Data
- ORM dan versi:
- DbContext (nama, lokasi) dan provider:
- Schema dan konvensi nama tabel/kolom:
- Migration: ada / tidak (cara mengubah skema bila tidak):
- Base entity / kolom audit:

## 5. Integrasi dan proses
| Jenis | Detail | Bukti |
|---|---|---|
| Kafka (WolverineFx) | | |
| RabbitMQ (EventHelper) | | |
| Hangfire | | |
| Outbound (Refit/HttpClient/SDK) | | |
| Config (appsettings/AppConfig/env) | | |

## 6. Testing
- Project test (path):
- Framework / mock library / assertion:
- Strategi database di test (DB nyata? connection string dari mana? aman untuk dijalankan?):
- Pola seeder dan cleanup yang ada:
- Konvensi nama test class:
- Perintah test terfilter:
  ```bash
  dotnet test <path.csproj> --filter "FullyQualifiedName~<NamaClassTests>"
  ```
- Contoh pola test (maks 40 baris):
  ```csharp
  ```
- Catatan: `Tidak ada test project` bila memang tidak ada.

## 7. Git dan CI
- Branch utama:
- Pola nama branch yang terlihat (referensi saja; nama task selalu dari user):
- CI / PR template repo:

## 8. Docmost
- Service Tech Doc page ID: <id | belum ada>
- Komponen yang relevan: API Contract, Business Logic, ... (hanya yang memang ada)

## 9. Guardrail
1. 
2. 

## 10. Pertanyaan terbuka
- 
