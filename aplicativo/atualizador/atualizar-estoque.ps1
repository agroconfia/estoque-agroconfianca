Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$AppRoot = Split-Path -Parent $PSScriptRoot
$ProjectRoot = Split-Path -Parent $AppRoot
$DefaultSpreadsheet = Join-Path $ProjectRoot 'Fatu4184.XLS'
$Importer = Join-Path $AppRoot 'scripts\inventory-importer.mjs'
$Inventory = Join-Path $AppRoot 'app\data\inventory.json'
$Metadata = Join-Path $AppRoot 'app\data\inventory-meta.json'
$script:SelectedFile = $DefaultSpreadsheet
$script:Preview = $null

function Find-Executable([string]$Name, [string]$Fallback) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    if (Test-Path -LiteralPath $Fallback) { return $Fallback }
    return $null
}

$Node = Find-Executable 'node.exe' (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
$Npm = Find-Executable 'npm.cmd' (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\npm.cmd')
$Git = Find-Executable 'git.exe' (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe')

function Invoke-App([string]$Executable, [string[]]$Arguments, [string]$WorkingDirectory = $AppRoot) {
    Push-Location $WorkingDirectory
    try {
        $output = & $Executable @Arguments 2>&1 | Out-String
        return [PSCustomObject]@{ ExitCode = $LASTEXITCODE; Output = $output.Trim() }
    }
    finally { Pop-Location }
}

function Analyze-Spreadsheet {
    if (-not (Test-Path -LiteralPath $script:SelectedFile)) {
        [System.Windows.Forms.MessageBox]::Show('Não encontrei Fatu4184.XLS na pasta do projeto.', 'Planilha não encontrada', 'OK', 'Warning') | Out-Null
        return
    }
    $temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("estoque-preview-{0}.json" -f [guid]::NewGuid())
    $result = Invoke-App $Node @($Importer, 'preview', '--file', $script:SelectedFile, '--output', $temporary, '--inventory', $Inventory, '--metadata', $Metadata)
    if ($result.ExitCode -ne 0) {
        [System.Windows.Forms.MessageBox]::Show($result.Output, 'Não foi possível ler a planilha', 'OK', 'Error') | Out-Null
        return
    }
    $script:Preview = Get-Content -Raw -LiteralPath $temporary | ConvertFrom-Json
    Remove-Item -LiteralPath $temporary -Force
    $lineBreak = [Environment]::NewLine
    $culture = [System.Globalization.CultureInfo]::GetCultureInfo('pt-BR')
    $totalStock = [string]::Format($culture, '{0:N2}', [decimal]$script:Preview.totalStock)
    $summaryLines = @(
        'ARQUIVO ANALISADO'
        ('  Nome:                 {0}' -f [System.IO.Path]::GetFileName($script:SelectedFile))
        ('  Data de referência:   {0}' -f $script:Preview.referenceDate.next)
        ''
        'RESUMO DO ESTOQUE'
        ('  Produtos:             {0}' -f $script:Preview.counts.next)
        ('  Com saldo:            {0}' -f $script:Preview.counts.positive)
        ('  Zerados:              {0}' -f $script:Preview.counts.zero)
        ('  Negativos:            {0}' -f $script:Preview.counts.negative)
        ('  Estoque Físico total: {0}  (PCNR+)' -f $totalStock)
        ''
        'ALTERAÇÕES DESTA ATUALIZAÇÃO'
        ('  Incluídos:            {0}' -f $script:Preview.counts.added)
        ('  Alterados:            {0}' -f $script:Preview.counts.changed)
        ('  Removidos:            {0}' -f $script:Preview.counts.removed)
        ('  Sem alteração:        {0}' -f $script:Preview.counts.unchanged)
    )
    if ($script:Preview.warnings.Count) {
        $summaryLines += ''
        $summaryLines += 'ATENÇÃO'
        $summaryLines += $script:Preview.warnings | ForEach-Object { '  - ' + $_ }
    }
    $summary.Text = [string]::Join($lineBreak, $summaryLines)
    $publishButton.Enabled = [bool]$script:Preview.hasChanges
    $status.Text = if ($script:Preview.hasChanges) { 'Análise concluída. Confira o resumo e publique.' } else { 'A planilha já está publicada sem alterações.' }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Atualizar Estoque - AgroConfiança'
$form.Size = New-Object System.Drawing.Size(720, 560)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(246, 247, 242)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Atualizar Consulta de Estoque'
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 18)
$title.ForeColor = [System.Drawing.Color]::FromArgb(7, 92, 45)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(28, 22)
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Use a planilha Fatu4184.XLS, confira as mudanças e publique no site.'
$subtitle.AutoSize = $true
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(92, 108, 98)
$subtitle.Location = New-Object System.Drawing.Point(31, 62)
$form.Controls.Add($subtitle)

$analyzeButton = New-Object System.Windows.Forms.Button
$analyzeButton.Text = '1. Analisar Fatu4184.XLS'
$analyzeButton.Size = New-Object System.Drawing.Size(245, 42)
$analyzeButton.Location = New-Object System.Drawing.Point(32, 100)
$analyzeButton.BackColor = [System.Drawing.Color]::FromArgb(7, 92, 45)
$analyzeButton.ForeColor = [System.Drawing.Color]::White
$analyzeButton.FlatStyle = 'Flat'
$analyzeButton.FlatAppearance.BorderSize = 0
$form.Controls.Add($analyzeButton)

$chooseButton = New-Object System.Windows.Forms.Button
$chooseButton.Text = 'Escolher outro arquivo'
$chooseButton.Size = New-Object System.Drawing.Size(175, 42)
$chooseButton.Location = New-Object System.Drawing.Point(288, 100)
$form.Controls.Add($chooseButton)

$publishButton = New-Object System.Windows.Forms.Button
$publishButton.Text = '2. Confirmar e publicar'
$publishButton.Size = New-Object System.Drawing.Size(205, 42)
$publishButton.Location = New-Object System.Drawing.Point(474, 100)
$publishButton.BackColor = [System.Drawing.Color]::FromArgb(169, 207, 56)
$publishButton.ForeColor = [System.Drawing.Color]::FromArgb(7, 72, 32)
$publishButton.FlatStyle = 'Flat'
$publishButton.FlatAppearance.BorderSize = 0
$publishButton.Enabled = $false
$form.Controls.Add($publishButton)

$summary = New-Object System.Windows.Forms.TextBox
$summary.Multiline = $true
$summary.ReadOnly = $true
$summary.ScrollBars = 'Vertical'
$summary.WordWrap = $true
$summary.Font = New-Object System.Drawing.Font('Consolas', 10)
$summary.BackColor = [System.Drawing.Color]::White
$summary.Location = New-Object System.Drawing.Point(32, 160)
$summary.Size = New-Object System.Drawing.Size(647, 300)
$summary.Text = "Clique em 'Analisar Fatu4184.XLS' para conferir a atualização antes de publicar."
$form.Controls.Add($summary)

$status = New-Object System.Windows.Forms.Label
$status.Text = 'Pronto para analisar.'
$status.AutoSize = $false
$status.Size = New-Object System.Drawing.Size(647, 42)
$status.Location = New-Object System.Drawing.Point(32, 480)
$status.ForeColor = [System.Drawing.Color]::FromArgb(92, 108, 98)
$form.Controls.Add($status)

$analyzeButton.Add_Click({
    if (-not $Node -or -not $Npm -or -not $Git) {
        [System.Windows.Forms.MessageBox]::Show('Não encontrei Node.js, npm ou Git neste computador.', 'Dependência ausente', 'OK', 'Error') | Out-Null
        return
    }
    Analyze-Spreadsheet
})

$chooseButton.Add_Click({
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Selecione o relatório de estoque'
    $dialog.Filter = 'Planilhas do Excel (*.xls;*.xlsx)|*.xls;*.xlsx'
    if ($dialog.ShowDialog() -eq 'OK') {
        $script:SelectedFile = $dialog.FileName
        $script:Preview = $null
        $publishButton.Enabled = $false
        Analyze-Spreadsheet
    }
})

$publishButton.Add_Click({
    $confirmation = [System.Windows.Forms.MessageBox]::Show('Publicar esta planilha no site? O histórico anterior continuará disponível no Git.', 'Confirmar publicação', 'YesNo', 'Question')
    if ($confirmation -ne 'Yes') { return }
    $publishButton.Enabled = $false
    $status.Text = 'Atualizando os dados e testando o site...'
    [System.Windows.Forms.Application]::DoEvents()
    $temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("estoque-apply-{0}.json" -f [guid]::NewGuid())
    $apply = Invoke-App $Node @($Importer, 'apply', '--file', $script:SelectedFile, '--output', $temporary, '--inventory', $Inventory, '--metadata', $Metadata, '--expected-sha256', $script:Preview.source.sha256)
    if ($apply.ExitCode -ne 0) {
        [System.Windows.Forms.MessageBox]::Show($apply.Output, 'Falha na atualização', 'OK', 'Error') | Out-Null
        $publishButton.Enabled = $true
        return
    }
    Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
    if ((Resolve-Path -LiteralPath $script:SelectedFile).Path -ne (Resolve-Path -LiteralPath $DefaultSpreadsheet).Path) {
        Copy-Item -LiteralPath $script:SelectedFile -Destination $DefaultSpreadsheet -Force
    }
    $build = Invoke-App $Npm @('test')
    if ($build.ExitCode -ne 0) {
        [System.Windows.Forms.MessageBox]::Show($build.Output, 'Os testes do site falharam', 'OK', 'Error') | Out-Null
        $publishButton.Enabled = $true
        return
    }
    $add = Invoke-App $Git @('add', 'Fatu4184.XLS', 'aplicativo/app/data/inventory.json', 'aplicativo/app/data/inventory-meta.json') $ProjectRoot
    $commit = Invoke-App $Git @('commit', '-m', "Atualiza estoque $($script:Preview.referenceDate.next)") $ProjectRoot
    if ($commit.ExitCode -ne 0) {
        [System.Windows.Forms.MessageBox]::Show($commit.Output, 'Falha ao registrar a atualização', 'OK', 'Error') | Out-Null
        $publishButton.Enabled = $true
        return
    }
    $push = Invoke-App $Git @('push', 'origin', 'main') $ProjectRoot
    if ($push.ExitCode -ne 0) {
        [System.Windows.Forms.MessageBox]::Show("Os dados foram salvos e registrados, mas o envio ao GitHub falhou.`r`n`r`n$($push.Output)", 'Publicação pendente', 'OK', 'Warning') | Out-Null
        $status.Text = 'Atualização salva. Envio ao GitHub pendente.'
        return
    }
    $status.Text = 'Publicado com sucesso. O GitHub Pages será atualizado em alguns minutos.'
    [System.Windows.Forms.MessageBox]::Show('Estoque publicado com sucesso.', 'Concluído', 'OK', 'Information') | Out-Null
})

[void]$form.ShowDialog()
