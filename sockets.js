// NEEDED EMISSIONS:
//
// Game / Lobby
//  user joins lobby
//  user takes slot
//  user types in chat
//

module.exports = function(express, app, io, passport, db, store) {
  io.set('authorization', passport.socket.authorize({
    sessionKey:    'connect.sid',
    sessionStore:  store,
    sessionSecret: "catanodetesting",
    fail: function(data, accept) {
      accept(null, true);
    },
    success: function(data, accept) {
      accept(null, true);
    }
  }));

  io.sockets.on('connection', function(client) {
    client.authenticated = function() {
      return (client.handshake.user && client.handshake.user.username);
    };

    client.getUser = function() {
      return client.handshake.user;
    }

    client.emissions = {};

    // Lobby / Games
    client.emissions.message = function( data ) {
      // takes data.name data.message, data.game as params to emit to games.
      io.sockets.in( data.game ).emit('game_message', {
        from: data.name || "God",
        message: data.message
      });
    }

    client.on('game_view', function(data) {
      console.log( io.sockets );
      io.sockets.in( '/' + data.port ).emit("game_view", data);
    });

    client.on('game_occupy', function(data) {
      console.log( '-- start game_occupy -- ' );
      console.log( data );
      console.log( '-- end game_occupy -- ' );
      console.log( data );
    });

    client.on('game_message', function(data) {
      if( client.authenticated() ) {
        client.emissions.message({
          game: data.game,
          name: client.getUser().username,
          message: data.message
        });
      }
    });

    io.client = client;
  });
}
