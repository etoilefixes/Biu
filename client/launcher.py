import subprocess
import sys
import os
import json
import time
import http.client
import threading
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog

CLIENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CLIENT_DIR)
TMP_DIR = os.path.join(CLIENT_DIR, "tmp")
LOG_DIR = os.path.join(TMP_DIR, "logs")
ACCOUNTS_FILE = os.path.join(TMP_DIR, "accounts.json")
VITE_PORT = 5173
BIN_DIR = os.path.join(PROJECT_ROOT, "node_modules", ".bin")
ELECTRON_CMD = os.path.join(BIN_DIR, "electron.cmd" if os.name == "nt" else "electron")
TSC_CMD = os.path.join(BIN_DIR, "tsc.cmd" if os.name == "nt" else "tsc")
VITE_CMD = os.path.join(BIN_DIR, "vite.cmd" if os.name == "nt" else "vite")

BG = "#0D1117"
BG_CARD = "#161B22"
BG_HOVER = "#1C2333"
FG = "#E6EDF3"
FG_DIM = "#8B949E"
ACCENT = "#00D4AA"
ACCENT_HOVER = "#00F0C0"
DANGER = "#FF3D71"
DANGER_HOVER = "#FF6B8A"
BORDER = "#30363D"
FONT = ("Segoe UI", 10)
FONT_BOLD = ("Segoe UI", 10, "bold")
FONT_TITLE = ("Segoe UI", 16, "bold")
FONT_SMALL = ("Segoe UI", 9)


def load_accounts():
    if os.path.exists(ACCOUNTS_FILE):
        try:
            with open(ACCOUNTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return [
        {"id": 1, "name": "账号 1", "auto_start": False},
        {"id": 2, "name": "账号 2", "auto_start": False},
    ]


def save_accounts(accounts):
    os.makedirs(os.path.dirname(ACCOUNTS_FILE), exist_ok=True)
    with open(ACCOUNTS_FILE, "w", encoding="utf-8") as f:
        json.dump(accounts, f, ensure_ascii=False, indent=2)


def next_account_id(accounts):
    if not accounts:
        return 1
    return max(a["id"] for a in accounts) + 1


def api_register(username, password, nickname=None):
    """调用 Biu API 注册账号，返回 (token, user_info) 或 (None, error_msg)"""
    try:
        body = json.dumps({"username": username, "password": password, "nickname": nickname or username})
        conn = http.client.HTTPConnection("localhost", 3001, timeout=5)
        conn.request("POST", "/api/auth/register", body, {"Content-Type": "application/json"})
        resp = conn.getresponse()
        data = json.loads(resp.read().decode("utf-8"))
        conn.close()
        if resp.status in (200, 201) and data.get("data"):
            return data["data"].get("token"), data["data"].get("user")
        return None, data.get("message", "注册失败")
    except Exception as e:
        return None, str(e)


def api_login(username, password):
    """调用 Biu API 登录，返回 (token, user_info) 或 (None, error_msg)"""
    try:
        body = json.dumps({"account": username, "password": password})
        conn = http.client.HTTPConnection("localhost", 3000, timeout=5)
        conn.request("POST", "/api/auth/login", body, {"Content-Type": "application/json"})
        resp = conn.getresponse()
        data = json.loads(resp.read().decode("utf-8"))
        conn.close()
        if resp.status == 200 and data.get("data"):
            return data["data"].get("token"), data["data"].get("user")
        return None, data.get("message", "登录失败")
    except Exception as e:
        return None, str(e)


class BiuLauncher:
    def __init__(self, root):
        self.root = root
        self.root.title("Biu Launcher")
        self.root.geometry("520x600")
        self.root.minsize(420, 400)
        self.root.configure(bg=BG)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.accounts = load_accounts()
        self.processes = {}
        self.vite_process = None
        self.vite_status = "stopped"
        self.compiled = False
        self.account_widgets = {}

        self._build_ui()
        self._refresh_account_list()
        self._poll_status()

    def _build_ui(self):
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(1, weight=1)

        header = tk.Frame(self.root, bg=BG)
        header.grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 0))
        header.columnconfigure(1, weight=1)

        tk.Label(header, text="Biu", font=("Segoe UI", 20, "bold"), fg=ACCENT, bg=BG).grid(row=0, column=0, sticky="w")
        tk.Label(header, text="Launcher", font=("Segoe UI", 20), fg=FG_DIM, bg=BG).grid(row=0, column=0, sticky="w", padx=(46, 0))

        self.vite_indicator = tk.Label(header, text="  Vite: 未启动  ", font=FONT_SMALL, fg=FG_DIM, bg=BG_CARD, relief="flat", padx=8, pady=2)
        self.vite_indicator.grid(row=0, column=1, sticky="e")

        body = tk.Frame(self.root, bg=BG)
        body.grid(row=1, column=0, sticky="nsew", padx=16, pady=12)
        body.columnconfigure(0, weight=1)
        body.rowconfigure(1, weight=1)

        toolbar = tk.Frame(body, bg=BG)
        toolbar.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        toolbar.columnconfigure(1, weight=1)

        tk.Label(toolbar, text="账号列表", font=FONT_BOLD, fg=FG, bg=BG).grid(row=0, column=0, sticky="w")

        btn_frame = tk.Frame(toolbar, bg=BG)
        btn_frame.grid(row=0, column=1, sticky="e")

        self._make_btn(btn_frame, "+ 添加账号", ACCENT, self.add_account, side="left", padx=(0, 6))
        self._make_btn(btn_frame, "全部启动", ACCENT, self.start_all, side="left", padx=(0, 6))
        self._make_btn(btn_frame, "全部停止", DANGER, self.stop_all, side="left")

        canvas_frame = tk.Frame(body, bg=BG)
        canvas_frame.grid(row=1, column=0, sticky="nsew")
        canvas_frame.columnconfigure(0, weight=1)
        canvas_frame.rowconfigure(0, weight=1)

        self.canvas = tk.Canvas(canvas_frame, bg=BG, highlightthickness=0, bd=0)
        self.scrollbar = ttk.Scrollbar(canvas_frame, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=self.scrollbar.set)

        self.canvas.grid(row=0, column=0, sticky="nsew")
        self.scrollbar.grid(row=0, column=1, sticky="ns")

        self.list_frame = tk.Frame(self.canvas, bg=BG)
        self.canvas_window = self.canvas.create_window((0, 0), window=self.list_frame, anchor="nw")

        self.list_frame.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfig(self.canvas_window, width=e.width))

        self.canvas.bind("<MouseWheel>", lambda e: self.canvas.yview_scroll(int(-1 * (e.delta / 120)), "units"))
        self.list_frame.bind("<MouseWheel>", lambda e: self.canvas.yview_scroll(int(-1 * (e.delta / 120)), "units"))

        footer = tk.Frame(self.root, bg=BG_CARD)
        footer.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 12))

        self.status_label = tk.Label(footer, text="就绪", font=FONT_SMALL, fg=FG_DIM, bg=BG_CARD)
        self.status_label.pack(side="left", padx=12, pady=8)

        self._make_btn(footer, "编译", ACCENT, self.compile_electron).pack(side="right", padx=(4, 12), pady=6)
        self._make_btn(footer, "启动 Vite", ACCENT, self.toggle_vite).pack(side="right", padx=4, pady=6)

    def _make_btn(self, parent, text, color, command, side=None, padx=0, pady=0, grid=True):
        btn = tk.Label(parent, text=text, font=FONT_SMALL, fg="#fff", bg=color,
                       cursor="hand2", padx=10, pady=3, relief="flat")

        def on_enter(e):
            btn.configure(bg=ACCENT_HOVER if color == ACCENT else DANGER_HOVER)

        def on_leave(e):
            btn.configure(bg=color)

        btn.bind("<Enter>", on_enter)
        btn.bind("<Leave>", on_leave)
        btn.bind("<Button-1>", lambda e: command())

        if grid:
            btn.pack(side=side or "left", padx=padx, pady=pady, in_=parent)
        else:
            btn.pack(side=side or "left", padx=padx, pady=pady)
        return btn

    def _refresh_account_list(self):
        for w in self.list_frame.winfo_children():
            w.destroy()
        self.account_widgets.clear()

        if not self.accounts:
            tk.Label(self.list_frame, text="暂无账号，点击「添加账号」", font=FONT, fg=FG_DIM, bg=BG).pack(pady=40)
            return

        for account in self.accounts:
            self._create_account_row(account)

    def _create_account_row(self, account):
        aid = account["id"]
        row = tk.Frame(self.list_frame, bg=BG_CARD, padx=12, pady=10)
        row.pack(fill="x", pady=(0, 6))
        row.columnconfigure(1, weight=1)

        is_running = aid in self.processes and self.processes[aid].poll() is None

        dot_color = ACCENT if is_running else FG_DIM
        dot = tk.Label(row, text="●", font=("Segoe UI", 14), fg=dot_color, bg=BG_CARD)
        dot.grid(row=0, column=0, padx=(0, 8))

        name_frame = tk.Frame(row, bg=BG_CARD)
        name_frame.grid(row=0, column=1, sticky="w")
        name_frame.columnconfigure(0, weight=1)

        name_text = account.get("name", "未知账号")
        username_text = account.get("username", "")
        name_lbl = tk.Label(name_frame, text=name_text, font=FONT_BOLD, fg=FG, bg=BG_CARD, anchor="w")
        name_lbl.grid(row=0, column=0, sticky="w")

        if username_text:
            tk.Label(name_frame, text=f"@{username_text}", font=FONT_SMALL, fg=FG_DIM, bg=BG_CARD, anchor="w").grid(row=1, column=0, sticky="w")

        status_text = "运行中" if is_running else "已停止"
        status_color = ACCENT if is_running else FG_DIM
        status_row = 2 if username_text else 1
        status_lbl = tk.Label(name_frame, text=status_text, font=FONT_SMALL, fg=status_color, bg=BG_CARD, anchor="w")
        status_lbl.grid(row=status_row, column=0, sticky="w")

        actions = tk.Frame(row, bg=BG_CARD)
        actions.grid(row=0, column=2, sticky="e", padx=(8, 0))

        if is_running:
            self._make_btn(actions, "停止", DANGER, lambda a=aid: self.stop_account(a), grid=False).pack(side="left", padx=2)
        else:
            self._make_btn(actions, "启动", ACCENT, lambda a=aid: self.start_account(a), grid=False).pack(side="left", padx=2)

        self._make_btn(actions, "编辑", BORDER, lambda a=aid: self.edit_account(a), grid=False).pack(side="left", padx=2)
        self._make_btn(actions, "删除", BORDER, lambda a=aid: self.delete_account(a), grid=False).pack(side="left", padx=2)

        self.account_widgets[aid] = {
            "row": row, "dot": dot, "name_lbl": name_lbl, "status_lbl": status_lbl
        }

    def add_account(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("添加 Biu 账号")
        dialog.geometry("380x280")
        dialog.configure(bg=BG)
        dialog.transient(self.root)
        dialog.grab_set()

        tk.Label(dialog, text="添加 Biu 账号", font=FONT_TITLE, fg=ACCENT, bg=BG).pack(pady=(16, 12))

        form = tk.Frame(dialog, bg=BG)
        form.pack(fill="x", padx=24)

        fields = {}
        for label_text, key in [("账号名称", "name"), ("Biu 用户名", "username"), ("密码", "password")]:
            row = tk.Frame(form, bg=BG)
            row.pack(fill="x", pady=4)
            tk.Label(row, text=label_text, font=FONT, fg=FG_DIM, bg=BG, width=10, anchor="e").pack(side="left")
            show = "*" if key == "password" else ""
            entry = tk.Entry(row, font=FONT, fg=FG, bg=BG_CARD, insertbackground=FG,
                             relief="flat", show=show, width=24)
            entry.pack(side="left", padx=(8, 0), ipady=3)
            fields[key] = entry

        result = {"ok": False}

        def on_submit():
            name = fields["name"].get().strip()
            username = fields["username"].get().strip()
            password = fields["password"].get().strip()

            if not name or not username or not password:
                messagebox.showwarning("提示", "请填写所有字段", parent=dialog)
                return

            # 尝试登录，失败则尝试注册
            token, info = api_login(username, password)
            if not token:
                token, info = api_register(username, password, name)
                if not token:
                    messagebox.showerror("添加失败", f"无法登录或注册: {info}", parent=dialog)
                    return
                action = "注册并登录"
            else:
                action = "登录"

            account = {
                "id": next_account_id(self.accounts),
                "name": name,
                "auto_start": False,
                "username": username,
                "token": token,
            }
            self.accounts.append(account)
            save_accounts(self.accounts)
            self._refresh_account_list()
            self._set_status(f"已添加账号: {name} ({action}成功)")
            result["ok"] = True
            dialog.destroy()

        btn_row = tk.Frame(dialog, bg=BG)
        btn_row.pack(pady=16)
        self._make_btn(btn_row, "取消", BORDER, dialog.destroy, grid=False).pack(side="left", padx=8)
        self._make_btn(btn_row, "添加", ACCENT, on_submit, grid=False).pack(side="left", padx=8)

        dialog.wait_window()

    def edit_account(self, aid):
        account = next((a for a in self.accounts if a["id"] == aid), None)
        if not account:
            return
        name = simpledialog.askstring("编辑账号", "输入新名称:", initialvalue=account["name"], parent=self.root)
        if not name:
            return
        account["name"] = name.strip()
        save_accounts(self.accounts)
        self._refresh_account_list()
        self._set_status(f"已更新账号: {name.strip()}")

    def delete_account(self, aid):
        account = next((a for a in self.accounts if a["id"] == aid), None)
        if not account:
            return
        if aid in self.processes:
            self.stop_account(aid)
        self.accounts = [a for a in self.accounts if a["id"] != aid]
        save_accounts(self.accounts)
        self._refresh_account_list()
        self._set_status(f"已删除账号: {account['name']}")

    def _is_vite_running(self):
        try:
            conn = http.client.HTTPConnection("localhost", VITE_PORT, timeout=2)
            conn.request("GET", "/")
            resp = conn.getresponse()
            conn.close()
            return resp.status == 200
        except Exception:
            return False

    def toggle_vite(self):
        if self.vite_status == "running":
            self._stop_vite()
        else:
            self._start_vite()

    def _start_vite(self):
        if self._is_vite_running():
            self.vite_status = "running"
            self._update_vite_indicator()
            self._set_status("Vite 已在运行")
            return

        self._set_status("启动 Vite 开发服务器...")
        os.makedirs(LOG_DIR, exist_ok=True)
        log_path = os.path.join(LOG_DIR, "vite.log")
        log_file = open(log_path, "w")
        self.vite_process = subprocess.Popen(
            [VITE_CMD],
            cwd=CLIENT_DIR,
            stdout=log_file,
            stderr=log_file,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )

        def wait():
            for _ in range(60):
                if self._is_vite_running():
                    self.vite_status = "running"
                    self.root.after(0, self._update_vite_indicator)
                    self.root.after(0, lambda: self._set_status("Vite 已就绪"))
                    return
                time.sleep(0.5)
            self.root.after(0, lambda: self._set_status("Vite 启动超时"))

        threading.Thread(target=wait, daemon=True).start()

    def _stop_vite(self):
        if self.vite_process:
            try:
                self.vite_process.terminate()
                self.vite_process.wait(timeout=3)
            except Exception:
                try:
                    self.vite_process.kill()
                except Exception:
                    pass
            self.vite_process = None
        self.vite_status = "stopped"
        self._update_vite_indicator()
        self._set_status("Vite 已停止")

    def _update_vite_indicator(self):
        if self.vite_status == "running":
            self.vite_indicator.configure(text="  Vite: 运行中  ", fg=ACCENT)
        else:
            self.vite_indicator.configure(text="  Vite: 未启动  ", fg=FG_DIM)

    def compile_electron(self):
        self._set_status("编译 Electron 主进程...")
        result = subprocess.run(
            [TSC_CMD, "-p", "tsconfig.electron.json"],
            cwd=CLIENT_DIR,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            self._set_status("编译失败")
            messagebox.showerror("编译失败", result.stderr, parent=self.root)
        else:
            self.compiled = True
            self._set_status("编译成功")

    def start_account(self, aid):
        account = next((a for a in self.accounts if a["id"] == aid), None)
        if not account:
            return

        if aid in self.processes and self.processes[aid].poll() is None:
            self._set_status(f"{account['name']} 已在运行")
            return

        if not self._is_vite_running():
            self._start_vite()
            time.sleep(1)
            if not self._is_vite_running():
                self._set_status("Vite 未就绪，无法启动")
                return

        if not self.compiled:
            self.compile_electron()
            if not self.compiled:
                return

        user_data_dir = os.path.join(TMP_DIR, f"user-data-{aid}")
        os.makedirs(user_data_dir, exist_ok=True)
        os.makedirs(LOG_DIR, exist_ok=True)

        env = os.environ.copy()
        env["ELECTRON_DEV"] = "1"
        if account.get("token"):
            env["BIU_TOKEN"] = account["token"]

        log_path = os.path.join(LOG_DIR, f"electron-{aid}.log")
        log_file = open(log_path, "w")
        proc = subprocess.Popen(
            [ELECTRON_CMD, ".", f"--user-data-dir={user_data_dir}"],
            cwd=CLIENT_DIR,
            env=env,
            stdout=log_file,
            stderr=log_file,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )
        self.processes[aid] = proc
        self._refresh_account_list()
        self._set_status(f"已启动: {account['name']}")

    def stop_account(self, aid):
        account = next((a for a in self.accounts if a["id"] == aid), None)
        if not account:
            return

        if aid in self.processes:
            proc = self.processes[aid]
            try:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/F", "/PID", str(proc.pid), "/T"],
                                   capture_output=True, timeout=5)
                else:
                    proc.terminate()
                    proc.wait(timeout=3)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
            del self.processes[aid]

        self._refresh_account_list()
        self._set_status(f"已停止: {account['name']}")

    def start_all(self):
        if not self._is_vite_running():
            self._start_vite()
            time.sleep(1)

        if not self.compiled:
            self.compile_electron()
            if not self.compiled:
                return

        for account in self.accounts:
            self.start_account(account["id"])
            time.sleep(0.3)

    def stop_all(self):
        for aid in list(self.processes.keys()):
            self.stop_account(aid)

    def _poll_status(self):
        changed = False
        for aid in list(self.processes.keys()):
            proc = self.processes[aid]
            if proc.poll() is not None:
                del self.processes[aid]
                changed = True
        if changed:
            self._refresh_account_list()

        running = sum(1 for a in self.accounts if a["id"] in self.processes and self.processes[a["id"]].poll() is None)
        self.status_label.configure(text=f"运行中: {running} / {len(self.accounts)} 个账号")

        self.root.after(2000, self._poll_status)

    def _set_status(self, text):
        self.status_label.configure(text=text)

    def on_close(self):
        self.stop_all()
        self._stop_vite()
        self.root.destroy()


def main():
    root = tk.Tk()
    try:
        root.iconbitmap(default="")
    except Exception:
        pass

    style = ttk.Style()
    style.theme_use("clam")
    style.configure("Vertical.TScrollbar", background=BORDER, troughcolor=BG, borderwidth=0, arrowsize=0)

    app = BiuLauncher(root)
    root.mainloop()


if __name__ == "__main__":
    main()
