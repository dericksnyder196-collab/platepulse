# Local setup

## Requirements

- Node.js 22 or newer (`node -v`)
- A MySQL database. For Aiven, download the CA certificate from the service page.

## First run

1. Install packages: `npm install` (this also sets up the Git pre-commit hook).
2. Copy `.env.example` to `.env` and fill in the database and `JWT_ACCESS_SECRET` values.
   Generate a secret with:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
3. Copy the self-hosted fonts into the project: `npm run fonts` (needed once; commit the files it creates in `public/assets/fonts`)
4. Create the tables: `npm run migrate`
5. Start the app: `npm start` (or `npm run dev` to restart on file changes)
6. Check it: open http://localhost:3000/api/health, then http://localhost:3000/styleguide.html

## Everyday commands

| Command            | What it does                                   |
| ------------------ | ---------------------------------------------- |
| `npm run lint`     | Checks the code for errors and unsafe patterns |
| `npm run lint:fix` | Fixes what can be fixed automatically          |
| `npm run format`   | Formats all files with Prettier                |
| `npm run migrate`  | Applies any new files in `db/migrations`       |

## Troubleshooting

- `Configuration error`: a required variable is missing from `.env`. The message lists each one.
- `Table ... doesn't exist`: run `npm run migrate` against the same database the app uses.
- `self-signed certificate` when connecting to Aiven: check `DB_SSL_CA_PATH` points to the Aiven CA file.
