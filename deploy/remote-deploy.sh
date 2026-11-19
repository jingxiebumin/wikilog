#!/usr/bin/env bash
set -Eeuo pipefail

registry="${1:?registry is required}"
image="${2:?image is required}"
compose_dir="/srv/wikilog"
state_dir="$compose_dir/deploy-state"
compose_file="$compose_dir/docker-compose.production.yml"
override_file="$state_dir/docker-compose.deploy.override.yml"
previous_file="$state_dir/.wikilog-previous-image"
auth_file="$compose_dir/.swr-pull.env"
health_url="http://127.0.0.1/"

case "$registry" in
  *[!A-Za-z0-9._-]*)
    echo "DEPLOY_FAILED: invalid registry value" >&2
    exit 1
    ;;
esac
case "$image" in
  *[!A-Za-z0-9._:/-]*)
    echo "DEPLOY_FAILED: invalid image reference" >&2
    exit 1
    ;;
esac

if [[ ! -r "$compose_file" ]]; then
  echo "DEPLOY_FAILED: missing $compose_file" >&2
  exit 1
fi
if [[ ! -d "$state_dir" || ! -w "$state_dir" ]]; then
  echo "DEPLOY_FAILED: missing writable $state_dir" >&2
  exit 1
fi
if [[ ! -r "$auth_file" ]]; then
  echo "DEPLOY_FAILED: missing $auth_file" >&2
  exit 1
fi
if [[ "$(stat -c '%a' "$auth_file" 2>/dev/null || true)" != "600" ]]; then
  echo "DEPLOY_FAILED: $auth_file must have mode 600" >&2
  exit 1
fi
if [[ "$(docker inspect -f '{{.State.Running}}' wikilog-postgres-pilot 2>/dev/null || true)" != "true" ]]; then
  echo "DEPLOY_FAILED: wikilog-postgres-pilot is not running" >&2
  exit 1
fi
if ! command -v curl > /dev/null 2>&1; then
  echo "DEPLOY_FAILED: curl is required for the health check" >&2
  exit 1
fi

previous_image="$(docker inspect -f '{{.Config.Image}}' wikilog-web-1 2>/dev/null || true)"
if [[ -z "$previous_image" ]]; then
  echo "DEPLOY_FAILED: current wikilog-web-1 image could not be determined" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
if ! . "$auth_file"; then
  echo "DEPLOY_FAILED: could not read $auth_file" >&2
  exit 1
fi
set +a
if [[ -z "${WIKILOG_SWR_USERNAME:-}" || -z "${WIKILOG_SWR_PASSWORD:-}" ]]; then
  echo "DEPLOY_FAILED: SWR pull credentials are incomplete" >&2
  exit 1
fi

if ! printf '%s' "$WIKILOG_SWR_PASSWORD" | docker login "$registry" --username "$WIKILOG_SWR_USERNAME" --password-stdin > /dev/null; then
  echo "DEPLOY_FAILED: SWR login failed" >&2
  exit 1
fi
logout_registry() {
  docker logout "$registry" > /dev/null 2>&1 || true
}
trap logout_registry EXIT

echo "PULL image=$image"
if ! docker pull "$image" > /dev/null; then
  echo "DEPLOY_FAILED: image pull failed" >&2
  exit 1
fi

write_override() {
  local value="$1"
  local temporary
  temporary="$(mktemp "$state_dir/.docker-compose.deploy.XXXXXX")"
  chmod 600 "$temporary"
  cat > "$temporary" <<EOF
services:
  web:
    image: $value
EOF
  mv -f "$temporary" "$override_file"
}

health_check() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error --max-time 5 "$health_url" > /dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

record_previous_image() {
  local temporary
  temporary="$(mktemp "$state_dir/.wikilog-previous-image.XXXXXX")"
  chmod 600 "$temporary"
  printf '%s\n' "$previous_image" > "$temporary"
  mv -f "$temporary" "$previous_file"
}

rollback() {
  echo "ROLLBACK_START image=$previous_image" >&2
  write_override "$previous_image"
  if docker compose -p wikilog -f "$compose_file" -f "$override_file" up -d --no-deps --pull never web > /dev/null && health_check; then
    echo "ROLLBACK_SUCCEEDED image=$previous_image" >&2
    return 0
  fi
  echo "ROLLBACK_FAILED image=$previous_image" >&2
  return 1
}

write_override "$image"
if ! docker compose -p wikilog -f "$compose_file" -f "$override_file" config --quiet; then
  echo "DEPLOY_FAILED: generated Compose configuration is invalid" >&2
  exit 1
fi

record_previous_image
echo "DEPLOY_START image=$image"
if ! docker compose -p wikilog -f "$compose_file" -f "$override_file" up -d --no-deps --pull never web > /dev/null; then
  echo "DEPLOY_FAILED: container update failed" >&2
  rollback || true
  exit 1
fi
if ! health_check; then
  echo "DEPLOY_FAILED: health check failed for $image" >&2
  rollback || true
  exit 1
fi

echo "DEPLOY_SUCCEEDED image=$image previous_image=$previous_image"
