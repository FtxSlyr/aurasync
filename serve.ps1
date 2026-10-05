param(
    [int]$Port = 3000,
    [string]$Path = $PSScriptRoot
)

$cacheDir = Join-Path $Path "audio_cache"
if (!(Test-Path -Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
}

$ytDlpPath = Join-Path $Path "yt-dlp.exe"
if (!(Test-Path -Path $ytDlpPath)) {
    Write-Host "yt-dlp.exe not found. Downloading latest release..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile $ytDlpPath -UseBasicParsing
        Write-Host "yt-dlp.exe downloaded successfully." -ForegroundColor Green
    } catch {
        Write-Warning "Could not automatically download yt-dlp: $_"
    }
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host " AuraSync Local Engine Server Running" -ForegroundColor Cyan
    Write-Host " URL: $prefix" -ForegroundColor Yellow
    Write-Host " Cache: $cacheDir" -ForegroundColor Gray
    Write-Host "=============================================" -ForegroundColor Green
} catch {
    Write-Error "Could not start server on ${prefix} - $_"
    exit 1
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".mp3"  = "audio/mpeg"
    ".wav"  = "audio/wav"
    ".ogg"  = "audio/ogg"
    ".mp4"  = "video/mp4"
    ".webm" = "audio/webm"
}

function Add-CorsHeaders($response) {
    $response.AddHeader("Access-Control-Allow-Origin", "*")
    $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
    $response.AddHeader("Access-Control-Allow-Headers", "*")
    $response.AddHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
}

function Send-FileWithRange($context, $filePath, $mimeType) {
    $request = $context.Request
    $response = $context.Response
    
    Add-CorsHeaders $response
    $response.ContentType = $mimeType
    $response.AddHeader("Accept-Ranges", "bytes")

    $fileInfo = New-Object System.IO.FileInfo($filePath)
    $totalLength = $fileInfo.Length

    $rangeHeader = $request.Headers["Range"]
    $start = 0
    $end = $totalLength - 1
    $isRange = $false

    if ($rangeHeader -and $rangeHeader -match "bytes=(\d*)-(\d*)") {
        $isRange = $true
        if (![string]::IsNullOrEmpty($matches[1])) {
            $start = [int64]$matches[1]
        }
        if (![string]::IsNullOrEmpty($matches[2])) {
            $end = [int64]$matches[2]
        }
        if ($end -ge $totalLength) {
            $end = $totalLength - 1
        }
    }

    if ($start -gt $end -or $start -ge $totalLength) {
        $response.StatusCode = 416 # Range Not Satisfiable
        $response.AddHeader("Content-Range", "bytes */$totalLength")
        $response.Close()
        return
    }

    $contentLength = $end - $start + 1

    if ($isRange) {
        $response.StatusCode = 206
        $response.AddHeader("Content-Range", "bytes $start-$end/$totalLength")
    } else {
        $response.StatusCode = 200
    }

    $response.ContentLength64 = $contentLength

    if ($request.HttpMethod -eq "HEAD") {
        $response.Close()
        return
    }

    $fs = [System.IO.File]::OpenRead($filePath)
    try {
        if ($start -gt 0) {
            [void]$fs.Seek($start, [System.IO.SeekOrigin]::Begin)
        }

        $buffer = New-Object byte[] 65536
        $remaining = $contentLength
        while ($remaining -gt 0) {
            $toRead = [Math]::Min($remaining, [int64]$buffer.Length)
            $bytesRead = $fs.Read($buffer, 0, $toRead)
            if ($bytesRead -le 0) { break }
            $response.OutputStream.Write($buffer, 0, $bytesRead)
            $remaining -= $bytesRead
        }
    } finally {
        $fs.Close()
    }
    $response.Close()
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        if ($request.HttpMethod -eq "OPTIONS") {
            Add-CorsHeaders $response
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        $urlPath = $request.Url.LocalPath

        # Audio stream API endpoint
        if ($urlPath -eq "/api/audio") {
            $videoId = $request.QueryString["id"]
            if ([string]::IsNullOrWhiteSpace($videoId) -or $videoId -notmatch '^[a-zA-Z0-9_\-]+$') {
                $response.StatusCode = 400
                Add-CorsHeaders $response
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("Invalid or missing video ID")
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            $cachedAudio = Join-Path $cacheDir "$videoId.webm"
            if (!(Test-Path -Path $cachedAudio)) {
                Write-Host "Extracting direct audio for YouTube video: $videoId" -ForegroundColor Cyan
                if (Test-Path -Path $ytDlpPath) {
                    $dlProc = Start-Process -FilePath $ytDlpPath -ArgumentList "-f", "ba/b", "-o", "`"$cachedAudio`"", "`"https://www.youtube.com/watch?v=$videoId`"" -NoNewWindow -PassThru -Wait
                    if ($dlProc.ExitCode -ne 0) {
                        Write-Host "yt-dlp extraction failed with code $($dlProc.ExitCode)" -ForegroundColor Red
                    }
                }
            }

            if (Test-Path -Path $cachedAudio) {
                Send-FileWithRange $context $cachedAudio "audio/webm"
            } else {
                $response.StatusCode = 502
                Add-CorsHeaders $response
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Failed to extract YouTube audio stream")
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                $response.Close()
            }
            continue
        }

        # Status check API endpoint
        if ($urlPath -eq "/api/status") {
            $videoId = $request.QueryString["id"]
            $isReady = $false
            if (![string]::IsNullOrWhiteSpace($videoId)) {
                $cachedAudio = Join-Path $cacheDir "$videoId.webm"
                $isReady = (Test-Path -Path $cachedAudio)
            }
            Add-CorsHeaders $response
            $response.ContentType = "application/json"
            $jsonStr = @{ ready = $isReady; videoId = $videoId } | ConvertTo-Json
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # Thumbnail proxy API endpoint
        if ($urlPath -eq "/api/thumbnail") {
            $videoId = $request.QueryString["id"]
            if ([string]::IsNullOrWhiteSpace($videoId) -or $videoId -notmatch '^[a-zA-Z0-9_\-]+$') {
                $response.StatusCode = 400
                Add-CorsHeaders $response
                $response.Close()
                continue
            }
            $cachedThumb = Join-Path $cacheDir "$videoId.jpg"
            if (!(Test-Path -Path $cachedThumb)) {
                try {
                    $urls = @(
                        "https://img.youtube.com/vi/$videoId/maxresdefault.jpg",
                        "https://img.youtube.com/vi/$videoId/hqdefault.jpg"
                    )
                    foreach ($u in $urls) {
                        try {
                            Invoke-WebRequest -Uri $u -OutFile $cachedThumb -TimeoutSec 4 -ErrorAction Stop
                            if ((Get-Item $cachedThumb).Length -gt 1500) { break }
                        } catch {}
                    }
                } catch {}
            }
            if (Test-Path -Path $cachedThumb) {
                Send-FileWithRange $context $cachedThumb "image/jpeg"
            } else {
                $response.StatusCode = 404
                Add-CorsHeaders $response
                $response.Close()
            }
            continue
        }

        # Spotify Audio stream API endpoint
        if ($urlPath -eq "/api/spotify") {
            $trackId = $request.QueryString["id"]
            $title = $request.QueryString["title"]
            if ([string]::IsNullOrWhiteSpace($trackId) -or $trackId -notmatch '^[a-zA-Z0-9_\-]+$') {
                $response.StatusCode = 400
                Add-CorsHeaders $response
                $response.Close()
                continue
            }

            $cachedAudio = Join-Path $cacheDir "sp_$trackId.webm"
            if (!(Test-Path -Path $cachedAudio)) {
                $searchQuery = if (![string]::IsNullOrWhiteSpace($title)) { $title } else {
                    try {
                        $spData = Invoke-RestMethod -Uri "https://open.spotify.com/oembed?url=https://open.spotify.com/track/$trackId" -TimeoutSec 4
                        $spData.title
                    } catch { $trackId }
                }
                Write-Host "Extracting audio for Spotify track: $searchQuery" -ForegroundColor Cyan
                if (Test-Path -Path $ytDlpPath) {
                    $dlProc = Start-Process -FilePath $ytDlpPath -ArgumentList "-f", "ba/b", "-o", "`"$cachedAudio`"", "`"ytsearch1:$searchQuery`"" -NoNewWindow -PassThru -Wait
                    if ($dlProc.ExitCode -ne 0) {
                        Write-Host "yt-dlp spotify extraction failed with code $($dlProc.ExitCode)" -ForegroundColor Red
                    }
                }
            }

            if (Test-Path -Path $cachedAudio) {
                Send-FileWithRange $context $cachedAudio "audio/webm"
            } else {
                $response.StatusCode = 502
                Add-CorsHeaders $response
                $response.Close()
            }
            continue
        }

        # Static file handling
        if ($urlPath -eq "/" -or [string]::IsNullOrWhiteSpace($urlPath)) {
            $urlPath = "/index.html"
        }

        $localFilePath = Join-Path $Path ($urlPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar))

        if (Test-Path -Path $localFilePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localFilePath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            Send-FileWithRange $context $localFilePath $mime
        } else {
            $response.StatusCode = 404
            Add-CorsHeaders $response
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found")
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
            $response.Close()
        }
    } catch {
        # continue on connection reset or abort
    }
}
