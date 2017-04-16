if (typeof String.prototype.startsWith != 'function') {
    // see below for better implementation!
    String.prototype.startsWith = function (str) {
        return this.indexOf(str) == 0;
    };
}

var http = require('http'),
    net = require('net'),
    URL = require('url'),
    querystring = require('querystring'),
    request = require('request'),
    fileSystem = require('fs'),
    path = require('path'),
    md5 = require("js-md5"),
    Datastore = require('nedb')
    , db = new Datastore({ filename: 'webqabuze.db', autoload: true }),
    CombinedStream = require('combined-stream');
db.loadDatabase(function (err) {});
db.ensureIndex({ fieldName: 'username', unique: true }, function (err) {});
var server = http.createServer(onRequest);
server.listen(1337);

//Options:
var blockEverythingElse = true; // Block all traffic besides WebQabuze.
var appid = '214748364'; //Extracted from WebPlayer
var appsecret = '6fdcbccb7a073f35fbd16a193cdef6c4'; //Extracted from WebPlayer
var userauth = 'use your own';


//TLS-/SSL-Tunnelling:
if (!blockEverythingElse) {
    server.on('connect', function (req, cltSocket, head) {
        // connect to an origin server
        var srvUrl = URL.parse('http://' + req.url);
        var srvSocket = net.connect(srvUrl.port, srvUrl.hostname, function () {
            try {
                cltSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                'Proxy-agent: Node-Proxy\r\n' +
                '\r\n');
                console.log("Established TLS-/SSL-Tunnel to " + req.url);
                srvSocket.write(head);
                srvSocket.pipe(cltSocket);
                cltSocket.pipe(srvSocket);
            } catch (e) {
                console.error(e.message);
            }
        });
    });
}

function onRequest(client_req, client_res) {
    try {
        var url = URL.parse(client_req.url);


        if (url.path.startsWith("/api.json/0.2/")) { //Hook the API
            handleQobuz(client_req, client_res);
        } else if (url.path == '/proxy/ip.php') { //IP script... Whatever it does...
            client_res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            client_res.end("\"255.255.255.255\"");
        }else if ((url.path == '/proxy/statsd.php') || url.path == '/js/libs/raven.min.map') { //Block metrics
            client_res.writeHead(404, {});
            client_res.end();
        }  else if (url.path == '/signup') { //Hook the registration
            console.log('serving hooked registration');
            var filePath = path.join(__dirname, 'signup.html');
            var stat = fileSystem.statSync(filePath);

            client_res.writeHead(200, {
                'Content-Type': 'text/html',
                'Content-Length': stat.size
            });

            var readStream = fileSystem.createReadStream(filePath);
            readStream.pipe(client_res);
        }  else if (url.path == '/icon.png') { //Icon link
            console.log('serving hooked icon');
            var filePath = path.join(__dirname, 'icon.png');
            var stat = fileSystem.statSync(filePath);

            client_res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': stat.size
            });

            var readStream = fileSystem.createReadStream(filePath);

            readStream.pipe(client_res);
        }  else if (url.path.startsWith('/img/ui/bg-')) { //Hook BG link
            console.log('serving hooked icon');
            var filePath = path.join(__dirname, 'bg.jpg');
            var stat = fileSystem.statSync(filePath);

            client_res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Content-Length': stat.size
            });

            var readStream = fileSystem.createReadStream(filePath);

            readStream.pipe(client_res);
        }  else if (url.path.startsWith('/js/libs/jquery-')) { //Hook jquery for script injection
            console.log('serving hooked javascript');
            var filePathJq = path.join(__dirname, 'jquery-2.1.1.min.js');
            var statJq = fileSystem.statSync(filePathJq);
            var filePathInject = path.join(__dirname, 'inject.js');
            var statInject = fileSystem.statSync(filePathInject);

            client_res.writeHead(200, {
                'Content-Type': 'application/javascript',
                'Content-Length': (statJq.size + statInject.size)
            });
            var combinedStream = CombinedStream.create({});
            combinedStream.append(fileSystem.createReadStream(filePathJq));
            combinedStream.append(fileSystem.createReadStream(filePathInject));
            combinedStream.pipe(client_res);
        }  else if (url.path.startsWith('/css/all-')) { //Hook css for css injection
            console.log('serving hooked css');
            var filePathJq = path.join(__dirname, 'orig.css');
            var statJq = fileSystem.statSync(filePathJq);
            var filePathInject = path.join(__dirname, 'inject.css');
            var statInject = fileSystem.statSync(filePathInject);

            client_res.writeHead(200, {
                'Content-Type': 'text/css',
                'Content-Length': (statJq.size + statInject.size)
            });
            var combinedStream = CombinedStream.create({});
            combinedStream.append(fileSystem.createReadStream(filePathJq));
            combinedStream.append(fileSystem.createReadStream(filePathInject));
            combinedStream.pipe(client_res);
        } else if (url.path == '/signup?') { //Hook the registration/POST
            console.log('serving POST registration');
            doSignup (client_req, client_res);
        } else { //Proxy the rest:
            if ((!blockEverythingElse) || (url.hostname == 'player.qobuz.com') || (url.hostname == 'streaming.qobuz.com') || (url.hostname == 'static.qobuz.com')) {
                console.log('serve: ' + client_req.url + ' on ' + url.host);
                var options = {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.path,
                    method: client_req.method,
                    headers: client_req.headers
                };

                callback = function (serverResponse) {
                    try {
                        //console.log("statusCode: ", serverResponse.statusCode);
                        //console.log("headers: ", serverResponse.headers);

                        client_res.writeHeader(serverResponse.statusCode, serverResponse.headers);
                        serverResponse.pipe(client_res);

                    } catch (e) {
                        console.error(e.message);
                    }
                }

                client_req.pipe(http.request(options, callback));
            } else { // Or block it :)
                if ((url.pathname == '/') || url.pathname == '') {
                    client_res.writeHeader(307, {'location': '/signup'});
                } else {
                    client_res.writeHeader(404, {});
                }
                console.log("Blocked " + client_req.url);
                client_res.end();
            }
        }

    } catch (e) {
        console.error(e.message);
        client_res.end();
    }
}

// now that proxy is running

function doSignup (client_req, client_res){
    var data = '';
    client_res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    client_req.on('data', function (chunk) {
        data += chunk;
    });
    client_req.on('end', function () {
        data = querystring.parse(data);
        var hash = md5(data.password);
        delete data.password;
        console.log(data);
        db.insert({username : data.username, password : hash, player_settings: playerSettingsStub()}, function(err,docs){
            console.log(err);
            console.log(docs);
            if(docs){
                client_res.end("Account created with username '" + data.username + "' and password with the md5 hash of '" + hash + "'. The user_auth_token is '" + docs._id + "'");
            } else {
                client_res.end("Error: Accountname taken! <a href='/signup'>Try again!</a>");
            }
        });
        db.find({}, function (err, docs) {
            console.log(docs);
        });
        // });
    });
}

function handleQobuz(client_req, client_res) {
    try {
        var url = URL.parse(client_req.url, true);


        console.log("\n------- NEW API CALL -------");
        console.log("QOBOUZ API HANDLER: Handling " + url.path);
        console.log('Method:' + client_req.method);

        client_res.setHeader("Accept-Ranges", "bytes");
        client_res.setHeader("Access-Control-Allow-Credentials", "true");
        client_res.setHeader("Access-Control-Allow-Headers", "x-app-id, x-user-auth-token, x-app-version, x-api-auth-token, x-socket-id, x-requested-with");
        client_res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        client_res.setHeader("Access-Control-Allow-Origin", "http://player.qobuz.com");
        client_res.setHeader("Access-Control-Expose-Headers", "x-zone, x-language-code");
        client_res.setHeader("Access-Control-Max-Age", "1728000");
        client_res.setHeader("Content-Type", "application/json");

        if((client_req.method == 'OPTIONS')){
            client_res.end('{}');
        } else if (url.pathname == '/api.json/0.2/track/reportStreamingStart') {
            //make sure a streaming-start is NEVER transmitted to Qobuz :)
            console.log('Ignoring streaming-start.');
            client_res.end("{ status: 'success' }");
            return;
        } else if (client_req.method == 'POST') {
            console.log("Content-type: " + client_req.headers['content-type']);
            var data = '';
            client_req.on('data', function (chunk) {
                data += chunk;
            });
            client_req.on('end', function () {
                data = querystring.parse(data);
                data.x_user_auth_token = client_req.headers['x-user-auth-token'] || "";
                switch (url.pathname){
                    case '/api.json/0.2/user/login':
                        performLogin(client_res, data);
                        break;
                    case '/api.json/0.2/user/update':
                        updateUser(client_res, data);
                        break;
                }
            });

        } else if (url.pathname == '/api.json/0.2/user/login') {
            data = url.query;
            performLogin(client_res, data);

        } else if (url.pathname.startsWith('/api.json/0.2/track/getFileUrl')) {
            data = url.query;
            generateSongJSON(client_res, data);

        } else {
            var _output = generateLink(url);
            console.log(_output)
            request(_output, function (error, response, body) {
                body = JSON.parse(body);
                console.log(body);
                client_res.end(JSON.stringify(body));
            });
            //client_res.end(_output);
        }
    } catch (e) {
        console.error(e.message);
    }
    console.log("------- END API CALL -------\n");
}

function performLogin(client_res, data){
    returrnValue = loginStub();
    db.find({username: data.username, password: data.password}, function(err,docs) {
        if(docs[0]){
            returrnValue.user.login = docs[0].username;
            returrnValue.user_auth_token = docs[0]._id;
            returrnValue.user.player_settings = (docs[0].player_settings);
            client_res.end(JSON.stringify(returrnValue));
            return;
        } else {
            db.find({_id: data.user_auth_token}, function(err,docs) {
                if(docs[0]){
                    console.log(docs[0]);
                    returrnValue.user.login = docs[0].username;
                    returrnValue.user_auth_token = docs[0]._id;
                    returrnValue.user.player_settings = (docs[0].player_settings);
                    client_res.end(JSON.stringify(returrnValue));
                    return;
                } else {
                    client_res.end('{"status":"error","code":401,"message":"Invalid username\/email and password combination"}');
                    return;
                }
            })
        }
    })
}
function updateUser(client_res, data){
    returrnValue = loginStub();
    db.update({_id: data.user_auth_token || data.x_user_auth_token},{ $set: {player_settings: data.player_settings}}, {}, function(err,numReplaced) {
        if(numReplaced > 0){
            db.find({_id: data.user_auth_token || data.x_user_auth_token}, function(err,docs) {
                if(docs[0]){
                    returrnValue.user.login = docs[0].username;
                    returrnValue.user_auth_token = docs[0]._id;
                    returrnValue.user.player_settings = docs[0].player_settings;
                    client_res.end(JSON.stringify(returrnValue));
                    return;
                } else {
                    client_res.end('{"status":"error"}');
                    return;
                }
            });
        } else {
            client_res.end('{"status":"error"}');
            return;
        }
    });
}

function generateLink(url, queries) {

    queries = queries || url.query;
    var apimethod = url.pathname.replace("/api.json/0.2/", '').replace("/", '');
    var argString = '';
    var timestamp = Math.round(new Date().getTime() / 1000);
    var signature;
    var output = '';
    //remove any auth or signgature:
    delete queries.app_id;
    delete queries.request_sig;
    delete queries.request_ts;
    delete queries.user_auth_token;
    delete queries['']; //possible leftover from Qabuze
    //result:
    console.log(queries);
    //sort properites alphabetically:
    var keys = Object.keys(queries);
    var i, len = keys.length;
    keys.sort();
    for (i = 0; i < len; i++) {
        k = keys[i];
        //on the fly changes:
        switch (k) {
            case "format_id": //set format if key exists
                //queries[k] = 6; //'audio/flac'
                //queries[k] = 5; //'audio/mpeg'
                break;
            case "":
                continue;
        }
        // and append to a string
        argString += k + queries[k];
        output += k + "=" + queries[k] + "&";
    }

    signature = apimethod + argString + timestamp + appsecret;
    signature = md5(signature);
    //This is the signature:
    console.log("Generated signature: " + signature);
    //Generate base output:
    var login = (url.pathname == '/api.json/0.2/user/login')
    return ('http://www.qobuz.com' + url.pathname + '?' + output + 'app_id=' + appid + (login ? '' : '&user_auth_token=' + userauth) + '&request_ts=' + timestamp + '&request_sig=' + signature);

}

function generateSongJSON(client_res, data){

    var link = generateLink(URL.parse('http://host/api.json/0.2/track/getFileUrl?'), data);
    request(link, function (error, response, body) {
        console.log(JSON.parse(body));
        client_res.end(body);
    });

}

function loginStub(){return {"user":{"id":1,"email":"no@mail.com","login":"user","firstname":"","lastname":"","country_code":"DE","language_code":"de","zone":"DE","store":"DE-de","country":"DE","avatar":"http:\/\/static.qobuz.com\/icon.png","player_settings":{"browser":{"userAgent":"","browserName":"firefox","browserVersion":33,"osName":"windows","platform":"Win32","cookieEnabled":true,"language":"en-US","touchDevice":false,"applicationCache":true,"localStorage":true,"context":"web","qobuzDesktopVersion":null,"qobuzPlayerVersion":"","systemUID":null,"remoteAddr":"127.0.0.1"},"facebook_auto_login":false,"player_loop":1},"credential":{"id":285614,"label":"streaming-lossless","description":"Abonn\u00e9 Qobuz Hi-Fi","parameters":{"lossy_streaming":true,"lossless_streaming":true,"mobile_streaming":true,"offline_streaming":true,"included_format_group_ids":[2,3,4],"included_supplier_ids":[22],"color_scheme":{"logo":"#d74829"},"label":"Qobuz Hi-Fi","short_label":"Qabuze"}},"externals":{}},"user_auth_token":"","expires_in":100000000}};
function playerSettingsStub(){return  {"playlists_sort":"alphabetical","last_state":{"datetime":0,"page":["user-settings"],"track":{"paused":true,"position":0,"id":0}}}};