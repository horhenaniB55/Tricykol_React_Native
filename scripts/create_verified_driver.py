import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime, timezone
import uuid
import argparse

# Initialize Firebase Admin SDK
cred = credentials.Certificate("service-account.json")
app = firebase_admin.initialize_app(cred, {
    'projectId': 'tricykol-b2296',
})

# Initialize Firestore client
db = firestore.client()

def create_verified_driver(phone_number: str, name: str = "Test Driver"):
    """
    Create a verified driver account with the given phone number.
    Also creates an associated wallet as per requirements.
    
    The driver document ID will match the Firebase Auth UID for the phone number.
    """
    try:
        # Format phone number to ensure it has the correct format
        # Firebase Auth requires E.164 format (e.g., +639670575500)
        if not phone_number.startswith('+'):
            phone_number = '+' + phone_number
        
        # First, create or get the Firebase Auth user with this phone number
        try:
            # Try to get existing user
            user = auth.get_user_by_phone_number(phone_number)
            print(f"Found existing user with phone {phone_number}, UID: {user.uid}")
        except auth.UserNotFoundError:
            # Create new user if not found
            user = auth.create_user(
                phone_number=phone_number,
                display_name=name
            )
            print(f"Created new user with phone {phone_number}, UID: {user.uid}")
        
        # Use the Firebase Auth UID as the driver document ID
        driver_id = user.uid
        
        # Create driver document
        driver_data = {
            'id': driver_id,
            'name': name,
            'profilePicture': None,
            'email': None,
            'sex': 'Male',  # You can modify this
            'dateOfBirth': datetime(1990, 1, 1, tzinfo=timezone.utc),  # You can modify this
            'phoneNumber': phone_number,
            'plateNumber': 'ABC123',  # You can modify this
            'licenseNumber': 'LIC123456',  # You can modify this
            'permitDocument': None,
            'isVerified': True,  # Setting as verified
            'permitVerified': True,  # Setting permit as verified
            'status': 'offline',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        # Create driver document with the same ID as the Auth UID
        driver_ref = db.collection('drivers').document(driver_id)
        driver_ref.set(driver_data)
        print(f"Created verified driver with ID: {driver_id}")
        
        # Create wallet for the driver (as per requirements)
        wallet_data = {
            'driverId': driver_id,
            'balance': 300.0,  # Free 300 pesos credit for verified drivers
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        # Create wallet document
        wallet_ref = db.collection('wallets').document(driver_id)
        wallet_ref.set(wallet_data)
        print(f"Created wallet for driver with initial balance of 300 pesos")
        
        # Set custom claims for the user to identify as a driver
        auth.set_custom_user_claims(driver_id, {'role': 'driver', 'verified': True})
        print(f"Set custom claims for user: role=driver, verified=true")
        
        return {
            'success': True,
            'driverId': driver_id,
            'phoneNumber': phone_number,
            'message': 'Verified driver account and wallet created successfully'
        }
        
    except Exception as e:
        print(f"Error creating verified driver: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Create a verified driver account')
    parser.add_argument('--phone', type=str, required=True, help='Phone number in E.164 format (e.g., +639670575500)')
    parser.add_argument('--name', type=str, default="Test Driver", help='Driver name')
    
    args = parser.parse_args()
    
    # Create verified driver with the specified phone number
    result = create_verified_driver(args.phone, args.name)
    print(result)
