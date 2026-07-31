$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releaseDir = Join-Path $projectRoot 'release'
$packageInfo = Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$version = $packageInfo.version

Set-Location $projectRoot

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx electron-builder --win --x64 --dir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$zipPath = Join-Path $releaseDir "蛋蛋江湖2.0-Portable-$version-x64.zip"
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $releaseDir 'win-unpacked') -DestinationPath $zipPath -CompressionLevel Optimal

$nsisCandidates = @(
  $env:NSIS_MAKENSIS,
  (Join-Path $env:LOCALAPPDATA 'electron-builder\Cache\nsis\nsis-3.0.4.1\Bin\makensis.exe'),
  'C:\Program Files (x86)\NSIS\makensis.exe',
  'C:\Program Files\NSIS\makensis.exe'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

$makensis = $nsisCandidates | Select-Object -First 1
if ($makensis) {
  & $makensis '/INPUTCHARSET' 'UTF8' "/DAPP_VERSION=$version" (Join-Path $projectRoot 'build-resources\installer.nsi')
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Warning '未找到 makensis.exe，已生成解压即用版，未生成安装程序。'
}

Get-ChildItem $releaseDir -File | Where-Object { $_.Extension -in '.exe', '.zip' } |
  Select-Object Name, Length, LastWriteTime
