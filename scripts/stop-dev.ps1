$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
foreach ($taskName in @('api','metro')) {
 $taskPidFile=Join-Path $taskRoot ('.tools\'+$taskName+'.pid')
 if (Test-Path -LiteralPath $taskPidFile) {
  $taskPidValue=[int](Get-Content -LiteralPath $taskPidFile)
  $taskProcess=Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskPidValue) -ErrorAction SilentlyContinue
  if ($taskProcess -and ($taskProcess.ExecutablePath.StartsWith($taskRoot,[StringComparison]::OrdinalIgnoreCase) -or $taskProcess.CommandLine.Contains($taskRoot))) {Stop-Process -Id $taskPidValue}
  Remove-Item -LiteralPath $taskPidFile
 }
}
$taskPg=Join-Path $taskRoot '.tools\postgres\pgsql\bin\pg_ctl.exe'
if (Test-Path -LiteralPath $taskPg) {& $taskPg stop -D (Join-Path $taskRoot '.tools\pgdata') -m fast}
