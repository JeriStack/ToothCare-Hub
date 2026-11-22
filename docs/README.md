# ToothCare Hub Documentation

| Folder | Contents |
|---|---|
| [`architecture/`](architecture/) | Repository and directory structure |
| [`planning/`](planning/) | Project brief, MVP scope, requirements, role matrix, appointment policies, risks |
| [`setup/`](setup/) | Environment configuration, local development, Docker, Git workflow |
| [`design/`](design/) | Design system, wireframes, user journeys, route map, UI/UX guidelines |
| [`database/`](database/) | Data dictionary, ERD, schema design, concurrency, audits |
| [`api/`](api/) | OpenAPI 3.0.3 guides ([`api/README.md`](api/README.md)), authentication & CSRF, RBAC/DRBAC, error handling, pagination, appointment workflows, curl examples, Postman collection |
| [`security/`](security/) | Security checklist and authentication documentation |
| [`modules/`](modules/) | Admin, scheduling, booking, patient portal, dentist portal, administrator control center, email notifications (Phase 13) |
| [`phase-14/`](phase-14/) | Real-time notifications with Node.js and Socket.IO (architecture, security, event contract, recovery, Docker, testing, troubleshooting) |
| [`phase-18/`](phase-18/) | Security, privacy, accessibility, performance, reliability, dependency audits, incident response, and production readiness checklist |
| [`phase-19/`](phase-19/) | Observability with Prometheus and Grafana (architecture, metrics inventory, alerting policy, runbook, Docker setup, Windows limitations, verification report) |
| [`operations/`](operations/) | Database backup and disaster recovery, observability runbook |
| [`implementation/`](implementation/) | Frontend stage implementation reports |

Other documentation lives next to the code: [`docs/openapi.yaml`](openapi.yaml) (canonical OpenAPI 3.0.3 spec), [`database/README.md`](../database/README.md), [`docker/README.md`](../docker/README.md), [`monitoring/README.md`](../monitoring/README.md), [`nginx/README.md`](../nginx/README.md), [`deployment/README.md`](../deployment/README.md).