# ACE — Accessibility Context Engine

> Bachelor's thesis · DHBW Mannheim · Joel Yerai Martinez Campo · 11.05.2026

Context-sensitive, locally executable LLM assistant for automated
accessibility analysis of Rich Client web applications. Combines
axe-core violation reports, Playwright interaction data, and static
React source-code analysis in a two-stage LLM pipeline — without
transferring any sensitive data to external cloud services.

## Thesis

**Title (DE):** Kontextsensitive, lokale KI-Assistenz zur automatisierten
Barrierefreiheitsanalyse von Rich-Client-Webanwendungen mittels
Tool-Reports, Playwright-Interaktionen und Codeanalyse

**PDF:** [Martinez_Joel.pdf](Martinez_Joel.pdf)

| Field             | Value                               |
|-------------------|-------------------------------------|
| Author            | Joel Yerai Martinez Campo           |
| Type              | Bachelor's thesis (Bachelorarbeit)  |
| Course            | WWI2023A                            |
| University        | DHBW Mannheim                       |
| Company           | BITBW — IT Baden-Württemberg        |
| Supervisor (Co.)  | Ilko Hoffmann                       |
| Supervisor (Uni.) | Sascha Alexander Ströbel            |
| Submitted         | 11 May 2026                         |

## Abstract

Web accessibility remains critically under-implemented despite legal
mandates from the European Accessibility Act (EAA) and Germany's
Barrierefreiheitsstärkungsgesetz (BFSG): 94.8 % of the most-visited
websites exhibit detectable WCAG violations. Existing automated tools
(axe, WAVE, Lighthouse) are limited to rule-based checks and fail on
semantic and state-dependent barriers in dynamic Rich Client
applications. Cloud-based LLM APIs are ruled out for public-sector
use due to data-protection requirements.

This thesis designs and implements **ACE (Accessibility Context Engine)**
using the Design Science Research (DSR) paradigm. All processing runs
on local infrastructure — no source code or DOM content leaves the
machine. ACE feeds axe-core reports, Playwright interaction snapshots,
and React source files into a two-stage pipeline: a detector LLM scans
the source code chunk-by-chunk for semantic accessibility patterns; a
prioritiser LLM then ranks all findings and generates file- and
line-specific remediation recommendations.

Evaluation across three benchmark suites (test-12, test-50, test-100)
with three local models (`qwen2.5-coder:7b`, `qwen2.5-coder:14b`,
`qwen3:32b`) shows significant recall gains over the tool-only baseline.
With `qwen3:32b`, recall rises from 66.7 % → 100 % (test-12),
34 % → 63 % (test-100).

## LaTeX Source

This repository contains the full LaTeX source of the thesis.

### Build

Requires a TeX distribution (TeX Live / MiKTeX) with `biber` and `latexmk`.

```bash
latexmk -pdf -interaction=nonstopmode latex-vorlage.tex
```

Output: `latex-vorlage.pdf` → rename to `Martinez_Joel.pdf`.

## Keywords

Web Accessibility · WCAG · Large Language Models · Local AI ·
Prompt Engineering · axe-core · Playwright · React · Ollama ·
Design Science Research · Digital Sovereignty · BITV · EAA · BFSG
