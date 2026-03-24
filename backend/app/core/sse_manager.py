import asyncio
from collections import defaultdict
from typing import Dict, List

class SSEManager:
    def __init__(self):
        self.connections: Dict[str, List[asyncio.Queue]] = defaultdict(list)

    async def connect(self, user_id: str):
        queue = asyncio.Queue()
        self.connections[user_id].append(queue)
        return queue

    def disconnect(self, user_id: str, queue: asyncio.Queue):
        self.connections[user_id].remove(queue)

    async def send_to_user(self, user_id: str, data: dict):
        if user_id in self.connections:
            for queue in self.connections[user_id]:
                await queue.put(data)

manager = SSEManager()
