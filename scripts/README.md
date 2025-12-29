# Development Scripts

## Setup Script (setup.sh / setup.ps1)

### PowerShell Version (setup.ps1)
```powershell
#!/usr/bin/env pwsh

Write-Host "Setting up VisionSea MCP Host development environment..." -ForegroundColor Green

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not in PATH"
    exit 1
}

# Check Docker Compose
if (!(Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Error "Docker Compose is not installed or not in PATH"
    exit 1
}

# Create environment files
Write-Host "Creating environment files..." -ForegroundColor Yellow

if (!(Test-Path "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "Created backend\.env from template" -ForegroundColor Green
}

if (!(Test-Path "frontend\.env")) {
    Copy-Item "frontend\.env.example" "frontend\.env"
    Write-Host "Created frontend\.env from template" -ForegroundColor Green
}

# Build and start development environment
Write-Host "Building and starting development environment..." -ForegroundColor Yellow
Set-Location docker
docker-compose -f docker-compose.dev.yml up --build -d

Write-Host "Development environment is ready!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
```

## Development Script (dev.sh / dev.ps1)

### PowerShell Version (dev.ps1)
```powershell
#!/usr/bin/env pwsh

param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Logs,
    [switch]$Clean
)

Set-Location $PSScriptRoot\..\docker

if ($Stop) {
    Write-Host "Stopping development environment..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml down
}
elseif ($Restart) {
    Write-Host "Restarting development environment..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.dev.yml up -d
}
elseif ($Logs) {
    docker-compose -f docker-compose.dev.yml logs -f
}
elseif ($Clean) {
    Write-Host "Cleaning development environment..." -ForegroundColor Red
    docker-compose -f docker-compose.dev.yml down -v --remove-orphans
    docker system prune -f
}
else {
    Write-Host "Starting development environment..." -ForegroundColor Green
    docker-compose -f docker-compose.dev.yml up -d
    
    Write-Host "Development environment is running!" -ForegroundColor Green
    Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
}
```

## Build Script (build.sh / build.ps1)

### PowerShell Version (build.ps1)
```powershell
#!/usr/bin/env pwsh

param(
    [string]$Environment = "production",
    [switch]$Push,
    [string]$Registry = "",
    [string]$Tag = "latest"
)

Write-Host "Building VisionSea MCP Host for $Environment..." -ForegroundColor Green

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
docker build -t "visionsea-frontend:$Tag" ./frontend --target $Environment

# Build backend  
Write-Host "Building backend..." -ForegroundColor Yellow
docker build -t "visionsea-backend:$Tag" ./backend --target $Environment

if ($Push -and $Registry) {
    Write-Host "Pushing images to registry..." -ForegroundColor Yellow
    
    docker tag "visionsea-frontend:$Tag" "$Registry/visionsea-frontend:$Tag"
    docker tag "visionsea-backend:$Tag" "$Registry/visionsea-backend:$Tag"
    
    docker push "$Registry/visionsea-frontend:$Tag"
    docker push "$Registry/visionsea-backend:$Tag"
    
    Write-Host "Images pushed successfully!" -ForegroundColor Green
}

Write-Host "Build completed!" -ForegroundColor Green
```

## Test Script (test.sh / test.ps1)

### PowerShell Version (test.ps1)
```powershell
#!/usr/bin/env pwsh

param(
    [string]$Service = "all",
    [switch]$Coverage,
    [switch]$Watch
)

Write-Host "Running tests for VisionSea MCP Host..." -ForegroundColor Green

if ($Service -eq "all" -or $Service -eq "backend") {
    Write-Host "Running backend tests..." -ForegroundColor Yellow
    Set-Location backend
    
    if ($Coverage) {
        pytest --cov=app --cov-report=html --cov-report=term
    }
    elseif ($Watch) {
        pytest-watch
    }
    else {
        pytest
    }
    
    Set-Location ..
}

if ($Service -eq "all" -or $Service -eq "frontend") {
    Write-Host "Running frontend tests..." -ForegroundColor Yellow
    Set-Location frontend
    
    if ($Coverage) {
        npm run test:coverage
    }
    elseif ($Watch) {
        npm run test:watch
    }
    else {
        npm test
    }
    
    Set-Location ..
}

Write-Host "Tests completed!" -ForegroundColor Green
```