# scripts/ship.ps1
#
# Puts your current work on a new branch and pushes it. With the GitHub CLI (gh) installed and
# logged in, it then opens the pull request, waits for CI and merges it. Without gh, it prints
# the link to open the pull request.
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
Write-Host "Pushed $Branch."

# With the GitHub CLI (gh) installed and logged in, finish the job: open the pull request,
# wait for CI, and merge it. Without it, print the link instead.
$repoUrl = (git remote get-url origin) -replace '\.git$', ''
$prUrl = "$repoUrl/pull/new/$Branch"

$ghReady = $false
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh auth status *> $null
    $ghReady = ($LASTEXITCODE -eq 0)
}

if (-not $ghReady) {
    Write-Host ''
    Write-Host 'GitHub CLI (gh) is not installed or not logged in, so open the pull request here:'
    Write-Host $prUrl
    return
}

$env:GH_PROMPT_DISABLED = '1'

$open = gh pr list --head $Branch --state open --json number --jq 'length'
if ($open -eq '0') {
    gh pr create --base main --head $Branch --title $Message --body "Opened by npm run ship."
    if ($LASTEXITCODE -ne 0) { throw 'gh pr create failed.' }
}

Write-Host 'Waiting for CI checks...'
Start-Sleep -Seconds 15
gh pr checks $Branch --watch --interval 10
if ($LASTEXITCODE -ne 0) {
    throw 'CI checks did not pass. Fix the problem, then run the same ship command again.'
}

gh pr merge $Branch --squash
if ($LASTEXITCODE -ne 0) { throw 'gh pr merge failed.' }

git push origin --delete $Branch 2>$null
Write-Host ''
Write-Host "Merged $Branch into main."
