# Flask-Admin Interface

## Overview

Both neurostore and neurosynth-compose now include Flask-Admin interfaces for direct database management. These admin panels provide a user-friendly web interface for viewing and editing database records.

## Access URLs

### Production
- **Store Backend**: https://neurostore.org/admin
- **Compose Backend**: https://compose.neurosynth.org/admin

### Development
- **Store Backend**: http://localhost/admin
- **Compose Backend**: http://localhost/admin (when running compose)

## Features

The Flask-Admin interface provides:

1. **Browse Records**: View all records in database tables with pagination and search
2. **Edit Records**: Update existing records directly through web forms
3. **Create Records**: Add new records to any table
4. **Delete Records**: Remove records from the database
5. **Filter & Search**: Find specific records using built-in filters
6. **Relationships**: Navigate between related records

## Available Models

### Store Backend Models

**Auth Category:**
- Users - User accounts and authentication
- Roles - User roles (including admin role)

**Data Category:**
- Studysets - Collections of studies
- StudysetStudy - Study-to-studyset relationships
- Annotations - Study annotations

**Studies Category:**
- BaseStudies - Base study records
- Studies - Study details
- Analyses - Statistical analyses
- Tables - Data tables
- Conditions - Experimental conditions
- Points - Coordinate points
- Images - Brain images
- Entities - Named entities

**Analysis Category:**
- AnnotationAnalysis - Annotation-analysis relationships
- PointValue - Point value data
- AnalysisConditions - Analysis-condition relationships

### Compose Backend Models

**Auth Category:**
- Users - User accounts and authentication
- Roles - User roles (including admin role)

**Projects Category:**
- Projects - Research projects

**Meta-Analysis Category:**
- MetaAnalysis - Meta-analysis definitions
- MetaAnalysisResult - Meta-analysis results

**Specifications Category:**
- Specifications - Analysis specifications
- SpecificationCondition - Specification conditions
- Conditions - Experimental conditions

**Data Category:**
- Studysets - Study collections
- StudysetReferences - Studyset references
- Annotations - Annotations
- AnnotationReferences - Annotation references

**Neurovault Category:**
- NeurovaultCollections - NeuroVault collections
- NeurovaultFiles - NeuroVault files

**Neurostore Category:**
- NeurostoreStudy - Neurostore study references
- NeurostoreAnalysis - Neurostore analysis references

## Security Considerations

⚠️ **Important Security Notes:**

1. **Authentication Required**: In production, the /admin routes should be protected by authentication middleware or reverse proxy authentication
2. **Admin Role Recommended**: Only users with the admin role should have access to the admin interface
3. **Production Access**: Consider restricting /admin access by IP address or VPN in production environments
4. **Audit Logging**: Consider enabling audit logging for all admin interface actions

## Usage Examples

### Assigning Admin Role to Users

1. Navigate to /admin in your browser
2. Click on "Users" under the "Auth" category
3. Find the user you want to make an admin
4. Click "Edit" on that user
5. In the user edit form, you'll see a "Roles" section
6. Add the "admin" role to the user
7. Click "Save"

Alternatively, use SQL (as documented in ADMIN_ROLE.md):
```sql
INSERT INTO roles_users (user_id, role_id) VALUES ('user-id', 'admin');
```

### Viewing Study Data

1. Navigate to /admin
2. Click on "Studies" under the "Studies" category (Store) or appropriate category (Compose)
3. Browse through the paginated list of studies
4. Use the search box to find specific studies
5. Click on a study to view its details

### Editing Records

1. Navigate to the model you want to edit (e.g., "Users")
2. Click "Edit" next to the record you want to modify
3. Update the fields in the form
4. Click "Save" to persist changes

## Integration with Nginx

The nginx configurations have been updated to route /admin requests to the Flask application:

**Store (store/nginx/nginx.conf):**
```nginx
location /admin {
    proxy_pass http://neurostore:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

**Compose (compose/nginx/nginx.conf):**
```nginx
location /admin {
    proxy_pass http://compose:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## Technical Details

### Implementation

**Store Backend:**
- File: `store/backend/neurostore/core.py`
- Admin initialization happens after database initialization
- All models are registered with appropriate categories
- Uses Bootstrap 4 template mode

**Compose Backend:**
- File: `compose/backend/neurosynth_compose/__init__.py`
- Admin initialization happens in the `create_app()` function
- All models are registered with appropriate categories
- Uses Bootstrap 4 template mode

### Dependencies

Flask-Admin has been added to both backends:
- `store/backend/pyproject.toml`: `flask-admin~=1.6`
- `compose/backend/pyproject.toml`: `flask-admin~=1.6`

## Troubleshooting

### Admin interface not accessible

1. Verify Flask-Admin is installed: `pip list | grep Flask-Admin`
2. Check nginx configuration is correct and nginx has been restarted
3. Verify Flask app is running and accessible
4. Check logs for any errors during admin initialization

### Changes not persisting

1. Verify database connection is working
2. Check for constraint violations in logs
3. Ensure the user has proper permissions in the database

### Models not showing up

1. Verify models are imported in the initialization file
2. Check that models have proper SQLAlchemy table definitions
3. Review Flask app logs for initialization errors

## Future Enhancements

Potential improvements for the admin interface:

1. **Custom ModelView Classes**: Create custom views with field-level permissions
2. **Audit Trail**: Log all changes made through admin interface
3. **Role-Based Access**: Restrict certain models to specific roles
4. **Custom Actions**: Add bulk operations and custom actions
5. **Advanced Filters**: Add more sophisticated filtering options
6. **Export Functionality**: Add CSV/JSON export for data
7. **Import Functionality**: Allow bulk data import
