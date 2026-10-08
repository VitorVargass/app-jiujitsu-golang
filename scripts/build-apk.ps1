param([string]$ApiUrl='http://192.168.15.6:8080')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskJava=Get-ChildItem -LiteralPath (Join-Path $taskRoot '.tools\java') -Directory | Select-Object -First 1
if (-not $taskJava -or -not (Test-Path -LiteralPath (Join-Path $taskRoot '.tools\android-sdk'))) {throw 'Configure Java 21 e Android SDK em .tools ou use o perfil EAS preview.'}
$taskOwnMapping=$false
$taskMappings=@(& subst.exe)
$taskExisting=$taskMappings | Where-Object { $_.StartsWith('T:\') }
if ($taskExisting) {
 if (-not $taskExisting.EndsWith($taskRoot,[StringComparison]::OrdinalIgnoreCase)) {throw 'A unidade T já está em uso por outra pasta.'}
} elseif (Test-Path -LiteralPath 'T:\') {throw 'A unidade T já está em uso.'}
else {subst.exe T: $taskRoot;if ($LASTEXITCODE -ne 0) {throw 'Falha ao preparar unidade temporária.'};$taskOwnMapping=$true}
# A copy in a short physical path avoids both Ninja MAX_PATH and mixed drive roots.
$taskStage=Join-Path ([IO.Path]::GetPathRoot($taskRoot)) ('ttm'+[guid]::NewGuid().ToString('N').Substring(0,5))
if (Test-Path -LiteralPath $taskStage) {throw 'Pasta temporária já existe.'}
New-Item -ItemType Directory -Path $taskStage | Out-Null
[IO.File]::WriteAllText((Join-Path $taskStage '.tatame-build-owner'),$taskRoot)
try {
 $env:JAVA_HOME=Join-Path 'T:\.tools\java' $taskJava.Name
 $env:ANDROID_HOME='T:\.tools\android-sdk'
 $env:GRADLE_USER_HOME='T:\.tools\gradle'
 $env:PATH=$env:JAVA_HOME+'\bin;'+$env:PATH
 $env:EXPO_PUBLIC_API_URL=$ApiUrl
 $env:NODE_ENV='production'
 $taskMobile=Join-Path $taskRoot 'mobile'
 $taskExclude=@('android','ios','.expo','.git','dist') | ForEach-Object {Join-Path $taskMobile $_}
 robocopy $taskMobile $taskStage /E /XD $taskExclude /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
 if ($LASTEXITCODE -gt 7) {throw 'Falha ao copiar arquivos de build.'}
 Push-Location $taskStage
 try {
  npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) {throw 'Prebuild falhou.'}
  & '.\android\gradlew.bat' -p '.\android' assembleRelease '-PreactNativeArchitectures=arm64-v8a' --no-daemon --console=plain
  if ($LASTEXITCODE -ne 0) {throw 'Build Android falhou.'}
 } finally {Pop-Location}
 $taskArtifacts=Join-Path $taskRoot 'artifacts'
 New-Item -ItemType Directory -Force -Path $taskArtifacts | Out-Null
 Copy-Item -LiteralPath (Join-Path $taskStage 'android\app\build\outputs\apk\release\app-release.apk') -Destination (Join-Path $taskArtifacts 'Tatame-arm64.apk') -Force
 Write-Output ('APK: '+(Join-Path $taskArtifacts 'Tatame-arm64.apk'))
} finally {
 # Delete only the exact staging directory created above, after checking ownership.
 $taskResolved=[IO.Path]::GetFullPath($taskStage)
 $taskDrive=[IO.Path]::GetPathRoot($taskRoot)
 if ($taskResolved.StartsWith($taskDrive+'ttm',[StringComparison]::OrdinalIgnoreCase) -and
     (Split-Path -Parent $taskResolved) -eq $taskDrive -and
     (Get-Content -LiteralPath (Join-Path $taskResolved '.tatame-build-owner') -Raw) -eq $taskRoot) {
  Remove-Item -LiteralPath $taskResolved -Recurse -Force
 }
 if ($taskOwnMapping) {subst.exe T: /d}
}
