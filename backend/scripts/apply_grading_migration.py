from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2 import Error as PsycopgError


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_DIR = PROJECT_ROOT / "app" / "db"
BASE_SQL = DB_DIR / "maindb.sql"
MIGRATION_SQL = DB_DIR / "migration_full.sql"


def log(message: str) -> None:
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}", flush=True)


def load_database_url() -> str:
    load_dotenv(PROJECT_ROOT / ".env")
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set. Export it before running this script.")
    return database_url


def has_base_schema(connection) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                to_regclass('public.users') IS NOT NULL
                AND to_regclass('public.course_offerings') IS NOT NULL
                AND to_regclass('public.roadmap_assessment_tasks') IS NOT NULL
            """
        )
        row = cursor.fetchone()
    return bool(row and row[0])


def sql_error_context(sql_text: str, position: int | None) -> str | None:
    if not position:
        return None

    index = max(position - 1, 0)
    line_no = sql_text.count("\n", 0, index) + 1
    line_start = sql_text.rfind("\n", 0, index) + 1
    line_end = sql_text.find("\n", index)
    if line_end == -1:
        line_end = len(sql_text)
    line_text = sql_text[line_start:line_end].rstrip()
    return f"line {line_no}: {line_text}" if line_text else f"line {line_no}"


def apply_sql_file(connection, path: Path, *, dry_run: bool) -> None:
    if not path.exists():
        raise FileNotFoundError(f"SQL file not found: {path}")

    log(f"Applying migration... {path.name}")
    if dry_run:
        log(f"Dry run: skipped execution for {path.name}")
        return

    sql_text = path.read_text(encoding="utf-8")
    try:
        with connection:
            with connection.cursor() as cursor:
                cursor.execute(sql_text)
    except PsycopgError as err:
        position = None
        if getattr(err, "diag", None) is not None and getattr(err.diag, "statement_position", None):
            try:
                position = int(err.diag.statement_position)
            except (TypeError, ValueError):
                position = None
        context = sql_error_context(sql_text, position)
        details = [f"Migration failed while executing {path.name}."]
        if err.pgerror:
            details.append(err.pgerror.strip())
        elif str(err):
            details.append(str(err))
        if context:
            details.append(f"SQL context: {context}")
        raise RuntimeError(" ".join(details)) from err

    while connection.notices:
        notice = connection.notices.pop(0).strip()
        if notice:
            log(f"PostgreSQL notice: {notice}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply EduSmart grading migrations to PostgreSQL.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the migration plan without executing SQL.",
    )
    parser.add_argument(
        "--force-base",
        action="store_true",
        help="Run maindb.sql even when the base schema already exists.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        database_url = load_database_url()
    except Exception as err:
        print(f"Error: {err}", file=sys.stderr, flush=True)
        return 1

    connection = None
    try:
        connection = psycopg2.connect(database_url)
        connection.autocommit = False

        run_base = args.force_base
        if not args.force_base:
            run_base = not has_base_schema(connection)
            if run_base:
                log("Base schema not detected. maindb.sql will be applied first.")
            else:
                log("Base schema detected. Skipping maindb.sql.")

        if run_base:
            apply_sql_file(connection, BASE_SQL, dry_run=args.dry_run)

        apply_sql_file(connection, MIGRATION_SQL, dry_run=args.dry_run)
        log("Migration complete")
        return 0
    except Exception as err:
        print(f"Error: {err}", file=sys.stderr, flush=True)
        return 1
    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
