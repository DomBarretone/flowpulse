#!/usr/bin/env bash
set -e
exec docker run --rm -u "$(id -u):$(id -g)" -v "$(pwd):/workspace" -w /workspace hashicorp/terraform:1.11.0 "$@"
