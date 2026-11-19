# 3dPixenzs website export

Source snapshot from the published ChatGPT Sites version at commit
`2d2b4b76ac2203efec59106f4b982bb17ee69cb8`. It includes the product defaults,
images, checkout, customer policies, owner dashboard, and printable receipts.
The Spinning Top and Spiral Spinner are disabled in the default catalog and can
be re-enabled in Admin.

## Deploy to Vercel

1. Extract the ZIP and commit its contents to your repository. Import that
   repository in Vercel. Use the folder containing vercel.json as the project
   root and leave its build settings in place. The bundled Worker is included.
2. Create a private Cloudflare R2 bucket and bucket-scoped S3 credentials with
   object read and write access. Add the R2 variables in .env.example to the
   Vercel project.
3. Set ADMIN_EMAIL to your owner email and ADMIN_PASSWORD to a generated password
   of at least 20 characters. Put the password and API credentials in Vercel's
   environment settings. Vercel Admin uses the browser's login prompt at /admin.
4. Deploy, open the storefront and /admin, and verify an order and receipt with
   test data. Checkout needs working R2 storage. For order emails, configure a
   verified Resend sender and its key, or enable FormSubmit after activating the
   recipient inbox. Check both the notification status and the receiving inbox.

This export ships code and bundled assets. Hosted orders, dashboard records,
saved configuration, uploaded media, and secrets reside in the live project's
storage and are separate from this export. Use a new private bucket for a fresh
deployment. Existing ChatGPT Sites hosting and its order records are untouched.

## Editing and local preview

Edit web/ and worker/, then run `npm run build` with Python 3 and Node to regenerate
dist/. Commit the regenerated dist/ for Vercel. Run `node scripts/test-operations.mjs`
for checkout and Admin API checks. Run `npm run dev` for the in-memory preview
with local owner simulation and email disabled. The Vercel adapter requires real
R2 settings and should be smoke-tested on your own Vercel deployment.
