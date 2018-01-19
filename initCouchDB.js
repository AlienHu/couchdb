'use strict';

require('shelljs/global');
const fetch = require('node-fetch');
const urlHelper = require('url');

const addCorsToCouch = require('add-cors-to-couchdb');
let yargs = require('yargs')
  .alias('p', 'password')
  .describe('p', 'admin password')
  .alias('u', 'username')
  .describe('u', 'admin username')
  .alias('h', 'help')
  .describe('h', 'this help')
  .alias('v', 'version')
  .usage('\nUsage:\n  $0 [url] [options]')
  .example('$0', 'update couch at http://127.0.0.1:5984')
  .example('$0 http://example.com -u username -p password', 'update with auth');
let argv = yargs.argv;
if (argv.h) {
  yargs.showHelp();
  return process.exit(0);
}

let url2 = 'http://127.0.0.1:5984';
let url = url2 + '/_node/couchdb@127.0.0.1/';
let auth = {
  u: 'couchadmin',
  p: 'test'
};

if (argv.p && argv.u) {
  auth = {
    u: argv.u,
    v: argv.p
  };
}

let formattedUrl = formatUrl(url, auth);
let formattedUrl2 = formatUrl(url2, auth);

let securityDoc = '{ "admins": { "names": [], "roles": ["admin"]}, "members": { "names": [], "roles": []}}';
let authHandlerDoc = '"{couch_httpd_oauth, oauth_authentication_handler}, {couch_httpd_auth, proxy_authentification_handler}, {couch_httpd_auth, cookie_authentication_handler}, {couch_httpd_auth, default_authentication_handler}"';
let useUsersDoc = '"true"';

return configure();

async function configure() {
  let bCouch2 = await isCouch2();
  if (!bCouch2) {
    formattedUrl = formattedUrl2;
    url = url2 + '/';
  }
  await createAdminUser(url); //exception is not thrown
  let corsUrl = formattedUrl2.substr(0, formattedUrl2.length - 1);
  await addCorsToCouch(corsUrl);
  await updateConfigParams(formattedUrl, bCouch2);
  await addUserRoles(formattedUrl2, bCouch2);
}

function isCouch2() {
  return fetch('http://localhost:5984/_membership').then(function (resp) {
    if (resp.status !== 200) {
      return false;
    } else {
      return true;
    }
  });
}

function formatUrl(baseUrl, auth) {
  let urlObject = urlHelper.parse(baseUrl);

  if (auth) {
    urlObject.auth = auth.u + ':' + auth.p;
  }

  return urlHelper.format(urlObject);
}

function updateConfig(path, reqData, bLog) {
  let param = {
    method: 'PUT'
  };
  if (reqData) {
    param.body = reqData;
  }

  return fetch(path, param).then(function (resp) {
    if (resp.status === 200 || resp.status === 201) {
      return;
    }
    return resp.text().then(function (text) {
      throw new Error('status ' + resp.status + ' ' + text);
    });
  }).catch(function (err) {
    if (bLog) {
      console.log(err);
    }
    console.log('<' + path + '> Update Failed. Try Again. No Exception is thrown. But Fatal.');
  });
}

function createAdminUser(_url) {
  let path = _url + '_config/admins/' + auth.u;
  let password = JSON.stringify(auth.p);

  return updateConfig(path, password).catch(function () {
    console.log('admin password has already been setup');
  });
}

async function addUserRoles(_url, bCouch2) {
  if (bCouch2) {
    await updateConfig(_url + '_users', undefined, true);
    await updateConfig(_url + '_replicator');
  }

  let path = _url + '_users/_security';
  await updateConfig(path, securityDoc, true);
}

async function updateConfigParams(_url, bCouch2) {

  let path1 = _url + '_config/http/authentication_handlers/';
  let path2 = _url + '_config/couch_httpd_oauth/use_users_db';
  let path3 = _url + '_config/httpd/bind_address';
  let path4 = _url + '_config/chttpd/bind_address';
  let path5 = _url + '_config/couchdb/delayed_commits';
  // let path6 = _url + '_config/couchdb/database_dir';
  let path7 = _url + '_config/logal/level';
  let path8 = _url + '_config/couch_httpd_auth/require_valid_user';
  let path9 = _url + '_config/chttpd/require_valid_user';

  //updateConfig exception is not throw .. just console message
  await updateConfig(path1, authHandlerDoc);
  await updateConfig(path2, useUsersDoc);
  await updateConfig(path3, '"0.0.0.0"');
  if (bCouch2) {
    await updateConfig(path4, '"0.0.0.0"');
    await updateConfig(path7, '"none"');
  }
  await updateConfig(path5, '"false"');
  // let dbPath = '"../../data"';
  // if (bCouch2) {
  //   dbPath = '"../data"';
  // }
  // await updateConfig(path6, dbPath);
  await updateConfig(path8, '"true"');
  await updateConfig(path9, '"true"');
}