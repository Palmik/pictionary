function initialize()
{
    var context = document.getElementById('canvas-canvas').getContext('2d');
    var client = new Client(context, {});
}

// CLIENT
//
function Client(context_, options_)
{
    var self = this;

    var controls = 
        { pencil :
            { width : document.getElementById('canvas-pencil-width')
            , color : document.getElementById('canvas-pencil-color')
            }
        };

    // Public properties.
    self.context = context_;
    self.options = options_;
    self.messageBox = new MessageBox(document.getElementById('canvas-message-box')); 
    self.canvas  = new Canvas(self.context, controls, {});
    self.socket  = io.connect();
    self.nickname = 'anonymous';

    self.peers = {};

    // LOCAL EVENTS
    // CHAT
    self.messageBox.onSend = function(data)
    {
        self.messageBox.addMessage({ nickname : self.nickname, message : data })
        self.socket.emit('room peer message', data);
    };

    // PENCIL
    self.canvas.tools.pencil.onOptionsChange = function(options)
    {
        self.socket.emit('canvas pencil options', options);
    }
    
    self.canvas.tools.pencil.onDrawB = function(point)
    {
        self.socket.emit('canvas pencil drawB', point);
    }
    
    self.canvas.tools.pencil.onDraw = function(point)
    {
        self.socket.emit('canvas pencil draw', point);
    }
    
    self.canvas.tools.pencil.onDrawE = function(point)
    {
        self.socket.emit('canvas pencil drawE', point);
    }

    // REMOTE EVENTS
   
    // ROOM
    self.socket.on('room peer join', function(data)
    {
        self.peers[data.id] = {}
        self.peers[data.id].tools = new Tools(self.context);
        self.peers[data.id].nickname = data.nickname;
    });

    self.socket.on('room peer part', function(data)
    {
        delete self.peers[data.id];
    });

    self.socket.on('room peer message', function(data)
    {
        self.messageBox.addMessage({ nickname : self.peers[data.id].nickname, message : data.message })
    });

    self.socket.on('room peer options', function(data)
    {
        self.peers[data.id].nickname = data.nickname;
    });

    // PENCIL
    self.socket.on('canvas pencil options', function(data)
    {
        self.peers[data.id].tools.pencil.set(data.options);
    });

    self.socket.on('canvas pencil drawB', function(data)
    {
        self.peers[data.id].tools.pencil.drawB(data.point);
    });
    
    self.socket.on('canvas pencil draw', function(data)
    {
        self.peers[data.id].tools.pencil.draw(data.point);
    });
    
    self.socket.on('canvas pencil drawE', function(data)
    {
        self.peers[data.id].tools.pencil.drawE(data.point);
    });

    // JOIN THE ROOM
    self.socket.emit('room peer join', { room : 'test', nickname : self.nickname });
    self.socket.emit('canvas pencil options', self.canvas.tools.pencil.options);
}

// CANVAS CONTROLS
//
function Canvas(context_, controls_, options_)
{
    var self = this;
    
    // Public properties.
    self.context = context_;
    self.options = options_;
    self.controls = controls_;

    self.tools = new Tools(self.context);
    self.tools.active = 'pencil';

    self.context.canvas.addEventListener('mousemove', self.eventCanvasMouseMove.bind(self), false);
    self.context.canvas.addEventListener('mousedown', self.eventCanvasMouseButtonLP.bind(self), false);
    self.context.canvas.addEventListener('mouseup',   self.eventCanvasMouseButtonLR.bind(self), false);

    self.controls.pencil.width.addEventListener('input', self.eventControlsPencilWidth.bind(self), false);
    self.controls.pencil.color.addEventListener('input', self.eventControlsPencilColor.bind(self), false);

    // Private variables.
    self.p = {};
}

Canvas.prototype.relativeCanvasMouseEvent = function(e)
{
    var res = {};

    if (e.offsetX)
    {
        res.x = e.offsetX;
        res.y = e.offsetY;
    }
    if (e.layerX)
    {
        res.x = e.layerX;
        res.y = e.layerY;
    }

    return res;
} 

Canvas.prototype.eventCanvasMouseButtonLP = function(e) 
{
    e = this.relativeCanvasMouseEvent(e); 
    
    switch (this.tools.active)
    {
        case 'pencil':
        {
            this.tools.pencil.drawB(e);
            break;
        }
    } 
}

Canvas.prototype.eventCanvasMouseButtonLR = function(e)
{
    e = this.relativeCanvasMouseEvent(e); 

    switch (this.tools.active)
    {
        case 'pencil':
        {
            this.tools.pencil.drawE(e);
            break;
        }
    } 
}

Canvas.prototype.eventCanvasMouseMove = function(e) 
{
    e = this.relativeCanvasMouseEvent(e); 
   
    switch (this.tools.active)
    {
        case 'pencil':
        {
            this.tools.pencil.draw(e);
            break;
        }
    } 
}

Canvas.prototype.eventControlsPencilWidth = function(e) 
{
    var val = this.controls.pencil.width.value;
    this.tools.pencil.set({ width : val });
}

Canvas.prototype.eventControlsPencilColor = function(e) 
{
    var val = this.controls.pencil.color.value;
    this.tools.pencil.set({ color : val });
}

// USER
function Tools(context_)
{
    var self = this;
    
    // Public properties.
    self.context = context_;

    // Tools.
    self.pencil = new Pencil(self.context, {color : 'black', width : 5});
}

// CANVAS TOOLS

// PENCIL
//
// options_ =
//     { color : ...
//     , width : ...
//     }
function Pencil(context_, options_)
{
    var self = this;
 
    // Public properties.
    self.context = context_;    
    self.options = options_;
    self.active = false;
        
    // Private variables.
    self.p = {};
    self.previous = undefined;
};

Pencil.prototype.drawB = function(point)
{
    if (this.active) return;

    // Draw BEGIN
    this.enforcePencilOptions();
    drawCircle(this.context, { center : point, radius : this.options.width / 2 });
    // Draw END

    this.p.previous = point;
    this.active = true;

    if (this.onDrawB)
    {
        this.onDrawB(point);
    }
}

Pencil.prototype.draw = function(point)
{
    if (!this.active || !(Math.abs(point.x - this.p.previous.x) > 2 ||
                          Math.abs(point.y - this.p.previous.y) > 2
                         )
       ) return; 
   
    // Draw BEGIN
    this.enforcePencilOptions();
    drawLine(this.context, { start : this.p.previous, end : point });
    // Draw END
        
    this.p.previous = point;
      
    if (this.onDraw)
    {
        this.onDraw(point);
    }
}

Pencil.prototype.drawE = function(point)
{
    if (!this.active) return; 
    
    this.p.previous = undefined;
    this.active = false;

    if (this.onDrawE)
    {
        this.onDrawE(point);
    }
}

Pencil.prototype.set = function(data)
{
    for (var p in data)
    {
        if (data.hasOwnProperty(p) && this.options.hasOwnProperty(p))
        {
            this.options[p] = data[p];
        }
    }

    if (this.onOptionsChange)
    {
        this.onOptionsChange(this.options);
    }
}

Pencil.prototype.enforcePencilOptions = function()
{
    this.context.fillStyle = this.options.color;
    this.context.strokeStyle = this.options.color;
    this.context.lineWidth = this.options.width;
    this.context.lineCap = 'round';
}


// PRIMITIVES

// Draws a circle. Uses the given context.
function drawCircle(context, options)
{
    context.beginPath();
    context.moveTo(options.center.x, options.center.y);
    context.arc(options.center.x, options.center.y, options.radius, 0, Math.PI*2, false);
    context.fill();
}

// Draws a line segment. Uses the given context.
function drawLine(context, options)
{
    context.beginPath();
    context.moveTo(options.start.x, options.start.y);
    context.lineTo(options.end.x, options.end.y);
    context.stroke();
}

function MessageBox(node_)
{
    var self = this;

    self.options = {};
    self.node = node_;
    self.node.messages = document.createElement('ul');
    self.node.input = document.createElement('input');
    
    self.node.input.setAttribute('type', 'text');
    self.node.input.setAttribute('style', 'width: 100%');

    self.node.appendChild(self.node.messages);
    self.node.appendChild(self.node.input);

    self.node.input.addEventListener('keyup', function(e)
    {
        if (e.keyCode == 13)
        {
            if (self.onSend)
            {
                self.onSend(self.node.input.value);
            }

            self.node.input.value = "";
        }
    });
}

MessageBox.prototype.addMessage = function(data)
{
    var message = document.createElement('li');
    var nickname = document.createElement('strong');
    nickname.appendChild(document.createTextNode(data.nickname + ': '));
    message.appendChild(nickname);
    message.appendChild(document.createTextNode(data.message));

    this.node.messages.appendChild(message);
}

