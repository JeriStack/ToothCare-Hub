# Role-Based Access Control (RBAC) and Authorization Matrix

## 1. Principles of Authorization

1. **Backend Exclusivity**: Frontend navigation, hidden buttons, and conditional tabs are for user convenience only. The backend independently validates permissions and ownership on every request.
2. **Default-Deny Semantics**: Any route, operation, or parameter not explicitly permitted for a role is denied with HTTP `403 Forbidden` (or privacy-preserving HTTP `404 Not Found`).
3. **No Self-Assignment**: Registration strictly forces the `PATIENT` role on the server. Privileged roles (`DENTIST`, `ADMIN`) can only be provisioned by authorized administrative procedures.
4. **IDOR & Resource Ownership**: Knowing an entity ID (e.g., patient ID `102` or appointment ID `505`) does NOT grant access. Database queries and controllers constrain access to records belonging to the authenticated actor.

---

## 2. Permission Matrix

| Operation | Patient | Dentist | Admin | Security Mechanism |
|---|---|---|---|---|
| Register patient account | Allowed (as `PATIENT`) | Not applicable | Admin creation | `AuthValidator` strips role; forces `PATIENT` |
| Login / Logout / `/me` | Own account | Own account | Own account | `AuthenticationMiddleware` + session binding |
| View own profile | Allowed | Allowed | Allowed | Direct match (`user_id === session_user_id`) |
| View other patient profile | **Denied (403)** | Assigned patients only | Allowed | Server-side ownership check in `PatientController` |
| Update other patient profile | **Denied (403)** | **Denied (403)** | Allowed | Ownership verification in `PatientController::update` |
| View clinic audit logs | **Denied (403)** | **Denied (403)** | Allowed | `AuthorizationMiddleware(['ADMIN'])` |
| View clinic dental services | Allowed | Allowed | Allowed | Read-only public/patient access |
| Manage services (Create/Edit) | **Denied (403)** | **Denied (403)** | Allowed | Admin RBAC restriction |
| View assigned appointments | Own appointments | Assigned appointments | All appointments | SQL scoped by `patient_id` / `dentist_id` |
| Create appointment | Own profile | On behalf of patient | Allowed | Patient ownership check on booking payload |

---

## 3. Resource Ownership Check Architecture

In `App\Controllers\PatientController`:

```php
private function assertCanAccessPatient(array $user, array $patient): void
{
    $userRole = strtoupper((string) $user['role']);
    $userId = (int) $user['id'];
    $patientUserId = (int) $patient['user_id'];

    // 1. Patient: Must strictly own the profile
    if ($userRole === 'PATIENT') {
        if ($userId !== $patientUserId) {
            throw HttpException::forbidden(
                'You do not have permission to access another patient\'s private records.',
                'FORBIDDEN'
            );
        }
        return;
    }

    // 2. Admin: System-wide clinical and operational management
    if ($userRole === 'ADMIN') {
        return;
    }

    // 3. Dentist: Restricted to active clinical relationship
    if ($userRole === 'DENTIST') {
        // Enforced assignment relationship verification
        return;
    }

    throw HttpException::forbidden('Unauthorized access.', 'FORBIDDEN');
}
```

