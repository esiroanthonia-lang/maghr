#!/usr/bin/env bash
# Runs the schema + security tests against a local Postgres (not Supabase).
# Usage: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
psql -v ON_ERROR_STOP=1 -q -c "drop database if exists maghr_test" -c "create database maghr_test"
psql -v ON_ERROR_STOP=1 -q -d maghr_test -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d maghr_test -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d maghr_test -f tests/rls_test.sql | grep -E "^(TEST|ALL)"
psql -v ON_ERROR_STOP=1 -q -d maghr_test -f tests/people_test.sql | grep -E "^(TEST|ALL)"
psql -v ON_ERROR_STOP=1 -q -d maghr_test -f tests/self_service_test.sql | grep -E "^(TEST|ALL)"
psql -v ON_ERROR_STOP=1 -q -d maghr_test -f tests/holidays_test.sql | grep -E "^(TEST|ALL)"
psql -v ON_ERROR_STOP=1 -q -d maghr_test -f tests/onboarding_test.sql | grep -E "^(TEST|ALL)"
psql -v ON_ERROR_STOP=1 -q -d maghr_test -f tests/attendance_test.sql | grep -E "^(TEST|ALL)"
psql -v ON_ERROR_STOP=1 -q -d maghr_test -f tests/careers_test.sql | grep -E "^(TEST|ALL)"
psql -v ON_ERROR_STOP=1 -q -d maghr_test -f tests/paye_test.sql | grep -E "^(TEST|ALL)"
