import sys
from pathlib import Path


def _inject_global_site_packages() -> None:
    # prisma-client-py may generate into the base Python site-packages path.
    # In this workspace the generated client lives in the active venv, so prefer
    # that location first and keep the base interpreter path as a fallback.
    venv_prefix = Path(sys.prefix)
    base_prefix = Path(sys.base_prefix)
    major = sys.version_info.major
    minor = sys.version_info.minor

    candidates = [
        venv_prefix / 'Lib' / 'site-packages',
        venv_prefix / 'lib' / f'python{major}.{minor}' / 'site-packages',
        base_prefix / 'Lib' / 'site-packages',
        base_prefix / 'lib' / f'python{major}.{minor}' / 'site-packages',
    ]

    for candidate in reversed(candidates):
        candidate_str = str(candidate)
        if candidate.exists():
            while candidate_str in sys.path:
                sys.path.remove(candidate_str)
            sys.path.insert(0, candidate_str)


_inject_global_site_packages()

from prisma import Prisma  # noqa: E402
