# Face Authentication Demo

## Requirements

Install Docker Desktop (Windows/macOS) or Docker Engine (Linux)

<https://www.docker.com/products/docker-desktop>

## Run the system

docker compose up --build

## Open the application

<https://localhost:5173>

The browser will show a certificate warning because a self-signed SSL certificate is used for development.

Click **Advanced → Proceed to localhost**.

## Architecture

Frontend (Vite) → <https://localhost:5173>
Backend (Express) → <http://localhost:3000>
Liveness Detection (FastAPI sidecar) → <http://localhost:8000>
