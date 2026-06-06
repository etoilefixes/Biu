import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from './config';
import { connectRedis } from './config/redis';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import chatRoutes from './modules/chat/chat.routes';
import messageRoutes from './modules/message/message.routes';
import friendRoutes from './modules/friend/friend.routes';
import badgeRoutes from './modules/badge/badge.routes';
import officialRoutes from './modules/official/official.routes';
import aiRoutes from './modules/ai/ai.routes';
import aiRoleRoutes from './modules/ai-role/ai-role.routes';
import notificationRoutes from './modules/notification/notification.routes';
import { setupSocket } from './socket';

const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/official', officialRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-roles', aiRoleRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(errorHandler);

setupSocket(io);

async function start() {
  try {
    await connectRedis();
    await prisma.$connect();
    console.log('Database connected');

    server.listen(config.port, () => {
      console.log(`Biu server running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
