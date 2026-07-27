$root = "apps\web\src"

Write-Host ""
Write-Host "============================================="
Write-Host " Revisando archivos JavaScript duplicados"
Write-Host "============================================="
Write-Host ""

$duplicates = @()
$orphans = @()

Get-ChildItem $root -Recurse -Filter *.js | ForEach-Object {

    $js = $_
    $ts = [System.IO.Path]::ChangeExtension($js.FullName,"ts")
    $tsx = [System.IO.Path]::ChangeExtension($js.FullName,"tsx")

    if (Test-Path $ts) {

        $duplicates += [PSCustomObject]@{
            JavaScript = $js.FullName
            Reemplazo = $ts
            Tipo = "TS"
        }

    }
    elseif (Test-Path $tsx) {

        $duplicates += [PSCustomObject]@{
            JavaScript = $js.FullName
            Reemplazo = $tsx
            Tipo = "TSX"
        }

    }
    else {

        $orphans += [PSCustomObject]@{
            JavaScript = $js.FullName
        }

    }

}

Write-Host ""
Write-Host "========== DUPLICADOS ==========" -ForegroundColor Green

$duplicates | Format-Table -AutoSize

Write-Host ""
Write-Host "Total duplicados:" $duplicates.Count -ForegroundColor Green

Write-Host ""
Write-Host "========== SIN REEMPLAZO ==========" -ForegroundColor Yellow

$orphans | Format-Table -AutoSize

Write-Host ""
Write-Host "Total sin reemplazo:" $orphans.Count -ForegroundColor Yellow