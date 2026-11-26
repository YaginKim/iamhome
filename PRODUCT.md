# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static HTML/CSS/JS (ES modules, no build step), hosted on GitHub Pages (public repo, account YaginKim). No login, no server; progress lives in the browser's localStorage on each device.

## Users

Special-education students at three levels, played in class (40–45 min periods) on school tablets and PCs, usually with a teacher nearby:

- 하: developmental level of roughly 5–8 years old
- 중: lower-elementary level
- 상: ordinary middle-school level

Borderline students are included, so difficulty is set per area (money, change, card, memory, conversation) rather than one global level.

## Product Purpose

An errand adventure. Students practise real neighbourhood life: greeting people, paying with the right money, working out change, telling cash from account money, knowing which card does what, and remembering an errand list. Success means a student can carry these skills to a real shop counter.

The game is called 「다녀오겠습니다」, the greeting a child says when leaving home. Its ending screen reads 「다녀왔습니다」: a child goes out alone and comes back on their own, so the title is completed at the end.

Tagline: 낯선 길, 낯선 사람, 낯선 계산대. 그래도 한 걸음

## Positioning

The structure is borrowed from instant-play browser games (no install, short runs, a feeling of growth). The content is the real Korean neighbourhood: 분식점, 전통시장, 체크카드, 급식카드, 꿈이든 카드, a bank and its interest. There is no combat and no game over; failing leads to a 꿈이든 카드 identity check and then a retry.

## Operating Context

- Stages: 집 (tutorial) → 교실 → 체육관 → 운동장 → 분식점 → 편의점 → 전통시장 → 미용실 → 대형마트 → 교육지원청 → 교육부. The bank is visited after every stage.
- One play session is one stage, aimed at 15–20 minutes, with a daily limit on stages cleared.
- Movement is top-down; just before a stage is cleared, a first-person 「되돌아보기」 view reviews what the student actually did.
- Voice is browser TTS by default. Each line has an ID, and a recorded file with the same ID replaces the TTS for that line. The user will supply the BGM later.

## Capabilities and Constraints

- Money is held in three separate places: 현금 (physical pieces), 계좌 (spent with the 체크카드, filled by bank deposits and transfers), and 급식카드 (charged automatically each stage; buys only food that restores 체력; shown only at 중/상 when the card is held).
- 꿈이든 카드 and 복지카드 are identity cards, never payment. Presenting either one at payment triggers a blocking pop-up.
- Bank deposits are made in 1,000-won units. Each stage clear adds 10% interest on the account.
- Items, prices, payment rules and heal values live in `data/items.csv`; all rules live in `data/config.json`. Both must stay editable by non-programmers.
- Students' real names and addresses are optional, are entered on the device, and never leave it.

## Brand Commitments

- Title 「다녀오겠습니다」 and ending 「다녀왔습니다」
- Tagline 「낯선 길, 낯선 사람, 낯선 계산대. 그래도 한 걸음」
- Pixel art authored in code; Korean pixel font Galmuri (OFL)
