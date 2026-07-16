# Court change template

## Versioning requirement

- Inspect `APP_INFO` before coding.
- Choose patch, minor, or major appropriately.
- Update both `APP_INFO.version` and `APP_INFO.build`.
- State the old and new values in the final summary.
- Run `npm run check:version`.

## Change brief

- Behavior change first:
- Affected functions:
- Tests required:

## Guardrails

- Preserve the single-file architecture.
- Do not change ratings or history unless explicitly requested.
- Do not commit automatically.
