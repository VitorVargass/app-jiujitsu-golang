param([switch]$Seed,[string]$ApiUrl='http://127.0.0.1:8080')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskTools=Join-Path $taskRoot '.tools'
$taskGo=Join-Path $taskTools 'go\bin\go.exe'
if (-not (Test-Path -LiteralPath $taskGo)) {
 $taskGo=(Get-Command go -ErrorAction SilentlyContinue).Source
 if (-not $taskGo) {throw 'Instale Go ou execute scripts/bootstrap-windows.ps1.'}
}
$env:GOPATH=Join-Path $taskTools 'gopath'
$taskPg=Join-Path $taskTools 'postgres\pgsql\bin'
if (Get-Command docker -ErrorAction SilentlyContinue) {
 Push-Location $taskRoot
 try {docker compose up -d postgres; if ($LASTEXITCODE -ne 0) {throw 'Docker falhou.'}} finally {Pop-Location}
 $env:DATABASE_URL='postgres://tatame:tatame_dev@127.0.0.1:5432/tatame?sslmode=disable'
} elseif (Test-Path -LiteralPath (Join-Path $taskPg 'postgres.exe')) {
 $env:PGPASSWORD='tatame_dev'
 & (Join-Path $taskPg 'pg_isready.exe') -h 127.0.0.1 -p 55432 *> $null
 if ($LASTEXITCODE -ne 0) {
  $taskData=Join-Path $taskTools 'pgdata'
  if (-not (Test-Path -LiteralPath (Join-Path $taskData 'PG_VERSION'))) {
   $taskPassword=Join-Path $taskTools 'pg-password'
   [IO.File]::WriteAllText($taskPassword,'tatame_dev')
   & (Join-Path $taskPg 'initdb.exe') -D $taskData -U tatame -A scram-sha-256 ('--pwfile='+$taskPassword) --encoding=UTF8 --locale=C
   if ($LASTEXITCODE -ne 0) {throw 'Não foi possível inicializar o PostgreSQL.'}
  }
  Start-Process -FilePath (Join-Path $taskPg 'postgres.exe') -ArgumentList @('-D',$taskData,'-p','55432','-h','127.0.0.1') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskTools 'postgres-stdout.log') -RedirectStandardError (Join-Path $taskTools 'postgres-stderr.log')
  Start-Sleep -Seconds 2
 }
 & (Join-Path $taskPg 'psql.exe') -h 127.0.0.1 -p 55432 -U tatame -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='tatame'" | Tee-Object -Variable taskDatabaseExists | Out-Null
 if (-not $taskDatabaseExists) {& (Join-Path $taskPg 'createdb.exe') -h 127.0.0.1 -p 55432 -U tatame tatame}
 $env:DATABASE_URL='postgres://tatame:tatame_dev@127.0.0.1:55432/tatame?sslmode=disable'
} else {throw 'Use Docker ou execute scripts/bootstrap-windows.ps1.'}
$taskHealthy=$false
try {$taskHealthBody=& curl.exe --noproxy '*' --max-time 3 --silent 'http://127.0.0.1:8080/healthz';$taskHealthy=($taskHealthBody | ConvertFrom-Json).service -eq 'tatame-api'} catch {}
Push-Location (Join-Path $taskRoot 'backend')
try {
 if ($Seed) {& $taskGo run ./cmd/seed;if ($LASTEXITCODE -ne 0) {throw 'Seed falhou.'}}
 if (-not $taskHealthy) {
  $taskExe=Join-Path $taskTools 'tatame-api.exe'
  & $taskGo build -o $taskExe ./cmd/api
  if ($LASTEXITCODE -ne 0) {throw 'API não compilou.'}
  $taskAPI=Start-Process -FilePath $taskExe -WorkingDirectory (Join-Path $taskRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskTools 'api-stdout.log') -RedirectStandardError (Join-Path $taskTools 'api-stderr.log') -PassThru
  $taskAPI.Id | Set-Content -LiteralPath (Join-Path $taskTools 'api.pid')
 }
} finally {Pop-Location}
$taskWebReady=$false
try {& curl.exe --noproxy '*' --max-time 5 --silent --fail --output NUL 'http://127.0.0.1:8081';$taskWebReady=$LASTEXITCODE -eq 0} catch {}
if (-not $taskWebReady) {
 $env:EXPO_PUBLIC_API_URL=$ApiUrl
 $taskNode=(Get-Command node).Source
 $taskExpo=Join-Path $taskRoot 'mobile\node_modules\expo\bin\cli'
 if (-not (Test-Path -LiteralPath $taskExpo)) {throw 'Execute npm ci dentro de mobile.'}
 $taskMetro=Start-Process -FilePath $taskNode -ArgumentList @($taskExpo,'start','--web','--port','8081') -WorkingDirectory (Join-Path $taskRoot 'mobile') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskTools 'mobile-stdout.log') -RedirectStandardError (Join-Path $taskTools 'mobile-stderr.log') -PassThru
 $taskMetro.Id | Set-Content -LiteralPath (Join-Path $taskTools 'metro.pid')
}
Write-Output 'API: http://localhost:8080 | Preview: http://localhost:8081'
Write-Output 'Logs disponíveis na pasta .tools.'
