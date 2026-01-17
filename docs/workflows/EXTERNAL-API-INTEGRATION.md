# External API Integration Checklist

When integrating with external APIs (ABC Ignite, etc.), use this checklist to avoid common issues.

## Pre-Integration Verification

### 1. API Documentation Review
- [ ] Obtain official API documentation (Swagger/OpenAPI spec preferred)
- [ ] Verify API base URL (production vs sandbox)
- [ ] Document all required endpoints with **exact paths**
- [ ] Note any path parameter ordering (e.g., `/employees/bookingavailability/{id}` vs `/employees/{id}/availability`)

### 2. Authentication
- [ ] Confirm header names exactly (e.g., `app_id` vs `App-Id` vs `X-App-Id`)
- [ ] Confirm header value format (raw value vs Base64 encoded)
- [ ] Test credentials directly in API docs/Postman before coding
- [ ] Document credential length expectations for validation

### 3. Request Format
- [ ] Verify query parameter names (case-sensitive)
- [ ] Confirm date format requirements (ISO `YYYY-MM-DD` vs `MM/DD/YYYY`)
- [ ] Check if parameters are query string vs path vs body
- [ ] Note any required parameters that may appear optional in docs

### 4. Response Format
- [ ] Document response structure and key names
- [ ] Note pagination patterns if applicable
- [ ] Identify error response format for proper parsing

## Integration Testing Protocol

### Step 1: Direct API Test
Before writing adapter code, test the exact endpoint manually:
```bash
curl -X 'GET' \
  'https://api.example.com/endpoint' \
  -H 'app_id: YOUR_ID' \
  -H 'app_key: YOUR_KEY'
```

### Step 2: Compare Request Details
When debugging, add temporary logging to compare:
```typescript
console.log('API Request:', {
  method,
  url,  // Full URL being called
  headerKeys: Object.keys(headers),
});
```

### Step 3: Verify URL Structure
Common URL structure issues:
- Path segment order: `/resource/action/{id}` vs `/resource/{id}/action`
- Missing path segments: `/employees/bookingavailability/{id}` vs `/employees/{id}/availability`
- Query vs path parameters

### Step 4: Check Error Responses
Log full error responses during development:
```typescript
console.log('API Error:', {
  status: response.status,
  body: await response.text(),
});
```

## Debug Checklist

When an integration fails:

1. **Credentials Check**
   - [ ] Are secrets being retrieved? (log `!!secret` not the value)
   - [ ] Do lengths match expected? (log `secret?.length`)
   - [ ] Correct workspace/integration being used?

2. **URL Check**
   - [ ] Log the full constructed URL
   - [ ] Compare character-by-character with working curl/Postman request
   - [ ] Check URL encoding of special characters

3. **Headers Check**
   - [ ] Log header keys (not values)
   - [ ] Verify exact header names match API spec

4. **Timing/Environment**
   - [ ] API rate limits?
   - [ ] IP whitelist requirements?
   - [ ] Different permissions for different endpoints?

## ABC Ignite Specific Notes

### Endpoint Patterns
| Operation | Correct Path |
|-----------|--------------|
| Event Types | `GET /{clubNumber}/calendars/event-types` |
| Events | `GET /{clubNumber}/calendars/events` |
| Employee Availability | `GET /{clubNumber}/employees/bookingavailability/{employeeId}` |
| Members | `GET /{clubNumber}/members` |

### Authentication Headers
```
app_id: {8-character ID}
app_key: {32-character key}
Content-Type: application/json
Accept: application/json
```

### Date Format
ABC API expects dates in `MM/DD/YYYY` format, not ISO format.

### Common Issues
- **401 Unauthorized**: Check endpoint path structure first, then credentials
- **Empty response**: Check if `defaultEventTypeId` is configured
- **Missing data**: Verify `levelId` is included for availability requests
