// 1.script to check couchdnb is stuck
// 2.stop couchdb and start couchdb
// 3.scipt should start on restaart the instance   

const shelljs = require('shelljs');
const fs = require('fs');

const STR_PING_COUCHDB_CMD = 'curl http://localhost:5984 > ping.log';
// const STR_STOP_COUCHDB_CMD = 'sudo service couchdb stop';
// const STR_START_COUCHDB_CMD = 'sudo service couchdb start';
const STR_STOP_COUCHDB_CMD = 'systemctl stop couchdb.service';
const STR_START_COUCHDB_CMD = 'systemctl start couchdb.service';

const B_ENABLE_LOGGING = false;

//const STR_SUCCESS_RESP = '{"couchdb":"Welcome","version":"2.1.1","features":["scheduler"],"vendor":{"name":"The Apache Software Foundation"}}';
const STR_SUCCESS_RESP = '{"error":"unauthorized","reason":"Authentication required."}';
const I_FAIL_COUNT = 3;
const I_PING_FREQUENCY = 10000; //10 SECONDS
const I_PING_FAIL_WAIT_TIME = 1000; //1 SECOND

const checkCouchDBIsAlive = async (iFailCount) => {

    shelljs.exec(STR_PING_COUCHDB_CMD);
    let resp = fs.readFileSync('ping.log');
    resp = resp.toString();
    if (resp.indexOf(STR_SUCCESS_RESP) !== -1) {
        return true;
    }

    log('checkCouchDBIsAlive::iFailCount<' + iFailCount + '>');
    iFailCount++;
    if (iFailCount < I_FAIL_COUNT) {
        await pgTimeOut(I_PING_FAIL_WAIT_TIME);
        log('checkCouchDBIsAlive calling checkCouchDBIsAlive with iFailCount<' + iFailCount + '>');
        return checkCouchDBIsAlive(iFailCount);
    }

    log('checkCouchDBIsAlive couchdb is not live');
    return false;
}

const monitor = async () => {

    let bIsCouchDBAlive = await checkCouchDBIsAlive(0);
    log('monitor::bIsCouchDBAlive<' + bIsCouchDBAlive + '>');
    if (!bIsCouchDBAlive) {
        log('monitor::calling startCouchDB');
        await startCouchDB();
    }

    await pgTimeOut(I_PING_FREQUENCY);
    log('monitor::calling monitor');
    monitor();
};

const startCouchDB = async () => {
    shelljs.exec(STR_STOP_COUCHDB_CMD);
    await pgTimeOut(I_PING_FAIL_WAIT_TIME);
    shelljs.exec(STR_START_COUCHDB_CMD);

    log('restarted couchdb');

    await pgTimeOut(I_PING_FAIL_WAIT_TIME);

    let bIsCouchDBAlive = await checkCouchDBIsAlive(0);
    log('startCouchDB::bIsCouchDBAlive<' + bIsCouchDBAlive + '>');
    if (!bIsCouchDBAlive) {
        await pgTimeOut(I_PING_FAIL_WAIT_TIME);
        log('startCouchDB calling startCouchDB');
        return startCouchDB();
    }
};

const pgTimeOut = (iTimeInMilliSeconds) => {
    return new Promise(resolve => {
        setTimeout(function () {
            resolve(true);
        }, iTimeInMilliSeconds)
    });
};

const log = (msg) => {
    if (B_ENABLE_LOGGING) {
        console.log(msg);
    }
}

monitor();