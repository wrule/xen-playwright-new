#!/bin/bash
npx playwright install-deps
PLAYWRIGHT_BROWSERS_PATH=`pwd`/browsers npx playwright install
