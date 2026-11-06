## Agent skills

### Issue tracker

Issues and specs live as Markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context layout: root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.

## Development workflow

- Run the relevant tests before considering a code change complete. For this repo, use `npm test`.
- Write commit messages in Chinese. Use the `feat:` prefix for new features and `fix:` for bug fixes, followed by a concise Chinese description.
