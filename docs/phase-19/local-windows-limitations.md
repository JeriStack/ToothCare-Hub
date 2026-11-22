# Local Windows Docker Desktop Monitoring Limitations

When developing ToothCare Hub on **Windows with Docker Desktop (WSL 2 backend)**, host-level monitoring behaves differently from a native Linux staging/production server:

1. **No Native Windows Host Metrics via `node-exporter`:** Running `prom/node-exporter` inside Docker Desktop reports metrics from the lightweight WSL 2 Linux utility VM, **not** the physical Windows host CPU, memory, or NTFS disk drives. For this reason, `node-exporter` is placed in the opt-in `monitoring-linux` Compose profile rather than enabled by default on Windows.
2. **cAdvisor Container Metrics Caveats:** `gcr.io/cadvisor/cadvisor:v0.49.1` monitors Docker containers inside the WSL 2 engine. Certain kernel-level cgroup metrics and container restart counters may differ slightly from native Linux Docker Engine hosts.
3. **Security Implication of cAdvisor Mounts:** cAdvisor requires read-only mounts of `/`, `/var/run`, `/sys`, and `/var/lib/docker`. It is isolated exclusively on the internal `toothcare_monitoring` network with **no published host ports**.
4. **Staging Requirement:** Always validate host CPU, memory, and disk-space alerts (`node-exporter` + `cadvisor`) on a native Linux staging host before production launch.
