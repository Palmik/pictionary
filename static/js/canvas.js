//var serverAdress = 'http://dicktionary.eu01.aws.af.cm';
//var serverAdress = 'http://palmik.pictionary.jit.su';

var canvas = {};
var button = {};
var socket = io.connect();

function initialize(room)
{
    console.log('initialize(' + room + ')');
    
    canvas = document.getElementById('canvas-canvas');
    if (!canvas || !canvas.getContext)
    {
        alert('Your browser does not support canvas!');
        return;
    }
    canvas.context = canvas.getContext('2d');
    
    // Current tool.
    canvas.client = {};
    canvas.pencil = new pencil();

    // Server sent events.
    socket.on('room join done', function (data)
    {
        console.log('room join confirmation');

        socket.id = data.id;
        canvas.addEventListener('mousemove', eventCanvasMouse, false);
        canvas.addEventListener('mousedown', eventCanvasMouse, false);
        canvas.addEventListener('mouseup',   eventCanvasMouse, false);
 
        button.clear = document.getElementById('canvas-button-clear');
        button.clear.onclick = eventCanvasClear;
    });

    socket.on('room join', function (data)
    {
        handleRoomJoin(data.nick, data.id);  
    });

    socket.on('canvas pencil', function (data)
    {
        canvas.pencil.handle(data.event, data.sender);  
    });
     
    socket.on('canvas clear', function()
    {
        handleCanvasClear();
    });
   
    socket.emit('room join', room, 'Palmik');
}

// This handles local canvas events and dispatches them further
// (depending on the currently used tool).
function eventCanvasMouse(e)
{
    me = {};
    if (e.offsetX)
    {
        me.x = e.offsetX;
        me.y = e.offsetY;
    }
    else if (e.layerX)
    {
        me.x = e.layerX;
        me.y = e.layerY;
    }
    me.type = e.type;

    canvas[canvas.client[socket.id].tool].event(me);
}

// This handles local canvas clear (clears the local canvas and
// notifies the server).
function eventCanvasClear()
{
    socket.emit('canvas clear');
    handleCanvasClear();
}

// Clears the local canvas (called by eventCanvasClear or
// when the client receives 'canvas clear').
function handleCanvasClear()
{
    canvas.context.clearRect(0, 0, canvas.width, canvas.height);
}

function pencil()
{
    var self = this;

    self.defaultSettings = {};
    self.defaultSettings.color = 'rgba(0,0,0,1)';
    self.defaultSettings.width = 3;
    
    self.client = {};

    self.initializeClient = function(id)
    {
        self.client[id] = {};
        self.client[id].settings = this.defaultSettings;
        self.client[id].drawing  = false;
        self.client[id].previous = {};
    };

    self.event = function(e)
    {
        var id = socket.id;
        var member = {};

        member.mousemove = function(e)
        {
            if ( self.client[id].drawing &&
                   ( Math.abs(self.client[id].previous.x - e.x) >= self.client[id].settings.width * 3 ||
                     Math.abs(self.client[id].previous.y - e.y) >= self.client[id].settings.width * 3
                   )
               )
            {
                self.handle(e, id);
                socket.emit('canvas pencil', e);
            }
        }
    
        member.mousedown = function(e)
        {
            self.handle(e, id);
            socket.emit('canvas pencil', e);
        }
    
        member.mouseup = function(e)
        {
            self.handle(e, id);
            socket.emit('canvas pencil', e);
        }
        
        if (!self.client[id])
        {
            self.initializeClient(id);
        }
        
        member[e.type](e);
    };

    self.handle = function(e, id)
    {
        var member = {};
        
        member.mousemove = function(e, id)
        {
            line(self.client[id].previous, e, self.client[id]);
                
            self.client[id].previous.x = e.x;
            self.client[id].previous.y = e.y;
        };
    
        member.mousedown = function(e, id)
        {
            dot(e, self.client[id]);
            
            self.client[id].previous.x = e.x;
            self.client[id].previous.y = e.y;
            self.client[id].drawing = true;
        };
    
        member.mouseup = function(e, id)
        {
            self.client[id].drawing = false;
        };
        
        if (!self.client[id])
        {
            self.initializeClient(id);
        }

        member[e.type](e, id);
    };
    
    var line = function(s, t, client)
    {
        canvas.context.fillStyle = client.settings.color;
        canvas.context.lineWidth = client.settings.width;
        canvas.context.lineCap = 'round';
        
        canvas.context.beginPath();
        canvas.context.moveTo(s.x, s.y);
        canvas.context.quadraticCurveTo(t.x, t.y, t.x, t.y);
        canvas.context.stroke();
    }

    var dot = function(s, client)
    {
        canvas.context.fillStyle = client.settings.color;
        canvas.context.moveTo(s.x, s.y);
        canvas.context.arc(s.x, s.y, client.settings.width / 2, 0, Math.PI*2, false);
        canvas.context.fill();
    }
}

function handleRoomJoin(nick, id)
{
    canvas.pencil.initializeClient(id);
    canvas.client[id] = {};
    canvas.client[id].tool = 'pencil';
}

