const net = require('net');
const fs = require('fs');
const path = require('path');

// 로그 파일 경로
const logFilePath = path.join(__dirname, 'logs.txt');

// 설정 객체
const CONFIG = {
    socket: {
        deviceIP: '192.168.0.20',  // 실제 기기 IP로 변경해주세요
        port: 8899
    }
};

// 사전 정의된 패킷 목록
const PREDEFINED_PACKETS = [
    'f7200121810000000000000000c3aa',//조명
    'f7200122810000000000000000c4aa',//조명
    
    'f720014a81151d061b051b0f1d8baa',//난방
    'f7200111810100000000000000b4aa',//가스
    'F720110111000000000000000043AA', // 가스 끄기

    'F720017181000100000000000014aa',//팬
    'f7207101110000000000000000a3aa', //끄기
    'F7207101110101010000000000A6AA', //약풍
    'f7207101110101020000000000a7aa', //중풍
    'f7207101110101030000000000a8aa', //강풍
    // 추가 패킷...
];
//F7 20 01 E1 81 02 00 00 00 00 02 31 30 E8 AA << 엘리베이터 콜 패킷이라는데?
//f7 20 01 81 81 02 00 00 00 00 00 00 00 25 AA << 이것도?
// 로그 출력 함수
const log = (...args) => {
    const logMessage = '[' + new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'}) + ']' + args.join(' ') + '\n';
    console.log(logMessage);
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
};

// 중복 패킷 확인 함수
const isPacketLogged = (packetHex) => {
    const logs = fs.readFileSync(logFilePath, 'utf8');
    return logs.split('\n').some(line => line.includes(packetHex));
};

// 소켓 객체 생성 및 연결
const sock = new net.Socket();
log('Initializing: SOCKET');
sock.connect(CONFIG.socket.port, CONFIG.socket.deviceIP, function() {
    log('[Socket] Success connect server');
});

// 패킷 분석 함수
function analyzePacket(data) {
    const packetHex = data.toString('hex');
    
    // 사전 정의된 패킷 확인
    if (PREDEFINED_PACKETS.includes(packetHex)) {
        //log('Received predefined packet:', packetHex);
        return;
    }

    //log('Received new packet:', packetHex);

    // 패킷 길이 및 구조 확인
    if (data.length !== 15) {
        log('Invalid packet length. Expected 15, got:', data.length);
        return;
    }

    const deviceId = data.slice(1, 4).toString('hex');
    const statusCode = data[4];
    const parityBit = data[13];
    const endByte = data[14];

    //log('Device ID:', deviceId);
    //log('Status Code:', statusCode);

    // 종료 바이트 확인
    if (endByte !== 0xAA) {
        log('Invalid end byte. Expected 0xAA, got:', endByte.toString(16));
        return;
    }

    // 디바이스 ID에 따른 분석
    switch(deviceId) {
        case '200121':
        case '200121':
        case '200122':
            //analyzePacket1(data,"Light");
            break;
        case '20014a':
        case '20014b':
            //analyzeThermoPacket(data);            
            break;
        case '200111': //가스
            //analyzePacket1(data,"gas");
            break;
        case '200171': //공조기
        case '207101110': //공조기 실행명령어
            //analyzeFanPacket(data);
            break;
        case '2001e1':
            analyzePacket1(data,"ELV");
            break;
        case '2001c1':
        case '2001c2':
            //analyzePacket1(data,"콘센트");
            //콘센트같으므로 재껴
            break;
        default:
            analyzePacket1(data,"Unknown");
    }
}


// 조명 패킷 분석 함수
function analyzeLightPacket(data) {
    log('Light status:');
    log('  Main light:', data[5] > 0 ? 'ON' : 'OFF', 'Brightness:', data[5]);
    log('  Light 2:', data[6] > 0 ? 'ON' : 'OFF');
    log('  Light 3:', data[7] > 0 ? 'ON' : 'OFF');
}
function analyzePacket1(data,type){
    const packetHex = data.toString('hex');
    const packetDetails = Array.from(data).map(byte => `${byte.toString(16).padStart(2, '0')}`).join(' ');
    if (data[4] === 0x81) {
        //if (!isPacketLogged(packetDetails)) {
            log('type:',type,'status:','81:', packetDetails);
        //}
    }else if (data[4] === 0x91) {
        if (!isPacketLogged(packetDetails)) { 
            log('type:',type,'status:','91:', packetDetails);
        }
    }else{
        if (!isPacketLogged(packetDetails)) { 
            log('type:',type,'status:','Unknown:', packetDetails);
        }
    }
}
//팬 패킷
function analyzeFanPacket(data){
        // log('Fan status:');
        // log('  Status:', data[5] > 0 ? 'ON' : 'OFF');
        // log('  SPEED:', data[7]);
        const packetDetails = Array.from(data).map(byte => `${byte.toString(16).padStart(2, '0')}`).join(' ');
        log('packet structure:', packetDetails);W
}
// 난방 패킷 분석 함수
function analyzeThermoPacket(data) {
    log('Thermo status:');
    ['Living Room1', 'Living Room2', 'Bedroom', 'Kids Room'].forEach((room, index) => {
        const setTemp = data[5 + index * 2];
        const curTemp = data[6 + index * 2];
        log(`  ${room}:`);
        log(`    Set Temp: ${setTemp < 100 ? setTemp : setTemp - 128}°C`);
        log(`    Current Temp: ${curTemp}°C`);
        log(`    Power: ${setTemp < 100 ? 'OFF' : 'ON'}`);
    });
}

// 알 수 없는 패킷 분석 함수
function analyzeUnknownPacket(data) {
    const packetHex = data.toString('hex');

    const packetDetails = Array.from(data).map(byte => `${byte.toString(16).padStart(2, '0')}`).join(' ');
    log('Unknown packet structure:', packetDetails);
}

// 패킷 수신 및 처리
let buffer = Buffer.alloc(0);
let lastReceive = new Date().getTime();

sock.on('data', function(data) {
    buffer = Buffer.concat([buffer, data]);
    
    while(buffer.length >= 15) {  // 패킷의 길이가 15바이트인지 확인
        if (buffer[14] !== 0xAA) {  // 종료 바이트 확인
            buffer = buffer.slice(1);  // 잘못된 데이터라면 첫 바이트를 제거하고 계속
            continue;
        }
        
        const packet = buffer.slice(0, 15);
        buffer = buffer.slice(15);
        
        //log('Receive interval:', (new Date().getTime()) - lastReceive, 'ms');
        lastReceive = new Date().getTime();

        analyzePacket(packet);
    }
});

// 에러 처리
sock.on('error', (err) => {
    log('[Socket] Error:', err);
});

// 연결 종료 처리
sock.on('close', () => {
    log('[Socket] Connection closed');
});