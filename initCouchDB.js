'use strict';

require('shelljs/global');
var fetch = require('node-fetch');
var urlHelper = require('url');

var addCorsToCouch = require('add-cors-to-couchdb');

var yargs = require('yargs')
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
var argv = yargs.argv;
if (argv.h) {
  yargs.showHelp();
  return process.exit(0);
}

var url2 = 'http://127.0.0.1:5984';
var url = url2 + '/_node/couchdb@localhost/';

var auth = {
  u: 'couchadmin',
  p: 'test'
};

if (argv.p && argv.u) {
  auth = {
    u: argv.u,
    v: argv.p
  };
}

var formattedUrl = formatUrl(url, auth);
var formattedUrl2 = formatUrl(url2, auth);
var securityDoc = '{ "admins": { "names": [], "roles": ["admin"]}, "members": { "names": [], "roles": []}}';
var authHandlerDoc = '"{couch_httpd_oauth, oauth_authentication_handler}, {couch_httpd_auth, proxy_authentification_handler}, {couch_httpd_auth, cookie_authentication_handler}, {couch_httpd_auth, default_authentication_handler}"';
var useUsersDoc = '"true"';

//todo : handle creating user if user is already created
return createAdminUser(url).then(function (resp) {
  //return Promise.resolve().then(function () {
  return step2();
}).catch(function (err) {
  return step2();
});

function step2() {
  var promisesArray = [];
  var corsUrl = formattedUrl2.substr(0, formattedUrl.length - 1);
  promisesArray.push(addCorsToCouch(corsUrl));
  promisesArray.push(addUserRoles(formattedUrl));
  promisesArray.push(updateConfigParams(formattedUrl));
  promisesArray.push(updateConfig(formattedUrl2 + '_users'));
  promisesArray.push(updateConfig(formattedUrl2 + '_replicator'));

  return Promise.all(promisesArray);
}

function formatUrl(baseUrl, auth) {
  var urlObject = urlHelper.parse(baseUrl);

  if (auth) {
    urlObject.auth = auth.u + ':' + auth.p;
  }

  return urlHelper.format(urlObject);
}

function updateConfig(path, reqData) {
  return fetch(path, {
    method: 'PUT',
    body: reqData
  }).then(function (resp) {
    if (resp.status === 200) {
      return;
    }
    return resp.text().then(function (text) {
      throw new Error('status ' + resp.status + ' ' + text);
    });
  }).catch(function (err) {
    throw err;
  });
}

function createAdminUser(_url) {
  var path = _url + '/_config/admins/' + auth.u;
  var password = JSON.stringify(auth.p);

  return updateConfig(path, password);
}

function addUserRoles(url) {
  var path = url + '_users/_security';
  return updateConfig(path, securityDoc);
}

function updateConfigParams(url) {

  var path1 = url + '/_config/http/authentication_handlers/';
  var path2 = url + '/_config/couch_httpd_oauth/use_users_db';
  var path3 = url + '/_config/httpd/bind_address';
  var path4 = url + '/_config/chttpd/bind_address';

  var promisesArray = [];
  promisesArray.push(updateConfig(path1, authHandlerDoc));
  promisesArray.push(updateConfig(path2, useUsersDoc));
  promisesArray.push(updateConfig(path3, '"0.0.0.0"'));
  promisesArray.push(updateConfig(path4, '"0.0.0.0"'));
  return Promise.all(promisesArray);
}