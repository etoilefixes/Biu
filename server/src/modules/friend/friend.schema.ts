import { z } from 'zod';

export const sendFriendRequestSchema = z.object({
  toUserId: z.string().min(1),
  message: z.string().max(200).optional(),
});

export const handleFriendRequestSchema = z.object({
  action: z.enum(['accept', 'reject']),
});
