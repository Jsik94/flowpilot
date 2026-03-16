#!/usr/bin/env bash

resolve_env_file() {
  local service_dir="$1"

  if [[ -f "$service_dir/.env" ]]; then
    printf '%s\n' "$service_dir/.env"
    return
  fi

  if [[ -f "$service_dir/.env.example" ]]; then
    printf '%s\n' "$service_dir/.env.example"
  fi
}

trim_env_value() {
  local value="$1"

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"

  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s\n' "$value"
}

read_env_value() {
  local env_file="$1"
  local key="$2"
  local default_value="${3:-}"

  if [[ -n "$env_file" && -f "$env_file" ]]; then
    local line

    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

      if [[ "$line" == "$key="* ]]; then
        trim_env_value "${line#*=}"
        return
      fi
    done <"$env_file"
  fi

  printf '%s\n' "$default_value"
}
