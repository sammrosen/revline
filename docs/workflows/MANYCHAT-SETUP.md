# ManyChat Setup Guide

## Overview

ManyChat is used to automatically respond to Instagram comments/DMs and direct users to your landing page where they'll enter their email.

**Flow:**
1. User comments keyword on IG post (e.g., "INTERESTED")
2. ManyChat sends auto-DM with landing page link
3. User clicks link → visits landing page
4. User enters email via EmailCapture component
5. Email added to MailerLite automatically

**Key Point:** ManyChat is NOT integrated via webhook. It simply drives traffic to your landing pages where the existing EmailCapture component handles everything.

---

## Prerequisites

- Instagram Business Account
- ManyChat Pro account (required for Instagram automation)
- Landing page URL ready
- Client's MailerLite groups configured in admin dashboard

---

## Setup Steps

### 1. Connect Instagram to ManyChat

1. Log in to [ManyChat](https://manychat.com/)
2. Go to **Settings** → **Instagram**
3. Click **"Connect Instagram Account"**
4. Select the Instagram Business Account
5. Authorize ManyChat to access the account
6. Verify connection is successful

**Note:** The Instagram account MUST be a Business or Creator account. Personal accounts won't work.

---

### 2. Create Comment Automation

This is the primary way to capture leads from Instagram posts.

**Step-by-Step:**

1. In ManyChat, navigate to **Automation** → **Instagram**
2. Click **"+ New Rule"**
3. Select **"Comment"** as the trigger type
4. Configure trigger settings:
   - **Keywords:** Enter trigger words (e.g., "INTERESTED", "INFO", "SIGN UP", "DETAILS", "LEARN MORE")
   - Make keywords case-insensitive
   - You can add multiple keywords separated by commas

5. **Add First Action: Comment Reply**
   - Click **"+ Add Action"**
   - Choose **"Send Message"**
   - Configure the public comment reply:
   ```
   Hey! 👋 
   
   I'll send you all the info right now.
   
   Check your DMs in 5 seconds!
   ```
   - Keep this SHORT (Instagram has character limits on comment replies)
   - Use emojis to stand out

6. **Add Delay (Optional but Recommended)**
   - Click **"+ Add Action"**
   - Choose **"Delay"**
   - Set to **5 seconds**
   - This creates anticipation and ensures they're ready for the DM

7. **Add Second Action: Send DM**
   - Click **"+ Add Action"**
   - Choose **"Send Message"**
   - Configure the DM content:
   ```
   Here's the link to learn more and get started:
   
   👉 [CLIENT NAME] Landing Page
   
   Just enter your email on that page and I'll send you everything you need.
   
   Talk soon! 💪
   ```

8. **Add Button to DM**
   - In the message editor, click **"Add Button"**
   - Button type: **"URL"**
   - Button text: **"Visit Page"** or **"Get Started"**
   - URL: `https://yourdomain.com/clientname?utm_source=instagram&utm_medium=manychat`
   - Make sure to include UTM parameters for tracking

9. **Save and Activate**
   - Give the automation a descriptive name (e.g., "IG Comment → Landing Page")
   - Toggle the automation to **"Active"**
   - Test immediately (see Testing section below)

---

### 3. Create DM Automation (Optional)

For people who DM directly instead of commenting:

1. Navigate to **Automation** → **Instagram**
2. Click **"+ New Rule"**
3. Choose **"Message"** trigger (DM)
4. Configure trigger:
   - Option A: Set specific keywords (e.g., "INFO", "HELP", "START")
   - Option B: Set as **"Default Reply"** (catches all DMs)

5. Send the same message as above:
   ```
   Hey! Thanks for reaching out! 👋
   
   Here's the link to learn more and get started:
   
   👉 [CLIENT NAME] Landing Page
   
   Just enter your email on that page and I'll send you everything you need!
   ```

6. Add button with landing page URL
7. Save and activate

---

### 4. Advanced: Multi-Step Flow (Optional)

For more engaged leads, create a multi-step conversation:

**Example Flow:**
1. User comments keyword
2. ManyChat replies: "What are you most interested in? Reply A, B, or C"
3. User replies with choice
4. ManyChat sends personalized response based on choice
5. Include landing page link in follow-up message

**Benefits:**
- Qualify leads before sending to landing page
- Personalize the message based on interests
- Higher engagement and conversion rates

**When to Use:**
- High-ticket offers ($1K+)
- Multiple services/products
- Warm audience that needs education

---

### 5. Set Up Instagram Posts for Lead Generation

**Best Practices for IG Posts:**

1. **Create Valuable Content**
   - Educational carousel posts
   - Before/after transformations
   - Client success stories
   - Tips and tricks

2. **Add Clear CTA in Caption**
   ```
   Want to learn how to [OUTCOME]?
   
   Comment "INTERESTED" below and I'll send you the details!
   ```

3. **Pin Comment Reminder**
   - Post goes live
   - Immediately comment: "Don't forget to comment INTERESTED for the link!"
   - Pin your comment to the top

4. **Engage with Comments**
   - ManyChat handles automation
   - You can still reply manually to build relationships
   - ManyChat won't override your manual replies

---

### 6. Testing the Flow

**Critical: Test BEFORE going live with client**

1. **Test Comment Trigger:**
   - Go to the client's Instagram post
   - Comment with the trigger keyword
   - Wait 5 seconds
   - Check if you receive the DM
   - Click the landing page link

2. **Test Landing Page:**
   - Verify page loads correctly
   - Enter a test email in the EmailCapture component
   - Check MailerLite to confirm subscriber was added
   - Verify they're in the correct group

3. **Test Full Funnel:**
   - Test Calendly booking (if applicable)
   - Test Stripe payment (if applicable)
   - Verify events are logged in admin dashboard

4. **Test Edge Cases:**
   - Try commenting twice (ManyChat should handle gracefully)
   - Try different trigger keywords
   - Test on mobile device

---

## Configuration Checklist

Before launching for a client, verify:

- [ ] ManyChat connected to client's IG Business account
- [ ] Comment automation created and activated
- [ ] Keywords match what's in post caption
- [ ] Landing page URL is correct and includes UTM parameters
- [ ] Landing page has EmailCapture component with correct `source` prop
- [ ] Client's MailerLite group is configured in admin dashboard
- [ ] Test comment → DM → landing page → email capture
- [ ] Verify email appears in MailerLite
- [ ] Client has reviewed and approved messaging
- [ ] ManyChat Pro subscription is active

---

## Best Practices

### Messaging

- **Keep it conversational:** Write like you're texting a friend
- **Use emojis sparingly:** 1-2 per message max
- **Be clear and direct:** Tell them exactly what to do next
- **Create urgency (optional):** "Limited spots available" or "Special offer ends Friday"

### Keywords

- **Use multiple variations:** "INFO", "INFORMATION", "DETAILS", "INTERESTED"
- **Account for typos:** "INTRESTED", "INTERSTED"
- **Test different keywords:** See which converts best

### Timing

- **Respond quickly:** DMs should go out within seconds
- **Don't spam:** One DM is enough
- **Follow up via email:** Let MailerLite handle nurture sequences

### Compliance

- **Respect Instagram's rules:** Don't send too many DMs
- **Follow ManyChat's policies:** No prohibited content
- **Include unsubscribe option:** If sending multiple DMs over time
- **Be transparent:** Make it clear this is automated

---

## Common Issues & Troubleshooting

### Auto-reply not working

**Possible Causes:**
- Instagram account not connected properly
- Automation is not "Active" in ManyChat
- Keyword spelling doesn't match (check for extra spaces)
- ManyChat subscription expired
- Instagram disabled the automation (rate limit hit)

**Solutions:**
1. Check ManyChat → Settings → Instagram (connection status)
2. Verify automation toggle is ON
3. Check keyword configuration (case-insensitive should be enabled)
4. Review ManyChat billing status
5. Check ManyChat notification center for any warnings

### DM not received

**Possible Causes:**
- Instagram rate limits (max ~100 DMs per day)
- User has DMs turned off or restricted
- User has blocked/reported the account
- ManyChat delayed delivery (sometimes takes 1-2 minutes)

**Solutions:**
1. Wait 2-3 minutes before troubleshooting
2. Check if user's DMs are open (some users restrict DMs)
3. Check ManyChat logs (Automation → View Logs)
4. Verify you're not hitting rate limits (ManyChat dashboard shows this)

### Landing page link not working

**Possible Causes:**
- URL typo in ManyChat flow
- Landing page not deployed
- Landing page route doesn't match URL
- Server error on landing page

**Solutions:**
1. Copy-paste URL from ManyChat flow into browser
2. Verify landing page loads correctly
3. Check for typos in URL
4. Test URL with and without UTM parameters

### Email not captured

**Possible Causes:**
- EmailCapture component not configured with correct `source`
- MailerLite API key invalid or rotated
- MailerLite group ID incorrect
- Client is paused in admin dashboard

**Solutions:**
1. Check EmailCapture component source prop matches client slug
2. Verify client's MailerLite integration in admin dashboard
3. Check admin dashboard for error events
4. Ensure client status is ACTIVE (not PAUSED)

### ManyChat subscription issues

**Possible Causes:**
- Payment failed on client's ManyChat account
- Free trial expired
- Downgraded to free plan (doesn't support Instagram)

**Solutions:**
1. Have client check ManyChat billing
2. Instagram automation requires ManyChat Pro ($15-25/month)
3. Update payment method if needed

---

## Analytics & Optimization

### Track Performance

**In ManyChat:**
- Go to **Analytics** → **Instagram**
- View metrics:
  - Comment replies sent
  - DMs delivered
  - Button clicks (landing page visits)
  - Conversation flow completion

**In Admin Dashboard:**
- View email capture events for client
- Track lead stage progression
- Monitor MailerLite subscriber growth

**Key Metrics to Watch:**
1. **Comment → DM Rate:** Should be ~95%+ (automation working)
2. **DM → Landing Page Click Rate:** Target 30-50%
3. **Landing Page → Email Capture Rate:** Target 20-40%
4. **Email → Booking/Purchase Rate:** Varies by offer

### Optimization Tips

**If DM → Click rate is low (<30%):**
- Improve DM copy (add more value/curiosity)
- Make CTA clearer
- Test different button text
- Add social proof ("Join 500+ others")

**If Landing Page → Email rate is low (<20%):**
- Improve landing page headline
- Add testimonials/social proof
- Simplify form (remove friction)
- Clarify value proposition

**If overall conversion is low:**
- Review entire flow for friction points
- A/B test different keywords
- Test different posting times
- Improve post content quality

---

## Scaling Considerations

### Multiple Clients

- Each client needs their own ManyChat account OR separate flows
- Use naming convention: "Client Name - Comment Automation"
- Keep landing page URLs organized (use spreadsheet)

### Multiple Products per Client

- Create separate automations for different keywords
- Example:
  - "PROGRAM1" → Landing page A
  - "PROGRAM2" → Landing page B
- Track performance separately

### High Volume (100+ leads/day)

- Monitor ManyChat rate limits
- Consider upgrading ManyChat plan
- Set up multiple Instagram accounts if needed
- Use Instagram Stories + polls for additional capture

---

## Pro Tips

1. **Test with your own account first:** Always test before going live
2. **Save successful flows as templates:** Copy/paste for new clients
3. **Monitor first 24 hours closely:** Catch issues early
4. **Document client-specific settings:** Makes troubleshooting easier
5. **Set calendar reminder to check ManyChat:** Weekly review of performance
6. **Screenshot working flows:** Helps with support and documentation

---

## Client Handoff

### What to Give Client

- [ ] Access to their ManyChat account (or at least view-only)
- [ ] Post caption template with CTA
- [ ] Posting schedule recommendations
- [ ] Expected metrics/KPIs
- [ ] How to check if automation is working
- [ ] Your contact info for support

### What Client Should NOT Touch

- ❌ ManyChat automation flows (can break integration)
- ❌ Landing page URL in flows
- ❌ EmailCapture component configuration
- ✅ They CAN: Update messaging/tone
- ✅ They CAN: Change posting schedule

---

## Monthly Maintenance

**Check Monthly:**
- ManyChat subscription still active
- Automation still "Active" status
- Landing page still loads correctly
- Email capture still working (test it)
- Review performance metrics
- Update messaging if needed

**Report to Client:**
- Comments replied to
- DMs sent
- Landing page visits
- Email captures
- Bookings/purchases (if tracked)

---

## Additional Resources

- [ManyChat Instagram Guide](https://help.manychat.com/hc/en-us/categories/4408346516628-Instagram)
- [Instagram Business Setup](https://business.instagram.com/getting-started)
- [ManyChat Pro Pricing](https://manychat.com/pricing)

---

## Support

If you encounter issues not covered here:

1. Check ManyChat Help Center first
2. Review admin dashboard event logs
3. Test each component separately to isolate issue
4. Contact ManyChat support (they're responsive)

**Common Support Contacts:**
- ManyChat: support@manychat.com
- Instagram Business: [Help Center](https://help.instagram.com/contact/)

---

*Last updated: January 2025*

