---
name: git-workflow
description: Branching, committing, and pushing rules for this office - branch names always come from the user, existing branches are reused, new branches are created from main/master, no direct commits to protected branches, push only after explicit approval. Use when preparing branches, committing, or pushing.
---

# Git Workflow

All commands are run from the office root using `git -C workspace/<repo>`, except for `push` (see below).

## 1. Preparing the Branch (After Gate 1)
```bash
R=workspace/<repo>; B=<branch-name-from-user>
git -C $R status --short                       # must be clean; if dirty, stop and notify user
git -C $R fetch origin --prune
git -C $R ls-remote --symref origin HEAD       # determine base: main or master
git -C $R branch --list "$B"                   # exists locally?
git -C $R ls-remote --heads origin "$B"        # exists remotely?
```
| Condition | Action |
|---|---|
| Exists locally | `git -C $R switch $B`, then `git -C $R pull --ff-only` if upstream exists. |
| Exists only on remote | `git -C $R switch -c $B --track origin/$B`. |
| Does not exist | `git -C $R switch -c $B origin/<base>` (base = `main`; if none, `master`; if both exist, ask user). |
| Name not provided by user | **Stop and ask.** Never invent a branch name. |
| Name matches protected branch | Reject. |

If the branch already exists, **do not create a new branch** and do not reset its history. Report back: branch name, base branch, and ahead/behind counts (`git rev-list --left-right --count origin/<base>...HEAD`).

## 2. Committing (Local, on Feature Branch)
- Commit incrementally, one logical change at a time (code changes first, then tests). This log is also parsed by `jira-task-generator` to calculate dates and manday estimates.
- Format: `[<TICKET> ]<Verb> <what>` with action verbs Fix/Add/Improve/Refactor/Implement/Remove, max ~72 characters. Example: `ORD-142 Add cancel order logic in OrderService`.
- Never commit `bin/obj`, `.user` files, secrets, or `appsettings.*.json` containing credentials. Check `git diff --cached --stat` before committing.
- Never `--amend` or rebase commits that have already been pushed.

## 3. Pushing and Creating PR (Only After Gate 3 Approval)
Execute from inside the repository folder to ensure permissions apply:
```bash
cd workspace/<repo> && git push -u origin <branch>
gh pr create --base <base> --title "<title>" --body-file <pr.html> [--draft]
```
Forbidden actions: force pushing, pushing to protected branches, merging PRs, deleting branches.

## 4. Recovery
- Committed on the wrong branch: `git switch` to the correct branch, move commits using `cherry-pick`; do not use `reset --hard`.
- Merge conflicts with base branch: report to the user and request a decision (merge vs. rebase); do not resolve major conflicts silently.
