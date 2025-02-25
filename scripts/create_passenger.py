import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone
import uuid

# Initialize Firebase Admin SDK
cred = credentials.Certificate("service-account.json")
app = firebase_admin.initialize_app(cred, {
    'projectId': 'tricykol-b2296',
})

# Initialize Firestore client
db = firestore.client()

def create_passenger(phone_number: str):
    """
    Create a passenger account with the given phone number.
    """
    try:
        # Generate a unique ID for the passenger
        passenger_id = str(uuid.uuid4())
        
        # Create passenger document
        passenger_data = {
            'id': passenger_id,
            'name': 'Test Passenger',  # You can modify this
            'email': None,  # Optional
            'phoneNumber': phone_number,
            'sex': 'Male',  # You can modify this
            'dateOfBirth': datetime(1990, 1, 1, tzinfo=timezone.utc),  # You can modify this
            # Guardian/parent/contact person (optional)
            'guardian': {
                'name': 'Test Guardian',  # You can modify this
                'relationship': 'Parent',  # You can modify this
                'phoneNumber': '09670575500'  # You can modify this
            },
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        # Create passenger document
        passenger_ref = db.collection('passengers').document(passenger_id)
        passenger_ref.set(passenger_data)
        print(f"Created passenger account with ID: {passenger_id}")
        
        return {
            'success': True,
            'passengerId': passenger_id,
            'message': 'Passenger account created successfully'
        }
        
    except Exception as e:
        print(f"Error creating passenger: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    # Create passenger with the specified phone number
    result = create_passenger("09670575500")
    print(result)
