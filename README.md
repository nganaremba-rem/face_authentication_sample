# Face Authentication Demo

## Requirements

1. Install Docker Desktop (Windows/macOS) or Docker Engine (Linux)

<https://www.docker.com/products/docker-desktop>

1. Git
   <https://git-scm.com/install/>

## Run the system

### Clone the Repository

```git
git clone https://github.com/nganaremba-rem/face_authentication_sample.git
```

### Go inside the face_authentication_sample folder

```bash
cd face_authentication_sample

```

### Build the docker image

```bash
docker compose build --no-cache
```

### Start up the docker containers

```bash
docker compose up -d

```

### To stop

```bash
docker compose down
```

### To restart

```bash
docker compose down
docker compose up
```

## Open the application

<https://localhost:5173>

The browser will show a certificate warning because a self-signed SSL certificate is used for development.

Click **Advanced → Proceed to localhost**.

## Architecture

Frontend (Vite) → <https://localhost:5173>
Backend (Express) → <http://localhost:3000>
Liveness Detection (FastAPI sidecar) → <http://localhost:8000>
