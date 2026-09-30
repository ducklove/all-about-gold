# All About Gold

Value Compass(value-invest) 생태계의 화면·테마 규약을 따르는 금 투자 리서치 서비스입니다. 데이터 공급자는 **finance-pi**입니다. 공개 사이트는 [GitHub Pages](https://ducklove.github.io/all-about-gold/)에서 서비스합니다.

## 데이터 구조

```text
세계은행 / Yahoo / USGS / IMF IFS(DBnomics) / 검토한 공식 발표
  → finance-pi 수집·검증·버전별 스냅샷 보관
  → finance-pi GET /api/research/gold
  → 로컬: All About Gold GET /api/gold → 브라우저
  → 공개: data 브랜치 → GitHub Pages data/current.json → 브라우저
```

브라우저는 같은 출처의 데이터 한 개를 요청해 가격·추이·연구 자료를 함께 받습니다. 로컬은 `/api/gold`, Pages 빌드는 상대 경로 `data/current.json`을 사용합니다. 서비스의 Python 서버가 설정된 finance-pi의 고정 경로만 프록시합니다. 로컬 finance-pi 연결 실패 시 오류와 재시도를 표시합니다. 공개 사이트는 미리 발행한 스냅샷으로 동작하므로 방문자가 Pi에 직접 접속할 필요가 없습니다. 원천 직접 수집이나 암묵적 폴백은 없습니다. 외부 API 키나 관리자 토큰은 브라우저로 전달하지 않습니다.

## 로컬 실행

finance-pi는 Python 3.11+, 이 서비스는 Python 3.9+와 현대 브라우저가 필요합니다. JavaScript 빌드는 없습니다.

먼저 형제 저장소에서 한 번 수집한 뒤 finance-pi API를 실행합니다.

```sh
cd ../finance-pi
# .venv가 없다면: uv venv --python 3.12 && uv pip install -e '.[dev]'
.venv/bin/python -m finance_pi.research.gold --root .
.venv/bin/python -m finance_pi.cli.app admin --root . --host 127.0.0.1 --port 8401
```

다른 터미널에서 이 서비스를 실행합니다.

```sh
cd /Volumes/Seagate/Works/all-about-gold
npm start
# 이 컴퓨터: http://127.0.0.1:8765
# 같은 네트워크: http://192.168.68.79:8765
```

웹 서버는 `0.0.0.0:8765`에 바인딩합니다. IP는 네트워크 설정에 따라 달라질 수 있으며 서버 컴퓨터가 깨어 있어야 합니다. 포트를 바꾸려면 `npm start -- --port 8766`을 사용합니다. Pages 배포는 `scripts/build_pages.py`가 데이터 경로를 바꾼 정적 배포본을 만듭니다. 개발용 `index.html`만 복사하면 API가 없어 동작하지 않습니다.

Raspberry Pi의 finance-pi API에 연결하려면 웹 서버의 주소를 설정합니다.

```sh
FINANCE_PI_BASE_URL=http://192.168.68.84:8400 npm start
```

기본 연결 주소는 `http://127.0.0.1:8401`입니다. finance-pi가 인증을 요구하는 환경에서는 서버 환경 변수 `FINANCE_PI_ADMIN_TOKEN`도 설정합니다. finance-pi의 기존 읽기 인증 정책을 따르며 `X-Admin-Token`으로 전달합니다. 운영 Pi에는 아래 자동 발행 타이머를 설치합니다.

## 배포와 자동 갱신

- 공개 URL: https://ducklove.github.io/all-about-gold/
- 저장소: https://github.com/ducklove/all-about-gold
- `main`은 코드, `data`는 finance-pi 발행본(`data/current.json`)과 Pages 워크플로만 보관합니다.
- 둘 중 어느 브랜치가 갱신되어도 GitHub Actions가 **main 코드 + 최신 data**를 검증하고 Pages에 배포합니다. 데이터 브랜치에도 워크플로를 넣어 데이터 push가 실제 배포를 일으키게 합니다.
- Raspberry Pi의 `all-about-gold-update.timer`가 **매일 07:17 Asia/Seoul**에 `ops/update_pages.py`를 실행합니다. 중단 중 놓친 실행은 기기 재시작 후 보충합니다.
- 발행 작업은 finance-pi 수집 명령 → finance-pi API 조회 → 완전성·단위·유효값 검사 → 데이터 브랜치 push 순서입니다. 한 단계라도 실패하면 새 발행을 중단해 기존 공개본을 유지합니다.
- 가격은 일간 실시간 시세가 아닌 **완료된 월의 평균**입니다. 매일 확인해도 원천 발표가 없으면 최신 관측월은 그대로입니다. 연간 채굴·보유량도 원천 발행 주기를 따릅니다. ETF·투자 제도·최근 개별 보유량 설명은 별도 검토 대상입니다.
- 발행 시각(`publishedAt`)과 실행 시각(`generatedAt`)만 바뀐 실행은 data 브랜치에 커밋하지 않습니다. 따라서 push와 Pages 배포도 일어나지 않습니다(`ops/update_pages.py`의 `stage_publication`). 공개본의 발행 시각은 자료가 마지막으로 바뀐 시각입니다.
- 화면에 관측월과 발행 시각을 함께 표시합니다. 가장 늦은 자산의 관측월이 100일을 넘으면 갱신 상태 안내를 표시합니다.
- Pi는 이 저장소에만 쓰기 가능한 전용 SSH deploy key를 사용합니다. 개인 토큰은 Pages나 저장소에 넣지 않습니다.

운영 명령, 장애 확인과 키 설치 방법은 [배포 안내](docs/deployment.md)를 참고하세요. 소스 사이트 장애나 Pages 빌드 실패는 각각 systemd 실행 상태와 [Actions 기록](https://github.com/ducklove/all-about-gold/actions/workflows/pages.yml)에서 확인할 수 있습니다.

## 제공 정보와 범위

| 자료 | 현재 수록 범위 | 출처·기준 |
| --- | --- | --- |
| 금·은 가격 | 1960-01–2026-08 | 세계은행 Pink Sheet 현물 월평균, USD/troy oz |
| 달러 지수 | 1971-01–2026-08 | Yahoo DXY 일별 종가의 월평균 |
| 비트코인 | 2014-10–2026-08 | Yahoo BTC-USD 일별 종가의 월평균 |
| 달러/원 | 2003-12–2026-08 | Yahoo KRW=X 일별 종가의 월평균 |
| 금 추정 시가총액 | 1960–2025 | 재구성 재고 × 12월 월평균 금 가격 |
| 미 연방 총부채·금/부채 비율 | 1993–2025 | 미 재무부 연말 액면 잔액, 정부 내부 보유 포함 |
| 전체 금 수량·채굴량/재고 | 1900–2025 | WGC 2025년 말 기준량에서 USGS 채굴량을 역산한 추정 |
| 세계·미국 채굴량 | 1900–2022 | USGS DS140 연간 톤, 2022 판 |
| 6개국 공식 금 보유량 | 1950–2024, 중국 1977–2024 | IMF IFS 연말 중량, DBnomics 배포본 |
| 공급·국가별 채굴·최근 보유량·ETF | 자료별 기준일 표시 | 공식 발표를 검토한 수동 스냅샷 |

- 금 단독 장기 차트는 다른 자산의 시작일에 영향을 받지 않습니다. 전체·50·30·10·5년과 로그 축을 지원합니다.
- 자산 비교는 각 자산이 존재하는 시점부터 보여줍니다. 공통 월만 비교하는 모드도 제공하며, 관측 기간을 표에 각각 표시합니다.
- 금/은 비율과 BTC/금 비율은 해당 두 자산이 모두 있는 달에만 계산합니다. BTC 이전을 0으로 만들지 않습니다.
- 세계·미국 채굴량 선택, 국가별 보유량 선택과 로그 축, 최신 스냅샷 국가 검색, ETF 시장·유형 필터를 제공합니다.
- 투자 방법은 KRX 금현물 직접 거래·실물 매입·금통장·ETF/신탁·선물을 비교합니다. KRX의 장점은 **국내 거주 개인의 일반계좌·실물 미인출** 조건으로 설명하고, 인출 부가세·괴리·거래 비용과 다른 계좌의 세제 혜택도 함께 표시합니다.
- 모바일·라이트/다크 테마, 키보드 조회, 관측 누락을 빈 칸으로 보존하는 비교 CSV를 지원합니다.

## 해석과 갱신

금·은의 장기 월별 자료는 1960년부터 수록합니다. 그 이전 시세를 추정하지 않습니다. 세계은행은 금 기준을 2025-06부터 런던 오후 고시에서 현물 일평균으로 변경했습니다. 은의 초기 구간에도 기준 변경이 있습니다. 가격은 명목 달러이며 인플레이션 조정값이 아닙니다. DXY는 투자 가능한 총수익 지수가 아니며 달러/원은 금을 원화로 환산한 가격이 아닙니다.

진행 중인 달과 원천의 첫 불완전 월을 제외하고 관측 누락을 보간하지 않습니다. 다른 시작일의 변동률은 동일 기간 성과로 비교할 수 없습니다. 최대 낙폭은 월평균 관측값 기준이므로 일별 낙폭과 다릅니다. 비율은 두 월평균을 나눈 값으로 실제 하루의 교환가격과 다릅니다.

IMF 보유량의 단위는 **백만 순금 트로이온스**이며 `31.1034768`을 곱해 톤으로 변환합니다. 연말 금 중량에는 금 예치·스왑 등이 포함될 수 있습니다. USGS의 장기 채굴량과 WGC·최신 USGS 발표는 추정 방식과 개정 시점이 달라 기존 DS140 관측 차트에서는 이어 붙이지 않습니다. 별도의 전체 수량 추정 모델에서는 아래와 같이 판본을 명시해 사용합니다.

금 전체 수량은 WGC의 2025년 말 219,891t을 기준으로 이후 연도 채굴량을 빼서 과거를 역산합니다. USGS DS140(1900–2022), MCS 2025(2023), MCS 2026(2024–2025)을 사용하며 영구 손실은 0으로 가정합니다. 재활용은 신규 금에 포함하지 않습니다. 이는 WGC의 과거 관측 시계열이 아닙니다. 금 추정 시가총액은 연말 재구성 재고 × 1,000,000 / 31.1034768 × 세계은행 12월 월평균 가격입니다. 실제 연말 종가 기준 가치와 다릅니다. 미국 부채는 Treasury Debt to the Penny의 12월 마지막 관측일 잔액이며 시장가치가 아닙니다. 금/부채는 전 세계 금 가치와 미국 부채의 비교로, 미국의 금 담보율이 아닙니다. 채굴량/재고는 연간 생산량 ÷ 연말 추정 재고이며, 역수는 매장량 고갈 기간이 아닙니다.

원천 갱신은 **finance-pi**에서 수행합니다.

```sh
cd ../finance-pi
.venv/bin/python -m finance_pi.research.gold --root .
```

전체 수집이 성공해야 `data/research/gold/current.json`을 원자적으로 교체합니다. 실패하면 이전 세대를 유지하고, 성공한 세대는 `releases/`에 보관합니다. 공급·국가별 최신 보유량·ETF의 수동 자료는 finance-pi의 `src/finance_pi/sources/gold/seed_research.py`에서 기준일·출처와 함께 검토·수정한 뒤 실행합니다. 이 스크립트는 새로운 발표를 자동 검색하지 않습니다.

이 서비스의 `npm run update-data`는 finance-pi의 현재 스냅샷을 `data/*.json`으로 **점검용 내보내기**만 합니다. 화면은 이 파일들을 읽지 않습니다. 수집기·소스 정의·원본 스냅샷은 finance-pi가 관리합니다. 자세한 서버 계약은 [finance-pi 문서](../finance-pi/docs/gold-research.md)를 참고하세요.

## Value Compass 연동

`../value-invest/docs/linked-projects.md`의 독립 배포 원칙과 표면·브랜드·상승/하락 색상, 시스템 한글 폰트, classic defer script 구조를 따릅니다. 본체에 런타임 의존하지 않습니다.

- **에코시스템 바**: `<body>` 맨 위의 `<vc-shell tool="all-about-gold">`가 허브·도구 전환·테마를 제공합니다. JS가 없으면 안쪽의 `Value Compass ↗` 링크가 그대로 보입니다. 하단 푸터에도 허브 링크가 있습니다.
- **공용 자산**: `static/vc-shell.js`, `static/vc-tokens.css`, `scripts/vc_publish.py`와 `index.html`의 `<!-- vc:theme-boot -->` 블록은 value-invest가 정본입니다. 직접 고치지 말고 value-invest에서 `node scripts/sync-ecosystem.mjs --write --only all-about-gold`로 다시 복사합니다.
- **색상**: `--up`/`--down`/`--font`는 `--vc-up`/`--vc-down`/`--vc-font-sans`의 별칭입니다(상승=빨강, 하락=파랑).
- `?theme=light` / `?theme=dark`: 칠하기 전에 적용하고 저장하지 않습니다. 없으면 공용 `localStorage.theme`, 그다음 OS 설정(`prefers-color-scheme`)을 따릅니다. 테마 버튼은 `VCShell.setTheme()`으로 저장합니다.
- `?embed=overview&theme=dark`(`0`/`false`가 아닌 값): 에코시스템 바·헤더·breadcrumb·footer를 숨긴 화면.
- `#market-size`, `#gold-history`, `#comparison`, `#ratios`, `#supply`, `#reserves`, `#investing`, `#etfs`: 섹션 링크.
- **도구 간 링크**: ETF 카드 → ETF 평가(eiayn) `?code=<티커>`, KRX 금현물 조건 문단 → 김치프리미엄(gold_gap) `?asset=gold`. 링크에는 현재 테마와 `from=all-about-gold`가 붙습니다.
- `config.json`의 프로젝트 키 `allAboutGold`, 데이터 API `/api/gold`.
- API 외피 `schemaVersion: 1`, `provider: "finance-pi"`, `publishedAt`, `history`, `trends`, `research`, `marketSize`.
- 가격 자료 `history.schemaVersion: 2`, 자산별 `points: [{date: "YYYY-MM", value: number}]`.
- **허브 요약**: Pages 빌드(`scripts/build_pages.py`)가 `summary.json`과 `version.json`을 사이트 루트에 만듭니다(value-invest `docs/ecosystem/data-contract.md` §6.9). `asOf`와 `generatedAt`은 finance-pi `publishedAt`이므로 같은 발행본이면 같은 파일이 나옵니다. `data/summary.json`은 커밋된 점검용 사본입니다. `python3 scripts/summary.py --from-exports data --output data`로 네트워크 없이 다시 만들 수 있습니다.

Value Compass의 `allAboutGold` integration과 분석 도구 카드에서 가격·비율·공급·투자 방법으로 연결합니다. 기존 goldGap은 국내외 괴리 비교 기능으로 별도 유지됩니다.

## 검증

```sh
npm test
# 두 서버가 실행 중인 상태에서 Chrome으로 검증
PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/@playwright/test node tests/browser.cjs

# finance-pi 수집·API 회귀 검증
cd ../finance-pi
.venv/bin/pytest tests/unit/test_gold_sources.py tests/unit/test_gold_research.py tests/unit/test_admin.py
```

계산·결측값·단위 변환·갱신 실패 보존·프록시 및 인증을 검사합니다. 브라우저 검증은 단일 API 경로, 10개 차트, 기간·로그 축·필터·CSV·키보드 조회, 모바일 넘침, 테마·임베드, API 실패·재시도를 확인합니다. 스크린샷은 `artifacts/`에 저장합니다.
