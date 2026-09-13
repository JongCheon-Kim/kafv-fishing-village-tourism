# 어촌관광정보앱 v2.0 RC1

한국AI어촌가치연구소(KAFV) 어촌관광정보앱의 GitHub Pages 배포 후보판입니다.

## 핵심 구성
- 전국 어촌계: **2,045개**
- 지도: Leaflet + OpenFreeMap(MapLibre), 장애 시 OSM raster fallback
- 클러스터: 내장 pixel-grid + 클릭 단계확대 + 동일좌표 spiderfy
- UI: 모바일 기준, PC에서는 스마트폰 프레임
- 검색: 기능검색 + 어촌계 2,045개 초성검색
- 한국관광공사: Cloudflare Worker를 통해 8개 API 연결
- PWA: manifest + service worker + 192/512 아이콘

## 한국관광공사 8개
1. 지역별 관광 자원 수요
2. 지역별 관광 다양성
3. 지역별 관광수요 강도
4. 관광지별 연관 관광지
5. 국문 관광정보 서비스
6. 기초지자체 중심 관광지
7. 관광지 집중률 방문자 추이 예측
8. 반려동물 동반여행

## 배포 구조
GitHub Pages 프론트엔드는 `config.js`의 Worker URL만 호출합니다.
한국관광공사 인증키는 GitHub에 넣지 않고 Cloudflare Worker Secret `KTO_API_KEY` 하나에만 저장합니다.

## 현재 Worker
`https://kafv-fishing-village-tourism-api.123kjc.workers.dev`

## v2.0 RC1에서 추가된 QA 수정
- 관광분석 시군구 자동매칭 로직 재작성
- 주소의 명시 시도와 다른 시도로 잘못 연결될 수 있던 기존 오인매칭 제거
- 2,041개 자동매칭 + 4개 예외 보정 = **2,045/2,045 매칭**
- 집중률 예측은 음식점/숙박 선택값이 아니라 관광지(contentTypeId=12)를 우선 사용
- 기존 v1.9의 2,045 클러스터 클릭 분해 기능 유지

상세 검증은 `QA_REPORT_v2.0_RC1.md`를 확인하십시오.
