---
name: xunit-testing
description: Authoring and executing xUnit test suites for this office - mock only external/third-party clients, never mock Repositories or Databases, enforce per-test seeder and cleanup, assert on impacted database fields and API responses. Use whenever writing, adjusting, or executing C# unit tests.
---

# xUnit Testing

## Pattern Hierarchy
1. **User-provided test examples** for this task (in `brief.md` or task message). Strictly mirror their structure, naming, and helper conventions.
2. Representative test in the `Testing` section of the project profile (`.agents/reference/<project>/SKILLS.md`).
3. The baseline template below, used only when neither of the above two sources exists.

## Core Rules
| Rule | Specification |
|---|---|
| Mock | Only external/3rd-party clients (payment gateways, SAP, Refit APIs, S3, email, outbound message producers). |
| Do NOT mock | **Repository** and **Database**. Use real implementations backed by a local/test database. InMemory/SQLite only if that is the established project convention. |
| Seeder | Each test seeds its own isolated test data. Use unique identifiers (`Guid.NewGuid()`) to eliminate test collisions. |
| Cleanup | Each test cleans up its seeded records (based on tracked IDs), including dependent records generated during execution. Never `TRUNCATE` shared tables. |
| Table Assertions | Query the database using a **new** DbContext instance with `AsNoTracking()` to avoid reading tracked entities. Assert modified fields (status, amount, `updated_by`, `updated_at`, foreign keys, etc.) and assert fields that **must remain unchanged**. |
| Response Assertions | Assert all significant response/return value fields, including HTTP status codes or `Result<T>` wrapper states. |
| Mock Verifications | Verify calls to external clients (`Times.Once`, `Times.Never` for scenarios where external calls are forbidden, verifying key arguments). |
| Scenarios | Per function under test: happy path, validation/negative cases, edge cases (empty data, duplicates, final state guards, concurrency where applicable). |
| Naming | `Method_Condition_ExpectedResult`; test class `<ClassUnderTest>Tests` (or `<Class><Method>Tests`). |
| Database | Connection string must target a dedicated test/local database. If in doubt, do not execute; ask user first. |

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
*Note: This skeleton is an example structure. Replace fictional class/helper names with the real ones in your project.*

## Test Execution (Impacted Tests Only)
```bash
# 1. Map changes -> tests: OrderService -> OrderServiceTests
grep -rl "OrderService" --include=*Tests.cs <test-folder>

# 2. Verify filter list is non-empty
dotnet test <Project.Tests.csproj> --list-tests --filter "FullyQualifiedName~OrderServiceCancelTests"

# 3. Execute filtered tests
dotnet test <Project.Tests.csproj> --filter "FullyQualifiedName~OrderServiceCancelTests"
```
- Never run `dotnet test` without `--filter` unless explicitly requested by the user.
- If no related tests exist: do not fall back to running all tests. Document the gap in `test-report.md`.
- If a test fails due to code bugs: fix the implementation (via `developer`); do not weaken assertions.

## test-report.md
Document: executed filter, passed/failed counts, scenario list, asserted tables and fields, mocked clients, and uncovered edge cases.
