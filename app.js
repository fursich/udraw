const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const PORT = process.env.PORT || 8080

http.listen(PORT, () => {
  console.log(`now listening on ${PORT}`)
})

let number = 0
let clientIds = {}
let board = Array.from(new Array(5), () => new Array(5).fill(0));

io.on('connection', (socket) => {
  number = number + 1
  clientIds[socket.id] = number
  console.log(`user ${number} connected!`)
//  if (number >=3) {return false}

  socket.on('chat message', (msg) => {
    console.log(`incoming..${msg} + form ${clientIds[socket.id]}`)
    io.emit('chat message', msg)
  })

  socket.on('board clicked', (cell) => {
    player = clientIds[socket.id]
    if ( player != 1 && player != 2) {return false}

    pos = position(cell)
    if (hasPlaced(pos) === true) {
      return false
    }
    placeStone(pos, player)
    io.emit('board clicked', {'pos': pos, 'player': player})
  })

  socket.on('reset board', () => {
    player = clientIds[socket.id]
    if ( player != 1 && player != 2) {return false}

    clearBoard()
    io.emit('reset board')
  })
})

function position(cell) {
  place = cell.split('-')
  x = place[1]
  y = place[2]
  return {x: Number(x), y: Number(y)}
}

function hasPlaced(pos) {
  return (board[pos['x']-1][pos['y']-1] === 0) ? false : true
}

function clearBoard() {
  for (var row in board) {
    for (var col in board[row]) {
      board[row][col] = 0
    }
  }
  // for (var row of board) {
  //   for (var cell of row) {
  //   }
  // }
}

function placeStone(pos, player) {
  board[pos['x']-1][pos['y']-1] = player
}

app.get('/', (req, res) => {
//  res.send('<h1> Hello World! </h1>')
  res.sendFile(__dirname + '/index.html')
})

app.get('/css/style.css', (req, res) => {
  res.sendFile(__dirname + '/assets/css/style.css')
})
