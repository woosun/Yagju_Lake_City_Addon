# MQTT API Reference

Complete API documentation for the Yagju Lake City Wallpad Controller MQTT interface.

## Table of Contents
- [Overview](#overview)
- [Topic Structure](#topic-structure)
- [Device Types](#device-types)
- [Lighting API](#lighting-api)
- [Thermostat API](#thermostat-api)
- [Ventilation Fan API](#ventilation-fan-api)
- [Gas Valve API](#gas-valve-api)
- [Door Sensor API](#door-sensor-api)
- [Integration Examples](#integration-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

The MQTT API provides a standardized interface for controlling and monitoring wallpad devices through the Home Assistant ecosystem.

### Protocol Details

| Parameter | Value |
|-----------|-------|
| **Protocol** | MQTT v3.1.1 |
| **QoS Level** | 1 (At-least-once delivery) |
| **Retain Flag** | `true` (Last state persisted) |
| **Topic Prefix** | `homenet` |
| **Payload Format** | Plain text string |

### Communication Pattern

```
┌─────────────┐                 ┌──────────────┐                 ┌──────────┐
│ Home        │                 │ MQTT Broker  │                 │ Wallpad  │
│ Assistant   │                 │ (Mosquitto)  │                 │ Add-on   │
└──────┬──────┘                 └──────┬───────┘                 └────┬─────┘
       │                               │                              │
       │ PUBLISH command               │                              │
       ├──────────────────────────────>│                              │
       │                               │ SUBSCRIBE command            │
       │                               │────────────────────────────>│
       │                               │                              │
       │                               │                     Execute command
       │                               │                              │
       │                               │  PUBLISH state               │
       │ SUBSCRIBE state               │<─────────────────────────────┤
       │<──────────────────────────────┤                              │
       │                               │                              │
```

---

## Topic Structure

### Standard Topic Format

```
homenet/{deviceType}{deviceId}/{property}/{direction}
```

**Components:**
- `{deviceType}`: Device category (Light, Thermo, Fan, Gas, Door)
- `{deviceId}`: Numeric identifier (1-7 for lights, 1-4 for thermostats, etc.)
- `{property}`: Device property (power, brightness, setTemp, curTemp, speed, open)
- `{direction}`: Message direction
  - `state` - Published by add-on (device → HA)
  - `command` - Subscribed by add-on (HA → device)

### Examples

```
homenet/Light1/power/state          ← Device state
homenet/Light1/power/command        → Control command

homenet/Thermo3/setTemp/state       ← Current target temperature
homenet/Thermo3/setTemp/command     → Change target temperature
```

---

## Device Types

| Device Type | Device IDs | Properties | Description |
|-------------|-----------|------------|-------------|
| **Light** | 1-7 | power, brightness | Multi-zone lighting control |
| **Thermo** | 1-4 | power, setTemp, curTemp | Zone heating/thermostat |
| **Fan** | 1 | power, speed | Ventilation system |
| **Gas** | 1 | power | Gas valve safety control |
| **Door** | 1-2 | open | Door status sensors |

---

## Lighting API

### Devices

| Device ID | Zone | Brightness Levels |
|-----------|------|-------------------|
| `Light1` | Living Room (Main) | 0-8 (9 levels) |
| `Light2` | Living Room (Sub 1) | ON/OFF only |
| `Light3` | Living Room (Sub 2) | ON/OFF only |
| `Light4` | Game Room (1) | ON/OFF only |
| `Light5` | Game Room (2) | ON/OFF only |
| `Light6` | Bedroom | ON/OFF only |
| `Light7` | Kids Room | ON/OFF only |

### Properties

#### Power Control

**Topic:** `homenet/Light{id}/power/[state|command]`

**Values:**
- `ON` - Light is on
- `OFF` - Light is off

**Example - Turn on bedroom light:**
```
PUBLISH homenet/Light6/power/command
PAYLOAD: ON
```

**Example - Subscribe to living room light state:**
```
SUBSCRIBE homenet/Light1/power/state
RECEIVED: ON
```

#### Brightness Control (Light1 only)

**Topic:** `homenet/Light1/brightness/[state|command]`

**Values:**
- `0` - OFF
- `1` - Minimum brightness (~12%)
- `2` - Level 2 (~25%)
- `3` - Level 3 (~37%)
- `4` - Level 4 (~50%)
- `5` - Level 5 (~62%)
- `6` - Level 6 (~75%)
- `7` - Level 7 (~87%)
- `8` - Maximum brightness (100%)

**Example - Set brightness to 50%:**
```
PUBLISH homenet/Light1/brightness/command
PAYLOAD: 4
```

**Example - Read current brightness:**
```
SUBSCRIBE homenet/Light1/brightness/state
RECEIVED: 5
```

### Request/Response Examples

#### Example 1: Turn OFF all lights

```bash
# Living room lights
mosquitto_pub -h 192.168.1.50 -u homeassistant -P password \
  -t "homenet/Light1/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light2/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light3/power/command" -m "OFF"

# Other rooms
mosquitto_pub -t "homenet/Light4/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light5/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light6/power/command" -m "OFF"
mosquitto_pub -t "homenet/Light7/power/command" -m "OFF"
```

#### Example 2: Set mood lighting (dimmed main light)

```bash
mosquitto_pub -t "homenet/Light1/brightness/command" -m "2"
```

**Expected Response:**
```
homenet/Light1/power/state → ON
homenet/Light1/brightness/state → 2
```

---

## Thermostat API

### Devices

| Device ID | Zone | Temperature Range |
|-----------|------|-------------------|
| `Thermo1` | Living Room | 5°C - 28°C |
| `Thermo2` | Game Room | 5°C - 28°C |
| `Thermo3` | Bedroom | 5°C - 28°C |
| `Thermo4` | Kids Room | 5°C - 28°C |

### Properties

#### Power Control

**Topic:** `homenet/Thermo{id}/power/[state|command]`

**Values:**
- `heat` - Heating mode enabled
- `off` - Heating disabled

**Example - Enable heating in bedroom:**
```
PUBLISH homenet/Thermo3/power/command
PAYLOAD: heat
```

#### Set Temperature

**Topic:** `homenet/Thermo{id}/setTemp/[state|command]`

**Values:**
- Integer string: `5` to `28` (degrees Celsius)
- `0` - Special value indicating "off" state

**Example - Set living room to 22°C:**
```
PUBLISH homenet/Thermo1/setTemp/command
PAYLOAD: 22
```

**Example - Read target temperature:**
```
SUBSCRIBE homenet/Thermo1/setTemp/state
RECEIVED: 22
```

#### Current Temperature (Read-only)

**Topic:** `homenet/Thermo{id}/curTemp/state`

**Values:**
- Integer string: Current measured temperature in Celsius

**Example - Monitor bedroom temperature:**
```
SUBSCRIBE homenet/Thermo3/curTemp/state
RECEIVED: 20
```

### Request/Response Examples

#### Example 1: Turn on heating to 23°C

**Request:**
```bash
# Method 1: Set temperature (auto-enables heating)
mosquitto_pub -t "homenet/Thermo1/setTemp/command" -m "23"

# Method 2: Explicit power on + temperature
mosquitto_pub -t "homenet/Thermo1/power/command" -m "heat"
mosquitto_pub -t "homenet/Thermo1/setTemp/command" -m "23"
```

**Response:**
```
homenet/Thermo1/power/state → heat
homenet/Thermo1/setTemp/state → 23
homenet/Thermo1/curTemp/state → 20  (measured temp)
```

#### Example 2: Turn off heating

**Request:**
```bash
mosquitto_pub -t "homenet/Thermo2/power/command" -m "off"
```

**Response:**
```
homenet/Thermo2/power/state → off
homenet/Thermo2/setTemp/state → 0
```

#### Example 3: Schedule temperature change

**Automation Example (Home Assistant):**
```yaml
automation:
  - alias: "Morning heating"
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

## Ventilation Fan API

### Device

| Device ID | Location | Modes |
|-----------|----------|-------|
| `Fan1` | Main ventilation | 5 speed modes + power |

### Properties

#### Power Control

**Topic:** `homenet/Fan1/power/[state|command]`

**Values:**
- `ON` - Fan running
- `OFF` - Fan stopped

**Example - Turn on fan:**
```
PUBLISH homenet/Fan1/power/command
PAYLOAD: ON
```

#### Speed Control

**Topic:** `homenet/Fan1/speed/[state|command]`

**Values:**
- `low` - Low speed (quiet operation)
- `medium` - Medium speed (balanced)
- `high` - High speed (maximum ventilation)
- `auto` - Automatic speed control
- `night` - Night mode (bypass/ultra-quiet)

**Example - Set to medium speed:**
```
PUBLISH homenet/Fan1/speed/command
PAYLOAD: medium
```

### Request/Response Examples

#### Example 1: Turn on fan at low speed

**Request:**
```bash
mosquitto_pub -t "homenet/Fan1/speed/command" -m "low"
# Setting speed automatically turns on the fan
```

**Response:**
```
homenet/Fan1/power/state → ON
homenet/Fan1/speed/state → low
```

#### Example 2: Enable auto mode

**Request:**
```bash
mosquitto_pub -t "homenet/Fan1/speed/command" -m "auto"
```

**Response:**
```
homenet/Fan1/power/state → ON
homenet/Fan1/speed/state → auto
```

#### Example 3: Turn off fan

**Request:**
```bash
mosquitto_pub -t "homenet/Fan1/power/command" -m "OFF"
```

**Response:**
```
homenet/Fan1/power/state → OFF
homenet/Fan1/speed/state → low  (last known speed)
```

---

## Gas Valve API

### Device

| Device ID | Function | Safety Level |
|-----------|----------|--------------|
| `Gas1` | Main gas valve | Emergency shut-off |

### Properties

#### Power Control (Valve State)

**Topic:** `homenet/Gas1/power/[state|command]`

**Values:**
- `ON` - Valve open (gas flowing) - **DANGER STATE**
- `OFF` - Valve closed (gas shut off) - **SAFE STATE**

**⚠️ SAFETY WARNING:** Only send `OFF` commands to close the valve in emergencies. The system does not support remotely opening the gas valve for safety reasons.

**Example - Emergency gas shut-off:**
```
PUBLISH homenet/Gas1/power/command
PAYLOAD: OFF
```

### Request/Response Examples

#### Example 1: Emergency shut-off

**Request:**
```bash
mosquitto_pub -t "homenet/Gas1/power/command" -m "OFF"
```

**Response:**
```
homenet/Gas1/power/state → OFF
```

#### Example 2: Monitor gas valve status

**Request:**
```bash
mosquitto_sub -t "homenet/Gas1/power/state"
```

**Response:**
```
ON  # Valve currently open
```

---

## Door Sensor API

### Devices

| Device ID | Location | Type |
|-----------|----------|------|
| `Door1` | Front door | Contact sensor |
| `Door2` | Common entrance | Contact sensor |

### Properties

#### Open Status (Read-only)

**Topic:** `homenet/Door{id}/open/state`

**Values:**
- `On` - Door is open
- `Off` - Door is closed

**Note:** This is a read-only sensor. No command topic exists.

**Example - Monitor front door:**
```
SUBSCRIBE homenet/Door1/open/state
RECEIVED: Off  # Door closed
```

### Request/Response Examples

#### Example 1: Check all doors

**Request:**
```bash
mosquitto_sub -t "homenet/Door1/open/state"
mosquitto_sub -t "homenet/Door2/open/state"
```

**Response:**
```
homenet/Door1/open/state → Off
homenet/Door2/open/state → Off
```

#### Example 2: Door open alert automation

**Home Assistant Automation:**
```yaml
automation:
  - alias: "Front door open alert"
    trigger:
      - platform: mqtt
        topic: "homenet/Door1/open/state"
        payload: "On"
    action:
      - service: notify.mobile_app
        data:
          message: "Front door opened!"
```

---

## Integration Examples

### Home Assistant Configuration

#### MQTT Light Entity

```yaml
# configuration.yaml
light:
  - platform: mqtt
    name: "Living Room Main Light"
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

#### MQTT Climate Entity (Thermostat)

```yaml
climate:
  - platform: mqtt
    name: "Living Room Thermostat"
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

#### MQTT Fan Entity

```yaml
fan:
  - platform: mqtt
    name: "Ventilation Fan"
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

#### MQTT Binary Sensor (Door)

```yaml
binary_sensor:
  - platform: mqtt
    name: "Front Door"
    state_topic: "homenet/Door1/open/state"
    payload_on: "On"
    payload_off: "Off"
    device_class: door
    qos: 1
```

#### MQTT Switch (Gas Valve - Emergency Only)

```yaml
switch:
  - platform: mqtt
    name: "Gas Valve Emergency Shutoff"
    state_topic: "homenet/Gas1/power/state"
    command_topic: "homenet/Gas1/power/command"
    payload_on: "ON"
    payload_off: "OFF"
    optimistic: false
    icon: mdi:gas-cylinder
    qos: 1
```

### Complete Scene Example

```yaml
# scenes.yaml
- name: "Good Night"
  entities:
    # Turn off all lights
    light.living_room_main_light: off
    light.living_room_light_2: off
    light.living_room_light_3: off
    light.game_room_light_1: off
    light.game_room_light_2: off
    light.bedroom_light: off
    light.kids_room_light: off

    # Set bedroom heating to 20°C
    climate.bedroom_thermostat:
      state: heat
      temperature: 20

    # Turn off other thermostats
    climate.living_room_thermostat: off
    climate.game_room_thermostat: off

    # Set fan to night mode
    fan.ventilation_fan:
      state: on
      speed: night
```

---

## Error Handling

### Common Issues

#### 1. Command Not Executed

**Symptom:** Publish command but no state change

**Possible Causes:**
- Wallpad not responding (check RS485 connection)
- Command queued but ACK not received
- MQTT broker offline

**Debug Steps:**
```bash
# Check MQTT connection
mosquitto_sub -h 192.168.1.50 -u user -P pass -t "#" -v

# Check add-on logs
docker logs hassio_addon_wallpad

# Verify RS485 connection (in add-on container)
cat /dev/ttyUSB0  # Should show hex data stream
```

#### 2. State Not Updating

**Symptom:** Physical button press on wallpad doesn't update HA

**Possible Causes:**
- Parser not recognizing packet format
- MQTT publish failing
- Home Assistant not subscribed to topic

**Debug Steps:**
```bash
# Monitor all MQTT traffic
mosquitto_sub -h 192.168.1.50 -u user -P pass -t "homenet/#" -v

# Check add-on logs for parsing errors
# Look for: "Unknown packet: XX XX XX..."
```

#### 3. Brightness Not Working

**Symptom:** Brightness commands have no effect

**Possible Causes:**
- Only Light1 supports brightness (others are binary)
- Invalid brightness value (must be 0-8)

**Solution:**
```bash
# Verify device supports brightness
# Only this will work:
mosquitto_pub -t "homenet/Light1/brightness/command" -m "5"

# These will NOT work (binary lights):
mosquitto_pub -t "homenet/Light2/brightness/command" -m "5"  ❌
```

### Retry Logic

The add-on implements automatic retry for failed commands:

1. Command added to queue
2. Sent to wallpad
3. Wait for ACK (timeout: 1000ms)
4. If no ACK, retry up to 3 times
5. Log error if all retries fail

---

## Best Practices

### 1. Topic Naming

✅ **DO:**
```
homenet/Light1/power/command
homenet/Thermo3/setTemp/state
```

❌ **DON'T:**
```
homenet/light1/POWER/cmd        # Case sensitivity matters
homenet/Light1/command/power    # Wrong order
```

### 2. Payload Format

✅ **DO:**
```bash
# String values, case-sensitive
mosquitto_pub -t "homenet/Light1/power/command" -m "ON"
mosquitto_pub -t "homenet/Thermo1/setTemp/command" -m "22"
```

❌ **DON'T:**
```bash
# Wrong case
mosquitto_pub -m "on"           # Should be "ON"

# Wrong type
mosquitto_pub -m "true"         # Should be "ON"
mosquitto_pub -m 1              # Should be "ON"
```

### 3. State vs Command

✅ **DO:**
```bash
# Commands control devices
mosquitto_pub -t "homenet/Light1/power/command" -m "ON"

# States are read-only, published by add-on
mosquitto_sub -t "homenet/Light1/power/state"
```

❌ **DON'T:**
```bash
# Never publish to state topics manually
mosquitto_pub -t "homenet/Light1/power/state" -m "ON"  ❌
```

### 4. Rate Limiting

✅ **DO:**
```bash
# Wait at least 150ms between commands
mosquitto_pub -t "homenet/Light1/power/command" -m "ON"
sleep 0.2
mosquitto_pub -t "homenet/Light2/power/command" -m "ON"
```

❌ **DON'T:**
```bash
# Rapid-fire commands (may be dropped)
for i in {1..7}; do
  mosquitto_pub -t "homenet/Light$i/power/command" -m "OFF"
done  # Too fast!
```

### 5. Error Handling

✅ **DO:**
```yaml
# Home Assistant automation with error handling
automation:
  - alias: "Goodnight scene"
    action:
      - service: mqtt.publish
        data:
          topic: "homenet/Light1/power/command"
          payload: "OFF"
          retain: true
      - delay: 00:00:00.2  # Wait 200ms
      - service: mqtt.publish
        data:
          topic: "homenet/Light2/power/command"
          payload: "OFF"
          retain: true
```

### 6. Security

✅ **DO:**
```bash
# Always use authentication
mosquitto_pub -h 192.168.1.50 -u homeassistant -P strong_password \
  -t "homenet/Gas1/power/command" -m "OFF"

# Use TLS if possible
mosquitto_pub -h broker.local -p 8883 --cafile ca.crt \
  -u user -P pass -t "topic" -m "value"
```

❌ **DON'T:**
```bash
# No authentication (insecure!)
mosquitto_pub -h 192.168.1.50 -t "homenet/Gas1/power/command" -m "OFF"  ❌
```

---

## API Testing

### Quick Test Commands

```bash
# Set MQTT credentials
MQTT_HOST="192.168.1.50"
MQTT_USER="homeassistant"
MQTT_PASS="password"

# Test all lights
for i in {1..7}; do
  mosquitto_pub -h $MQTT_HOST -u $MQTT_USER -P $MQTT_PASS \
    -t "homenet/Light$i/power/command" -m "ON"
  sleep 0.2
done

# Test brightness levels (Light1 only)
for brightness in {0..8}; do
  mosquitto_pub -h $MQTT_HOST -u $MQTT_USER -P $MQTT_PASS \
    -t "homenet/Light1/brightness/command" -m "$brightness"
  sleep 1
done

# Test thermostat temperature range
for temp in {20..25}; do
  mosquitto_pub -h $MQTT_HOST -u $MQTT_USER -P $MQTT_PASS \
    -t "homenet/Thermo1/setTemp/command" -m "$temp"
  sleep 2
done

# Monitor all state changes
mosquitto_sub -h $MQTT_HOST -u $MQTT_USER -P $MQTT_PASS \
  -t "homenet/+/+/state" -v
```

---

## API Change Log

### Version 0.2.6 (Current)
- Added delay handling for identical topic commands
- Improved state synchronization reliability

### Version 0.2.3-0.2.5
- Enhanced command acknowledgment handling
- Added MQTT state feedback for successful commands

### Version 0.1.7-0.1.8
- Added additional thermostat zones (Thermo3, Thermo4)
- Expanded lighting control commands

### Version 0.1.4
- Initial ventilation fan control implementation
- Added fan speed modes (low/medium/high/auto/night)

---

## Support & Community

- **Issues**: Report bugs via GitHub Issues
- **Community**: [HA Korea Naver Cafe](https://cafe.naver.com/koreassistant)
- **Documentation**: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md)

---

**API Version**: 1.0
**Compatible Add-on Version**: 0.2.6+
**Last Updated**: 2024-01-15
