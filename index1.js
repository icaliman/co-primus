var Primus = require('primus.io');
var passport = require('passport');
var ControllerBridge = require('compound/lib/controller-bridge');


exports.init = function (compound) {

    var primus = new Primus(compound.server, { transformer: 'browserchannel' });

    primus.app = {}
    primus.app.stack = [];
    primus.app.use = function(m) {
        console.log("Primus use : >>>>> ", m.name);
        primus.app.stack.push({handle: m});
    }

    var app = primus.app;

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

    compound.app.stack.forEach(function(m) {
        switch (m.handle.name) {
            case 'cookieParser':
                cookieParser = m.handle;
                break;
            case 'session':
                session = m.handle;
                break;
        }
    });

    app.use(cookieParser);
    app.use(session);
//    app.use(passport.initialize());
//    app.use(passport.session());

    primus.on('connection', function (socket) {
        parseSocketCookies(socket, function(err) {
            if (err) return console.log("ERROR: ", err);// socket.send('error', err);

            console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
            console.log('>>>>>>> A socket with sessionID: ' + socket.sessionID + ' connected!');

//            delete socket.session.csrfToken;

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
                        session: socket.session,
                        sessionID: socket.sessionID,
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

        req.originalUrl = '/';

        var runHandler = function(nr) {
//            console.log(i, app.stack.length, app.stack[i].handle.name);
//            console.log("____________-----------------------------_",app.stack[nr]);
//            console.log("____________-----------------------------_",app.stack[nr].handle.name);
            console.log("____________-----------------------------_", nr, primus.app.stack[nr], primus.app.stack[nr].handle.name);


//            console.log("-----------------=====================", nr);

            primus.app.stack[nr].handle(req, {on: function(){}, end: function(){}}, function(err) {
                console.log("session: ", req.session);

                if (err) return next(err);

                console.log("+++++++++++++++++++++++++ ", nr, primus.app.stack.length);

                if (nr<app.stack.length) {
                    runHandler(nr+1);
                } else {
                    next();
                }
            });
        }
        runHandler(0);

//        cookieParser(req, null, function (err) {
//            if (err) return next('Error in cookie parser');
//            session(req, {on: function(){}, end: function(){}}, function (err) {
//                if (err) return next('Error while reading session');
//                next();
//            });
//        });
    }
};

