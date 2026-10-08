$ErrorActionPreference = 'Stop'
$settings = New-Object System.Xml.XmlReaderSettings
$settings.ValidationType = [System.Xml.ValidationType]::Schema
$schemaPath = Join-Path $PSScriptRoot '..\tests\gpx.xsd'
$null = $settings.Schemas.Add('http://www.topografix.com/GPX/1/1', $schemaPath)
$settings.add_ValidationEventHandler({ param($sender, $e) throw $e.Message })
$gpxPath = Join-Path $PSScriptRoot '..\outputs\roundtrip.gpx'
$reader = [System.Xml.XmlReader]::Create($gpxPath, $settings)
try { while ($reader.Read()) {} } finally { $reader.Close() }
Write-Output 'GPX 1.1 XSD validation passed.'
