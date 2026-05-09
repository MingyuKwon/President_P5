# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. Auto Commit & Push

**파일을 생성, 수정, 삭제한 후에는 반드시 커밋하고 푸시한다.**

- 작업 완료 후 변경된 파일을 스테이징하고 커밋 메시지를 작성한다.
- 커밋 후 즉시 `git push origin main`까지 실행한다.
- 커밋 메시지는 변경 내용을 간결하게 한국어 또는 영어로 작성한다.
- 사용자에게 별도로 확인을 구하지 않고 자동으로 수행한다.

## 6. Session Continuity

**작업 내용을 항상 문서에 남겨서 다음 세션에서 이어받을 수 있도록 한다.**

- 설계 결정, 구현 계획, 진행 상황은 `docs/plan.md`에 기록한다.
- 새로운 Phase나 Task를 시작하면 `docs/plan.md`에 먼저 추가한 뒤 구현한다.
- 완료된 Task는 `🔲 미완료` → `✅ 완료`로 업데이트한다.
- 구현 도중 설계가 바뀌면 `docs/plan.md`에 즉시 반영한다.
- 세션이 끝날 때 현재 진행 상태가 `docs/plan.md`만 봐도 파악되도록 유지한다.

## 7. Bug Fix Documentation

**버그를 수정할 때마다 `docs/troubleshooting/index.md`에 기록한다.**

- 버그를 수정하기 전에 먼저 원인을 분석하고, 수정 후 내역을 테이블에 추가한다.
- 상태: `🔲 미완료` → `✅ 완료`
- 컬럼: 상태 / 위치(파일:줄) / 문제 설명 / 해결 방법
- 미완료 버그를 발견하면 즉시 테이블에 추가해 두고 나중에 처리한다.
- 사용자가 버그를 보고할 때도 먼저 `docs/troubleshooting/index.md`에 등록한 뒤 수정한다.

## Project: 대부호 (President Card Game)

게임 규칙 상세: `docs/game-rules.md` 참조  
공통 용어 정의: `docs/glossary.md` 참조  
구현 계획 및 진행 상황: `docs/plan/overview.md` 참조 (각 Phase는 `docs/plan/phase1~3.md`)  
리소스 구성 및 사용처: `Resource/README.md` 참조
