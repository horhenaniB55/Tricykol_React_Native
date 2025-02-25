# Tricykol OTP Service

Express.js service for handling OTP generation and verification for the Tricykol Driver App.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Copy .env.example to .env
- Set your SEMAPHORE_API_KEY in .env

3. Add service account:
- Place your Firebase service account JSON file as `service-account.json` in the root directory

## Local Development

Run the service locally:
```bash
npm run dev
```

## Cloud Run Deployment

1. Initialize Google Cloud project:
```bash
gcloud init
```

2. Set up Secret Manager:
```bash
# Create secret for Semaphore API key
gcloud secrets create semaphore-api-key --replication-policy="automatic"
gcloud secrets versions add semaphore-api-key --data-file=.env
```

3. Deploy to Cloud Run:
```bash
gcloud run deploy otp-service \
  --source . \
  --region asia-southeast1 \
  --set-secrets SEMAPHORE_API_KEY=semaphore-api-key:latest \
  --allow-unauthenticated
```

## API Endpoints

### Health Check
```
GET /
```

### Send OTP
```
POST /send-otp
Body: {
  "phone": "phone_number"
}
```

### Verify OTP
```
POST /verify-otp
Body: {
  "phone": "phone_number",
  "otp": "otp_code"
}
```

## Environment Variables

- `SEMAPHORE_API_KEY`: API key for Semaphore SMS service
- `PORT`: (Optional) Port number for the server (defaults to 8080)

## Security Notes

- The service account JSON and .env file should never be committed to version control
- Use Secret Manager in production for sensitive values
- Enable request rate limiting in production
