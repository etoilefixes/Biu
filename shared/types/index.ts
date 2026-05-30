export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  status: 'online' | 'offline' | 'away';
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  name: string | null;
  creatorId: string;
  createdAt: string;
  members: ConversationMember[];
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  user?: User;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file';
  createdAt: string;
  sender?: User;
}

export interface ChatSendMessage {
  conversationId: string;
  content: string;
  type: 'text' | 'image' | 'file';
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
  username: string;
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
