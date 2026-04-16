param(
    [string]$OutputPath = "G:\HackathonDay\Migration-Helper-Kickoff.pptx"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$msoTrue = -1
$msoFalse = 0
$ppLayoutBlank = 12
$ppSaveAsOpenXMLPresentation = 24
$ppAlignLeft = 1

$palette = @{
    Navy = 0x2D1F14
    Blue = 0xC85A14
    Teal = 0x7A6A0F
    Gold = 0x1D8ACF
    Slate = 0x5B6470
    Ink = 0x2B2B2B
    White = 0xFFFFFF
    Mist = 0xF4F6F8
    SoftBlue = 0xF2E8DE
    SoftTeal = 0xE7F2F1
    SoftGold = 0xD9F0FA
}

function Inch {
    param([double]$Value)
    return [double]($Value * 72)
}

function Remove-IfExists {
    param([string]$Path)
    if (Test-Path $Path) {
        Remove-Item -LiteralPath $Path -Force
    }
}

function Set-TextRangeStyle {
    param(
        $TextRange,
        [string]$FontName = "Aptos",
        [int]$FontSize = 18,
        [int]$Color = 0x2B2B2B,
        [switch]$Bold
    )

    $TextRange.Font.Name = $FontName
    $TextRange.Font.Size = $FontSize
    $TextRange.Font.Color.RGB = $Color
    $TextRange.Font.Bold = if ($Bold.IsPresent) { $msoTrue } else { $msoFalse }
}

function Add-Box {
    param(
        $Slide,
        [float]$Left,
        [float]$Top,
        [float]$Width,
        [float]$Height,
        [int]$FillColor,
        [int]$LineColor = 0xFFFFFF,
        [float]$LineWeight = 0
    )

    $shape = $Slide.Shapes.AddShape(1, $Left, $Top, $Width, $Height)
    $shape.Fill.ForeColor.RGB = $FillColor
    $shape.Line.ForeColor.RGB = $LineColor
    $shape.Line.Weight = $LineWeight
    if ($LineWeight -eq 0) {
        $shape.Line.Visible = $msoFalse
    }
    return $shape
}

function Add-TextBox {
    param(
        $Slide,
        [float]$Left,
        [float]$Top,
        [float]$Width,
        [float]$Height,
        [string]$Text,
        [string]$FontName = "Aptos",
        [int]$FontSize = 20,
        [int]$Color = 0x2B2B2B,
        [switch]$Bold
    )

    $shape = $Slide.Shapes.AddTextbox(1, $Left, $Top, $Width, $Height)
    $shape.TextFrame2.WordWrap = $msoTrue
    $shape.TextFrame2.AutoSize = 0
    $shape.TextFrame.TextRange.Text = $Text
    Set-TextRangeStyle -TextRange $shape.TextFrame.TextRange -FontName $FontName -FontSize $FontSize -Color $Color -Bold:$Bold.IsPresent
    return $shape
}

function Add-Bullets {
    param(
        $Slide,
        [float]$Left,
        [float]$Top,
        [float]$Width,
        [float]$Height,
        [string[]]$Bullets,
        [int]$FontSize = 20,
        [int]$Color = 0x2B2B2B
    )

    $shape = $Slide.Shapes.AddTextbox(1, $Left, $Top, $Width, $Height)
    $shape.TextFrame2.WordWrap = $msoTrue
    $shape.TextFrame2.AutoSize = 0
    $shape.TextFrame.TextRange.Text = ($Bullets -join "`r")
    Set-TextRangeStyle -TextRange $shape.TextFrame.TextRange -FontSize $FontSize -Color $Color
    $paragraphCount = $shape.TextFrame.TextRange.Paragraphs().Count
    for ($i = 1; $i -le $paragraphCount; $i++) {
        $paragraph = $shape.TextFrame.TextRange.Paragraphs($i)
        $paragraph.ParagraphFormat.Bullet.Visible = $msoTrue
        $paragraph.ParagraphFormat.Bullet.Character = 8226
        $paragraph.ParagraphFormat.SpaceAfter = 6
        $paragraph.Font.Size = $FontSize
        $paragraph.Font.Name = "Aptos"
        $paragraph.Font.Color.RGB = $Color
    }
    return $shape
}

function Add-Title {
    param(
        $Slide,
        [string]$Title,
        [string]$Subtitle = ""
    )

    $title = Add-TextBox -Slide $Slide -Left (Inch 0.6) -Top (Inch 0.45) -Width (Inch 8.5) -Height (Inch 0.7) -Text $Title -FontName "Aptos Display" -FontSize 26 -Color $palette.Navy -Bold
    if ($Subtitle) {
        $sub = Add-TextBox -Slide $Slide -Left (Inch 0.62) -Top (Inch 1.18) -Width (Inch 8.8) -Height (Inch 0.45) -Text $Subtitle -FontSize 13 -Color $palette.Slate
        $sub.TextFrame.TextRange.ParagraphFormat.Alignment = $ppAlignLeft
    }
}

function Add-TopBand {
    param($Slide, [int]$AccentColor)
    $band = Add-Box -Slide $Slide -Left 0 -Top 0 -Width (Inch 13.333) -Height (Inch 0.18) -FillColor $AccentColor
    $null = $band
}

function Add-MetricCard {
    param(
        $Slide,
        [float]$Left,
        [float]$Top,
        [float]$Width,
        [float]$Height,
        [string]$Label,
        [string]$Value,
        [int]$FillColor
    )

    $card = Add-Box -Slide $Slide -Left $Left -Top $Top -Width $Width -Height $Height -FillColor $FillColor
    $card.Line.Visible = $msoFalse
    $label = Add-TextBox -Slide $Slide -Left ($Left + (Inch 0.18)) -Top ($Top + (Inch 0.12)) -Width ($Width - (Inch 0.3)) -Height (Inch 0.28) -Text $Label -FontSize 11 -Color $palette.Slate
    $value = Add-TextBox -Slide $Slide -Left ($Left + (Inch 0.18)) -Top ($Top + (Inch 0.42)) -Width ($Width - (Inch 0.3)) -Height (Inch 0.42) -Text $Value -FontName "Aptos Display" -FontSize 22 -Color $palette.Navy -Bold
    $null = $label
    $null = $value
}

function Add-TwoColumnSlide {
    param(
        $Slide,
        [string]$Title,
        [string]$Subtitle,
        [string]$LeftHeader,
        [string[]]$LeftBullets,
        [string]$RightHeader,
        [string[]]$RightBullets,
        [int]$AccentColor = 0xC85A14
    )

    Add-TopBand -Slide $Slide -AccentColor $AccentColor
    Add-Title -Slide $Slide -Title $Title -Subtitle $Subtitle
    $leftPanel = Add-Box -Slide $Slide -Left (Inch 0.62) -Top (Inch 1.65) -Width (Inch 5.95) -Height (Inch 4.85) -FillColor $palette.Mist
    $rightPanel = Add-Box -Slide $Slide -Left (Inch 6.75) -Top (Inch 1.65) -Width (Inch 5.95) -Height (Inch 4.85) -FillColor $palette.White -LineColor 0xD9E0E7 -LineWeight 1
    $null = $leftPanel
    $null = $rightPanel
    Add-TextBox -Slide $Slide -Left (Inch 0.9) -Top (Inch 1.92) -Width (Inch 5.0) -Height (Inch 0.35) -Text $LeftHeader -FontName "Aptos Display" -FontSize 18 -Color $palette.Navy -Bold | Out-Null
    Add-Bullets -Slide $Slide -Left (Inch 0.92) -Top (Inch 2.35) -Width (Inch 5.1) -Height (Inch 3.8) -Bullets $LeftBullets -FontSize 17 -Color $palette.Ink | Out-Null
    Add-TextBox -Slide $Slide -Left (Inch 7.05) -Top (Inch 1.92) -Width (Inch 5.0) -Height (Inch 0.35) -Text $RightHeader -FontName "Aptos Display" -FontSize 18 -Color $palette.Navy -Bold | Out-Null
    Add-Bullets -Slide $Slide -Left (Inch 7.07) -Top (Inch 2.35) -Width (Inch 5.1) -Height (Inch 3.8) -Bullets $RightBullets -FontSize 17 -Color $palette.Ink | Out-Null
}

function Add-SectionSlide {
    param(
        $Slide,
        [string]$Title,
        [string]$Body,
        [int]$AccentColor
    )

    $bg = Add-Box -Slide $Slide -Left 0 -Top 0 -Width (Inch 13.333) -Height (Inch 7.5) -FillColor $palette.Navy
    $circle1 = Add-Box -Slide $Slide -Left (Inch 8.8) -Top (Inch -0.7) -Width (Inch 4.1) -Height (Inch 4.1) -FillColor $AccentColor
    $circle1.AutoShapeType = 9
    $circle1.Fill.Transparency = 0.15
    $circle2 = Add-Box -Slide $Slide -Left (Inch 9.8) -Top (Inch 4.8) -Width (Inch 3.0) -Height (Inch 3.0) -FillColor $palette.Teal
    $circle2.AutoShapeType = 9
    $circle2.Fill.Transparency = 0.25
    $null = $bg
    Add-TextBox -Slide $Slide -Left (Inch 0.8) -Top (Inch 1.25) -Width (Inch 7.0) -Height (Inch 0.5) -Text "Migration Helper" -FontSize 16 -Color $palette.Gold | Out-Null
    Add-TextBox -Slide $Slide -Left (Inch 0.78) -Top (Inch 2.0) -Width (Inch 7.8) -Height (Inch 0.95) -Text $Title -FontName "Aptos Display" -FontSize 28 -Color $palette.White -Bold | Out-Null
    $bodyShape = Add-TextBox -Slide $Slide -Left (Inch 0.82) -Top (Inch 3.2) -Width (Inch 7.4) -Height (Inch 1.5) -Text $Body -FontSize 18 -Color $palette.Mist
    $bodyShape.TextFrame.TextRange.ParagraphFormat.SpaceAfter = 8
}

function Add-RoadmapSlide {
    param($Slide)

    Add-TopBand -Slide $Slide -AccentColor $palette.Blue
    Add-Title -Slide $Slide -Title "Delivery Waves" -Subtitle "Work is staged so Codex workers can move in parallel without stepping on shared contracts."
    $waves = @(
        @{ Name = "Wave 1"; Top = 1.7; Color = $palette.SoftBlue; Items = @("Shared contract", "Java app skeleton", "UI shell with mock data") },
        @{ Name = "Wave 2"; Top = 2.75; Color = $palette.SoftTeal; Items = @("Ingestion and normalization", "Detector SPI", "Policy loader") },
        @{ Name = "Wave 3"; Top = 3.8; Color = $palette.SoftGold; Items = @("Node and Java detectors", "Python/.NET/Go/Docker/CI detectors") },
        @{ Name = "Wave 4"; Top = 4.85; Color = $palette.Mist; Items = @("Recommendations", "Aggregation", "Observability") },
        @{ Name = "Wave 5"; Top = 5.9; Color = 0xECE9F8; Items = @("Live UI wiring", "Golden reports", "Integration tests", "Docs") }
    )

    foreach ($wave in $waves) {
        $card = Add-Box -Slide $Slide -Left (Inch 0.9) -Top (Inch $wave.Top) -Width (Inch 11.5) -Height (Inch 0.78) -FillColor $wave.Color
        $card.Line.Visible = $msoFalse
        Add-TextBox -Slide $Slide -Left (Inch 1.15) -Top ((Inch $wave.Top) + (Inch 0.1)) -Width (Inch 1.0) -Height (Inch 0.3) -Text $wave.Name -FontName "Aptos Display" -FontSize 16 -Color $palette.Navy -Bold | Out-Null
        Add-TextBox -Slide $Slide -Left (Inch 2.25) -Top ((Inch $wave.Top) + (Inch 0.1)) -Width (Inch 9.5) -Height (Inch 0.42) -Text (($wave.Items -join "  •  ")) -FontSize 15 -Color $palette.Ink | Out-Null
    }
}

function Add-WorkerSlide {
    param($Slide)

    Add-TopBand -Slide $Slide -AccentColor $palette.Teal
    Add-Title -Slide $Slide -Title "Codex Worker Ownership" -Subtitle "Each worker has a crisp write-scope and must route shared-model changes through the designated owner."

    $workers = @(
        @{ Left = 0.7; Top = 1.7; Width = 4.0; Height = 1.25; Fill = $palette.SoftBlue; Title = "Worker 1"; Body = "Platform and API core`rShared contracts, scan lifecycle, final report aggregation" },
        @{ Left = 4.85; Top = 1.7; Width = 4.0; Height = 1.25; Fill = $palette.SoftTeal; Title = "Worker 2"; Body = "Ingestion and normalization`rArchive validation, extraction, local path scans" },
        @{ Left = 9.0; Top = 1.7; Width = 3.6; Height = 1.25; Fill = $palette.SoftGold; Title = "Worker 6"; Body = "UI, tests, docs`rMock-first UI, golden reports, dev guide" },
        @{ Left = 0.7; Top = 3.3; Width = 3.9; Height = 1.45; Fill = $palette.Mist; Title = "Worker 3"; Body = "Detector SPI + Node/Java`rEvidence model, confidence model, Maven/Gradle, npm/yarn/pnpm" },
        @{ Left = 4.95; Top = 3.3; Width = 3.9; Height = 1.45; Fill = 0xF6EEE8; Title = "Worker 4"; Body = "Python/.NET/Go/Docker/CI`rFollow SPI exactly, no parallel detector model" },
        @{ Left = 9.2; Top = 3.3; Width = 3.2; Height = 1.45; Fill = 0xEEF6F5; Title = "Worker 5"; Body = "Support policy + recommendations`rPolicy dataset, expiry mapping, upgrade options" }
    )

    foreach ($worker in $workers) {
        $card = Add-Box -Slide $Slide -Left (Inch $worker.Left) -Top (Inch $worker.Top) -Width (Inch $worker.Width) -Height (Inch $worker.Height) -FillColor $worker.Fill
        $card.Line.Visible = $msoFalse
        Add-TextBox -Slide $Slide -Left ((Inch $worker.Left) + (Inch 0.16)) -Top ((Inch $worker.Top) + (Inch 0.14)) -Width ((Inch $worker.Width) - (Inch 0.3)) -Height (Inch 0.28) -Text $worker.Title -FontName "Aptos Display" -FontSize 16 -Color $palette.Navy -Bold | Out-Null
        Add-TextBox -Slide $Slide -Left ((Inch $worker.Left) + (Inch 0.16)) -Top ((Inch $worker.Top) + (Inch 0.46)) -Width ((Inch $worker.Width) - (Inch 0.3)) -Height ((Inch $worker.Height) - (Inch 0.5)) -Text $worker.Body -FontSize 13 -Color $palette.Ink | Out-Null
    }

    Add-Bullets -Slide $Slide -Left (Inch 0.92) -Top (Inch 5.45) -Width (Inch 11.2) -Height (Inch 1.1) -Bullets @(
        "Worker 1 approves shared API and report model changes.",
        "Worker 3 owns the detector SPI; Worker 4 builds on it and does not fork it.",
        "Worker 5 consumes detector output only and should not add direct filesystem scanning."
    ) -FontSize 15 -Color $palette.Ink | Out-Null
}

Remove-IfExists -Path $OutputPath

$powerPoint = $null
$presentation = $null

try {
    $powerPoint = New-Object -ComObject PowerPoint.Application
    $powerPoint.Visible = $msoTrue
    $presentation = $powerPoint.Presentations.Add()
    $presentation.PageSetup.SlideSize = 16

    $slide1 = $presentation.Slides.Add(1, $ppLayoutBlank)
    $cover = Add-Box -Slide $slide1 -Left 0 -Top 0 -Width (Inch 13.333) -Height (Inch 7.5) -FillColor $palette.Navy
    $cover.Line.Visible = $msoFalse
    $hero = Add-Box -Slide $slide1 -Left (Inch 8.7) -Top (Inch -0.55) -Width (Inch 4.6) -Height (Inch 4.6) -FillColor $palette.Blue
    $hero.AutoShapeType = 9
    $hero.Fill.Transparency = 0.1
    $orb = Add-Box -Slide $slide1 -Left (Inch 9.3) -Top (Inch 4.7) -Width (Inch 2.6) -Height (Inch 2.6) -FillColor $palette.Teal
    $orb.AutoShapeType = 9
    $orb.Fill.Transparency = 0.2
    Add-TextBox -Slide $slide1 -Left (Inch 0.82) -Top (Inch 1.1) -Width (Inch 2.6) -Height (Inch 0.38) -Text "KICKOFF DECK" -FontName "Aptos Display" -FontSize 16 -Color $palette.Gold -Bold | Out-Null
    Add-TextBox -Slide $slide1 -Left (Inch 0.78) -Top (Inch 1.75) -Width (Inch 7.6) -Height (Inch 1.45) -Text "Migration Helper Build Plan" -FontName "Aptos Display" -FontSize 30 -Color $palette.White -Bold | Out-Null
    Add-TextBox -Slide $slide1 -Left (Inch 0.82) -Top (Inch 3.35) -Width (Inch 7.4) -Height (Inch 1.15) -Text "Build a web app that scans uploaded codebases, inventories technologies and versions, maps support expiry, and recommends upgrade paths with explainable evidence." -FontSize 19 -Color $palette.Mist | Out-Null
    Add-TextBox -Slide $slide1 -Left (Inch 0.82) -Top (Inch 5.8) -Width (Inch 4.6) -Height (Inch 0.35) -Text "Java backend • thin web UI • bundled support policy data" -FontSize 14 -Color $palette.Gold | Out-Null
    Add-MetricCard -Slide $slide1 -Left (Inch 0.82) -Top (Inch 6.35) -Width (Inch 1.9) -Height (Inch 0.75) -Label "PRIMARY FLOW" -Value "Upload → Report" -FillColor $palette.SoftBlue
    Add-MetricCard -Slide $slide1 -Left (Inch 2.95) -Top (Inch 6.35) -Width (Inch 1.9) -Height (Inch 0.75) -Label "V1 COVERAGE" -Value "Top Stacks" -FillColor $palette.SoftTeal
    Add-MetricCard -Slide $slide1 -Left (Inch 5.08) -Top (Inch 6.35) -Width (Inch 1.9) -Height (Inch 0.75) -Label "DELIVERY" -Value "Codex Workers" -FillColor $palette.SoftGold

    $slide2 = $presentation.Slides.Add(2, $ppLayoutBlank)
    Add-TwoColumnSlide -Slide $slide2 -Title "Why This Exists" -Subtitle "The kickoff goal is a first usable product, not an endless architecture exercise." -LeftHeader "What the tool must do" -LeftBullets @(
        "Accept an uploaded archive and a development-time local path.",
        "Detect technologies, runtimes, build tools, and key frameworks.",
        "Report current versions with evidence and confidence.",
        "Show support status, support expiry, and recommended upgrade targets."
    ) -RightHeader "Success criteria" -RightBullets @(
        "Readable report for every completed scan.",
        "No silent guessing for unknown or inherited versions.",
        "Alternative upgrade options beyond the recommended next step.",
        "Stable, testable lifecycle data shipped with the product."
    ) -AccentColor $palette.Blue

    $slide3 = $presentation.Slides.Add(3, $ppLayoutBlank)
    Add-TwoColumnSlide -Slide $slide3 -Title "Architecture Snapshot" -Subtitle "One service owns scanning and the UI stays intentionally thin." -LeftHeader "Backend responsibilities" -LeftBullets @(
        "Ingest and normalize uploaded sources into a temporary workspace.",
        "Run ecosystem detectors and build dependency graphs where deterministic.",
        "Map support-policy data and generate upgrade recommendations.",
        "Return a normalized JSON report and scan summary endpoints."
    ) -RightHeader "UI responsibilities" -RightBullets @(
        "Archive upload and scan session history.",
        "Summary cards for unsupported or expiring technologies.",
        "Filterable results table and detail drawer for evidence.",
        "JSON export for downstream analysis and sharing."
    ) -AccentColor $palette.Teal

    $slide4 = $presentation.Slides.Add(4, $ppLayoutBlank)
    Add-SectionSlide -Slide $slide4 -Title "Implementation Workstreams" -Body "The build is organized into parallel tracks with one shared contract at the center so Codex can move quickly without creating merge chaos." -AccentColor $palette.Blue

    $slide5 = $presentation.Slides.Add(5, $ppLayoutBlank)
    Add-RoadmapSlide -Slide $slide5

    $slide6 = $presentation.Slides.Add(6, $ppLayoutBlank)
    Add-WorkerSlide -Slide $slide6

    $slide7 = $presentation.Slides.Add(7, $ppLayoutBlank)
    Add-TwoColumnSlide -Slide $slide7 -Title "Guardrails and Handoffs" -Subtitle "The fastest path is crisp ownership plus disciplined integration points." -LeftHeader "Shared rules" -LeftBullets @(
        "Worker 1 is the final owner of API and report model changes.",
        "Worker 3 defines the detector SPI before Worker 4 expands ecosystem coverage.",
        "Worker 5 consumes detector output only and does not add direct scanning logic.",
        "Worker 6 builds UI against mocks first, then live endpoints."
    ) -RightHeader "Key risks to manage" -RightBullets @(
        "Version resolution gaps when manifests inherit or omit versions.",
        "False confidence from non-deterministic dependency graphs.",
        "Policy-data mismatches if lifecycle rules are not explicit.",
        "UI churn if the normalized report shape changes late."
    ) -AccentColor $palette.Gold

    $slide8 = $presentation.Slides.Add(8, $ppLayoutBlank)
    Add-TwoColumnSlide -Slide $slide8 -Title "Immediate Next Steps" -Subtitle "Milestone 1 should leave the team with a working, demoable scan flow." -LeftHeader "First sprint deliverables" -LeftBullets @(
        "Shared API/report contract and scan lifecycle model.",
        "Runnable Java app skeleton with static UI hosting.",
        "Archive ingestion, temp workspace normalization, and initial fixtures.",
        "Mock-backed upload UI and early report rendering."
    ) -RightHeader "Definition of done" -RightBullets @(
        "Upload an archive and complete a scan end to end.",
        "See detected technologies with evidence and confidence.",
        "View support status, support expiry, and recommended next version.",
        "Download the normalized JSON report for validation."
    ) -AccentColor $palette.Blue

    $presentation.SaveAs($OutputPath, $ppSaveAsOpenXMLPresentation)
    $presentation.Close()
    $powerPoint.Quit()
}
finally {
    if ($presentation -ne $null) {
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($presentation) | Out-Null
    }
    if ($powerPoint -ne $null) {
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($powerPoint) | Out-Null
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

Write-Output "Created $OutputPath"
