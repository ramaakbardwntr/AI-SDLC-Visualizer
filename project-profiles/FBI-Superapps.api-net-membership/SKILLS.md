---
name: profile-FBI-Superapps.api-net-membership
description: Profil proyek FBI-Superapps.api-net-membership (microservice, net6.0). Dibaca semua agent sebelum mengerjakan task di repo ini agar mengikuti struktur dan gaya yang ada.
project: FBI-Superapps.api-net-membership
repo: KLG-tech/FBI-Superapps.api-net-membership
type: microservice
tfm: net6.0
lang_version: default (C# 10)
base_branch: master
scanned_commit: dfa6b65
scanned_at: 2026-10-24
status: confirmed
---

# Profil Proyek: FBI-Superapps.api-net-membership

## 1. Identitas
| Item | Nilai | Bukti |
|---|---|---|
| Tipe | `microservice` (dikonfirmasi user) — satu deployable service domain Membership/Loyalty (Point, Tier, Game Token, ESB Integration), satu `DatabaseContext` | `MembershipService.sln`, `FBI.MembershipService/Program.cs` |
| Solution / project utama | `MembershipService.sln` -> `FBI.MembershipService/FBI.MembershipService.csproj` dan `FBI.MembershipService.Test/FBI.MembershipService.Test.csproj` | `MembershipService.sln`, `FBI.MembershipService/FBI.MembershipService.csproj` |
| TFM dan LangVersion | `net6.0`, `LangVersion` tidak diset eksplisit (default .NET 6 = C# 10). Tidak ada `Directory.Build.props` atau `global.json` | `FBI.MembershipService/FBI.MembershipService.csproj:4`, `FBI.MembershipService.Test/FBI.MembershipService.Test.csproj:4` |
| Nullable / ImplicitUsings | `Nullable: enable`, `ImplicitUsings: enable`, `NoWarn: 1701;1702;8618;1591` | `FBI.MembershipService/FBI.MembershipService.csproj:5-15` |

## 2. Peta layer
| Layer | Lokasi | Catatan |
|---|---|---|
| Controller / endpoint | `FBI.MembershipService/Features/**/Controllers/*.cs` & `FBI.MembershipService/Features/*/*Controller.cs` | Contoh: `PointController.cs`, `ESBController.cs`, `GameController.cs`, `TierController.cs`, `InternalController.cs`, `HealthzController.cs` |
| Service / Business | `FBI.MembershipService/Business/*Manager.cs` | Dinamai `*Manager` (`PointManager`, `TierMembershipManager`, `ESBManager`, `GameManager`, `InternalManager`, `ExpirePointManager`, `AggregatePointManager`, `AggregatePointInitiateDataManager`), interface didefinisikan di file yang sama |
| Repository / data access | `FBI.MembershipService/Repository/*Dao.cs` & `Repository/Interfaces/I*Dao.cs` | Dinamai `*Dao` (`PointDao`, `MemberDao`, `GameDao`, `TierMembershipConfigDao`, `TierTransactionHistoryDao`, `GeneralConfigDao`, `StoreBoundedContextDao`, `EsbTransactionLogDao`, `ActivityLogDao`) |
| Entity / Model | `FBI.MembershipService/Entities/*.cs` | `DatabaseContext.cs` + 14 entity (`Member`, `MemberInformation`, `pointBalance`, `pointHistory`, `PointHistoryArchive`, `TierMembershipConfig`, `TierTransactionHistory`, `MemberGameToken`, `GameCounter`, `EsbTransactionLog`, `ActivityLog`, `StoreBoundedContext`, `generalConfig`, `PointAggregateMismatchLogs`) |
| DTO / Request / Response / Messages | `FBI.MembershipService/Features/**/Dto/*.cs`, `Requests/*.cs`, `Responses/*.cs`, `FBI.MembershipService/Messages/*.cs` | Disusun per feature di dalam `Features/<Domain>/`; job/event payload juga ada di `Messages/` dan `Libraries/` |
| Helper / Util | `FBI.MembershipService/Utils/**`, `FBI.MembershipService/Libraries/**` | `RedisCache.cs`, `DepedencyInjectionUtilities.cs`, `POSLegacyUtilities.cs`, `AesEncryption.cs`, `ActivityAddPointLogFilter.cs`, serta wrapper `Libraries/FBICustomer`, `Libraries/FBINotifications`, `Libraries/FBIStore` |
| Migrations / script SQL | `FBI.MembershipService/Migrations/*.cs` | Menggunakan EF Core Migrations (`20240926025403_InitiateAllTable.cs` s/d `20251111041705_AddTablePointHistoryArchive.cs`); beberapa migration lama tahun 2023 di-exclude di `.csproj:19-25` |

## 3. Konvensi kode
- Penamaan dan struktur:
  - Business class menggunakan suffix `Manager` (`IPointManager` / `PointManager`) di folder `Business/`.
  - Data access menggunakan suffix `Dao` (`IPointDao` / `PointDao`) di folder `Repository/`.
  - Sebagian method async memakai suffix `Async` (`GetPointPaginationAsync`, `AddPointAsync`), sebagian method DAO/Manager lama belum konsisten (`getPointInfoPaged`, `PostTransaction`). Ikuti gaya class yang sedang disentuh.
  - Nama class dan properti Entity sebagian snake_case / camelCase (`pointBalance`, `pointHistory`, `generalConfig`, `member_id`, `created_at`) mengikuti kolom tabel PostgreSQL (`FBI.MembershipService/Entities/Member.cs`).
- Registrasi DI (file dan lifetime lazim):
  - Registrasi utama dilakukan langsung di `FBI.MembershipService/Program.cs:49-87` dan helper `FBI.MembershipService/Utils/DepedencyInjectionUtilities.cs` + `FBI.MembershipService/DependencyInjection.cs`.
  - **Penting**: Banyak DAO didaftarkan sebagai `Singleton` (`IPointDao`, `IMemberDao`, `IGeneralConfigDao`, `ITierMembershipConfigDao`, `ITierTransactionHistoryDao`, `IEsbTransactionLogDao`) karena menggunakan `IPgsqlHelper` (singleton dari `KLGLib`), sedangkan DAO yang menginjeksi `DatabaseContext` (`IGameDao`, `IStoreBoundedContext`, `IActivityLogDao`) didaftarkan `Scoped` (`Program.cs:65-74`). Business Manager (`IPointManager`, `ITierMembershipManager`, `IESBManager`, `IGameManager`, `IInternalManager`) didaftarkan `Scoped`, sedangkan job manager (`ExpirePointManager`, `AggregatePointManager`) `Transient` (`Program.cs:55-62`).
- Mapping / validasi / mediator:
  - Mapping dilakukan manual (konstruktor DTO / object initializer), tidak menggunakan AutoMapper/Mapster.
  - Validasi menggunakan `FluentValidation.AspNetCore` (`DependencyInjection.cs:10-16`, `TransactionRequestValidator`) dan DataAnnotations.
  - Tidak menggunakan MediatR/Wolverine; Controller langsung memanggil `I*Manager`.
- Format response API dan error handling:
  - Endpoint umumnya mengembalikan `Ok(result)` dengan wrapper `LoyaltyResponse` (`Features/Point/Dto/LoyaltyResponse.cs`) atau `ESBApiBaseResponse` (`Features/ESB/Responses/ESBApiBaseResponse.cs`).
  - Validasi `ModelState` kustom di `Program.cs:185-201` mengembalikan HTTP 200 `OkObjectResult(new LoyaltyResponse(new Header("invalid payload", message), false))`.
  - Middleware exception khusus ESB: `IntegrationExceptionMiddleware` (`Program.cs:310`, `Features/ESB/Exception/IntegrationException.cs`).
  - Autentikasi memakai `[Authorize]` dari `FNBLibrary.AuthAttribute`, `[MidClientKey]` untuk ESB (`Utils/CustomHeaderAttribute/MidClientKeyAttribute.cs`), atau validasi token Cerberus (`Features/Ceberus/CeberusBaseService.cs`).
- Logging:
  - Menggunakan OpenTelemetry logging & tracing dari `FNBLibrary` (`builder.AddAppLogging` & `builder.AddAppOpenTelemetryLogging` di `Program.cs:42-47, 228-236`), `RequestResponseLogging<JWTModel>` middleware (`Program.cs:303`), `Serilog`, serta `IMyLog` (`KLGLib.common.log.MyLog` via RabbitMQ di `DepedencyInjectionUtilities.cs:47-53`).
- Fitur C# yang **boleh** dipakai:
  - Fitur hingga **C# 10** (.NET 6): file-scoped namespace, global usings, record, pattern matching C# 10, null-coalescing assignment (`??=`).
- Fitur C# yang **tidak boleh** dipakai:
  - Fitur **C# 11 / 12+** karena proyek menargetkan `net6.0`: jangan gunakan `required` modifier pada properti, raw string literals (`"""`), collection expressions (`[1, 2, 3]`), atau primary constructors pada class/struct biasa.

## 4. Data
- ORM dan versi:
  - Hybrid: **EF Core 6.0.21** (`Npgsql.EntityFrameworkCore.PostgreSQL` `6.0.8`, `EFCore.BulkExtensions` `6.8.1`) **dan** raw SQL helper **`IPgsqlHelper` / `PgsqlHelper`** dari `KLGLib` + `PostgreSQLCopyHelper` (`FBI.MembershipService/FBI.MembershipService.csproj:30-40`, `Repository/PointDao.cs:13-20`, `Repository/GameDao.cs:26-36`).
- DbContext (nama, lokasi) dan provider:
  - `DatabaseContext` di `FBI.MembershipService/Entities/DatabaseContext.cs`, PostgreSQL (`UseNpgsql`), dengan `AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true)` (`Program.cs:168-172`).
- Schema dan konvensi nama tabel/kolom:
  - Schema default `public` (kecuali Hangfire memakai schema `hangfire_membership` di `Config/AppConfig.cs:64`).
  - Nama tabel dan kolom menggunakan `snake_case` yang dipetakan lewat atribut `[Table("...")]` dan `[Column(name: "...")]` (contoh: `member`, `member_information`, `point_balance`, `point_history`, `point_history_archive`, `tier_membership_config`, `tier_transaction_history`, `member_game_token`, `game_counter`, `esb_transaction_logs`, `activity_logs`, `store_bounded_context`, `general_config`, `point_aggregate_mismatch_logs`).
  - Composite primary key dikonfigurasi di `DatabaseContext.OnModelCreating` untuk `pointHistory` dan `PointHistoryArchive` (`{ member_id, receive_no, card_id }`, `Entities/DatabaseContext.cs:11-15`).
- Migration:
  - **Ada** di `FBI.MembershipService/Migrations/`. Catatan penting: 7 file migration lama tahun 2023 di-exclude lewat `<Compile Remove="Migrations\2023..." />` di `FBI.MembershipService.csproj:19-25` dan digantikan oleh `20240926025403_InitiateAllTable.cs`.
- Base entity / kolom audit:
  - Tidak ada class base entity bersama; kolom audit didefinisikan per entity (`created_at`, `created_by`, `updated_at`, `updated_by`, dan sebagian `deleted_at`, `deleted_by`, atau `created_on` / `modified_on` pada `pointHistory`).

## 5. Integrasi dan proses
| Jenis | Detail | Bukti |
|---|---|---|
| Kafka (WolverineFx) | Tidak ditemukan | `FBI.MembershipService/FBI.MembershipService.csproj` |
| RabbitMQ (EventHelper) | Menggunakan `EventHelper` / `IEventHelper` dari `KLGLib`:<br>- **Subscribe**: `store_informant` via `StoreInformantEvent` (`Program.cs:271-272`, `Features/Store/MessageHandler/StoreInformantEvent.cs:19-41`)<br>- **Publish (broadcastEvent)**: `member_first_add_point` & `order_adjustment_point` (`Business/PointManager.cs:423, 652`), `member_segment_update_by_memberid` (`Libraries/FBICustomer/MemberSegmentEvent.cs:27`)<br>- **Publish (sendMessage)**: queue `notification:pusher` (`Libraries/FBINotifications/Notification.cs:36`) | `Utils/DepedencyInjectionUtilities.cs:36-58`, `Config/AppConstants.cs:25-29, 103-112` |
| Hangfire | Menggunakan Hangfire (`builder.AddAppHangfire` dari `FNBLibrary`, schema `hangfire_membership`) dengan 4 recurring job di `HangfireJobScheduler.CronJobs`:<br>1. `[Membership Service] - RetainOrDowngradeTierMembershipEvent` (`Cron.Monthly(1, 0)`)<br>2. `[Membership Service] - ExpirePointManagerJob` (`1 0 * * *` WIB)<br>3. `[Membership Service] - AggregatePointInitiateDataManager - Initiate Data` (`Cron.Never()`)<br>4. `[Membership Service] - AggregatePointManager - Aggregate Last 1 Year Data` (`Cron.Never()`) | `Messages/HangfireJobScheduler.cs:8-22`, `Utils/DepedencyInjectionUtilities.cs:25-27` |
| Outbound (Refit/HttpClient/SDK) | Tidak memakai Refit; menggunakan `HttpClient` di `StoreClientFactory.ListAsync()` (`GET {StoreUrl}store/list` dengan header `X-API-KEY: StoreApiKey`) dan `IHttpHelper` dari `KLGLib` | `Libraries/FBIStore/StoreClientFactory.cs:24-45`, `Program.cs:51, 90` |
| Config (appsettings/AppConfig/env) | Di non-UnitTest, `AppConfig` dimuat dari config server lewat `ConfigHelper.loadConfigFromServerByEnv<AppConfig>("ACCESS_TOKEN")` menggunakan variabel `.env` `ACCESS_TOKEN` (`Utils/DepedencyInjectionUtilities.cs:22`, `.env.example`). Di UnitTest, dimuat dari `appsettings.UNITTEST.json` (`DepedencyInjectionUtilities.cs:14-18`). Konfigurasi bisnis runtime disimpan di tabel `general_config` dan di-cache di Redis (`Repository/GeneralConfigDao.cs`). | `Config/AppConfig.cs`, `Utils/DepedencyInjectionUtilities.cs:11-34` |

## 6. Testing
- Project test (path): `FBI.MembershipService.Test/FBI.MembershipService.Test.csproj`
- Framework / mock library / assertion:
  - **xUnit** `2.4.2` + `Microsoft.AspNetCore.Mvc.Testing` `6.0.36`
  - **Moq** `4.20.2`
  - **Shouldly** `4.3.0` (`ShouldNotBeNull`, `ShouldBe`)
  - **Testcontainers** `4.6.0` (`Testcontainers.PostgreSql` `postgres:15`, `Testcontainers.Redis` `redis:7-alpine`)
- Strategi database di test:
  - Menggunakan **database PostgreSQL nyata** (`membership_test`) dan **Redis nyata** via **Testcontainers** (`UNIT-TEST-CONTAINER`).
  - Dikendalikan oleh konstanta `FBI.MembershipService.Test/Utils/Constants.cs:23`:
    - **Wajib**: Selalu gunakan `builderEnv = "UNIT-TEST-CONTAINER"` (otomatis menyalakan container Docker `postgres:15` dan `redis:7-alpine` via `Testcontainers` di `CustomWebApplicationFactory.cs:142-197`, lalu menjalankan `EnsureDeleted()` + `EnsureCreated()` di `CustomWebApplicationFactory.cs:131-138`). Jangan mengubah kode existing atau mengganti ke `UNIT-TEST-LOCAL`.
  - External dependency (`IStoreClientFactory`, `INotification`, `IEventHelper`, `IMyLog`, `IMemberSegmentEvent`, `HttpClient`) di-mock di `CustomWebApplicationFactory.cs:49-59, 105-122` & `BaseControllerTests.cs:105-116`, sedangkan Repository/DAO dan Database (`DatabaseContext` & `IPgsqlHelper`) memakai DB test nyata.
- Pola seeder dan cleanup yang ada:
  - `BaseControllerTests` memanggil `DatabaseSetup.InitSeedData(_db).Wait()` di constructor untuk clear & seed ulang `general_config`, `tier_membership_config`, dan `store_bounded_context` (`BaseControllerTests.cs:101`, `Utils/DatabaseSetup.cs:9-243`).
  - Seeder spesifik skenario ada di `FBI.MembershipService.Test/Seeder/*Seeder.cs` (`PointControllerSeeder`, `TierAdjustmentSeeder`, `MembershipSeeder`, `GamificationSeeder`, `ExpirePointManagerSeeder`, `AggregatePointSeeder`, `RetainOrDowngradeTierSeeder`, `StoreInformantSeeder`).
  - Banyak test class memakai `[TestCaseOrderer("FBI.MembershipService.Test.Utils.AlphabeticalOrderer", "FBI.MembershipService.Test")]` dengan test pertama `A0_SeedData()` diikuti `A1_...`, `A2_...`.
- Konvensi nama test class:
  - REST API: `FBI.MembershipService.Test/TestCase/RestApi/<Domain>ControllerTestCase.cs` (mewarisi `BaseControllerTests`).
  - Job / Message Handler: `FBI.MembershipService.Test/TestCase/MessagesHandler/<NamaJob>TestCase.cs`.
  - Business: `FBI.MembershipService.Test/TestCase/Business/<Domain>Test.cs`.
- Perintah test terfilter:
  ```bash
  dotnet test FBI.MembershipService.Test/FBI.MembershipService.Test.csproj --filter "FullyQualifiedName~TierControllerTestCase"
  ```
- Contoh pola test (maks 40 baris) (`FBI.MembershipService.Test/TestCase/RestApi/TierControllerTestCase.cs:49-93`):
  ```csharp
  [Fact]
  public async Task A0_SeedData()
  {
      new TierAdjustmentSeeder(_db).SeedData();
  }

  [Fact]
  public async Task A1_AdjustmentSilverToGold_ShouldUpgradeTierAndUpdateMemberData()
  {
      var request = new AdjustmentTierRequest()
      {
          Approver = "approver",
          MemberId = "FM-ADJUNITTEST-1",
          NewTier = "2",
          PreviousTier = "1",
          Type = "UPGRADE"
      };

      var result = await TierController().ProcessAdjustmentTier(request) as ObjectResult;

      result.ShouldNotBeNull();
      result.StatusCode.ShouldBe(StatusCodes.Status200OK);

      var dataFM1 = await GetDataForAssert("FM-ADJUNITTEST-1");
      var newTierData = GetDataTierConfig((int)AppConstants.TierIdEnum.Gold);

      dataFM1.Item1.ShouldNotBeNull();
      dataFM1.Item1.current_tier_id.ShouldBe((int)AppConstants.TierIdEnum.Gold);
      dataFM1.Item1.tier_expired_date.ShouldBe(Utilities.SetExpiredTierMembership((int)AppConstants.TierIdEnum.Gold));
      dataFM1.Item2.ShouldNotBeNull();
      dataFM1.Item2.next_tier_id.ShouldBe((int)AppConstants.TierIdEnum.Platinum);
      dataFM1.Item2.previous_tier_id.ShouldBe((int)AppConstants.TierIdEnum.Gold);
  }
  ```

## 7. Git dan CI
- Branch utama: `master` (`origin/HEAD -> origin/master`). Branch environment lain: `staging`, `development`.
- Pola nama branch yang terlihat (referensi saja; nama task selalu dari user): `feat/<deskripsi-atau-tiket>`, `fix/<deskripsi>`, `chore/<deskripsi>`, `patch/<deskripsi>`.
- CI / PR template repo:
  - PR Template: `.github/PULL_REQUEST_TEMPLATE.md`
  - Workflows:
    - `.github/workflows/pr-coverage.yaml` (menjalankan `KLG-tech/dotnet-coverage-runner` pada PR ke `master` dan `staging` dengan threshold `0.1` pada `FBI.MembershipService.Test.csproj`)
    - `.github/workflows/pipeline.api-membership-net.yaml`
    - `.github/workflows/openshift-api.membership-net.yaml`

## 8. Docmost
- Service Tech Doc page ID: `01a0cca6-be74-7923-b6aa-b66849c96aa9` (slug: `g4jacQb6Yd`, URL: `https://strand.sw.klgsys.com/s/PFBISUPERAPPS/p/membership-service-g4jacQb6Yd`)
- Space ID: `01a0e51e-4a4d-7c19-a64c-a29944c605d0` (`PFBISUPERAPPS`)
- Child Pages:
  - `API Contract`: `01a0cca8-575f-7e42-9859-cf54c7e661d0` (`fDlPYBeF59`)
  - `Business Logic`: `01a0ccb4-aadc-71db-b4cb-f4e8dbf8eed2` (`b1JFJzd1m5`)
  - `RabbitMQ/Queue`: `01a0ccb4-c3af-7e5a-8778-237a168b6313` (`Hs1OHO2pX6`)
  - `Background Process`: `01a0ccb5-0b0f-7862-90f7-8933f084009d` (`lyT9RkgHDF`)
  - `Data Model`: `01a0ccb5-6498-7cd9-b584-5786beffa9c6` (`ZdpwwZEnac`)
  - `Integration`: `01a0ccb5-7a22-739e-a75a-b4c7ec854df8` (`uXUGQYkZCm`)
  - `Config`: `01a0ccb5-9f5f-7421-9739-90674c70b778` (`c1ODPrQMTs`)
- Komponen yang relevan: `API Contract`, `Business Logic`, `RabbitMQ/Queue`, `Background Process`, `Data Model`, `Integration`, `Config` (tidak ada `Kafka/Queue` dan tidak ada `Frontend/UI`).

## 9. Guardrail
1. **Jangan menyentuh / mengubah kode existing yang tidak terdampak langsung oleh task** (instruksi eksplisit user). Biarkan kode existing dan konfigurasi test (`UNIT-TEST-CONTAINER`) apa adanya.
2. **Eksekusi Unit Test selalu menggunakan `UNIT-TEST-CONTAINER`** (`FBI.MembershipService.Test/Utils/Constants.cs:23`). Jangan mengubah konstanta `builderEnv` ke `UNIT-TEST-LOCAL`.
3. **Jangan gunakan fitur C# 11+** (seperti `required` property, raw string literal `"""`, primary constructor pada class, collection expression `[...]`) karena kedua `.csproj` menargetkan `net6.0` (C# 10).
4. **Jangan menginjeksi `DatabaseContext` (Scoped) ke dalam DAO yang terdaftar sebagai `Singleton`** di `Program.cs:65-71` (`PointDao`, `MemberDao`, `GeneralConfigDao`, `TierMembershipConfigDao`, `TierTransactionHistoryDao`, `EsbTransactionLogDao`). DAO singleton wajib memakai `IPgsqlHelper`; bila butuh `DatabaseContext`, pastikan lifetime DAO adalah `Scoped` (seperti `GameDao` dan `ActivityLogDao`).
5. **Sinkronkan perubahan skema antara EF Core Entity (`DatabaseContext`) dan query raw SQL (`IPgsqlHelper` / `PostgreSQLCopyHelper`)**: karena test menggunakan `appDbContext.Database.EnsureCreated()` (`CustomWebApplicationFactory.cs:137`) sementara banyak DAO menjalankan query SQL mentah (`PointDao.cs`, `MemberDao.cs`, `GameDao.cs`), ketidaksinkronan nama tabel/kolom di atribut Entity akan mematahkan query `IPgsqlHelper` saat test maupun runtime.
6. **Jangan menghapus `<Compile Remove="Migrations\2023..." />` di `FBI.MembershipService.csproj:19-25`**: file migration tahun 2023 tersebut sengaja di-exclude karena sudah dikonsolidasikan ke `20240926025403_InitiateAllTable.cs`.
7. **Jangan mengubah urutan alfabetis method test (`A0_SeedData`, `A1_...`, `A2_...`)** pada test class yang memakai `[TestCaseOrderer("FBI.MembershipService.Test.Utils.AlphabeticalOrderer", ...)]` karena test berikutnya bergantung pada state DB dari `A0_SeedData` atau step sebelumnya.
8. **Jangan men-mock `DatabaseContext`, `IPgsqlHelper`, atau DAO/Repository secara default di integration/controller test**: meskipun `CustomWebApplicationFactory.cs:54-57` memiliki field `_generalConfigRepositoryMock` dsb., field tersebut **tidak** diregistrasikan ke DI container di `ConfigureTestServices`; test menggunakan database PostgreSQL nyata (`membership_test`).
9. **Perhatikan `CustomWebApplicationFactory.InitConfiguration` baris 271-277**: `services.RemoveAll<IEventHelper>()` dipanggil ulang di dalam `InitConfiguration` dan menimpa mock `IEventHelper` dari `ConfigureTestServices` dengan instance `EventHelper` nyata kecuali di-handle hati-hati; jangan mengandalkan `_factory._eventHelperMock.Verify(...)` tanpa memeriksa registrasi DI di `CustomWebApplicationFactory.cs`.
10. **Invalidate Redis cache terkait saat mengubah data referensi/balance/game token**: banyak alur membaca/menulis key Redis (`RedisKeyConstants` di `AppConstants.cs:232-246`, serta key pattern di `BaseControllerTests.cs:44-55`).

## 10. Pertanyaan terbuka
- Semua pertanyaan terbuka awal telah dikonfirmasi oleh user pada 2026-10-24 (`microservice`, `net6.0`, selalu `UNIT-TEST-CONTAINER` tanpa menyentuh kode existing, dan Docmost page ID `01a0cca6-be74-7923-b6aa-b66849c96aa9`).
