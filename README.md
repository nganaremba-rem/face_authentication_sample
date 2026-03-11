# 🧑‍💻 Face Authentication Demo

顔認証デモ

---

# 📋 Requirements

必要な環境

## 1️⃣ Install Docker

Docker をインストールしてください。

Install **Docker Desktop** for Windows/macOS or **Docker Engine** for Linux.  
Windows / macOS の場合は **Docker Desktop**、Linux の場合は **Docker Engine** をインストールしてください。

<https://www.docker.com/products/docker-desktop>

---

## 2️⃣ Install Git

Git をインストールしてください。

Git is required to clone the project repository.  
プロジェクトのリポジトリをクローンするために Git が必要です。

<https://git-scm.com/install/>

---

# 🚀 Run the System

システムの実行方法

---

## 📥 Clone the Repository

リポジトリをクローンする

```bash
git clone https://github.com/nganaremba-rem/face_authentication_sample.git
```

Clone the project repository from GitHub.  
GitHub からプロジェクトのリポジトリをクローンします。

---

## 📂 Go to the Project Folder

プロジェクトフォルダに移動する

```bash
cd face_authentication_sample
```

Move into the cloned project directory.  
クローンしたプロジェクトディレクトリに移動します。

---

## 🏗️ Build the Docker Images

Docker イメージをビルドする

```bash
docker compose build --no-cache
```

Builds all required Docker images.  
必要なすべての Docker イメージをビルドします。

`--no-cache` forces Docker to rebuild everything from scratch.  
`--no-cache` オプションはキャッシュを使用せず、すべてを最初からビルドします。

---

## ▶️ Start the Containers

コンテナを起動する

```bash
docker compose up -d
```

Starts all containers in the background.  
すべてのコンテナをバックグラウンドで起動します。

---

# 🛠️ Helpful Commands

便利なコマンド

---

## ⛔ Stop the System

システムを停止する

```bash
docker compose down
```

Stops and removes the running containers.  
実行中のコンテナを停止し、削除します。

---

## 🔄 Restart the System

システムを再起動する

```bash
docker compose down
docker compose up
```

Stops the containers and then starts them again.  
コンテナを停止した後、再度起動します。

---

# 🌐 Open the Application

アプリケーションを開く

<https://localhost:5173>

Open this URL in your web browser.  
この URL をブラウザで開いてください。

---

⚠️ The browser may show a certificate warning because a **self-signed SSL certificate** is used for development.  
開発用の **自己署名 SSL 証明書** を使用しているため、ブラウザに証明書の警告が表示される場合があります。

Click:

```
Advanced → Proceed to localhost
```

「Advanced（詳細）」→「Proceed to localhost」をクリックしてください。

---

# 🏗️ System Architecture

システム構成

```
Frontend (Vite) → https://localhost:5173
Backend (Express) → http://localhost:3000
Liveness Detection (FastAPI sidecar) → http://localhost:8000
```

Frontend (Vite) handles the user interface.  
フロントエンド（Vite）はユーザーインターフェースを担当します。

Backend (Express) handles authentication logic.  
バックエンド（Express）は認証ロジックを処理します。

FastAPI sidecar handles liveness detection.  
FastAPI サイドカーはライブネス検知を処理します。

---
