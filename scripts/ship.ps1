# scripts/ship.ps1
#
# Puts your current work on a new branch and pushes it. Claude then opens the pull request,
# waits for CI and merges it, so there is nothing to do on GitHub afterwards.
#
# Usage:    npm run ship -- <branch-name> "<commit message>"
# Example:  npm run ship -- o1a-groundwork "O1a: fail-closed scopes, audit, roles"
#
# The branch starts from the latest origin/main and carries your uncommitted work with it, so
# you never need to pull or switch back to main between steps.

param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Branch,
    [Parameter(Mandatory = $true, Position = 1)][string]$Message
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    git @args
    if ($LASTEXITCODE -ne 0) {
        throw "git $($args -join ' ') failed (exit code $LASTEXITCODE)."
    }
}

if ($Branch -notmatch '^[A-Za-z0-9._/-]+$') {
    throw 'Branch names may only contain letters, numbers, dots, dashes, underscores and slashes.'
}

Invoke-Git fetch origin

if (git branch --list $Branch) {
    Invoke-Git checkout $Branch
} else {
    Invoke-Git checkout -b $Branch origin/main
}

Invoke-Git add -A

# Safety net: never commit secret-looking files, even if .gitignore is edited by mistake.
$staged = git diff --cached --name-only
$blocked = $staged | Where-Object { $_ -match '(^|/)\.env$' -or $_ -match '\.(pem|key)$' }
if ($blocked) {
    git reset | Out-Null
    throw "Refusing to commit secret-looking files: $($blocked -join ', ')"
}

Invoke-Git commit -m $Message
Invoke-Git push -u origin $Branch

Write-Host ''
Write-Host "Pushed $Branch. Tell Claude it is pushed; the pull request will be opened, checked and merged for you."
