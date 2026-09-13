# GitHub Pages 배포 순서

1. 기존 GitHub 안정판을 별도 ZIP으로 백업합니다.
2. 이 폴더의 파일을 저장소 루트에 업로드합니다.
3. `config.js`의 `WORKER_BASE_URL`이 현재 Cloudflare Worker 주소인지 확인합니다.
4. GitHub Settings → Pages에서 배포 브랜치/루트를 확인합니다.
5. 배포 후 강력 새로고침 또는 기존 PWA 캐시 삭제 후 v2.0 RC1을 확인합니다.

## 반드시 확인할 항목
- 전국 첫 화면에서 `2,045` 클러스터
- 클러스터 클릭 → 단계적으로 개별 어촌계까지 분해
- 검색창 → 기능명 + 전체/ㄱ~ㅎ 초성 어촌계
- 지역 버튼 → 가로 스크롤 및 지도 이동
- 어촌계 선택 → 기본정보 Bottom Sheet
- 주변관광 / 먹거리 / 숙박 / 체험 / 반려동물
- 관광분석 6개 탭
- 반려동물 상세 조건
- 관광지 집중률 예측

## 보안
`KTO_API_KEY`는 GitHub 파일에 절대 기록하지 않습니다.
인증키는 Cloudflare Worker Secret에만 둡니다.
