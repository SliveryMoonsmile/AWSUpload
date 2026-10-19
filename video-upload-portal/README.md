# Secure Video & File Upload Portal

This is a deployable AWS CDK (TypeScript) backbone. The web page asks an authenticated API for a short-lived, one-file S3 upload URL; the browser then uploads directly to a **private** S3 bucket. No AWS credentials are exposed to visitors and no EC2 disk is used for uploads.

## Architecture

`Browser → Cognito-authenticated API Gateway → Lambda presigner → private S3`

S3 is the recommended home for video/files: it is durable, scalable, encrypted, and avoids filling an EC2 instance's root volume. The bucket blocks all public access, uses TLS and encryption, retains data if the stack is deleted, and limits accepted types to the allowlist in `lib/lambda/presign.ts` (5 GiB max). For files above 5 GiB, replace the single PUT signing flow with multipart upload signing.

## Prerequisites

- AWS account with permission to use CloudFormation, IAM, S3, Lambda, API Gateway, and Cognito
- Node.js 20+ and AWS CLI v2 installed locally
- AWS CLI credentials configured for the target account/region (`aws configure`)

## Deploy with the AWS Console (no terminal required)

1. Zip this project **without** `node_modules`; put it in a GitHub repository.
2. Open the AWS Console → **CloudShell** (terminal icon in the top bar). Run `git clone <your-repository-url>`, then `cd video-upload-portal`.
3. Run `npm install`, then `npx cdk bootstrap`. This creates CDK's one-time deployment resources in the selected account/region.
4. Choose where the web page will live before deployment. For example, create a static-hosting site in **AWS Amplify** (recommended) or an HTTPS CloudFront domain. Copy its full origin, such as `https://main.example.amplifyapp.com` — no trailing slash.
5. Run `npx cdk deploy --parameters AllowedOrigin=https://main.example.amplifyapp.com`. Confirm the security changes. Copy the four CloudFormation outputs.
6. In Cognito console → **User pools** → `UploadPortalStack-PortalUsers...` → **Users**, choose **Create user**. This is the intentional access gate; self-registration is off.
7. In `web/app.js`, replace `REPLACE_WITH_API_URL` with the `ApiUrl` output. In Amplify Console → your app → **Deployments**, upload/deploy the `web/` folder (or commit it to its connected repository).
8. Open the site, obtain a Cognito access token through a Cognito-compatible sign-in flow, paste it in the portal, and test an upload. Confirm it appears in S3 Console → the bucket named by `BucketName` → `uploads/`.

### Token/UI production note

The sample exposes a token input to keep the browser code dependency-free. Replace it before inviting users with Cognito Hosted UI or Amplify Auth so users sign in normally and tokens stay in browser memory. The infrastructure already provides the User Pool and app client required for that swap.

## AWS Console operations

- **View or download:** S3 Console → bucket → object. Keep objects private; generate time-limited download links from a separate authenticated API instead of toggling public access.
- **Add users:** Cognito → User pools → Users → Create user.
- **Restrict site origin:** deploy again with the real HTTPS portal origin. Do not use `*`.
- **Monitor:** CloudWatch → Log groups → the `PresignUpload` Lambda log group; CloudTrail records control-plane changes.
- **Costs:** S3 storage/data transfer, API Gateway requests, Lambda execution, Cognito active users, and Amplify/CloudFront hosting. Set AWS Budgets alerts before broad rollout.

## Local validation and deployment

```bash
npm install
npm run synth
npx cdk deploy --parameters AllowedOrigin=https://your-portal.example
```

## Before production

- Add Cognito Hosted UI/Amplify Auth, a branded domain, and MFA where appropriate.
- Add malware scanning/quarantine (S3 event → Lambda/antivirus service) before downstream processing.
- Use multipart presigned uploads for large videos; enforce per-user quotas and add WAF/rate limits.
- Add S3 lifecycle rules to archive or expire old uploads, and use KMS encryption if your compliance policy requires customer-managed keys.

## Important

This project is an upload service, not an EC2 server. If you already run EC2, host only the static `web/` folder behind HTTPS and keep the upload API + S3 design; do not accept uploads directly into the EC2 filesystem unless you also manage disk capacity, backups, TLS, auth, and malware scanning.
