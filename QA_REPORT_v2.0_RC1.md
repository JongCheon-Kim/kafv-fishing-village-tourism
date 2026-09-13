# QA REPORT — 어촌관광정보앱 v2.0 RC1

## 정적 검증 결과
- villages.js 어촌계: **2,045개**
- ID 중복: **0개**
- 위·경도 결측: **0개**
- 관광공사 시군구 코드: **252개**
- 자동 시군구 매칭: **2,041개**
- 수동 예외 매칭: **4개**
- 미해결/모호 매칭: **0개**
- 최종 매칭: **2,045/2,045**
- 기존 resolver에서 주소에 명시된 시도와 다른 시도로 연결될 수 있던 사례: **121개**
- 필수 프론트 API 경로 누락: **0개**
- Service Worker 캐시 파일 누락: **0개**
- index.html JavaScript 문법검사: **통과**
- worker.js JavaScript 문법검사: **통과**

## API 연결 구조
- KorService2: 주변 관광 / 음식 / 숙박 / 체험
- KorPetTourService2: 반려동물 위치검색 + 상세조건
- AreaTarResDemService: 관광자원 수요
- AreaTarDivService: 관광 다양성
- AreaTarDemDsService: 관광수요 강도
- TarRlteTarService1: 연관 관광지
- LocgoHubTarService1: 중심 관광지
- TatsCnctrRateService: 집중률 예측

## v2.0 RC1 시군구 예외 보정
- FV0708 → 경기도 안산시 단원구
- FV0759 → 경기도 화성시
- FV1792 → 제주특별자치도 서귀포시
- FV1795 → 제주특별자치도 서귀포시

## 참고
실제 외부 API 응답은 이미 Cloudflare Preview에서 8개 서비스별로 수동 실호출 검증을 마친 상태입니다.
이번 QA는 GitHub 배포 전에 프론트 코드·데이터 정합성·라우트 참조를 추가 점검한 것입니다.
