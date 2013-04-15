var express = require('express');
var http    = require('http');
var app     = express();
var server  = http.createServer(app);
var io      = require('socket.io').listen(server);

app.configure(function()
{
    app.use('/static', express.static(__dirname + '/static'));
});        

server.listen(8080);

//var serverAdress = 'http://dicktionary.eu01.aws.af.cm';
//var serverAdress = 'http://pictionary.palmik.jit.su';
var serverAdress = 'http://127.0.0.1:8080';

app.get('/r/:room', function (req, res)
{
    res.render(__dirname + '/room.ejs',
        { 'server' : serverAdress
        , 'room' : req.params.room 
        });
});

var peers = {};

function Server()
{
    var self = this;

    // Public properties.
    self.peers = {};
    self.rooms = {};

    io.sockets.on('connection', function(socket)
    {
        self.peers[socket.id] = {};
        self.peers[socket.id].tools = {};
        self.peers[socket.id].tools.pencil = {};
        self.peers[socket.id].ready = false;

        socket.on('room peer join', function (data)
        {
            if (!self.rooms[data.room])
            {
                self.rooms[data.room] = {};
                self.rooms[data.room].owner = socket.id;
            }
            
            socket.join(data.room);
            socket.broadcast.to(data.room).emit('room peer join',
                { nickname : data.nickname, id : socket.id }
            );
            
            self.peers[socket.id].room = data.room;
            self.peers[socket.id].nickname = data.nickname;

            for (var p in self.peers)
            {
                if (self.peers.hasOwnProperty(p) && p != socket.id)
                {
                    if (self.peers[p].tools.pencil.options)
                    {
                        socket.emit('room peer join',
                            { id : p, nickname : self.peers[p].nickname }
                        );
                        socket.emit('canvas pencil options',
                            { id : p, options : self.peers[p].tools.pencil.options }
                        );
                    }
                }
            }
        });
        
        socket.on('room peer message', function (data)
        {
            console.log('received: ' + data);
            socket.broadcast.to(self.peers[socket.id].room).emit('room peer message',
                { message: data, id : socket.id }
            );
        });
    
        socket.on('disconnect', function ()
        {
            socket.broadcast.to(self.peers[socket.id].room).emit('room peer part',
                { id : socket.id }
            );

            delete self.peers[socket.id];
        });
   
        socket.on('canvas pencil options', function(options)
        {
            self.peers[socket.id].tools.pencil.options = options;
            
            socket.broadcast.to(self.peers[socket.id].room).emit('canvas pencil options',
                { id : socket.id, options : options}
            );
        });

        socket.on('canvas pencil drawB', function(point)
        {
            socket.broadcast.to(self.peers[socket.id].room).emit('canvas pencil drawB',
                { id : socket.id, point : point}
            );
        });
        
        socket.on('canvas pencil draw', function(point)
        {
            socket.broadcast.to(self.peers[socket.id].room).emit('canvas pencil draw',
                { id : socket.id, point : point}
            );
        });
        
        socket.on('canvas pencil drawE', function(point)
        {
            socket.broadcast.to(self.peers[socket.id].room).emit('canvas pencil drawE',
                { id : socket.id, point : point}
            );
        });
   });

}
new Server();

