require('dotenv').config()
const express = require('express')
const path = require('path')
////////////////////////////////////////////////////////
/* IN MEMORY */
const http = require('http')
const { Server } = require('socket.io')
const formatMessage = require('./utils/messages')
const { 
    userJoin, 
    getCurrentUser, 
    userLeave, 
    getRoomUsers 
} = require('./utils/users')
/* REDIS */
const { createClient }= require('redis')
const { createAdapter }= require('@socket.io/redis-adapter')


const app = express()
app.use(express.static(path.join(__dirname, 'public')))
////////////////////////////////////////////////////////
/* IN MEMORY */
const httpServer = http.createServer(app)
const io = new Server(httpServer)
const botName = 'ChatCord Bot'
/* REDIS */
const pubClient = createClient({ url: "redis://localhost:6379" })
const subClient = pubClient.duplicate()
// Promise
//     .all([pubClient.connect(), subClient.connect()])
//     .then(() => {
//         io.adapter(createAdapter(pubClient, subClient))
//         io.listen(3000)
//     }).catch(err => {
//         if (process.env.NODE_ENV == 'dev') {
//             console.log(err);
//         }
//     })
////////////////////////////////////////////////////////////////////
const connectRedis = async () => {
    try {
        await pubClient.connect()
        await subClient.connect()
        io.adapter(createAdapter(pubClient, subClient))
        io.listen(3000)
    } catch (err) {
        console.log(err)
    }
}
connectRedis()

/*******************************************************************************************/
io.on('connection', (socket) => {
    if (process.env.NODE_ENV == 'dev') {
        console.log(`New web socket connection...`)
        // console.log(io.of('/').adapter)
    }

    /**
     * socket.emit()           : To a current client
     * socket.broadcast.emit() : To all connected clients excluding a current client
     * io.emit()               : To all connected clients including a current client
     */
    // socket.emit('message', 'Welcome to ChatCord!')
    // socket.broadcast.emit('message', 'A user has joined the chat.')
    // socket.on('disconnect', () => {
    //     io.emit('message', 'A user has left the chat.')
    // })
    /////////////////////////////////////////////////////////////////////////
    // socket.emit('message', formatMessage(botName, 'Welcome to ChatCord!'))
    // socket.broadcast.emit('message', formatMessage(botName, 'A user has joined the chat.'))
    // socket.on('disconnect', () => {
    //     io.emit('message', formatMessage(botName, 'A user has left the chat.'))
    // })

    socket.on('joinRoom', ({ username, room }) => {
        // console.log(username, room);
        const user = userJoin(socket.id, username, room)
        socket.join(user.room)

        socket.emit('message', formatMessage(botName, 'Welcome to ChatCord!'))
        socket.broadcast
            .to(user.room)
            .emit('message', formatMessage(botName, `${user.username} has joined the chat.`))

        io.to(user.room).emit('roomUsers', { 
            room: user.room, 
            users: getRoomUsers(user.room) 
        })
    })

    socket.on('chatMessage', msg => {
        // console.log(msg)
        // io.emit('message', msg)
        // io.emit('message', formatMessage('A user', msg))

        const user = getCurrentUser(socket.id)
        io.to(user.room).emit('message', formatMessage(user.username, msg))
    })

    socket.on('disconnect', () => {
        const user = getCurrentUser(socket.id)
        if (user) {
            userLeave(user.id)
            io.to(user.room).emit('roomUsers', { 
                room: user.room, 
                users: getRoomUsers(user.room) 
            })
            io.emit('message', formatMessage(botName, `${user.username} has left the chat.`))
        }
    })
})


/*******************************************************************************************/
const port = process.env.PORT || 3001
// app.listen(port, () => {
//     if (process.env.NODE_ENV == 'dev') {
//         console.log(`Server started on port ${port}`)
//     }
// })
////////////////////////////////////////////////////////
httpServer.listen(port, () => {
    if (process.env.NODE_ENV == 'dev') {
        console.log(`Server running on port ${port}`)
    }
})