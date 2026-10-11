# Octane Systems - Docker Deployment & Client Handover Guide

This guide details how to package, deploy, run, and manage Octane Systems for your client using Docker and Docker Compose.

---

## 1. Architecture Overview

Octane Systems runs via 3 coordinated production containers:
1. **`octane_db`** (`postgres:16-alpine`): Secure database with persistent data volume.
2. **`octane_backend`** (`python:3.12-slim` + `gunicorn`): Django REST API, executes migrations automatically on startup.
3. **`octane_frontend`** (`nginx:alpine`): Serves the compiled React Vite SPA and acts as reverse proxy routing `/api/` and `/admin/` to Gunicorn without CORS issues.

---

## 2. Prerequisites on Client Server or PC

* Install **Docker** and **Docker Compose**:
  * **Windows**: Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) (Enable WSL2 backend).
  * **Linux (Ubuntu VPS)**: 
    ```bash
    sudo apt update
    sudo apt install -y docker.io docker-compose-v2
    sudo systemctl enable --now docker
    ```

---

## 3. First-Time Setup & Launch

### Step 1: Copy Project Files to the Target Machine
Copy the repository to the client machine (e.g. `C:\OctaneSystems` or `/opt/octane-systems`).

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `copy .env.example .env`)*

Open `.env` and set secure passwords:
```env
PORT=80
POSTGRES_DB=octane_systems
POSTGRES_USER=octane_user
POSTGRES_PASSWORD=YourStrongPasswordHere!
SECRET_KEY=generate-a-secure-random-key-here
```

### Step 3: Build & Start All Containers
Run the following command from the project root:
```bash
docker compose up -d --build
```
*Docker will automatically build the React production bundle, install Python dependencies, start PostgreSQL, run all database migrations, collect static files, and start Nginx.*

### Step 4: Verify Services are Running
```bash
docker compose ps
```
You should see:
* `octane_db` (healthy)
* `octane_backend` (running)
* `octane_frontend` (running on port 80)

---

## 4. Create the First Admin Account

After starting the containers for the first time, run this command to create your client's administrative user:

```bash
docker compose exec backend python manage.py createsuperuser
```
Follow the interactive prompt to set:
* **Username**: `admin`
* **Email**: `admin@clientstore.com`
* **Password**: `YourSecureAdminPass`

Now your client can open their browser and navigate to:
* **Web POS / ERP**: `http://localhost` (or the server's local IP / domain)
* **Admin Backend Portal**: `http://localhost/admin`

---

## 5. 1-Click Client Launchers (No Terminal Needed!)

For non-technical clients, 6 ready-to-use double-clickable `.bat` files are provided in the root folder:

| File | What It Does When Double-Clicked |
|---|---|
| **`START_OCTANE.bat`** | Starts Docker Desktop (if closed), boots all services, and opens the POS at `http://localhost:8080`. |
| **`STOP_OCTANE.bat`** | Safely stops all containers and background services. |
| **`RESTART_OCTANE.bat`** | Restarts all containers and refreshes the browser. |
| **`BACKUP_OCTANE.bat`** | Generates a timestamped full database snapshot into the `backups/` folder. |
| **`RESTORE_BACKUP.bat`** | Lists available backup files and restores the selected backup with 1 click. |
| **`UPDATE_OCTANE.bat`** | Pulls latest code from GitHub and automatically rebuilds containers. |

> **Pro-Tip**: You can create Desktop Shortcuts for **`START_OCTANE.bat`** and **`BACKUP_OCTANE.bat`** right on the client's Windows desktop so they never need to look at folders or command prompts!

---

## 6. Manual Terminal Commands (For Developers)

If you prefer using the terminal directly:
* **Start**: `docker compose up -d`
* **Stop**: `docker compose down`
* **Restart**: `docker compose restart`
* **Logs**: `docker compose logs -f`
* **Manual Backup**:
  ```powershell
  docker compose exec -T db pg_dump -U octane_user octane_systems > backups\manual_backup.sql
  ```


---

## 7. How to Deploy Updates in the Future

When you make changes, add features, or push bug fixes, updating the client's deployment takes just 2 commands:

```bash
git pull
docker compose up -d --build
```
* Docker rebuilds the changed components.
* Migrations run automatically.
* Zero downtime for PostgreSQL.
* Existing database data is 100% preserved.

---

## 8. Network Access Options

### Option A: Local Store Wi-Fi / LAN (On-Premises)
If the shop has multiple POS counters, PCs, or tablets connected to the same Wi-Fi router:
1. Find the IP of the host machine (e.g. `192.168.1.100` via `ipconfig` or `ip a`).
2. Any device on that Wi-Fi can open:
   `http://192.168.1.100`

### Option B: Cloud VPS with Custom Domain & SSL (HTTPS)
If deployed on Ubuntu VPS (DigitalOcean, Hetzner, AWS) with a domain name (e.g. `pos.myclient.com`):
1. In `.env`, set:
   ```env
   ALLOWED_HOSTS=pos.myclient.com,localhost
   CSRF_TRUSTED_ORIGINS=https://pos.myclient.com
   ```
2. You can install **Certbot** with Nginx on the host, or run an Nginx-Proxy companion container to get free auto-renewing SSL certificates.
