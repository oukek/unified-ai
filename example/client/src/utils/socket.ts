import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

class SocketService {
  private socket: Socket | null = null
  private readonly url: string = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

  connect(): void {
    if (!this.socket) {
      this.socket = io(this.url, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id)
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason)
      })

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
      })
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  emit(event: string, data?: any): void {
    if (this.socket) {
      this.socket.emit(event, data)
    }
    else {
      console.warn('Socket not connected. Unable to emit event:', event)
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback)
    }
    else {
      console.warn('Socket not connected. Unable to register event:', event)
    }
  }

  off(event: string): void {
    if (this.socket) {
      this.socket.off(event)
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

// Create a singleton instance
const socketService = new SocketService()

export default socketService
