# Intalk: 최종 한마디

면접 답변을 어절 단위로 잠그며 입력하는 Phaser 4 기반 1 대 5 타이핑 게임입니다. 싱글 플레이와 최대 4인의 실시간 멀티 레이스를 지원합니다.

## 실행

Node.js 20 이상에서 의존성을 설치하고 Phaser 프로덕션 번들을 만든 뒤 게임 서버를 실행하세요.

```powershell
npm install
npm run build
npm start
```

그다음 `http://localhost:8080`을 엽니다.

개발 중에는 첫 번째 터미널에서 `npm start`, 두 번째 터미널에서 `npm run dev`를 실행하고 `http://localhost:5173`을 사용하면 Vite가 API 요청을 Node 서버로 전달합니다.

## Railway 배포

프로젝트는 Railway의 `PORT` 환경 변수를 사용해 `0.0.0.0`에서 실행되며, `railway.json`에 시작 명령과 `/api/health` 상태 확인 경로가 설정되어 있습니다. GitHub 저장소를 Railway에 연결한 뒤 `Generate Domain`을 선택하면 별도 빌드 설정 없이 배포할 수 있습니다. 현재 방 상태는 메모리에 있으므로 Railway 서비스는 1개 Replica로 유지하세요.

## Render 무료 배포

`render.yaml`에 무료 Web Service 설정이 포함되어 있습니다. Render Dashboard에서 Blueprint를 만들고 이 GitHub 저장소를 연결하면 `npm start`, `/api/health`, Node 20 설정이 자동 적용됩니다. 무료 서비스는 15분 동안 요청이 없으면 잠들 수 있으므로 첫 접속 때 잠시 기다린 뒤 새로고침하세요.

## 조작

- 글자 입력: 현재 어절 편집
- `Space`: 현재 어절 확정 (이후 수정 불가)
- `Enter`: 현재 상태로 답변 제출

## 멀티플레이

- 빠른 매칭: 같은 난이도의 지원자를 약 1.8초 동안 모아 2~4인으로 시작
- 친구 방: 5자리 초대 코드로 최대 4명 참가, 방장이 최대 어절 수와 어절당 제한 시간을 직접 설정, 2명 이상 전원 준비 시 시작
- 동기화: 공통 시작 시각, 상대별 문항/전체 진행률/누적 점수, 최종 순위
- 개발 기본값은 별도 계정 없이 작동하는 서버 내 로컬 매칭입니다.

두 개 이상의 시크릿 창에서 서로 다른 닉네임으로 접속하면 로컬 멀티플레이를 바로 확인할 수 있습니다.

## Hive 연결

`.env.example`을 `.env`로 복사해 값을 설정하고 `npm run start:hive`로 실행합니다. 인증 키와 콜백 시크릿은 서버에서만 사용하며 브라우저로 전달하지 않습니다.

Hive Console의 매치메이킹 콜백 URL은 다음 공개 HTTPS 주소로 설정합니다.

```text
https://YOUR_DOMAIN/api/hive/matchmaking/callback
```

필요한 값은 `HIVE_CERTIFICATION_KEY`, `HIVE_GAME_INDEX`, `HIVE_MATCH_ID`, `HIVE_CALLBACK_SECRET`이며, 랭킹까지 사용할 경우 `HIVE_LEADERBOARD_ID`를 추가합니다. 실제 배포에서는 클라이언트가 보낸 최종 점수를 그대로 신뢰하지 말고 입력 이벤트를 서버에서 재검증하는 부정행위 방지 로직을 추가해야 합니다.

현재 데모는 로컬 브라우저 ID를 사용합니다. Hive 실서비스 전환 시에는 Hive Web Login에서 받은 PlayerID를 이 ID 자리에 연결해야 합니다.

## 테스트

```powershell
npm test
```

## 구현 범위

- 회사 규모별 난이도와 각 10문항 데이터
- 한국어 IME 대응 어절 확정 입력
- 글자 단위 정확도, 완벽·콤보·속도 보너스
- 면접관 반응, 시간 압박, 답변 낭독 및 문항 결과
- 10문항 합산과 최종 등급 결과
- 최대 4인 매칭, 초대 코드, 준비 상태, 상대 진행도와 최종 순위
- Hive 매치메이킹 콜백 서명 검증 및 리더보드 서버 어댑터

## 디자인

- Nintendo DS 계열 감성의 픽셀 아트 UI
- Phaser 4 WebGL/Canvas Scene 기반 면접관, Tween, 파티클, 카메라 연출
- 한국어 IME 안정성을 위한 HTML 입력창과 Phaser의 하이브리드 구성
- 갈무리11 Regular(400) / Bold(700) 웹폰트 사용
- 폰트는 [Galmuri 공식 배포본](https://github.com/quiple/galmuri)을 jsDelivr CDN으로 불러옵니다. (SIL Open Font License 1.1)
