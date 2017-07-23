const crypto = require('crypto');
const base64url = require('base64url');

const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const session = require("express-session")
const PORT = process.env.PORT || 8080

const sessionMiddleware = session({
  name: 'minireversi.cookie',
  secret: 'er56tywertyuisdfghjklzxcvbnmkgiuytre987654',
  resave: true,
  saveUninitialized: true,
  rolling: true,
  cookie:{
    httpOnly: false,
    secure: false,
    maxAge : 1000 * 60 * 60 * 24 * 30, // 30日
}});

// app.session = sessionMiddleware;

http.listen(PORT, () => {
  console.log(`now listening on ${PORT}`)
})

io.use(function(socket, next){
  sessionMiddleware(socket.request, socket.request.res, next);
});
app.use(sessionMiddleware);

class User {
  constructor(userId) {
    this.user_id = userId
    this.name = ''
  }
}

class Player extends User {
  consutructor(userId) {
    this.super(userId)
  }
}

const maxMessages = 15
let pastMessages = []
let turn = 0
let playerCount = 1
let userIds = {}
let playerIds = []
// let players = {}

const boardSize = 3
let board = Array.from(new Array(boardSize), () => new Array(boardSize).fill(0));

io.on('connection', (socket) => {

  io.emit('redraw board', {'board': boardWithId()})
  io.emit('restore messages', {'timeline': pastMessages})

  if (!socket.request.session.user_id) {
    io.emit('restart session')
    // console.log(`user ${playerCount} connected!`)
    console.log(`new user ${socket.request.session.user_id}.`)
  } else {

    registerUser(socket.request.session)
    console.log(`user confirmed ${socket.request.session.user_id}.`)
  }


  socket.on('register user', () => {
    console.log(socket.request.session.user_id)
    registerUser(socket.request.session)
  })

  socket.on('remove player', (data) => {
    console.log(`removing.. ${data}`)
    let playerId = Number(data.id.slice(-1))
    delete playerIds[playerId]
    turn = 0

    io.emit('player removed', {id: data.id})
    io.emit('clear game messages')
  })

  socket.on('register player', (data) => {
    console.log(`resistering.. ${data}`)
    let playerId = Number(data.id.slice(-1))
    let user = userIds[socket.request.session.user_id]
    if (!user) return false

    // console.log(playerId)
    player = new Player(user.user_id)
    player.name = data.name || `player ${playerId}`

    playerIds[playerId] = player
    // console.log(player)

    io.emit('player registered', {id: data.id, name: player.name})
    io.emit('set delete btn', {id: data.id})
    // console.log(`resistered! ${player.name}`)

    if (numberOfPlayers() >= 2) {
      // player = playerIds[turn]
      // console.log(playerIds, player)

      toggleTurn(playerId)    // 先に登録した方が先攻
      clearBoard()
      io.emit('reset board')
      io.emit('prompt player', {name: playerIds[turn].name})
    }
  })

  socket.on('chat message', (msg) => {
    user = userIds[socket.request.session.user_id]
    // console.log(userIds)
    console.log(`incoming..${msg} + from ${user}`)
    pushMessage(user, msg)
    io.emit('restore messages', {'timeline': pastMessages})
    // io.emit('add message', msg)
  })

  socket.on('board clicked', (cell) => {
    player = playerIds[turn]
    if (!player || socket.request.session.user_id != player.user_id) return false
    if (numberOfPlayers() < 2) return false

    pos = position(cell)

    console.log(`${pos} (${isBlank(pos)}) clicked by ${player.name}`)

    if (!isBlank(pos)) {
      return false
    }

    placeStone(pos, turn)
    io.emit('board clicked', {'pos': pos, 'player_id': turn})

    if (didWin(pos)) {
      io.emit('victory', {'player_name': player.name})
      turn = 0
    } else {
      toggleTurn(turn)
      io.emit('prompt player', {name: playerIds[turn].name})
    }
  })

  socket.on('reset board', () => {
    clearBoard()
    turn = 0
    io.emit('reset board')
    playerIds = []
    io.emit('reset players')
  })

  socket.on('redraw board', () => {
    io.emit('redraw board', {'board': boardWithId()})
    io.emit('restore messages', {'timeline': pastMessages})
  })

  socket.on('disconnect', (reason) => {
    player = playerIds[socket.request.session.user_id]
    // delete playerIds[socket.request.session.user_id]
    // playerCount = playerCount - 1
    console.log(`user ${player} has left out`)
  })
})

function numberOfPlayers() {
  return playerIds.filter( (x) => { return(x) }).length
}

function pushMessage(user, msg) {
  while (pastMessages.length >= maxMessages) {
    pastMessages.shift()
  }

  pastMessages.push({name: user.name, message: msg})
}

function registerUser(session) {
  console.log(session.user_id)
  if (!userIds[session.user_id]) {
    userIds[session.user_id] = new User(session.user_id)
    console.log(`user ${userIds[session.user_id].user_id} now being registered!`)
  } else {
    console.log(`user ${userIds[session.user_id].user_id} already registered..`)
  }
  console.log(userIds)
}

function position(cell) {
  place = cell.split('-')
  x = place[1]
  y = place[2]
  return {x: Number(x), y: Number(y)}
}

function toggleTurn(currentTurn) {
  if (currentTurn==1) {turn = 2} else if (currentTurn==2) {turn =1}
}

function isBlank(pos) {
  return (board[pos['y']-1][pos['x']-1] == 0)
}

function didWin(pos) {
  stone = board[pos['y']-1][pos['x']-1]
  return hasTakenAll(stone)
}

function hasTakenAll(stone) {
  let takenX, takenY
  let takenFlag = false

  Array.from(Array(boardSize).keys()).forEach ((i) => {
    takenX = true
    takenY = true
    Array.from(Array(boardSize).keys()).forEach ((j) => {
      if (board[i][j] != stone) {
        takenX = false
      }
      if (board[j][i] != stone) {
        takenY = false
      }
    })
    if (takenX == true || takenY == true) {
      takenFlag = true
    }
  })
  if (takenFlag == true) return true

  var takenDownRight = true
  var takenUpperRight = true
  Array.from(Array(boardSize).keys()).forEach ((i) => {
    if (board[i][i] != stone) {
      takenDownRight = false
    }
    if (board[i][boardSize-i-1] != stone) {
      takenUpperRight = false
    }
  })
  if (takenDownRight == true || takenUpperRight == true) {
    return true
  }
  return false
}

function clearBoard() {
  for (var row in board) {
    for (var col in board[row]) {
      board[row][col] = 0
    }
  }
}

function boardWithId() {
  var result = {}
  console.log('<<<current board>>>')
  console.log(board)
  for (var row in board) {
    for (var col in board[row]) {
      console.log(col, row, board[row])
      result[`cell-${(Number(col)+1)}-${(Number(row)+1)}`] = board[row][col]
    }
  }
  return result
}

function placeStone(pos, playerId) {
  console.log(pos, playerId, board)
  board[pos['y']-1][pos['x']-1] = playerId
}

function userToken () {
  return base64url(crypto.randomBytes(20));
}

app.get('/', (req, res) => {
//  res.send('<h1> Hello World! </h1>')
  console.log('<<new access detected>>')
  console.log(req.session)
  if (!req.session.user_id) {
    req.session.user_id = userToken()
  }

  console.log(req.session)
  console.log('now reloading index.html..')
  res.sendFile(__dirname + '/index.html')
})

app.get('/css/style.css', (req, res) => {
  res.sendFile(__dirname + '/assets/css/style.css')
})
