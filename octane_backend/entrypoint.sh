#!/bin/sh
set -e

echo "=========================================================="
echo " Starting Octane Systems Backend Service"
echo "=========================================================="

if [ "$USE_POSTGRES" = "true" ]; then
    echo "[*] Waiting for PostgreSQL database at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
    python - <<END
import socket, time, os, sys
host = os.environ.get('POSTGRES_HOST', 'db')
port = int(os.environ.get('POSTGRES_PORT', 5432))
for attempt in range(60):
    try:
        s = socket.create_connection((host, port), timeout=2)
        s.close()
        print(f"[+] PostgreSQL connection established on {host}:{port}")
        sys.exit(0)
    except OSError:
        time.sleep(1)
print(f"[!] Timed out waiting for PostgreSQL on {host}:{port}")
sys.exit(1)
END
fi

echo "[*] Applying database migrations..."
python manage.py migrate --noinput

echo "[*] Collecting static files..."
python manage.py collectstatic --noinput --clear || true

echo "[+] Starting Gunicorn application server..."
exec "$@"
