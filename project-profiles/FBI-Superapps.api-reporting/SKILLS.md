---
name: profile-FBI-Superapps.api-reporting
description: Profil proyek FBI-Superapps.api-reporting (microservice, Node.js 20.18.0 / TypeScript 4.6.4). Dibaca semua agent sebelum mengerjakan task di repo ini agar mengikuti struktur dan gaya yang ada.
project: FBI-Superapps.api-reporting
repo: KLG-tech/FBI-Superapps.api-reporting
type: microservice
tfm: node20.18.0-ts4.6.4
lang_version: TypeScript 4.6.4 (ES2022, CommonJS)
base_branch: master
scanned_commit: cec79ea
scanned_at: 2026-10-25
status: draft
---

# Profil Proyek: FBI-Superapps.api-reporting

> Dihasilkan otomatis oleh `project-scanner` pada `2026-10-25` dari commit `cec79ea` (branch `feat/update-package`).
> Kalau ada bagian yang bertanda `<!-- MANUAL: ... -->`, **jangan timpa** saat re-scan.

## 1. Identitas Proyek

| Field | Nilai | Bukti |
|---|---|---|
| **Nama** | `FBI-Superapps.api-reporting` (`fbi_reporting` / `api-reporting-service`) | `package.json:2`, `src/alerter/client.ts:62` |
| **Repo URL** | `KLG-Tech/FBI-Superapps.api-reporting` (legacy remote di `package.json`: `https://repository.klgsys.com/fbi-teams/fbi-api-reporting.git`) | `.github/workflows/pipeline.api-reporting-ts.yaml:32`, `package.json:27` |
| **Tipe** | `microservice` (perlu konfirmasi user) — satu deployable backend service khusus pelaporan (Reporting), analitik Dashboard CMS, monitoring Active Order, dan ekspor laporan CSV ke AWS S3 + Email | `src/index.ts`, `Dockerfile` |
| **Runtime & Bahasa** | Node.js `v20.18.0` (di-upgrade dari `18.1.0` di branch `feat/update-package`), TypeScript `^4.6.4` (`target: ES2022`, `module: commonjs`, `strict: true`) | `.nvmrc:1`, `Dockerfile:1-5`, `tsconfig.json:12-88` |
| **Framework Utama** | Express `^4.22.3`, Helmet `^5.0.2`, Prisma `^3.13.0` (`@prisma/client` multi-schema), Luxon `^2.5.2` | `package.json:53-65`, `src/index.ts:1-26` |
| **Base branch** | `master` (`origin/HEAD -> origin/master`; juga terdapat branch environment `staging` dan `development`) | `git branch -a`, `.github/workflows/openshift-api.reporting-ts.yaml:24-26` |
| **Deploy target** | Docker (`Dockerfile`, port `3000`) → OpenShift (`dev`, `qa`, `elysium`, `prod`, app name `fbi-superapps-ts-reporting-be`) & EKS (`pipeline.api-reporting-ts.yaml`) via GitHub Actions | `Dockerfile:15-19`, `.github/workflows/openshift-api.reporting-ts.yaml:10-87` |
| **Service page di Strand** | [Reporting Service](https://strand.sw.klgsys.com/p/1vZzwbh1uG) (ID: `01a170e7-d654-76ee-9d2d-948fa8f61ad2`, space `PFBISUPERAPPS` di bawah `TD`) | Strand Docmost MCP |
| **Service owner / squad** | FBI Superapps Squad (KLG-tech) | `.github/workflows/openshift-api.reporting-ts.yaml` |

## 2. Arsitektur & Layering

### 2.1 Gaya Arsitektur
Modular **Feature-based Express Router → Validator → Controller (Data Aggregation & Prisma ORM / Raw SQL) → Multi-Database PostgreSQL**, dilengkapi dengan:
1. **Asynchronous CSV Export Pipeline (`ReportHelper.ts`)**: Saat endpoint dipanggil dengan query parameter `?method=export`, data hasil agregasi di-serialize menjadi CSV (`csv`), ditulis ke direktori sementara `tmp/<filename>`, di-upload ke **AWS S3** (`@aws-sdk/client-s3` `PutObjectCommand` pada key `reporting/<filename>`), dicatat ke database `reporting` (tabel `report`), dikirimkan link unduhannya via **SMTP / Nodemailer** (`send_mail`), lalu file lokal di `tmp/` dihapus (`fs.unlink`).
2. **Error Alerter (`src/alerter/client.ts`)**: Mengirimkan error log (`ErrorMessage` dengan `service: "api-reporting-service"`) ke **RabbitMQ** queue `error_logs` (`amqplib`), dengan fallback HTTP `GET {ALERTER_BASE_URL}/token` dan `POST {ALERTER_BASE_URL}` (`undici`) apabila pengiriman ke queue gagal.

### 2.2 Peta Folder & Layer
```text
FBI-Superapps.api-reporting/
├── .agents/
│   ├── pull-request-generator/SKILLS.md  # Skill pembuat PR description & template
│   └── tech-doc/SKILLS.md                # Skill generator Tech Doc Strand Docmost
├── .github/workflows/
│   ├── openshift-api.reporting-ts.yaml   # CI/CD build Quay & deploy ArgoCD OpenShift
│   └── pipeline.api-reporting-ts.yaml    # CI/CD build & update manifest EKS
├── prisma/                               # Multi-database Prisma schemas (PostgreSQL)
│   ├── customer/schema.prisma            # Schema DB Customer (output: ./client)
│   ├── order/schema.prisma               # Schema DB Order (output: ./client)
│   ├── payment/schema.prisma             # Schema DB Payment (output: ./client, belum di-mount di npm script)
│   ├── promotion/schema.prisma           # Schema DB Promotion (output: ./client)
│   └── reporting/schema.prisma           # Schema DB Reporting milik service ini (tabel `report`)
├── src/
│   ├── index.ts                          # Entry point Express, koneksi Prisma & RabbitMQ, JWT middleware, route mounting
│   ├── auth/jwtPayload.ts                # Interface JWTPayload ({ type: string })
│   ├── alerter/client.ts                 # Class Alerter (RabbitMQ queue `error_logs` + HTTP fallback via undici)
│   ├── errors/dirtydata.ts               # Custom error DirtyDataError (menghasilkan HTTP 406 / 500)
│   ├── helpers/ReportHelper.ts           # Helper reportGenerator (CSV), uploadFile (S3 + DB report), send_mail (Nodemailer), formatDateTime
│   ├── health/routes.ts                  # GET /healthz
│   ├── sales/                            # Modul Online Sales Report (POST /reporting/sales)
│   ├── finance/                          # Modul Finance Transaction & Voucher Report (POST /reporting/finance/transaction, /voucher)
│   ├── financeBrand/                     # Modul Finance Brand Report (POST /reporting/finance-brand)
│   ├── operation/                        # Modul Operation Report (POST /reporting/operation/refund, /user-profile, /store-rating)
│   ├── delivery/                         # Modul Delivery Report (POST /reporting/delivery)
│   ├── activeOrder/                      # Modul Active Order Monitoring (POST /active-order/pickup, /delivery, GET /active-order/detail/:id)
│   └── dashboard/                        # Modul Analytics Dashboard CMS
│       ├── finance/                      # POST /dashboard/finance
│       ├── operation/                    # POST /dashboard/operation
│       ├── marketingTopUsedPromo/        # POST /dashboard/marketing/top-used-promotion
│       ├── marketingTopPerformStorePickup/   # POST /dashboard/marketing/top-perform-store-pickup
│       ├── marketingTopPerformStoreDelivery/ # POST /dashboard/marketing/top-perform-store-delivery
│       ├── marketingTopOthersTopProduct/ # POST /dashboard/marketing/top-other-product
│       ├── marketingTopPayment/          # POST /dashboard/marketing/top-other-payment
│       └── marketingTransaction/         # POST /dashboard/marketing/transaction
├── Dockerfile                            # Node 18 base image + upgrade via `n 20.18.0`, prisma:generate, tsc build
├── docker-compose.yml                    # Local PostgreSQL 14 (port 5433->5432, multi-DB) & RabbitMQ 3.9
├── package.json
└── tsconfig.json
```

### 2.3 Struktur Standar per Modul (`src/<module>/`)
Setiap modul fitur di `src/` memiliki 4 file standar:
| File | Tanggung Jawab | Contoh |
|---|---|---|
| `routes.ts` | Mendefinisikan factory function `export function <module>Routes(...clients, alerterClient): Router` yang menangani validasi request, memanggil fungsi agregasi di `controllers.ts`, menangani `?method=export` (bila didukung), serta menangkap `DirtyDataError` & error umum untuk dikirim ke `alerterClient.publish()`. | `src/finance/routes.ts`, `src/delivery/routes.ts` |
| `validators.ts` | Fungsi validasi input `validate<Name>Request(obj: Record<string, unknown>): string[]` yang memeriksa keberadaan field wajib dan validitas format tanggal `yyyy-MM-dd` menggunakan `luxon` (`DateTime.fromFormat`), serta mengisi nilai default array bila dikirim kosong (`[]`). | `src/sales/validators.ts`, `src/operation/validators.ts` |
| `controllers.ts` | Fungsi bisnis/agregasi async `aggregate<Name>(...dbClients, request): Promise<Result[]>` yang menjalankan query Prisma Client (`findMany`) maupun raw SQL (`$queryRaw` dengan `Prisma.sql` / `Prisma.join`), menggabungkan data lintas database di memori (in-memory join), melakukan pencarian string (`query`), dan memotong halaman (`slice(skipVal, takeVal)`). | `src/finance/controllers.ts`, `src/operation/controllers.ts` |
| `types.ts` | Definisi TypeScript `type` dan `interface` untuk Request payload, Response wrapper, item hasil agregasi, dan alias filter Prisma (`Prisma.order_headerWhereInput`, dsb.). | `src/delivery/types.ts`, `src/finance/types.ts` |

## 3. Konvensi Kode

### 3.1 Naming & TypeScript Strictness
- **TypeScript Compiler (`tsconfig.json`)**: Seluruh flag strict diaktifkan (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `exactOptionalPropertyTypes: true`, `noImplicitReturns: true`, `noUncheckedIndexedAccess: true`).
- **ESLint & Prettier (`.eslintrc.json`, `.prettierrc`)**:
  - `camelcase: "off"` (karena properti request/response API dan kolom database menggunakan `snake_case`).
  - `prefer-const: "error"`, `no-var: "error"`, `eqeqeq: ["error", "smart"]`, `consistent-return: "error"`.
  - Script verifikasi kualitas kode: `npm run check` (`tsc --noEmit && eslint . && prettier --check 'src/**'`).

### 3.2 Dependency Injection & Lifecycle (`src/index.ts` & `src/helpers/ReportHelper.ts`)
- Tidak menggunakan container IoC otomatis; menggunakan **Manual Constructor/Function Parameter Injection**:
  - Di `src/index.ts:31-48`, `customerClient`, `orderClient`, `promotionClient`, dan `alerterClient` diinstansiasi satu kali saat startup (`Promise.all([$connect()])`), lalu di-pass sebagai argumen ke masing-masing fungsi `*Routes(...)`.
  - Di `src/helpers/ReportHelper.ts:8`, `reportingClient` (`new ReportingClient()`) diinstansiasi di level modul untuk menyimpan histori file CSV ke tabel `report`.
  - Graceful shutdown ditangani pada sinyal `SIGTERM` dan `SIGINT` dengan memanggil `$disconnect()` pada ketiga Prisma client utama (`src/index.ts:107-113`).

### 3.3 Authentication & Authorization (`src/index.ts:56-87`)
- **Public (Tanpa Auth)**: `GET /healthz` (dipasang sebelum middleware JWT di `src/index.ts:56`).
- **CMS JWT Middleware (`src/index.ts:70-87`)**:
  - Membaca header `Authorization` (langsung berisi raw JWT string, **tanpa** prefix `Bearer `).
  - Memverifikasi token menggunakan `jwt.verify(token, jwtSecret)` (`process.env.JWT_SECRET || "secret"`).
  - Bila token kosong/tidak valid → HTTP `401` `{ message: "invalid token" }`.
  - Memeriksa `tokenPayload.type !== "CMS"` → bila bukan `"CMS"`, mengembalikan HTTP `403` `{ message: "not authorized" }`.

### 3.4 Error Handling & Status Codes
- **Validasi Input (`400` / `422`)**:
  - Bila `validate*Request(req.body)` mengembalikan array `missingKeys.length > 0`, route mengembalikan HTTP `400` `{ message: "some keys are missing: ..." }`.
  - Khusus `GET /active-order/detail/:id`, bila `id` kosong mengembalikan HTTP `422`.
  - Khusus ekspor CSV (`?method=export`) di `operation` dan `delivery`, bila `req.body.email` kosong mengembalikan HTTP `402` `{ message: "No email address provided" }`.
- **DirtyDataError (`406` vs `500`)**:
  - Pada endpoint `/reporting/*` dan `/active-order/*`, pelemparan `DirtyDataError` menghasilkan HTTP `406 Not Acceptable` `{ error: error.reason, name: error.name }` tanpa mengirim alert ke RabbitMQ.
  - Pada endpoint `/dashboard/*`, pelemparan `DirtyDataError` menghasilkan HTTP `500` `{ error: error.reason, name: error.name }` dan memanggil `alerterClient.publish()`.
- **Unhandled Error (`500`)**:
  - Mengembalikan HTTP `500` `{ error }` dan mem-publish detail error (`path`, `headers`, `stack_trace`) ke `alerterClient.publish(error, ErrorLevel.ERROR, ...)`.

### 3.5 Konvensi Pagination & In-Memory Join
- **Pagination 1-Based (`skip` = nomor halaman)**:
  - Di seluruh controller laporan (`sales`, `finance`, `financeBrand`, `operation`, `delivery`, `activeOrder`), field request `skip` diperlakukan sebagai **1-based page index** (`skipVal = (request.skip - 1) * request.take`, lalu `array.slice(skipVal, skipVal + request.take)`).
  - Bila `skip` atau `take` bernilai `0` atau `undefined`, seluruh data dikembalikan tanpa pemotongan (`return allRows`).
  - Field response pagination dinamai `currentPage: body.skip` (pada `/reporting/*`) atau `current_page: body.skip` (pada `/active-order/*`).

## 4. Database & Data Access

- **ORM**: Prisma `^3.13.0` dengan **5 skema PostgreSQL terpisah** di folder `prisma/`:
  1. **`prisma/reporting/schema.prisma` (`REPORTING_DATABASE_URL`) — Database Milik Service Ini (Read/Write)**:
     - Memiliki 1 tabel: `report` (`id`, `url`, `filename`, `report_channel`, `created_at`, `created_by`). Ditulis oleh `uploadFile()` di `src/helpers/ReportHelper.ts:67-75` setiap kali file CSV berhasil di-upload ke S3.
  2. **`prisma/order/schema.prisma` (`ORDER_DATABASE_URL`) — External Shared DB (Read-Only)**:
     - Mengakses tabel `order_header`, `stores`, `order_delivery`, `order_products`, `order_options`, `order_promotion`, `order_channel`, `order_status`, `order_ratings`, `products`, serta view/tabel raw SQL `order_payment_transaction`, `order_customer`, dan `order_ratings_reasons`.
  3. **`prisma/customer/schema.prisma` (`CUSTOMER_DATABASE_URL`) — External Shared DB (Read-Only)**:
     - Mengakses tabel `member`, `member_information`, `member_voucher`, `member_city`, dan raw SQL `member_login_history`.
  4. **`prisma/promotion/schema.prisma` (`PROMOTION_DATABASE_URL`) — External Shared DB (Read-Only)**:
     - Mengakses tabel `promotion`, `member_reward`, dan raw SQL `member_promotion`.
  5. **`prisma/payment/schema.prisma` (`PAYMENT_DATABASE_URL`) — External Shared DB (Schema-Only)**:
     - Definisi skema tersedia tetapi belum di-generate di `npm run prisma:generate` dan belum diinstansiasi di `src/index.ts`.
- **Migrations**:
  - Tidak menggunakan `prisma migrate` di repo ini; sinkronisasi skema dilakukan dengan `npm run prisma:pull` (`prisma db pull`) diikuti `npm run prisma:generate` (`prisma generate`).

## 5. Messaging, Storage & Integrasi Eksternal

| Jenis | Detail | Bukti |
|---|---|---|
| **RabbitMQ (`amqplib`)** | Koneksi AMQP (`RABBITMQ_URL`, connection name `superapps_reporting_service`). `Alerter` (`src/alerter/client.ts:41-70`) melakukan `assertQueue("error_logs", { durable: true, exclusive: false, autoDelete: false })` dan mem-publish pesan JSON `{ service: "api-reporting-service", level, message, stack_trace, additional_data }` menggunakan `channel.sendToQueue("error_logs", ...)`. | `src/index.ts:40-48`, `src/alerter/client.ts:21-72` |
| **HTTP Fallback Alerter (`undici`)** | Jika `channel.sendToQueue("error_logs")` mengembalikan `false` dan `ALERTER_BASE_URL` diset, `Alerter` memanggil `GET {ALERTER_BASE_URL}/token` lalu `POST {ALERTER_BASE_URL}` dengan header `X-FBI-Error-Token`. | `src/alerter/client.ts:74-97` |
| **AWS S3 (`@aws-sdk/client-s3`)** | Pada branch `feat/update-package`, migrasi dari `aws-sdk` v2 ke `@aws-sdk/client-s3` v3 (`S3Client` + `PutObjectCommand`). Meng-upload laporan CSV dari `tmp/<fileName>` ke bucket `S3_BUCKET_NAME` dengan key `reporting/<fileName>` di region `AWS_REGION` / `AWS_DEFAULT_REGION` (default `ap-southeast-1`). | `src/helpers/ReportHelper.ts:3, 39-93` |
| **SMTP Email (`nodemailer`)** | `send_mail()` di `src/helpers/ReportHelper.ts:115-150` mengirimkan email HTML berisi tautan unduhan S3 menggunakan `MAIL_SMTP_HOSTNAME`, `MAIL_SMTP_PORT`, `MAIL_SMTP_USERNAME`, `MAIL_SMPT_PASSWORD` (perhatikan typo historis `SMPT` di kode), `MAIL_SMTP_NAME`, `MAIL_SMTP_FROM`. | `src/helpers/ReportHelper.ts:115-150` |
| **Multi-DB PostgreSQL** | Koneksi langsung (read-only) ke database milik `Order Service`, `Customer Service`, dan `Promotion Service`, serta read/write ke database `Reporting Service`. | `src/index.ts:31-39`, `.env.example:7-11` |

## 6. Testing & Verifikasi Kualitas

- **Status Test Saat Ini**:
  - `ava` (`^4.2.0`), `c8` (`^7.11.2`), dan `eslint-plugin-ava` terdaftar di `devDependencies` (`package.json:40-44`), namun **belum ada file unit/integration test (`*.test.ts` / `*.spec.ts`)** maupun script `"test"` di `package.json`.
- **Perintah Verifikasi Build & Static Analysis**:
  ```bash
  npm run prisma:generate
  npm run check
  npm run build
  ```
  - `npm run check` menjalankan `tsc --noEmit && eslint . && prettier --check 'src/**'`.

## 7. Git dan CI/CD

- **Branch utama**: `master` (`origin/HEAD -> origin/master`). Branch aktif saat ini: `feat/update-package` (3 commit di atas `master`: `aacaaca`, `131095b`, `cec79ea`).
- **Tag versi terakhir**: `v1.1.8` (`git describe --tags --abbrev=0`), sedangkan `package.json` mencantumkan `"version": "1.0.0"`.
- **GitHub Workflows**:
  - `.github/workflows/openshift-api.reporting-ts.yaml`: Build image ke Quay (`KLG-tech/KLG.ReusableWorkflow`) & trigger deployment ArgoCD (`fbi-superapps-ts-reporting-be` untuk `dev`, `qa`, `elysium`, `prod`).
  - `.github/workflows/pipeline.api-reporting-ts.yaml`: Pipeline EKS (`superapps_fbi_api_reporting`). Pada branch `feat/update-package`, kredensial hardcoded pada workflow ini telah diganti menjadi `${{ secrets.* }}`.
- **PR Template**: Belum ada `.github/PULL_REQUEST_TEMPLATE.md` di repo (akan dibuat pada Task 3).

## 8. Docmost (Strand)

- **Space**: `[Product] FBI Superapps` (`PFBISUPERAPPS`, ID: `01a0e51e-4a4d-7c19-a64c-a29944c605d0`).
- **Parent Page**: `TD (Technical Documentation)` (ID: `01a09f76-5db4-734c-8ad3-789356da6fb2`, slug: `EU5Bv3BUfr`).
- **Service Tech Doc Page ID**: `belum ada` (akan dibuat sebagai halaman baru `Reporting Service` di bawah `01a09f76-5db4-734c-8ad3-789356da6fb2` pada Task 2).
- **Komponen yang relevan untuk Reporting Service**:
  1. `API Contract` (18 endpoint: 1 health check, 7 reporting endpoints, 3 active-order endpoints, 7 dashboard analytics endpoints)
  2. `Business Logic` (agregasi lintas DB Order/Customer/Promotion, kalkulasi subsidi & jarak pengiriman GoSend/GrabExpress, filter dinamis & 1-based pagination, alur ekspor CSV S3 + Email)
  3. `RabbitMQ/Queue` (queue `error_logs` via `Alerter`)
  4. `Data Model` (tabel `report` di `reporting` DB milik service ini + referensi tabel shared DB yang dibaca)
  5. `Integration` (AWS S3 `@aws-sdk/client-s3`, SMTP Nodemailer, Alerter HTTP fallback via `undici`, serta Direct Read-Only PostgreSQL ke Order/Customer/Promotion DB)
  6. `Config` (seluruh environment variables di `src/` dan `.env.example`)
  *(Catatan: Tidak memiliki `Kafka/Queue`, `Background Process` Hangfire, maupun `Frontend/UI`).*

## 9. Guardrail Spesifik Proyek

<!-- MANUAL: aturan khusus proyek ini yang tidak boleh dilanggar agen -->
1. **Jangan menjalankan mutasi (`create`/`update`/`delete`/`$executeRaw`) pada `orderClient`, `customerClient`, atau `promotionClient`**: ketiga Prisma client tersebut terhubung ke database produksi milik microservice lain; Reporting Service hanya boleh melakukan operasi **Read-Only** pada ketiganya, dan hanya boleh menulis ke `reportingClient` (`prisma/reporting`).
2. **Selalu jalankan `npm run prisma:generate` sebelum `npm run build` atau `npm run check`**: karena TypeScript mengimpor tipe dari `prisma/{customer,order,promotion,reporting}/client` yang tidak di-commit ke git.
3. **Gunakan parameterisasi `Prisma.sql` dan `Prisma.join()` pada `$queryRaw`**: dilarang menggunakan `$queryRawUnsafe` atau string concatenation langsung pada SQL mentah untuk mencegah SQL Injection. Pastikan array tidak kosong sebelum dikirim ke `Prisma.join(...)` karena `Prisma.join([])` akan melempar error runtime.
4. **Patuhi `tsconfig.json` strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `strictNullChecks`)**: selalu tangani kemungkinan `undefined` saat mengakses indeks array atau hasil `.find()`.
5. **Jaga kompatibilitas kontrak Pagination (`skip` 1-based)**: jangan mengubah rumus `(skip - 1) * take` tanpa koordinasi dengan tim Frontend CMS karena halaman pertama dikirim sebagai `skip: 1`.
6. **Pastikan stream file ditutup dan file `tmp/` dihapus setelah upload S3**: setiap operasi baca/tulis di `src/helpers/ReportHelper.ts` harus memanggil `readStream.destroy()` baik saat sukses maupun di blok `.catch()`, serta menghapus file sementara dengan `fs.unlink`.
7. **Jangan pernah menaruh kredensial/secret asli** di `.github/workflows/`, `.env.example`, kode sumber, maupun dokumentasi Strand Docmost.

## 10. Pertanyaan Terbuka
- Klasifikasi proyek ditetapkan sebagai `microservice` dengan runtime `Node.js 20.18.0 + TypeScript 4.6.4` dan base branch `master` (menunggu konfirmasi user pada Gate 1).

