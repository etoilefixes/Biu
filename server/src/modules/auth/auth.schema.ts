import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string({ required_error: '用户名不能为空' })
    .trim()
    .min(3, '用户名至少 3 个字符')
    .max(50, '用户名最多 50 个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和短横线'),
  password: z
    .string({ required_error: '密码不能为空' })
    .min(6, '密码至少 6 个字符')
    .max(100, '密码最多 100 个字符'),
  nickname: z
    .string({ required_error: '昵称不能为空' })
    .trim()
    .min(1, '昵称不能为空')
    .max(100, '昵称最多 100 个字符'),
});

export const loginSchema = z.object({
  account: z
    .string({ required_error: '账号不能为空' })
    .trim()
    .min(1, '账号不能为空'),
  password: z
    .string({ required_error: '密码不能为空' })
    .min(1, '密码不能为空'),
});
