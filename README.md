# 내가 찾던 부동산 MVP

동작구 재개발·노량진뉴타운·신속통합기획 매물을 초기투자금과 총 예상 매수가 기준으로 탐색하는 반응형 웹 프로토타입입니다.

## 실행

별도 설치가 필요하지 않습니다. 이 폴더에서 정적 서버를 실행하세요.

```powershell
python -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 엽니다.

## 주요 경로

- `#/` 홈
- `#/search` 예산 기반 매물 검색
- `#/market-status` 노량진 구역별 거래가능·거래완료 현황
- `#/transactions` 노량진·상도 실거래내역
- `#/property/N7-84A-001` 매물 상세
- `#/area/noryangjin` 노량진 구역 분석
- `#/area/sangdo` 상도 신속통합기획 분석
- `#/contact` 상담 신청
- `#/admin` 매물 등록 및 자동계산

## 데이터 동작

관리자에서 등록한 데이터는 브라우저 `localStorage`에 저장되며, 공개 매물은 홈·검색·구역 화면에 즉시 반영됩니다.

블로그 URL을 함께 등록할 수 있으며 관리자에서 상태를 `거래 완료`로 변경하면 검색·추천매물에서 제외되고 거래완료 아카이브로 이동합니다.

- 초기투자금 = 매매가 - 승계가능 대출
- 총 예상 매수가 = 매매가 + 예상 분담금 - 예상 환급금
- 거래 완료 매물은 기본 검색에서 제외
- 비공개 매물은 고객 화면에서 제외

## GitHub 실거래 동기화

`#/admin`의 **GitHub 실거래 데이터 연결**에서 GitHub Actions가 갱신하는 두 Raw JSON URL을 등록합니다.

- 노량진뉴타운 JSON URL
- 상도 신속통합기획 JSON URL

지원 구조는 배열 또는 `{ "transactions": [] }`, `{ "data": [] }`입니다. 권장 필드는 다음과 같습니다.

```json
{
  "region": "노량진뉴타운",
  "area": "노량진7구역",
  "contractDate": "2026-08-20",
  "propertyType": "입주권",
  "areaSqm": 84.9,
  "floor": "-",
  "price": 2200000000,
  "source": "국토교통부 실거래가 공개시스템"
}
```

snake_case(`contract_date`, `property_type`, `area_sqm`, `deal_amount`)와 일부 한글 키도 자동 변환합니다. URL이 비어 있거나 동기화에 실패하면 화면 구조 확인용 예시 데이터가 표시됩니다.

현재는 제품 흐름 검증용 MVP이며, 운영 배포 전 Supabase 인증·DB·서버 검증·중개대상물 표시광고 필드 연결이 필요합니다.

