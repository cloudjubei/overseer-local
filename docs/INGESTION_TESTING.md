Ingestion service dev testing

- Use the one-off script to sync documents into the database.

Examples

- THEFACTORY_DB_URL=postgres://user:pass@host:5432/db npm run sync:docs
- node scripts/sync-docs.js --db "postgres://..." --project my-project-id
- node scripts/sync-docs.js --root /abs/path/to/repo

Notes

- The ingestion scans the repository root by default or a project-provided path.
- Code files are classified using src/db/fileTyping.js and saved as type project_code. Others are project_file.
- Documents are upserted by deterministic id: <projectId>:<relativePath>.
