"""Hardware detection for embedding model recommendation.

Detects RAM, CPU cores, and GPU (NVIDIA or Apple Silicon MPS).
All detection is best-effort — errors are caught and return safe defaults.
"""

from __future__ import annotations

import os
import platform
import subprocess
import sys
from dataclasses import dataclass, field


@dataclass
class GpuInfo:
    name: str
    vram_gb: float
    backend: str  # "nvidia" | "apple_mps" | "unknown"


@dataclass
class HardwareInfo:
    ram_gb: float
    cpu_cores: int
    platform: str  # darwin | linux | windows
    arch: str  # arm64 | x86_64
    gpus: list[GpuInfo] = field(default_factory=list)

    @property
    def has_apple_silicon(self) -> bool:
        return self.platform == "darwin" and self.arch == "arm64"

    @property
    def primary_gpu(self) -> GpuInfo | None:
        return self.gpus[0] if self.gpus else None

    @property
    def effective_vram_gb(self) -> float:
        """Available GPU memory for model loading."""
        if self.primary_gpu:
            return self.primary_gpu.vram_gb
        return 0.0


def _get_ram_gb() -> float:
    try:
        if sys.platform == "darwin":
            out = subprocess.check_output(["sysctl", "-n", "hw.memsize"], timeout=2).decode().strip()
            return int(out) / 1024**3
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal"):
                    return int(line.split()[1]) / 1024**2
    except Exception:
        pass
    return 0.0


def _get_cpu_cores() -> int:
    return os.cpu_count() or 1


def _detect_nvidia_gpus() -> list[GpuInfo]:
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            timeout=3,
        ).decode().strip()
        gpus = []
        for line in out.splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) == 2:
                name, vram_mib = parts
                gpus.append(GpuInfo(name=name, vram_gb=float(vram_mib) / 1024, backend="nvidia"))
        return gpus
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        return []


def _detect_apple_mps(ram_gb: float) -> list[GpuInfo]:
    """Apple Silicon — GPU shares system RAM (unified memory architecture)."""
    if sys.platform != "darwin" or platform.machine() != "arm64":
        return []
    try:
        out = subprocess.check_output(
            ["system_profiler", "SPDisplaysDataType", "-json"], timeout=5
        ).decode()
        import json
        data = json.loads(out)
        displays = data.get("SPDisplaysDataType", [{}])
        name = displays[0].get("sppci_model", "Apple Silicon GPU") if displays else "Apple Silicon GPU"
    except Exception:
        name = "Apple Silicon GPU"

    # Apple Silicon uses unified memory — GPU can access all system RAM
    return [GpuInfo(name=name, vram_gb=ram_gb, backend="apple_mps")]


def detect_hardware() -> HardwareInfo:
    """Detect current machine hardware. Best-effort, never raises."""
    ram_gb = _get_ram_gb()
    cpu_cores = _get_cpu_cores()
    plat = sys.platform if sys.platform in ("darwin", "linux", "win32") else sys.platform
    arch = platform.machine().lower()
    if arch == "x86_64" or arch == "amd64":
        arch = "x86_64"

    gpus = _detect_nvidia_gpus()
    if not gpus:
        gpus = _detect_apple_mps(ram_gb)

    return HardwareInfo(
        ram_gb=round(ram_gb, 1),
        cpu_cores=cpu_cores,
        platform=plat,
        arch=arch,
        gpus=gpus,
    )
