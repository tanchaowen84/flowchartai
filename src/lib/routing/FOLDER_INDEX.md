# Routing

Preserve request identity and route known public paths through locale handling.

- `known-unlocalized-paths.ts`: existing public/owned route allowlist and published editorial paths.
- `request-url.ts`: read the native Request URL before NextRequest normalization, without altering the body.
- `request-url.test.ts`: public-origin callback/state integrity and untouched body.
- `../../middleware.ts`: restore the original search before next-intl; Next config also skips middleware URL normalization.
- `../../middleware.test.ts`: actual NextRequest + next-intl preservation regression.
