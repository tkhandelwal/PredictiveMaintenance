# Backend cleanup
Remove-Item -Path ".\API\Models\EquipmentTypes.cs" -Force

# Frontend cleanup
Remove-Item -Path ".\ClientApp\src\app\app.module.ts" -Force

Write-Host "Cleanup completed. Now run:"
Write-Host "1. dotnet ef migrations add FixModels"
Write-Host "2. dotnet ef database update"
Write-Host "3. npm install"
Write-Host "4. ng build"