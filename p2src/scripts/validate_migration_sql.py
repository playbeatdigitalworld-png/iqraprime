#!/usr/bin/env python3
"""Sanity validation for the Creator Hub Phase 1 migration SQL.
Checks (static, no DB needed):
 1. $$ dollar-quote bodies are balanced (even count, no nesting bugs)
 2. BEGIN/COMMIT balance
 3. Every table referenced in CREATE POLICY ... ON <table> is defined
 4. All 15 spec tables + admin_users + app_settings + feature_flags exist
 5. FK targets exist before referenced (rough order check for key tables)
 6. No stray forbidden patterns (e.g. 'service_role key literals', BOM)
"""
import re, sys

PATH = "/home/z/my-project/download/20261008000000_creator_hub_phase1.sql"
sql = open(PATH, encoding="utf-8").read()
errors, warnings = [], []

# 1. dollar-quote balance
n = sql.count("$$")
if n % 2 != 0:
    errors.append(f"Unbalanced $$ blocks: count={n}")
bodies = re.findall(r"\$\$(.*?)\$\$", sql, flags=re.S)
for i, b in enumerate(bodies):
    if b.count("(") != b.count(")"):
        errors.append(f"Dollar-quoted body #{i+1} has unbalanced parentheses "
                      f"({b.count('(')} open vs {b.count(')')} close)")

# 2. BEGIN/COMMIT
begins = len(re.findall(r"(?mi)^\s*begin;\s*$", sql))
commits = len(re.findall(r"(?mi)^\s*commit;\s*$", sql))
# note: 'begin' inside plpgsql bodies was excluded via line-anchored match at col 0
if begins != commits:
    errors.append(f"BEGIN({begins}) != COMMIT({commits})")

# 3+4. tables defined vs referenced
defined = set(re.findall(r"(?im)^\s*create table if not exists\s+(?:public\.)?(\w+)", sql))
required = {
    "creators","creator_profiles","creator_videos","creator_categories",
    "creator_followers","video_views","video_watch_sessions","video_engagements",
    "creator_earnings","creator_earnings_ledger","creator_withdrawals",
    "payout_methods","creator_strikes","copyright_reports","creator_notifications",
    "admin_users","app_settings","feature_flags",
}
missing = required - defined
if missing:
    errors.append(f"Missing required tables: {sorted(missing)}")

pol_tables = set(re.findall(r"(?im)create policy \w+ on (?:public\.)?(\w+)", sql))
BUILTIN_SCHEMAS = {"storage", "auth", "realtime", "extensions"}  # Supabase built-ins, not defined in this file
undef_pol = {t for t in (pol_tables - defined) if t not in BUILTIN_SCHEMAS}
if undef_pol:
    errors.append(f"Policies reference undefined tables: {sorted(undef_pol)}")

# 5. FK order: ledger->withdrawals handled via DO block; check direct FKs
fk_order_issues = []
for m in re.finditer(r"(?is)create table if not exists (?:public\.)?(\w+)\s*\((.*?)\n\);", sql):
    tbl, body = m.group(1), m.group(2)
    for ref in re.findall(r"references\s+(?:public\.)?(\w+)", body):
        if ref in required and ref not in defined:
            fk_order_issues.append(f"{tbl} references {ref} (not yet defined)")
        elif ref in defined:
            # ensure the referenced table appears earlier in the file
            if sql.find(f"create table if not exists public.{ref} ") > sql.find(f"create table if not exists public.{tbl} "):
                # storage tables aside, only warn
                if ref != tbl:
                    warnings.append(f"{tbl} forward-references {ref}")
if fk_order_issues:
    errors.extend(fk_order_issues)

# 6. hygiene
if sql.lstrip().startswith("﻿"):
    errors.append("File starts with BOM")
# no full literal secrets in source: fragments concatenated at runtime
_BAD = ("".join(["eyJhbGci", "Oi"]), "ghp_", "".join(["vcp_", "4bcd"]),
        "".join(["1df5", "3ce4"]), "".join(["7bd6", "9cb1"]))
for bad in _BAD:
    if bad in sql:
        errors.append(f"Secret-looking literal leaked into SQL: {bad[:6]}...")

# seeds sanity
for key in ["MIN_ELIGIBLE_VIEWS","PAYOUT_PER_10000_VALID_VIEWS","MINIMUM_WITHDRAWAL_USD",
            "FREE_ACCESS_PERCENTAGE","PAID_ACCESS_PERCENTAGE","FREE_ACCESS_DURATION_DAYS"]:
    if f"'{key}'" not in sql:
        errors.append(f"app_settings seed missing: {key}")
for flag in ["CREATOR_HUB_ENABLED","CREATOR_UPLOAD_ENABLED","CREATOR_MONETIZATION_ENABLED",
             "PAYOUTS_ENABLED","PAID_CONTENT_ENABLED"]:
    if f"'{flag}'" not in sql:
        errors.append(f"feature_flags seed missing: {flag}")

# 7. SQL-language functions validate table refs at CREATE time -> any table
#    they reference must be defined EARLIER in the file (42P01 guard).
for m in re.finditer(
    r"(?is)create or replace function\s+(?:public\.)?(\w+)\s*\([^)]*\)\s*returns\s+\w+\s*(.*?)\$\$(.*?)\$\$;",
    sql,
):
    fname, opts, body = m.group(1), m.group(2), m.group(3)
    if "language sql" not in opts.lower():
        continue  # plpgsql bodies are validated at runtime, not create time
    for ref in re.findall(r"(?:from|join)\s+(?:public\.)?(\w+)", body, flags=re.I):
        if ref in defined and sql.find(f"create table if not exists public.{ref} ") > m.start():
            errors.append(
                f"SQL function {fname}() references table {ref} which is defined LATER "
                f"in the file -> CREATE FUNCTION will fail with 42P01"
            )

print(f"dollar-quoted bodies: {len(bodies)}")
print(f"tables defined:       {len(defined)} -> {sorted(defined)}")
print(f"policies created:     {len(pol_tables)}")
print(f"triggers wired:       {len(re.findall(r'(?im)create trigger ', sql))}")
print(f"functions created:    {len(re.findall(r'(?im)create or replace function ', sql))}")
print()
for w in warnings: print("WARN:", w)
for e in errors:  print("ERROR:", e)
print()
print("RESULT:", "PASS" if not errors else "FAIL")
sys.exit(1 if errors else 0)
