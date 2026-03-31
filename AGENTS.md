# AGENTS.md

This repository is owned by the `enfluence-radar` OpenClaw agent.

## Purpose

- Build and improve the Enfluence Radar product
- Keep implementation real and production-oriented
- Prefer changes that improve operator usefulness, not demo polish

## Execution Rules

- Default coding executor: Codex
- Secondary coding executor: Claude Code
- Use Gemini for summaries, alternatives, or lightweight synthesis
- Work from this repository root and keep repo context local

## Before Changing Code

1. Read `PROJECT_PROMPT.md`
2. Inspect the relevant route/component/API files
3. Prefer a scoped implementation plan over wide repo churn

## When Reporting Back

- Summarize product impact first
- Then mention important implementation details
- Flag any missing env vars, external API limits, or deployment risks

## Guardrails

- Do not delete unrelated files
- Do not modify `.env.local` without explicit instruction
- Treat Supabase schema and API routes as contract-sensitive
