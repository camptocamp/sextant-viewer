# Contributing to Sextant Viewer

## Workflow

Direct pushes to `main` are not allowed: every change goes through a pull request.

See the [README](README.md) to set up the project and run it locally.

## Code review

A manual review is mandatory. A pull request needs at least one approval from a maintainer
other than its author before it can be merged.

The reviewer checks that:

- the change is scoped and understandable, and the pull request description explains what it
  does and why
- it comes with tests, or with a description of how it was verified manually
- no secret, credential or internal URL is added to the code
- any new or updated dependency is justified
- the user-facing documentation is updated when needed

## Automated checks

The following checks run on every pull request and must pass before merging
([`qa.yml`](.github/workflows/qa.yml)):

- **Formatting, types and tests**: Prettier, `vue-tsc` and ESLint
- **E2E tests**: Playwright

Run them locally before pushing:

```bash
npm run format
npm run lint
npm run type-check
npm run test:e2e
```

## Security scans

Two security scans run once changes land on `main`:

- **SonarQube**: static analysis of the source code
  ([`sonar.yml`](.github/workflows/sonar.yml))
- **Snyk**: vulnerability scan and continuous monitoring of the npm dependencies
  ([`snyk.yml`](.github/workflows/snyk.yml))

Only maintainers can access the detailed reports. They review the security issues raised
there before each release.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through
[GitHub security advisories](https://github.com/camptocamp/sextant-viewer/security/advisories/new).
