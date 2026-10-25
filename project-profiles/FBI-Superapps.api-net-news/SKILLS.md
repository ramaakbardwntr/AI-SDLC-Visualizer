# Project Profile — FBI-Superapps.api-net-news

> Dihasilkan otomatis oleh `project-scanner` pada `2026-10-25` dari commit `dbe8f68`.
> Terakhir diverifikasi manusia: `2026-10-25`.
> Kalau ada bagian yang bertanda `<!-- MANUAL: ... -->`, **jangan timpa** saat re-scan.

## 1. Identitas Proyek

| Field | Nilai |
|---|---|
| **Nama** | `FBI-Superapps.api-net-news` (`FBINews`) |
| **Repo URL** | `https://github.com/KLG-tech/FBI-Superapps.api-net-news.git` |
| **Tipe** | `microservice` |
| **Target Framework** | `net8.0` |
| **Bahasa & versi** | C# 12 (default SDK `.NET 8.0`, `ImplicitUsings: enable`, `Nullable` tidak diaktifkan di `FBINews.csproj`, `Nullable: enable` di `FBINews.Test.csproj`) |
| **Solution file** | `FBI-Superapps.api-net-news.sln` |
| **Sub-projects** | `FBINews/FBINews.csproj` (`Microsoft.NET.Sdk.Web`), `FBINews.Test/FBINews.Test.csproj` (`Microsoft.NET.Sdk`) |
| **Base branch** | `master` |
| **Deploy target** | Docker (`FBINews/Dockerfile`, base `mcr.microsoft.com/dotnet/aspnet:8.0`, port `8080`) → OpenShift (`QAOCP`, `STAGING` / `ELY`, `PRODUCTION`) via GitHub Actions (`.github/workflows/openshift-api.news-net.yaml`) |
| **Service page di Strand** | `https://strand.sw.klgsys.com/s/PFBISUPERAPPS/p/news-service-cii4vH9BWs` (Page ID: `01a0cce3-9ea5-7550-b972-80ba4e6ef4a5`, Slug: `cii4vH9BWs`) |
| **Service owner / squad** | FBI Superapps Squad (KLG-tech) |

## 2. Arsitektur & Layering

### 2.1 Gaya Arsitektur
Layered **Controller → Business → (Repository | Direct `NewsContext`) → Database (PostgreSQL)** untuk operasi HTTP sinkron (Mobile/Web client, Backoffice CMS, dan Internal API-Key consumers), ditambah **RabbitMQ Event Publisher** (`KLGLib.common.helpers.EventHelper`) untuk pengiriman inbox notification & cancel broadcast, serta **Redis Distributed Cache** (`FBINews/Utils/Redis/RedisCache.cs`).

Terdapat dua variasi akses data di layer Business:
1. **Controller → Business → Repository → `NewsContext`**: digunakan oleh `AccountHelper`, `Internal`, `News`, `Notification`, `PopupBanner`, dan `UserGroup` (beberapa seperti `InternalBusiness`, `NotificationBusiness`, dan `PopupBannerBusiness` juga meng-inject `NewsContext` secara langsung untuk mengatur transaksi `Database.BeginTransactionAsync()`).
2. **Controller → Business → `NewsContext` (tanpa class Repository)**: digunakan oleh fitur yang lebih baru/ter-refactor yaitu `BannerBusiness`, `PromotionBusiness`, dan `SplashScreenBusiness`.

### 2.2 Peta Folder
```text
FBI-Superapps.api-net-news/
├── .agents/
│   └── tech-doc/SKILL.md              # Skill sinkronisasi dokumentasi teknis ke Strand Docmost
├── .github/workflows/                 # CI/CD OpenShift & PR coverage runner (threshold 40%)
├── FBINews/                           # Main Web API project (net8.0)
│   ├── Business/                      # Layer business logic per domain
│   │   ├── AccountHelper/             # IAccountHelperBusiness, AccountHelperBusiness
│   │   ├── Banner/                    # IBannerBusiness, BannerBusiness (Static & Dynamic Carousel Banner)
│   │   ├── Internal/                  # IInternalBusiness, InternalBusiness (CMS CRUD News/FAQ/AccountHelp & Internal API)
│   │   ├── News/                      # INewsBusiness, NewsBusiness
│   │   ├── Notification/              # INotificationBusiness, NotificationBusiness (Inbox Notification & Excel/CSV parser)
│   │   ├── PopUpBanner/               # IPopupBannerBusiness, PopupBannerBusiness
│   │   ├── Promotion/                 # IPromotionBusiness, PromotionBusiness (Active popup banner untuk Mobile)
│   │   ├── Repositories/              # Layer repository (EF Core queries)
│   │   │   ├── AccountHelper/         # IAccountHelperRepository, AccountHelperRepository
│   │   │   ├── Internal/              # IInternalRepository, InternalRepository
│   │   │   ├── News/                  # INewsRepository, NewsRepository
│   │   │   ├── Notification/          # INotificationRepository, NotificationRepository
│   │   │   ├── PopUpBanner/           # IPopupBannerRepository, PopupBannerRepository
│   │   │   └── UserGroup/             # IUserGroupRepository, UserGroupRepository
│   │   ├── SplashScreen/              # ISplashScreenBusiness, SplashScreenBusiness
│   │   └── UserGroup/                 # IUserGroupBusiness, UserGroupBusiness
│   ├── Config/                        # AppConfig (remote config mapping) & AppConstants
│   ├── Context/                       # NewsContext (EF Core DbContext, PostgreSQL)
│   ├── Controllers/
│   │   ├── FBIController.cs           # Base controller (ekstraksi session JWTModel WEB/CMS)
│   │   └── RestApi/                   # 11 REST API Controllers (34 endpoints)
│   ├── Entities/                      # 8 file EF Core Entity (memetakan 9 tabel database)
│   ├── Event/                         # NewsEvent.cs (legacy RabbitMQ consumer stub, saat ini di-comment di Program.cs)
│   ├── Migrations/                    # EF Core migrations (initial migration 20240416075806_20240416AllTable)
│   ├── Requests/                      # Request DTOs & multipart form payloads
│   ├── Responses/                     # Response DTOs
│   ├── Utils/
│   │   ├── Attributes/                # Custom validation attributes (AllowedExtensionsAttribute, MaxFileSizeAttribute)
│   │   ├── FbiAssetApi/               # IFbiAssetApi, FbiAssetApi (wrapper FNBLibrary AssetHelper ke AWS S3)
│   │   ├── FbiProductApi/             # IFbiProductApi (Refit client ke FBI Product Service)
│   │   ├── Redis/                     # RedisCache (StackExchange.Redis wrapper, mendukung Sentinel & standalone)
│   │   ├── DepedencyInjectionUtilities.cs # Bootstrap AppConfig (ConfigHelper), EventHelper, dan MyLog
│   │   ├── ExcelFileProcessor.cs      # ClosedXML & Npoi.Mapper helper untuk file member notification
│   │   ├── FileValidator.cs           # Validasi ekstensi & ukuran file
│   │   └── StringUtility.cs           # Base64 encode/decode & snake_case JSON naming policy
│   ├── Dockerfile
│   ├── Program.cs                     # Entry point, DI registration, middleware pipeline
│   └── news.sql                       # DDL SQL script awal
└── FBINews.Test/                      # Integration/Controller unit test project (xUnit + Testcontainers)
    ├── MockData/                      # File dummy & response mock untuk pengujian
    ├── Seeder/                        # Database seeders per modul (AccountHelp, Banner, FAQ, News, Notification, PopupBanner, Promotion, UserGroup)
    ├── Tests/Controllers/             # BaseControllerTests & test suites per Controller
    ├── Utils/                         # AlphabeticalOrderer, FormFileHelper, SessionHelper, UnitTestConstants
    ├── CustomWebApplicationFactory.cs # Testcontainers PostgreSQL (postgres:15) & Redis (redis:7-alpine) + Moq overrides
    └── coverlet.runsettings           # Konfigurasi eksklusi code coverage
```

### 2.3 Dependency Direction & Aturan Layer
- `Controllers/RestApi/*Controller` → `Business/*/*Business` (via interface `I*Business`), kecuali `HealthController` yang meng-inject `NewsContext` secara langsung untuk `Database.CanConnect()`.
- Semua controller domain (kecuali `HealthController` dan `SplashScreenController`) mewarisi `FBIController` (`FBINews/Controllers/FBIController.cs`) untuk membaca session `JWTModel` dari `HttpContext.Items["session"]` (`GetUsernameCMS()`, `GetExecutorId()`, `GetEmailWEB()`, `GetMemberCodeWEB()`, `GetMemberCardCodeWEB()`). Catatan: `SplashScreenController` mewarisi `ControllerBase` dan memiliki helper `GetUsernameCMS()` lokal.
- `Business/*/*Business` → `Business/Repositories/*/*Repository` (via interface `I*Repository`) **atau** langsung ke `NewsContext` (`BannerBusiness`, `PromotionBusiness`, `SplashScreenBusiness`), serta integrasi eksternal (`IFbiAssetApi`, `IEventHelper`, `RedisCache`, `AppConfig`).
- **Catatan penting di `UserGroupRepository`**: method `GetTotalNotificationGroupData()` (`L121`) dan `GetDetailNotificationGroup(int id)` (`L140`) membungkus `using (_db)` pada `NewsContext` yang di-inject sebagai `Scoped`, sehingga men-dispose `DbContext` lebih awal setelah dipanggil. Hindari menyalin pola `using (_db)` ini pada kode baru.

### 2.4 Dependency Injection (`Program.cs` & `DepedencyInjectionUtilities.cs`)
- **Singleton**:
  - `AppConfig` (di-load saat startup via `KLGLib.config.ConfigHelper.LoadConfig<AppConfig>(ACCESS_TOKEN)` kecuali saat `EnvironmentName == "UNITTEST"`).
  - `RedisCache` (`new RedisCache(appconfig.REDIS_HOST)`).
  - `IEventHelper` (`EventHelper`) & `IMyLog` (`MyLog`) — hanya didaftarkan di `ConfigureCustomUtilities` jika `EnvironmentName != "UNITTEST"`, ditambah `AddHostedService(p => (EventHelper)p.GetRequiredService<IEventHelper>())`.
- **Scoped**:
  - `NewsContext` (`AddDbContext<NewsContext>` dengan `UseNpgsql(appconfig.DB_URL)`).
  - Semua Business services: `IAccountHelperBusiness`, `INewsBusiness`, `IInternalBusiness`, `IBannerBusiness`, `IPromotionBusiness`, `INotificationBusiness`, `IPopupBannerBusiness`, `IUserGroupBusiness`, `ISplashScreenBusiness`.
  - Semua Repositories: `IAccountHelperRepository`, `INewsRepository`, `IInternalRepository`, `INotificationRepository`, `IPopupBannerRepository`, `IUserGroupRepository`.
  - `IFbiAssetApi` (`FbiAssetApi`).
- **Refit HTTP Client**:
  - `IFbiProductApi` didaftarkan via `AddRefitClient<IFbiProductApi>()` dengan `BaseAddress = new Uri(appconfig.PRODUCT_API_URL)` dan header `X-FBI-API-KEY` serta `X-API-KEY` (`Program.cs:L54-L62`).

## 3. Konvensi Kode

### 3.1 Naming
| Elemen | Konvensi | Contoh dari kode |
|---|---|---|
| Controller | `<Domain>Controller` | `BannerCMSController`, `SplashScreenController`, `PopupBannerController` |
| Business service | `I<Domain>Business` / `<Domain>Business` | `ISplashScreenBusiness` / `SplashScreenBusiness`, `IBannerBusiness` / `BannerBusiness` |
| Repository | `I<Domain>Repository` / `<Domain>Repository` | `INotificationRepository` / `NotificationRepository` |
| Entity | `<Name>Entity` (serta `FAQDetailModels`) dengan atribut `[Table("snake_case")]` & `[Column("snake_case")]` | `SplashScreenEntity` (`[Table("splash_screen")]`), `BannerEntity` (`[Table("static_banner")]`) |
| Request / Response DTO | `<Action><Domain>Request` / `<Action><Domain>Payload` / `<Action><Domain>Response` | `CreateSplashScreenRequest`, `UpdateBannerPayload`, `ActiveSplashScreenResponse` |
| Constant | `UPPER_SNAKE_CASE` di `AppConstants` | `REDIS_SPLASH_SCREEN`, `INBOX_NOTIFICATION_CANCEL_EVENT`, ` NOTIFICATION_REDIIRECTION_PROMO` |
| Test class & method | `<ControllerName>Tests` dengan urutan alfabetis `A1_<Scenario>`, `B1_<Scenario>` | `SplashScreenControllerTests.A1_CreateSplashScreen_Success_AsPublished` |

### 3.2 Error Handling & Response Envelope
- Menggunakan middleware dari `FNBLibrary`:
  - `app.UseErrorHandlingMiddleware()` (menangkap `ValidationException`, `BadHttpRequestException`, `ArgumentException`, `KeyNotFoundException`, dll. menjadi response error HTTP standar).
  - `app.UseCustomResponseMiddleware()` (membungkus response `Ok(...)` dalam envelope standar platform FBI).
- Validasi di layer Business melempar `System.ComponentModel.DataAnnotations.ValidationException` (menghasilkan HTTP 400) atau `KeyNotFoundException` (menghasilkan HTTP 404 pada `SplashScreenBusiness`).

### 3.3 Validation
- Kombinasi DataAnnotations (`[Required]`, `[MaxLength]`, `[StringLength]`, `[MinLength]`), `IValidatableObject` (contoh: `CreateSplashScreenRequest.Validate` memastikan `EndDate > StartDate`), custom attributes di `FBINews/Utils/Attributes/` (`[AllowedExtensions]`, `[MaxFileSize]`), serta validasi bisnis eksplisit di `*Business.cs`.

### 3.4 Logging & Observability
- OpenTelemetry dikonfigurasi melalui `FNBLibrary`:
  - `builder.Logging.AddCompleteLog(appconfig)` → OTLP HTTP ke `{OpenTelemetryBaseUrl}/v1/logs`.
  - `builder.Services.AddCompleteTelemetry(appconfig)` → OTLP HTTP ke `{OpenTelemetryBaseUrl}/v1/traces` (mengecualikan `/healthz`).
- `KLGLib.common.log.IMyLog` (`MyLog`) mem-publish application error/audit log ke RabbitMQ logging queue (`appconfig.rabbit_LoggingQueue`).

### 3.5 Authentication & Authorization
- Menggunakan `app.UseCustomAuthMiddleware()` dan atribut `[Authorize]` dari `FNBLibrary`:
  - **Public (tanpa `[Authorize]`)**: `GET /news`, `GET /news/detail`, `GET /static-banner`, `GET /static-banner/list`, `GET /account-help/*`, `GET /splash-screen/active`, `GET /healthz`.
  - **Mobile / Web Session (`[Authorize("WEB")]`)**: `GET /promotion/banner`.
  - **Backoffice CMS Session (`[Authorize("CMS")]`)**: semua endpoint di `BannerCMSController`, `PopupBannerController`, `UserGroupController`, `NotificationController`, `SplashScreenController` (`/internal/splash-screen/cms*`), serta endpoint CMS di `InternalController` (`/internal/account-help*`, `/internal/faq*`, `/internal/news*` kecuali `/internal/news/detail`).
  - **Internal Service API Key (`[Authorize(authWithApiKey: true)]` / `[Authorize(true)]`)**: `GET /internal/news/detail`, `GET /internal/user-group`, `GET /internal/user-group/detail` (menggunakan header `X-API-KEY` yang dicocokkan dengan `AppConfig.API_KEY`).

## 4. Database & Data Access

- **ORM**: EF Core `8.0.11` (`Npgsql.EntityFrameworkCore.PostgreSQL` `8.0.11`) dengan `AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true)`.
- **DbContext**: `NewsContext` (`FBINews/Context/NewsContext.cs`).
- **9 Tabel yang Dimiliki (`NewsContext`)**:
  1. `account_help` (`AccountHelpEntity`, `DbSet<AccountHelpEntity> AccountHelpDB`)
  2. `faq_detail` (`FAQDetailModels` di dalam `AccountHelpEntity.cs`, `DbSet<FAQDetailModels> FAQDetailDB`)
  3. `static_banner` (`BannerEntity`, `DbSet<BannerEntity> Banner`) — relasi `1:N` cascade delete ke `static_banner_detail`
  4. `static_banner_detail` (`StaticBannerDetailEntity`, `DbSet<StaticBannerDetailEntity> staticBannerDetails`, FK `static_banner_id`)
  5. `news` (`NewsEntity`, `DbSet<NewsEntity> NewsDB`)
  6. `notification` (`NotificationEntity`, `DbSet<NotificationEntity> ctxNotification`)
  7. `notification_group` (`NotificationGroupEntity`, `DbSet<NotificationGroupEntity> ctxNotificationGroup`, kolom `rules` bertipe `jsonb`)
  8. `pop_up_banner` (`PopupBannerEntity`, `DbSet<PopupBannerEntity> ctxPopupBanner`)
  9. `splash_screen` (`SplashScreenEntity`, `DbSet<SplashScreenEntity> ctxSplashScreen`, PK `Guid id`, optimistic concurrency `xmin` dipetakan ke `uint RowVersion`)
- **Konvensi Transaksi**: Operasi multi-langkah atau yang melibatkan upload S3 / publish RabbitMQ membungkus perubahan dalam `await using var tx = await _context.Database.BeginTransactionAsync()` diikuti `await tx.CommitAsync()` dan rollback + cleanup S3 (`DeleteFileBulk`) saat terjadi exception (contoh terbaik: `SplashScreenBusiness` dan `BannerBusiness`).

## 5. Messaging, Caching & Integrasi Eksternal

### 5.1 RabbitMQ (`EventHelper`)
| Operasi | Exchange / Queue | Direction | Trigger & Sumber |
|---|---|---|---|
| `sendMessage("", "inbox_notification", json)` | Queue `inbox_notification` | Publish | `NotificationBusiness.CreateNotification` & `UpdateNotification` (`type`: `created` / `updated` / `deleted`) |
| `brodcastEvent("inbox_notification_cancel", json)` | Exchange `appconfig.rabbit_EventBus` / event `inbox_notification_cancel` | Publish | `NotificationBusiness.CancelNotification` (minimal 15 menit sebelum `SendOn`) |
| `MyLog` | Exchange `appconfig.rabbit_LoggingQueue` | Publish | Logging terpusat dari `DepedencyInjectionUtilities.cs` |

### 5.2 Redis Cache Keys (`RedisCache`)
| Key Pattern | TTL | Digunakan di | Catatan Invalidation |
|---|---|---|---|
| `account_help:about_apps`, `account_help:privacy_policy`, `account_help:term_condition`, `account_help:faq` | 1 menit | `AccountHelperBusiness`, `InternalBusiness` | Dihapus saat update/create di `InternalBusiness` |
| `news:all:limit{limit}`, `news:all-summary:limit{limit}`, `news:detail:{id}`, `news:id:{id}`, `news:exists:{id}` | 1 menit | `NewsBusiness`, `InternalBusiness` | Dihapus via `DeleteByMatchingKey("news:*")` saat create/update news di `InternalBusiness` |
| `news:active-static-banner`, `news:active-dynamic-banner` | 24 jam | `BannerBusiness` | Dihapus saat create/update banner di `BannerBusiness` |
| `promotion:active:banner:{now.Date}` | 1 jam | `PromotionBusiness`, `PopupBannerBusiness` | Dihapus via `DeleteByMatchingKey("promotion:active:banner:*")` saat create/update popup banner |
| `news:splash-screen:{yyyy-MM-dd}` | Dinamis (s/d `custom.EndDate` jika berakhir hari ini, atau `23:59:59 WIB`) | `SplashScreenBusiness` | Dihapus via `DeleteByMatchingKey("news:splash-screen:*")` saat create/update splash screen |

### 5.3 Outbound HTTP & Cloud Storage
- **AWS S3 (`IFbiAssetApi` / `FNBLibrary.Assets.AssetHelper`)**: upload single/bulk file dan hapus file di bucket `AppConfig.AWS_BUCKET` (`ap-southeast-1`).
- **FBI Product Service (`IFbiProductApi` via Refit)**: `GET /productcms/sku` dan `GET /productcms/code`.
- **Spring Cloud Config Server (`KLGLib.config.ConfigHelper`)**: mengambil konfigurasi `AppConfig` saat startup menggunakan environment variable `ACCESS_TOKEN`.

## 6. Testing

- **Framework**: xUnit `2.4.1`, `Moq` `4.20.70`, `Microsoft.AspNetCore.Mvc.Testing` `6.0.36`, `Testcontainers.PostgreSql` `4.8.1` (`postgres:15`), `Testcontainers.Redis` `4.8.1` (`redis:7-alpine`).
- **Cara Menjalankan Test**:
  ```bash
  dotnet test FBI-Superapps.api-net-news.sln
  ```
- **Prasyarat Lokal (Docker / WSL TCP Port 2375)**:
  - `CustomWebApplicationFactory` mengecek apakah port TCP `localhost:2375` (`UnitTestConstants.tcpWSLPort`) terbuka sebelum menjalankan Testcontainers (`postgres:15` dengan DB `news_test` dan `redis:7-alpine`). Pastikan Docker daemon mengekspos `tcp://localhost:2375` saat menjalankan unit test.
- **Struktur & Pola Unit Test (`FBINews.Test`)**:
  - Semua test controller mewarisi `BaseControllerTests`, berada dalam `[Collection("collection")]` (`DatabaseCollection` yang membagikan instance `CustomWebApplicationFactory<Program>`), dan menggunakan `[TestCaseOrderer("FBINews.Test.Utils.AlphabeticalOrderer", "FBINews.Test")]`.
  - Terdapat **2 pola instansiasi Controller** di `FBINews.Test`:
    1. **DI Scope Pattern (Direkomendasikan untuk fitur baru)**: me-resolve `I*Business` dari `_factory.Services.CreateScope().ServiceProvider.GetRequiredService<I*Business>()` dan men-setup mock pada `_factory._fbiAssetApiMock` / `_factory._eventHelperMock` (contoh: `SplashScreenControllerTests`, `BannerCMSControllerTests`, `BannerControllerTests`, `PromotionControllerTests`).
    2. **Manual Instantiation Pattern (Legacy)**: membuat `new *Repository(_context)` dan `new *Business(...)` secara langsung dengan `Mock<IFbiAssetApi>` / `Mock<IEventHelper>` lokal (contoh: `NotificationControllerTests`, `PopupBannerControllerTests`, `InternalControllerTests`).
  - Session JWT disuntikkan ke controller menggunakan `SessionHelper.CreateSessionWEB()` atau `SessionHelper.CreateSessionCMS()` ke `controller.ControllerContext.HttpContext.Items["session"]`.
- **Code Coverage Gate**:
  - `.github/workflows/pr-coverage.yaml` menjalankan `KLG-tech/dotnet-coverage-runner` dengan `threshold: '0.4'` (**40%**) dan `FBINews.Test/coverlet.runsettings` (mengecualikan `Entities`, `Config`, `Utils`, `Migrations`).

## 7. Guardrails Spesifik Proyek

<!-- MANUAL: tambahkan aturan khusus proyek ini yang tidak boleh dilanggar agen -->
- **Jangan mengubah cara autentikasi/session**: ekstraksi user/CMS wajib melalui `HttpContext.Items["session"]` (`JWTModel` dari `FNBLibrary`).
- **Jangan men-dispose `NewsContext` yang di-inject DI**: jangan gunakan `using (_db)` di dalam method Repository/Business karena `NewsContext` terdaftar sebagai `Scoped`.
- **Selalu bersihkan file S3 jika transaksi DB gagal**: setiap upload ke S3 (`_fbiAssetApi.UploadFile` / `UploadFileBulk`) di dalam transaksi DB wajib memiliki blok `catch` yang melakukan `RollbackAsync()` dan memanggil `_fbiAssetApi.DeleteFileBulk(...)` untuk mencegah file yatim (orphan) di S3.
- **Selalu invalidasi Redis cache setelah mutasi CMS**: pastikan key terkait (`news:*`, `news:active-static-banner`, `news:active-dynamic-banner`, `promotion:active:banner:*`, `news:splash-screen:*`, `account_help:*`) dihapus setelah operasi create/update/cancel berhasil.
- **Jangan pernah menaruh kredensial/secret asli** di `AppConfig.cs`, test file, ataupun dokumentasi Strand Docmost.

