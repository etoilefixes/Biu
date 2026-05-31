import subprocess
import sys
import os
import time
import signal
import http.client

CLIENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CLIENT_DIR)
TMP_DIR = os.path.join(CLIENT_DIR, "tmp")
LOG_DIR = os.path.join(TMP_DIR, "logs")
VITE_PORT = 5173
BIN_DIR = os.path.join(PROJECT_ROOT, "node_modules", ".bin")
ELECTRON_CMD = os.path.join(BIN_DIR, "electron.cmd" if os.name == "nt" else "electron")
TSC_CMD = os.path.join(BIN_DIR, "tsc.cmd" if os.name == "nt" else "tsc")
VITE_CMD = os.path.join(BIN_DIR, "vite.cmd" if os.name == "nt" else "vite")

vite_process = None
electron_processes = []


def print_banner():
    print()
    print("  ╔═══════════════════════════╗")
    print("  ║       Biu Launcher        ║")
    print("  ╚═══════════════════════════╝")
    print()


def is_vite_running():
    try:
        conn = http.client.HTTPConnection("localhost", VITE_PORT, timeout=2)
        conn.request("GET", "/")
        resp = conn.getresponse()
        conn.close()
        return resp.status == 200
    except Exception:
        return False


def wait_for_vite(timeout=30):
    print(f"  ⏳ 等待 Vite 开发服务器就绪 (localhost:{VITE_PORT})...")
    start = time.time()
    while time.time() - start < timeout:
        if is_vite_running():
            print(f"  ✅ Vite 开发服务器已就绪")
            return True
        time.sleep(0.5)
    print(f"  ❌ Vite 启动超时 ({timeout}s)")
    return False


def start_vite():
    global vite_process
    if is_vite_running():
        print(f"  ✅ Vite 已在运行 (localhost:{VITE_PORT})")
        return True

    print("  🚀 启动 Vite 开发服务器...")
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = open(os.path.join(LOG_DIR, "vite.log"), "w")
    vite_process = subprocess.Popen(
        [VITE_CMD],
        cwd=CLIENT_DIR,
        stdout=log_file,
        stderr=log_file,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )
    return wait_for_vite()


def compile_electron():
    print("  🔨 编译 Electron 主进程...")
    result = subprocess.run(
        [TSC_CMD, "-p", "tsconfig.electron.json"],
        cwd=CLIENT_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  ❌ 编译失败:\n{result.stderr}")
        return False
    print("  ✅ 编译成功")
    return True


def launch_instance(index):
    user_data_dir = os.path.join(TMP_DIR, f"user-data-{index}")
    os.makedirs(user_data_dir, exist_ok=True)
    os.makedirs(LOG_DIR, exist_ok=True)

    env = os.environ.copy()
    env["ELECTRON_DEV"] = "1"

    print(f"  🚀 启动实例 #{index} (user-data-{index})")
    log_file = open(os.path.join(LOG_DIR, f"electron-{index}.log"), "w")
    proc = subprocess.Popen(
        [ELECTRON_CMD, ".", f"--user-data-dir={user_data_dir}"],
        cwd=CLIENT_DIR,
        env=env,
        stdout=log_file,
        stderr=log_file,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )
    electron_processes.append(proc)
    return proc


def cleanup(signum=None, frame=None):
    print()
    print("  🧹 清理进程...")
    for proc in electron_processes:
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    electron_processes.clear()

    if vite_process:
        try:
            vite_process.terminate()
            vite_process.wait(timeout=3)
        except Exception:
            try:
                vite_process.kill()
            except Exception:
                pass

    print("  ✅ 已退出")
    sys.exit(0)


def main():
    print_banner()

    signal.signal(signal.SIGINT, cleanup)
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes
        handler_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)
        handler = handler_type(lambda t: (cleanup(), True)[1])
        ctypes.windll.kernel32.SetConsoleCtrlHandler(handler, True)

    count = 2
    if len(sys.argv) > 1:
        try:
            count = int(sys.argv[1])
        except ValueError:
            print(f"  ❌ 无效参数: {sys.argv[1]}，请输入实例数量")
            sys.exit(1)

    if count < 1 or count > 5:
        print("  ❌ 实例数量需在 1-5 之间")
        sys.exit(1)

    print(f"  📦 将启动 {count} 个实例\n")

    if not start_vite():
        sys.exit(1)

    if not compile_electron():
        sys.exit(1)

    print()
    for i in range(1, count + 1):
        launch_instance(i)
        if i < count:
            time.sleep(0.5)

    print(f"\n  ✅ {count} 个实例已启动")
    print(f"  📋 日志目录: {LOG_DIR}")
    print("  💡 按 Ctrl+C 退出所有实例\n")

    try:
        while True:
            time.sleep(1)
            running = sum(1 for p in electron_processes if p.poll() is None)
            if running == 0:
                print("  ⚠️ 所有 Electron 实例已关闭")
                cleanup()
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()
