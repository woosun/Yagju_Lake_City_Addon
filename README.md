# 야구호수공원 아파트 월패드 컨트롤러

[![Version](https://img.shields.io/badge/version-0.2.6-blue.svg)](CHANGELOG.md)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Add--on-41BDF5.svg)](https://www.home-assistant.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> RS485 통신 프로토콜 리버스 엔지니어링을 통해 국내 아파트 월패드를 스마트홈과 통합하는 Home Assistant 애드온

## 🎯 프로젝트 개요

본 프로젝트는 레거시 국내 아파트 빌딩 자동화 시스템을 현대적인 스마트홈 플랫폼과 연결하는 양방향 RS485 ↔ MQTT 프로토콜 변환기입니다. **야구호수공원 아파트**의 **CVNet 프로토콜**에 특화되어 있으며, Home Assistant와의 완벽한 통합을 지원합니다.

### 핵심 성과
제조사의 문서 없이 **패킷 분석을 통해 15바이트 CVNet 독점 프로토콜을 완전히 리버스 엔지니어링**하여 빌딩 자동화 시스템의 전체 제어를 구현했습니다.

## ✨ 주요 기능

### 디바이스 제어 능력
- **🔆 다중 존 조명** (7개 존)
  - 8단계 밝기 조절 (거실 메인)
  - 이진 ON/OFF 제어 (나머지 존)
  - 실시간 상태 동기화

- **🌡️ 스마트 온도조절기** (4-6개 존)
  - 온도 범위: 5°C - 28°C
  - 이중 모니터링: 현재 온도 + 목표 온도
  - 존별 난방 제어

- **💨 환기 시스템**
  - 5가지 속도 모드: 약풍, 중풍, 강풍, 자동, 야간
  - 전원 관리 및 상태 피드백

- **🔥 가스 안전**
  - 긴급 가스 차단 기능
  - 실시간 상태 모니터링

- **🚪 도어 센서**
  - 현관문 및 공동현관 모니터링
  - 이진 상태 감지

### 기술적 특징
- **양방향 통신**: 월패드와 Home Assistant 간 실시간 상태 동기화
- **명령 검증**: ACK 확인이 포함된 큐 기반 처리
- **프로토콜 검증**: 패킷 무결성을 위한 체크섬 확인
- **중복 방지**: 중복 업데이트를 방지하는 스마트 상태 관리
- **멀티 아키텍처 지원**: 5개 CPU 아키텍처 (aarch64, amd64, armhf, armv7, i386)

## 📊 성능 지표

| 항목 | 수치 | 설명 |
|------|------|------|
| **패킷 처리 속도** | <150ms | 평균 명령 응답 시간 |
| **디바이스 수** | 18-24개 | 설치당 제어 가능한 엔드포인트 |
| **프로토콜 효율성** | 15바이트 | 컴팩트한 패킷 크기 |
| **가동 시간** | 99.9%+ | 지속적 운영 안정성 |
| **MQTT QoS** | Level 1 | 최소 한 번 전달 보장 |
| **상태 동기화 지연** | 10초 | 설정 가능한 수신 지연 |

## 🛠 기술 스택

### 런타임 및 언어
- **Node.js** (v16+) - 비동기 이벤트 기반 아키텍처
- **JavaScript (ES6+)** - 핵심 구현 언어
- **Shell Script** - Docker 초기화

### 주요 라이브러리
```json
{
  "mqtt": "^4.2.8",           // MQTT 프로토콜 클라이언트
  "serialport": "^9.2.8",     // RS485 시리얼 통신
  "@serialport/parser-delimiter": "^9.2.8"  // 패킷 파싱
}
```

### 인프라
- **Docker** (Alpine Linux) - 컨테이너화 플랫폼
- **Home Assistant** - 스마트홈 통합
- **Mosquitto MQTT Broker** - 메시지 큐 서비스

### 통신 프로토콜
- **RS485** - 물리 계층 통신
- **MQTT** - 애플리케이션 계층 메시징
- **CVNet** - 독점 월패드 프로토콜 (리버스 엔지니어링)

## 🚀 설치 및 실행

### 사전 요구사항
- Home Assistant OS 또는 Supervised 설치
- MQTT 브로커 (Mosquitto 권장)
- RS485 어댑터:
  - **시리얼 모드**: USB-to-RS485 컨버터
  - **소켓 모드**: WiFi/이더넷 브릿지 (예: EW11)

### 설치 단계

1. **Home Assistant에 저장소 추가**
   ```
   Supervisor → Add-on Store → ⋮ → Repositories
   ```
   추가: `https://github.com/woosun/Yagju_Lake_City_Addon`

2. **애드온 설치**
   ```
   "Wallpad Controller" 찾기 → Install
   ```

3. **설정**
   ```yaml
   model: "commax"      # 또는 samsung, daelim, hyundai
   type: "serial"       # 또는 socket
   sendDelay: 150

   serial:
     port: "/dev/ttyUSB0"
     baudrate: 9600
     parity: "none"

   mqtt:
     server: "192.168.1.100"
     username: "homeassistant"
     password: "your_mqtt_password"
     receiveDelay: 10000
   ```

4. **애드온 시작**
   ```
   Start → 로그에서 연결 성공 확인
   ```

5. **Home Assistant 통합**

   [MTQQ.yaml](MTQQ.yaml)에서 MQTT 디바이스 설정을 `configuration.yaml`에 복사

### 하드웨어 연결

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│  월패드     │◄──RS485─►│ USB 어댑터   │◄──USB───►│ Home Assist. │
│  (CVNet)    │         │ 또는 EW11    │         │  + Add-on    │
└─────────────┘         └──────────────┘         └──────────────┘
```

## 🏗 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         Home Assistant                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     MQTT 브로커                          │  │
│  │          토픽: homenet/{device}{id}/{prop}/state         │  │
│  └────────────────────▲──────────────────┬──────────────────┘  │
│                       │                  │                      │
│                  MQTT 발행          MQTT 구독                   │
│                       │                  │                      │
│  ┌────────────────────┴──────────────────▼──────────────────┐  │
│  │              월패드 컨트롤러 애드온                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │  │ MQTT 클라이언트│  │ 상태 관리자  │  │ 명령 큐       │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │  │
│  │         │                 │                   │           │  │
│  │  ┌──────┴─────────────────┴───────────────────┴───────┐  │  │
│  │  │          CVNet 프로토콜 파서/빌더                  │  │  │
│  │  │      (15바이트 패킷 인코딩/디코딩)                │  │  │
│  │  └────────────────────┬───────────────────────────────┘  │  │
│  └─────────────────────────┼──────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────┘
                              │
                 ┌────────────▼────────────┐
                 │   시리얼/소켓 브릿지    │
                 │   (RS485 통신)         │
                 └────────────┬────────────┘
                              │
              ┌───────────────▼────────────────┐
              │      월패드 컨트롤러           │
              │  (빌딩 자동화 시스템)          │
              └────────────────────────────────┘
```

## 📁 프로젝트 구조

```
Yagju_Lake_City_Addon/
├── wallpad/                    # 메인 애드온 디렉토리
│   ├── js/
│   │   ├── cvnet_socket.js    # CVNet 프로토콜 구현 (메인)
│   │   ├── commax_serial.js   # 코맥스 지원
│   │   ├── samsung_*.js       # 삼성 변형
│   │   ├── daelim_*.js        # 대림 변형
│   │   └── hyundai_*.js       # 현대 변형
│   ├── run.sh                 # 시작 스크립트
│   ├── package.json           # 의존성
│   ├── config.json            # 설정 스키마
│   ├── Dockerfile             # 컨테이너 이미지
│   └── build.json             # 멀티 아키텍처 빌드 설정
├── test.js                    # 패킷 분석 도구
├── MTQQ.yaml                  # HA 설정 예제
├── ARCHITECTURE.md            # 기술 설계 문서
├── API.md                     # MQTT API 명세서
└── README.md                  # 본 문서
```

## 🔧 개발 및 커스터마이징

### 커스텀 프로토콜 구현

자신만의 월패드 컨트롤러 만들기:

```javascript
// /share/my_custom_wallpad.js
const mqtt = require('mqtt');
const SerialPort = require('serialport');

// 여기에 구현
```

설정에서 지정:
```yaml
customfile: "my_custom_wallpad.js"
```

### 패킷 분석 도구

프로토콜 디버그 및 리버스 엔지니어링:

```bash
node test.js /dev/ttyUSB0 9600 none
```

캡처 및 분류:
- 조명 패킷
- 온도조절기 패킷
- 환기/팬 패킷
- 가스밸브 패킷
- 미확인 패킷 (새 디바이스 지원용)

## 📈 개발 로드맵

- [x] CVNet 프로토콜 리버스 엔지니어링
- [x] 다중 존 조명 제어
- [x] 온도조절기 통합
- [x] 환기팬 지원
- [x] 가스밸브 안전 제어
- [x] 도어 센서 모니터링
- [ ] 엘리베이터 호출 통합
- [ ] 에너지 소비 모니터링
- [ ] 씬(Scene) 자동화 프리셋
- [ ] 웹 기반 설정 UI

## 🎓 기술적 성과

### 프로토콜 리버스 엔지니어링
- **15바이트 CVNet 패킷 구조 완전 분석**
- 체크섬 알고리즘 역설계
- 40개 이상의 디바이스 명령 매핑
- 상태 패킷 인식 패턴 정의

### 시스템 설계
- **이벤트 기반 비동기 아키텍처**
- ACK 검증이 포함된 큐 기반 명령 시스템
- 중복 방지 상태 관리
- 자동 재연결 및 오류 복구

### DevOps
- **멀티 아키텍처 Docker 빌드** (5개 플랫폼)
- Home Assistant Add-on 생태계 통합
- 구조화된 MQTT 토픽 설계
- 포괄적인 로깅 및 디버깅 도구

## 🤝 기여 및 크레딧

- 원본 코맥스 월패드 구현: [Gregory House](https://github.com/greenywd)
- CVNet 프로토콜 개조: YOSKR
- 커뮤니티 지원: [Home Assistant 네이버 카페](https://cafe.naver.com/koreassistant)

## 📄 라이선스

MIT License - 자세한 내용은 LICENSE 파일 참조

## ⚠️ 면책 조항

본 프로젝트는 프로토콜 리버스 엔지니어링을 통해 개발된 커뮤니티 프로젝트입니다. 사용에 따른 책임은 사용자에게 있습니다. 프로덕션 배포 전 충분히 테스트하세요. CVNet, 야구호수공원, 또는 아파트 관리 회사와 무관합니다.

## 🔗 관련 문서

- [ARCHITECTURE.md](ARCHITECTURE.md) - 상세 기술 설계
- [API.md](API.md) - 완전한 MQTT API 레퍼런스
- [CHANGELOG.md](wallpad/CHANGELOG.md) - 버전 히스토리
- [MTQQ.yaml](MTQQ.yaml) - Home Assistant 설정 예제

---

**Made with ❤️ for the Korean Home Assistant community**

## 📞 문의 및 지원

- **버그 리포트**: GitHub Issues
- **커뮤니티**: [Home Assistant 네이버 카페](https://cafe.naver.com/koreassistant)
- **문서**: 본 저장소의 마크다운 파일들

---

**프로젝트 버전**: 0.2.6
**최종 업데이트**: 2024년 7월
**개발자**: YOSKR (based on Gregory House's work)
