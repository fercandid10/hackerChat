import { constants } from "./constants.js"

export default class Controller{
    #users = new Map()
    #rooms = new Map()

    constructor({socketServer}){
        this.socketServer = socketServer
    }
    onNewConnection(socket) {
        const {id} = socket
        console.log('connection stablished with', id)
        const userData = {id, socket}
        this.#updateGlobalUserData(id, userData)

        socket.on('data', this.#onSocketData(id))
        socket.on('error', this.#onSocketClosed(id))
        socket.on('end', this.#onSocketClosed(id))

    }

    async joinRoom(socketID, data){
        const userData = data
        console.log(`${userData.userName} joined! ${[socketID]}`)
        const {roomId} = userData
        const user = this.#updateGlobalUserData(socketID, userData)
        const users = this.#joinUserOnRoom(roomId, user)

        const currentUsers = Array.from(users.values()).map(({id, userName}) => ({userName, id}))
        this.socketServer.sendMessage(user.socket, constants.event.UPDATE_USERS, currentUsers)
        
        this.broadCast({socketID, roomId, message: {id: socketID, userName: userData.userName}, event: constants.event.NEW_USER_CONNECTED})
        

    }

    broadCast({socketID, roomId, event, message, includeCurrentSocket = false }) {
        const usersOnRoom = this.#rooms.get(roomId)

        for(const [key, user] of usersOnRoom) {
            if (!includeCurrentSocket && key === socketID) continue

            this.socketServer.sendMessage(user.socket, event, message)

        }
    }

    message(socketID, data){
        const {userName, roomId} = this.#users.get(socketID)

        this.broadCast({roomId, socketID, event: constants.event.MESSAGE, message: {userName, message: data}, includeCurrentSocket: true})
    }

    #joinUserOnRoom(roomId, user){
        const usersOnRoom = this.#rooms.get(roomId) ?? new Map()
        usersOnRoom.set(user.id, user)
        this.#rooms.set(roomId, usersOnRoom)

        return usersOnRoom
    }

    #logoutUser(id, roomId){
        this.#users.delete(id)
        const usersOnRoom = this.#rooms.get(roomId)
        usersOnRoom.delete(id)
        this.#rooms.set(roomId, usersOnRoom)
    }

    #onSocketClosed(id) {
        return data => {
            const {userName, roomId} = this.#users.get(id)
            console.log(userName, 'disconnected', id)
            this.#logoutUser(id, roomId)


            this.broadCast({
                roomId,
                message: {id, userName},
                socketID: id,
                event: constants.event.DISCONNECT_USER
            })
        }
    }

    #onSocketData(id) {
        return data => {
           try{
                const {event, message} = JSON.parse(data)
                this[event](id, message)
            } catch (error) {
                console.error(`wrong event formart!!`, data.toString())
            }
        }    
    }

    #updateGlobalUserData(socketID, userData){
        const users = this.#users
        const user = users.get(socketID) ?? {}
        const updatedUserData = {
            ...user,
            ...userData
        }

        users.set(socketID, updatedUserData)

        return users.get(socketID)

    }
}