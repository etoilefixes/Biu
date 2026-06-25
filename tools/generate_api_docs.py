#!/usr/bin/env python3
"""
Biu API 文档自动生成器
解析 TypeScript 路由文件和 Zod schema，生成 OpenAPI 3.0 和 Markdown 文档。
"""

import re
import json
import os
from pathlib import Path
from datetime import datetime

# ============================================================
# 配置
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SERVER_SRC = PROJECT_ROOT / "server" / "src"
MODULES_DIR = SERVER_SRC / "modules"
SHARED_TYPES = PROJECT_ROOT / "shared" / "types" / "index.ts"
OUTPUT_DIR = PROJECT_ROOT / "docs" / "api"

# ============================================================
# 路由前缀映射（从 app.ts 提取）
# ============================================================

ROUTE_PREFIX_MAP = {
    "auth": "/api/auth",
    "user": "/api/users",
    "chat": "/api/conversations",
    "message": "/api/messages",
    "friend": "/api/friends",
    "badge": "/api/badges",
    "official": "/api/official",
    "ai": "/api/ai",
    "ai-role": "/api/ai-roles",
    "ai-model": "/api/ai-roles",       # 子路由，继承 ai-role 前缀
    "notification": "/api/notifications",
}

# 模块中文名称
MODULE_NAMES_ZH = {
    "auth": "认证",
    "user": "用户",
    "chat": "会话",
    "message": "消息",
    "friend": "好友",
    "badge": "徽章",
    "official": "官方管理",
    "ai": "AI 快捷功能",
    "ai-role": "AI 角色与模型",
    "ai-model": "AI 模型管理",
    "notification": "通知设置",
}

MODULE_DESCRIPTIONS = {
    "auth": "用户注册、登录与身份认证",
    "user": "用户搜索与个人资料管理",
    "chat": "会话创建、成员管理与群组操作",
    "message": "消息发送与历史查询",
    "friend": "好友请求、管理与列表",
    "badge": "用户徽章系统",
    "official": "管理员功能：用户管理、频道、广播",
    "ai": "AI 快捷消息与查找",
    "ai-role": "AI 角色配置与对话",
    "ai-model": "AI 模型库管理",
    "notification": "消息通知偏好设置",
}

# 跳过非业务模块
SKIP_MODULES = {"docs"}


# ============================================================
# Zod Schema 解析
# ============================================================

def parse_zod_schemas(schema_file: Path) -> dict:
    """解析 Zod schema 文件，提取字段定义"""
    if not schema_file.exists():
        return {}

    content = schema_file.read_text(encoding="utf-8")
    schemas = {}

    # 匹配 export const xxxSchema = z.object({ ... });
    pattern = r"export\s+const\s+(\w+Schema)\s*=\s*z\.object\(\{(.*?)\}\);"
    for match in re.finditer(pattern, content, re.DOTALL):
        name = match.group(1)
        body = match.group(2)
        fields = parse_zod_fields(body)
        schemas[name] = fields

    return schemas


def parse_zod_fields(body: str) -> list:
    """解析 z.object 内部的字段定义"""
    fields = []
    # 匹配字段名和类型（支持跨行：z\n    .string(...)）
    field_pattern = r"(\w+):\s*z\s*\.(\w+)\((.*?)\)"
    for m in re.finditer(field_pattern, body, re.DOTALL):
        field_name = m.group(1)
        zod_type = m.group(2)
        zod_args = m.group(3)

        field_info = {
            "name": field_name,
            "type": map_zod_to_openapi(zod_type, zod_args),
            "required": True,  # Zod 默认 required
        }

        # 检查 optional()
        if ".optional()" in body[m.start():m.end() + 30]:
            field_info["required"] = False

        # 提取描述信息
        desc_match = re.search(r"required_error:\s*'([^']+)'", zod_args)
        if desc_match:
            field_info["description"] = desc_match.group(1)

        # 提取枚举值
        if zod_type == "enum":
            enum_match = re.search(r"\[(.*?)\]", zod_args)
            if enum_match:
                values = [v.strip().strip("'\"") for v in enum_match.group(1).split(",")]
                field_info["enum"] = values

        fields.append(field_info)

    return fields


def map_zod_to_openapi(zod_type: str, args: str) -> dict:
    """将 Zod 类型映射为 OpenAPI schema"""
    type_map = {
        "string": {"type": "string"},
        "number": {"type": "number"},
        "boolean": {"type": "boolean"},
        "enum": {"type": "string"},
        "array": {"type": "array"},
        "object": {"type": "object"},
    }
    return type_map.get(zod_type, {"type": "string"})


# ============================================================
# 路由解析
# ============================================================

def parse_routes_file(filepath: Path, module_name: str) -> list:
    """解析单个路由文件，提取端点定义"""
    if not filepath.exists():
        return []

    content = filepath.read_text(encoding="utf-8")
    endpoints = []

    # 匹配 router.<method>('path', middleware..., controller.func);
    # 或 router.<method>('path', middleware..., func);  (独立导入)
    # 支持多行
    route_pattern = r"router\.(get|post|put|delete|patch)\s*\(\s*'([^']+)'\s*,\s*(.+?),\s*(\w+(?:\.\w+)?)\s*\)"

    for match in re.finditer(route_pattern, content, re.DOTALL):
        method = match.group(1).upper()
        path = match.group(2)
        middleware_str = match.group(3)
        controller_ref = match.group(4)  # "controller.func" or "func"

        # 分析中间件
        has_auth = "authMiddleware" in middleware_str
        schema_names = re.findall(r"validate\((\w+)\)", middleware_str)

        # 解析控制器引用
        if "." in controller_ref:
            controller_obj, controller_func = controller_ref.rsplit(".", 1)
        else:
            controller_obj = "controller"
            controller_func = controller_ref

        # 分析中间件
        has_auth = "authMiddleware" in middleware_str
        schema_names = re.findall(r"validate\((\w+)\)", middleware_str)

        # 构建完整路径
        prefix = ROUTE_PREFIX_MAP.get(module_name, f"/api/{module_name}")
        if path == "/":
            full_path = prefix
        else:
            full_path = prefix + "/" + path.lstrip("/")

        endpoints.append({
            "method": method,
            "path": full_path,
            "route_path": path,
            "controller": f"{controller_obj}.{controller_func}",
            "auth_required": has_auth,
            "schemas": schema_names,
            "module": module_name,
        })

    # 检测子路由 router.use(xxxRoutes)
    sub_router_pattern = r"router\.use\((\w+Routes)\)"
    sub_import_pattern = r"import\s+(\w+Routes)\s+from\s+'(./(.+?\.routes))'"

    for sub_match in re.finditer(sub_router_pattern, content):
        var_name = sub_match.group(1)
        for imp_match in re.finditer(sub_import_pattern, content):
            if imp_match.group(1) == var_name:
                sub_file = filepath.parent / (imp_match.group(2) + ".ts")
                if sub_file.exists():
                    sub_module = imp_match.group(3).replace(".routes", "")
                    # 标记为子路由文件，避免重复解析
                    _SUB_ROUTER_FILES.add(str(sub_file.resolve()))
                    endpoints.extend(parse_routes_file(sub_file, sub_module))
                break

    return endpoints


# 全局集合：记录已被作为子路由解析过的文件，避免重复
_SUB_ROUTER_FILES = set()


def parse_all_routes() -> dict:
    """解析所有模块的路由"""
    global _SUB_ROUTER_FILES
    _SUB_ROUTER_FILES = set()
    all_endpoints = {}

    for module_dir in sorted(MODULES_DIR.iterdir()):
        if not module_dir.is_dir() or module_dir.name.startswith("_"):
            continue
        if module_dir.name in SKIP_MODULES:
            continue

        module_name = module_dir.name
        route_files = sorted(module_dir.glob("*.routes.ts"))

        # 第一遍：先解析主路由文件（module_name.routes.ts），收集子路由引用
        main_rf = module_dir / f"{module_name}.routes.ts"
        if main_rf.exists():
            endpoints = parse_routes_file(main_rf, module_name)
            if module_name not in all_endpoints:
                all_endpoints[module_name] = []
            all_endpoints[module_name].extend(endpoints)

        # 第二遍：解析未被引用的独立路由文件
        for rf in route_files:
            if str(rf.resolve()) in _SUB_ROUTER_FILES:
                continue
            if rf.name == f"{module_name}.routes.ts":
                continue  # 已处理

            stem = rf.stem.replace(".routes", "")
            endpoints = parse_routes_file(rf, stem)
            if stem not in all_endpoints:
                all_endpoints[stem] = []
            all_endpoints[stem].extend(endpoints)

    return all_endpoints


# ============================================================
# Zod Schema 收集
# ============================================================

def collect_all_schemas() -> dict:
    """收集所有模块的 Zod schema"""
    all_schemas = {}
    for module_dir in MODULES_DIR.iterdir():
        if not module_dir.is_dir():
            continue
        for sf in module_dir.glob("*.schema.ts"):
            schemas = parse_zod_schemas(sf)
            all_schemas.update(schemas)
    return all_schemas


# ============================================================
# OpenAPI 3.0 生成
# ============================================================

def generate_openapi(all_routes: dict, all_schemas: dict) -> dict:
    """生成 OpenAPI 3.0 规范文档"""
    spec = {
        "openapi": "3.0.3",
        "info": {
            "title": "Biu IM API",
            "description": "Biu 即时通讯应用 REST API 文档",
            "version": "1.0.0",
            "contact": {
                "name": "Biu Dev Team",
            },
        },
        "servers": [
            {
                "url": "http://localhost:3000",
                "description": "本地开发服务器",
            },
        ],
        "tags": [],
        "paths": {},
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "使用登录接口获取的 JWT Token",
                },
            },
            "schemas": {},
        },
        "security": [{"bearerAuth": []}],
    }

    # 生成 tags
    for module_name in sorted(all_routes.keys()):
        spec["tags"].append({
            "name": module_name,
            "description": MODULE_DESCRIPTIONS.get(module_name, ""),
        })

    # 提取共享类型作为 schema 引用
    shared_types = extract_shared_types()

    # 生成 schemas
    for schema_name, fields in all_schemas.items():
        schema_base_name = schema_name.replace("Schema", "")
        properties = {}
        required_fields = []
        for field in fields:
            prop = {"type": field["type"].get("type", "string")}
            if "description" in field:
                prop["description"] = field["description"]
            if "enum" in field:
                prop["enum"] = field["enum"]
            properties[field["name"]] = prop
            if field["required"]:
                required_fields.append(field["name"])

        schema_def = {"type": "object", "properties": properties}
        if required_fields:
            schema_def["required"] = required_fields
        spec["components"]["schemas"][schema_base_name] = schema_def

    # 添加共享类型 schemas
    for type_name, type_def in shared_types.items():
        spec["components"]["schemas"][type_name] = type_def

    # 生成 paths
    for module_name, endpoints in all_routes.items():
        for ep in endpoints:
            path = ep["path"]
            # 标准化路径参数：Express :param -> OpenAPI {param}
            openapi_path = re.sub(r":(\w+)", r"{\1}", path)

            if openapi_path not in spec["paths"]:
                spec["paths"][openapi_path] = {}

            method_lower = ep["method"].lower()
            operation = {
                "tags": [module_name],
                "summary": infer_endpoint_summary(ep),
                "description": infer_endpoint_description(ep),
                "operationId": f"{ep['method'].lower()}_{ep['controller'].replace('.', '_')}",
                "responses": {
                    "200": {
                        "description": "成功",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ApiResponse"},
                            },
                        },
                    },
                },
            }

            # 认证
            if not ep["auth_required"]:
                operation["security"] = []
            else:
                operation["security"] = [{"bearerAuth": []}]

            # 请求体（从 Zod schema）
            if ep["schemas"]:
                schema_base = ep["schemas"][0].replace("Schema", "")
                if schema_base in spec["components"]["schemas"]:
                    operation["requestBody"] = {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": f"#/components/schemas/{schema_base}"},
                            },
                        },
                    }

            # 路径参数
            path_params = re.findall(r"\{(\w+)\}", openapi_path)
            if path_params:
                operation["parameters"] = []
                for param in path_params:
                    operation["parameters"].append({
                        "name": param,
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                    })

            # 错误响应
            if ep["auth_required"]:
                operation["responses"]["401"] = {
                    "description": "未认证",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/ApiError"},
                        },
                    },
                }

            spec["paths"][openapi_path][method_lower] = operation

    return spec


def extract_shared_types() -> dict:
    """从 shared/types/index.ts 提取接口定义生成 OpenAPI schema"""
    if not SHARED_TYPES.exists():
        return {}

    content = SHARED_TYPES.read_text(encoding="utf-8")
    schemas = {}

    # 提取 interface 定义
    interface_pattern = r"export\s+interface\s+(\w+)\s*\{(.*?)\n\}"
    for match in re.finditer(interface_pattern, content, re.DOTALL):
        name = match.group(1)
        body = match.group(2)

        # 跳过非数据接口
        if name in ("StreamEvent", "ChatSendMessage", "ChatReceiveMessage"):
            continue

        properties = {}
        # 解析属性
        prop_pattern = r"(\w+)\??:\s*(.+?);"
        for pm in re.finditer(prop_pattern, body):
            prop_name = pm.group(1)
            prop_type = pm.group(2).strip()

            openapi_type = map_ts_to_openapi(prop_type)
            properties[prop_name] = openapi_type

        schemas[name] = {"type": "object", "properties": properties}

    # 特殊处理 ApiResponse 和 ApiError
    schemas["ApiResponse"] = {
        "type": "object",
        "properties": {
            "code": {"type": "integer", "description": "HTTP 状态码"},
            "message": {"type": "string", "description": "提示信息"},
            "data": {"description": "业务数据"},
        },
    }
    schemas["ApiError"] = {
        "type": "object",
        "properties": {
            "code": {"type": "integer", "description": "HTTP 状态码"},
            "message": {"type": "string", "description": "错误描述"},
            "details": {"type": "string", "description": "详细错误信息"},
        },
    }

    return schemas


def map_ts_to_openapi(ts_type: str) -> dict:
    """TypeScript 类型映射到 OpenAPI schema"""
    ts_type = ts_type.strip()

    type_map = {
        "string": {"type": "string"},
        "number": {"type": "number"},
        "boolean": {"type": "boolean"},
        "any": {},
    }

    # 联合类型
    if "|" in ts_type:
        parts = [p.strip() for p in ts_type.split("|")]
        if "null" in parts or "undefined" in parts:
            non_null = [p for p in parts if p not in ("null", "undefined")]
            if non_null:
                result = map_ts_to_openapi(non_null[0])
                result["nullable"] = True
                return result
        return {"type": "string", "description": ts_type}

    # 枚举字符串字面量
    if ts_type.startswith("'") and ts_type.endswith("'"):
        return {"type": "string", "enum": [ts_type.strip("'")]}

    # 数组
    if ts_type.endswith("[]"):
        item_type = ts_type[:-2]
        return {"type": "array", "items": map_ts_to_openapi(item_type)}

    # 引用其他类型
    if ts_type in type_map:
        return type_map[ts_type]

    return {"$ref": f"#/components/schemas/{ts_type}"}


def infer_endpoint_summary(ep: dict) -> str:
    """推断端点一句话描述"""
    module_zh = MODULE_NAMES_ZH.get(ep["module"], ep["module"])
    func_name = ep["controller"].split(".")[-1]

    # 基于函数名的启发式描述
    name_hints = {
        "register": "用户注册",
        "login": "用户登录",
        "me": "获取当前用户信息",
        "search": "搜索用户",
        "updateProfile": "更新个人资料",
        "list": "获取列表",
        "create": "创建",
        "detail": "获取详情",
        "remove": "删除",
        "markAllRead": "全部标记已读",
        "markRead": "标记已读",
        "addMember": "添加成员",
        "updateName": "修改名称",
        "updateNickname": "修改昵称",
        "setAnnouncement": "设置公告",
        "removeMember": "移除成员",
        "leaveGroup": "退出群聊",
        "dissolveGroup": "解散群聊",
        "setRole": "设置角色",
        "transferOwner": "转让群主",
        "sendRequest": "发送好友请求",
        "handleRequest": "处理好友请求",
        "listRequests": "获取好友请求列表",
        "listFriends": "获取好友列表",
        "deleteFriend": "删除好友",
        "listBadges": "获取所有徽章",
        "getUserBadges": "获取用户徽章",
        "assignBadge": "分配徽章",
        "getAllUsers": "获取所有用户",
        "deleteUser": "删除用户",
        "createOfficialChannel": "创建官方频道",
        "sendBroadcast": "发送广播",
        "setUserRole": "设置用户角色",
        "setUserOfficialStatus": "设置官方认证状态",
        "quickSend": "快速发送消息",
        "getRecent": "获取最近会话",
        "findUser": "查找用户",
        "listRoles": "获取 AI 角色列表",
        "createRole": "创建 AI 角色",
        "getRole": "获取 AI 角色详情",
        "updateRole": "更新 AI 角色",
        "deleteRole": "删除 AI 角色",
        "chatWithRole": "与 AI 角色对话",
        "listModels": "获取模型列表",
        "createModel": "新增模型",
        "updateModel": "更新模型",
        "deleteModel": "删除模型",
        "testModel": "测试模型连接",
        "fetchRemoteModels": "从远端获取模型",
        "getConfig": "获取 AI 配置",
        "saveConfig": "保存 AI 配置",
        "testConfigConnection": "测试 AI 连接",
        "clearConversationMessages": "清空会话消息",
        "regenerateLastReply": "重新生成回复",
        "upsert": "创建或更新",
    }

    hint = name_hints.get(func_name, func_name)
    return f"[{module_zh}] {hint}"


def infer_endpoint_description(ep: dict) -> str:
    """生成端点详细描述"""
    parts = []
    if ep["auth_required"]:
        parts.append("需要认证 (Bearer Token)")
    else:
        parts.append("无需认证")

    if ep["schemas"]:
        schema_names = [s.replace("Schema", "") for s in ep["schemas"]]
        parts.append(f"请求体校验: {', '.join(schema_names)}")

    return " | ".join(parts)


# ============================================================
# Markdown 生成
# ============================================================

def generate_markdown(all_routes: dict, all_schemas: dict) -> str:
    """生成 Markdown 格式的 API 文档"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Biu IM API 参考文档",
        "",
        f"> 自动生成于 {now}",
        "",
        "---",
        "",
        "## 概述",
        "",
        "- **Base URL**: `http://localhost:3000`",
        "- **认证方式**: JWT Bearer Token（除注册/登录外均需认证）",
        "- **请求格式**: `application/json`",
        "- **响应格式**: `{ code, message, data }`",
        "- **端点总数**: " + str(sum(len(v) for v in all_routes.values())),
        "",
        "---",
        "",
    ]

    # 目录
    lines.append("## 目录")
    lines.append("")
    for module_name in sorted(all_routes.keys()):
        zh = MODULE_NAMES_ZH.get(module_name, module_name)
        prefix = ROUTE_PREFIX_MAP.get(module_name, f"/api/{module_name}")
        count = len(all_routes[module_name])
        lines.append(f"- [{zh} ({prefix})](#{module_name}) - {count} 个端点")
    lines.append("")

    # 模块详情
    for module_name in sorted(all_routes.keys()):
        zh = MODULE_NAMES_ZH.get(module_name, module_name)
        prefix = ROUTE_PREFIX_MAP.get(module_name, f"/api/{module_name}")
        desc = MODULE_DESCRIPTIONS.get(module_name, "")
        endpoints = all_routes[module_name]

        lines.append("---")
        lines.append("")
        lines.append(f"## {zh}")
        lines.append(f"**Base**: `{prefix}` | {desc}")
        lines.append("")

        for ep in endpoints:
            auth_badge = "🔒" if ep["auth_required"] else "🔓"
            method_badge = f"`{ep['method']}`"
            lines.append(f"### {auth_badge} {method_badge} {ep['path']}")
            lines.append("")
            lines.append(f"**描述**: {infer_endpoint_summary(ep)}")
            lines.append("")
            lines.append(f"**控制器**: `{ep['controller']}`")
            lines.append("")

            if ep["auth_required"]:
                lines.append("**认证**: 需要 Bearer Token")
                lines.append("")

            # 路径参数
            path_params = re.findall(r":(\w+)", ep["route_path"])
            if path_params:
                lines.append("**路径参数**:")
                lines.append("")
                for param in path_params:
                    lines.append(f"- `{param}` (string, required)")
                lines.append("")

            # 请求体
            if ep["schemas"]:
                for schema_name in ep["schemas"]:
                    if schema_name in all_schemas:
                        lines.append(f"**请求体** (`{schema_name}`):")
                        lines.append("")
                        lines.append("| 字段 | 类型 | 必填 | 说明 |")
                        lines.append("|------|------|------|------|")
                        for field in all_schemas[schema_name]:
                            req = "是" if field["required"] else "否"
                            ftype = field["type"].get("type", "string")
                            desc = field.get("description", "-")
                            lines.append(f"| `{field['name']}` | {ftype} | {req} | {desc} |")
                        lines.append("")

            # 成功响应
            lines.append("**成功响应** (`200`):")
            lines.append("```json")
            lines.append('{')
            lines.append('  "code": 200,')
            lines.append('  "message": "操作成功",')
            lines.append('  "data": { ... }')
            lines.append('}')
            lines.append("```")
            lines.append("")

            # 错误响应
            lines.append("**错误响应**:")
            lines.append("")
            if ep["auth_required"]:
                lines.append("- `401` — 未认证或 Token 无效")
            lines.append("- `422` — 输入校验失败")
            lines.append("- `500` — 服务器内部错误")
            lines.append("")

    # 数据模型附录
    lines.append("---")
    lines.append("")
    lines.append("## 附录: 数据模型")
    lines.append("")

    # Zod schemas
    if all_schemas:
        lines.append("### 请求体 Schema")
        lines.append("")
        for schema_name, fields in sorted(all_schemas.items()):
            lines.append(f"#### `{schema_name}`")
            lines.append("")
            lines.append("| 字段 | 类型 | 必填 | 说明 |")
            lines.append("|------|------|------|------|")
            for field in fields:
                req = "是" if field["required"] else "否"
                ftype = field["type"].get("type", "string")
                desc = field.get("description", "-")
                lines.append(f"| `{field['name']}` | {ftype} | {req} | {desc} |")
            lines.append("")

    # 共享类型
    if SHARED_TYPES.exists():
        lines.append("### 共享类型 (shared/types)")
        lines.append("")
        content = SHARED_TYPES.read_text(encoding="utf-8")
        lines.append("```typescript")
        lines.append(content.strip())
        lines.append("```")
        lines.append("")

    return "\n".join(lines)


# ============================================================
# 主函数
# ============================================================

def main():
    print("=" * 60)
    print("  Biu API 文档自动生成器")
    print("=" * 60)
    print()

    # 1. 解析所有路由
    print("[1/4] 解析路由文件...")
    all_routes = parse_all_routes()
    total_endpoints = sum(len(v) for v in all_routes.values())
    print(f"  -> 发现 {total_endpoints} 个 API 端点，分布在 {len(all_routes)} 个模块中")

    # 2. 解析 Zod schemas
    print("[2/4] 解析 Zod Schema...")
    all_schemas = collect_all_schemas()
    print(f"  -> 发现 {len(all_schemas)} 个请求体 Schema")

    # 3. 生成 OpenAPI 3.0
    print("[3/4] 生成 OpenAPI 3.0 规范...")
    openapi_spec = generate_openapi(all_routes, all_schemas)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    openapi_path = OUTPUT_DIR / "openapi.json"
    openapi_path.write_text(
        json.dumps(openapi_spec, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  -> 已保存: {openapi_path}")

    # 4. 生成 Markdown
    print("[4/4] 生成 Markdown 文档...")
    markdown = generate_markdown(all_routes, all_schemas)
    md_path = OUTPUT_DIR / "api-reference.md"
    md_path.write_text(markdown, encoding="utf-8")
    print(f"  -> 已保存: {md_path}")

    print()
    print("=" * 60)
    print(f"  完成! 生成了 {total_endpoints} 个端点的文档")
    print(f"  OpenAPI: {openapi_path}")
    print(f"  Markdown: {md_path}")
    print("=" * 60)

    return {
        "endpoints": total_endpoints,
        "modules": len(all_routes),
        "schemas": len(all_schemas),
        "openapi_path": str(openapi_path),
        "markdown_path": str(md_path),
    }


if __name__ == "__main__":
    main()
