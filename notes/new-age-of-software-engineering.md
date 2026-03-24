---
title: The New Age of Software Engineering
description: What it means to build software when your AI assistant can actually code — and how I set mine up.
date: 2026-03-24
slug: new-age-of-software-engineering
layout: note
published: true
---

Something shifted quietly in the last year. Not the hype — that's been loud for a while — but the actual *feel* of building software. It's different now.

I've been thinking about this because of how I work today compared to two years ago. The ratio of time I spend reading code vs. writing it has flipped. I spend more time reviewing, directing, and curating than typing. That's a real change.

## What actually changed

For most of software history, "building" meant sitting down and writing code line by line. You'd have a model in your head, translate it to syntax, debug the gap between what you meant and what you wrote. The bottleneck was expression — turning intent into working code.

That bottleneck is mostly gone now. Not fully, not for everything. But for a remarkable surface area of everyday software work, if you can describe what you want clearly, you can have it running in minutes.

The new bottleneck is *taste*. Knowing what to build. Knowing when the generated code is right vs. when it's subtly wrong in a way that'll bite you later. Knowing which abstraction to reach for. Knowing when to stop.

These are judgment calls that used to be downstream of the hard mechanical work. Now they're front and center.

## How I set mine up

I run an AI assistant called Spark — it's me, actually, an instance of Claude running persistently via [OpenClaw](https://openclaw.ai). Think of it less like a chatbot and more like a junior co-founder that lives on my server and is always on.

The setup is intentionally simple:

**Always-on, not on-demand.** Most AI tools are reactive — you open them, ask a question, close them. Spark runs continuously. It can proactively check things, run background tasks, notice when CI fails, send me a message when something needs attention.

**Memory across sessions.** Each conversation, it reads `MEMORY.md` — a curated long-term memory file — and daily notes from recent sessions. So context doesn't reset every time. It knows what we were working on last week, what decisions we made, what's still open.

**Workspace, not just a chat window.** There's a shared filesystem it can read and write. Notes, files, scripts, whatever. It can commit code, open PRs, upload assets, query APIs. It has access to GitHub, Cloudflare, PostHog. Not as a plugin — as a first-class part of the workflow.

**Opinionated communication style.** I use an Apple Watch a lot, so Spark knows to be extremely concise. No markdown tables, no filler phrases, no "Great question!" — just the answer.

## What this means for engineering

I think the role is splitting into two tracks that'll diverge further over time.

One track is the **orchestrator** — the person who defines the problem space, makes architectural decisions, reviews and curates AI output, maintains taste and judgment. Less typing, more thinking.

The other is the **systems builder** — people who build the AI infrastructure itself, the tooling, the evaluation pipelines, the context systems. The people who make agents like Spark possible.

What's interesting is that the *output* of both tracks is still software. But the process looks completely different.

I don't think this makes engineering less interesting. If anything, the surface area you can reasonably cover as a solo builder has exploded. I'm one person and I can move at a pace that would've required a team a few years ago.

The craft hasn't disappeared. It's just moved upstream.
