# MQTT API 레퍼런스

야구호수공원 월패드 컨트롤러 MQTT 인터페이스에 대한 완전한 API 문서입니다.

## 목차
- [개요](#개요)
- [토픽 구조](#토픽-구조)
- [디바이스 타입](#디바이스-타입)
- [조명 API](#조명-api)
- [온도조절기 API](#온도조절기-api)
- [환기팬 API](#환기팬-api)
- [가스밸브 API](#가스밸브-api)
- [도어센서 API](#도어센서-api)
- [Home Assistant 통합 예제](#home-assistant-통합-예제)
- [에러 처리](#에러-처리)
- [모범 사례](#모범-사례)

---

## 개요

MQTT API는 Home Assistant 생태계를 통해 월패드 디바이스를 제어하고 모니터링하기 위한 표준화된 인터페이스를 제공합니다.

### 프로토콜 세부사항

| 파라미터 | 값 |
|---------|-----|
| **프로토콜** | MQTT v3.1.1 |
| **QoS 레벨** | 1 (최소 한 번 전달) |
| **Retain 플래그** | `true` (마지막 상태 유지) |
| **토픽 접두사** | `homenet` |
| **페이로드 형식** | 일반 텍스트 문자열 |

### 통신 패턴

```
┌─────────────┐                 ┌──────────────┐                 ┌──────────┐
│ Home        │                 │ MQTT 브로커  │                 │ 월패드   │
│ Assistant   │                 │ (Mosquitto)  │                 │ 애드온   │
└──────┬──────┘                 └──────┬───────┘                 └────┬─────┘
       │                               │                              │
       │ 명령 발행(PUBLISH)            │                              │
       ├──────────────────────────────>│                              │
       │                               │ 명령 구독(SUBSCRIBE)         │
       │                               │────────────────────────────>│
       │                               │                     명령 실행│
       │                               │                              │
       │                               │  상태 발행(PUBLISH)          │
       │ 상태 구독(SUBSCRIBE)          │<─────────────────────────────┤
       │<──────────────────────────────┤                              │
       │                               │                              │
```

---

## 토픽 구조

### 표준 토픽 형식

```
homenet/{디바이스타입}{디바이스ID}/{속성}/{방향}
```

**구성 요소:**
- `{디바이스타입}`: 디바이스 카테고리 (Light, Thermo, Fan, Gas, Door)
- `{디바이스ID}`: 숫자 식별자 (조명 1-7, 온도조절기 1-4 등)
- `{속성}`: 디바이스 속성 (power, brightness, setTemp, curTemp, speed, open)
- `{방향}`: 메시지 방향
  - `state` - 애드온이 발행 (디바이스 → HA)
  - `command` - 애드온이 구독 (HA → 디바이스)

### 예제

```
homenet/Light1/power/state          ← 디바이스 상태
homenet/Light1/power/command        → 제어 명령

homenet/Thermo3/setTemp/state       ← 현재 목표 온도
homenet/Thermo3/setTemp/command     → 목표 온도 변경
```

---

## 디바이스 타입

| 디바이스 타입 | ID 범위 | 속성 | 설명 |
|--------------|--------|------|------|
| **Light** | 1-7 | power, brightness | 다중 존 조명 제어 |
| **Thermo** | 1-4 | power, setTemp, curTemp | 존별 난방/온도조절 |
| **Fan** | 1 | power, speed | 환기 시스템 |
| **Gas** | 1 | power | 가스밸브 안전 제어 |
| **Door** | 1-2 | open | 도어 상태 센서 |

---

## 조명 API

### 디바이스

| 디바이스 ID | 위치 | 밝기 레벨 |
|-----------|------|----------|
| `Light1` | 거실 (메인) | 0-8 (9단계) |
| `Light2` | 거실 (서브 1) | ON/OFF만 |
| `Light3` | 거실 (서브 2) | ON/OFF만 |
| `Light4` | 게임방 (1) | ON/OFF만 |
| `Light5` | 게임방 (2) | ON/OFF만 |
| `Light6` | 침실 | ON/OFF만 |
| `Light7` | 아이방 | ON/OFF만 |

### 속성

#### 전원 제어

**토픽:** `homenet/Light{id}/power/[state|command]`

**값:**
- `ON` - 조명 켜짐
- `OFF` - 조명 꺼짐

**예제 - 침실등 켜기:**
```bash
mosquitto_pub -t "homenet/Light6/power/command" -m "ON"
```

**예제 - 거실등 상태 구독:**
```bash
mosquitto_sub -t "homenet/Light1/power/state"
# 수신: ON
```

#### 밝기 제어 (Light1 전용)

**토픽:** `homenet/Light1/brightness/[state|command]`

**값:**
- `0` - OFF
- `1` - 최소 밝기 (~12%)
- `2` - 레벨 2 (~25%)
- `3` - 레벨 3 (~37%)
- `4` - 레벨 4 (~50%)
- `5` - 레벨 5 (~62%)
- `6` - 레벨 6 (~75%)
- `7` - 레벨 7 (~87%)
- `8` - 최대 밝기 (100%)

**예제 - 밝기 50%로 설정:**
```bash
mosquitto_pub -t "homenet/Light1/brightness/command" -m "4"
```

**예제 - 현재 밝기 읽기:**
```bash
mosquitto_sub -t "homenet/Light1/brightness/state"
# 수신: 5
```

### 요청/응답 예제

#### 예제 1: 모든 조명 끄기

```bash
# 거실등
mosquitto_pub -h 192.168.1.50 -u homeassistant -P password \
  -t "homenet/Light1/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light2/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light3/power/command" -m "OFF"

# 나머지 방
mosquitto_pub -t "homenet/Light4/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light5/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light6/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light7/power/command" -m "OFF"
```

#### 예제 2: 무드 조명 설정 (메인 조명 어둡게)

```bash
mosquitto_pub -t "homenet/Light1/brightness/command" -m "2"
```

**예상 응답:**
```
homenet/Light1/power/state → ON
homenet/Light1/brightness/state → 2
```

---

## 온도조절기 API

### 디바이스

| 디바이스 ID | 위치 | 온도 범위 |
|-----------|------|----------|
| `Thermo1` | 거실 | 5°C - 28°C |
| `Thermo2` | 게임방 | 5°C - 28°C |
| `Thermo3` | 침실 | 5°C - 28°C |
| `Thermo4` | 아이방 | 5°C - 28°C |

### 속성

#### 전원 제어

**토픽:** `homenet/Thermo{id}/power/[state|command]`

**값:**
- `heat` - 난방 모드 활성화
- `off` - 난방 비활성화

**예제 - 침실 난방 켜기:**
```bash
mosquitto_pub -t "homenet/Thermo3/power/command" -m "heat"
```

#### 설정 온도

**토픽:** `homenet/Thermo{id}/setTemp/[state|command]`

**값:**
- 정수 문자열: `5` ~ `28` (섭씨 온도)
- `0` - "off" 상태를 나타내는 특수 값

**예제 - 거실 온도 22°C로 설정:**
```bash
mosquitto_pub -t "homenet/Thermo1/setTemp/command" -m "22"
```

**예제 - 목표 온도 읽기:**
```bash
mosquitto_sub -t "homenet/Thermo1/setTemp/state"
# 수신: 22
```

#### 현재 온도 (읽기 전용)

**토픽:** `homenet/Thermo{id}/curTemp/state`

**값:**
- 정수 문자열: 현재 측정된 섭씨 온도

**예제 - 침실 온도 모니터링:**
```bash
mosquitto_sub -t "homenet/Thermo3/curTemp/state"
# 수신: 20
```

### 요청/응답 예제

#### 예제 1: 난방을 23°C로 켜기

**요청:**
```bash
# 방법 1: 온도 설정 (자동으로 난방 활성화)
mosquitto_pub -t "homenet/Thermo1/setTemp/command" -m "23"

# 방법 2: 명시적으로 전원 켜기 + 온도 설정
mosquitto_pub -t "homenet/Thermo1/power/command" -m "heat"
mosquitto_pub -t "homenet/Thermo1/setTemp/command" -m "23"
```

**응답:**
```
homenet/Thermo1/power/state → heat
homenet/Thermo1/setTemp/state → 23
homenet/Thermo1/curTemp/state → 20  (측정 온도)
```

#### 예제 2: 난방 끄기

**요청:**
```bash
mosquitto_pub -t "homenet/Thermo2/power/command" -m "off"
```

**응답:**
```
homenet/Thermo2/power/state → off
homenet/Thermo2/setTemp/state → 0
```

#### 예제 3: 온도 변경 스케줄

**Home Assistant 자동화 예제:**
```yaml
automation:
  - alias: "아침 난방"
    trigger:
      - platform: time
        at: "06:00:00"
    action:
      - service: mqtt.publish
        data:
          topic: "homenet/Thermo1/setTemp/command"
          payload: "22"
      - service: mqtt.publish
        data:
          topic: "homenet/Thermo3/setTemp/command"
          payload: "20"
```

---

## 환기팬 API

### 디바이스

| 디바이스 ID | 위치 | 모드 |
|-----------|------|------|
| `Fan1` | 메인 환기 | 5가지 속도 모드 + 전원 |

### 속성

#### 전원 제어

**토픽:** `homenet/Fan1/power/[state|command]`

**값:**
- `ON` - 팬 작동
- `OFF` - 팬 정지

**예제 - 팬 켜기:**
```bash
mosquitto_pub -t "homenet/Fan1/power/command" -m "ON"
```

#### 속도 제어

**토픽:** `homenet/Fan1/speed/[state|command]`

**값:**
- `low` - 약풍 (조용한 동작)
- `medium` - 중풍 (균형)
- `high` - 강풍 (최대 환기)
- `auto` - 자동 속도 제어
- `night` - 야간 모드 (바이패스/초조용)

**예제 - 중풍으로 설정:**
```bash
mosquitto_pub -t "homenet/Fan1/speed/command" -m "medium"
```

### 요청/응답 예제

#### 예제 1: 약풍으로 팬 켜기

**요청:**
```bash
mosquitto_pub -t "homenet/Fan1/speed/command" -m "low"
# 속도 설정 시 자동으로 팬 켜짐
```

**응답:**
```
homenet/Fan1/power/state → ON
homenet/Fan1/speed/state → low
```

#### 예제 2: 자동 모드 활성화

**요청:**
```bash
mosquitto_pub -t "homenet/Fan1/speed/command" -m "auto"
```

**응답:**
```
homenet/Fan1/power/state → ON
homenet/Fan1/speed/state → auto
```

#### 예제 3: 팬 끄기

**요청:**
```bash
mosquitto_pub -t "homenet/Fan1/power/command" -m "OFF"
```

**응답:**
```
homenet/Fan1/power/state → OFF
homenet/Fan1/speed/state → low  (마지막 알려진 속도)
```

---

## 가스밸브 API

### 디바이스

| 디바이스 ID | 기능 | 안전 레벨 |
|-----------|------|-----------|
| `Gas1` | 메인 가스밸브 | 긴급 차단 |

### 속성

#### 전원 제어 (밸브 상태)

**토픽:** `homenet/Gas1/power/[state|command]`

**값:**
- `ON` - 밸브 열림 (가스 흐름) - **위험 상태**
- `OFF` - 밸브 닫힘 (가스 차단) - **안전 상태**

**⚠️ 안전 경고:** 긴급 상황 시 밸브를 닫기 위해 `OFF` 명령만 전송하세요. 안전상의 이유로 시스템은 원격으로 가스밸브를 여는 것을 지원하지 않습니다.

**예제 - 긴급 가스 차단:**
```bash
mosquitto_pub -t "homenet/Gas1/power/command" -m "OFF"
```

### 요청/응답 예제

#### 예제 1: 긴급 차단

**요청:**
```bash
mosquitto_pub -t "homenet/Gas1/power/command" -m "OFF"
```

**응답:**
```
homenet/Gas1/power/state → OFF
```

#### 예제 2: 가스밸브 상태 모니터링

**요청:**
```bash
mosquitto_sub -t "homenet/Gas1/power/state"
```

**응답:**
```
ON  # 밸브 현재 열림
```

---

## 도어센서 API

### 디바이스

| 디바이스 ID | 위치 | 타입 |
|-----------|------|------|
| `Door1` | 현관문 | 접촉 센서 |
| `Door2` | 공동현관 | 접촉 센서 |

### 속성

#### 열림 상태 (읽기 전용)

**토픽:** `homenet/Door{id}/open/state`

**값:**
- `On` - 문 열림
- `Off` - 문 닫힘

**참고:** 읽기 전용 센서입니다. command 토픽은 없습니다.

**예제 - 현관문 모니터링:**
```bash
mosquitto_sub -t "homenet/Door1/open/state"
# 수신: Off  # 문 닫힘
```

### 요청/응답 예제

#### 예제 1: 모든 문 확인

**요청:**
```bash
mosquitto_sub -t "homenet/Door1/open/state"
mosquitto_sub -t "homenet/Door2/open/state"
```

**응답:**
```
homenet/Door1/open/state → Off
homenet/Door2/open/state → Off
```

#### 예제 2: 문 열림 알림 자동화

**Home Assistant 자동화:**
```yaml
automation:
  - alias: "현관문 열림 알림"
    trigger:
      - platform: mqtt
        topic: "homenet/Door1/open/state"
        payload: "On"
    action:
      - service: notify.mobile_app
        data:
          message: "현관문이 열렸습니다!"
```

---

## Home Assistant 통합 예제

### MQTT 조명 엔티티

```yaml
# configuration.yaml
light:
  - platform: mqtt
    name: "거실 메인 조명"
    state_topic: "homenet/Light1/power/state"
    command_topic: "homenet/Light1/power/command"
    brightness_state_topic: "homenet/Light1/brightness/state"
    brightness_command_topic: "homenet/Light1/brightness/command"
    brightness_scale: 8
    payload_on: "ON"
    payload_off: "OFF"
    optimistic: false
    qos: 1
    retain: true
```

### MQTT 온도조절기 엔티티

```yaml
climate:
  - platform: mqtt
    name: "거실 온도조절기"
    modes:
      - "off"
      - "heat"
    mode_state_topic: "homenet/Thermo1/power/state"
    mode_command_topic: "homenet/Thermo1/power/command"
    temperature_state_topic: "homenet/Thermo1/setTemp/state"
    temperature_command_topic: "homenet/Thermo1/setTemp/command"
    current_temperature_topic: "homenet/Thermo1/curTemp/state"
    min_temp: 5
    max_temp: 28
    temp_step: 1
    optimistic: false
    qos: 1
```

### MQTT 팬 엔티티

```yaml
fan:
  - platform: mqtt
    name: "환기팬"
    state_topic: "homenet/Fan1/power/state"
    command_topic: "homenet/Fan1/power/command"
    speed_state_topic: "homenet/Fan1/speed/state"
    speed_command_topic: "homenet/Fan1/speed/command"
    speeds:
      - "low"
      - "medium"
      - "high"
      - "auto"
      - "night"
    payload_on: "ON"
    payload_off: "OFF"
    optimistic: false
    qos: 1
```

### MQTT 이진 센서 (문)

```yaml
binary_sensor:
  - platform: mqtt
    name: "현관문"
    state_topic: "homenet/Door1/open/state"
    payload_on: "On"
    payload_off: "Off"
    device_class: door
    qos: 1
```

### MQTT 스위치 (가스밸브 - 긴급용만)

```yaml
switch:
  - platform: mqtt
    name: "가스밸브 긴급 차단"
    state_topic: "homenet/Gas1/power/state"
    command_topic: "homenet/Gas1/power/command"
    payload_on: "ON"
    payload_off: "OFF"
    optimistic: false
    icon: mdi:gas-cylinder
    qos: 1
```

### 완전한 씬(Scene) 예제

```yaml
# scenes.yaml
- name: "취침 모드"
  entities:
    # 모든 조명 끄기
    light.living_room_main_light: off
    light.living_room_light_2: off
    light.living_room_light_3: off
    light.game_room_light_1: off
    light.game_room_light_2: off
    light.bedroom_light: off
    light.kids_room_light: off

    # 침실 난방 20°C로 설정
    climate.bedroom_thermostat:
      state: heat
      temperature: 20

    # 나머지 온도조절기 끄기
    climate.living_room_thermostat: off
    climate.game_room_thermostat: off

    # 팬 야간 모드로 설정
    fan.ventilation_fan:
      state: on
      speed: night
```

---

## 에러 처리

### 일반적인 문제

#### 1. 명령 실행 안 됨

**증상:** 명령을 발행했지만 상태가 변경되지 않음

**가능한 원인:**
- 월패드 무응답 (RS485 연결 확인)
- 명령이 큐에 있지만 ACK 미수신
- MQTT 브로커 오프라인

**디버그 단계:**
```bash
# MQTT 연결 확인
mosquitto_sub -h 192.168.1.50 -u user -P pass -t "#" -v

# 애드온 로그 확인
docker logs hassio_addon_wallpad

# RS485 연결 확인 (애드온 컨테이너 내부)
cat /dev/ttyUSB0  # 16진수 데이터 스트림 표시되어야 함
```

#### 2. 상태 업데이트 안 됨

**증상:** 월패드에서 물리적 버튼 누름이 HA에 업데이트되지 않음

**가능한 원인:**
- 파서가 패킷 형식 인식 못 함
- MQTT 발행 실패
- Home Assistant가 토픽 구독 안 함

**디버그 단계:**
```bash
# 모든 MQTT 트래픽 모니터링
mosquitto_sub -h 192.168.1.50 -u user -P pass -t "homenet/#" -v

# 파싱 에러에 대한 애드온 로그 확인
# 찾을 내용: "Unknown packet: XX XX XX..."
```

#### 3. 밝기 제어 작동 안 함

**증상:** 밝기 명령이 효과 없음

**가능한 원인:**
- Light1만 밝기 지원 (나머지는 이진)
- 잘못된 밝기 값 (0-8이어야 함)

**해결책:**
```bash
# 디바이스가 밝기 지원하는지 확인
# 다음만 작동:
mosquitto_pub -t "homenet/Light1/brightness/command" -m "5"

# 다음은 작동 안 함 (이진 조명):
mosquitto_pub -t "homenet/Light2/brightness/command" -m "5"  ❌
```

---

## 모범 사례

### 1. 토픽 명명

✅ **권장:**
```
homenet/Light1/power/command
homenet/Thermo3/setTemp/state
```

❌ **비권장:**
```
homenet/light1/POWER/cmd        # 대소문자 구분 중요
homenet/Light1/command/power    # 잘못된 순서
```

### 2. 페이로드 형식

✅ **권장:**
```bash
# 문자열 값, 대소문자 구분
mosquitto_pub -t "homenet/Light1/power/command" -m "ON"
mosquitto_pub -t "homenet/Thermo1/setTemp/command" -m "22"
```

❌ **비권장:**
```bash
# 잘못된 대소문자
mosquitto_pub -m "on"           # "ON"이어야 함

# 잘못된 타입
mosquitto_pub -m "true"         # "ON"이어야 함
mosquitto_pub -m 1              # "ON"이어야 함
```

### 3. State vs Command

✅ **권장:**
```bash
# 명령으로 디바이스 제어
mosquitto_pub -t "homenet/Light1/power/command" -m "ON"

# 상태는 읽기 전용, 애드온이 발행
mosquitto_sub -t "homenet/Light1/power/state"
```

❌ **비권장:**
```bash
# state 토픽에 수동 발행 금지
mosquitto_pub -t "homenet/Light1/power/state" -m "ON"  ❌
```

### 4. 속도 제한

✅ **권장:**
```bash
# 명령 간 최소 150ms 대기
mosquitto_pub -t "homenet/Light1/power/command" -m "ON"
sleep 0.2
mosquitto_pub -t "homenet/Light2/power/command" -m "ON"
```

❌ **비권장:**
```bash
# 연속 명령 (일부 누락될 수 있음)
for i in {1..7}; do
  mosquitto_pub -t "homenet/Light$i/power/command" -m "OFF"
done  # 너무 빠름!
```

### 5. 에러 처리

✅ **권장:**
```yaml
# Home Assistant 자동화에 에러 처리 포함
automation:
  - alias: "취침 씬"
    action:
      - service: mqtt.publish
        data:
          topic: "homenet/Light1/power/command"
          payload: "OFF"
          retain: true
      - delay: 00:00:00.2  # 200ms 대기
      - service: mqtt.publish
        data:
          topic: "homenet/Light2/power/command"
          payload: "OFF"
          retain: true
```

### 6. 보안

✅ **권장:**
```bash
# 항상 인증 사용
mosquitto_pub -h 192.168.1.50 -u homeassistant -P strong_password \
  -t "homenet/Gas1/power/command" -m "OFF"

# 가능하면 TLS 사용
mosquitto_pub -h broker.local -p 8883 --cafile ca.crt \
  -u user -P pass -t "topic" -m "value"
```

❌ **비권장:**
```bash
# 인증 없음 (보안 위험!)
mosquitto_pub -h 192.168.1.50 -t "homenet/Gas1/power/command" -m "OFF"  ❌
```

---

## API 테스트

### 빠른 테스트 명령

```bash
# MQTT 자격증명 설정
MQTT_HOST="192.168.1.50"
MQTT_USER="homeassistant"
MQTT_PASS="password"

# 모든 조명 테스트
for i in {1..7}; do
  mosquitto_pub -h $MQTT_HOST -u $MQTT_USER -P $MQTT_PASS \
    -t "homenet/Light$i/power/command" -m "ON"
  sleep 0.2
done

# 밝기 레벨 테스트 (Light1만)
for brightness in {0..8}; do
  mosquitto_pub -h $MQTT_HOST -u $MQTT_USER -P $MQTT_PASS \
    -t "homenet/Light1/brightness/command" -m "$brightness"
  sleep 1
done

# 온도조절기 온도 범위 테스트
for temp in {20..25}; do
  mosquitto_pub -h $MQTT_HOST -u $MQTT_USER -P $MQTT_PASS \
    -t "homenet/Thermo1/setTemp/command" -m "$temp"
  sleep 2
done

# 모든 상태 변경 모니터링
mosquitto_sub -h $MQTT_HOST -u $MQTT_USER -P $MQTT_PASS \
  -t "homenet/+/+/state" -v
```

---

## API 변경 로그

### 버전 0.2.6 (현재)
- 동일 토픽 명령에 대한 지연 처리 추가
- 상태 동기화 안정성 개선

### 버전 0.2.3-0.2.5
- 명령 확인 처리 강화
- 성공한 명령에 대한 MQTT 상태 피드백 추가

### 버전 0.1.7-0.1.8
- 추가 온도조절기 존 추가 (Thermo3, Thermo4)
- 조명 제어 명령 확장

### 버전 0.1.4
- 초기 환기팬 제어 구현
- 팬 속도 모드 추가 (low/medium/high/auto/night)

---

## 지원 및 커뮤니티

- **이슈**: GitHub Issues를 통해 버그 리포트
- **커뮤니티**: [Home Assistant 네이버 카페](https://cafe.naver.com/koreassistant)
- **문서**: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md)

---

**API 버전**: 1.0
**호환 애드온 버전**: 0.2.6+
**최종 업데이트**: 2024년 7월 15일
