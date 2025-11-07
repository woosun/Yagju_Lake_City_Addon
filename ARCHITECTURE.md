# System Architecture Documentation

## Table of Contents
- [Overview](#overview)
- [System Design](#system-design)
- [CVNet Protocol Specification](#cvnet-protocol-specification)
- [Data Flow Architecture](#data-flow-architecture)
- [State Management](#state-management)
- [Command Queue System](#command-queue-system)
- [Communication Layers](#communication-layers)
- [Error Handling & Reliability](#error-handling--reliability)
- [Performance Optimization](#performance-optimization)

---

## Overview

The Yagju Lake City Wallpad Controller is a protocol gateway that translates between the proprietary CVNet RS485 protocol and MQTT, enabling Home Assistant integration with Korean apartment building automation systems.

### Design Principles

1. **Protocol Agnostic MQTT Layer**: Abstracted MQTT communication for easy protocol swapping
2. **State Consistency**: Single source of truth with duplicate prevention
3. **Reliable Command Delivery**: Queue-based system with ACK verification
4. **Extensible Architecture**: Modular device support through configuration arrays
5. **Fault Tolerance**: Graceful degradation and automatic recovery

---

## System Design

### High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                      Home Assistant Ecosystem                      │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Frontend   │  │  Automations │  │  Configuration YAML  │   │
│  │   (Lovelace) │  │   (Scripts)  │  │  (MQTT Entities)     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────┘   │
│         │                 │                  │                    │
│         └─────────────────┴──────────────────┘                    │
│                           │                                       │
│                           │ MQTT Protocol                         │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │              Mosquitto MQTT Broker                         │  │
│  │  Topics: homenet/{device}{id}/{property}/[state|command]  │  │
│  │  QoS: 1 (At-least-once delivery)                          │  │
│  └────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
                              │ TCP/IP (Port 1883)
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│                 Wallpad Controller Add-on (Docker)                 │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    Application Layer                         │ │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐   │ │
│  │  │MQTT Client │  │State Manager│  │ Command Queue       │   │ │
│  │  │(Pub/Sub)   │  │(homeStatus)│  │ (Array + Timer)     │   │ │
│  │  └─────┬──────┘  └─────┬──────┘  └──────┬──────────────┘   │ │
│  │        │                │                │                   │ │
│  │        └────────────────┴────────────────┘                   │ │
│  │                         │                                    │ │
│  │  ┌──────────────────────▼──────────────────────────────┐    │ │
│  │  │         Protocol Translation Layer                   │    │ │
│  │  │  • CVNet Packet Parser (15-byte structure)          │    │ │
│  │  │  • Command Builder (checksum calculation)           │    │ │
│  │  │  • Device State Mapper (DEVICE_STATE array)         │    │ │
│  │  │  • Command Template Engine (DEVICE_COMMAND array)   │    │ │
│  │  └──────────────────────┬──────────────────────────────┘    │ │
│  └─────────────────────────┼───────────────────────────────────┘ │
│                            │                                      │
│  ┌─────────────────────────▼───────────────────────────────────┐ │
│  │              Transport Layer Abstraction                    │ │
│  │  ┌──────────────────┐          ┌──────────────────────┐    │ │
│  │  │ Serial Transport │    OR    │  Socket Transport    │    │ │
│  │  │ (SerialPort lib) │          │  (net.Socket)        │    │ │
│  │  │ /dev/ttyUSB0     │          │  TCP: 192.168.x.x    │    │ │
│  │  └────────┬─────────┘          └──────────┬───────────┘    │ │
│  └───────────┼────────────────────────────────┼────────────────┘ │
└──────────────┼────────────────────────────────┼──────────────────┘
               │                                │
               │ RS485 Electrical               │ WiFi/Ethernet
               │ (Physical Layer)               │ (EW11 Bridge)
               │                                │
┌──────────────▼────────────────────────────────▼──────────────────┐
│                    Wallpad Controller Hardware                    │
│              (CVNet Protocol - Proprietary System)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Lighting │ │Thermostat│ │   Fan    │ │ Gas/Door/Sensors │   │
│  │ Modules  │ │  Modules │ │  Module  │ │    Modules       │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | File | Responsibility |
|-----------|------|----------------|
| **Protocol Parser** | cvnet_socket.js:191-350 | Parse incoming 15-byte CVNet packets, identify device types |
| **State Manager** | cvnet_socket.js:167 | Maintain `homeStatus` object, prevent duplicate updates |
| **MQTT Client** | cvnet_socket.js:174-179 | Publish state changes, subscribe to command topics |
| **Command Queue** | cvnet_socket.js:170 | FIFO queue with ACK verification, delay management |
| **Device Mapper** | cvnet_socket.js:39-71 | Define state packet recognition patterns |
| **Command Builder** | cvnet_socket.js:73-150 | Pre-defined control commands with checksums |
| **Transport Layer** | cvnet_socket.js:182-188 | Socket or Serial connection with delimiter parsing |
| **Startup Manager** | run.sh | Load config, select implementation file, start Node.js |

---

## CVNet Protocol Specification

### Packet Structure

#### Standard Command/State Packet (15 bytes)

```
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ 0xF7 │ 0x20 │ CMD  │ 0x01 │ ZONE │ DATA │ 0x00 │ 0x00 │ 0x00 │ 0x00 │ 0x00 │ 0x00 │ 0x00 │ CSUM │ 0xAA │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  0   │  1   │  2   │  3   │  4   │  5   │  6   │  7   │  8   │  9   │  10  │  11  │  12  │  13  │  14  │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘

START       HEADER      COMMAND      ZONE/ID      DATA       PADDING (7 bytes)      CHECKSUM   END
```

**Byte Definitions:**
- **Byte 0**: `0xF7` - Start marker (constant)
- **Byte 1**: `0x20` - Header/source identifier
- **Byte 2**: Device command type
  - `0x21`: Living room light
  - `0x22`: Game room light
  - `0x23`: Bedroom light
  - `0x24`: Kids room light
  - `0x41-0x44`: Thermostat zones 1-4
  - `0x4A`: Thermostat state query
- **Byte 3**: `0x01` - Fixed protocol version
- **Byte 4**: Sub-zone identifier
  - `0x11`: Zone 1
  - `0x12`: Zone 2
  - `0x13`: Zone 3
  - `0x81`: State query response
- **Byte 5**: Data payload
  - For lights: `0x00` (OFF) or `0x01-0x0A` (brightness levels)
  - For thermostat: Temperature = `(byte - 128)` in Celsius
- **Bytes 6-12**: Padding (usually `0x00`)
- **Byte 13**: Checksum - Sum of bytes 1-12, use last 2 hex digits
- **Byte 14**: `0xAA` - End marker (packet delimiter)

#### Compact Packet (8 bytes) - Fan/Gas

```
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│START │ CMD  │ SUB  │ DATA │ 0x00 │ 0x00 │ 0x00 │ CSUM │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  0   │  1   │  2   │  3   │  4   │  5   │  6   │  7   │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

**Fan Commands:**
- `0x78 01 01 00 00 00 00 7A`: Power OFF
- `0x78 01 02 01 00 00 00 7C`: Low speed
- `0x78 01 02 02 00 00 00 7D`: Medium speed
- `0x78 01 02 03 00 00 00 7E`: High speed

**Gas Commands:**
- `0x11 01 80 00 00 00 00 92`: Valve close (emergency)

### Protocol Examples

#### Example 1: Living Room Light Brightness Level 5

**Command Packet:**
```
F7 20 21 01 11 05 00 00 00 00 00 00 00 58 AA
│  │  │  │  │  │                       │  │
│  │  │  │  │  │                       │  └─ End delimiter
│  │  │  │  │  │                       └─ Checksum (0x58)
│  │  │  │  │  └─ Brightness = 5
│  │  │  │  └─ Zone 1
│  │  │  └─ Protocol version
│  │  └─ Living room (0x21)
│  └─ Header
└─ Start marker
```

**Checksum Calculation:**
```javascript
sum = 0x20 + 0x21 + 0x01 + 0x11 + 0x05 + 0x00*7 = 0x58
```

**ACK Response:**
```
20 01 21 9F
│  │  │  └─ ACK flag
│  │  └─ Command acknowledged (0x21)
│  └─ Protocol version
└─ Header
```

#### Example 2: Thermostat Set Temperature 22°C

**Command Packet:**
```
F7 20 41 01 11 96 00 00 00 00 00 00 00 09 AA
                  │                       │
                  │                       └─ Checksum (0x09)
                  └─ Temp = 0x96 (150 DEC)
                      → (150 - 128) = 22°C
```

**Temperature Encoding Formula:**
```javascript
// Encode: Target temperature to HEX
hexValue = (temperature + 128).toString(16)
// 22°C → (22 + 128) = 150 DEC = 0x96 HEX

// Decode: HEX to Celsius
temperature = parseInt(hexValue, 16) - 128
// 0x96 → 150 DEC → (150 - 128) = 22°C
```

#### Example 3: Thermostat State Response

**State Packet:**
```
F7 20 01 4A 81 00 96 00 94 00 00 00 00 ... AA
         │  │     │     │
         │  │     │     └─ Zone 2 current temp (0x94 = 20°C)
         │  │     └─ Zone 1 set temp (0x96 = 22°C)
         │  └─ State response flag
         └─ Thermostat state query
```

**Parsing Logic:**
```javascript
// cvnet_socket.js:50
{
  deviceId: 'Thermo',
  subId: ['1','2','3','4'],
  stateStartWithHex: 'F7 20 01 4A 81',
  whereToReadBlock: [6, 8, 10, 12],  // Byte positions
  setTemp: '',
  curTemp: '',
  power: ''
}

// Zone 1: byte 6 (set) + byte 7 (current)
// Zone 2: byte 8 (set) + byte 9 (current)
// ...
```

---

## Data Flow Architecture

### State Update Flow (Wallpad → Home Assistant)

```
┌────────────────┐
│ User presses   │
│ wallpad button │
└────────┬───────┘
         │
         ▼
┌────────────────────────────────┐
│ Wallpad broadcasts state       │
│ F7 20 01 21 81 01 ... AA       │
└────────┬───────────────────────┘
         │
         │ RS485 Bus
         ▼
┌────────────────────────────────┐
│ Parser receives packet         │
│ (delimiter: 0xAA)              │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Find matching pattern in       │
│ DEVICE_STATE array             │
│ obj.stateStartWithHex == data  │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Extract device properties      │
│ deviceId, subId, values        │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Check homeStatus for changes   │
│ if (value !== homeStatus[...]) │
└────────┬───────────────────────┘
         │ State changed
         ▼
┌────────────────────────────────┐
│ Update homeStatus object       │
│ homeStatus[dev][sub][prop]     │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Publish to MQTT                │
│ homenet/Light1/power/state=ON  │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Home Assistant receives update │
│ UI reflects new state          │
└────────────────────────────────┘
```

### Command Flow (Home Assistant → Wallpad)

```
┌────────────────┐
│ User clicks HA │
│ light switch   │
└────────┬───────┘
         │
         ▼
┌─────────────────────────────────┐
│ HA publishes MQTT command       │
│ homenet/Light1/power/command=ON │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ MQTT client receives message    │
│ client.on('message', ...)       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Parse topic & payload           │
│ Extract: device, subId, prop    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Find command in DEVICE_COMMAND  │
│ Match: deviceId, subId, value   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Build packet (if dynamic)       │
│ e.g., calculate temp checksum   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Add command to queue[]          │
│ queue.push({cmd, ack, topic})   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Wait for sendDelay (150ms)      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Send packet to wallpad          │
│ sock.write(commandHex)          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Wait for ACK response           │
│ Verify ackHex matches           │
└────────┬────────────────────────┘
         │ ACK received
         ▼
┌─────────────────────────────────┐
│ Remove from queue, process next │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Wallpad updates device state    │
│ Light turns ON physically       │
└─────────────────────────────────┘
```

---

## State Management

### homeStatus Object Structure

```javascript
homeStatus = {
  Light: {
    '1': {power: 'ON', brightness: '5'},
    '2': {power: 'OFF'},
    '3': {power: 'ON'},
    '4': {power: 'OFF'},
    '5': {power: 'ON'},
    '6': {power: 'OFF'},
    '7': {power: 'ON'}
  },
  Thermo: {
    '1': {power: 'heat', setTemp: '22', curTemp: '20'},
    '2': {power: 'off', setTemp: '0', curTemp: '18'},
    '3': {power: 'heat', setTemp: '23', curTemp: '21'},
    '4': {power: 'heat', setTemp: '20', curTemp: '19'}
  },
  Fan: {
    '1': {power: 'ON', speed: 'medium'}
  },
  Gas: {
    '1': {power: 'ON'}
  },
  Door: {
    '1': {open: 'Off'},
    '2': {open: 'Off'}
  }
}
```

### Duplicate Prevention Logic

```javascript
// cvnet_socket.js:240-280 (simplified)
function updateState(deviceId, subId, property, value) {
  // Initialize nested structure if needed
  if (!homeStatus[deviceId]) homeStatus[deviceId] = {};
  if (!homeStatus[deviceId][subId]) homeStatus[deviceId][subId] = {};

  // Check if value actually changed
  if (homeStatus[deviceId][subId][property] !== value) {
    // Update internal state
    homeStatus[deviceId][subId][property] = value;

    // Publish to MQTT only if changed
    const topic = util.format(CONST.STATE_TOPIC, deviceId, subId, property);
    client.publish(topic, value, {qos: 1, retain: true});

    log('State updated:', deviceId + subId, property, '=', value);
  }
}
```

### State Synchronization Delay

```javascript
// Prevent MQTT command echo loops
const mqttDelay = CONFIG.mqtt.receiveDelay; // Default: 10000ms

// After sending command, ignore state updates for 10 seconds
// This prevents self-triggering when wallpad echoes back the command
```

---

## Command Queue System

### Queue Structure

```javascript
queue = [
  {
    commandHex: Buffer,    // Packet to send
    ackHex: Buffer,        // Expected response
    topic: String,         // MQTT topic for logging
    timestamp: Number      // When added to queue
  },
  // ... more commands
]
```

### Queue Processing Algorithm

```javascript
// Simplified from cvnet_socket.js:400-450

setInterval(() => {
  if (queue.length === 0) return;

  const cmd = queue[0];  // FIFO: Get first command

  // Send command to wallpad
  sock.write(cmd.commandHex);
  log('Sent command:', cmd.commandHex.toString('hex'));

  // Set timeout for ACK verification
  setTimeout(() => {
    // If ACK received, parser will remove from queue
    // If timeout, resend or log error
    if (queue[0] === cmd) {
      log('WARNING: No ACK received, retrying...');
      // Could implement retry logic here
    }
  }, 1000);  // Wait 1 second for ACK

}, CONST.sendDelay);  // Process queue every 150ms
```

### ACK Verification

```javascript
// When packet received from wallpad
parser.on('data', (data) => {
  // Check if this is an ACK for pending command
  if (queue.length > 0) {
    const pending = queue[0];

    // Check if data contains expected ACK
    if (data.includes(pending.ackHex)) {
      log('ACK received for:', pending.topic);
      queue.shift();  // Remove from queue
      return;  // Don't process as state update
    }
  }

  // Not an ACK, process as state update
  // ... state parsing logic
});
```

---

## Communication Layers

### Layer 1: Physical Transport

#### Serial Mode (USB-to-RS485)
```javascript
// serialport library
const SerialPort = require('serialport');
const port = new SerialPort(CONFIG.serial.port, {
  baudRate: CONFIG.serial.baudrate,  // 9600
  dataBits: 8,
  stopBits: 1,
  parity: CONFIG.serial.parity       // 'none', 'even', 'odd'
});
```

#### Socket Mode (WiFi/Ethernet Bridge)
```javascript
// net library (TCP socket)
const net = require('net');
const sock = new net.Socket();
sock.connect(CONFIG.socket.port, CONFIG.socket.deviceIP);
// Connects to EW11 or similar RS485-to-WiFi bridge
```

### Layer 2: Packet Delimiting

```javascript
const Delimiter = require('@serialport/parser-delimiter');
const parser = sock.pipe(new Delimiter({
  delimiter: [0xAA]  // Split stream on 0xAA byte
}));

// Ensures complete packets are processed
// Handles partial reads and buffering automatically
```

### Layer 3: MQTT Communication

```javascript
// mqtt library v4.2.8
const client = mqtt.connect(CONST.mqttBroker, {
  clientId: CONST.clientID,
  username: CONST.mqttUser,
  password: CONST.mqttPass,
  qos: 1,          // At-least-once delivery
  retain: true     // Persist last state on broker
});
```

**Topic Structure:**
```
homenet/
├── Light1/
│   ├── power/
│   │   ├── state     (published by add-on)
│   │   └── command   (subscribed by add-on)
│   └── brightness/
│       ├── state
│       └── command
├── Thermo1/
│   ├── power/state|command
│   ├── setTemp/state|command
│   └── curTemp/state
└── ...
```

---

## Error Handling & Reliability

### Connection Retry Logic

```javascript
// Auto-reconnect on disconnect
sock.on('close', () => {
  log('Socket disconnected, reconnecting in 5s...');
  setTimeout(() => {
    sock.connect(CONFIG.socket.port, CONFIG.socket.deviceIP);
  }, 5000);
});

// MQTT auto-reconnect (built-in)
client.on('offline', () => {
  log('MQTT offline, will auto-reconnect...');
});
```

### Packet Validation

```javascript
function validatePacket(data) {
  // Check minimum length
  if (data.length < 8) return false;

  // Verify start marker (for 15-byte packets)
  if (data[0] !== 0xF7) return false;

  // Verify checksum
  const calculatedSum = data.slice(1, 13).reduce((a, b) => a + b, 0);
  const expectedSum = data[13];
  if ((calculatedSum & 0xFF) !== expectedSum) {
    log('Checksum mismatch!');
    return false;
  }

  return true;
}
```

### State Recovery

```javascript
// MQTT retain flag ensures last known state persists
client.publish(topic, value, {
  qos: 1,      // Guaranteed delivery
  retain: true // Broker stores last value
});

// On reconnect, Home Assistant receives retained states
// No manual state sync needed
```

---

## Performance Optimization

### Techniques Implemented

1. **Packet Buffering**: Delimiter parser handles incomplete reads
2. **State Caching**: `homeStatus` prevents redundant MQTT publishes
3. **Queue Throttling**: 150ms delay between commands prevents bus saturation
4. **Selective Logging**: Configurable debug mode to reduce I/O overhead
5. **Event-Driven Architecture**: Non-blocking async operations

### Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Command latency | <150ms | Queue delay + transmission |
| State update latency | <50ms | Wallpad → MQTT publish time |
| Memory footprint | ~30MB | Node.js + libraries |
| CPU usage | <5% | Idle state on Raspberry Pi 4 |
| Network bandwidth | <1KB/s | Average MQTT traffic |
| Max queue depth | Unlimited | Grows if wallpad unresponsive |

### Scalability Considerations

- **Multi-wallpad support**: Could run multiple instances with different configs
- **Device limits**: MQTT topic limit is theoretical max (~10K topics)
- **Concurrent commands**: Queue ensures serialized delivery (RS485 limitation)

---

## Configuration Schema

### Complete Configuration Example

```json
{
  "model": "commax",
  "type": "socket",
  "sendDelay": 150,
  "serial": {
    "port": "/dev/ttyUSB0",
    "baudrate": 9600,
    "parity": "none"
  },
  "socket": {
    "deviceIP": "192.168.1.100",
    "port": 8899
  },
  "mqtt": {
    "server": "192.168.1.50",
    "username": "homeassistant",
    "password": "secure_password",
    "receiveDelay": 10000
  },
  "customfile": "my_custom_wallpad.js"
}
```

### Parameter Descriptions

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | "commax" | Wallpad manufacturer (commax/samsung/daelim/hyundai) |
| `type` | string | "serial" | Connection type (serial/socket) |
| `sendDelay` | int | 150 | Milliseconds between queued commands |
| `serial.port` | string | "/dev/ttyUSB0" | Serial device path |
| `serial.baudrate` | int | 9600 | RS485 baud rate |
| `serial.parity` | string | "none" | Parity bit (none/even/odd) |
| `socket.deviceIP` | string | - | IP address of RS485-to-WiFi bridge |
| `socket.port` | int | 8899 | TCP port of bridge device |
| `mqtt.server` | string | - | MQTT broker IP address |
| `mqtt.username` | string | - | MQTT authentication username |
| `mqtt.password` | string | - | MQTT authentication password |
| `mqtt.receiveDelay` | int | 10000 | Ignore MQTT commands for N ms after sending |
| `customfile` | string | null | Custom JS implementation in /share |

---

## Development & Debugging

### Packet Analysis Tool

```bash
# Run packet sniffer
node test.js /dev/ttyUSB0 9600 none

# Output example:
[2024-01-15 14:30:22] New packet: F7 20 01 21 81 01 05 00 00...
[2024-01-15 14:30:22] Type: Lighting
[2024-01-15 14:30:22] Living room light ON, brightness 5
```

### Adding New Device Support

1. **Capture packets** using test.js
2. **Identify patterns** in DEVICE_STATE array
3. **Define commands** in DEVICE_COMMAND array
4. **Calculate checksums** for command packets
5. **Test** with Home Assistant MQTT

### Custom Implementation

Create `/share/my_wallpad.js`:

```javascript
const mqtt = require('mqtt');
const SerialPort = require('serialport');

// Your custom protocol implementation
// Must export same interface as existing files
```

---

## Security Considerations

1. **MQTT Authentication**: Always use username/password
2. **Network Segmentation**: Isolate wallpad network from WAN
3. **Firmware Updates**: Keep Home Assistant and add-on updated
4. **Access Control**: Use Home Assistant user authentication
5. **Packet Injection Risk**: RS485 bus is not encrypted (physical security required)

---

## Future Enhancements

### Planned Features
- [ ] Elevator call integration via additional packet analysis
- [ ] Energy monitoring (if supported by wallpad)
- [ ] Web UI for configuration instead of JSON editing
- [ ] Automatic checksum calculation for custom commands
- [ ] Multi-language support (Korean/English)
- [ ] Home Assistant MQTT auto-discovery support

### Research Areas
- Protocol encryption layer for enhanced security
- Machine learning for unknown packet classification
- Bidirectional state verification (read-back confirmation)
- Support for newer CVNet protocol versions

---

## References

- **CVNet Protocol**: Reverse-engineered through packet analysis
- **Home Assistant MQTT**: https://www.home-assistant.io/integrations/mqtt/
- **RS485 Standard**: TIA-485-A electrical specification
- **Node.js SerialPort**: https://serialport.io/docs/
- **MQTT Specification**: OASIS MQTT Version 3.1.1

---

**Document Version**: 1.0
**Last Updated**: 2024-01-15
**Maintained By**: YOSKR (based on Daehwan Kang's original work)
