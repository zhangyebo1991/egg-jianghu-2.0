param(
  [string]$PackagePath
)

$ErrorActionPreference = 'Stop'

$eggRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $eggRoot
$gamesRoot = Split-Path -Parent $workspaceRoot

if ([string]::IsNullOrWhiteSpace($PackagePath)) {
  $PackagePath = Join-Path $gamesRoot '诸天刷宝录\package.nw'
}

$resolvedPackage = (Resolve-Path -LiteralPath $PackagePath).Path
$packageDir = Join-Path $PSScriptRoot 'tmp\zhutian-pkg'
$sheetDir = Join-Path $PSScriptRoot 'tmp\zhutian-sheets'
$manifestPath = Join-Path $PSScriptRoot 'tmp\zhutian-equipment-source.json'

New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
New-Item -ItemType Directory -Path $sheetDir -Force | Out-Null

$targets = @(
  @{ Entry = 'data.json'; Destination = Join-Path $packageDir 'data.json' },
  @{ Entry = 'wp.json'; Destination = Join-Path $packageDir 'wp.json' },
  @{ Entry = 'sq.json'; Destination = Join-Path $packageDir 'sq.json' },
  @{ Entry = 'dl.json'; Destination = Join-Path $packageDir 'dl.json' },
  @{ Entry = 'tz.json'; Destination = Join-Path $packageDir 'tz.json' },
  @{ Entry = 'zbct.json'; Destination = Join-Path $packageDir 'zbct.json' },
  @{ Entry = 'shili.json'; Destination = Join-Path $packageDir 'shili.json' },
  @{ Entry = 'images/物品图标-sheet0.webp'; Destination = Join-Path $sheetDir '物品图标-sheet0.webp' },
  @{ Entry = 'images/物品图标-sheet1.webp'; Destination = Join-Path $sheetDir '物品图标-sheet1.webp' },
  @{ Entry = 'images/装备标识-sheet0.webp'; Destination = Join-Path $sheetDir '装备标识-sheet0.webp' }
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($resolvedPackage)
$manifestEntries = [ordered]@{}

try {
  foreach ($target in $targets) {
    $entry = $archive.GetEntry($target.Entry)
    if ($null -eq $entry) {
      throw "package.nw 缺少条目：$($target.Entry)"
    }

    $destination = [IO.Path]::GetFullPath($target.Destination)
    $allowedRoot = if ($target.Entry.StartsWith('images/')) { $sheetDir } else { $packageDir }
    $allowedPrefix = [IO.Path]::GetFullPath($allowedRoot).TrimEnd('\') + '\'
    if (-not $destination.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw "拒绝写出到预期目录外：$destination"
    }

    $sourceStream = $entry.Open()
    $destinationStream = [IO.File]::Create($destination)
    try {
      $sourceStream.CopyTo($destinationStream)
    }
    finally {
      $destinationStream.Dispose()
      $sourceStream.Dispose()
    }

    $manifestEntries[$target.Entry] = [ordered]@{
      file = $destination
      length = (Get-Item -LiteralPath $destination).Length
      sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
    }
  }
}
finally {
  $archive.Dispose()
}

$manifest = [ordered]@{
  package = $resolvedPackage
  generatedAt = [DateTimeOffset]::Now.ToString('o')
  entries = $manifestEntries
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Push-Location $eggRoot
try {
  & node 'scripts/generate-zhutian-equipment.mjs'
  if ($LASTEXITCODE -ne 0) {
    throw "装备与图标生成失败，退出码：$LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

Write-Host "已从同一 package.nw 生成装备数据与原版图标：$resolvedPackage"
