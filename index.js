var Primus = require('primus.io');
var ControllerBridge = require('compound/lib/controller-bridge');


exports.init = function (compound) {

    var app = compound.app;
    var primus = new Primus(compound.server, { transformer: 'browserchannel' });

    // You can configure primus.io at this point.
    compound.emit('primus.io', primus);

    var map = [];

    compound.map.socket = function(msg, handle) {
        map.push({
            event: msg,
            controller: handle.split('#')[0],
            action: handle.split('#')[1]
        });
    };

    var cookieParser, session;

    app.stack.forEach(function(m) {
        console.log(m.handle);
        switch (m.handle.name) {
            case 'cookieParser':
                cookieParser = m.handle;
                break;
            case 'session':
                session = m.handle;
                break;
        }
    });

    primus.on('connection', function (socket) {
        parseSocketCookies(socket, function(err) {
            if (err) return;// socket.send('error', err);

            console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
            console.log('>>>>>>> A socket with sessionID: ' + socket.sessionID + ' connected!');

            for (i in socket.session) {
                console.log(">>>>>>> ", i)
            }

//            var groupId;
//            socket.join(hs.sessionID);

            var bridge = new ControllerBridge(compound);
            map.forEach(function (r) {
                socket.on(r.event, function (data) {

                    var ctl = bridge.loadController(r.controller);
                    ctl.perform(r.action, {
                        method: 'SOCKET',
                        url: r.action,
                        app: app,
                        param: function(key) {
                            return data[key];
                        },
                        header: function() {
                            return null;
                        },
//                        session: socket.session,
//                        sessionID: socket.sessionID,
                        params: data,
                        socket: socket
                    }, {send: function() {}}, function() {});
                });
            });
        });
    });

    primus.on('disconnection', function (socket) {
        console.log("----------------------------------------------------------------");
        console.log('A socket with sessionID: ' + socket.sessionID + ' disconnected!');
        // clear the socket interval to stop refreshing the session
    });

    function parseSocketCookies(req, next) {
        // check if there's a cookie header
        if (!req.headers.cookie) {
            // if there isn't, turn down the connection with a message
            // and leave the function.
            return next('No cookie transmitted.');
        }

//        req.app = app;

        req.originalUrl = '/';

        cookieParser(req, null, function (err) {
            if (err) return next('Error in cookie parser');
            session(req, {on: function(){}, end: function(){}}, function (err) {
                if (err) return next('Error while reading session');
                next();
            });
        });
    }
};

