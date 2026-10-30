#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""启动墨读的公网预览：本地 HTTP 服务 + Cloudflare 快速隧道。

用法：双击同目录上一级的「启动公网预览.bat」，或在命令行 `python tools/public_preview.py`。
隧道建立后地址会打印在窗口里，同时写入根目录的「公网地址.txt」并复制到剪贴板。
关闭窗口即停止（隧道地址随之失效，下次会变新的）。
"""
import os
import re
import subprocess
import sys
import threading
import time
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLOUDFLARED = os.path.join(ROOT, 'tools', 'cloudflared.exe')
PORT = 8848
URL_FILE = os.path.join(ROOT, '公网地址.txt')


def copy_to_clipboard(text):
    try:
        p = subprocess.run(['clip'], input=text.encode('utf-8'), check=False)
        return p.returncode == 0
    except Exception:
        return False


def main():
    if not os.path.exists(CLOUDFLARED):
        print('缺少 cloudflared.exe：' + CLOUDFLARED)
        input('按回车退出')
        return 1

    print(f'[1/2] 本地服务 http://127.0.0.1:{PORT} 启动中…')
    server = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(PORT), '--bind', '0.0.0.0'],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)

    print('[2/2] 正在向 Cloudflare 申请公网地址…（通常 5 秒内）')
    tunnel = subprocess.Popen(
        [CLOUDFLARED, 'tunnel', '--url', f'http://127.0.0.1:{PORT}', '--no-autoupdate'],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        errors='replace',
    )

    url = None
    pattern = re.compile(r'https://[a-z0-9-]+\.trycloudflare\.com')
    deadline = time.time() + 60

    def watch():
        nonlocal url
        for line in tunnel.stderr:
            if url:
                continue
            m = pattern.search(line)
            if m:
                url = m.group(0)

    threading.Thread(target=watch, daemon=True).start()

    while url is None and time.time() < deadline:
        if tunnel.poll() is not None:
            print('隧道进程意外退出，检查网络后重试。')
            server.terminate()
            input('按回车退出')
            return 1
        time.sleep(0.4)

    if not url:
        print('申请超时，请检查网络。')
        tunnel.terminate()
        server.terminate()
        input('按回车退出')
        return 1

    with open(URL_FILE, 'w', encoding='utf-8') as f:
        f.write(url + '\n')
    copied = copy_to_clipboard(url)

    print('\n' + '=' * 60)
    print('  公网地址：' + url)
    print('  ' + ('已复制到剪贴板，可直接粘贴发送。' if copied else f'已写入 {URL_FILE}'))
    print('  手机打开后 → 分享 → 添加到主屏幕。')
    print('  ★ 这个窗口别关，关掉地址就失效。')
    print('=' * 60 + '\n')

    if '--no-browser' not in sys.argv:
        webbrowser.open(url)
    try:
        while tunnel.poll() is None:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        tunnel.terminate()
        server.terminate()
    return 0


if __name__ == '__main__':
    sys.exit(main())