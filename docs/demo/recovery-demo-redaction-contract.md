# WHOOP Recovery Demo Redaction Contract

This fixture-only sample shows the shape produced by
`whoop-mcp-server demo-capture --assert-sanitized`. It is not a real WHOOP
account capture.

- Source: `fixture_privacy_test`
- Ready for WHOOP API: `false`
- Privacy mode: `structured`
- Recovery band: `green`
- Sleep quality band: `strong`
- Load band: `moderate`
- Data confidence: `high`

## Commands

- `whoop_connection_status`
- `whoop_daily_summary`
- `Use my latest WHOOP recovery, sleep and strain. Tell me if today should be a push, maintain or recovery day, then give me one action that matters most tonight.`

## Sanitized Agent Response

- Today reads as a push day from the sanitized WHOOP summary.
- Recovery band is green; sleep quality is strong; load is moderate.
- Most important action: scale training load to readiness.
- This is performance coaching only, not medical advice.

## Privacy Contract

- OAuth secrets included: no
- Raw payloads included: no
- Exact recovery numbers included: no
- Exact sleep details included: no
- Local token paths included: no
- Sanitization checks passed: true

Real captures should be generated locally after OAuth setup:

```bash
whoop-mcp-server demo-capture \
  --output whoop-recovery-demo.redacted.json \
  --markdown whoop-recovery-demo.redacted.md \
  --assert-sanitized
```

Review generated files before publishing them in README images, issue comments
or agent eval fixtures.
