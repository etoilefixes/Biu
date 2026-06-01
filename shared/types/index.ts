export interface User {
  id: string;
  biuId: string;
  username: string;
  nickname: string;
  avatar: string | null;
  status: 'online' | 'offline' | 'away';
  isSystem?: boolean;
  badges?: Badge[];
  createdAt: string;
  updatedAt: string;
}

export interface Badge {
  type: string;
  label: string;
  icon: string | null;
  color: string | null;
  description?: string;
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  name: string | null;
  creatorId: string;
  createdAt: string;
  members: ConversationMember[];
  lastMessage?: LastMessage | null;
  unreadCount?: number;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  user?: User & { isSystem?: boolean };
}

export interface LastMessage {
  id: string;
  content: string;
  senderId: string;
  senderNickname?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'card';
  cardType?: string | null;
  cardData?: any;
  createdAt: string;
  sender?: User;
}

export interface ChatSendMessage {
  conversationId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'card';
}

export interface ChatReceiveMessage extends Message {
  sender: User;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  password: string;
  nickname: string;
}

export interface LoginRequest {
  account: string;
  password: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface ApiError {
  code: number;
  message: string;
  details?: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  message: string | null;
  createdAt: string;
  fromUser?: User;
  toUser?: User;
}
