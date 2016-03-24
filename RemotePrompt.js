var udp = require('dgram');
var net = require('net');
var Mp3Library = require('./lib/Mp3Library');
var Mp3Source = require('./lib/Mp3Source');
var RTPProtocol = require('./RTPProtocol');

var RemotePrompt = function(library){

    var sessionsDB = {};
    //instantiate a TCP Server
    this.server = net.createServer();

    this.listen = function(port){
       //wait for incoming connections
    	this.server.listen(port);
    };

    this.close = function(){
        this.server.close();
    };
    
    this._resolveCommand = function(command){
        // se deshabilita el timeout por si hubiera sido activado
        this.conn.setTimeout(0);

        switch(command){
            case "list":
                var playlist = this.source.list();
                this.conn.write("\r\nSongs in the playlist");
                this.conn.write("\r\n---------------------");
                for (var i=0; i < playlist.length; i++){
                    var song = playlist[i];
                    this.conn.write("\r\n" + (this.source.currentTrack() == song? "> " : "  ") + song);
                }
                this.conn.write("\r\n# ");
                break;
            case "play":
                this.source.play();
                break;
            case "pause":
                this.source.pause();
                break;
            case "next":
                this.source.next();
                break;
            case "prev":
                this.source.prev();
                break;
            case "exit":
                delete sessionsDB[this.remoteAddress];
                this.conn.end("Bye.");
                break;
            default:
                this.conn.write("Command " + command + " unknown\r\n# ");
        }
    }

    //attend incoming connections
    this.server.on('connection', function(connection){

        var remoteIP = connection.remoteAddress;
        //write in connection socket
        connection.write("Welcome to your command line playlist manager, " + remoteIP);
        
        if (remoteIP in sessionsDB){
            //close connections
            connection.end("Duplicated session, closing.");
        }else{
            
            /*
                Por cada una de las conexiones anteriores se creará una fuente de audio MP3,MP3Source, 
                que controle el estado de la reproducción. Esta clase proporcionará para ese propósito
                unas funciones que se invocarán según demanden los comandos. Además,informará a través 
                de eventos sobre aspectos relevantes de la reproducción que son útiles que el cliente 
                conozca, notificándoselo automáticamente.
            */
            
            var client = {};
            client.conn = connection;
            client.source =  new Mp3Source(library);
            client.rtpprotocol = new RTPProtocol();
            client.udpSocket = udp.createSocket('udp4');

            client.rtpprotocol.on('packet', function(packet){
                client.udpSocket.send(packet, 0, packet.length, 5002, remoteIP);
            });

            client.source.on('frame', function(frame){
                client.rtpprotocol.pack(frame);
            });

            client.source.on('track', function(trackName){
                client.conn.write("Now playing " + trackName + "\r\n# ");
            });

            client.source.on('pause', function(trackName){
                client.conn.write(trackName + " paused.\r\n# ");
            });

            client.source.on('listEnd', function(){
                var seconds = 10;
                client.conn.write("End of the list reached.Closing in " + seconds + " seconds\r\n# ");
                client.conn.setTimeout(seconds * 1000, function(){
                    delete sessionsDB[this.remoteAddress];
                    //close the connection
                    client.conn.end("Your session has expired. Closing.");
                });
            });
            
            //receive incoming data from connections
            client.conn.on('data', function(data){
                var command = data.toString('utf8').split("\r\n")[0];
                command && this._resolveCommand.apply(client,[command]);
            }.bind(this));
            
            client.conn.on('close', function(){
                client.source.stop();
                client.udpSocket.close();
                delete sessionsDB[this.remoteAddress];
            });
            
            client.conn.write("\r\nNow, point your player to:\r\n\trtp://" + remoteIP + ":5002\r\n# ");
            //save the client
            sessionsDB[remoteIP] = client;
        }
        
      }.bind(this));
};


/*
    Sin embargo, a pesar de tener un constructor, RemotePrompt sólo es instanciable desde el módulo RemotePrompt.js
    a través del método create() que es lo único que éste exporta, no pudiendo hacerse de otra manera (por ejemplo con 
    new). El motivo es que construir la librería de archivos MP3Library, otro de los cometidos de create(), consume un tiempo
    indeterminado que debe esperarse y durante el cual, el objeto RemotePrompt está en un estado indefinido. 
    Con create() se eliminan los errores derivados de esta espera, pues gestiona ella misma el evento ’ready’
    de la librería, y ofrece una instancia de RemotePrompt funcional desde el primer momento. El siguiente fragmento de código explica lo anterior, aunque
    no sería necesario conocerlo para el desarrollo de la práctica:
*/

exports.create = function(){
    var actions = [], app = null, library = new Mp3Library({ basedir: './songs/' });
    
    library.on('ready', function(){
        app = new RemotePrompt(this);
        for (var i = 0; i< actions.length; i++){
            actions[i].apply(app);
        };
        actions = undefined;
        console.log("The Node-playlist-tcp is running");
    });

    return new function(){
        
        var _defer = function(callback){
            if (actions){
                actions.push(callback);
            } else {
                callback.apply(app)
            }
        };
		
        var self = this;
        this.listen = function(port){
            _defer(function(){
                this.listen(port);
            })
        };
		
        this.close = function(){
            _defer(function(){
                this.close();
            })
        };
		
        this.onListening = function(callback){
            _defer(function(){
                this.server.on('listening', callback);
            });
            return self;
        }

        this.getServer = function(callback){
            _defer(function(){
                callback(this.server);
            });
        }
    }
};