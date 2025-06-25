@echo off
set TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODM4ZTFiYjM0ZjQ2MjFkNmRmNmUzZTMiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6Im1hbmFnZXIiLCJpYXQiOjE3NDg3MzAwMjQsImV4cCI6MTc0ODc1ODgyNH0.ipPaeD0csQ_xcWdrpdsxikHaGr-SUER52baVs5emcZM

:: مدير
curl -X POST https://player-cards-server.onrender.com/api/users ^
 -H "Authorization: Bearer %TOKEN%" ^
 -H "Content-Type: application/json" ^
 -d "{\"username\": \"ali.khlaf\", \"password\": \"ali00774411\", \"role\": \"manager\"}"

:: مشرفين
curl -X POST https://player-cards-server.onrender.com/api/users ^
 -H "Authorization: Bearer %TOKEN%" ^
 -H "Content-Type: application/json" ^
 -d "{\"username\": \"AhmedHazem\", \"password\": \"aa00774411\", \"role\": \"supervisor\"}"

curl -X POST https://player-cards-server.onrender.com/api/users ^
 -H "Authorization: Bearer %TOKEN%" ^
 -H "Content-Type: application/json" ^
 -d "{\"username\": \"AbdullahAmeen\", \"password\": \"aa00774411\", \"role\": \"supervisor\"}"

curl -X POST https://player-cards-server.onrender.com/api/users ^
 -H "Authorization: Bearer %TOKEN%" ^
 -H "Content-Type: application/json" ^
 -d "{\"username\": \"AliAdham\", \"password\": \"aa00774411\", \"role\": \"supervisor\"}"

curl -X POST https://player-cards-server.onrender.com/api/users ^
 -H "Authorization: Bearer %TOKEN%" ^
 -H "Content-Type: application/json" ^
 -d "{\"username\": \"AbuFatema\", \"password\": \"aa00774411\", \"role\": \"supervisor\"}"

curl -X POST https://player-cards-server.onrender.com/api/users ^
 -H "Authorization: Bearer %TOKEN%" ^
 -H "Content-Type: application/json" ^
 -d "{\"username\": \"Amer.adham\", \"password\": \"aa00774411\", \"role\": \"supervisor\"}"

curl -X POST https://player-cards-server.onrender.com/api/users ^
 -H "Authorization: Bearer %TOKEN%" ^
 -H "Content-Type: application/json" ^
 -d "{\"username\": \"khalf.muhammad\", \"password\": \"aa00774411\", \"role\": \"supervisor\"}"

pause
