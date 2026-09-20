#!/usr/bin/env bash
# Shell Script Runner Example
echo "Running Shell Script in Cowbox Workspace"
echo "Host Operating System: $(uname -s 2>/dev/null || echo Windows)"
echo "Listing directory files:"
ls -la 2>/dev/null || dir
