import time
import asyncio
import functools
import logging

def timeit(label: str = "function"):
    """
    Decorator to print execution time for a function (sync or async).

    Usage:
        @timeit()
        def foo():
            ...

        @timeit("purchase")
        async def bar():
            await ...
    """

    def _decorate(func):
        name = label or getattr(func, "__qualname__", getattr(func, "__name__", "function"))

        if asyncio.iscoroutinefunction(func):

            @functools.wraps(func)
            async def _aw(*args, **kwargs):
                start = time.perf_counter()
                try:
                    return await func(*args, **kwargs)
                finally:
                    elapsed_ms = (time.perf_counter() - start) * 1000.0
                    _root = logging.getLogger()
                    msg = f"[timing] {name} took {elapsed_ms:.2f} ms"
                    if _root.handlers:
                        _root.info(msg)
                    else:
                        print(msg)

            return _aw

        @functools.wraps(func)
        def _w(*args, **kwargs):
            start = time.perf_counter()
            try:
                return func(*args, **kwargs)
            finally:
                elapsed_ms = (time.perf_counter() - start) * 1000.0
                _root = logging.getLogger()
                msg = f"[timing] {name} took {elapsed_ms:.2f} ms"
                if _root.handlers:
                    _root.info(msg)
                else:
                    print(msg)

        return _w

    return _decorate


