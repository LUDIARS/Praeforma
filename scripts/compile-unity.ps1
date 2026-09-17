param([Parameter(Mandatory=$true)][string]$EditorData, [string]$TelaAssembly)
$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$compiler = Join-Path $EditorData 'DotNetSdkRoslyn/csc.dll'
$runtime = Join-Path $EditorData 'NetCoreRuntime/dotnet.exe'
$refs = @('/r:' + (Join-Path $EditorData 'NetStandard/ref/2.1.0/netstandard.dll'))
$refs += '/r:' + (Join-Path $EditorData 'NetStandard/compat/2.1.0/shims/netfx/mscorlib.dll')
$refs += Get-ChildItem (Join-Path $EditorData 'Managed/UnityEngine') -Filter *.dll | ForEach-Object { '/r:' + $_.FullName }
New-Item -ItemType Directory -Force 'build-unity' | Out-Null
function Compile([string]$Name, [string]$Directory, [string[]]$ExtraRefs) {
    $sources = Get-ChildItem $Directory -Recurse -Filter *.cs | ForEach-Object FullName
    & $runtime $compiler /nologo /target:library /nostdlib+ ('/out:build-unity/' + $Name + '.dll') $refs $ExtraRefs $sources
    if ($LASTEXITCODE -ne 0) { throw "Compilation failed: $Name" }
}
Compile 'Praeforma.Runtime' 'Packages/jp.ludiars.praeforma/Runtime' @()
Compile 'Praeforma.Editor' 'Packages/jp.ludiars.praeforma/Editor' @('/r:build-unity/Praeforma.Runtime.dll')
$nunit = Join-Path $EditorData 'Resources/PackageManager/BuiltInPackages/com.unity.ext.nunit/net40/unity-custom/nunit.framework.dll'
Compile 'Praeforma.Editor.Tests' 'Packages/jp.ludiars.praeforma/Tests/Editor' @('/r:build-unity/Praeforma.Editor.dll', ('/r:' + $nunit))
if ($TelaAssembly) {
    Compile 'Praeforma.Tela.Editor' 'Packages/jp.ludiars.praeforma.tela/Editor' @('/r:build-unity/Praeforma.Editor.dll', ('/r:' + $TelaAssembly))
}
