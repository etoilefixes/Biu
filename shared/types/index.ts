export interface User {
  id: string;
  biuId: string;
  username: string;
  nickname: string;
  avatar: string | null;
  status: 'online' | 'offline' | 'away';
  isSystem?: boolean;
  role: 'user' | 'admin' | 'super_admin';
  officialStatus?: 'none' | 'verified';
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
  biuId?: string;
  type: 'private' | 'group';
  name: string | null;
  creatorId: string;
  ownerId?: string;
  announcement?: string | null;
  createdAt: string;
  members: ConversationMember[];
  lastMessage?: LastMessage | null;
  unreadCount?: number;
  mentionType?: 'me' | 'all' | null;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  nickname?: string | null;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  user?: User & { isSystem?: boolean };
}

export interface LastMessage {
  id: string;
  content: string;
  senderId: string;
  senderNickname?: string;
  createdAt: string;
  mentions?: string[] | null;
  mentionsAll?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'card' | 'system';
  cardType?: string | null;
  cardData?: CardData | SystemCardData | null;
  mentions?: string[] | null;
  mentionsAll?: boolean;
  createdAt: string;
  sender?: User;
}

export interface CardData {
  title?: string;
  body?: string;
  link?: string;
  reasoning?: string;
}

export type SystemAction =
  | 'group_create'
  | 'group_join'
  | 'group_leave'
  | 'group_remove'
  | 'group_rename'
  | 'group_announcement'
  | 'group_nickname'
  | 'group_role'
  | 'group_transfer'
  | 'group_dissolve'
  | 'message_recall';

export interface SystemCardData {
  action: SystemAction;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  oldValue?: string;
  newValue?: string;
}

export type StreamEventType = 'start' | 'content' | 'reasoning' | 'done' | 'error';

export interface StreamEvent {
  conversationId: string;
  type: StreamEventType;
  delta?: string;
  aiUserId?: string;
  reasoning?: string;
  content?: string;
  message?: string;
}

export interface ConversationRead {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt: string;
  mentioned: boolean;
  mentionedAll: boolean;
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
