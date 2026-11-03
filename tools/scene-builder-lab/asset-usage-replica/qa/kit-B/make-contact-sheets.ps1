Add-Type -AssemblyName System.Drawing
$taskRoot = 'E:/WORLDCREATOR/XingHaiHuiLang/Origin/work/scene-builder-lab/asset-usage-replica'
$qaRoot = Join-Path $taskRoot 'qa/kit-B'
$roles = @('tread','deck','post','rail')
$sizes = @('0.50 x 0.25 x 0.50 m','0.50 x 0.25 x 0.50 m','0.25 x 1.25 x 0.25 m','0.50 x 1.00 x 0.125 m')
$sheet = [System.Drawing.Bitmap]::new(1500,1900)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::FromArgb(239,242,241))
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(30,42,45))
$titleFont = [System.Drawing.Font]::new('Arial',27,[System.Drawing.FontStyle]::Bold)
$labelFont = [System.Drawing.Font]::new('Arial',18)
$g.DrawString('KIT B / MEASURED ORTHOGRAPHIC SOURCE VIEWS',$titleFont,$ink,35,24)
$g.DrawString('Native Blender meshes reopened from the delivered .blend files. Dimensions: logical X / Y / Z.',$labelFont,$ink,35,76)
$g.DrawString('FRONT: native X/Z',$labelFont,$ink,35,119)
$g.DrawString('SIDE: nose view from native -X',$labelFont,$ink,530,119)
$g.DrawString('TOP: native X/Y',$labelFont,$ink,1025,119)
for($row=0; $row -lt 4; $row++) {
    $y = 174 + $row*420
    $g.DrawString(($roles[$row].ToUpper() + '   ' + $sizes[$row]),$labelFont,$ink,35,$y)
    $column=0
    foreach($view in @('front','side','top')) {
        $imagePath = Join-Path $qaRoot ('orthographic/' + $roles[$row] + '/' + $view + '.png')
        $img = [System.Drawing.Image]::FromFile($imagePath)
        $g.DrawImage($img,35+$column*495,$y+36,360,360)
        $img.Dispose()
        $column++
    }
}
$g.DrawString('Each view is framed independently. Exact dimensions and interface coordinates are in measured-interfaces.svg.',$labelFont,$ink,35,1870)
$sheet.Save((Join-Path $qaRoot 'orthographic-contact-sheet.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $sheet.Dispose(); $ink.Dispose(); $titleFont.Dispose(); $labelFont.Dispose()

$manifest = Get-Content -Raw -LiteralPath (Join-Path $taskRoot 'kits/B/kit-manifest.json') | ConvertFrom-Json
$overview = [System.Drawing.Bitmap]::new(1500,1630)
$og = [System.Drawing.Graphics]::FromImage($overview)
$og.Clear([System.Drawing.Color]::FromArgb(239,242,241))
$brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(30,42,45))
$font = [System.Drawing.Font]::new('Arial',18)
$og.DrawString('KIT B / WARM STONE, TURQUOISE CAPS, OPEN WOOD RAILS',$font,$brush,30,20)
for($i=0; $i -lt $manifest.assets.Count; $i++) {
    $entry=$manifest.assets[$i]
    $x=30+($i%3)*490; $y=65+[math]::Floor($i/3)*515
    $img=[System.Drawing.Image]::FromFile((Join-Path $taskRoot ('kits/B/'+$entry.preview)))
    $og.DrawImage($img,[int]$x,[int]$y,450,450);$img.Dispose()
    $label=$entry.role+' / '+($entry.logicalSizeMeters -join ' x ')+' m'
    $og.DrawString($label,$font,$brush,$x,$y+460)
}
$overview.Save((Join-Path $qaRoot 'kit-B-overview.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$og.Dispose();$overview.Dispose();$brush.Dispose();$font.Dispose()
