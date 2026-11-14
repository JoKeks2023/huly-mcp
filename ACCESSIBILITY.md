# Accessibility

huly-mcp-selfhost is mostly used through AI clients and a terminal, plus a project website. We want all of it
to be usable with a keyboard, a screen reader and at high zoom.

## Website (jokeks2023.github.io/huly-mcp)

Target: **WCAG 2.2 level AA**.

- Checked with [axe-core](https://github.com/dequelabs/axe-core) (WCAG 2.0/2.1/2.2 A and AA plus best
  practices) in light and dark theme, desktop and phone width: **no violations** (2026-11-14).
- Keyboard: a "Skip to setup" link, visible focus outlines, every link and button reachable; scrollable code
  blocks and tables can be focused and scrolled with the keyboard. The section navigation marks the current
  section with `aria-current`.
- Color: text contrast at least 4.5:1 in both themes; the theme follows the system setting and can be switched.
- Motion: smooth scrolling is turned off with *reduce motion*; there are no animations that carry meaning.
- Layout: works from 320 px wide and at 200 % zoom without horizontal page scrolling.

Not verified yet: a full manual pass with VoiceOver/NVDA.

## Server, command line and plugin

- Answers are plain Markdown text — headings, lists and short lines — readable by screen readers and in any
  terminal, without color or emoji carrying the only meaning (status words are always written out).
- The command line works without color; `--format json` gives machine-readable output; errors are full
  sentences that say what to do next.
- The OAuth login page of the team server is a simple HTML form with labels, no CAPTCHA and no time limit
  shorter than 15 minutes.

## Found a barrier?

Please [open an issue](https://github.com/JoKeks2023/huly-mcp/issues/new/choose) describing what you tried, with
which assistive technology, and what happened. Accessibility problems are treated as bugs.
