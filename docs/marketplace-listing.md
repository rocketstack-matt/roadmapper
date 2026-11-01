# Marketplace listing

## Introductory description

GitHub limits this field to 255 characters.

Turn your GitHub issues into a shareable roadmap. Label issues Now, Next or Later and Roadmapper builds a roadmap for your public repo that you can embed in your README or docs, updated automatically as your issues change.

## Detailed description

Markdown. Kept under 1,000 characters, which I believe is GitHub's limit for this field; check the counter in the form.

```markdown
### Your roadmap, straight from your issues

Add a **Roadmap: Now**, **Roadmap: Next** or **Roadmap: Later** label to an issue and it appears in that column. Close or relabel it and the roadmap follows.

### Features

- **Embed anywhere:** an image for your README that links to the full roadmap, or an iframe or HTML image map for your docs where every card links to its issue
- **Your colours:** cards pick up your label colours, and the background and text colours are yours to set
- **Groups:** label issues `Roadmap Group: <name>` to group them within a column
- **Read-only:** Roadmapper only reads issues, works with public repositories and never writes to your repo

### Plans

- **Free:** refreshes every hour
- **Paid:** live updates within seconds of an issue changing
```

## Privacy policy and terms of service URLs

- **Privacy policy URL:** https://roadmapper.rocketstack.co/privacy
- **Terms of service URL:** https://roadmapper.rocketstack.co/terms

## Paid plan setup

Roadmapper reads the plan from the `marketplace_purchase` webhook (`lib/marketplace.js`), and checks it with GitHub's Marketplace API (`GET /marketplace_listing/accounts/{id}`) when an account has no recorded plan (every 10 minutes) or its record hasn't been checked for a day, so a missed delivery corrects itself. To turn on paid plans:

1. **Become a verified publisher.** Paid plans can only be listed by an app owned by an organization that is a verified publisher. Apply from the `rocket-stack` organization's settings (Developer settings → Publisher Verification). GitHub asks for complete organization profile information, two-factor authentication required for the organization, and a verified domain (for example `rocketstack.co`, with a DNS TXT record). Check GitHub's "Requirements for listing an app" page for the current conditions for paid listings, which have also included a minimum number of installations.
2. **Set up payouts.** Complete the listing's payout (Stripe Connect) details so GitHub can pay you.
3. **Subscribe the App to the Marketplace purchase event.** In the App's settings → Permissions & events → Subscribe to events, tick **Marketplace purchase**. Events go to the App's webhook URL (`https://roadmapper.rocketstack.co/api/webhook`) and are signed with `GITHUB_APP_WEBHOOK_SECRET`.
4. **Create the plans** under the listing's Plans and pricing: keep a **Free** plan (price model "Free"), and add the **Paid** plan (flat rate, monthly and yearly prices, optionally a free trial). Leave both plans in draft until the listing is approved.
5. **Map the plan id.** Note the paid plan's id (it's in the plan's edit URL and in the `marketplace_purchase` payload) and set `GITHUB_MARKETPLACE_PLANS` in Vercel to `{"<paid plan id>":"paid"}`, then redeploy. Any plan not listed, including Free, counts as free. Setting the variable also switches the setup page's upgrade link to the listing (`github.com/marketplace/<App slug>`; check it matches the listing URL).
6. **Optionally test against the stubbed API.** Before the plans are live, `GITHUB_MARKETPLACE_STUBBED=true` makes those checks read GitHub's stubbed endpoints (`/marketplace_listing/stubbed/accounts/{id}`), which return fake purchases. Unset it before going live.
7. **Submit the listing for review.** GitHub reviews paid listings before they go live, and tests the purchase flow (including the webhook) as part of the review.

Once live, a purchase, plan change or cancellation applies to every installation of the buying account. A cancellation or downgrade takes effect when GitHub sends it at the end of the billing cycle, and a free trial counts as paid. A tier set by hand with `scripts/set-tier.js` still applies: an installation gets whichever of the two is higher.
