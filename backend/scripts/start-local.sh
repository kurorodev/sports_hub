#!/usr/bin/env bash
set -euo pipefail

task_project="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$task_project"

task_skip_build=false
case "${1:-}" in
  '') ;;
  --skip-build) task_skip_build=true ;;
  *) printf 'Использование: bash %s [--skip-build]\n' "$0" >&2; exit 2 ;;
esac
if [[ "$#" -gt 1 ]]; then
  printf 'Ожидается не более одного аргумента.\n' >&2
  exit 2
fi

for task_command in mvn python3 docker; do
  if ! command -v "$task_command" >/dev/null 2>&1; then
    printf 'Не найдена команда: %s. Сначала выполните scripts/install-debian.sh.\n' "$task_command" >&2
    exit 1
  fi
done

if ! docker compose version; then
  printf 'Нужен Docker Compose v2.\n' >&2
  exit 1
fi

task_docker=(docker)
task_docker_version="$(docker info --format '{{.ServerVersion}}' 2>/dev/null || true)"
if [[ -z "$task_docker_version" ]]; then
  if [[ "$EUID" -eq 0 ]] || ! command -v sudo >/dev/null 2>&1; then
    printf 'Нет соединения с Docker daemon. Проверьте службу Docker.\n' >&2
    exit 1
  fi
  printf 'Проверяю Docker с sudo; пароль вводится только в терминале.\n'
  task_docker=(sudo docker)
  task_docker_version="$("${task_docker[@]}" info --format '{{.ServerVersion}}')"
  if [[ -z "$task_docker_version" ]]; then
    printf 'Docker daemon не ответил.\n' >&2
    exit 1
  fi
fi

if [[ "$task_skip_build" == false ]]; then
  printf '\nСобираю приложение и запускаю тесты. Лог: build-latest.log\n'
  mvn -B -ntp verify 2>&1 | tee build-latest.log
fi

if [[ ! -s target/sport-hub-backend-1.0.0.jar ]]; then
  printf 'Готовый JAR не найден. Запустите скрипт без --skip-build.\n' >&2
  exit 1
fi

printf '\nЗапускаю PostgreSQL и готовый JAR без Maven внутри Docker. Лог: startup.log\n'
"${task_docker[@]}" compose -f compose.yaml -f compose.local.yaml up --build -d 2>&1 | tee startup.log

task_diagnostics() {
  "${task_docker[@]}" compose -f compose.yaml -f compose.local.yaml logs --no-color --tail 150 backend db > startup-diagnostics.log 2>&1 || true
  printf 'Ошибка запуска или проверки; см. startup-diagnostics.log. Контейнеры сохранены для диагностики.\n' >&2
}
trap task_diagnostics ERR

printf '\nОжидаю готовности API (до 120 секунд).\n'
python3 - <<'PY'
import json
import time
import urllib.error
import urllib.request

deadline = time.monotonic() + 120
while time.monotonic() < deadline:
    try:
        with urllib.request.urlopen('http://localhost:8080/api/v1/health', timeout=2) as response:
            if json.load(response).get('status') == 'UP':
                print('API и база данных отвечают.')
                break
    except (OSError, ValueError, urllib.error.URLError):
        pass
    time.sleep(min(2, max(0, deadline - time.monotonic())))
else:
    raise SystemExit('API не стал доступен за отведённое время.')
PY

python3 scripts/smoke.py 2>&1 | tee smoke-latest.log
printf '\nПроверки прошли. API работает: http://localhost:8080/api/v1\n'
