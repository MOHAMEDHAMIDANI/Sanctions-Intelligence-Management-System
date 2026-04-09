import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const notificationOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: notificationOrigins,
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('NotificationGateway');

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Missing authentication token');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      const user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      client.data.user = user;
      client.join(this.buildRoomName(user.id));
      this.logger.log(`Authenticated notification socket for user ${user.id}`);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Rejected notification socket ${client.id}: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  sendNotificationToUser(userId: string, notification: any) {
    const roomName = this.buildRoomName(userId);
    this.server.to(roomName).emit('newNotification', notification);
    this.logger.log(`Notification sent to user ${userId} in room ${roomName}`);
  }

  private buildRoomName(userId: string) {
    return `room-${userId}`;
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }

    const authorizationHeader = client.handshake.headers.authorization;
    if (typeof authorizationHeader === 'string' && authorizationHeader.trim()) {
      return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
    }

    return null;
  }
}
