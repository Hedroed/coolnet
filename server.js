const fs = require('fs');
const express = require('express');
const app = express();

app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/index.html');
});

app.use(express.static('public'));


// var server = require('http').createServer(app);

// HTTPs server
var options = {
    key: fs.readFileSync('keys/key.pem'),
    cert: fs.readFileSync('keys/cert.pem')
};
var server = require('https').createServer(options, app);


// socket.io goes below
var io = require('socket.io')(server);

io.on('connection', function (socket) {
    var username = null;

    socket.on('new-user', function (data) {
        console.log("User", data);
        username = data.sender
    });

    socket.on('message', function (data) {
        if (data.sender == username) {
            socket.broadcast.emit('message', data.data);
        }
    });

    socket.on('disconnect', function() {
        if(username) {
            console.log("User disconnect (leave)", username);
            socket.broadcast.emit('user-left', username);
            username = null;
        }
    });
});

// run app
server.listen(8080, function(){
    console.log('Please open URL: https://localhost:8080/');
});

process.on('unhandledRejection', (reason, promise) => {
  process.exit(1);
});

