# Platform Notes (Strand / Docmost)

Skill `tech-doc-generator` merujuk ke `platform-notes.md`. Di kantor ini, file inilah acuannya. **Selalu verifikasi** ID lewat MCP (`list_templates`, `search_pages`) sebelum menulis; ID dapat berubah.

## MCP
- Nama server di `.mcp.json`: `strand` (ubah di `office.config.yml` bila berbeda).
- Di Claude Code, nama tool berbentuk `mcp__strand__<tool>`. Tool yang dipakai skill: `search_pages`, `list_pages`, `get_page`, `create_page`, `update_page`, `create_page_from_template`, `list_templates`, `get_template`.

## Halaman induk (isi sesuai workspace kamu)
| Keterangan | Page ID |
|---|---|
| `<System> Tech Doc` (induk semua Service Tech Doc) | _isi_ |
| Induk RFC | _isi_ |

## Template ID (disalin dari skill `tech-doc-generator`; verifikasi dulu)
| Template | Shape | ID |
|---|---|---|
| Service Tech Doc | page-level, satu per service | `01a08e5d-b017-7d1b-94cd-5992e208c938` |
| API Contract Entry | entry | `01a08a36-6bed-7bb2-989b-f464718dbbbd` |
| Business Logic Entry | entry | `01a08e61-c729-7442-bc74-f53d9ddaa9d1` |
| Kafka/Queue Entry | entry | `01a08a36-75a1-7533-bec5-597500d88175` |
| RabbitMQ/Queue Entry | entry | `01a0cc3c-c113-73c3-bd05-15c407a3a285` |
| Background Process Entry | entry | `01a08a40-257a-7ce1-9d4d-2ca827fada21` |
| Data Model | page-level | `01a08a40-4e80-7533-b3ea-0e31bbab3bf8` |
| Integration Entry | entry | `01a08a36-9a93-7dbe-bbc4-5bc17155960c` |
| Config | page-level | `01a08a40-3451-725a-8626-f4c4c6222804` |
| Frontend/UI Entry | entry | `01a08a36-b7c0-78e1-87d4-c2f94e53ded5` |

## Service Tech Doc per proyek
Diisi otomatis oleh `scout`/`scribe` ke `office.config.yml` (`docmost_service_page_id`).
