# TAN-597 email authentication

SPEC TAN-597 / LOCKED (existing Issue contract, activated by the user's Todo selection).
Risk: HIGH (authentication, account ownership, registration credits).

## Goal

Let new, existing and unverified users continue with Google or verified email, then return to their draft or chosen offer.

## Constraints

Reuse Better Auth 1.1.19, Resend, existing account and wallet hooks. Verify email ownership before a new OTP account/session. No repeated account/trial grant. Keep password sign-in for existing users. No merge, deployment, payment, production data maintenance or unapproved test recipient. Keep raw identity out of third-party analytics. TAN-599 owns broader instrumentation; this change documents shared definitions only.

## Scope

Use the same email-code form on login/register; postpone name/password collection. Retain full safe same-origin callback and typed email when switching entry/method/provider. Carry a finite sellable offer to pricing; present the selected offer for explicit checkout, without creating an order automatically. Reuse canvas draft/attachment storage. Show send, invalid/expired code, resend cooldown, rate limit and network failures accurately.

The installed OTP plugin creates a verified user only after correct OTP, marks an existing unverified user verified, and runs the new-user hook only for a new account. It selects the newest OTP but leaves older rows, allowing an older code to become usable after the newest is consumed. Its rate limiter is process-local by default. Add a narrow persistent per-email guard on the existing HTTP OTP endpoints, serializing send/verify across instances, invalidating old codes, bounding resend and failed verification, with no schema change. Keep library authentication/session issuance.

## Acceptance

1. Login and register show Google and email code, explain new/existing account semantics, retain password sign-in.
2. No account/session/grant from sending or bad/expired code. Correct code creates or reuses one account. Repeated/concurrent verification cannot replay an older code or duplicate the grant.
3. Send rejection is an error, not success. Resend is explicit and rate-limited. Network failures unlock retry.
4. Callback path/query/hash survives method/provider/entry switches; external/protocol-relative/backslash/auth-loop callbacks fall back safely. Pricing selection includes offer and billing interval and remains explicit before checkout.
5. Tests cover real Better Auth with isolated state plus guard concurrency/failure behavior, callbacks, offer restore and UI states. Typecheck/build/scoped lint and Ego desktop/mobile checks are recorded. Independent CR follows verification.
6. Live acceptance separately requires an already-authorized mailbox, production provider/domain/DNS evidence, actual receipt, session, original account/credit readback and Google regression. Missing evidence remains unverified.

## Technical context and plan

Baseline origin/main 5064ce06cdfa26ee4784baef11779b71dd6d7e4f; production alias verified by Vercel deployment dpl_D8JuwXaP2KgPWYZBftrgwFb2Rv6X. Worktree /Users/tcw/.codex/worktrees/tan-597-email-auth/flowchartai. Next.js 15.2.6, PostgreSQL/Drizzle, Better Auth 1.1.19, Resend 4.4.1. Current deployed app runs on Vercel; Cloudflare provides DNS/assets. Resident checkout has unrelated dirty work and is untouched.

Serial tasks: (1) tests for safe continuation, verified-account reuse and OTP failure/replay; (2) server OTP guard/provider receipts; (3) shared auth form and offer restore; (4) tests/typecheck/build and Ego QA; (5) independent CR, PR and acceptance evidence. Main owner implements/tests. No implementation workers. One independent Reviewer after verification; no intermediate subagent review authorization assumed.

Commands: pnpm test; pnpm typecheck; pnpm build; pnpm exec biome check <changed files>. Isolated local ports and test data; never copy production DB URL into local app.

## Current state

Assessment complete for source/UI; production send/receipt not yet verified. Resend dashboard asks for login. Vercel connector env listing returns 403; CLI fallback is being checked. Authorized test recipient not found in Issue or its existing evidence. Production verification is a separate pending step, not assumed from local credentials.

## Scoped experience contract

Existing auth card/modal and pricing cards are retained. Audience: a first-time user who cannot use Google, a returning credential user, or a user resuming a canvas draft/selected subscription. The primary auth action is email verification; name/password creation is deferred. Password login remains a secondary action for an existing account. Google and email share the same safe callback. A failed Google attempt links back with that callback, and an already-authenticated auth-page visitor goes to the same continuation.

Initial email form -> sending (deduplicated and disabled) -> six-digit code form -> verifying -> original local URL. A failed send stays on the email form; a failed verification preserves email/code and shows the error. Resend has a visible cooldown and server rejection remains visible. Editing email returns to the email form. Password mode describes password login rather than promising an email code. Typed email survives entry/provider/method switches; OTP/password are not stored. Pricing highlights the exact restored offer/interval and requires an explicit checkout click; authentication alone cannot create an order. Existing canvas draft/attachment persistence remains responsible for restoring user content.

Desktop and mobile preserve reading/action order. Labels, browser email/OTP autocomplete, numeric OTP input, disabled states and keyboard focus use existing primitives. UI screenshots and interaction evidence are owner QA, not an independent review. Full production Google identity exchange and real inbox acceptance remain separate pending checks.


## Independent review cycle 1

Round 1, snapshot 79e2de3: Reviewer reproduced CR597-001 (P1): non-JSON form requests were accepted by Better Auth after the guard failed to parse JSON, bypassing resend/guess bounds and allowing an older code to be reused. The owner added four failing regression assertions, then made OTP HTTP endpoints reject unsupported encodings with 415 and malformed JSON with 400. Actual JSON client behavior is retained. CR597-002 (P2): the expiry fixture reset all guard rows; the owner limited it to that fixture's hashed ID. No product implementation or test assertions were edited by the Reviewer. The revised version requires same-Reviewer Round 2.

Owner UI check also replaced generic HTTP 500 wording with the actionable send failure message and translated invalid/expired OTP responses. Local real inbox/production OAuth acceptance remains pending; a controlled transport is not delivery proof.

Reviewer tooling subsequently failed twice with `This content was flagged for possible cybersecurity risk` while finalizing the existing defensive review. The two confirmed findings and independent verification logs remain available, but no final independent CR PASS exists. Do not treat the interruption or owner fixes as approval, reset the cycle, or mark the Issue Done. Preserve the original Reviewer/cycle and resume only through an available authorized review path.
