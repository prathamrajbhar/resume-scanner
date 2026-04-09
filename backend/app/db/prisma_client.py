import sys
from pathlib import Path


def _inject_global_site_packages() -> None:
    # prisma-client-py may generate into the base Python site-packages path.
    base_prefix = Path(sys.base_prefix)
    major = sys.version_info.major
    minor = sys.version_info.minor

    candidates = [
        base_prefix / 'Lib' / 'site-packages',
        base_prefix / 'lib' / f'python{major}.{minor}' / 'site-packages',
    ]

    for candidate in candidates:
        candidate_str = str(candidate)
        if candidate.exists() and candidate_str not in sys.path:
            sys.path.insert(0, candidate_str)


_inject_global_site_packages()

from prisma import Prisma  # noqa: E402
