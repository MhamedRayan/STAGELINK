# Contributing to STAGELINK

Thanks for helping improve STAGELINK. This guide covers the expected workflow.

## Before you start

- Check existing issues and pull requests to avoid duplicate work.
- For larger changes, open an issue describing the problem and the proposed
  approach before writing code.
- Read the relevant service README or contract under `contracts/`.

## Branching

Use short-lived branches based on the latest `main` (or `master` while the
repository is being bootstrapped):

```text
feat/offers-search
fix/application-status-transition
docs/update-setup
chore/upgrade-django
```

## Commit messages

Use Conventional Commits:

```text
<type>(<scope>): <short summary>
```

Examples:

```text
feat(offers): add pagination to offer search
fix(applications): reject duplicate applications
docs(architecture): describe notification flow
```

Allowed types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`,
`build`, `perf`.

## Making a change

1. Create a branch.
2. If the HTTP interface changes, update the matching file in `contracts/`
   first.
3. Implement the change in the owning service.
4. Add or update tests.
5. Run the service checks locally:

   ```bash
   cd services/<service>
   python manage.py check
   python manage.py test
   ```

6. Update documentation when behaviour, setup or workflows change.
7. Open a pull request using the repository template.

## Pull request expectations

- Keep the change focused; split unrelated work into separate pull requests.
- Describe the problem, the solution and how it was verified.
- Link the related issue.
- Ensure CI is green before requesting review.
- Do not commit secrets, local databases or generated artefacts.
- A pull request that changes a contract must call out the compatibility
  impact in its description.

## Code style

- Python follows PEP 8 with 4-space indentation and a 100-character soft limit.
- Keep views thin; put business rules in services or domain modules.
- Prefer explicit names over abbreviations.
- Add docstrings for non-obvious business rules.
- YAML, JSON and Markdown use 2-space indentation where applicable.

## Tests

- Unit tests live inside each service under `tests/`.
- Cross-service tests live in `tests/integration/`.
- User-journey tests live in `tests/end_to_end/`.
- Reusable payloads and seed data live in `tests/fixtures/`.
- Tests must not depend on execution order or shared mutable state.

## Security

Report security issues privately to the maintainers rather than opening a
public issue. Never commit real credentials. Use `.env.example` to document
required environment variables.
