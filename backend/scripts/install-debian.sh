#!/usr/bin/env bash
set -euo pipefail

# Запускать из обычного терминала Debian 13; права администратора нужны только для установки в систему.
task_mode="${1:-install}"
if [[ "$#" -gt 1 || ( "$task_mode" != install && "$task_mode" != --check ) ]]; then
  printf 'Использование: bash %s [--check]\n' "$0" >&2
  exit 2
fi

task_docker_ready() {
  local task_version
  task_version="$("$@" docker info --format '{{.ServerVersion}}' 2>/dev/null)" && [[ -n "$task_version" ]]
}

task_check() {
  local task_failed=0
  if command -v javac >/dev/null 2>&1; then
    javac -version
  else
    printf 'НЕТ: компилятор JDK (javac).\n'
    task_failed=1
  fi
  if command -v mvn >/dev/null 2>&1; then
    mvn -version
  else
    printf 'НЕТ: Maven.\n'
    task_failed=1
  fi
  if command -v docker >/dev/null 2>&1; then
    if ! docker compose version; then
      printf 'НЕТ: Docker Compose plugin.\n'
      task_failed=1
    fi
    if task_docker_ready; then
      docker info --format 'Docker server: {{.ServerVersion}}'
    else
      printf 'НЕТ ДОСТУПА: Docker daemon.\n'
      task_failed=1
    fi
  else
    printf 'НЕТ: Docker.\n'
    task_failed=1
  fi
  return "$task_failed"
}

if [[ "$task_mode" == --check ]]; then
  task_check
  exit
fi

if [[ ! -r /etc/os-release ]]; then
  printf 'Не найдена информация о системе.\n' >&2
  exit 1
fi
. /etc/os-release
if [[ "$ID" != debian || "$VERSION_ID" != 13 ]]; then
  printf 'Этот установщик предназначен для Debian 13; обнаружено: %s.\n' "$PRETTY_NAME" >&2
  exit 1
fi

task_sudo=()
if [[ "$EUID" -ne 0 ]]; then
  if ! command -v sudo >/dev/null 2>&1; then
    printf 'Для установки нужен sudo или запуск от root.\n' >&2
    exit 1
  fi
  task_sudo=(sudo)
fi

task_packages=(openjdk-21-jdk-headless maven docker-compose docker-buildx)
if ! command -v docker >/dev/null 2>&1; then
  task_packages+=(docker.io)
fi

printf 'Будут установлены пакеты Debian: %s\n' "${task_packages[*]}"
printf 'Если sudo запросит пароль, вводите его только в терминале.\n'
"${task_sudo[@]}" apt-get update
"${task_sudo[@]}" apt-get install -y "${task_packages[@]}"

if ! task_docker_ready; then
  if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
    "${task_sudo[@]}" systemctl start docker
  fi
fi

if task_check; then
  printf '\nУстановка и проверка завершены.\n'
else
  printf '\nПакеты установлены, но часть проверок не прошла. См. сообщения выше.\n' >&2
  if task_docker_ready "${task_sudo[@]}"; then
    printf 'Docker отвечает с sudo. Запускайте Docker-команды с sudo; права групп и сокета скрипт не меняет.\n' >&2
  fi
  exit 1
fi
