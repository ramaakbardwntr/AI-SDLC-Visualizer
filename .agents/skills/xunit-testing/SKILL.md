---
name: xunit-testing
description: Authoring and executing xUnit test suites for this office - audit test cases in relevant namespaces, consolidate redundant tests, maintain 100% meaningful business flow coverage (except mocks), mock only external/third-party clients, never mock Repositories or Databases, enforce per-test seeder and cleanup, and strictly adhere to existing project test styles.
---

# xUnit Testing

## Pattern Hierarchy
1. **User-provided test examples** for this task (in `brief.md` or task message). Strictly mirror their structure, naming, and helper conventions.
2. Representative test in the `Testing` section of the project profile (`.agents/reference/<project>/SKILLS.md`).
3. The baseline template below, used only when neither of the above two sources exists.

## Core Rules
| Rule | Specification |
|---|---|
| **Namespace Audit** | Sebelum menyusun atau mengubah test, **wajib membaca seluruh test case** yang berada di bawah namespace/class terkait dengan function yang diubah. |
| **Eliminasi Redundansi** | Hapus atau gabungkan (*consolidate*) test case yang redundant, tumpang tindih (*overlapping*), atau tidak lagi relevan agar test suite tetap ramping dan cepat. |
| **100% Meaningful Coverage** | Seluruh jalur eksekusi/branch pada logic yang diubah wajib ter-cover 100% (**kecuali dependensi eksternal yang di-mock**). Test case wajib **meaningful untuk business flow**—dilarang *over-testing* (membuat banyak test untuk variasi data trivial yang tidak relevan) dan dilarang *over-engineering*. |
| **Project Code Style** | Wajib mengikuti struktur folder, konvensi penamaan (`<ClassUnderTest>Tests`), pola helper, dan style unit test yang sudah ada di repositori. Jangan memaksakan template bawaan bila repositori sudah memiliki pola sendiri. |
| Mock | Hanya external/3rd-party clients (payment gateways, SAP, Refit APIs, S3, email, outbound message producers). |
| Do NOT mock | **Repository** dan **Database**. Gunakan implementasi nyata yang terhubung ke local/test database. InMemory/SQLite hanya bila itu konvensi resmi proyek tersebut. |
| Seeder | Setiap test membuat data isolasi sendiri menggunakan ID unik (`Guid.NewGuid()`). |
| Cleanup | Setiap test membersihkan data yang di-seed (berdasarkan daftar ID yang di-track) termasuk data relasional yang tercipta. Dilarang `TRUNCATE` tabel bersama. |
| Table Assertions | Query database menggunakan instance DbContext **baru** dengan `AsNoTracking()`. Assert kolom-kolom yang terdampak (status, amount, `updated_by`, dll.) dan pastikan kolom yang **seharusnya tidak berubah** tetap terjaga nilainya. |
| Response Assertions | Assert seluruh field penting pada response/return value, termasuk HTTP status code atau state wrapper `Result<T>`. |
| Mock Verifications | Verifikasi panggilan ke external client (`Times.Once`, `Times.Never` untuk skenario kegagalan, serta periksa argumen penting). |
| Scenarios | Per function yang diuji: happy path, validation/negative cases, edge cases krusial (data kosong, idempotency/duplikasi, status guard). |
| Naming | `Method_Condition_ExpectedResult`; test class `<ClassUnderTest>Tests` (atau `<Class><Method>Tests`). |
| Database | Connection string wajib mengarah ke database test/lokal. Jika ragu, tanyakan user sebelum menjalankan test. |

## Baseline Template (Adapt mock library and factory names to project)
```csharp
public class OrderServiceCancelTests : IAsyncLifetime
{
    private readonly AppDbContext _db;                                  // Real DB (test/local instance)
    private readonly Mock<IPaymentGatewayClient> _paymentClient = new(); // Only external client is mocked
    private readonly OrderService _sut;
    private readonly List<Guid> _orderIds = new();

    public OrderServiceCancelTests()
    {
        _db = TestDbContextFactory.Create();                            // Project-specific factory
        _sut = new OrderService(new OrderRepository(_db), _paymentClient.Object); // REAL repository
    }

    public async Task InitializeAsync() => await Task.CompletedTask;     // Seed per scenario via helpers

    public async Task DisposeAsync()
    {
        await using var cleanup = TestDbContextFactory.Create();
        await cleanup.Orders.Where(o => _orderIds.Contains(o.Id)).ExecuteDeleteAsync(); // EF Core 7+; EF 6: RemoveRange
        await _db.DisposeAsync();
    }

    private async Task<Order> SeedOrderAsync(OrderStatus status, decimal amount = 150_000m)
    {
        var order = new Order { Id = Guid.NewGuid(), Status = status, Amount = amount, CreatedBy = "test", CreatedAt = DateTime.UtcNow };
        _db.Orders.Add(order);
        await _db.SaveChangesAsync();
        _orderIds.Add(order.Id);
        return order;
    }

    [Fact]
    public async Task CancelOrder_WhenOrderIsPaid_ShouldRefundAndMarkCancelled()
    {
        // Arrange
        var order = await SeedOrderAsync(OrderStatus.Paid);
        _paymentClient.Setup(c => c.RefundAsync(order.Id, order.Amount, It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new RefundResult { Success = true, RefundId = "RF-1" });

        // Act
        var response = await _sut.CancelOrderAsync(order.Id, "tester", CancellationToken.None);

        // Assert - response
        Assert.True(response.Success);
        Assert.Equal(OrderStatus.Cancelled, response.Status);

        // Assert - affected database records (fresh context, untracked)
        await using var verifyDb = TestDbContextFactory.Create();
        var saved = await verifyDb.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
        Assert.Equal(OrderStatus.Cancelled, saved.Status);
        Assert.Equal("tester", saved.UpdatedBy);
        Assert.NotNull(saved.UpdatedAt);
        Assert.Equal(order.Amount, saved.Amount);                         // Must remain unchanged

        _paymentClient.Verify(c => c.RefundAsync(order.Id, order.Amount, It.IsAny<CancellationToken>()), Times.Once);
    }
}
```
*Note: Skeleton di atas adalah contoh referensi. Sesuaikan nama class, DbContext, dan helper dengan yang ada di repositori.*

## Test Execution (Impacted Tests Only)
```bash
# 1. Map changes -> tests: OrderService -> OrderServiceTests
grep -rl "OrderService" --include=*Tests.cs <test-folder>

# 2. Verify filter list is non-empty
dotnet test <Project.Tests.csproj> --list-tests --filter "FullyQualifiedName~OrderServiceCancelTests"

# 3. Execute filtered tests
dotnet test <Project.Tests.csproj> --filter "FullyQualifiedName~OrderServiceCancelTests"
```
- Dilarang menjalankan `dotnet test` tanpa `--filter` kecuali secara eksplisit diminta oleh user.
- Jika tidak ditemukan test terkait: jangan berpindah menjalankan seluruh test suite. Catat gap tersebut di `test-report.md`.
- Jika test gagal karena bug implementasi: perbaiki kodenya; dilarang melemahkan assertion.

## test-report.md
Document: executed filter, passed/failed counts, test cases audited/consolidated/removed, scenario list, asserted tables and fields, mocked clients, and uncovered edge cases.
