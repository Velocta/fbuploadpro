# Quickstart: First Comment Scope Alignment

## Verification Steps

### 1. Verify OAuth Initiation Includes `pages_manage_engagement`

Simulate an authenticated user initiating the Facebook connect flow:

```bash
# Request the OAuth initiation endpoint
curl -i "http://localhost:3000/api/auth/facebook"
```

**Expected Outcome**:
The HTTP response is a `307 Temporary Redirect` to `https://www.facebook.com/v26.0/dialog/oauth`.
The `scope` parameter in the `Location` header contains:
`pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_engagement,business_management`.

### 2. Verify BYOC Settings Badge Rendering

Visit `/tenant/[subdomain]/settings?tab=byoc` and inspect the "Required Meta App Permissions" section.

**Expected Outcome**:
The following 5 permissions are rendered:
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `pages_manage_engagement`
- `business_management`

### 3. Verify Automated Test Suite

Run unit and integration tests covering Facebook OAuth initiation:

```bash
# Handled automatically in remote GitHub Actions CI upon PR creation
```
