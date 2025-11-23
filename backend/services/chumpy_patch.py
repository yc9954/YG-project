"""
chumpy Python 3.12 호환성 패치
Python 3.12에서 제거된 inspect.getargspec을 getfullargspec으로 대체
"""
import inspect

# Python 3.12 호환성 패치
if not hasattr(inspect, 'getargspec'):
    inspect.getargspec = inspect.getfullfullargspec

