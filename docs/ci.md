# 🛠️ CI Integration

`drctl` is a plain Node.js CLI, so any runner with Node ≥18.17 can validate decision repositories, regenerate indexes, or smoke-test lifecycle commands. This guide complements [docs/test-plan.md](test-plan.md), which documents the CI used for this repo.

## Common Patterns

### GitHub Actions

```yaml
name: drctl-governance
on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm install decision-record
      - name: Governance validation
        run: |
          drctl governance validate --json > dr-governance.json
          drctl decision index --output DecisionIndex.md
      - uses: actions/upload-artifact@v4
        with:
          name: drctl-reports
          path: |
            dr-governance.json
            DecisionIndex.md
```

### GitLab CI

```yaml
drctl_validate:
  image: node:20-alpine
  variables:
    DRCTL_CONFIG: $CI_PROJECT_DIR/.drctl.yaml
  script:
    - npm install decision-record
    - drctl governance validate --json > dr-governance.json
    - drctl decision index --output DecisionIndex.md
  artifacts:
    when: always
    paths:
      - dr-governance.json
      - DecisionIndex.md
```

### Generic shell runners

```bash
npm install --no-save decision-record
export DRCTL_REPO=work
export DRCTL_CONFIG="$WORKSPACE/.drctl.yaml"
drctl governance validate --json > "$WORKSPACE/dr-governance.json"
drctl decision index --output "$WORKSPACE/DecisionIndex.md"
```

## Tips

- **Cache npm installs** when possible; the executable lives under `node_modules/.bin/drctl` after a local install.
- **Select the repository** via `--repo`, `DRCTL_REPO`, or per-job `.drctl.yaml` files so CI can target `work`, `home`, or demo repos without editing configs.
- **Surface failures** by treating any `drctl governance validate` error as a pipeline blocker; warnings can be logged but ignored depending on policy.
- **Regenerate indexes** as part of docs builds so dashboards stay current with lifecycle metadata.
- **Git-optional environments**: pass `--no-git` when your CI job runs in read-only or detached working trees. Lifecycle commands will edit files but skip git staging.
- **Combine with other tooling**: run `npx trunk check`, unit tests, or packaging commands before publishing artifacts—see `.github/workflows/ci.yml` for this repo’s reference pipeline.

## Related Docs

- [docs/project.md](project.md) — architecture & lifecycle flow
- [docs/test-plan.md](test-plan.md) — quality gates and coverage targets
- [README](../README.md#ci-integration) — high-level CI summary for readers
