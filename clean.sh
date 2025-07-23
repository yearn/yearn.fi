#! /bin/bash

if [[ "$1" == "--lockfiles" ]]; then
    find . -name bun.lock -type f -delete
fi

find . -type d \( -name node_modules -o -name build -o -name dst -o -name dist -o -name .next -o -name .cache -o -name coverage -o -name .nyc_output \) -prune -exec rm -rf {} +
