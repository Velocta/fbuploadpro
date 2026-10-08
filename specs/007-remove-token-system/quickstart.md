# Quickstart & Verification Guide: 007-remove-token-system

## Verification Steps

1. **Contracts Verification**:
   ```bash
   pnpm --filter=@fbuploadpro/contracts test
   ```
   Assert that `UserSchema` parses users without `tokensBalance` and rejects legacy token transaction references.

2. **Database Verification**:
   ```bash
   pnpm --filter=@fbuploadpro/database test
   ```
   Assert DDL schema files do not define `token_transactions` or `tokens_balance`. Assert `client.ts` and `edge.ts` compile without `atomicDecrementTokens`.

3. **Queue API Route Verification**:
   ```bash
   pnpm --filter=@fbuploadpro/web test tests/api/publishing-queue.test.ts
   ```
   Assert queueing media succeeds directly for active users without returning 402 Payment Required.

4. **Worker Settlement Verification**:
   ```bash
   pnpm --filter=@fbuploadpro/worker test tests/token-settlement.test.ts
   ```
   Assert edge worker dispatcher successfully settles published posts without decrementing tokens or writing to token transaction tables.

5. **Full Quality Gate**:
   ```bash
   pnpm turbo run build lint typecheck test
   ```
