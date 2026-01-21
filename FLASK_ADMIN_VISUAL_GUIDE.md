# Flask-Admin Interface Visual Guide

## Main Interface Layout

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    NeuroStore Admin - Flask-Admin                          ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  Home  |  Logout                                                           ║
╠══════════════════╦════════════════════════════════════════════════════════╣
║                  ║                                                          ║
║  📁 Auth         ║  User Management                                         ║
║    👥 Users      ║  ─────────────────────────────────────────────────────  ║
║    🔐 Roles      ║                                                          ║
║                  ║  [➕ Create]  [🔄 Refresh]                              ║
║  📁 Data         ║                                                          ║
║    📚 Studysets  ║  ┌────────────────────────────────────────────────────┐ ║
║    📖 Annotations║  │ ID │ Name       │ External ID    │ Active │ Roles  │ ║
║                  ║  ├────┼────────────┼────────────────┼────────┼────────┤ ║
║  📁 Studies      ║  │ 1  │ Admin User │ auth0|admin123 │ ✓      │ admin  │ ║
║    📄 BaseStudies║  │ 2  │ John Doe   │ auth0|user456  │ ✓      │ -      │ ║
║    📊 Studies    ║  │ 3  │ Jane Smith │ auth0|user789  │ ✓      │ -      │ ║
║    🔬 Analyses   ║  └────────────────────────────────────────────────────┘ ║
║    📍 Points     ║                                                          ║
║    🖼️  Images    ║  [Edit] [Delete] actions available for each row        ║
║                  ║                                                          ║
║  📁 Analysis     ║  Pagination: [< Previous] Page 1 of 5 [Next >]         ║
║    ...more       ║                                                          ║
║                  ║                                                          ║
╚══════════════════╩════════════════════════════════════════════════════════╝
```

## Key Features

### 1. Navigation Sidebar (Left)
- **Organized by Categories**: Models grouped logically (Auth, Data, Studies, etc.)
- **Quick Access**: Click any model to view its records
- **Visual Icons**: Easy identification of different model types

### 2. Main Content Area (Right)
- **Table View**: Clean, paginated table of all records
- **Search & Filter**: Built-in search functionality
- **Bulk Actions**: Select multiple records for batch operations
- **CRUD Operations**: 
  - ✏️ Edit - Modify existing records
  - 🗑️ Delete - Remove records
  - ➕ Create - Add new records

### 3. Edit Form Example

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                         Edit User: Admin User                              ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  Name: [_________________________Admin User__________________________]     ║
║                                                                             ║
║  External ID: [_________________auth0|admin123____________________]        ║
║                                                                             ║
║  Active: [✓] Yes  [ ] No                                                   ║
║                                                                             ║
║  Roles:                                                                     ║
║    [✓] admin  - Administrator role with full access                        ║
║    [ ] viewer - Read-only access                                           ║
║                                                                             ║
║  Created At: 2024-01-15 10:30:00                                           ║
║  Updated At: 2024-01-20 14:45:00                                           ║
║                                                                             ║
║  [💾 Save Changes]  [❌ Cancel]                                            ║
║                                                                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

## Access Points

### Store Backend
```
URL: https://neurostore.org/admin
Dev: http://localhost/admin
```

### Compose Backend
```
URL: https://compose.neurosynth.org/admin
Dev: http://localhost/admin
```

## Common Operations

### Assigning Admin Role to User

1. Navigate to `/admin`
2. Click "Users" in the Auth category
3. Find the user and click "Edit"
4. Check the "admin" role checkbox
5. Click "Save Changes"

### Creating a New Record

1. Navigate to the desired model (e.g., "Studies")
2. Click "Create New" button
3. Fill in the form fields
4. Click "Save"

### Searching Records

1. Use the search box at the top of the table
2. Enter search terms
3. Results update automatically
4. Use filters in the sidebar for advanced filtering

## Security Notes

⚠️ **Production Deployment:**
- Add authentication middleware to protect /admin routes
- Restrict access by IP address or VPN
- Only grant admin interface access to trusted administrators
- Enable audit logging for all admin actions

## Models Available

### Store Backend
- Users, Roles (Auth)
- Studysets, Annotations (Data)
- Studies, Analyses, Points, Images (Studies)
- And 10+ more models

### Compose Backend
- Users, Roles (Auth)
- Projects (Projects)
- MetaAnalysis, Results (Meta-Analysis)
- Specifications, Conditions (Specifications)
- And 10+ more models

## Benefits

✓ **No SQL Required** - Edit database through web forms
✓ **Visual Interface** - Easy to understand data relationships
✓ **Built-in Validation** - Form validation prevents errors
✓ **Audit Trail** - Track changes (when enabled)
✓ **Bulk Operations** - Manage multiple records at once
✓ **Mobile Friendly** - Bootstrap 4 responsive design
