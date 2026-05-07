#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="/home/candidate"
OUTPUT_FILE="${OUTPUT_DIR}/argocd-manifest.yaml"

if ! mkdir -p "${OUTPUT_DIR}" 2>/dev/null; then
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo mkdir -p "${OUTPUT_DIR}"
    sudo chown "$(id -u):$(id -g)" "${OUTPUT_DIR}"
  else
    echo "Error: cannot create ${OUTPUT_DIR}. Run with sufficient permissions." >&2
    exit 1
  fi
fi

helm repo add argocd-repo https://argoproj.github.io/argo-helm --force-update
helm repo update

helm template argocd argocd-repo/argo-cd \
  --version 7.6.8 \
  --namespace gitops \
  --skip-crds \
  > "${OUTPUT_FILE}"

echo "Manifest written to ${OUTPUT_FILE}"
