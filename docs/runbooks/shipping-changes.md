# Shipping a change

One command puts your work on GitHub's `main` branch. There are no pull requests for now (see
decision 0007).

## Steps

1. Make the changes (Claude edits the files, or you do).
2. Test locally.
3. Run one command from the project folder:

    ```
    npm run ship -- "<commit message>"
    ```

    Example: `npm run ship -- "O1b: owner account and MFA"`

It commits everything, brings in anything new from GitHub, runs the same lint and dependency audit
that CI runs, and pushes to `main`. If you are on another branch, it merges that branch into `main`
first. CI then runs on GitHub as a second check, and Claude can see its result.

## If something fails

- **The commit is blocked by the hook:** read the lint output, fix it, and run the same command
  again.
- **Lint or the audit failed:** fix what it reports and run the same command again. Nothing was
  pushed.
- **"Recv failure: Connection was reset":** a network or DNS problem. Run the same command again.
  If it keeps happening, set your DNS servers to `1.1.1.1` and `8.8.8.8`.
- **"Refusing to commit secret-looking files":** a `.env` or `.pem`/`.key` file was staged. Check
  `.gitignore`. Never commit it.
- **"Author identity unknown":** set `git config --global user.name` and `user.email` once.
- **A rebase conflict:** stop and ask Claude. Do not force-push.
