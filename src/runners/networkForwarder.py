"""Relay a loopback HTTP proxy to a host-enforced Unix socket; no direct egress."""
import select
import socket
import socketserver
import sys
import threading
import time


class Relay(socketserver.BaseRequestHandler):
    def handle(self):
        upstream = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        upstream.settimeout(5)
        try:
            upstream.connect(sys.argv[1])
            self.request.settimeout(5)
            peers = [self.request, upstream]
            until = time.monotonic() + 30
            while time.monotonic() < until:
                ready, _, _ = select.select(peers, [], [], 5)
                if not ready:
                    continue
                for source in ready:
                    data = source.recv(16384)
                    if not data:
                        return
                    target = upstream if source is self.request else self.request
                    target.sendall(data)
        except (OSError, TimeoutError):
            pass
        finally:
            upstream.close()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 4
    slots = threading.BoundedSemaphore(4)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        super().process_request(request, address)

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()


if __name__ == '__main__':
    with Server(('127.0.0.1', 8765), Relay) as server:
        server.serve_forever()
