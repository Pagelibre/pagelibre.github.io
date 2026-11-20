# Fabrique un EMF de test (EMF « pur », sans EMF+) : rectangle, ellipse, polygone, trait, texte.
param([string]$Dossier)
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 10, 10
$g0 = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g0.GetHdc()
$ms = New-Object System.IO.MemoryStream
$mf = New-Object System.Drawing.Imaging.Metafile($ms, $hdc, (New-Object System.Drawing.RectangleF 0, 0, 400, 260), [System.Drawing.Imaging.MetafileFrameUnit]::Pixel, [System.Drawing.Imaging.EmfType]::EmfOnly)
$g0.ReleaseHdc($hdc)
$g = [System.Drawing.Graphics]::FromImage($mf)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 0))), 20, 20, 360, 160)
$g.DrawRectangle((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(0, 64, 128)), 6), 20, 20, 360, 160)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(32, 112, 208))), 60, 50, 140, 110)
$pts = [System.Drawing.Point[]]@((New-Object System.Drawing.Point 230, 160), (New-Object System.Drawing.Point 300, 40), (New-Object System.Drawing.Point 370, 160))
$g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(48, 160, 48))), $pts)
$g.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::Black), 2), 20, 200, 380, 200)
$g.DrawString('Prise 16 A', (New-Object System.Drawing.Font 'Arial', 20, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(192, 0, 0))), 30, 210)
$g.Dispose(); $mf.Dispose()
[IO.File]::WriteAllBytes((Join-Path $Dossier 'test.emf'), $ms.ToArray())
Get-Item (Join-Path $Dossier 'test.emf') | Select-Object Name, Length
