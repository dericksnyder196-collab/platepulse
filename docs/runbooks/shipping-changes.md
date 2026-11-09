# Shipping a change

Every change goes through a pull request, because `main` is protected. One command does all of it.

## One-time setup

1. Install the GitHub CLI: `winget install --id GitHub.cli`, then close and reopen the terminal.
2. Log in: `gh auth login`. Choose GitHub.com, HTTPS, and log in with the browser.
3. Check it: `gh auth status` should say you are logged in.

Without `gh`, `npm run ship` still pushes the branch and prints a link to open the pull request.

## Steps

1. Make the changes (Claude edits the files, or you do).
2. Run `npm run lint` and test locally.
3. Run one command from the project folder:

    ```
    npm run ship -- <branch-name> "<commit message>"
    ```

    Example: `npm run ship -- o1b-owner-mfa "O1b: owner account and MFA"`

    It fetches the latest `origin/main`, starts the branch there while keeping your uncommitted work,
    commits (the pre-commit hook runs lint and Prettier), pushes, opens the pull request, waits for CI
    to pass, and squash-merges it.

You never need to pull or switch back to `main` between steps, because each new branch starts from
the latest `origin/main`.

## If something fails

- **The commit is blocked by the hook:** read the lint output, fix it, and run the same command
  again. It reuses the branch.
- **CI did not pass:** open the failing check, fix the problem, and run the same command again. The
  existing pull request is updated.
- **"Refusing to commit secret-looking files":** a `.env` or `.pem`/`.key` file was staged. Check
  `.gitignore`. Never commit it.
- **"Author identity unknown":** set `git config --global user.name` and `user.email` once.
- **"Recv failure: Connection was reset":** a DNS or network problem. Set your DNS servers to
  `1.1.1.1` and `8.8.8.8`.
