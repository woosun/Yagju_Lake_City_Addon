/**
 * RS485 Homegateway for daelimAPT
 * @소스 공개 : Daehwan, Kang
 * @삼성 홈넷용으로 수정 : erita
 * @수정일 2019-01-11
 * @코맥스 홈넷용으로 수정 : 그레고리하우스
 * @수정일 2019-06-01
 * @대림이편한세상 용으로 수정 : 모근원
 * @수정일 2019-06-26
 * @옥제풍 용으로 수정 : 박우선
 * @수정일 2024-08-25
 */

const util = require("util");
const SerialPort = require("serialport");
const net = require("net"); // Socket
const Delimiter = require("@serialport/parser-delimiter");
const mqtt = require("mqtt");

const CONFIG = require("/data/options.json"); //**** 애드온의 옵션을 불러옵니다. 이후 CONFIG.mqtt.username 과 같이 사용가능합니다.

//String to Buffer, 스페이스가 들어가도라도 공백을 다 제거하고 버퍼를 만들어냅니다.
String.prototype.buff = function () {
  var noSpaceStr = this.replace(/\s/gi, "");
  if (noSpaceStr.length % 2 != 0)
    return console.log("error with hex ", this, " length invalid");
  return Buffer.alloc(noSpaceStr.length / 2, noSpaceStr, "hex");
};

const CONST = {
  // 포트이름 설정/dev/ttyUSB0
  portName: process.platform.startsWith("win") ? "COM6" : CONFIG.serial.port,
  // SerialPort 전송 Delay(ms)
  sendDelay: CONFIG.sendDelay,
  // MQTT 브로커
  mqttBroker: "mqtt://" + CONFIG.mqtt.server, // *************** 환경에 맞게 수정하세요! **************
  // MQTT 수신 Delay(ms)
  mqttDelay: CONFIG.mqtt.receiveDelay,

  mqttUser: CONFIG.mqtt.username, // *************** 환경에 맞게 수정하세요! **************
  mqttPass: CONFIG.mqtt.password, // *************** 환경에 맞게 수정하세요! **************

  clientID: CONFIG.model + "-homenet",

  // 기기별 상태 및 제어 코드(HEX)
  DEVICE_STATE: [
    //거실거실등 1,2 복도등
    {
      deviceId: "Light",
      subId: ["1", "2", "3"],
      stateStartWithHex: "f7 20 01 21 81".buff(),
      whereToReadBlock: [6, 7, 8],
      power: "",
      brightness: "",
    },
    //안방
    {
      deviceId: "Light",
      subId: ["4", "5"],
      stateStartWithHex: "f7 20 01 22 81".buff(),
      whereToReadBlock: [6, 7],
      power: "",
    },
    //침실
    {
      deviceId: "Light",
      subId: ["6"],
      stateStartWithHex: "f7 20 01 23 81".buff(),
      whereToReadBlock: [6],
      power: "",
    },
    //아이방
    {
      deviceId: "Light",
      subId: ["7"],
      stateStartWithHex: "f7 20 01 24 81".buff(),
      whereToReadBlock: [6],
      power: "",
    },
    //난방 거실,안방,아부지방,아들방
    {
      deviceId: "Thermo",
      subId: ["1", "2", "3", "4"],
      stateStartWithHex: "f7 20 01 4A 81".buff(),
      whereToReadBlock: [6, 8, 10, 12],
      setTemp: "",
      curTemp: "",
      power: "",
    },
    //난방 드레스룸 , 알파룸
    {
      deviceId: "Thermo",
      subId: ["5", "6"],
      stateStartWithHex: "f7 20 01 4B 81".buff(),
      whereToReadBlock: [6, 8],
      setTemp: "",
      curTemp: "",
      power: "",
    },

    //전열교환기
    {
      deviceId: "Fan",
      subId: ["1"],
      stateStartWithHex: "F7 20 01 71 81".buff(),
      whereToReadBlock: [5],
      power: "",
      speed: "",
    },
    //가스
    {
      deviceId: "Gas",
      subId: ["1"],
      stateStartWithHex: "f7 20 01 11 81".buff(),
      whereToReadBlock: [5],
      power: "",
    },

    //엘리베이터
    //{deviceId: 'elevator', subId: ['1'], stateStartWithHex: 'F7 20 01 22 81'.buff() , whereToReadBlock: [6], power: ''},
    //현관문
    {
      deviceId: "Door",
      subId: ["1"],
      stateStartWithHex: "f720bb01110404000000000000f5".buff(),
      open: "on",
    },
    {
      deviceId: "Door",
      subId: ["1"],
      stateStartWithHex: "f720bb01110403000000000000f4".buff(),
      open: "off",
    },

    //공동현관문
    {
      deviceId: "Door",
      subId: ["2"],
      stateStartWithHex: "f720bb01110405000000000000f6".buff(),
      open: "on",
    },
  ],

  DEVICE_COMMAND: [
    ////////////////// 전등

    //거실등1
    {
      deviceId: "Light",
      subId: "1",
      power: "OFF",
      brightness: "0",
      commandHex: "F7 20 21 01 11 00 00 00 00 00 00 00 00 53 AA".buff(),
      ackHex: "2001219f".buff(),
    }, //off
    {
      deviceId: "Light",
      subId: "1",
      power: "ON",
      brightness: "1",
      commandHex: "F7 20 21 01 11 01 00 00 00 00 00 00 00 54 AA".buff(),
      ackHex: "2001219f".buff(),
    },
    // {deviceId: 'Light', subId: '1', power: 'ON' ,  brightness: '2' , commandHex: 'F7 20 21 01 11 02 00 00 00 00 00 00 00 55 AA'.buff(), ackHex: '2001219f'.buff()},
    // {deviceId: 'Light', subId: '1', power: 'ON' ,  brightness: '3' , commandHex: 'F7 20 21 01 11 03 00 00 00 00 00 00 00 56 AA'.buff(), ackHex: '2001219f'.buff()},
    // {deviceId: 'Light', subId: '1', power: 'ON' ,  brightness: '4' , commandHex: 'F7 20 21 01 11 04 00 00 00 00 00 00 00 57 AA'.buff(), ackHex: '2001219f'.buff()},
    // {deviceId: 'Light', subId: '1', power: 'ON' ,  brightness: '5' , commandHex: 'F7 20 21 01 11 05 00 00 00 00 00 00 00 58 AA'.buff(), ackHex: '2001219f'.buff()},
    // {deviceId: 'Light', subId: '1', power: 'ON' ,  brightness: '6' , commandHex: 'F7 20 21 01 11 06 00 00 00 00 00 00 00 59 AA'.buff(), ackHex: '2001219f'.buff()},
    // {deviceId: 'Light', subId: '1', power: 'ON' ,  brightness: '7' , commandHex: 'F7 20 21 01 11 07 00 00 00 00 00 00 00 5A AA'.buff(), ackHex: '2001219f'.buff()},
    // {deviceId: 'Light', subId: '1', power: 'ON' ,  brightness: '8' , commandHex: 'F7 20 21 01 11 0A 00 00 00 00 00 00 00 5D AA'.buff(), ackHex: '2001219f'.buff()},

    //거실등2
    {
      deviceId: "Light",
      subId: "2",
      power: "OFF",
      commandHex: "F7 20 21 01 12 00 00 00 00 00 00 00 00 54 AA".buff(),
      ackHex: "2001219f".buff(),
    }, //off
    {
      deviceId: "Light",
      subId: "2",
      power: "ON",
      commandHex: "F7 20 21 01 12 01 00 00 00 00 00 00 00 55 AA".buff(),
      ackHex: "2001219f".buff(),
    }, //on

    //복도등
    {
      deviceId: "Light",
      subId: "3",
      power: "OFF",
      commandHex: "F7 20 21 01 13 00 00 00 00 00 00 00 00 55 AA".buff(),
      ackHex: "2001219f".buff(),
    }, //off
    {
      deviceId: "Light",
      subId: "3",
      power: "ON",
      commandHex: "F7 20 21 01 13 01 00 00 00 00 00 00 00 56 AA".buff(),
      ackHex: "2001219f".buff(),
    }, //on

    //안방
    {
      deviceId: "Light",
      subId: "4",
      power: "OFF",
      commandHex: "F7 20 22 01 11 00 00 00 00 00 00 00 00 55 AA".buff(),
      ackHex: "2001319f".buff(),
    }, //off
    {
      deviceId: "Light",
      subId: "4",
      power: "ON",
      commandHex: "F7 20 22 01 11 01 00 00 00 00 00 00 00 56 AA".buff(),
      ackHex: "2001319f".buff(),
    }, //on

    //////////////////// 난방

    //온도세팅=DEC2HEX((희망온도))+128)
    //패리티 만들기=F7 ~~~~ AA 사이를 다 더하고 HEX의 뒤 두자리만 사용.
    //F7 20 44 01 11 ## 00 00 00 00 00 00 00 @@ AA (총 15블럭, ## 희망온도, @@ 패리티)

    //거실-난방
    {
      deviceId: "Thermo",
      subId: "1",
      setTemp: "0",
      power: "off",
      commandHex: "F7 20 41 01 11 0e 00 00 00 00 00 00 00 81 AA".buff(),
      ackHex: "20014191".buff(),
    }, //off
    {
      deviceId: "Thermo",
      subId: "1",
      power: "heat",
      commandHex: "F7 20 41 01 11 8e 00 00 00 00 00 00 00 01 AA".buff(),
      ackHex: "20014191".buff(),
    }, //heat
    {
      deviceId: "Thermo",
      subId: "1",
      setTemp: "",
      commandHex: "F7 20 41 01 11".buff(),
      ackHex: "20014191".buff(),
    },

    //안방-난방
    {
      deviceId: "Thermo",
      subId: "2",
      setTemp: "0",
      power: "off",
      commandHex: "F7 20 42 01 11 0e 00 00 00 00 00 00 00 82 AA".buff(),
      ackHex: "20014291".buff(),
    }, //off
    {
      deviceId: "Thermo",
      subId: "2",
      power: "heat",
      commandHex: "F7 20 42 01 11 8e 00 00 00 00 00 00 00 02 AA".buff(),
      ackHex: "20014291".buff(),
    }, //heat
    {
      deviceId: "Thermo",
      subId: "2",
      setTemp: "",
      commandHex: "F7 20 42 01 11".buff(),
      ackHex: "20014291".buff(),
    },

    //아부지방-난방
    {
      deviceId: "Thermo",
      subId: "3",
      setTemp: "0",
      power: "off",
      commandHex: "F7 20 43 01 11 0e 00 00 00 00 00 00 00 83 AA".buff(),
      ackHex: "20014391".buff(),
    }, //off
    {
      deviceId: "Thermo",
      subId: "3",
      power: "heat",
      commandHex: "F7 20 43 01 11 8e 00 00 00 00 00 00 00 03 AA".buff(),
      ackHex: "20014391".buff(),
    }, //heat
    {
      deviceId: "Thermo",
      subId: "3",
      setTemp: "",
      commandHex: "F7 20 43 01 11".buff(),
      ackHex: "20014391".buff(),
    },

    //아들방-난방
    {
      deviceId: "Thermo",
      subId: "4",
      setTemp: "0",
      power: "off",
      commandHex: "F7 20 44 01 11 0e 00 00 00 00 00 00 00 84 AA".buff(),
      ackHex: "20014491".buff(),
    }, //off
    {
      deviceId: "Thermo",
      subId: "4",
      power: "heat",
      commandHex: "F7 20 44 01 11 8e 00 00 00 00 00 00 00 04 AA".buff(),
      ackHex: "20014491".buff(),
    }, //heat
    {
      deviceId: "Thermo",
      subId: "4",
      setTemp: "",
      commandHex: "F7 20 44 01 11".buff(),
      ackHex: "20014491".buff(),
    },

    {
      deviceId: "Thermo",
      subId: "5",
      setTemp: "0",
      power: "off",
      commandHex: "F7 20 45 01 11 0e 00 00 00 00 00 00 00 85 AA".buff(),
      ackHex: "20014591".buff(),
    }, //off
    {
      deviceId: "Thermo",
      subId: "5",
      power: "heat",
      commandHex: "F7 20 45 01 11 8e 00 00 00 00 00 00 00 05 AA".buff(),
      ackHex: "20014591".buff(),
    }, //heat
    {
      deviceId: "Thermo",
      subId: "5",
      setTemp: "",
      commandHex: "F7 20 45 01 11".buff(),
      ackHex: "20014591".buff(),
    },

    {
      deviceId: "Thermo",
      subId: "6",
      setTemp: "0",
      power: "off",
      commandHex: "F7 20 46 01 11 0e 00 00 00 00 00 00 00 86 AA".buff(),
      ackHex: "20014691".buff(),
    }, //off
    {
      deviceId: "Thermo",
      subId: "6",
      power: "heat",
      commandHex: "F7 20 46 01 11 8e 00 00 00 00 00 00 00 06 AA".buff(),
      ackHex: "20014691".buff(),
    }, //heat
    {
      deviceId: "Thermo",
      subId: "6",
      setTemp: "",
      commandHex: "F7 20 46 01 11".buff(),
      ackHex: "20014691".buff(),
    },

    //전열교환기
    {
      deviceId: "Fan",
      subId: "1",
      power: "off",
      commandHex: "F7 20 71 01 11 00 00 00 00 00 00 00 00 A3 AA".buff(),
      ackHex: "20017191".buff(),
    }, //off
    {
      deviceId: "Fan",
      subId: "1",
      power: "ON",
      commandHex: "F7 20 71 01 11 01 01 01 00 00 00 00 00 A6 AA".buff(),
      ackHex: "20017191".buff(),
    }, //ON
    {
      deviceId: "Fan",
      subId: "1",
      speed: "Low",
      commandHex: "F7 20 71 01 11 01 01 01 00 00 00 00 00 A6 AA".buff(),
      ackHex: "20017191".buff(),
    }, //low
    {
      deviceId: "Fan",
      subId: "1",
      speed: "Middle",
      commandHex: "F7 20 71 01 11 01 01 02 00 00 00 00 00 A7 AA".buff(),
      ackHex: "20017191".buff(),
    }, //middle
    {
      deviceId: "Fan",
      subId: "1",
      speed: "High",
      commandHex: "F7 20 71 01 11 01 01 03 00 00 00 00 00 A8 AA".buff(),
      ackHex: "20017191".buff(),
    }, //high

    //가스
    {
      deviceId: "Gas",
      subId: "1",
      power: "off",
      commandHex: "F7 20 11 01 11 00 00 00 00 00 00 00 00 43 AA".buff(),
      ackHex: "20011191".buff(),
    }, //가스 끄기
  ],

  // 상태 Topic (/homenet/${deviceId}${subId}/${property}/state/ = ${value})
  // 명령어 Topic (/homenet/${deviceId}${subId}/${property}/command/ = ${value})
  TOPIC_PRFIX: "homenet",
  STATE_TOPIC: "homenet/%s%s/%s/state", //상태 전달
  DEVICE_TOPIC: "homenet/+/+/command", //명령 수신
};

// 로그 표시
var log = (...args) =>
  console.log(
    "[" + new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) + "]",
    args.join(" ")
  );

//////////////////////////////////////////////////////////////////////////////////////
// 홈컨트롤 상태
var homeStatus = {};
var lastReceive = new Date().getTime();
var mqttReady = false;
var queue = new Array();

//////////////////////////////////////////////////////////////////////////////////////
// MQTT-Broker 연결
const client = mqtt.connect(CONST.mqttBroker, {
  clientId: CONST.clientID,
  username: CONST.mqttUser,
  password: CONST.mqttPass,
});
client.on("connect", () => {
  client.subscribe(CONST.DEVICE_TOPIC, (err) => {
    if (err) log("MQTT Subscribe fail! -", CONST.DEVICE_TOPIC);
  });
});

// EW11 연결 (수정필요)
const sock = new net.Socket();
log("Initializing: SOCKET");
sock.connect(CONFIG.socket.port, CONFIG.socket.deviceIP, function () {
  log("[Socket] Success connect server");
});
const parser = sock.pipe(new Delimiter({ delimiter: [0xaa] }));

//////////////////////////////////////////////////////////////////////////////////////
// 홈넷에서 SerialPort로 상태 정보 수신
parser.on("data", function (data) {
  //수신 데이터 로그
  //log('Receive interval: ', (new Date().getTime())-lastReceive, 'ms -> (',data[0],') ', data.toString('hex'));
  lastReceive = new Date().getTime();

  ////////// states [start]
  var objFound = CONST.DEVICE_STATE.find((obj) =>
    data.includes(obj.stateStartWithHex)
  );
  if (objFound) {
    //조명, 난방 상태 정보
    updateStatus(objFound, data);
    return;
  }
  ///////// states [end]

  // 전송신호
  commandProc();

  ////////// ack [start]
  //명령 후 ACK 헥사 검사
  var objFoundIdx = queue.findIndex((obj) => data.includes(obj.ackHex));
  if (objFoundIdx > -1) {
    log("[Serial] Success command:", data.toString("hex"));
    var topic = util.format(
      CONST.STATE_TOPIC,
      queue[objFoundIdx].deviceId,
      queue[objFoundIdx].subId,
      "status"
    );
    client.publish(topic, "success", { retain: true }); // 성공 상태 전송
    queue.splice(objFoundIdx, 1);
    return;
  }
  ////////// ack [end]

  //상태 정보 외의 로그
  //log('Receive : ', (new Date().getTime())-lastReceive, 'ms -> ', data.toString('hex'));
});

//////////////////////////////////////////////////////////////////////////////////////
// MQTT로 HA에 상태값 전송
// 각 topic의 마지막 전송 시간을 추적하기 위한 객체 생성
const lastPublished = {};
var updateStatus = (obj, data) => {
  var arrStateName = Object.keys(obj);

  //상태를 쏠 state 만 돌린다.
  const aplyFilter = [
    "power",
    "curTemp",
    "setTemp",
    "brightness",
    "open",
    "elevator-state",
    "speed",
  ];
  arrStateName = arrStateName.filter((stateName) =>
    aplyFilter.includes(stateName)
  );

  for (var i = 0; i < obj.subId.length; i++) {
    //한 데이터에 여러건의 정보가 있는 경우 처리
    var _subId = obj.subId[i];

    // 상태값별 현재 상태 파악하여 변경되었으면 상태 반영 (MQTT publish)
    arrStateName.forEach(function (stateName) {
      // 상태 반영 (MQTT publish)
      var value;
      if (obj.deviceId == "Light") {
        //전등
        if (stateName == "brightness") {
          //라이트1번만 밝기 지원
          if (_subId == 1) {
            //밝기 .. 가 1~7까지 올라가다 만땅이면 10이 된다 -_-... HA에서 range 를 8까지 쓰기위해 10은 8로 변경
            value =
              data[obj.whereToReadBlock[i] - 1] > 7
                ? 8
                : data[obj.whereToReadBlock[i] - 1];
          } else return;
        } else {
          //파워
          value = data[obj.whereToReadBlock[i] - 1] > 0 ? "ON" : "OFF";
        }
      } else if (obj.deviceId == "Thermo") {
        //아니면 난방
        if (stateName == "curTemp") {
          //난방조절기의 현재 온도는 16진수
          value = data[obj.whereToReadBlock[i]]; //parseInt(data[obj.whereToReadBlock[i]+1].toString(),16); //배열엔 세팅값 기준, 세팅값+1 바이트 정보가 현재 온도임
        } else if (stateName == "setTemp") {
          //난방조절기의 설정 값인 경우, 128을 빼야함
          value = thermoValue(data[obj.whereToReadBlock[i] - 1]);
        } else {
          //파워
          value =
            parseInt(data[obj.whereToReadBlock[i] - 1], 10) < 100
              ? "off"
              : "heat";
        }
      } else if (obj.deviceId == "Fan") {
        if (stateName == "power") {
          value = data[obj.whereToReadBlock[i]] > 0 ? "ON" : "off";
        } else if (stateName == "speed") {
          value =
            data[obj.whereToReadBlock[i] + 2] > 2
              ? "High"
              : data[obj.whereToReadBlock[i] + 2] > 1
              ? "Middle"
              : data[obj.whereToReadBlock[i] + 2] > 0
              ? "Low"
              : "off";
        }
      } else if (obj.deviceId == "Gas") {
        value = data[obj.whereToReadBlock[i]] > 0 ? "ON" : "off";
      } else {
        //etc..
        value = obj[stateName];
      }

      // 상태값이 없거나 상태가 같으면 반영 중지
      var curStatus = homeStatus[obj.deviceId + _subId + stateName];
      if (curStatus === value) return;

      // 미리 상태 반영한 device의 상태 원복 방지
      if (queue.length > 0) {
        var found = queue.find(
          (q) =>
            q.deviceId + q.subId === obj.deviceId + _subId &&
            value === curStatus
        );
        console.log(found, " processing... skip");
        if (found != null) return;
      }

      var topic = util.format(
        CONST.STATE_TOPIC,
        obj.deviceId,
        _subId,
        stateName
      );

      homeStatus[obj.deviceId + _subId + stateName] = value; //상태값 넣어둠

      // 현재 시간
      const currentTime = Date.now();
      // topic이 'curTemp'인 경우에만 10분 이내에 전송되었는지 확인
      if (topic.includes("curTemp")) {
        if (
          !lastPublished[topic] ||
          currentTime - lastPublished[topic] > 600000
        ) {
          client.publish(topic, value.toString(), { retain: true });
          lastPublished[topic] = currentTime; // 마지막 전송 시간 업데이트
        } else {
          log("[MQTT] 주제 생략:", topic, " - 최근에 이미 전송되었습니다.");
        }
      } else {
        // 'curTemp'가 아닌 경우는 바로 전송
        client.publish(topic, value.toString(), { retain: true });
      }

      log("[MQTT] Send to HA:", topic, "->", value);
    });
  }
};

var thermoValue = (strValue) => {
  var intVal = parseInt(strValue, 10);
  return intVal > 100 ? intVal - 128 : intVal;
};
//////////////////////////////////////////////////////////////////////////////////////
// HA => MQTT로 제어 명령 수신
client.on("message", (topic, message) => {
  if (mqttReady) {
    var topics = topic.split("/");
    var value = message.toString(); // message buffer이므로 string으로 변환
    var objFound = null;

    //console.log('topic : ',topic,'message : ',value);

    if (topics[0] === CONST.TOPIC_PRFIX) {
      // 온도설정 명령의 경우 모든 온도를 Hex로 정의해두기에는 많으므로 온도에 따른 시리얼 통신 메시지 생성
      if (topics[2] === "setTemp") {
        objFound = Object.create(
          CONST.DEVICE_COMMAND.find(
            (obj) =>
              obj.deviceId + obj.subId === topics[1] &&
              obj.hasOwnProperty("setTemp") &&
              !obj.hasOwnProperty("power")
          )
        );

        var newCommand = (
          objFound.commandHex.toString("hex") + "000000000000000000AA"
        ).buff();

        newCommand[5] = Number(value) + 128; //commandHex 에 희망 온도 설정, 희망온도에 128을 더한후 16진수 한다.
        objFound.setTemp = String(Number(value)); // 온도값은 소수점이하는 버림

        var checkSum =
          newCommand[1] +
          newCommand[2] +
          newCommand[3] +
          newCommand[4] +
          newCommand[5];
        newCommand[13] = checkSum; // 마지막 Byte는 CHECKSUM

        objFound.commandHex = newCommand;
      }
      // 다른 명령은 미리 정의해놓은 값을 매칭
      else {
        objFound = CONST.DEVICE_COMMAND.find(
          (obj) =>
            obj.deviceId + obj.subId === topics[1] && obj[topics[2]] === value
        );
      }
    }

    if (objFound == null) {
      log("[MQTT] Receive Unknown Msg.: ", topic, ":", value);
      return;
    }

    // 현재 상태와 같으면 Skip
    if (
      value ===
      homeStatus[objFound.deviceId + objFound.subId + objFound[topics[2]]]
    ) {
      log("[MQTT] Receive & Skip: ", topic, ":", value);
    }
    // Serial메시지 제어명령 전송 & MQTT로 상태정보 전송
    else {
      log("[MQTT] Receive from HA:", topic, ":", value);
      // 최초 실행시 딜레이 없도록 sentTime을 현재시간 보다 sendDelay만큼 이전으로 설정
      //objFound.sentTime = (new Date().getTime())-CONST.sendDelay;
      queue.push(objFound); // 실행 큐에 저장
      //updateStatus(objFound); // 처리시간의 Delay때문에 미리 상태 반영
    }
  }
});

//////////////////////////////////////////////////////////////////////////////////////
// SerialPort로 제어 명령 전송

const commandProc = () => {
  // 큐에 처리할 메시지가 없으면 종료
  // console.log('Queue size :',queue.length);
  if (queue.length == 0) return;

  // 큐에서 제어 메시지 가져오기
  var obj = queue.shift();

  //실제 시리얼포트에 전송
  sock.write(obj.commandHex, (err) => {
    if (err) return log("[Socket] Send Error: ", err.message);
  });
  /*
    lastReceive = new Date().getTime();
    obj.sentTime = lastReceive;     // 명령 전송시간 sentTime으로 저장
    log('[Serial] Send to Device:', obj.deviceId, obj.subId, '->', obj.state, obj.commandHex.toString('hex'));
*/
  // 다시 큐에 저장하여 Ack 메시지 받을때까지 반복 실행
  queue.push(obj);
};

setTimeout(() => {
  mqttReady = true;
  log("MQTT Ready...");
}, CONST.mqttDelay);
//setInterval(commandProc, 100);
