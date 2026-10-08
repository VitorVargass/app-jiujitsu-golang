$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskTools=Join-Path $taskRoot '.tools'
New-Item -ItemType Directory -Force -Path $taskTools | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $taskTools 'go\bin\go.exe'))) {
 $taskReleases=Invoke-RestMethod 'https://go.dev/dl/?mode=json'
 $taskArchive=$taskReleases[0].files | Where-Object {$_.os -eq 'windows' -and $_.arch -eq 'amd64' -and $_.kind -eq 'archive'} | Select-Object -First 1
 $taskZip=Join-Path $taskTools 'go.zip'
 Invoke-WebRequest ('https://go.dev/dl/'+$taskArchive.filename) -OutFile $taskZip
 if ((Get-FileHash $taskZip -Algorithm SHA256).Hash.ToLower() -ne $taskArchive.sha256) {throw 'Checksum do Go inválido.'}
 Expand-Archive -LiteralPath $taskZip -DestinationPath $taskTools -Force
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and -not (Test-Path -LiteralPath (Join-Path $taskTools 'postgres\pgsql\bin\postgres.exe'))) {
 $taskZip=Join-Path $taskTools 'postgres.zip'
 Invoke-WebRequest 'https://get.enterprisedb.com/postgresql/postgresql-17.11-1-windows-x64-binaries.zip' -OutFile $taskZip
 Expand-Archive -LiteralPath $taskZip -DestinationPath (Join-Path $taskTools 'postgres') -Force
}
Push-Location (Join-Path $taskRoot 'mobile')
try {npm ci;if ($LASTEXITCODE -ne 0) {throw 'Dependências do aplicativo não foram instaladas.'}} finally {Pop-Location}
Write-Output 'Go, PostgreSQL e dependências do aplicativo preparados.'
