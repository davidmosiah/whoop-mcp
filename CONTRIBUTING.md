# Contributing

Contributions are welcome, especially around API coverage, privacy-safe summaries, tests, docs and agent setup examples.

## Local development

```bash
npm ci
npm run typecheck
npm run build
npm run smoke
npm run test:summary
npm run test:privacy-cache
```

## Design rules

- Keep the project explicitly unofficial and unaffiliated with WHOOP.
- Never commit tokens, OAuth client secrets or personal health exports.
- Prefer read-only tools by default.
- Tools should return both text content and structured content.
- Error messages should be actionable without revealing secrets.
- Workflow summaries should be framed as performance coaching, not medical advice.

## Pull request checklist

- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run smoke` passes.
- `npm run test:summary` passes when summary logic changes.
- `npm run test:privacy-cache` passes when privacy/cache logic changes.
- README/tools docs are updated when behavior changes.
