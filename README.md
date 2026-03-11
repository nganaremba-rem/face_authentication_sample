# Face Authentication Demo

## Requirements

Install Docker and Docker Compose.

## Run the system

docker compose up --build

## Open the application

<https://localhost:5173>

The browser will show a certificate warning because a self-signed SSL certificate is used for development.

Click **Advanced → Proceed to localhost**.

## Architecture

Frontend (Vite) → <https://localhost:5173>
Backend (Express) → <http://backend:3000>
Liveness Detection (FastAPI sidecar) → <http://liveness:8000>
