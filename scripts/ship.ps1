# scripts/ship.ps1
#
# One command to get your work onto GitHub's main branch:
#   1. commits everything (the pre-commit hook runs lint-staged and a secret scan),
#   2. brings in anything new from GitHub,
#   3. runs the same lint and dependency audit that CI runs,
#   4. pushes to main.
# If you are on another branch, it merges that branch into main first.
#
# Usage:    npm run ship -- "<commit message>"
# Example:  npm run ship -- "O1b: owner account and MFA"
#
# It is safe to run again: if the push fails (for example a network reset), run the same command.

param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Message
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    git @args
    if ($LASTEXITCODE -ne 0) {
        throw "git $($args -join ' ') failed (exit code $LASTEXITCODE)."
    }
}

function Invoke-Step([string]$Label, [scriptblock]$Command) {
    Write-Host ''
    Write-Host "==> $Label"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed. Fix it, then run the same ship command again."
    }
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()

# 1. Commit pending work
if (git status --porcelain) {
    Invoke-Git add -A

    # Safety net: never commit secret-looking files, even if .gitignore is edited by mistake.
    $staged = git diff --cached --name-only
    $blocked = $staged | Where-Object { $_ -match '(^|/)\.env$' -or $_ -match '\.(pem|key)$' }
    if ($blocked) {
        git reset | Out-Null
        throw "Refusing to commit secret-looking files: $($blocked -join ', ')"
    }

    Invoke-Git commit -m $Message
} else {
    Write-Host 'Nothing new to commit.'
}

# 2. Get onto an up-to-date main
if ($branch -ne 'main') {
    Invoke-Git checkout main
    Invoke-Git pull --rebase origin main
    Invoke-Git merge $branch --no-edit
} else {
    Invoke-Git pull --rebase origin main
}

# 3. The same checks CI runs, before anything leaves your computer
Invoke-Step 'Lint' { npm run lint }
Invoke-Step 'Dependency audit (production packages)' { npm audit --omit=dev --audit-level=high }

# 4. Push
Invoke-Git push origin main

if ($branch -ne 'main') {
    git branch -d $branch 2>$null | Out-Null
}

Write-Host ''
Write-Host 'Pushed to main. CI runs on GitHub as a second check.'
