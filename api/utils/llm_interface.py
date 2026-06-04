from abc import ABC, abstractmethod
from typing import List, Dict, Any

class LLMInterface(ABC):
    @abstractmethod
    def chat(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Return {'content': str, 'usage': dict, 'model': str}."""
        pass
