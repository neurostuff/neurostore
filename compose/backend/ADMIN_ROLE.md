# Admin Role Feature (Neurosynth-Compose)

## Overview

The neurosynth-compose backend now supports an **admin role** that grants users full access to all resources in the system, bypassing normal ownership restrictions.

## What Admins Can Do

Users with the admin role have the following privileges:

1. **Modify Any Record**: Admins can update records owned by any user (meta-analyses, projects, etc.)
2. **Delete Any Record**: Admins can delete records regardless of ownership
3. **View Private Records**: Admins can see all records, including those marked as private
4. **View Draft Records**: Admins can see all draft records, not just their own
5. **Submit Jobs**: Admins can submit meta-analysis jobs for any meta-analysis

## Database Schema

The admin role functionality leverages existing database tables:
- `roles`: Stores role definitions
- `roles_users`: Many-to-many relationship between users and roles
- `users`: User table with relationship to roles

## Setting Up Admin Users

### 1. Apply the Migration

The admin role is created automatically when you apply migrations:

```bash
docker-compose exec compose flask db upgrade
```

This creates an "admin" role in the database.

### 2. Assign Admin Role to a User

To make a user an admin, you need to add them to the admin role. You can do this via SQL:

```sql
-- Find the user ID
SELECT id, external_id, name FROM users WHERE external_id = 'user-external-id';

-- Add user to admin role
INSERT INTO roles_users (user_id, role_id) 
VALUES ('user-id-from-above', 'admin');
```

Or via Python/Flask shell:

```python
from neurosynth_compose.models import User, Role
from neurosynth_compose.database import db

# Get the user and admin role
user = User.query.filter_by(external_id='user-external-id').first()
admin_role = Role.query.filter_by(name='admin').first()

# Assign the role
user.roles.append(admin_role)
db.session.commit()
```

### 3. Via Docker Command

```bash
# Access the database directly
docker-compose exec compose_pgsql17 psql -U postgres -d neurosynth_compose

# Then run SQL commands as shown above
```

## Implementation Details

### Permission Checks

The admin role is checked in four main locations:

1. **`update_or_create()` method** (line 193 in `analysis.py`):
   - Allows admins to modify records they don't own
   
2. **`delete()` method** (line 301 in `analysis.py`):
   - Allows admins to delete any record
   
3. **ListView search** (line 381 in `analysis.py`):
   - Admins can see all records including private ones
   
4. **Draft filtering** (line 389 in `analysis.py`):
   - Admins can see all draft records

5. **Meta-analysis job submission** (line 158 in `meta_analysis_jobs.py`):
   - Admins can submit jobs for any meta-analysis

### Helper Function

The `is_user_admin(user)` function in `resources/analysis.py` checks if a user has the admin role:

```python
def is_user_admin(user=None):
    """Check if the user has the admin role"""
    if user is None:
        user = get_current_user()
    
    if user is None:
        return False
    
    # Check if user has a role named 'admin'
    return any(role.name == "admin" for role in user.roles)
```

## Testing

Test cases are provided in `tests/api/test_admin_role.py`:

- `test_is_user_admin_returns_false_for_non_admin`: Verify non-admin detection
- `test_is_user_admin_returns_true_for_admin`: Verify admin detection
- `test_admin_can_modify_others_records`: Admins can modify others' records
- `test_admin_can_delete_others_records`: Admins can delete others' records
- `test_admin_can_see_private_records`: Admins can view private content
- `test_non_admin_cannot_modify_others_records`: Non-admins are restricted
- `test_non_admin_cannot_delete_others_records`: Non-admins are restricted

Run tests with:

```bash
docker-compose run -e "APP_SETTINGS=neurosynth_compose.config.DockerTestConfig" --rm \
  compose python -m pytest neurosynth_compose/tests/api/test_admin_role.py
```

## Security Considerations

1. **Grant Sparingly**: Only assign the admin role to trusted users
2. **Audit Trail**: Consider adding logging for admin actions (future enhancement)
3. **Role-Based Only**: Admin status is checked via database role, not hardcoded
4. **Independent Systems**: Store and Compose have separate admin roles (must be assigned in both if needed)

## Migration Details

Migration file: `migrations/versions/add_admin_role_compose.py`

The migration:
- Creates an admin role with ID "admin"
- Sets name to "admin"  
- Adds description: "Administrator role with full access to all resources"
- Is idempotent (checks if role exists before inserting)
- Supports downgrade (removes role and associations)

## Differences from Store Backend

The compose backend admin role implementation is similar to the store backend but includes additional protections for:
- Draft record visibility
- Meta-analysis job submission permissions

Both backends have independent admin role systems - assigning admin in one does not grant admin access in the other.
