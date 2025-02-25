# Tricykol Driver Scripts

This directory contains utility scripts for the Tricykol Driver App.

## Create Verified Driver Script

The `create_verified_driver.py` script creates a verified driver account with an associated wallet.

### Prerequisites

1. Python 3.7 or higher
2. Firebase Admin SDK credentials (service account JSON file)
3. Required Python packages:
   ```
   firebase-admin
   ```

### Setup

1. Install the required package:
   ```bash
   pip install firebase-admin
   ```

2. Place your Firebase service account JSON file in a secure location and update the path in the script:
   ```python
   cred = credentials.Certificate("path/to/service-account.json")
   ```

### Usage

Run the script:
```bash
python create_verified_driver.py
```

The script will:
1. Create a verified driver account with the specified phone number
2. Create a wallet for the driver with 300 pesos initial credit
3. Set all necessary flags and statuses for a verified account

### Output

The script will output:
- Driver ID of the created account
- Confirmation of wallet creation
- Any errors if they occur
