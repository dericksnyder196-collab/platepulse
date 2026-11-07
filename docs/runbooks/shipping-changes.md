# Shipping a change

Every change goes through a pull request, because `main` is protected. One command does the local
part, and Claude does the rest on GitHub.

## Steps

1. Make the changes (Claude edits the files, or you do).
2. Run `npm run lint` and test locally.
3. Run one command from the project folder:

    ```
    npm run ship -- <branch-name> "<commit message>"
    ```

    Example: `npm run ship -- o1a-groundwork "O1a: fail-closed scopes, audit, roles"`

    It fetches the latest `origin/main`, starts the branch there while keeping your uncommitted work,
    commits (the pre-commit hook runs lint and Prettier), and pushes.

4. Tell Claude it is pushed. Claude opens the pull request, waits for CI, and merges it.

You never need to pull or switch back to `main` between steps, because each new branch starts from
the latest `origin/main`.

## If something fails

- **The commit is blocked by the hook:** read the lint output, fix it, and run the same command
  again. It reuses the branch.
- **"Refusing to commit secret-looking files":** a `.env` or `.pem`/`.key` file was staged. Check
  `.gitignore`. Never commit it.
- **"Author identity unknown":** set `git config --global user.name` and `user.email` once.
