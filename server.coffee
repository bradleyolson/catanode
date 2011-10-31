#require
http = require 'http'
_ = require 'underscore'
backbone = require 'backbone'
express = require 'express'
app = express.createServer()
socket = require('socket.io').listen(app)

# set up app
app.register '.jade', require 'jade'
app.set 'view engine', 'jade'
app.set 'view options', {
  layout: false
}
app.use express.static(__dirname + "/public/")

# start 'games'
games_server = require('./lib/games')
games = new games_server.start(0, 9000)

# routes
app.get '/', (req, res) ->
  res.render 'index'

app.get '/create', (req, res) ->
  game_port = games.create()
  if typeof game_port == 'number'
    socket.rooms[game_port] = {}
    res.redirect '/connect/' + game_port
  else
    res.render 'error', locals:
                           reason: game_port

app.get '/error', (req, res) ->
  res.render 'error', locals:
                      reason: "An error has occurred."

app.get '/connect', (req, res) ->
  res.render 'index'

app.get '/connect/:game_id', (req, res) ->
  if !games.list[req.params.game_id]
    new_id = games.create(req.params.game_id)

    # redirect to generated game if a new id had to be used.
    res.redirect '/connect/' + new_id if new_id != req.params.game_id

  res.render 'setup', locals:
                        game_id: req.params.game_id,
                        players: games.list[req.params.game_id].players,
                        url: req.headers.host + req.url

# pulls port from a requesting url (the last character string)
Array::last = ->
  return this[this.length-1]

String::port = ->
  return parseInt(this.split('/').last().split(/[^0-9]/)[0])

# sockets
socket.sockets.on 'connection', (client) ->
  client.on 'join_lobby', (data) -> # any user joins the main lobby
    client.join data.game.port()

  client.on 'join_chat', (data) -> # user connects via name input on lobby screen
    room = data.game.port()
    if socket.rooms['/' + room].indexOf(client.id) > -1
      lobbyist = games.add_lobby room, client.handshake.address.address, client.id, data.name
      if lobbyist
        client.emit 'allowed', { name: lobbyist.name, type: 'chat', message: 'has connected to the server.' }
        # socket.sockets.in(data.game.port()).emit 'message', { action: 'join'}
      else
        client.emit 'not_allowed', { name: data.name, message: 'is already taken in this chat.' }

  client.on 'join_game', (data) ->
    room = data.game.port()
    slot = if data.slot != -1 then data.slot else 1
    if socket.rooms['/' + room].indexOf(client.id) > -1
      player = games.add_player room, data.slot, data.name
      if player
        client.emit 'allowed', { name: player.name, type: 'game', message: 'has joined the game.' }
        socket.sockets.in(room).emit 'join_game', { name: data.name, slot: slot, icon: player.icon }

  client.on 'leave_game', (data) ->
    room = data.game.port()

  client.on 'game_message', (data) ->
    room = data.game.port()
    if socket.rooms['/' + room].indexOf(client.id) > -1
      socket.sockets.in(room).emit 'message', { action: 'message', name: data.name, message: data.message }

  client.on 'disconnect', (data) ->
    # get room client was in, confirm that it was the proper room, and remove them from that game lobby
    rooms = client.manager.roomClients[client.id]
    for room of rooms
      room = room.port()
      name = games.in_lobby(room, client.id)
      continue if !room or !name
      games.purge_lobby(room, name)
      socket.sockets.in(room).emit 'message', { action: 'message', name: name, message: 'has left the server.' }

# server
port = process.env.PORT || 8080
app.listen port
console.log 'Server listening on port: ' + port
