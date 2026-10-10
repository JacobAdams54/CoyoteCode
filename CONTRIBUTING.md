# Contributing to Coyote Code

This project is built through small, reviewable contributions. You can begin from an existing issue, create an issue for new work, or start a branch for a small independent change.

## Before you start

- Read the README and confirm that `npm run check` and `npm test` pass locally.
- Pull the latest `main` before creating your branch.
- Do not commit API keys, `.env` files, generated credentials, or unrelated formatting changes.
- Keep one branch and one pull request focused on one contribution.

## Choose a workflow

### 1. Work from an existing issue

Use this path when the task already exists in the issue tracker.

1. Open an issue that isn't labeled `blocked` and make sure nobody else is assigned.
2. Assign yourself to the issue. If you are working as a pair, assign your partner as well.
3. Use **Create a branch** from the issue page. Name it from the issue, or use a short descriptive name such as `docs/agent-run-walkthrough` or 'feature/my-feature'.
4. Make the change, add or update tests where the behavior should be automated, and run the required checks.
5. Open a pull request targeting `main` and link the issue with `Closes #123` in the PR body.

### 2. Create a new issue, then work from it

Use this path when you have a clear improvement, bug report, documentation need, or research task that is not already tracked.

1. Search existing issues first to avoid duplicates.
2. Create an issue that explains the problem, proposed outcome, and how the work could be verified.
3. Add appropriate labels and assign yourself.
4. Create a branch from the issue page.
5. Follow the same contribution and pull-request steps as Workflow 1.

For work that changes architecture, security boundaries, or dependencies, wait for discussion before beginning implementation.

### 3. Start a branch directly

Use this path for a small, self-contained improvement that does not need issue discussion first.

1. Create a branch from the latest `main`.
2. Use a descriptive name such as `fix/help-output` or `docs/tool-registry-map`.
3. Make the change, test it where necessary, and open a pull request targeting `main`.
4. In the PR body, explain why an issue was unnecessary. If the work grows beyond the original small change, create and link an issue.

## Pull request requirements

Every pull request must have:

- A short, descriptive title that states the change, such as `Add CLI help output` or `Document the agent event flow`.
- A concise body explaining what changed, why it matters, and how it was verified.
- Tests added or updated when the change affects behavior that can be automated.
- Passing required checks, including CI and deployment checks when configured.
- At least one approval from a reviewer other than the PR author.
- No unresolved review conversations.

Use this PR body template:

```md
## What changed
-

## Why
-

## Verification
- [ ] `npm run check`
- [ ] `npm test`
- [ ] Manual check: describe it, if applicable

Closes #123
```

Keep the body brief. A reviewer should be able to understand the purpose and verification without reading every commit.

## Testing expectations

Run these checks before requesting review:

```bash
npm run check
npm test
```

Add tests when you change a tool, model translation, agent-loop behavior, validation, error handling, or another behavior that can be tested deterministically. Documentation-only changes usually need a careful manual review instead.

Do not require a live Gemini API call for automated tests. Tests should use fixtures, mocks, or scripted model responses so they run in CI without personal credentials.

## Review and merge

Reviewers check that the contribution matches its stated goal, is understandable, has appropriate tests, and stays within scope. Authors should respond to review comments and push follow-up commits as needed.

After the required review, all required checks, and all conversations are complete, the PR can be merged into `main`. The merged branch is deleted automatically.

## Asking for help

Open a draft pull request when you are blocked or unsure about an implementation. In the PR body or a comment, state what you tried, what happened, and the specific question you need answered.
