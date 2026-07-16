# Court project instructions

## Versioning Policy

- Every code change that affects app behavior, UI, data handling, scheduling, ratings, exports, backups, or tests must update the app version.
- Bug fixes increment the patch version.
- New backward-compatible features increment the minor version.
- Breaking data/schema or incompatible changes increment the major version.
- Documentation-only changes do not require an app version bump unless they alter in-app help text.
- `APP_INFO` in `index.html` is the single source of truth.
- Update both `APP_INFO.version` and `APP_INFO.build`.
- Build format is `YYYYMMDD.N`, using the current local date and a sequence number for multiple builds on the same day.
- The final implementation summary must state the old version and new version.
- Do not commit automatically.

## Court project principles

- Preserve historical rating integrity.
- Keep mobile usability strong.
- Avoid mysterious rating changes.
- Add tests with behavior changes.
- Prefer small, reviewable changes.
- Keep the single-file app unless intentionally split.
- Do not add unnecessary dependencies.
