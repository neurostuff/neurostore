# Admin Role Feature

## Overview

The neurostore backend now supports an **admin role** that grants users full access to all resources in the system, bypassing normal ownership restrictions.

## What Admins Can Do

Users with the admin role have the following privileges:

1. **Modify Any Record**: Admins can update records owned by any user
2. **Delete Any Record**: Admins can delete records regardless of ownership
3. **View Private Records**: Admins can see all records, including those marked as private
4. **Link to Any Parent Record**: Admins can create associations with parent records they don't own

## Database Schema

The admin role functionality leverages existing database tables:
- `roles`: Stores role definitions
- `roles_users`: Many-to-many relationship between users and roles
- `users`: User table with relationship to roles

## Setting Up Admin Users

### 1. Apply the Migration

The admin role is created automatically when you apply migrations:

```bash
docker-compose exec neurostore flask db upgrade
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
from neurostore.models import User, Role
from neurostore.database import db

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
docker-compose exec store-pgsql17 psql -U postgres -d neurostore

# Then run SQL commands as shown above
```

## Implementation Details

### Permission Checks

The admin role is checked in three main locations:

1. **`update_or_create()` method** (line 294 in `base.py`):
   - Allows admins to modify records they don't own
   
2. **`delete()` method** (line 554 in `base.py`):
   - Allows admins to delete any record
   
3. **ListView search** (line 664 in `base.py`):
   - Admins can see all records including private ones

### Helper Function

The `is_user_admin(user)` function in `resources/utils.py` checks if a user has the admin role:

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
docker-compose run -e "APP_SETTINGS=neurostore.config.DockerTestConfig" --rm \
  neurostore python -m pytest neurostore/tests/api/test_admin_role.py
```

## Security Considerations

1. **Grant Sparingly**: Only assign the admin role to trusted users
2. **Audit Trail**: Consider adding logging for admin actions (future enhancement)
3. **No Automatic Bypass**: The compose bot remains separate and is not affected
4. **Role-Based Only**: Admin status is checked via database role, not hardcoded

## Migration Details

Migration file: `migrations/versions/add_admin_role.py`

The migration:
- Creates an admin role with ID "admin"
- Sets name to "admin"  
- Adds description: "Administrator role with full access to all resources"
- Is idempotent (checks if role exists before inserting)
- Supports downgrade (removes role and associations)
