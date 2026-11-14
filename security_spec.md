# Security Specification — Central RH Firestore Rules

## 1. Data Invariants
1. **Store Ownership & Delegated Managers**: Every `Store` is owned by `ownerId == request.auth.uid` (`ownerEmail == userEmail()`) and maintains a bounded `managerEmails` list (max 20) synced from active employees marked as `isManager`. Only verified users (`request.auth.token.email_verified == true`) may read or write.
2. **Referential Integrity (Master Gate)**: Every `Employee`, `OvertimeEntry`, `TimeOffEntry`, and `Reminder` belongs to an existing `/stores/{storeId}` whose `ownerId` matches the document's `ownerId`. `OvertimeEntry` and `TimeOffEntry` additionally require that `/employees/{employeeId}` exists and belongs to the same `storeId`.
3. **Self-Service Scope**: Employees signing in with a matching `email` may list/get their own `Employee`, `OvertimeEntry`, and `TimeOffEntry` records, and may create/delete only their own `OvertimeEntry` records (`employeeEmail == userEmail()`, `createdByEmail == userEmail()`). `Reminder` documents are scoped strictly to store owners and delegated managers.
4. **Immutable Audit Fields**: `ownerId`, `storeId`, `createdAt`, and relational `employeeId` cannot be modified after creation.
5. **Temporal Integrity**: `createdAt` must equal `request.time` on creation, and `updatedAt` must equal `request.time` on creation and every update.
6. **Strict Schema & Bounds**: All strings enforce UTF-8 `.size()` limits, dates match `YYYY-MM-DD`, reminder times match `HH:MM` or empty string, `endDate >= startDate`, schedule maps validate all 7 weekdays, `photoDataUrl` is capped at 200,000 bytes, and `minutes` is an integer in `1..1440` (`deductedMinutes` in `0..14400`).

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `request.auth == null` attempting to list or create `/stores/s1` or `/employees/emp1`.
2. **Unverified Email Spoof**: `request.auth != null` with `email_verified: false` attempting any read or write.
3. **Identity Spoofing on Create**: User A sets `ownerId: "user-B-uid"` when creating `/stores/s1` or `/employees/emp1`.
4. **Shadow Field Injection**: Create or update payload includes an undeclared ghost field (`isAdmin: true`).
5. **Cross-Tenant List Scraping**: User B queries `/employees` or `/timeOffs` without matching `ownerId`, `managerEmails`, or `employeeEmail`.
6. **ID Poisoning**: Document ID exceeds 128 chars or contains invalid characters (`emp$1/../../etc`).
7. **Orphaned Employee / Entry**: Creating `/employees/emp1` referencing a non-existent `storeId`, or `/timeOffs/to1` referencing a non-existent `employeeId`.
8. **Cross-Store Injection**: Manager of Store A creates an `/overtimeEntries/ot1` or `/timeOffs/to1` for an employee belonging to Store B.
9. **Self-Service Escalation**: Regular employee attempts to update `/employees/emp1` (`isManager: true`) or create `/overtimeEntries/ot1` for a colleague (`employeeEmail` != `userEmail()`).
10. **Client Timestamp Forgery**: Create or update sending a backdated `createdAt` or `updatedAt` != `request.time`.
11. **Value/Resource Poisoning**: Update `name` with a >100-byte string, `minutes: -50`, or `endDate < startDate`.
12. **Partial Schedule Structure Bypass**: Update `schedule` missing one of the 7 weekday keys (`sun`) or invalid time string length.
