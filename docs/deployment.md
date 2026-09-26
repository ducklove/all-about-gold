# GitHub Pages + finance-pi 운영

## 최초 배포

1. finance-pi의 금 수집기/API 코드를 배포하고 admin을 재시작합니다. 기존 `ops/deploy.sh`의 테스트·readiness 게이트를 사용합니다.
2. 이 저장소의 `main` 코드를 Pi의 `~/Works/all-about-gold`에 체크아웃합니다. Pages 설정은 GitHub Actions를 선택합니다.
3. Pi에서 전용 Ed25519 키를 `~/.config/all-about-gold/github_ed25519`에 만들고 공개키만 이 저장소의 write deploy key로 등록합니다. 개인키는 Pi에만 보관합니다.
4. 같은 폴더의 `publish.env`를 권한 600으로 만들고 서버 경로를 설정합니다.

```ini
FINANCE_PI_ROOT=/home/cantabile/Works/finance-pi
FINANCE_PI_BASE_URL=http://127.0.0.1:8400
GOLD_PUBLISH_REMOTE=git@github.com:ducklove/all-about-gold.git
GIT_SSH_COMMAND="ssh -i /home/cantabile/.config/all-about-gold/github_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes"
```

5. `ops/systemd/all-about-gold-update.{service,timer}`를 `~/.config/systemd/user/`에 설치합니다.

```sh
systemctl --user daemon-reload
systemctl --user enable --now all-about-gold-update.timer
systemctl --user start all-about-gold-update.service
```

자동 실행은 매일 오전 7:17 KST입니다. 유저 타이머가 로그아웃 후에도 실행되려면 기존 finance-pi 운영 사용자처럼 linger가 활성화되어 있어야 합니다.

첫 Pages 배포 전에는 `data` 브랜치에 검증한 finance-pi의 `data/current.json`이 있어야 합니다. 없으면 빌드가 실패하며 빈 데이터를 공개하지 않습니다. 최초 스냅샷은 finance-pi 수집·API를 통해 만들고 공급자 식별자를 확인합니다. 이후 Pi 발행기가 데이터와 배포 워크플로를 함께 갱신합니다.

## 확인과 재시도

```sh
systemctl --user list-timers all-about-gold-update.timer
systemctl --user status all-about-gold-update.service
tail -50 ~/.config/all-about-gold/publish.log
# 시스템 journal이 활성화되어 있다면:
journalctl --user -u all-about-gold-update.service -n 50 --no-pager
# 수집/발행을 다시 시도
systemctl --user start all-about-gold-update.service
```

GitHub의 **Deploy GitHub Pages** 워크플로가 성공해야 공개본 갱신이 완료됩니다. `data/current.json`의 `provider`가 `finance-pi`인지, `publishedAt`이 새 발행 시각인지, `history.assets[].points`의 마지막 월이 원천 발표와 맞는지 확인합니다. 코드를 바꿔 배포하려면 main에 push합니다. 데이터가 그대로인 상태에서 재배포만 하려면 Actions의 Run workflow를 사용합니다.

Pi 수집 실패는 systemd 실패 상태와 전용 publish.log에 남고 기존 데이터 브랜치·Pages는 유지됩니다. Pages 빌드 실패는 Actions에 남고 직전 성공 배포가 유지됩니다. 3일 넘게 발행되지 않으면 화면에서도 갱신 상태를 확인하라는 안내를 표시합니다. 별도의 메신저 알림은 설정하지 않습니다.

## 유지보수

- 운영 Pi의 코드 갱신: 깨끗한 체크아웃인지 확인한 뒤 `git pull --ff-only origin main`. 수집기는 finance-pi, 발행기는 all-about-gold에 있습니다. 타이머는 코드 자체를 자동 업데이트하지 않습니다.
- `finance-pi/src/finance_pi/sources/gold/seed_research.py`의 수동 자료는 공식 발표를 검토한 다음 변경·실행하고 새 스냅샷을 발행합니다.
- 세계은행 XLSX 및 USGS 판본 URL이 바뀌면 finance-pi에서 새 자료의 단위와 정의를 확인하고 갱신합니다. 공개 사이트에서 임의의 원천으로 우회하지 않습니다.
- Pages 배포본에는 index, static, config, 검증된 스냅샷만 포함됩니다. 서버 스크립트·키·로그·원천 점검 파일은 포함하지 않습니다.
